process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only';
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { server, POWER_MAX } = require('../server/index');
const db = require('../server/db');

// —— 1) 用真 config 重算"理论最大战力"(全员满养成满星),自守卫 POWER_MAX ≥ 它 ——
function theoreticalMaxPower() {
  const sb = {
    console, JSON, Math, Date: { now: () => 0 },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, createElement: () => ({ getContext: () => ({}), style: {}, classList: { add() {}, remove() {}, toggle() {} } }), addEventListener() {} },
  };
  sb.window = sb; sb.globalThis = sb;
  const code = ['js/config.js', 'js/state.js'].map(f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')).join('\n');
  const driver = '\n;globalThis.__MAXP__=(function(){ meta.shardsTotal={}; for(const id of UNIT_POOL) meta.shardsTotal[id]=1e9; return computePower(); })();';
  vm.createContext(sb);
  vm.runInContext(code + driver, sb, { filename: 'powcap.js' });
  return sb.__MAXP__;
}

function req(method, base, pathname, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const u = new URL(base + pathname);
    const headers = {};
    if (data) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = data.length; }
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const r = http.request({ host: u.hostname, port: u.port, path: u.pathname, method, headers }, res => {
      let buf = ''; res.on('data', c => buf += c);
      res.on('end', () => { try { resolve(JSON.parse(buf || '{}')); } catch (e) { resolve({}); } });
    });
    r.on('error', reject); if (data) r.write(data); r.end();
  });
}

function cleanupUser(email) {
  try {
    const row = db.prepare('SELECT uid FROM users WHERE email = ?').get(email);
    if (!row) return;
    for (const t of ['user_saves', 'leaderboard', 'mail', 'checkins']) { try { db.prepare(`DELETE FROM ${t} WHERE uid = ?`).run(row.uid); } catch (e) {} }
    db.prepare('DELETE FROM users WHERE uid = ?').run(row.uid);
  } catch (e) {}
}

(async () => {
  const maxP = theoreticalMaxPower();
  assert.ok(POWER_MAX >= maxP, `POWER_MAX(${POWER_MAX}) 必须 ≥ 实时理论最大战力(${maxP}) —— 若加了内容抬高上限,请同步调大 POWER_MAX`);

  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const email = 'power-cap-test@example.com';
  try {
    cleanupUser(email);
    const reg = await req('POST', base, '/api/auth/register', { email, password: 'pw123456', nickname: '战力测试' });
    assert.ok(reg.token, 'register should return token');

    // 合理战力(200,低于理论上限)应原样接受
    const s1 = await req('POST', base, '/api/save', { power: 200 }, reg.token);
    assert.strictEqual(s1.accepted.power, 200, '合理战力 200 应被接受');

    // 作弊战力(999999)必须被夹到 POWER_MAX
    const s2 = await req('POST', base, '/api/save', { power: 999999 }, reg.token);
    assert.strictEqual(s2.accepted.power, POWER_MAX, `作弊战力 999999 应被夹到 ${POWER_MAX}`);

    const prof = await req('GET', base, '/api/user/profile', null, reg.token);
    assert.strictEqual(prof.power, POWER_MAX, 'profile 读回的战力应为夹取值');

    console.log(`OK: leaderboard power capped at ${POWER_MAX} (theoretical max ${maxP}), cheat 999999 rejected`);
  } finally {
    cleanupUser(email);
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 250);
      server.close(() => { clearTimeout(timer); resolve(); });
    });
  }
  process.exit(0);
})().catch(err => { console.error(err); server.close(() => process.exit(1)); });
