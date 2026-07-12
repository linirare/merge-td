# 第七轮审核：数据流全链路追踪 + 环境/部署审计

## 数据流追踪（5 条关键链路，16 个断点）

### Flow 1: Admin 发邮件带奖励 → 玩家收到奖励

```
admin.html 表单 → POST /api/admin/mail → DB mail 表 → 玩家开邮件 → 点"领取" → POST /api/mail/read → 金币到账
```

| # | 断点位置 | 问题 |
|---|---------|------|
| 1 | `admin.html:333` | `rewards_json` 硬编码为 `'{}'`，表单里金币500/钻石50的输入框**从不读取** |
| 2 | `server/index.js:98` | `POST /api/mail/read` 只设 `is_read=1`，从不处理 `rewards_json`，不发奖 |
| 3 | **架构层** | 客户端显示 `meta.gold`/`shell.gems`（来自 `user_saves` 表），服务端写 `users.gold`/`users.diamonds`（来自 `users` 表）——**两个经济体从不互通**。即使服务端发了奖，玩家 UI 也不会刷新 |

**结论：邮件附件从头到尾都是假的。管理员填了附件玩家永远收不到。**

---

### Flow 2: 玩家发聊天 → 其他人看到 → 管理员看到 → 重启后仍在

```
玩家输入 → POST /api/chat → 内存数组 → GET /api/chat → 其他玩家轮询显示
                          ↘ WS pushChat → broadcastAll → pvp.js handleServerMessage → ???
```

| # | 断点位置 | 问题 |
|---|---------|------|
| 4 | `js/pvp.js:123-159` | `handleServerMessage` 不处理 `type:'chat'`——WS 广播的聊天消息被客户端丢弃 |
| 5 | `js/product_shell.js` | **整个文件零 WebSocket 引用**——游戏客户端根本没有 WS 连接来收聊天消息 |
| 6 | `server/index.js:123-131` | REST 写路径**不写 `chat_logs` 表**——只有 WS 路径写了。且重启后 `chatMessages` 数组清空，无代码从 DB 恢复 |

**结论：聊天在 REST 轮询路径勉强能跑，但 WS 实时广播完全无效，重启后 REST 和 WS 的聊天记录都丢失。**

---

### Flow 3: Admin 发资源 → 玩家实时收到

```
admin.html 表单 → POST /api/admin/resource → DB users 表 → WS 推送 → 客户端 → UI 刷新
```

| # | 断点位置 | 问题 |
|---|---------|------|
| 7 | `admin.html:389` | `// const type = p.querySelector('select')?.value`——类型选择器**被注释掉了**，永远发 `{gold, diamonds:0}` |
| 8 | `server/admin.js:92-97` | 资源发放**从不调 `broadcastAll()`**——没有任何实时推送 |
| 9 | **架构层** | 同 Flow 1：服务端写 `users` 表，客户端读 `meta`/`shell`，经济体不通 |

**结论：资源发放只有 DB 写操作生效（且类型选择器是假的），玩家不刷新页面永远看不到变化。**

---

### Flow 4: 玩家注册 → Admin 实时看到

```
POST /api/auth/register → DB → Admin 刷新 admin.html → loadDash() → 显示统计
```

| # | 断点位置 | 问题 |
|---|---------|------|
| 10 | `admin.html:143,150-153` | 4 个 stat card 中只有前 2 个被 JS 更新，**"当前在线"和"今日流水"永远是硬编码假数字** |
| 11 | `admin.html:288-303` | `loadDash()` 调 `/api/admin/users`（拉 500 条用户）客户端计数，**专用 `/api/admin/stats` 端点完全被忽略** |
| 12 | `admin.html:166` | 分页按钮是静态 HTML，0 个 JS 事件绑定 |

**结论：注册流程本身正常，但 admin 后台显示的统计数据和分页大量是假货。**

---

### Flow 5: Admin 发公告 → 玩家在游戏里看到

```
admin.html → POST /api/admin/announcement → DB → 玩家客户端 → ??? → 显示公告
```

| # | 断点位置 | 问题 |
|---|---------|------|
| 13 | `admin.html:361` | "生效时间"输入框的值**从不读取、从不传给后端** |
| 14 | `server/admin.js:111-117` | announcements 表**没有 start_time/end_time 列**，无法定时上下架 |
| 15 | `js/product_shell.js` | `account.announcements()` **从未被调用**——全文件搜索 0 匹配 |
| 16 | `js/product_shell.js:393-396` | 首页"公告"按钮有 `data-help` 属性，**点击打开的是静态帮助面板**，不是服务器公告 |

**结论：公告功能对玩家完全不可见。管理员发了公告，玩家永远看不到。这是一个完整的死链路。**

---

## 环境/部署/错误处理审计

### 部署问题

| # | 问题 | 严重度 | 位置 |
|---|------|--------|------|
| D1 | **部署工作流不配置环境变量**——`ADMIN_USER`、`ADMIN_PASS`、`ADMIN_UIDS` 必须在 Railway 仪表盘手动设，工作流不检查 | 🔴 高 | `.github/workflows/deploy.yml` |
| D2 | Railway serviceId/environmentId 硬编码——fork 后需手动改 | 🟡 中 | `deploy.yml:24` |

### 数据库健壮性

| # | 问题 | 严重度 | 位置 |
|---|------|--------|------|
| D3 | `/api/save` 三个独立 UPDATE 无事务包裹——user_saves/users/leaderboard 可能只写了一半 | 🟡 中 | `server/index.js:84-92` |
| D4 | DB 文件只读时启动直接崩溃，无优雅降级 | 🟡 中 | `server/db.js:13` |
| D5 | `busy_timeout=5000` 后两进程同时写会得 SQLITE_BUSY，无重试 | 🟢 低 | `server/db.js:16` |

### 错误处理

| # | 问题 | 严重度 | 位置 |
|---|------|--------|------|
| D6 | 无 `process.on('unhandledRejection')`——定时器/WebSocket 中的异步异常会崩进程 | 🟡 中 | `server/index.js` |
| D7 | `pvp-server.js:433` 聊天日志写入失败**静默吞没**（`try{}catch(e){}`），DB 挂了聊天悄悄丢数据 | 🟡 中 | `server/pvp-server.js` |
| D8 | `admin.js:41` 管理员认证 fallback 的 catch 完全为空 | 🟢 低 | `server/admin.js` |

### 代码卫生

| # | 问题 | 位置 |
|---|------|------|
| D9 | `util.js:4` `clampInt` 中 `try { Number(value) } catch`——`Number()` 永远不抛异常，try/catch 是死代码 | `server/util.js` |
| D10 | `auth.js:2` `DEFAULT_JWT_SECRET` 由于前面 throw 永远不可达——死代码 | `server/auth.js` |
| D11 | `safeJsonText` 对非 JSON 字符串不校验——传任意字符串都能通过 | `server/util.js:18-28` |
| D12 | `package.json` 无 `engines` 字段——但代码用了 `BigUInt64`（需 Node 12+），Node 10/11 上直接崩 | `package.json` |

### 工作树状态

工作树（ui-fixes、no-boss）是主分支的旧快照，**没有任何需要合并到主分支的修复**。主分支的 `admin.js` 功能最完整。

---

## 本轮发现的问题不在之前六轮范围内

| 新问题 | 类型 |
|--------|------|
| Flow 3 断点 9（两个经济体不互通） | **架构缺陷**——之前所有轮次都未发现 |
| Flow 5 断点 15-16（公告在游戏里完全没 UI） | **功能幽灵**——后端有、client 有包装、但 UI 不存在 |
| D2（部署不传环境变量） | **部署风险** |
| D3（save 端点无事务） | **数据完整性风险** |
| D6（无 unhandledRejection 处理） | **进程稳定性风险** |
| D7（聊天日志写入静默失败） | **静默数据丢失** |
| D9-D12（死代码/假校验） | **代码卫生** |
