/* ============================================================
   水果突击 · SQLite Database Layer (Phase A)
   ============================================================ */
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'data', 'fruits.db');
const fs = require('fs');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT DEFAULT '',
    active INTEGER DEFAULT 1,
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
`);

module.exports = db;
