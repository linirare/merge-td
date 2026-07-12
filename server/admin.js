/* ============================================================
   水果突击 · Admin Routes (Phase G)
   用户管理 / 发邮件 / 发资源 / 公告管理 / 聊天管理
   ============================================================ */
const db = require('./db');
const { authMiddleware } = require('./auth');
const { safeText } = require('./util');

function isAdmin(uid) {
  const ADMIN_UIDS = (process.env.ADMIN_UIDS || '').split(',').filter(Boolean);
  return ADMIN_UIDS.includes(uid);
}

function adminAuth(req, res, next) {
  if (!isAdmin(req.uid)) return res.status(403).json({ error: 'Admin only' });
  next();
}

// 管理员 session token(独立于游戏 token;payload 带 admin:true)
function signAdminToken() {
  const jwt = require('jsonwebtoken');
  return jwt.sign({ admin: true }, process.env.JWT_SECRET || 'admin-secret-fallback', { expiresIn: '8h' });
}
function verifyAdminToken(token) {
  try {
    const jwt = require('jsonwebtoken');
    const d = jwt.verify(String(token), process.env.JWT_SECRET || 'admin-secret-fallback');
    return !!(d && d.admin);
  } catch (e) { return false; }
}
// 管理后台鉴权:接受管理员 session token(优先)或游戏 token(uid 在 ADMIN_UIDS 中)
function adminAuth(req, res, next) {
  const auth = (req.headers.authorization || '').replace('Bearer ', '');
  if (auth && verifyAdminToken(auth)) return next();
  // fallback:游戏 token(兼容旧方式)
  if (auth) {
    try {
      const { verifyToken } = require('./auth');
      const d = verifyToken(auth);
      if (d && d.uid && isAdmin(d.uid)) return next();
    } catch (e) {}
  }
  return res.status(403).json({ error: 'Admin only' });
}

function mountAdmin(app) {
  // 管理员登录:独立账号密码,不依赖游戏账号
  app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body || {};
    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPass = process.env.ADMIN_PASS || '';
    if (!adminPass) return res.status(500).json({ error: 'ADMIN_PASS 环境变量未配置' });
    if (String(username) === adminUser && String(password) === adminPass) {
      const token = signAdminToken();
      return res.json({ ok: true, token });
    }
    return res.status(401).json({ error: '用户名或密码错误' });
  });

  // 数据概览统计
  app.get('/api/admin/stats', authMiddleware, adminAuth, (req, res) => {
    const total = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
    const today = new Date().toISOString().slice(0,10);
    const todayNew = db.prepare("SELECT COUNT(*) as n FROM users WHERE created_at LIKE ?").get(today+'%').n;
    res.json({ total, todayNew });
  });

  app.get('/api/admin/users', authMiddleware, adminAuth, (req, res) => {
    res.json(db.prepare('SELECT uid, email, nickname, level, exp, power, diamonds, gold, highest_stage, ladder_rank, ladder_score, created_at, last_login FROM users ORDER BY created_at DESC LIMIT 500').all());
  });

  app.post('/api/admin/mail', authMiddleware, adminAuth, (req, res) => {
    const { uid, title, body, rewards_json } = req.body || {};
    const safeTitle = safeText(title, 60);
    if (!uid || !safeTitle) return res.status(400).json({ error: 'uid and title required' });
    db.prepare('INSERT INTO mail (uid, title, body, rewards_json) VALUES (?,?,?,?)').run(uid, safeTitle, safeText(body, 500), rewards_json || '{}');
    res.json({ ok: true });
  });

  app.post('/api/admin/mail-all', authMiddleware, adminAuth, (req, res) => {
    const { title, body, rewards_json } = req.body || {};
    const safeTitle = safeText(title, 60);
    if (!safeTitle) return res.status(400).json({ error: 'title required' });
    const safeBody = safeText(body, 500);
    const uids = db.prepare('SELECT uid FROM users').all();
    const stmt = db.prepare('INSERT INTO mail (uid, title, body, rewards_json) VALUES (?,?,?,?)');
    const tx = db.transaction(() => { for (const u of uids) stmt.run(u.uid, safeTitle, safeBody, rewards_json || '{}'); });
    tx();
    res.json({ ok: true, count: uids.length });
  });

  app.post('/api/admin/resource', authMiddleware, adminAuth, (req, res) => {
    const { uid, gold, diamonds } = req.body || {};
    if (!uid) return res.status(400).json({ error: 'uid required' });
    db.prepare('UPDATE users SET gold = gold + ?, diamonds = diamonds + ? WHERE uid = ?').run(gold || 0, diamonds || 0, uid);
    res.json({ ok: true });
  });

  app.get('/api/admin/chat', authMiddleware, adminAuth, (req, res) => {
    const { chatMessages } = require('./index');
    res.json(chatMessages || []);
  });

  app.delete('/api/admin/chat', authMiddleware, adminAuth, (req, res) => {
    const { chatMessages } = require('./index');
    chatMessages.length = 0;
    res.json({ ok: true });
  });

  // 公告管理:创建
  app.post('/api/admin/announcement', authMiddleware, adminAuth, (req, res) => {
    const { title, body, active } = req.body || {};
    const safeTitle = safeText(title, 120);
    if (!safeTitle) return res.status(400).json({ error: 'title required' });
    const id = require('crypto').randomBytes(6).toString('hex');
    db.prepare('INSERT INTO announcements (id,title,body,active) VALUES (?,?,?,?)').run(id, safeTitle, safeText(body, 500), (active === false ? 0 : 1));
    res.json({ ok: true, id });
  });

  // 公告管理:下架(软删除)
  app.delete('/api/admin/announcement/:id', authMiddleware, adminAuth, (req, res) => {
    const id = safeText(req.params.id, 64);
    if (!id) return res.status(400).json({ error: 'id required' });
    db.prepare('UPDATE announcements SET active=0 WHERE id=?').run(id);
    res.json({ ok: true });
  });
}

module.exports = { mountAdmin, isAdmin };
