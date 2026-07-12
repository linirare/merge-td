process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only';
const assert = require('assert');
const http = require('http');
const net = require('net');
const { server, chatMessages } = require('../server/index');
const db = require('../server/db');

// ---- 最小 WebSocket 客户端(掩码发送 / 解析服务端帧) ----
function encodeClientFrame(value) {
  const body = Buffer.from(JSON.stringify(value));
  const mask = Buffer.from([0x11, 0x22, 0x33, 0x44]);
  let header;
  if (body.length < 126) header = Buffer.from([0x81, 0x80 | body.length]);
  else { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 0x80 | 126; header.writeUInt16BE(body.length, 2); }
  const masked = Buffer.alloc(body.length);
  for (let i = 0; i < body.length; i++) masked[i] = body[i] ^ mask[i % 4];
  return Buffer.concat([header, mask, masked]);
}

class RawWs {
  constructor(socket) { this.socket = socket; }
  static connect(port, token) {
    return new Promise((resolve, reject) => {
      const path = '/pvp' + (token ? '?token=' + encodeURIComponent(token) : '');
      const socket = net.createConnection({ host: '127.0.0.1', port }, () => {
        socket.write([
          `GET ${path} HTTP/1.1`, 'Host: 127.0.0.1', 'Upgrade: websocket', 'Connection: Upgrade',
          'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==', 'Sec-WebSocket-Version: 13', '', '',
        ].join('\r\n'));
      });
      let header = Buffer.alloc(0);
      const onData = chunk => {
        header = Buffer.concat([header, chunk]);
        const idx = header.indexOf('\r\n\r\n');
        if (idx < 0) return;
        assert.match(header.subarray(0, idx).toString('utf8'), /101 Switching Protocols/);
        socket.off('data', onData);
        resolve(new RawWs(socket));
      };
      socket.on('data', onData);
      socket.on('error', reject);
    });
  }
  send(value) { this.socket.write(encodeClientFrame(value)); }
  close() { this.socket.destroy(); }
}

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(body));
    const u = new URL(url);
    const req = http.request({ host: u.hostname, port: u.port, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } }, res => {
      let buf = ''; res.on('data', c => buf += c);
      res.on('end', () => { try { resolve(JSON.parse(buf || '{}')); } catch (e) { resolve({}); } });
    });
    req.on('error', reject); req.write(data); req.end();
  });
}

function waitFor(cond, timeoutMs = 1000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (cond()) { clearInterval(iv); resolve(); }
      else if (Date.now() - t0 > timeoutMs) { clearInterval(iv); reject(new Error('timeout waiting for condition')); }
    }, 15);
  });
}

function cleanupUser(email) {
  try {
    const row = db.prepare('SELECT uid FROM users WHERE email = ?').get(email);
    if (!row) return;
    // 先删引用 uid 的子表(外键约束开启),再删主表
    for (const t of ['user_saves', 'leaderboard', 'mail', 'checkins']) {
      try { db.prepare(`DELETE FROM ${t} WHERE uid = ?`).run(row.uid); } catch (e) {}
    }
    db.prepare('DELETE FROM users WHERE uid = ?').run(row.uid);
  } catch (e) {}
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const email = 'pvp-auth-test@example.com';
  const realNick = '真名玩家A';
  try {
    cleanupUser(email);
    const reg = await postJson(base + '/api/auth/register', { email, password: 'pw123456', nickname: realNick });
    assert.ok(reg.token && reg.uid, 'register should return token + uid');

    // 1) 已登录客户端发聊天,自报一个冒充昵称"管理员" —— 服务端必须用真昵称覆盖
    chatMessages.length = 0;
    const authed = await RawWs.connect(port, reg.token);
    authed.send({ type: 'chat', text: 'hello', nick: '管理员', nickname: '管理员' });
    await waitFor(() => chatMessages.length >= 1);
    const m1 = chatMessages[chatMessages.length - 1];
    assert.strictEqual(m1.nick, realNick, 'authed chat must use server-side nickname, not client-asserted');
    assert.strictEqual(m1.uid, reg.uid, 'authed chat must carry server-side uid');
    authed.close();

    // 2) 游客(无 token)发聊天,自报别人的昵称 —— 必须被标为"游客",无法冒充
    const guest = await RawWs.connect(port, '');
    guest.send({ type: 'chat', text: 'hi', nick: realNick, nickname: realNick });
    await waitFor(() => chatMessages.length >= 2);
    const m2 = chatMessages[chatMessages.length - 1];
    assert.strictEqual(m2.nick, '游客', 'guest chat must be labeled 游客, cannot spoof a real nickname');
    assert.strictEqual(m2.uid, '', 'guest chat must not carry any uid');
    guest.close();

    console.log('OK: pvp chat nickname is server-authenticated (no spoofing)');
  } finally {
    cleanupUser(email);
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 250);
      server.close(() => { clearTimeout(timer); resolve(); });
    });
  }
  process.exit(0);
})().catch(err => { console.error(err); server.close(() => process.exit(1)); });
