/* ============================================================
   水果突击 · Admin Routes (Phase G)
   用户管理 / 发邮件 / 发资源 / 公告管理 / 聊天管理
   ============================================================ */
const db = require('./db');
const { authMiddleware } = require('./auth');
const { clampInt, safeText } = require('./util');

function isAdmin(uid) {
  const ADMIN_UIDS = (process.env.ADMIN_UIDS || '').split(',').filter(Boolean);
  return ADMIN_UIDS.includes(uid);
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
  // 管理员登录:独立账号密码+爆破限速(审计S10:5次/15min)
  const loginAttempts = new Map();
  app.post('/api/admin/login', (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || '';
    const now = Date.now();
    const attempts = (loginAttempts.get(ip) || []).filter(t => now - t < 900000); // 15min窗口
    if (attempts.length >= 5) return res.status(429).json({ error: '尝试过多,请15分钟后再试' });
    attempts.push(now); loginAttempts.set(ip, attempts);
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
    let onlineCount = 0; try { const { onlineUsers } = require('./pvp-server'); onlineCount = onlineUsers ? onlineUsers.size : 0; } catch(e) {}
    res.json({ total, todayNew, onlineCount });
  });

  app.get('/api/admin/users', authMiddleware, adminAuth, (req, res) => {
    // 审计S1:移除email字段(防止泄露所有玩家邮箱PII)
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const q = (req.query.q || '').trim();
    const base = 'SELECT uid, nickname, level, exp, power, diamonds, gold, highest_stage, ladder_rank, ladder_score, created_at, last_login FROM users';
    let users, total;
    if (q) {
      users = db.prepare(`${base} WHERE uid LIKE ? OR nickname LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(`%${q}%`, `%${q}%`, limit, offset);
      total = db.prepare('SELECT COUNT(*) as n FROM users WHERE uid LIKE ? OR nickname LIKE ?').get(`%${q}%`, `%${q}%`).n;
    } else {
      users = db.prepare(`${base} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(limit, offset);
      total = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
    }
    const { onlineUsers } = require('./pvp-server');
    const rows = users.map(u => ({ ...u, is_online: onlineUsers ? onlineUsers.has(u.uid) : false }));
    res.json({ rows, total, page, limit });
  });

  app.post('/api/admin/mail', authMiddleware, adminAuth, (req, res) => {
    const { uid, title, body, rewards_json } = req.body || {};
    const safeTitle = safeText(title, 60);
    if (!uid || !safeTitle) return res.status(400).json({ error: 'uid and title required' });
    const rewards = typeof rewards_json === 'object' ? JSON.stringify(rewards_json) : (String(rewards_json || '{}')); // 审计S12:校验JSON合法性
    try { JSON.parse(rewards); } catch(e) { return res.status(400).json({ error: 'invalid rewards_json' }); }
    db.prepare('INSERT INTO mail (uid, title, body, rewards_json) VALUES (?,?,?,?)').run(uid, safeTitle, safeText(body, 500), rewards);
    try { const { broadcastAll } = require('./pvp-server'); broadcastAll(null, { type: 'new_mail', uid }); } catch(e) {}
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
    try { const { broadcastAll } = require('./pvp-server'); broadcastAll(null, { type: 'new_mail', all: true }); } catch(e) {}
    res.json({ ok: true, count: uids.length });
  });

  app.post('/api/admin/resource', authMiddleware, adminAuth, (req, res) => {
    const { uid, gold, diamonds } = req.body || {};
    if (!uid) return res.status(400).json({ error: 'uid required' });
    const g = clampInt(gold, 0, 1000000, 0);   // 审计S2:clampInt替代||0,防负数扣资源
    const d = clampInt(diamonds, 0, 100000, 0);
    if (g === 0 && d === 0) return res.status(400).json({ error: 'amount required' });
    const result = db.prepare('UPDATE users SET gold = gold + ?, diamonds = diamonds + ? WHERE uid = ?').run(g, d, uid);
    if (result.changes === 0) return res.status(404).json({ error: 'user not found' }); // 审计C6:UID不存在提示
    // 审计日志
    try { db.prepare('INSERT INTO admin_logs (admin_uid, action, target_uid, detail) VALUES (?,?,?,?)').run(req.uid || 'admin', 'resource', uid, `gold:${g} diamonds:${d}`); } catch(e) {}
    try { const { broadcastAll } = require('./pvp-server'); broadcastAll(null, { type: 'resource_grant', uid, gold: g, diamonds: d }); } catch(e) {}
    res.json({ ok: true });
  });

  // 全服资源发放(审计H1)
  app.post('/api/admin/resource-all', authMiddleware, adminAuth, (req, res) => {
    const { gold, diamonds } = req.body || {};
    const g = clampInt(gold, 0, 1000000, 0);
    const d = clampInt(diamonds, 0, 100000, 0);
    if (g === 0 && d === 0) return res.status(400).json({ error: 'amount required' });
    const uids = db.prepare('SELECT uid FROM users').all();
    if (!uids.length) return res.status(404).json({ error: 'no users' });
    db.prepare('UPDATE users SET gold = gold + ?, diamonds = diamonds + ?').run(g, d); // 全服批量更新
    try { db.prepare('INSERT INTO admin_logs (admin_uid, action, detail) VALUES (?,?,?)').run(req.uid || 'admin', 'resource_all', `gold:${g} diamonds:${d} to ${uids.length} users`); } catch(e) {}
    try { const { broadcastAll } = require('./pvp-server'); broadcastAll(null, { type: 'resource_grant', all: true, gold: g, diamonds: d }); } catch(e) {}
    res.json({ ok: true, count: uids.length });
  });

  // 审计日志查看(审计P2-14):查询admin_logs表
  app.get('/api/admin/logs', authMiddleware, adminAuth, (req, res) => {
    const rows = db.prepare('SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT 200').all();
    res.json({ rows, total: rows.length });
  });

  // 已发送邮件记录(审计H8)
  app.get('/api/admin/mail-log', authMiddleware, adminAuth, (req, res) => {
    const rows = db.prepare("SELECT title, body, rewards_json, created_at, COUNT(*) as total, SUM(is_read) as read_count FROM mail GROUP BY title, strftime('%Y-%m-%d %H:%M', created_at) ORDER BY created_at DESC LIMIT 50").all();
    res.json({ rows, total: rows.length });
  });

  app.get('/api/admin/chat', authMiddleware, adminAuth, (req, res) => {
    // 审计P0-4:查chat_logs表,非内存(重启后内存空但DB有数据→后台看到空白)
    const msgs = db.prepare('SELECT uid, nickname, text, source, created_at FROM chat_logs ORDER BY created_at DESC LIMIT 200').all();
    res.json(msgs.reverse()); // 时间升序,和内存版接口一致
  });

  app.delete('/api/admin/chat', authMiddleware, adminAuth, (req, res) => {
    const { chatMessages } = require('./index');
    chatMessages.length = 0;
    res.json({ ok: true });
  });

  // 公告管理:创建(审计P0-3:加start_time/end_time)
  app.post('/api/admin/announcement', authMiddleware, adminAuth, (req, res) => {
    const { title, body, active, start_time, end_time } = req.body || {};
    const safeTitle = safeText(title, 120);
    if (!safeTitle) return res.status(400).json({ error: 'title required' });
    const id = require('crypto').randomBytes(6).toString('hex');
    db.prepare('INSERT INTO announcements (id,title,body,active,start_time,end_time) VALUES (?,?,?,?,?,?)').run(id, safeTitle, safeText(body, 500), (active === false ? 0 : 1), safeText(start_time, 40) || '', safeText(end_time, 40) || '');
    try { const { broadcastAll } = require('./pvp-server'); broadcastAll(null, { type: 'new_announcement', id }); } catch(e) {}
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
