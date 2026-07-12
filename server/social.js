/* 水果突击 · 社交/玩法/商业化/体验/安全 综合路由 */
const crypto = require('crypto');
const db = require('./db');
const { authMiddleware } = require('./auth');
const { clampInt, safeText, safeJsonText } = require('./util');

function safeId(value, max = 64) {
  const text = safeText(value, max);
  return /^[a-zA-Z0-9_-]+$/.test(text) ? text : '';
}

function safeRewardJson(value) {
  try {
    const raw = typeof value === 'string' ? JSON.parse(value || '{}') : (value || {});
    return {
      gold: clampInt(raw.gold, 0, 5000, 0),
      gems: clampInt(raw.gems ?? raw.diamonds, 0, 300, 0),
    };
  } catch (e) {
    return { gold: 0, gems: 0 };
  }
}

function mountSocial(app) {
  /* ========== 好友 ========== */
  app.get('/api/friends', authMiddleware, (req, res) => {
    const rows = db.prepare(`SELECT u.uid,u.nickname,u.avatar,u.level,u.power FROM friends f JOIN users u ON (f.uid1=? AND u.uid=f.uid2) OR (f.uid2=? AND u.uid=f.uid1) WHERE f.status='accepted'`).all(req.uid, req.uid);
    res.json(rows);
  });
  app.get('/api/friends/pending', authMiddleware, (req, res) => {
    res.json(db.prepare(`SELECT u.uid,u.nickname,u.avatar FROM friends f JOIN users u ON f.uid1=u.uid WHERE f.uid2=? AND f.status='pending'`).all(req.uid));
  });
  app.post('/api/friends/add', authMiddleware, (req, res) => {
    const uid = safeId((req.body || {}).uid, 64);
    if (!uid || uid === req.uid) return res.status(400).json({ error: 'invalid uid' });
    const exists = db.prepare('SELECT * FROM friends WHERE (uid1=? AND uid2=?) OR (uid1=? AND uid2=?)').get(req.uid, uid, uid, req.uid);
    if (exists) return res.json({ ok: false, msg: 'already friends or pending' });
    db.prepare('INSERT INTO friends (uid1,uid2,status) VALUES (?,?,\'pending\')').run(req.uid, uid);
    res.json({ ok: true });
  });
  app.post('/api/friends/accept', authMiddleware, (req, res) => {
    const uid = safeId((req.body || {}).uid, 64);
    if (!uid) return res.status(400).json({ error: 'invalid uid' });
    db.prepare('UPDATE friends SET status=\'accepted\' WHERE uid1=? AND uid2=? AND status=\'pending\'').run(uid, req.uid);
    res.json({ ok: true });
  });
  app.post('/api/friends/reject', authMiddleware, (req, res) => {
    const uid = safeId((req.body || {}).uid, 64);
    if (!uid) return res.status(400).json({ error: 'invalid uid' });
    db.prepare('DELETE FROM friends WHERE uid1=? AND uid2=? AND status=\'pending\'').run(uid, req.uid);
    res.json({ ok: true });
  });
  app.delete('/api/friends', authMiddleware, (req, res) => {
    const uid = safeId((req.body || {}).uid, 64);
    if (!uid) return res.status(400).json({ error: 'invalid uid' });
    db.prepare('DELETE FROM friends WHERE (uid1=? AND uid2=?) OR (uid1=? AND uid2=?)').run(req.uid, uid, uid, req.uid);
    res.json({ ok: true });
  });

  /* ========== 公会 ========== */
  app.post('/api/guild/create', authMiddleware, (req, res) => {
    const name = safeText((req.body || {}).name, 18); if (!name) return res.status(400).json({ error: 'name required' });
    const exists = db.prepare('SELECT id FROM guilds WHERE name=?').get(name);
    if (exists) return res.json({ ok: false, msg: 'name taken' });
    const id = crypto.randomBytes(6).toString('hex');
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    db.prepare('INSERT INTO guilds (id,name,leader_uid,invite_code) VALUES (?,?,?,?)').run(id, name, req.uid, code);
    db.prepare('INSERT INTO guild_members (uid,guild_id,role) VALUES (?,?,\'leader\')').run(req.uid, id);
    res.json({ ok: true, id, name, invite_code: code });
  });
  app.post('/api/guild/join', authMiddleware, (req, res) => {
    const code = safeId((req.body || {}).code, 12);
    const g = db.prepare('SELECT id,name FROM guilds WHERE invite_code=?').get(code);
    if (!g) return res.json({ ok: false, msg: 'invalid code' });
    const exists = db.prepare('SELECT * FROM guild_members WHERE uid=?').get(req.uid);
    if (exists) return res.json({ ok: false, msg: 'already in a guild' });
    db.prepare('INSERT INTO guild_members (uid,guild_id,role) VALUES (?,?,\'member\')').run(req.uid, g.id);
    res.json({ ok: true, guild: g });
  });
  app.get('/api/guild/members', authMiddleware, (req, res) => {
    const m = db.prepare('SELECT guild_id FROM guild_members WHERE uid=?').get(req.uid);
    if (!m) return res.json([]);
    res.json(db.prepare(`SELECT u.uid,u.nickname,u.avatar,u.level,gm.role FROM guild_members gm JOIN users u ON gm.uid=u.uid WHERE gm.guild_id=?`).all(m.guild_id));
  });

  /* ========== 任务 ========== */
  app.get('/api/tasks', authMiddleware, (req, res) => {
    const tasks = db.prepare('SELECT * FROM tasks').all();
    const progress = db.prepare('SELECT task_id,progress,completed FROM user_tasks WHERE uid=?').all(req.uid);
    res.json(tasks.map(t => { const p = progress.find(x => x.task_id === t.id); return { ...t, progress: p ? p.progress : 0, completed: !!(p && p.completed) }; }));
  });
  app.post('/api/tasks/progress', authMiddleware, (req, res) => {
    const task_id = safeId((req.body || {}).task_id, 64);
    const delta = clampInt((req.body || {}).delta, 1, 20, 1);
    if (!task_id) return res.status(400).json({ error: 'task_id required' });
    const t = db.prepare('SELECT * FROM tasks WHERE id=?').get(task_id);
    if (!t) return res.status(404).json({ error: 'task not found' });
    // 审计S5:用原子UPDATE同时推进度+标记完成,避免并发双领奖励
    db.prepare('INSERT OR IGNORE INTO user_tasks (uid,task_id,progress) VALUES (?,?,0)').run(req.uid, task_id);
    const upResult = db.prepare('UPDATE user_tasks SET progress=progress+? WHERE uid=? AND task_id=? AND completed=0').run(delta || 1, req.uid, task_id);
    if (upResult.changes === 0) return res.json({ ok: true, progress: t.target, already: true }); // 已完成,不再操作
    const up = db.prepare('SELECT progress FROM user_tasks WHERE uid=? AND task_id=?').get(req.uid, task_id);
    if (t && up && up.progress >= t.target) {
      db.prepare('UPDATE user_tasks SET completed=1 WHERE uid=? AND task_id=?').run(req.uid, task_id);
      const rew = safeRewardJson(t.reward_json);
      db.prepare('UPDATE users SET gold=gold+?, diamonds=diamonds+? WHERE uid=?').run(rew.gold || 0, rew.gems || 0, req.uid);
      return res.json({ ok: true, completed: true, reward: rew });
    }
    res.json({ ok: true, progress: up ? up.progress : 0 });
  });

  /* ========== 成就 ========== */
  app.get('/api/achievements', authMiddleware, (req, res) => {
    const all = db.prepare('SELECT * FROM achievements').all();
    const user = db.prepare('SELECT achv_id FROM user_achievements WHERE uid=?').all(req.uid).map(r => r.achv_id);
    res.json(all.map(a => ({ ...a, unlocked: user.includes(a.id) })));
  });
  app.post('/api/achievements/unlock', authMiddleware, (req, res) => {
    const achv_id = safeId((req.body || {}).achv_id, 64);
    if (!achv_id) return res.status(400).json({ error: 'achv_id required' });
    const a = db.prepare('SELECT * FROM achievements WHERE id=?').get(achv_id);
    if (!a) return res.status(404).json({ error: 'achievement not found' });
    const exists = db.prepare('SELECT * FROM user_achievements WHERE uid=? AND achv_id=?').get(req.uid, achv_id);
    if (exists) return res.json({ ok: false, msg: 'already unlocked' });
    db.prepare('INSERT INTO user_achievements (uid,achv_id) VALUES (?,?)').run(req.uid, achv_id);
    const r = safeRewardJson(a.reward_json);
    db.prepare('UPDATE users SET diamonds=diamonds+? WHERE uid=?').run(r.gems || 0, req.uid);
    res.json({ ok: true, reward: r });
  });

  /* ========== 通行证 ========== */
  app.get('/api/battlepass', authMiddleware, (req, res) => res.json(db.prepare('SELECT * FROM battle_pass WHERE uid=?').get(req.uid) || { tier: 0, exp: 0, premium: 0 }));
  app.post('/api/battlepass/exp', authMiddleware, (req, res) => {
    const exp = clampInt((req.body || {}).exp, 1, 500, 0); if (!exp) return res.json({ ok: false });
    db.prepare('INSERT OR IGNORE INTO battle_pass (uid,season,tier,exp) VALUES (?,?,0,0)').run(req.uid, 'S1');
    const bp = db.prepare('SELECT tier,exp FROM battle_pass WHERE uid=?').get(req.uid);
    let lv = bp.tier, xp = bp.exp + exp;
    while (xp >= 100) { xp -= 100; lv++; }
    db.prepare('UPDATE battle_pass SET tier=?,exp=? WHERE uid=?').run(Math.min(30, lv), xp, req.uid);
    res.json({ tier: Math.min(30, lv), exp: xp });
  });
  app.post('/api/battlepass/buy', authMiddleware, (req, res) => {
    // 审计S4:事务包裹,避免并发双花钻石
    try {
      db.transaction(() => {
        const user = db.prepare('SELECT diamonds FROM users WHERE uid=?').get(req.uid);
        if ((user.diamonds || 0) < 300) throw new Error('insufficient');
        db.prepare('UPDATE users SET diamonds=diamonds-300 WHERE uid=?').run(req.uid);
        db.prepare('INSERT OR REPLACE INTO battle_pass (uid,season,tier,exp,premium) VALUES (?,?,0,0,1)').run(req.uid, 'S1');
      })();
      res.json({ ok: true });
    } catch(e) { res.json({ ok: false, msg: e.message === 'insufficient' ? 'insufficient diamonds' : 'failed' }); }
  });

  /* ========== 皮肤 ========== */
  app.get('/api/skins', (req, res) => res.json(db.prepare('SELECT * FROM skins').all()));
  app.get('/api/skins/my', authMiddleware, (req, res) => res.json(db.prepare('SELECT s.*, us.equipped FROM user_skins us JOIN skins s ON us.skin_id=s.id WHERE us.uid=?').all(req.uid)));
  app.post('/api/skins/buy', authMiddleware, (req, res) => {
    // 审计S3:事务包裹,避免并发双花钻石
    const { skin_id } = req.body || {};
    const s = db.prepare('SELECT * FROM skins WHERE id=?').get(skin_id);
    if (!s) return res.status(404).json({ error: 'not found' });
    try {
      db.transaction(() => {
        const user = db.prepare('SELECT diamonds FROM users WHERE uid=?').get(req.uid);
        if ((user.diamonds || 0) < s.price) throw new Error('insufficient');
        db.prepare('UPDATE users SET diamonds=diamonds-? WHERE uid=?').run(s.price, req.uid);
        db.prepare('INSERT OR IGNORE INTO user_skins (uid,skin_id) VALUES (?,?)').run(req.uid, skin_id);
      })();
      res.json({ ok: true });
    } catch(e) { res.json({ ok: false, msg: e.message === 'insufficient' ? 'insufficient diamonds' : 'failed' }); }
  });
  app.post('/api/skins/equip', authMiddleware, (req, res) => {
    const { skin_id } = req.body || {};
    // 审计S7:检查玩家是否实际拥有该皮肤
    if (skin_id) {
      const owned = db.prepare('SELECT * FROM user_skins WHERE uid=? AND skin_id=?').get(req.uid, skin_id);
      if (!owned) return res.status(403).json({ error: 'skin not owned' });
    }
    db.prepare('UPDATE user_skins SET equipped=0 WHERE uid=?').run(req.uid);
    if (skin_id) db.prepare('UPDATE user_skins SET equipped=1 WHERE uid=? AND skin_id=?').run(req.uid, skin_id);
    res.json({ ok: true });
  });

  /* ========== 活动 ========== */
  app.get('/api/events', (req, res) => res.json(db.prepare("SELECT * FROM events WHERE datetime(start) <= datetime('now') AND datetime(end) >= datetime('now')").all()));
  app.get('/api/events/my', authMiddleware, (req, res) => res.json(db.prepare('SELECT e.*, ue.score FROM events e JOIN user_events ue ON e.id=ue.event_id WHERE ue.uid=?').all(req.uid)));
  app.post('/api/events/score', authMiddleware, (req, res) => {
    const event_id = safeId((req.body || {}).event_id, 64);
    const score = clampInt((req.body || {}).score, 0, 100000, 0);
    const e = db.prepare("SELECT * FROM events WHERE id=? AND datetime(start) <= datetime('now') AND datetime(end) >= datetime('now')").get(event_id);
    if (!e) return res.json({ ok: false, msg: 'event not active' });
    db.prepare('INSERT INTO user_events (uid,event_id,score) VALUES (?,?,?) ON CONFLICT(uid,event_id) DO UPDATE SET score=MAX(score,?)').run(req.uid, event_id, score, score);
    res.json({ ok: true });
  });

  /* ========== 战斗回放 ========== */
  app.post('/api/replay/save', authMiddleware, (req, res) => {
    const uid2 = safeId((req.body || {}).uid2, 64);
    const actions_json = safeJsonText((req.body || {}).actions_json);
    const result = safeText((req.body || {}).result, 32);
    if (actions_json === null) return res.status(413).json({ error: 'replay too large or invalid' });
    const id = crypto.randomBytes(8).toString('hex');
    db.prepare('INSERT INTO replays (id,uid1,uid2,actions_json,result) VALUES (?,?,?,?,?)').run(id, req.uid, uid2 || '', actions_json || '[]', result || '');
    res.json({ id });
  });
  app.get('/api/replay/:id', authMiddleware, (req, res) => {
    // 审计S9:只允许参战双方查看回放(非围观)
    const r = db.prepare('SELECT * FROM replays WHERE id=? AND (uid1=? OR uid2=?)').get(req.params.id, req.uid, req.uid);
    if (!r) return res.status(404).json({ error: 'not found' });
    res.json(r);
  });
  app.get('/api/replays', authMiddleware, (req, res) => res.json(db.prepare('SELECT id,uid1,uid2,result,created_at FROM replays WHERE uid1=? OR uid2=? ORDER BY created_at DESC LIMIT 20').all(req.uid, req.uid)));
};

module.exports = { mountSocial };
