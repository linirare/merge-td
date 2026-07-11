/* ============================================================
   水果突击 · Admin Routes (Phase G)
   用户管理 / 发邮件 / 发资源 / 公告管理 / 聊天管理
   ============================================================ */
const db = require('./db');
const { authMiddleware } = require('./auth');

function isAdmin(uid) {
  const ADMIN_UIDS = (process.env.ADMIN_UIDS || '').split(',').filter(Boolean);
  return ADMIN_UIDS.includes(uid);
}

function adminMiddleware(req, res, next) {
  if (!isAdmin(req.uid)) return res.status(403).json({ error: 'Admin only' });
  next();
}

function mountAdmin(app) {
  app.get('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
    res.json(db.prepare('SELECT uid, email, nickname, level, exp, power, diamonds, gold, highest_stage, ladder_rank, ladder_score, created_at, last_login FROM users ORDER BY created_at DESC LIMIT 500').all());
  });

  app.post('/api/admin/mail', authMiddleware, adminMiddleware, (req, res) => {
    const { uid, title, body, rewards_json } = req.body || {};
    if (!uid || !title) return res.status(400).json({ error: 'uid and title required' });
    db.prepare('INSERT INTO mail (uid, title, body, rewards_json) VALUES (?,?,?,?)').run(uid, title, body || '', rewards_json || '{}');
    res.json({ ok: true });
  });

  app.post('/api/admin/mail-all', authMiddleware, adminMiddleware, (req, res) => {
    const { title, body, rewards_json } = req.body || {};
    if (!title) return res.status(400).json({ error: 'title required' });
    const uids = db.prepare('SELECT uid FROM users').all();
    const stmt = db.prepare('INSERT INTO mail (uid, title, body, rewards_json) VALUES (?,?,?,?)');
    const tx = db.transaction(() => { for (const u of uids) stmt.run(u.uid, title, body || '', rewards_json || '{}'); });
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
}

module.exports = { mountAdmin, isAdmin };
