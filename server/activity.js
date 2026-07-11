/* Activity center + new player guide metadata */
const db = require('./db');
const { authMiddleware } = require('./auth');

function mountActivity(app) {
  const ACTIVITIES = [
    { id: 'endless', title: '无尽挑战', desc: '无限波次,冲击最高纪录', active: true, type: 'permanent' },
    { id: 'daily_boss', title: '每日 Boss', desc: '每天一次,击败 Boss 赢大奖', active: false, type: 'daily' },
  ];

  app.get('/api/activities', authMiddleware, (req, res) => res.json(ACTIVITIES.filter(a => a.active)));

  // 新手引导状态(done flags)
  app.get('/api/guide', authMiddleware, (req, res) => {
    const row = db.prepare("SELECT meta_json FROM user_saves WHERE uid = ?").get(req.uid);
    let guide = {};
    try { guide = JSON.parse(row ? row.meta_json : '{}').guide || {}; } catch (e) {}
    res.json(guide);
  });

  app.post('/api/guide', authMiddleware, (req, res) => {
    const { step } = req.body || {};
    const row = db.prepare("SELECT meta_json FROM user_saves WHERE uid = ?").get(req.uid);
    let meta = {};
    try { meta = JSON.parse(row ? row.meta_json : '{}'); } catch (e) {}
    meta.guide = meta.guide || {};
    meta.guide[step] = true;
    db.prepare("UPDATE user_saves SET meta_json = ? WHERE uid = ?").run(JSON.stringify(meta), req.uid);
    res.json({ ok: true });
  });
}

module.exports = { mountActivity };
