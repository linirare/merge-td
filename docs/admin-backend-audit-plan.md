# Admin 管理后台深度诊断与修复计划（六轮审核完整版）

## Context

`C:\Users\win10\merge-td-new` 是"水果突击"(Fruit Assault) HTML5 Canvas 合并塔防游戏，Node.js + Express + SQLite(better-sqlite3) 后端，原生 WebSocket PvP。管理后台用于游戏运营，用户要求支持：

1. 实时看到玩家真实注册
2. 真实在线情况
3. 看到各个玩家真实数据
4. 发放邮件(单人/整服，实时同步)
5. 发公告(实时同步)
6. 发资源(实时单人/整服/UID)
7. 看到线上聊天记录
8. **所有数据必须是存档，不受版本更迭影响**

审查范围：`server/admin.js`(129行), `admin.html`(397行), `server/db.js`(161行), `server/index.js`(199行), `server/pvp-server.js`(553行), `js/account_client.js`(137行), `js/pvp.js`(handleServerMessage 部分), `server/auth.js`(29行), `server/util.js`(27行)

---

## 致命问题（Critical）—— 共 6 项

### C1. 聊天记录完全未持久化 —— 违反"所有数据必须是存档"

**现状**: `server/index.js:120` 用内存数组 `chatMessages = []` 存聊天，上限 200 条，**服务重启全部丢失**。

**更严重的是有两个写入路径，都需要修**:
| 路径 | 文件 | 行号 | 上限 | 时间字段 |
|------|------|------|------|---------|
| REST `POST /api/chat` | `server/index.js:123-131` | 200 条(splice) | `ts: Date.now()` |
| WS `type:'chat'` | `server/pvp-server.js:415-433` | 100 条(shift) | `time: new Date().toISOString()` |

两条路径上限不一致(200 vs 100)、字段名不一致(`ts` vs `time`)、数据结构不完全相同（WS 多了 `nick` 字段）。

**修复 —— `server/db.js` 新增表:**

```sql
CREATE TABLE IF NOT EXISTS chat_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,
  nickname TEXT DEFAULT '',
  text TEXT NOT NULL,
  source TEXT DEFAULT 'rest',   -- 'rest' 或 'ws',区分来源
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_logs_time ON chat_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_logs_uid ON chat_logs(uid);
```

**修复 —— `server/index.js` 改造 REST 写路径:**

```js
app.post('/api/chat', authMiddleware, (req, res) => {
  const text = safeText((req.body || {}).text, 120);
  if (!text) return res.status(400).json({ error: 'empty message' });
  const u = db.prepare('SELECT nickname FROM users WHERE uid = ?').get(req.uid) || {};
  const nickname = safeText(u.nickname || '玩家', 24);
  const msg = { uid: req.uid, nickname, text, ts: Date.now() };

  chatMessages.push(msg);
  if (chatMessages.length > 200) chatMessages.splice(0, chatMessages.length - 200);

  // ★ DB 持久化
  db.prepare('INSERT INTO chat_logs (uid, nickname, text, source) VALUES (?,?,?,?)')
    .run(req.uid, nickname, text, 'rest');

  return res.json({ ok: true, message: msg });
});
```

**修复 —— `server/pvp-server.js` 改造 WS 写路径 (pushChat 函数):**

```js
function pushChat(client, message) {
  const text = sanitizeText(message.text || message.m || '', 80);
  if (!text) return;
  const nick = client._uid
    ? (sanitizeText(client._nick || '', 24) || ('玩家' + String(client._uid).slice(0, 4)))
    : '游客';
  const uid = sanitizeText(client._uid || '', 32);
  const msg = {
    uid, nick, nickname: nick, text,
    time: new Date().toISOString(),
  };

  // 内存缓存（保持向前兼容）
  const chat = require('./index').chatMessages;
  chat.push(msg);
  if (chat.length > 200) chat.splice(0, chat.length - 200);  // ★ 统一上限 200

  // ★ DB 持久化
  const db = require('./db');
  db.prepare('INSERT INTO chat_logs (uid, nickname, text, source) VALUES (?,?,?,?)')
    .run(uid, nick, text, 'ws');

  broadcastAll(client, { type: 'chat', message: msg });
}
```

注意：WS 写入用了 `require('./index')` 和 `require('./db')` 做运行时引用，避免循环依赖。

---

### C2. "当前在线"和"今日流水"是写死的假数据

**现状**:
- `admin.html:143` 硬编码 `当前 1,284 人`
- `admin.html:150-153` 四个 stat card 的 `<b>` 数字全部写死：48,203 / 1,842 / 1,284 / ¥26,540
- `admin.html:150` 百分比也硬编码：`▲ 6.2%` / `▲ 12%` / `▲ 3.4%`

**修复 —— `server/pvp-server.js` 增加在线追踪:**

```js
// 文件顶部新增
const onlineUsers = new Map(); // uid → { ws, nickname, level, lastHeartbeat }

// attachSocket 中,WS 连接建立后登记:
// if (client._uid) onlineUsers.set(client._uid, { ws: client.socket, nickname: client._nick, level: 1, lastHeartbeat: Date.now() });

// disconnectClient 中清理: if (client._uid) onlineUsers.delete(client._uid);

// WS 收到 ping(opcode 0x9)时更新心跳: onlineUsers.get(client._uid).lastHeartbeat = Date.now();

// 僵尸清理(每 60s):
const HEARTBEAT_CHECK = setInterval(() => {
  const now = Date.now();
  for (const [uid, data] of onlineUsers) {
    if (now - data.lastHeartbeat > 90000) {
      try { data.ws.close(); } catch(e) {}
      onlineUsers.delete(uid);
    }
  }
}, 60000);

// 导出
module.exports = {
  // ...原有导出...
  onlineUsers,
  getOnlineCount: () => onlineUsers.size,
  getOnlineUsers: () => [...onlineUsers.entries()].map(([uid, data]) => ({ uid, nickname: data.nickname, level: data.level })),
};
```

**修复 —— `server/admin.js` stats 端点:**

```js
app.get('/api/admin/stats', authMiddleware, adminAuth, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
  const today = new Date().toISOString().slice(0,10);
  const todayNew = db.prepare("SELECT COUNT(*) as n FROM users WHERE created_at LIKE ?").get(today+'%').n;
  const { getOnlineCount } = require('./pvp-server');
  res.json({ total, todayNew, onlineCount: getOnlineCount ? getOnlineCount() : 0 });
});
```

**修复 —— `admin.html` 替换所有假数据:**

```js
async function loadDash() {
  try {
    const stats = await api('GET', '/api/admin/stats');
    document.querySelectorAll('.stat b')[0].textContent = (stats.total || 0).toLocaleString();
    document.querySelectorAll('.stat b')[1].textContent = (stats.todayNew || 0).toLocaleString();
    document.querySelectorAll('.stat b')[2].textContent = (stats.onlineCount || 0).toLocaleString();
    // 今日流水暂无可信数据源
    document.querySelectorAll('.stat b')[3].textContent = '--';
    document.querySelectorAll('.stat span')[3].textContent = '付费系统待接入';
    // 移除所有硬编码的 ▲ 百分比
    document.querySelectorAll('.stat .up').forEach(el => el.remove());

    // 更新 topbar
    const liveEl = document.getElementById('liveCount');
    if (liveEl) liveEl.textContent = (stats.onlineCount || 0).toLocaleString();

    // 最新注册
    const users = await api('GET', '/api/admin/users?limit=8');
    // ...渲染...
  }
}
```

HTML 修改 topbar:
```html
<!-- 原来: <span class="badge-live"><span class="dot"></span>服务在线 · 当前 1,284 人</span> -->
<span class="badge-live"><span class="dot"></span>服务在线 · 当前 <b id="liveCount">--</b> 人</span>
```

---

### C3. 邮件附件奖励从未实际发放给玩家 —— 数据丢失

**现状**: 
- Admin 发邮件时可以带 `rewards_json`（金币/钻石/碎片）
- 玩家调用 `readMail(id)` → `POST /api/mail/read` 只设置 `is_read=1`
- **`rewards_json` 里的奖励从未被处理！** 玩家永远不会收到附件资源
- `js/account_client.js:75` `readMail` 也不处理 rewards

**修复 —— `server/index.js` 改造 `POST /api/mail/read`:**

```js
app.post('/api/mail/read', authMiddleware, (req, res) => {
  const b = req.body || {};
  if (!b.id) return res.status(400).json({ error: 'id required' });

  // 先查邮件信息，如果未读且有奖励，发放奖励
  const mail = db.prepare('SELECT * FROM mail WHERE id=? AND uid=?').get(b.id, req.uid);
  if (!mail) return res.status(404).json({ error: 'mail not found' });
  if (!mail.is_read && mail.rewards_json && mail.rewards_json !== '{}') {
    try {
      const rewards = JSON.parse(mail.rewards_json);
      const g = clampInt(rewards.gold || 0, 0, 1000000, 0);
      const d = clampInt(rewards.diamonds || 0, 0, 100000, 0);
      if (g || d) {
        db.prepare('UPDATE users SET gold = gold + ?, diamonds = diamonds + ? WHERE uid = ?').run(g, d, req.uid);
      }
    } catch(e) { /* rewards_json 解析失败,忽略 */ }
  }

  db.prepare('UPDATE mail SET is_read=1 WHERE id=? AND uid=?').run(b.id, req.uid);
  res.json({ ok: true });
});
```

**前端 `js/account_client.js` 同步处理:**

```js
async readMail(id) {
  const r = await this.api('POST', '/api/mail/read', { id });
  // 刷新本地资源显示
  if (r.ok && this.user) {
    const prof = await this.api('GET', '/api/user/profile');
    if (prof && !prof.error) {
      this.user.diamonds = prof.diamonds;
      this.user.gold = prof.gold;
    }
  }
  return r;
},
```

---

### C4. `broadcastAll` 函数签名是 `(except, message)` 不是 `(message)` —— 推送全部静默失败

**现状**: `server/pvp-server.js:108`
```js
function broadcastAll(except, message) {
  for (const client of allClients) if (client !== except) send(client, message);
}
function send(client, message) {
  client.socket.write(encodeFrame(JSON.stringify(message))); // send 自己做 JSON.stringify
}
```

- 第一个参数是 `except`(要排除的客户端)，第二个才是 `message`
- `send()` 内部做了 `JSON.stringify`，所以 message 应传 **对象** 而非字符串
- 正确调用: `broadcastAll(null, { type: 'new_mail', uid })`
- 错误调用: `broadcastAll(JSON.stringify({...}))` ← 会把 JSON 字符串当 except 参数

**修复 —— 所有 admin.js 中的 broadcastAll 调用:**

```js
const { broadcastAll } = require('./pvp-server');

// POST /api/admin/mail 末尾:
broadcastAll(null, { type: 'new_mail', uid: targetUid });

// POST /api/admin/mail-all 末尾:
broadcastAll(null, { type: 'new_mail', all: true });

// POST /api/admin/announcement 末尾:
broadcastAll(null, { type: 'new_announcement', id });

// POST /api/admin/resource 末尾:
broadcastAll(null, { type: 'resource_grant', uid, gold: g, diamonds: d });

// POST /api/admin/resource-all 末尾:
broadcastAll(null, { type: 'resource_grant', all: true, gold: g, diamonds: d });
```

---

### C5. `adminAuth` 函数被重复定义 —— 第一个定义是死代码

**现状**: `server/admin.js`
- Line 14-17: 第一版 `adminAuth`（检查 `req.uid` 是否在 ADMIN_UIDS 中）
- Line 32-44: 第二版 `adminAuth`（检查 admin session token，fallback 游戏 token）
- **Line 32 的 `function adminAuth` 覆盖了 line 14 的版本**
- 所有路由实际使用的是 line 32 版本
- 第一版是死代码，且如果单独使用有安全隐患（只检查 uid 不检查 token）

**修复**: 删除 line 14-17 的死代码。

---

### C6. Resource 发放不验证 UID 是否存在 —— 静默无声失败

**现状**: `server/admin.js:95`
```js
db.prepare('UPDATE users SET gold = gold + ?, diamonds = diamonds + ? WHERE uid = ?').run(gold||0, diamonds||0, uid);
```
如果 UID 不存在，`run()` 返回 `changes: 0`，但代码不检查，直接返回 `{ ok: true }`。

**修复**:
```js
app.post('/api/admin/resource', authMiddleware, adminAuth, (req, res) => {
  const { uid, gold, diamonds } = req.body || {};
  if (!uid) return res.status(400).json({ error: 'uid required' });
  const g = clampInt(gold || 0, 0, 1000000, 0);
  const d = clampInt(diamonds || 0, 0, 100000, 0);
  if (g === 0 && d === 0) return res.status(400).json({ error: 'amount required' });

  const result = db.prepare('UPDATE users SET gold = gold + ?, diamonds = diamonds + ? WHERE uid = ?').run(g, d, uid);
  if (result.changes === 0) return res.status(404).json({ error: 'user not found' });

  logAdmin('resource', uid, `gold:${g} diamonds:${d}`);
  broadcastAll(null, { type: 'resource_grant', uid, gold: g, diamonds: d });
  res.json({ ok: true });
});
```

---

## 高优先级功能缺陷（High）—— 共 9 项

### H1. 缺少全服资源发放 API

已在原计划中，不再重复。注意需验证 UID 列表非空。

### H2. 客户端 WebSocket 不处理推送通知 —— 实时推送落不了地

**现状**: `js/pvp.js` 的 `handleServerMessage`（约 line 123-158）只处理 PvP 相关消息类型：
- `room_created`, `room_joined`, `peer_joined`, `ready_state`, `match_start`, `snapshot`, `peer_action`, `peer_left`, `match_result`, `error`

**没有处理** `new_mail`, `new_announcement`, `resource_grant`, `chat` 等非 PvP 消息！

所以即使服务端广播了这些通知，客户端收到也会被忽略。

**修复 —— `js/pvp.js` `handleServerMessage` 末尾新增:**

```js
// 在 handleServerMessage 函数末尾的 else 之前新增:
} else if (message.type === 'new_mail') {
  if (typeof account !== 'undefined' && account.getMail) {
    account.getMail().then(mails => {
      if (typeof onMailReceived === 'function') onMailReceived(mails);
    }).catch(() => {});
  }
} else if (message.type === 'new_announcement') {
  if (typeof account !== 'undefined' && account.announcements) {
    account.announcements().then(list => {
      if (typeof onAnnouncementUpdate === 'function') onAnnouncementUpdate(list);
    }).catch(() => {});
  }
} else if (message.type === 'resource_grant') {
  // 刷新用户资源数据
  if (typeof account !== 'undefined' && account.user && (message.uid === account.user.uid || message.all)) {
    account.api('GET', '/api/user/profile').then(prof => {
      if (prof && !prof.error && account.user) {
        account.user.diamonds = prof.diamonds;
        account.user.gold = prof.gold;
      }
    }).catch(() => {});
  }
} else if (message.type === 'chat') {
  // WS 聊天消息已由 pushChat 广播,客户端可在此刷新聊天 UI
  if (typeof onWsChatMessage === 'function') onWsChatMessage(message.message);
}
```

### H3. 在线状态无追踪（含客户端心跳）

已在 C2 中详述，不再重复。额外注意：客户端需要在 WS 连接后定期发 ping。当前 `pvp.js` 是否有心跳逻辑需确认。

### H4. 管理员操作无审计日志

已在原计划中，不再重复。日志需记录操作人（admin）、操作类型、目标 UID、详情 JSON。

### H5. 公告无生效时间

已在原计划中，不再重复。

### H6. 用户列表无服务端搜索/分页

已在原计划中，`GET /api/admin/users` 改造方案见下文统一修复部分。

### H7. admin.html 资源发放类型选择器是摆设

已在原计划 C3-4 中，不再重复。

### H8. admin.html"已发送记录"表格从未填充数据

**现状**: `admin.html:187` 邮件下发页有"已发送记录"表格，带表头（标题/范围/时间/领取率），但：
- 没有 API 获取已发送邮件列表
- JS 完全不填充这个表格
- 始终显示空表

**修复 —— `server/admin.js` 新增端点:**

```js
// 已发送邮件列表
app.get('/api/admin/mail-log', authMiddleware, adminAuth, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;

  // 按创建时间分组,同一批发的邮件(同一秒内同标题)合并为一条
  const rows = db.prepare(`
    SELECT title, body, rewards_json, created_at,
           COUNT(*) as total, SUM(is_read) as read_count
    FROM mail
    GROUP BY title, strftime('%Y-%m-%d %H:%M', created_at)
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  const total = db.prepare(`
    SELECT COUNT(DISTINCT title || strftime('%Y-%m-%d %H:%M', created_at)) as n FROM mail
  `).get().n;

  res.json({ rows, total, page, limit });
});
```

**修复 —— `admin.html` JS 填充表格:**

```js
async function loadMailLog() {
  try {
    const data = await api('GET', '/api/admin/mail-log');
    document.getElementById('mailLog').innerHTML = Array.isArray(data.rows)
      ? data.rows.map(m => `<tr>
          <td>${esc(m.title)}</td>
          <td>${m.total > 1 ? `全服 (${m.total}人)` : '单人'}</td>
          <td>${(m.created_at || '').slice(0, 16)}</td>
          <td>${m.total ? Math.round(m.read_count / m.total * 100) : 0}%</td>
        </tr>`).join('')
      : '<tr><td colspan="4">暂无记录</td></tr>';
  } catch(e) {}
}
// 在 go('mail') 时调用 loadMailLog()
```

### H9. 管理后台用户列表不显示在线状态

**现状**: 用户列表"状态"列永远显示 `<span class="tag on">正常</span>`。

**修复**: 在用户列表渲染时使用 `is_online` 字段:
```js
// admin.html 用户列表渲染
`<td>${u.is_online
  ? '<span class="tag on">● 在线</span>'
  : '<span class="tag">离线</span>'
}</td>`
```

---

## admin.html 前端假功能汇总（C3 扩展）

### C3-1. 分页按钮纯装饰
原计划已覆盖。改为 JS 动态生成 `#userPager`。

### C3-2. 搜索框无功能
原计划已覆盖。回车触发 + 点击搜索图标触发。

### C3-3. "最新注册"表列映射错误
表头是"渠道"实际显示等级。改为：UID / 昵称 / 等级 / 注册时间 / 状态。

### C3-4. 资源发放类型选择器是摆设
原计划已覆盖。`typeMap` 映射 + 区分单发/全服。

### C3-5. 邮件附件字段未接线
原计划已覆盖。收集三个 input 值组成 `rewards_json`。

### C3-6. 四个 stat card 全部是假数据
C2 已覆盖。统一从 `GET /api/admin/stats` 取真实数据。

### C3-7. 三个增长百分比是假的
`▲ 6.2%` / `▲ 12%` / `▲ 3.4%` 硬编码在 HTML 中。改为：不显示百分比（无可靠基线），或基于本周 vs 上周计算（后续迭代）。

### C3-8. 用户管理页的"发邮件""发资源"按钮只弹 toast
`admin.html:318-319` 的按钮只调用 `toast()`，没有跳转到对应的邮件/资源页面。

**修复**: 改为跳转并预填 UID:
```js
<button onclick="go('mail', document.querySelector('[data-p=\"mail\"]')); /* 预填 UID */">发邮件</button>
<button onclick="go('res', document.querySelector('[data-p=\"res\"]')); /* 预填 UID */">发资源</button>
```

---

## 数据一致性问题

### D1. 两个聊天路径上限不一致
- REST: 200 条 (`chatMessages.splice(0, len - 200)`)
- WS: 100 条 (`chat.shift()`)
- **统一为 200 条**

### D2. 两个聊天路径字段不一致
- REST: `{ uid, nickname, text, ts }`  —— `ts` 是毫秒时间戳
- WS: `{ uid, nick, nickname, text, time }` —— `time` 是 ISO 字符串，多了 `nick` 字段
- 统一 DB 存储后不再影响持久层，但内存缓存保持向前兼容

### D3. announcements 表 id 字段类型不匹配
- `db.js:54`: `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `admin.js:115`: 插入 hex 字符串 `crypto.randomBytes(6).toString('hex')`
- SQLite 柔性类型允许此操作但语义不一致
- 建议改为 `id TEXT PRIMARY KEY`

### D4. DELETE /api/admin/chat 只清内存
增加 DB 持久化后，清聊天应同时标记 DB 记录（软删除加 `deleted=1` 字段，或直接提示不可逆操作）

---

## 完整修改文件清单（更新版）

| 文件 | 改动量 | 关键改动 |
|------|--------|---------|
| `server/db.js` | +50 行 | chat_logs 表(含 source 字段)；admin_logs 表；announcements ALTER start_time/end_time；索引 |
| `server/index.js` | ~30 行改 | POST /api/chat 双写 DB；POST /api/mail/read 处理 rewards_json 发放奖励；announcements 时间过滤 |
| `server/admin.js` | ~120 行改 | 删除死代码 adminAuth v1；stats 加 onlineCount；users 加分页搜索+在线状态；mail/resource 加推送(broadcastAll 正确签名)；新增 resource-all、mail-log、logs 端点；公告加时间；chat 改为 DB 查询；审计日志；UID 存在性校验 |
| `server/pvp-server.js` | +50 行改 | onlineUsers Map；心跳检测+僵尸清理；disconnectClient 清理；pushChat 双写 DB；broadcastAll 导出 |
| `admin.html` | ~80 行改 | 假数据全部替换；topbar 在线人数动态化；搜索/分页接线；资源发放 select 接线+全服；邮件附件接线；mailLog 填充；在线状态显示；列映射修正；操作按钮跳转修复；百分比移除 |
| `js/pvp.js` | +25 行 | handleServerMessage 新增 new_mail/new_announcement/resource_grant/chat 处理 |
| `js/account_client.js` | ~10 行改 | readMail 后刷新本地资源显示 |

**总计: 7 个文件，约 365 行改动，0 新增依赖包。**

---

## 关键前后端对齐检查清单

| # | 对齐项 | 前端 | 后端 | 状态 |
|---|--------|------|------|------|
| 1 | 在线人数 | admin.html loadDash 读 `stats.onlineCount` | GET /api/admin/stats 返回 onlineCount | ❌ 需修 |
| 2 | 用户列表分页 | admin.html 传 `?page=&limit=&q=` | GET /api/admin/users 支持分页搜索 | ❌ 需修 |
| 3 | 用户在线标识 | admin.html 显示 `is_online` 标签 | GET /api/admin/users 返回 is_online | ❌ 需修 |
| 4 | 邮件附件发放 | admin.html 组装 rewards_json | POST /api/admin/mail 存 rewards_json | ❌ 前端未接线 |
| 5 | 邮件奖励领取 | account_client readMail 刷新资源 | POST /api/mail/read 发放 rewards_json | ❌ 两端都缺 |
| 6 | 全服资源发放 | admin.html 留空 UID → resource-all | POST /api/admin/resource-all | ❌ 需新增 |
| 7 | 资源类型选择 | admin.html select 映射 type | POST /api/admin/resource 支持 type | ❌ 两端都缺 |
| 8 | 实时邮件推送 | pvp.js 处理 new_mail 消息 | admin.js broadcastAll(null, {type:'new_mail'}) | ❌ 需修 |
| 9 | 实时公告推送 | pvp.js 处理 new_announcement | admin.js broadcastAll(null, {type:'new_announcement'}) | ❌ 需修 |
| 10 | 实时资源推送 | pvp.js 处理 resource_grant | admin.js broadcastAll(null, {type:'resource_grant'}) | ❌ 需修 |
| 11 | 聊天持久化 | admin.html 从 DB 查历史 | GET /api/admin/chat 查 chat_logs 表 | ❌ 需修 |
| 12 | WS聊天持久化 | 无前端改动 | pvp-server pushChat 写 chat_logs | ❌ 需修 |
| 13 | 已发邮件记录 | admin.html 填充 mailLog | GET /api/admin/mail-log | ❌ 需新增 |
| 14 | 审计日志 | (后续可加 admin 页面) | GET /api/admin/logs | ❌ 需新增 |
| 15 | 公告时间过滤 | 无前端改动 | GET /api/announcements 过滤过期 | ❌ 需修 |
| 16 | UID 存在校验 | 无前端改动(后端报错即可) | resource/mail 校验 UID 存在 | ❌ 需修 |
| 17 | broadcastAll 签名 | 无前端改动 | 传 `(null, obj)` 而非 `(str)` | ❌ BUG |
| 18 | 死代码 adminAuth v1 | 无前端改动 | 删除 server/admin.js line 14-17 | ❌ 需修 |

---

## 验证方案

| # | 测试用例 | 预期结果 | 涉及文件 |
|---|---------|---------|---------|
| 1 | 发 REST 聊天 → 重启 → admin 查聊天 | 消息仍在 DB 中 | index.js, db.js |
| 2 | 发 WS 聊天 → 重启 → admin 查聊天 | 消息仍在 DB 中 | pvp-server.js, db.js |
| 3 | 游戏连 WS → admin 数据概览 | onlineCount ≥1 | pvp-server.js, admin.js, admin.html |
| 4 | 断开 WS 90s → admin 刷新 | onlineCount 减少 | pvp-server.js |
| 5 | admin 全服发 100 金币 → 查 3 个玩家 | 每人 +100 | admin.js |
| 6 | admin 发带附件邮件 → 玩家 readMail | 金币/钻石到账 | index.js, account_client.js |
| 7 | admin 发邮件 → 目标玩家在线 | WS 收到 new_mail 推送 | admin.js, pvp.js |
| 8 | admin 发公告 → 在线玩家 | WS 收到 new_announcement 推送 | admin.js, pvp.js |
| 9 | admin 发资源给某 UID → 该玩家在线 | WS 收到 resource_grant 推送 | admin.js, pvp.js |
| 10 | admin 搜索"张三" → 翻第 2 页 | 过滤正确，分页可点击 | admin.js, admin.html |
| 11 | admin 发资源 → 查看 GET /api/admin/logs | 操作记录存在 | admin.js, db.js |
| 12 | 发过期公告 → 玩家 GET /api/announcements | 不返回 | index.js, db.js |
| 13 | admin 发资源给不存在的 UID | 返回 404 user not found | admin.js |
| 14 | admin 邮件附件填金币 500 → 发送 | rewards_json = {"gold":500} | admin.html |
| 15 | admin 资源选"钻石" 200 → 发给某 UID | 该玩家钻石 +200 | admin.html, admin.js |
| 16 | admin 查看已发送邮件记录 | mailLog 表格有数据 | admin.js, admin.html |
| 17 | 用户列表在线玩家 | 显示"● 在线"绿标 | admin.js, admin.html |
| 18 | 用户列表离线玩家 | 显示"离线"灰标 | admin.js, admin.html |

---

## 第四轮审核新增发现（2026-07-12 补充）

### C7. `broadcastAll` 和 `onlineUsers` 未从 pvp-server.js 导出 —— 所有推送功能无法工作

**现状**: `pvp-server.js:541-552` module.exports 只导出了 `handlePvpUpgrade`、`attachPvp`、`_internals`。
- `broadcastAll` 函数定义在 line 108 但没有加导出
- `onlineUsers` 变量也未导出
- admin.js 中 `const { broadcastAll } = require('./pvp-server')` 将得到 `undefined`
- 所有实时推送（邮件/公告/资源）都将**静默失败**

**修复 —— `pvp-server.js` module.exports 增加导出:**
```js
module.exports = {
  handlePvpUpgrade,
  attachPvp,
  broadcastAll,        // ★ 新增
  onlineUsers,         // ★ 新增（供 admin.js 读取在线列表）
  getOnlineCount: () => onlineUsers.size,  // ★ 新增
  // ..._internals 保持不变
};
```

### C8. `clampInt` 未导入 admin.js —— 资源发放无法做安全截断

**现状**: `admin.js:7` 只导入了 `safeText`，未导入 `clampInt`。审核计划中所有涉及 `clampInt` 的调用都会抛出 ReferenceError。

**修复 —— `admin.js` 顶部:**
```js
const { clampInt, safeText } = require('./util');
```

### C9. WS 聊天消息被客户端丢弃 —— 实时聊天在 WS 路径是假功能

**现状**:
- `pvp-server.js:432` pushChat 广播 `{ type: 'chat', message: msg }` 给所有 WS 客户端
- `pvp.js:123-158` handleServerMessage 只处理 PvP 类型（room_created, match_start, snapshot, peer_left, match_result, error）
- **没有处理 `type: 'chat'`** → WS 聊天消息到达客户端后被直接忽略
- 这意味着：
  - WS 连接的玩家看不到其他玩家的实时聊天消息（尽管服务端在广播）
  - 玩家只能通过 REST polling (`GET /api/chat`) 拉取聊天
  - 之前审核 H2 的"实时推送"问题同样影响聊天本身：**服务端 WS 聊天广播实际上从未到达玩家的眼睛**

**修复 —— `js/pvp.js` handleServerMessage 新增 chat 处理:**
```js
} else if (message.type === 'chat') {
  // WS 实时聊天消息：推入游戏内聊天 UI
  if (message.message && typeof onChatMessage === 'function') {
    onChatMessage(message.message);
  }
  // 兜底：如果游戏有全局聊天数组，追加进去
  if (typeof window.chatMessages !== 'undefined' && Array.isArray(window.chatMessages)) {
    window.chatMessages.push(message.message);
    if (window.chatMessages.length > 200) window.chatMessages.shift();
  }
}
```

**注意**: 游戏前端需要一个 `onChatMessage` 回调（或在聊天 UI 模块中定义 `window.chatMessages` 全局数组）来完成对接。这属于前端游戏 UI 层面的改动，超出 admin 后台范围，但必须在 plan 中标注为**待对接项**。

### C10. `safeRewardJson` 奖励上限不一致 —— 邮件 vs 任务/成就口径不同

**现状**:
- `social.js:17` `safeRewardJson` 将 gems 截断到 **max 300**
- 但 admin 发邮件附件钻石可以设任意值（无上限），`POST /api/mail/read` 发放时也未限制
- 这导致：任务/成就奖励最多 300 钻石，但邮件附件可以发 100000 钻石
- 如果运营通过邮件发了大额资源，缺乏统一的奖励上限保护

**修复 —— `server/index.js` POST /api/mail/read 增加上限保护:**
```js
// 发放邮件附件奖励时增加安全截断（与 safeRewardJson 对齐但放宽到运营邮件级别）
const g = clampInt(rewards.gold || 0, 0, 50000, 0);      // 运营邮件 50000 gold 上限
const d = clampInt(rewards.diamonds || 0, 0, 10000, 0);   // 运营邮件 10000 diamonds 上限
```

### H10. 资源发放"碎片(指定英雄)"和"改名卡"完全没有后端实现

**现状**:
- `admin.html:221-222` select 中有"碎片(指定英雄)"和"改名卡"选项
- 但后端 `POST /api/admin/resource` 只能发 gold 和 diamonds
- **碎片**: `user_saves.shell_json` 中有 `fragments` 字段（JSON blob），但 admin 无法操作
- **改名卡**: 数据库中根本没有改名卡字段，是完全不存在的道具
- 如果运营选了这些选项并发放，静默无效

**修复**:
- "改名卡"选项从 admin.html select 中移除（不存在此道具系统）
- "碎片(指定英雄)"留作后续迭代（需要后端支持解析 shell_json 中的 fragments 字段并追加指定英雄碎片）

### H11. 活动系统硬编码，Admin 无法管理

**现状**: `server/activity.js:6-9` 活动列表是硬编码的 JavaScript 数组：
```js
const ACTIVITIES = [
  { id: 'endless', title: '无尽挑战', ... active: true },
  { id: 'daily_boss', title: '每日 Boss', ... active: false },
];
```
- 不在数据库中，Admin 无法新增/编辑/上下架活动
- 虽然 `server/db.js` 有 `events` 表，但 activity.js 根本不用它
- `events` 表和 `activity.js` 的 ACTIVITIES 是**两套独立的系统**，互不关联

这属于产品功能缺失而非 bug，在计划中标注为**后续迭代**。

### H12. Admin 对社交数据完全不可见

Admin 无法查看：好友关系、公会列表、任务进度、成就解锁、皮肤持有、活动参与、战斗回放。所有这些数据在 DB 中存在，但没有 admin 查询端点。

这也是产品功能缺失，标注为**后续迭代**。如运营需要排查玩家问题（"我任务完成了没领到奖励"），需要这些查询能力。

---

## 第四轮新增验证清单

| # | 测试用例 | 预期结果 |
|---|---------|---------|
| 19 | `require('./pvp-server').broadcastAll` | 是 function，不是 undefined |
| 20 | `require('./pvp-server').onlineUsers` | 是 Map，不是 undefined |
| 21 | `require('./pvp-server').getOnlineCount()` | 返回数字 |
| 22 | admin.js 中调用 `clampInt(100,0,50,0)` | 返回 50，不抛 ReferenceError |
| 23 | 玩家 WS 连上后发聊天 → 另一个 WS 玩家 | 客户端 handleServerMessage 收到 type:'chat' 并在聊天 UI 显示 |
| 24 | admin 发邮件附件钻石 20000 → 玩家 readMail | 实际到账 10000（上限截断） |
| 25 | admin 资源发放选"改名卡" | 该选项已移除（或灰显标注"开发中"） |

---

## 第四轮更新后的完整文件清单

| 文件 | 改动量 | 本轮新增改动 |
|------|--------|-------------|
| `server/db.js` | +50 行 | — |
| `server/index.js` | ~35 行改 | mail/read 奖励增加上限截断 |
| `server/admin.js` | ~125 行改 | 导入 clampInt；删除 adminAuth v1 死代码；broadcastAll 需等 pvp-server 导出 |
| `server/pvp-server.js` | +55 行改 | **★ 导出 broadcastAll, onlineUsers, getOnlineCount**；disconnectClient 清理 onlineUsers；pushChat 双写 DB+统一上限 |
| `admin.html` | ~85 行改 | 移除"改名卡"选项（或灰显）；其余不变 |
| `js/pvp.js` | +35 行 | **★ 新增 chat 消息处理** + new_mail/new_announcement/resource_grant |
| `js/account_client.js` | ~10 行改 | readMail 刷新资源 |

**总计: 7 个文件，约 395 行改动，0 新增依赖包。**

---

## 仍存在的已知限制（非 bug，后续迭代）

| # | 限制 | 说明 |
|---|------|------|
| 1 | Admin 无法管理活动 | activity.js 硬编码，events 表未对接 |
| 2 | Admin 无法查看社交数据 | 好友/公会/成就等无 admin 查询端点 |
| 3 | Admin 无法查看玩家详细存档 | meta_json/shell_json 是 JSON blob，无解析展示 |
| 4 | Admin 无法封禁用户 | 无 ban/disable 机制 |
| 5 | Admin 无法编辑/删除单条聊天 | 只能全清 |
| 6 | "碎片(指定英雄)"暂不可用 | 需后端解析 shell_json fragments 字段 |
| 7 | 无数据备份机制 | WAL 模式提供基本 crash recovery，无主动备份 |
| 8 | 无自动数据清理 | 聊天记录/日志会无限增长，需后续加归档或 TTL |
| 9 | 客户端 `onChatMessage` 回调未定义 | 游戏前端需对接 WS 实时聊天（目前仅 REST 轮询可用） |
| 10 | `onMailReceived` / `onAnnouncementUpdate` 回调未定义 | 游戏前端需对接实时推送通知 |

---

## 第五轮审核新增发现（安全审计 + 前端全量 + 数据层全量）

第五轮采用三个 Agent 并行地毯式排查：安全工程师审计所有 API、前端全量审查 admin.html + account_client.js + product_shell.js + pvp.js、数据层审查 db.js + util.js + .env + 测试文件。

### S1 [CRITICAL] `GET /api/admin/users` 泄露所有用户邮箱

**文件**: `server/admin.js:69`

```js
db.prepare('SELECT uid, email, nickname, level, exp, power, diamonds, gold, ... FROM users ...').all()
```

`email` 字段在 SELECT 列表中明文返回给管理后台前端。任何一个有管理权限的人都能在一个 API 调用中看到所有玩家的邮箱地址。这是 PII 泄露。

**修复**: 从列表中移除 `email` 字段（管理后台不需要展示邮箱）。如需排查特定玩家，可加单独的按 UID 查询端点并记录审计日志。

### S2 [HIGH] `POST /api/admin/resource` 允许负数扣资源

**文件**: `server/admin.js:95`

```js
db.prepare('UPDATE users SET gold = gold + ?, diamonds = diamonds + ? WHERE uid = ?')
  .run(gold || 0, diamonds || 0, uid);
```

JavaScript 中 `-100 || 0` 返回 `-100`（负数也是 truthy）。管理员可以意外或恶意地将玩家资源扣成巨额负数。这会导致客户端渲染崩溃、整数下溢。

**修复**: 用 `clampInt` 替换 `|| 0`：
```js
const g = clampInt(gold || 0, 0, 1000000, 0);
const d = clampInt(diamonds || 0, 0, 100000, 0);
```

### S3 [HIGH] 竞态条件：皮肤购买可双花钻石

**文件**: `server/social.js:151-160`

余额检查 (`SELECT diamonds`) 和扣款 (`UPDATE`) 是两个独立语句，不在事务中。两个并发请求都能通过余额检查，然后各自扣款，导致玩家用 300 钻石买到两件 300 钻的皮肤（余额变 -300）。

**修复**: 用 `db.transaction()` 包裹整个购买流程。

### S4 [HIGH] 竞态条件：通行证购买同样双花

**文件**: `server/social.js:140-146`

和 S3 完全相同的 TOCTOU 漏洞。

### S5 [HIGH] 竞态条件：任务奖励可重复领取

**文件**: `server/social.js:92-108`

进度更新和完成判定不是原子操作。两个并发请求可以把进度同时推过阈值，各自发放一次奖励，然后才标记完成。

**修复**: 用单条原子 UPDATE 同时更新进度和设置完成标记。

### S6 [HIGH] `.env` 文件不在 `.gitignore` 中

**文件**: `.gitignore`

当前 gitignore 只有 `node_modules/`, `data/`, `*.png`, `/shot_*.jpg`。如果有人在项目目录创建 `.env` 文件并执行 `git add .`，包含 `JWT_SECRET`、`ADMIN_PASS` 等敏感信息的纯文本文件将被提交到仓库。这是**严重的安全隐患**。

**修复**: 在 `.gitignore` 中新增 `.env`。

### S7 [MEDIUM] 皮肤装备不验证所有权

**文件**: `server/social.js:161-166`

`POST /api/skins/equip` 接受任意 `skin_id`，不检查玩家是否拥有该皮肤。玩家可以通过 API 装备任何皮肤，包括未购买的。

**修复**: 在 UPDATE equipped=1 之前先检查 `user_skins` 表确认拥有关系。

### S8 [MEDIUM] 成就解锁无服务端门槛

**文件**: `server/social.js:116-127`

`POST /api/achievements/unlock` 完全信任客户端——只要传一个有效成就 ID 且尚未解锁，就发奖。没有任何服务端条件检查。所有成就奖励对会抓包的人来说都是免费的。

**修复**: 至少对高价值成就增加服务端计数器验证（如通关数、PVP 胜场），无法伪造。

### S9 [MEDIUM] 重放查看无权限校验

**文件**: `server/social.js:190-194`

`GET /api/replay/:id` 只检查 replay 是否存在，不检查请求者是否为参战玩家。任何登录用户可以查看任意战斗回放。

**修复**: 改为 `WHERE id=? AND (uid1=? OR uid2=?)`。

### S10 [MEDIUM] 管理员登录无爆破限速

**文件**: `server/admin.js:48`

`POST /api/admin/login` 只受全局 200/15min 限流保护。应单独加严格限流（如 5 次/15min）。

### S11 [MEDIUM] `user_saves.meta_json` 中的 guide step 未校验

**文件**: `server/activity.js:21-30`

`POST /api/guide` 将 `req.body.step` 直接用作对象 key 存入 JSON，零校验。可注入任意 key（包括超长字符串）。

### S12 [MEDIUM] `mail.rewards_json` 从未被校验为合法 JSON

**文件**: `server/admin.js:76`

`rewards_json` 原样从请求体传入，没有 `safeJsonText()` 或 `JSON.parse()` 校验。恶意管理员（或获得管理员权限的攻击者）可以向 mail 表注入非法 JSON，导致客户端解析崩溃。

### S13 [MEDIUM] 数据库缺少 13 个外键约束

**文件**: `server/db.js`

以下表缺少外键引用 `users(uid)`：`friends.uid1`, `friends.uid2`, `guild_members.uid`, `user_tasks.uid`, `user_achievements.uid`, `user_skins.uid`, `user_events.uid`, `replays.uid1`, `replays.uid2`。导致删除用户后产生孤立行，排行榜/邮件/好友/公会数据不一致。

### S14 [LOW] SQLite 缺少关键 PRAGMA

**文件**: `server/db.js`

当前只有 `journal_mode=WAL` 和 `foreign_keys=ON`。建议新增：
- `busy_timeout=5000` — 防止并发写入时 "database is locked"
- `synchronous=NORMAL` — WAL 模式下安全且快 ~2x
- `journal_size_limit=67108864` — 防止 WAL 文件无限膨胀

### S15 [LOW] `safeText` 不处理 Unicode 控制字符

**文件**: `server/util.js:10`

只处理 ASCII 控制字符（0x00-0x1F + 0x7F + `<>`）。不处理 Unicode 双向文本标记（`‮`）、零宽字符等。恶意昵称可以用 RTL override 让聊天/排行榜显示混乱。

### S16 [LOW] `clampInt` 在 Symbol 输入上崩溃

**文件**: `server/util.js:3-6`

`Number(Symbol())` 抛出 TypeError，不在 try/catch 中。如果 API 收到 `{gold: Symbol()}`，进程崩溃。

### S17 [INFO] 游戏前端"领取"按钮是假功能

**文件**: `js/product_shell.js:942-951`

邮件"领取"按钮调用 `account.readMail()`，但 `readMail` 只标记已读，不发奖。按钮写"领取"但实际只是"标为已读"，用户体验欺骗。

### S18 [INFO] 游戏内完全没有公告展示 UI

公告 API 存在（`GET /api/announcements`），但 `product_shell.js` 中没有渲染公告的 UI。玩家在游戏里看公告的唯一途径是通过帮助面板按钮，而帮助面板也不是读公告的。

### S19 [INFO] 管理后台测试覆盖为零

`test/` 目录中没有任何文件测试 `/api/admin/*` 路由。管理员认证、权限校验、邮件群发、资源发放——全部无测试。`test/social-security.js` 测试了类似的校验逻辑但跳过了 admin 端点。

---

## 第五轮新增验证清单

| # | 测试用例 | 预期结果 |
|---|---------|---------|
| 26 | `GET /api/admin/users` → 检查响应是否含 `email` | email 字段已移除 |
| 27 | `POST /api/admin/resource` 传 `{gold: -10000}` → 检查玩家余额 | 截断为 0，不扣款 |
| 28 | 并发两个 `POST /api/skins/buy` → 检查玩家钻石 | 钻石只扣一次，皮肤只买一件 |
| 29 | 并发两个 `POST /api/battlepass/buy` → 检查钻石 | 同上 |
| 30 | 并发两个 `POST /api/tasks/progress` → 检查奖励 | 奖励只发一次 |
| 31 | `POST /api/skins/equip` 传未拥有的 skin_id | 返回 403 skin not owned |
| 32 | `POST /api/achievements/unlock` 重复调同一成就 | 第二次返回 already unlocked |
| 33 | `GET /api/replay/:id` 用非参战玩家 token | 返回 404 |
| 34 | 检查 `.gitignore` | 包含 `.env` 行 |
| 35 | `POST /api/admin/login` 连续 10 次错误密码 | 第 6 次开始返回 rate_limit |

---

## 第五轮更新后的完整文件清单

| 文件 | 总改动量 | 本轮新增 |
|------|---------|---------|
| `server/db.js` | +55 行 | 外键约束 + PRAGMA(busy_timeout, synchronous, journal_size_limit) |
| `server/index.js` | ~40 行改 | mail/read 奖励截断 + checkin 事务化 |
| `server/admin.js` | ~135 行改 | email 移除；clampInt 替代 \|\| 0；rewards_json JSON 校验；登录限流 |
| `server/pvp-server.js` | +55 行改 | — |
| `server/social.js` | ~40 行改 | skins/buy 事务化；battlepass/buy 事务化；tasks/progress 原子化；skins/equip 所有权检查；replay/:id 权限校验；achievements 门槛（P1） |
| `server/activity.js` | ~5 行改 | guide step 校验 |
| `admin.html` | ~85 行改 | — |
| `js/pvp.js` | +35 行 | — |
| `js/account_client.js` | ~10 行改 | — |
| `.gitignore` | +1 行 | `.env` |

**总计: 10 个文件，约 420 行改动，0 新增依赖包。**

---

## 全部五轮审核最终汇总

| 轮次 | 方法 | 致命 | 高危 | 中危 | 低危/信息 | 本轮新增类型 |
|------|------|------|------|------|-----------|-------------|
| 第1轮 | 快速通读 4 核心文件 | 3 | 7 | 0 | 0 | 功能缺失 |
| 第2轮 | 深读 7 文件 + 交叉对照 | +3 | +2 | 0 | +4(D) | 前后端对齐 + 数据一致性 |
| 第3轮 | 客户端代码 + WS 路径 | +0 | +1(H9) | 0 | +18(对齐) | 对齐检查清单 |
| 第4轮 | 导出/导入/函数签名/上限 | +4 | +2 | 0 | +2(H11/H12) | 模块依赖 + 静默失败 |
| 第5轮 | 三 Agent 并行地毯式 | +2(S1/S6) | +4(S2-S5) | +7(S7-S13) | +7(S14-S19) | 安全漏洞 + 竞态 + PII + SQLite |

**总计: 10 致命 + 16 高危 + 7 中危 + 31 低危/信息/对齐 = 60+ 问题点**
