const express = require('express');
const http = require('http');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const { signToken, authMiddleware } = require('./auth');
const { handlePvpUpgrade } = require('./pvp-server');

const app = express();
const PUBLIC_ROOT = path.join(__dirname, '..');
const FRONTEND_STATIC = { dotfiles: 'deny', index: false, maxAge: '1h' };

// 排行榜战力反作弊:computePower 是 UNIT_POOL 平均(atk·养成星级乘子),
// 全员满养成(Lv20)满星(★7)的理论最大约 280。上限设 300(留极小余量),
// 客户端上报超过即铁定作弊,夹到 300。见 test/power-cap.js(会校验此值 ≥ 实时理论最大值)。
const POWER_MAX = 300;

app.use(express.json({ limit: '128kb' }));
app.use('/css', express.static(path.join(PUBLIC_ROOT, 'css'), FRONTEND_STATIC));
app.use('/js', express.static(path.join(PUBLIC_ROOT, 'js'), FRONTEND_STATIC));
app.use('/art', express.static(path.join(PUBLIC_ROOT, 'art'), FRONTEND_STATIC));
app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(PUBLIC_ROOT, 'index.html')));

function clampInt(value, min, max, fallback = min) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function safeText(value, max = 32) {
  const clean = String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return Array.from(clean).slice(0, max).join('');
}

// 校验存档 JSON:合法且未超限返回字符串,否则返回 null(由调用方拒绝——绝不静默抹成空存档)
function safeJsonText(value, maxBytes = 120000) {
  let text;
  if (typeof value === 'string') text = value;
  else {
    try { text = JSON.stringify(value == null ? {} : value); }
    catch (err) { return null; }
  }
  if (Buffer.byteLength(text, 'utf8') > maxBytes) return null;
  try { JSON.parse(text); return text; }
  catch (err) { return null; }
}

function publicUser(row = {}) {
  return {
    ...row,
    nickname: safeText(row.nickname || '', 24),
    avatar: safeText(row.avatar || '\uD83C\uDF49', 4),
  };
}

app.post('/api/auth/register', (req, res) => {
  const { email, password, nickname } = req.body || {};
  const emailText = safeText(email, 120).toLowerCase();
  const nicknameText = safeText(nickname, 24);
  if (!emailText || !password) return res.status(400).json({ error: 'email and password required' });
  if (db.prepare('SELECT uid FROM users WHERE email = ?').get(emailText)) return res.status(409).json({ error: 'email exists' });
  const uid = uuidv4().slice(0, 8);
  const hash = bcrypt.hashSync(String(password), 10);
  db.prepare('INSERT INTO users (uid, email, password_hash, nickname) VALUES (?,?,?,?)').run(uid, emailText, hash, nicknameText);
  db.prepare('INSERT INTO user_saves (uid) VALUES (?)').run(uid);
  db.prepare('INSERT INTO leaderboard (uid) VALUES (?)').run(uid);
  return res.json(publicUser({ uid, token: signToken(uid), nickname: nicknameText, avatar: '\uD83C\uDF49', level: 1, exp: 0, diamonds: 0, gold: 0 }));
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const emailText = safeText(email, 120).toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(emailText);
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) return res.status(401).json({ error: 'wrong credentials' });
  db.prepare("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE uid = ?").run(user.uid);
  const save = db.prepare('SELECT meta_json, shell_json FROM user_saves WHERE uid = ?').get(user.uid);
  res.json(publicUser({ uid: user.uid, token: signToken(user.uid), nickname: user.nickname, avatar: user.avatar, level: user.level, exp: user.exp, diamonds: user.diamonds, gold: user.gold, highest_stage: user.highest_stage, ladder_rank: user.ladder_rank, ladder_score: user.ladder_score, meta_json: save ? save.meta_json : '{}', shell_json: save ? save.shell_json : '{}' }));
});

app.get('/api/user/profile', authMiddleware, (req, res) => {
  const u = db.prepare('SELECT nickname, avatar, level, exp, power, diamonds, gold, highest_stage, ladder_rank, ladder_score FROM users WHERE uid = ?').get(req.uid) || {};
  res.json(publicUser(u));
});

app.post('/api/user/profile', authMiddleware, (req, res) => {
  const { nickname, avatar } = req.body || {};
  if (nickname != null) db.prepare('UPDATE users SET nickname = ? WHERE uid = ?').run(safeText(nickname, 24), req.uid);
  if (avatar != null) db.prepare('UPDATE users SET avatar = ? WHERE uid = ?').run(safeText(avatar, 4), req.uid);
  res.json({ ok: true });
});

app.post('/api/save', authMiddleware, (req, res) => {
  const b = req.body || {};
  const metaJson = safeJsonText(b.meta_json);
  const shellJson = safeJsonText(b.shell_json);
  if (metaJson === null || shellJson === null) {
    return res.status(413).json({ error: 'save payload invalid or too large' });
  }
  db.prepare('UPDATE user_saves SET meta_json=?, shell_json=?, updated_at=CURRENT_TIMESTAMP WHERE uid=?').run(metaJson, shellJson, req.uid);

  const current = db.prepare('SELECT power, highest_stage FROM users WHERE uid=?').get(req.uid) || {};
  const reportedPower = clampInt(b.power, 0, POWER_MAX, current.power || 0);
  const reportedStage = clampInt(b.highest_stage, 1, 999, current.highest_stage || 1);
  const power = Math.max(current.power || 0, reportedPower);
  const highestStage = Math.max(current.highest_stage || 1, reportedStage);
  db.prepare('UPDATE users SET power=?, highest_stage=? WHERE uid=?').run(power, highestStage, req.uid);
  db.prepare('INSERT INTO leaderboard (uid, power, highest_stage) VALUES (?,?,?) ON CONFLICT(uid) DO UPDATE SET power=excluded.power, highest_stage=excluded.highest_stage, updated_at=CURRENT_TIMESTAMP').run(req.uid, power, highestStage);
  return res.json({ ok: true, accepted: { power, highest_stage: highestStage } });
  // 同步 leaderboard 表(power/stage——ladder_score 由 /api/ladder/report 写)
});

app.get('/api/mail', authMiddleware, (req, res) => res.json(db.prepare('SELECT * FROM mail WHERE uid=? ORDER BY created_at DESC LIMIT 50').all(req.uid)));
app.post('/api/mail/read', authMiddleware, (req, res) => { const b = req.body || {}; if (!b.id) return res.status(400).json({ error: 'id required' }); db.prepare('UPDATE mail SET is_read=1 WHERE id=? AND uid=?').run(b.id, req.uid); res.json({ ok: true }); });

app.post('/api/checkin', authMiddleware, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const ex = db.prepare('SELECT * FROM checkins WHERE uid=? AND date=?').get(req.uid, today);
  if (ex) return res.json({ ok: true, streak: ex.streak, already: true });
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const prev = db.prepare('SELECT streak FROM checkins WHERE uid=? AND date=?').get(req.uid, yest);
  const streak = (prev ? prev.streak : 0) + 1;
  db.prepare('INSERT INTO checkins (uid,date,streak) VALUES (?,?,?)').run(req.uid, today, streak);
  const gr = 50 + streak * 10, dr = streak % 7 === 0 ? 10 : 3;
  db.prepare('UPDATE users SET gold=gold+?, diamonds=diamonds+? WHERE uid=?').run(gr, dr, req.uid);
  res.json({ ok: true, streak, goldReward: gr, gemReward: dr });
});

app.get('/api/announcements', (req, res) => res.json(db.prepare('SELECT * FROM announcements WHERE active=1 ORDER BY created_at DESC LIMIT 5').all()));

app.get('/api/leaderboard/:type', (req, res) => {
  const col = { power: 'power', stage: 'highest_stage', ladder: 'ladder_score' }[req.params.type] || 'power';
  res.json(db.prepare(`SELECT u.uid,u.nickname,u.avatar,u.level,l.${col} as score FROM leaderboard l JOIN users u ON u.uid=l.uid ORDER BY l.${col} DESC LIMIT 100`).all().map(publicUser));
});

const chatMessages = [];
app.get('/api/chat', (req, res) => res.json(chatMessages.slice(-50)));

// Admin
const { mountAdmin } = require('./admin');
const { mountActivity } = require('./activity');
const { mountSocial } = require('./social');
mountAdmin(app);
mountActivity(app);
mountSocial(app);

// Ladder promotion logic
app.post('/api/ladder/report', authMiddleware, (req, res) => {
  const { score } = req.body || {};
  const user = db.prepare('SELECT ladder_rank, ladder_score FROM users WHERE uid = ?').get(req.uid);
  if (!user) return res.status(404).json({ error: 'not found' });
  const reportedScore = clampInt(score, 0, 100000, 0);
  const newScore = Math.max(user.ladder_score || 0, reportedScore);
  let rank = user.ladder_rank || '新手';
  if (newScore >= 5000) rank = '王者';
  else if (newScore >= 3000) rank = '钻石';
  else if (newScore >= 1500) rank = '黄金';
  else if (newScore >= 500) rank = '白银';
  else if (newScore >= 100) rank = '青铜';
  else rank = '新手';
  db.prepare('UPDATE users SET ladder_rank = ?, ladder_score = ? WHERE uid = ?').run(rank, newScore, req.uid);
  db.prepare('INSERT INTO leaderboard (uid, ladder_score) VALUES (?,?) ON CONFLICT(uid) DO UPDATE SET ladder_score=excluded.ladder_score, updated_at=CURRENT_TIMESTAMP').run(req.uid, newScore);
  res.json({ rank, score: newScore });
});

// Account level + exp (call on stage clear / PvP win)
app.post('/api/user/exp', authMiddleware, (req, res) => {
  const { exp } = req.body || {};
  const grantedExp = clampInt(exp, 1, 500, 0);
  if (!grantedExp) return res.json({ ok: false });
  let user = db.prepare('SELECT level, exp FROM users WHERE uid = ?').get(req.uid);
  if (!user) return res.status(404).json({ error: 'not found' });
  let lv = user.level || 1, xp = (user.exp || 0) + grantedExp;
  const need = (lv) => 100 + lv * 50; // 升级经验曲线
  while (xp >= need(lv)) { xp -= need(lv); lv++; }
  db.prepare('UPDATE users SET level = ?, exp = ? WHERE uid = ?').run(lv, xp, req.uid);
  res.json({ level: lv, exp: xp, need: need(lv) });
});

const server = http.createServer(app);
server.on('upgrade', (req, socket, head) => { handlePvpUpgrade(req, socket, head); });

// 聊天也通过 WS 广播(复用现有的 pvp-server 的 broadcast 逻辑) => chat 消息走 REST polling 即可
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  server.listen(PORT, () => console.log(`Server :${PORT}`));
}

module.exports = { app, server, chatMessages, clampInt, safeText, safeJsonText, POWER_MAX };
