/* ============================================================
   水果突击 · SQLite Database Layer (Phase A)
   ============================================================ */
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '..', 'data', 'fruits.db');
const fs = require('fs');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');       // 防并发写入时 database is locked
db.pragma('synchronous = NORMAL');      // WAL 模式下安全且快 ~2x
db.pragma('journal_size_limit = 67108864'); // 防 WAL 文件无限膨胀

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    uid TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nickname TEXT DEFAULT '',
    avatar TEXT DEFAULT '🍉',
    level INTEGER DEFAULT 1,
    exp INTEGER DEFAULT 0,
    power INTEGER DEFAULT 0,
    diamonds INTEGER DEFAULT 0,
    gold INTEGER DEFAULT 0,
    highest_stage INTEGER DEFAULT 1,
    ladder_rank TEXT DEFAULT '新手',
    ladder_score INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    last_login TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_saves (
    uid TEXT PRIMARY KEY REFERENCES users(uid),
    meta_json TEXT DEFAULT '{}',
    shell_json TEXT DEFAULT '{}',
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS mail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL REFERENCES users(uid),
    title TEXT NOT NULL,
    body TEXT DEFAULT '',
    rewards_json TEXT DEFAULT '{}',
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT DEFAULT '',
    active INTEGER DEFAULT 1,
    start_time TEXT DEFAULT '',
    end_time TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS checkins (
    uid TEXT NOT NULL REFERENCES users(uid),
    date TEXT NOT NULL,
    streak INTEGER DEFAULT 1,
    PRIMARY KEY (uid, date)
  );

  CREATE TABLE IF NOT EXISTS leaderboard (
    uid TEXT PRIMARY KEY REFERENCES users(uid),
    power INTEGER DEFAULT 0,
    highest_stage INTEGER DEFAULT 1,
    ladder_score INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS friends (
    uid1 TEXT NOT NULL, uid2 TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    since TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (uid1, uid2)
  );

  CREATE TABLE IF NOT EXISTS guilds (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    leader_uid TEXT NOT NULL REFERENCES users(uid),
    level INTEGER DEFAULT 1,
    invite_code TEXT UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS guild_members (
    uid TEXT NOT NULL, guild_id TEXT NOT NULL REFERENCES guilds(id),
    role TEXT DEFAULT 'member',
    joined_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (uid, guild_id)
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY, category TEXT, title TEXT, desc TEXT, target INTEGER, reward_json TEXT DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS user_tasks (
    uid TEXT NOT NULL, task_id TEXT NOT NULL, progress INTEGER DEFAULT 0, completed INTEGER DEFAULT 0,
    PRIMARY KEY (uid, task_id),
    FOREIGN KEY (task_id) REFERENCES tasks(id)
  );

  CREATE TABLE IF NOT EXISTS achievements (
    id TEXT PRIMARY KEY, title TEXT, desc TEXT, reward_json TEXT DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS user_achievements (
    uid TEXT NOT NULL, achv_id TEXT NOT NULL, unlocked_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (uid, achv_id)
  );

  CREATE TABLE IF NOT EXISTS battle_pass (
    uid TEXT PRIMARY KEY REFERENCES users(uid),
    season TEXT DEFAULT 'S1', tier INTEGER DEFAULT 0, premium INTEGER DEFAULT 0, exp INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS skins (
    id TEXT PRIMARY KEY, name TEXT, price INTEGER DEFAULT 0, type TEXT DEFAULT 'fruit'
  );

  CREATE TABLE IF NOT EXISTS user_skins (
    uid TEXT NOT NULL, skin_id TEXT NOT NULL, equipped INTEGER DEFAULT 0,
    PRIMARY KEY (uid, skin_id)
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY, title TEXT, desc TEXT, start TEXT, end TEXT, reward_json TEXT DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS user_events (
    uid TEXT NOT NULL, event_id TEXT NOT NULL, score INTEGER DEFAULT 0,
    PRIMARY KEY (uid, event_id)
  );

  CREATE TABLE IF NOT EXISTS replays (
    id TEXT PRIMARY KEY, uid1 TEXT, uid2 TEXT, actions_json TEXT DEFAULT '[]', result TEXT, created_at TEXT DEFAULT (datetime('now'))
  );

  -- 聊天持久化(审计C1:两个写入路径统一落入此表;服务重启不丢)
  CREATE TABLE IF NOT EXISTS chat_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL,
    nickname TEXT DEFAULT '',
    text TEXT NOT NULL,
    source TEXT DEFAULT 'rest',
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- 管理员操作审计日志(审计H4:记录操作人/类型/目标UID/详情)
  CREATE TABLE IF NOT EXISTS admin_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_uid TEXT NOT NULL,
    action TEXT NOT NULL,
    target_uid TEXT DEFAULT '',
    detail TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// 平滑迁移:给旧DB补缺失列(SQLite无 ALTER TABLE ADD COLUMN IF NOT EXISTS,用 try/catch)
try { db.exec('ALTER TABLE announcements ADD COLUMN start_time TEXT DEFAULT ""'); } catch(e) {}
try { db.exec('ALTER TABLE announcements ADD COLUMN end_time TEXT DEFAULT ""'); } catch(e) {}
try { db.exec('ALTER TABLE announcements ADD COLUMN rewards_json TEXT DEFAULT "{}"'); } catch(e) {}
try { db.exec('ALTER TABLE chat_logs ADD COLUMN source TEXT DEFAULT "rest"'); } catch(e) {}
try { db.exec('ALTER TABLE users ADD COLUMN ladder_rank TEXT DEFAULT "新手"'); } catch(e) {}
try { db.exec('ALTER TABLE users ADD COLUMN ladder_score INTEGER DEFAULT 0'); } catch(e) {}

// 索引(消除全表扫描:邮件按 uid、排行按各分数列排序、好友反向查、回放按对手)
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_chat_logs_time ON chat_logs(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_chat_logs_uid ON chat_logs(uid);
  CREATE INDEX IF NOT EXISTS idx_admin_logs_time ON admin_logs(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_mail_uid ON mail(uid);
  CREATE INDEX IF NOT EXISTS idx_mail_uid_read ON mail(uid, is_read);
  CREATE INDEX IF NOT EXISTS idx_leaderboard_power ON leaderboard(power DESC);
  CREATE INDEX IF NOT EXISTS idx_leaderboard_stage ON leaderboard(highest_stage DESC);
  CREATE INDEX IF NOT EXISTS idx_leaderboard_ladder ON leaderboard(ladder_score DESC);
  CREATE INDEX IF NOT EXISTS idx_friends_uid2 ON friends(uid2);
  CREATE INDEX IF NOT EXISTS idx_friends_uid1_status ON friends(uid1, status);
  CREATE INDEX IF NOT EXISTS idx_replays_uid1 ON replays(uid1);
  CREATE INDEX IF NOT EXISTS idx_replays_uid2 ON replays(uid2);
`);

// Seed achievements
const ACHV_SEED = [
  ['first_win', '首战告捷', '通关第1关', '{"gems":5}'],
  ['stage_5', '初露锋芒', '通关第5关', '{"gems":10}'],
  ['stage_10', '渐入佳境', '通关第10关', '{"gems":20}'],
  ['stage_20', '百战老兵', '通关第20关', '{"gems":50}'],
  ['collect_5', '小有收获', '收集5种水果', '{"gems":5}'],
  ['collect_10', '水果猎人', '收集10种水果', '{"gems":15}'],
  ['collect_all', '水果大师', '收集全部水果', '{"gems":100}'],
  ['pvp_first', '竞技初体验', '完成一场PvP对局', '{"gems":10}'],
  ['pvp_win', '竞技首胜', '赢得一场PvP胜利', '{"gems":20}'],
  ['hero_10', '成长之路', '任一英雄达到Lv10', '{"gems":25}'],
  ['hero_20', '巅峰强者', '任一英雄达到Lv20', '{"gems":100}'],
  ['deck_full', '满员出征', '编队满员上场', '{"gems":10}'],
];
const insAch = db.prepare('INSERT OR IGNORE INTO achievements (id,title,desc,reward_json) VALUES (?,?,?,?)');
for (const row of ACHV_SEED) insAch.run(...row);

module.exports = db;
