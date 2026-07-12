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

function adminMiddleware(req, res, next) {
  if (!isAdmin(req.uid)) return res.status(403).json({ error: 'Admin only' });
  next();
}

function mountAdmin(app) {
  // 数据概览统计
  app.get('/api/admin/stats', authMiddleware, adminMiddleware, (req, res) => {
    const total = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
    const today = new Date().toISOString().slice(0,10);
    const todayNew = db.prepare("SELECT COUNT(*) as n FROM users WHERE created_at LIKE ?").get(today+'%').n;
    res.json({ total, todayNew });
  });

  app.get('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
    res.json(db.prepare('SELECT uid, email, nickname, level, exp, power, diamonds, gold, highest_stage, ladder_rank, ladder_score, created_at, last_login FROM users ORDER BY created_at DESC LIMIT 500').all());
  });

  app.post('/api/admin/mail', authMiddleware, adminMiddleware, (req, res) => {
    const { uid, title, body, rewards_json } = req.body || {};
    const safeTitle = safeText(title, 60);
    if (!uid || !safeTitle) return res.status(400).json({ error: 'uid and title required' });
    db.prepare('INSERT INTO mail (uid, title, body, rewards_json) VALUES (?,?,?,?)').run(uid, safeTitle, safeText(body, 500), rewards_json || '{}');
    res.json({ ok: true });
  });

  app.post('/api/admin/mail-all', authMiddleware, adminMiddleware, (req, res) => {
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

  app.post('/api/admin/resource', authMiddleware, adminMiddleware, (req, res) => {
    const { uid, gold, diamonds } = req.body || {};
    if (!uid) return res.status(400).json({ error: 'uid required' });
    db.prepare('UPDATE users SET gold = gold + ?, diamonds = diamonds + ? WHERE uid = ?').run(gold || 0, diamonds || 0, uid);
    res.json({ ok: true });
  });

  app.get('/api/admin/chat', authMiddleware, adminMiddleware, (req, res) => {
    const { chatMessages } = require('./index');
    res.json(chatMessages || []);
  });

  app.delete('/api/admin/chat', authMiddleware, adminMiddleware, (req, res) => {
    const { chatMessages } = require('./index');
    chatMessages.length = 0;
    res.json({ ok: true });
  });

  // 公告管理:创建
  app.post('/api/admin/announcement', authMiddleware, adminMiddleware, (req, res) => {
    const { title, body, active } = req.body || {};
    const safeTitle = safeText(title, 120);
    if (!safeTitle) return res.status(400).json({ error: 'title required' });
    const id = require('crypto').randomBytes(6).toString('hex');
    db.prepare('INSERT INTO announcements (id,title,body,active) VALUES (?,?,?,?)').run(id, safeTitle, safeText(body, 500), (active === false ? 0 : 1));
    res.json({ ok: true, id });
  });

  // 公告管理:下架(软删除)
  app.delete('/api/admin/announcement/:id', authMiddleware, adminMiddleware, (req, res) => {
    const id = safeText(req.params.id, 64);
    if (!id) return res.status(400).json({ error: 'id required' });
    db.prepare('UPDATE announcements SET active=0 WHERE id=?').run(id);
    res.json({ ok: true });
  });
}

module.exports = { mountAdmin, isAdmin };
