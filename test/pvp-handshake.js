process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only';
process.env.PVP_RECONNECT_TIMEOUT_MS = process.env.PVP_RECONNECT_TIMEOUT_MS || '200';
const assert = require('assert');
const http = require('http');
const net = require('net');
const { handlePvpUpgrade, _internals } = require('../server/pvp-server');

function encodeClientFrame(value) {
  const body = Buffer.from(JSON.stringify(value));
  const mask = Buffer.from([0x11, 0x22, 0x33, 0x44]);
  let header;
  if (body.length < 126) {
    header = Buffer.from([0x81, 0x80 | body.length]);
  } else {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(body.length, 2);
  }
  const masked = Buffer.alloc(body.length);
  for (let i = 0; i < body.length; i++) masked[i] = body[i] ^ mask[i % 4];
  return Buffer.concat([header, mask, masked]);
}

function decodeServerFrames(buffer) {
  const messages = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const first = buffer[offset];
    const second = buffer[offset + 1];
    const opcode = first & 0x0f;
    let len = second & 0x7f;
    let pos = offset + 2;
    if (len === 126) {
      if (pos + 2 > buffer.length) break;
      len = buffer.readUInt16BE(pos);
      pos += 2;
    } else if (len === 127) {
      if (pos + 8 > buffer.length) break;
      len = Number(buffer.readBigUInt64BE(pos));
      pos += 8;
    }
    if (pos + len > buffer.length) break;
    const body = buffer.subarray(pos, pos + len);
    pos += len;
    offset = pos;
    if (opcode === 0x1) messages.push(JSON.parse(body.toString('utf8')));
  }
  return { messages, rest: buffer.subarray(offset) };
}

class RawWs {
  constructor(socket) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.messages = [];
    this.waiters = [];
    socket.on('data', chunk => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      const decoded = decodeServerFrames(this.buffer);
      this.buffer = decoded.rest;
      this.messages.push(...decoded.messages);
      this.flush();
    });
  }

  static connect(port) {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: '127.0.0.1', port }, () => {
        socket.write([
          'GET /pvp HTTP/1.1',
          'Host: 127.0.0.1',
          'Upgrade: websocket',
          'Connection: Upgrade',
          'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
          'Sec-WebSocket-Version: 13',
          '',
          '',
        ].join('\r\n'));
      });
      let header = Buffer.alloc(0);
      const onData = chunk => {
        header = Buffer.concat([header, chunk]);
        const idx = header.indexOf('\r\n\r\n');
        if (idx < 0) return;
        const text = header.subarray(0, idx).toString('utf8');
        assert.match(text, /101 Switching Protocols/);
        socket.off('data', onData);
        const client = new RawWs(socket);
        const rest = header.subarray(idx + 4);
        if (rest.length) socket.emit('data', rest);
        resolve(client);
      };
      socket.on('data', onData);
      socket.on('error', reject);
    });
  }

  send(value) {
    this.socket.write(encodeClientFrame(value));
  }

  flush() {
    while (this.waiters.length && this.messages.length) {
      const next = this.waiters.shift();
      next(this.messages.shift());
    }
  }

  next(timeoutMs = 1000) {
    if (this.messages.length) return Promise.resolve(this.messages.shift());
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out waiting for websocket message')), timeoutMs);
      this.waiters.push(message => {
        clearTimeout(timer);
        resolve(message);
      });
    });
  }

  async nextType(type, timeoutMs = 1000) {
    for (;;) {
      let message;
      try {
        message = await this.next(timeoutMs);
      } catch (err) {
        err.message = `timed out waiting for ${type}; queued=${this.messages.map(m => m.type).join(',') || 'none'}`;
        throw err;
      }
      if (message.type === type) return message;
    }
  }

  close() {
    this.socket.destroy();
  }

  disconnect() {
    this.socket.end();
  }
}

async function startMatch(port) {
  const host = await RawWs.connect(port);
  const guest = await RawWs.connect(port);

  host.send({ type: 'create_room' });
  const created = await host.nextType('room_created');
  assert.ok(/^\d{4}$/.test(created.roomId));

  guest.send({ type: 'join_room', roomId: created.roomId });
  const joined = await guest.nextType('room_joined');
  assert.strictEqual(joined.roomId, created.roomId);
  await host.nextType('peer_joined');

  host.send({ type: 'ready', ready: true, deck: ['watermelon_guard', 'grape_archer'], commander: 'juice_sage' });
  guest.send({ type: 'ready', ready: true, deck: ['banana_raider', 'orange_cannon'], commander: 'berry_general' });
  const startA = await host.nextType('match_start');
  const startB = await guest.nextType('match_start');
  assert.strictEqual(startA.seed, startB.seed);
  assert.ok(Number.isInteger(startA.seed));
  assert.deepStrictEqual(startA.commanders, ['juice_sage', 'berry_general']);
  assert.deepStrictEqual(startB.commanders, ['juice_sage', 'berry_general']);

  const snap0 = await host.nextType('snapshot', 2500);
  assert.ok(snap0.snap && snap0.snap.walls && Array.isArray(snap0.snap.soldiers), 'snapshot 应含 walls + soldiers');
  assert.ok(snap0.snap.boards && snap0.snap.boards.p && snap0.snap.boards.e, 'snapshot 应含双方棋盘');
  assert.strictEqual(snap0.snap.commanders.p.id, 'juice_sage');
  assert.strictEqual(snap0.snap.commanders.e.id, 'berry_general');
  await guest.nextType('snapshot', 2500);

  return { host, guest, roomId: created.roomId, seed: startA.seed };
}

async function assertNoMessageType(client, type, timeoutMs = 350) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const remaining = Math.max(1, deadline - Date.now());
    try {
      const message = await client.next(Math.min(remaining, 50));
      if (message.type === type) assert.fail(`unexpected ${type}: ${JSON.stringify(message)}`);
    } catch (err) {
      if (!/timed out waiting for websocket message/.test(err.message)) throw err;
    }
  }
}

(async () => {
  _internals.rooms.clear();
  _internals.allClients.clear();
  const server = http.createServer();
  server.on('upgrade', handlePvpUpgrade);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  let host;
  let guest;
  let guest2;
  let createdRoomId;
  let startASeed;
  let completed = false;
  try {
    ({ host, guest, roomId: createdRoomId, seed: startASeed } = await startMatch(port));

    // 合法操作打进权威模拟:host(index0)召唤应落到快照 boards.p[1][2]
    host.send({ type: 'action', action: { seq: 1, seed: startASeed, timestamp: Date.now(), type: 'summon_cell', payload: { r: 1, c: 2, type: 'watermelon_guard', level: 1 } } });
    let applied = false;
    for (let i = 0; i < 25 && !applied; i++) {
      const s = await host.nextType('snapshot', 2500);
      if (s.snap.boards.p[1] && s.snap.boards.p[1][2]) applied = true;
    }
    assert.ok(applied, '合法召唤应被服务端应用到本方棋盘(权威)');

    // 重复 seq → invalid_action
    host.send({ type: 'action', action: { seq: 1, seed: startASeed, timestamp: Date.now(), type: 'summon_cell', payload: { r: 0, c: 0, type: 'grape_archer' } } });
    const duplicate = await host.nextType('error');
    assert.strictEqual(duplicate.message, 'invalid_action');

    // 非法操作类型 → invalid_action
    host.send({ type: 'action', action: { seq: 2, seed: startASeed, timestamp: Date.now(), type: 'hack_gold', payload: { gold: 999999 } } });
    const invalidType = await host.nextType('error');
    assert.strictEqual(invalidType.message, 'invalid_action');

    // 超大 payload → invalid_action
    host.send({ type: 'action', action: { seq: 2, seed: startASeed, timestamp: Date.now(), type: 'summon_cell', payload: { r: 1, c: 1, blob: 'x'.repeat(2048) } } });
    const hugePayload = await host.nextType('error');
    assert.strictEqual(hugePayload.message, 'invalid_action');

    // 频率限制:洪水式发操作,错误流里应出现 action_rate_limited
    for (let seq = 2; seq <= 22; seq++) {
      host.send({ type: 'action', action: { seq, seed: startASeed, timestamp: Date.now(), type: 'summon_cell', payload: { r: seq % 3, c: seq % 5, type: 'banana_raider' } } });
    }
    let sawRateLimit = false;
    for (let i = 0; i < 30 && !sawRateLimit; i++) {
      const e = await host.nextType('error', 2000);
      if (e.message === 'action_rate_limited') sawRateLimit = true;
    }
    assert.ok(sawRateLimit, '洪水操作应触发 action_rate_limited');

    // 对局中断线:先广播 peer_disconnected,保留房间等待重连;超时后才判剩者胜
    guest.disconnect();
    const disconnected = await host.nextType('peer_disconnected', 3000);
    assert.strictEqual(disconnected.roomId, createdRoomId);
    const left = await host.nextType('peer_left', 3000);
    assert.strictEqual(left.roomId, createdRoomId);
    const result = await host.nextType('match_result', 3000);
    assert.strictEqual(result.result.winner, 0, '剩下的 host(index0)应判胜');
    assert.strictEqual(result.result.reason, 'disconnect_timeout');
    assert.strictEqual(result.result.seed, startASeed);
    host.close();
    guest.close();

    // 主动离房:仍保持立即 peer_left + peer_left 结算语义
    ({ host, guest, roomId: createdRoomId, seed: startASeed } = await startMatch(port));
    guest.send({ type: 'leave_room' });
    const activeLeft = await host.nextType('peer_left', 3000);
    assert.strictEqual(activeLeft.roomId, createdRoomId);
    const activeResult = await host.nextType('match_result', 3000);
    assert.strictEqual(activeResult.result.winner, 0);
    assert.strictEqual(activeResult.result.reason, 'peer_left');
    assert.strictEqual(activeResult.result.seed, startASeed);
    host.close();
    guest.close();

    // 断线后 30s 窗口内重连:应收到 reconnected/peer_reconnected,继续收到快照,不产生结算
    ({ host, guest, roomId: createdRoomId } = await startMatch(port));
    guest.disconnect();
    const reconnectNotice = await host.nextType('peer_disconnected', 3000);
    assert.strictEqual(reconnectNotice.roomId, createdRoomId);
    guest2 = await RawWs.connect(port);
    guest2.send({ type: 'reconnect_room', roomId: createdRoomId });
    const reconnected = await guest2.nextType('reconnected', 3000);
    assert.strictEqual(reconnected.roomId, createdRoomId);
    assert.strictEqual(reconnected.playerIndex, 1);
    const peerBack = await host.nextType('peer_reconnected', 3000);
    assert.strictEqual(peerBack.roomId, createdRoomId);
    await guest2.nextType('snapshot', 3000);
    await assertNoMessageType(host, 'match_result', 350);

    completed = true;
  } finally {
    if (host) host.close();
    if (guest) guest.close();
    if (guest2) guest2.close();
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 250);
      server.close(() => { clearTimeout(timer); resolve(); });
    });
    _internals.rooms.clear();
    _internals.allClients.clear();
  }
  assert.ok(completed, 'pvp flow should complete all assertions');
  if (completed) process.stdout.write('OK: pvp handshake, authority actions, active leave, disconnect timeout, and reconnect semantics work\n');
  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
