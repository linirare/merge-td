process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only';
const assert = require('assert');
const http = require('http');
const { server } = require('../server/index');
const db = require('../server/db');

function req(method, base, pathname, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const u = new URL(base + pathname);
    const headers = {};
    if (data) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = data.length; }
    if (token) headers.Authorization = 'Bearer ' + token;
    const r = http.request({ host: u.hostname, port: u.port, path: u.pathname, method, headers }, res => {
      let buf = '';
      res.on('data', c => { buf += c; });
      res.on('end', () => {
        let json = {};
        try { json = JSON.parse(buf || '{}'); } catch (e) {}
        resolve({ status: res.statusCode, body: json });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function cleanup(email) {
  const row = db.prepare('SELECT uid FROM users WHERE email=?').get(email);
  if (!row) return;
  const uid = row.uid;
  for (const table of ['user_events', 'battle_pass', 'user_achievements', 'user_tasks', 'guild_members', 'user_saves', 'leaderboard', 'mail', 'checkins']) {
    try { db.prepare(`DELETE FROM ${table} WHERE uid=?`).run(uid); } catch (e) {}
  }
  try { db.prepare('DELETE FROM replays WHERE uid1=? OR uid2=?').run(uid, uid); } catch (e) {}
  try { db.prepare('DELETE FROM guilds WHERE leader_uid=?').run(uid); } catch (e) {}
  db.prepare('DELETE FROM users WHERE uid=?').run(uid);
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const email = 'social-security-test@example.com';
  const taskId = 'sec_task_progress';
  const achvId = 'sec_achv_known';
  const eventId = 'sec_event_score';

  try {
    cleanup(email);
    db.prepare('INSERT OR REPLACE INTO tasks (id,category,title,desc,target,reward_json) VALUES (?,?,?,?,?,?)')
      .run(taskId, 'daily', 'security task', '', 100, JSON.stringify({ gold: 999999, gems: 999999 }));
    db.prepare('INSERT OR REPLACE INTO achievements (id,title,desc,reward_json) VALUES (?,?,?,?)')
      .run(achvId, 'security achv', '', JSON.stringify({ gems: 999999 }));
    db.prepare('INSERT OR REPLACE INTO events (id,title,desc,start,end,reward_json) VALUES (?,?,?,?,?,?)')
      .run(eventId, 'security event', '', '2000-01-01', '2099-01-01', '{}');

    const reg = await req('POST', base, '/api/auth/register', { email, password: 'pw123456', nickname: '<img onerror=1>' });
    assert.ok(reg.body.token, 'register returns token');
    const token = reg.body.token;
    assert.ok(!String(reg.body.nickname || '').includes('<'), 'nickname sanitized at register');

    const guild = await req('POST', base, '/api/guild/create', { name: '<b onclick=1>LongLongLongLongGuildName</b>' }, token);
    assert.strictEqual(guild.status, 200);
    assert.ok(!guild.body.name.includes('<'), 'guild name sanitized');
    assert.ok(guild.body.name.length <= 18, 'guild name length capped');

    const progress = await req('POST', base, '/api/tasks/progress', { task_id: taskId, delta: 999999 }, token);
    assert.strictEqual(progress.status, 200);
    assert.strictEqual(progress.body.progress, 20, 'task progress delta capped');

    const unknownTask = await req('POST', base, '/api/tasks/progress', { task_id: 'missing_task', delta: 1 }, token);
    assert.strictEqual(unknownTask.status, 404, 'unknown task rejected');

    const achv = await req('POST', base, '/api/achievements/unlock', { achv_id: achvId }, token);
    assert.strictEqual(achv.status, 200);
    assert.strictEqual(achv.body.reward.gems, 300, 'achievement reward clamped to server cap');

    const unknownAchv = await req('POST', base, '/api/achievements/unlock', { achv_id: 'missing_achv' }, token);
    assert.strictEqual(unknownAchv.status, 404, 'unknown achievement rejected');

    const bp = await req('POST', base, '/api/battlepass/exp', { exp: 999999 }, token);
    assert.ok(bp.body.tier <= 5, 'battlepass exp per report capped');

    const score = await req('POST', base, '/api/events/score', { event_id: eventId, score: 999999999 }, token);
    assert.strictEqual(score.status, 200);
    const storedScore = db.prepare('SELECT score FROM user_events WHERE uid=? AND event_id=?').get(reg.body.uid, eventId);
    assert.strictEqual(storedScore.score, 100000, 'event score capped');

    const badReplay = await req('POST', base, '/api/replay/save', { uid2: '<script>', actions_json: 'not-json', result: '<b>win</b>' }, token);
    assert.strictEqual(badReplay.status, 413, 'invalid replay json rejected');

    console.log('OK: social and ops endpoints sanitize ids/text and clamp client-reported progress');
  } finally {
    cleanup(email);
    try { db.prepare('DELETE FROM tasks WHERE id=?').run(taskId); } catch (e) {}
    try { db.prepare('DELETE FROM achievements WHERE id=?').run(achvId); } catch (e) {}
    try { db.prepare('DELETE FROM events WHERE id=?').run(eventId); } catch (e) {}
    await new Promise(resolve => server.close(resolve));
  }
})().catch(err => {
  console.error(err);
  server.close(() => process.exit(1));
});
