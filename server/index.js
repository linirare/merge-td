require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const db = require('./db');
const { signToken, authMiddleware } = require('./auth');
const { clampInt, safeText, safeJsonText } = require('./util');
const { handlePvpUpgrade } = require('./pvp-server');

const app = express();
app.set('trust proxy', 1); // Railway 反代需要,否则 express-rate-limit 报错
const PUBLIC_ROOT = path.join(__dirname, '..');
// 开发期前端资源禁缓存:每次都按 etag 重校验,改了 JS 刷新即生效
// (原来 maxAge:'1h' 会让浏览器缓存旧 JS 1 小时,改动刷新不生效——坑过整轮联调)
const FRONTEND_STATIC = { dotfiles: 'deny', index: false, etag: true, maxAge: 0, setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate') };

// 排行榜战力反作弊:computePower 是 UNIT_POOL 求和(全员碎片满约1201)。
// 上限设宽松值,未来加再多英雄也不会撞。纯防 999999 瞎填。
const POWER_MAX = 99999;

app.use(express.json({ limit: '128kb' }));
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, crossOriginResourcePolicy: false }));
// 审计:分拆 rate limiter,登录注册与游戏 API 隔离
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'rate_limit' } });
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, message: { error: 'rate_limit' } });
app.use('/api/auth/', authLimiter);
app.use('/api/', apiLimiter);
app.use('/css', express.static(path.join(PUBLIC_ROOT, 'css'), FRONTEND_STATIC));
app.use('/js', express.static(path.join(PUBLIC_ROOT, 'js'), FRONTEND_STATIC));
app.use('/art', express.static(path.join(PUBLIC_ROOT, 'art'), FRONTEND_STATIC));
app.use('/fonts', express.static(path.join(PUBLIC_ROOT, 'fonts'), { dotfiles: 'deny', index: false, maxAge: '7d' }));
app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(PUBLIC_ROOT, 'index.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(PUBLIC_ROOT, 'admin.html')));

function publicUser(row = {}) {
  return {
    ...row,
    nickname: safeText(row.nickname || '', 24),
    avatar: safeText(row.avatar || '🍉', 4),
  };
}

app.post('/api/auth/register', (req, res) => {
  const { email, password, nickname } = req.body || {};
  const emailText = safeText(email, 120).toLowerCase();
  const nicknameText = safeText(nickname, 24);
  if (!emailText || !password) return res.status(400).json({ error: 'email and password required' });
  if (db.prepare('SELECT uid FROM users WHERE email = ?').get(emailText)) return res.status(409).json({ error: 'email exists' });
  const uid = uuidv4().replace(/-/g, '').slice(0, 12); // 12 hex(48bit)熵,降低碰撞;uid 无长度假设,新旧长度共存无碍
  const hash = bcrypt.hashSync(String(password), 10);
  db.prepare('INSERT INTO users (uid, email, password_hash, nickname) VALUES (?,?,?,?)').run(uid, emailText, hash, nicknameText);
  db.prepare('INSERT INTO user_saves (uid) VALUES (?)').run(uid);
  db.prepare('INSERT INTO leaderboard (uid) VALUES (?)').run(uid);
  // 新手注册欢迎邮件
  db.prepare('INSERT INTO mail (uid, title, body, rewards_json) VALUES (?,?,?,?)').run(uid, '🎉 欢迎加入水果突击！', '这是您的注册大礼包，包含50000金币和50000钻石！点击领取后刷新页面即可到账。', JSON.stringify({ gold: 50000, diamonds: 50000 }));
  return res.json(publicUser({ uid, token: signToken(uid), nickname: nicknameText, avatar: '🍉', level: 1, exp: 0, diamonds: 0, gold: 0 }));
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
  const u = db.prepare('SELECT uid, nickname, avatar, level, exp, power, diamonds, gold, highest_stage, ladder_rank, ladder_score FROM users WHERE uid = ?').get(req.uid) || {};
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
// 邮件读取+附件奖励发放(审计C3:原来只标已读不发放rewards_json中的金币/钻石)
app.post('/api/mail/read', authMiddleware, (req, res) => {
  const b = req.body || {};
  if (!b.id) return res.status(400).json({ error: 'id required' });
  // 原子领奖:只有第一条成功把 is_read=0→1 的请求才能发奖励,避免并发双领
  const r = db.prepare('UPDATE mail SET is_read=1 WHERE id=? AND uid=? AND is_read=0').run(b.id, req.uid);
  if (r.changes === 0) return res.json({ ok: true, granted: null }); // 已领过,幂等返回
  const mail = db.prepare('SELECT * FROM mail WHERE id=? AND uid=?').get(b.id, req.uid);
  if (!mail) return res.status(404).json({ error: 'mail not found' });
  let granted = null;
  if (mail.rewards_json && mail.rewards_json !== '{}') {
    try {
      const rewards = JSON.parse(mail.rewards_json);
      const g = clampInt(rewards.gold || 0, 0, 50000, 0);     // 运营邮件上限(审计C10)
      const d = clampInt(rewards.diamonds || 0, 0, 100000, 0);
      const f = clampInt(rewards.fragments || 0, 0, 5000, 0);
      if (g || d) { db.prepare('UPDATE users SET gold=gold+?, diamonds=diamonds+? WHERE uid=?').run(g, d, req.uid); granted = { gold: g, diamonds: d }; }
      if (f) {
        const save = db.prepare('SELECT shell_json FROM user_saves WHERE uid=?').get(req.uid);
        if (save && save.shell_json) {
          try { const s = JSON.parse(save.shell_json); if (!s.fragments || typeof s.fragments !== 'object') s.fragments = {}; const ids = Object.keys(s.fragments); if (ids.length) { const per = Math.floor(f / ids.length); const rem = f - per * ids.length; ids.forEach((id, i) => { s.fragments[id] = (s.fragments[id] || 0) + per + (i < rem ? 1 : 0); }); db.prepare("UPDATE user_saves SET shell_json=?, updated_at=CURRENT_TIMESTAMP WHERE uid=?").run(JSON.stringify(s), req.uid); if (!granted) granted = {}; granted.fragments = f; } } catch(e) {}
        }
      }
    } catch(e) {}
  }
  res.json({ ok: true, granted, server_gold: (db.prepare('SELECT gold FROM users WHERE uid=?').get(req.uid) || {}).gold, server_diamonds: (db.prepare('SELECT diamonds FROM users WHERE uid=?').get(req.uid) || {}).diamonds });
});

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

app.get('/api/announcements', (req, res) => {
  const now = new Date().toISOString();
  res.json(db.prepare(`SELECT * FROM announcements WHERE active=1 AND (start_time='' OR start_time<=?) AND (end_time='' OR end_time>=?) ORDER BY created_at DESC LIMIT 5`).all(now, now));
});

app.get('/api/leaderboard/:type', (req, res) => {
  const col = { power: 'power', stage: 'highest_stage', ladder: 'ladder_score' }[req.params.type] || 'power';
  res.json(db.prepare(`SELECT u.uid,u.nickname,u.avatar,u.level,l.${col} as score FROM leaderboard l JOIN users u ON u.uid=l.uid ORDER BY l.${col} DESC LIMIT 100`).all().map(publicUser));
});

const chatMessages = [];
try {
  const recent = db.prepare('SELECT uid, nickname, text, created_at FROM chat_logs ORDER BY created_at DESC LIMIT 200').all();
  for (const row of recent.reverse()) {
    chatMessages.push({ uid: row.uid, nickname: row.nickname, text: row.text, ts: new Date(row.created_at + 'Z').getTime() });
  }
} catch(e) { console.warn('chat log restore failed', e); }
app.get('/api/chat', (req, res) => res.json(chatMessages.slice(-50)));
// 世界聊天发送:登录态,昵称一律取服务端 DB 真昵称(杜绝冒充),消息净化+限长,数组封顶
app.post('/api/chat', authMiddleware, (req, res) => {
  const text = safeText((req.body || {}).text, 120);
  if (!text) return res.status(400).json({ error: 'empty message' });
  const u = db.prepare('SELECT nickname FROM users WHERE uid = ?').get(req.uid) || {};
  const nickname = safeText(u.nickname || '玩家', 24);
  const msg = { uid: req.uid, nickname, text, ts: Date.now() };
  chatMessages.push(msg);
  if (chatMessages.length > 200) chatMessages.splice(0, chatMessages.length - 200);
  // DB持久化(审计C1):聊天落库,服务重启不丢
  try { db.prepare('INSERT INTO chat_logs (uid, nickname, text, source) VALUES (?,?,?,?)').run(req.uid, nickname, text, 'rest'); } catch(e) {}
  return res.json({ ok: true, message: msg });
});

// 登录态恢复存档(刷新/换设备后 restoreSession 用)
app.get('/api/save', authMiddleware, (req, res) => {
  const save = db.prepare('SELECT meta_json, shell_json FROM user_saves WHERE uid = ?').get(req.uid) || {};
  res.json({ meta_json: save.meta_json || '{}', shell_json: save.shell_json || '{}' });
});

// Admin
const { mountAdmin, isAdmin } = require('./admin');
const { mountActivity } = require('./activity');
const { mountSocial } = require('./social');
mountAdmin(app);
mountActivity(app);
mountSocial(app);

// 管理后台页面:仅管理员可打开(URL?token=JWT,浏览器无法带 Authorization 头加载页面)
// 管理后台页面(HTML 静态直出,登录由页面内 JS 调 /api/admin/login 完成)
app.get('/admin', (req, res) => res.sendFile(path.join(PUBLIC_ROOT, 'admin.html')));

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

// 全局错误 handler (防未捕获异常泄露堆栈)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 优雅关闭(审计P2-15):SIGTERM/SIGINT时关闭HTTP/WS,清理pending连接
function gracefulShutdown(signal) { console.log(`${signal} — shutting down`); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 5000); }
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT')); // 审计:Windows Ctrl+C 走 SIGINT
// 未捕获异步异常不崩进程(审计P2-16)
process.on('unhandledRejection', (reason) => console.error('unhandledRejection:', reason));

module.exports = { app, server, chatMessages, clampInt, safeText, safeJsonText, POWER_MAX };
