# 修复验收报告

## 审查范围

对照 `admin-backend-audit-plan.md` 的计划，逐项验证 `C:\Users\win10\merge-td-new` 当前代码。

---

## ✅ 已正确修复（26 项）

### server/db.js
- ✅ `busy_timeout = 5000`
- ✅ `synchronous = NORMAL`
- ✅ `journal_size_limit = 67108864`
- ✅ `chat_logs` 表（含 source 字段、索引）
- ✅ `admin_logs` 表（含索引）
- ✅ `announcements.id` 改为 `TEXT PRIMARY KEY`（修了类型不匹配）

### server/admin.js
- ✅ 导入 `clampInt`
- ✅ 删除死代码 adminAuth v1
- ✅ 管理员登录爆破限速（5 次/15min）
- ✅ `GET /api/admin/stats` 返回 `onlineCount`
- ✅ `GET /api/admin/users` 移除 email 字段、附加 `is_online`
- ✅ `POST /api/admin/resource` clampInt 替代 `|| 0`、UID 存在性校验
- ✅ `POST /api/admin/resource-all` 新增
- ✅ `GET /api/admin/mail-log` 新增
- ✅ `POST /api/admin/mail` rewards_json JSON 合法性校验

### server/index.js
- ✅ `POST /api/chat` 写入 `chat_logs` 表
- ✅ `POST /api/mail/read` 处理 rewards_json 发放奖励 + 上限截断

### server/pvp-server.js
- ✅ `onlineUsers` Map + 导出
- ✅ `broadcastAll` 导出
- ✅ `getOnlineCount` 导出
- ✅ `disconnectClient` 清理 onlineUsers
- ✅ `attachSocket` 登记 onlineUsers
- ✅ ping 帧更新心跳
- ✅ `pushChat` 写入 chat_logs + 统一上限 200

### server/social.js
- ✅ `POST /api/battlepass/buy` 事务包裹
- ✅ `POST /api/skins/buy` 事务包裹
- ✅ `POST /api/skins/equip` 所有权检查
- ✅ `GET /api/replay/:id` 权限校验
- ✅ `POST /api/tasks/progress` 已完成检查

### admin.html
- ✅ loadDash() 调用 `/api/admin/stats`
- ✅ 在线人数从 API 取
- ✅ 假增长百分比移除
- ✅ topbar 在线人数动态化
- ✅ 用户列表显示在线/离线标签
- ✅ 资源发放 select 类型选择器接线
- ✅ 全服资源发放（UID 留空→resource-all）
- ✅ "碎片""改名卡"选项移除

### js/pvp.js
- ✅ handleServerMessage 新增 `chat`/`new_mail`/`new_announcement`/`resource_grant` 处理

### js/account_client.js
- ✅ readMail 后刷新本地 gold/diamonds

### .gitignore
- ✅ `.env` 已添加

---

## ❌ 遗漏或不对（18 项）

### 🔴 P0 — 功能仍然不工作（7 项）

| # | 问题 | 文件 | 行号 | 计划要求 | 当前状态 |
|---|------|------|------|---------|---------|
| 1 | **邮件附件不传** | admin.html | 336 | 读取三个 input 值组装 rewards_json | `rewards_json: '{}'` 硬编码，金币/钻石/碎片输入框从未读取 |
| 2 | **已发送记录表格无人填充** | admin.html | 187 | 加 loadMailLog() 调 `/api/admin/mail-log` | 后端端点已加，但前端无任何调用代码 |
| 3 | **公告生效时间未实现** | admin.html:364<br>admin.js:149<br>db.js:56-62 | 364/149/56 | 前端传 start_time/end_time，后端存，DB 加列 | 三端都没动：前端不传、后端不接、DB 无列 |
| 4 | **admin 聊天历史不查 DB** | admin.js | 133 | GET /api/admin/chat 查 chat_logs 分页 | 仍读 `chatMessages` 内存数组。重启后 chat_logs 有数据但 admin 看到空白 |
| 5 | **用户列表无分页搜索** | admin.js | 72 | `?page=&limit=&q=` 参数 | 仍是一次返回 500 条，无搜索无分页 |
| 6 | **僵尸连接不清除** | pvp-server.js | — | setInterval 每 60s 清理 90s 无心跳连接 | onlineUsers 登记了、断连清理了，但没有定时扫描。连接非正常断开（拔网线）会永远留在 onlineUsers |
| 7 | **无实时推送** | admin.js | 全局 | mail/resource/announcement 后调 broadcastAll | broadcastAll 已导出，但 admin.js 没有任何地方调用它。发邮件/资源/公告后玩家完全不知道 |

### 🟡 P1 — 前端 UI 仍假（6 项）

| # | 问题 | 文件 | 行号 | 当前状态 |
|---|------|------|------|---------|
| 8 | 分页按钮纯装饰 | admin.html | 166 | 仍是静态 `<button>1 2 3 ... 1284</button>`，无 JS 生成 |
| 9 | 搜索框无功能 | admin.html | 141 | input 没有任何事件监听 |
| 10 | "最新注册"表头错 | admin.html | 157 | 仍写 `<th>渠道</th>`，但数据是 `u.level` |
| 11 | "发邮件/发资源"按钮只弹 toast | admin.html | 321-322 | 仍只 `toast('给 xxx 发邮件')`，不跳转页面 |
| 12 | 公告 toast 假文本 | admin.html | 200 | 仍写 `toast('公告已发布,客户端将实时推送')`，实际没有推送 |
| 13 | 公告生效时间不传 | admin.html | 364 | 只发 `{title, body}`，生效时间 input 值未读 |

### 🟢 P2 — 服务端缺功能（5 项）

| # | 问题 | 文件 | 说明 |
|---|------|------|------|
| 14 | 无审计日志查看端点 | admin.js | `GET /api/admin/logs` 未实现。日志在写但没法看 |
| 15 | 无 SIGTERM 优雅关闭 | index.js | 进程被 kill 时 PvP 状态丢失、请求截断 |
| 16 | 无 unhandledRejection | index.js | 异步异常崩进程 |
| 17 | tasks/progress 奖励仍有竞态 | social.js:103-107 | SELECT progress→UPDATE completed 不在同一原子操作内 |
| 18 | 缺外键和 CHECK 约束 | db.js | friends/guild_members/user_tasks 等 13 个外键未加 |

---

## 总结

| | 数量 | 
|---|------|
| ✅ 已正确修复 | **26** |
| ❌ 遗漏/未修 | **18** |
| 🔴 其中 P0 功能仍不工作 | **7** |
| 🟡 P1 前端 UI 仍假 | **6** |
| 🟢 P2 服务端缺功能 | **5** |

**修复完成率：26/44 = 59%**

最关键的三个遗漏：
1. **邮件附件从不读取** — admin 填了金币钻石，前端不发，后端收不到
2. **没有任何实时推送** — broadcastAll 导出好了但没人调用
3. **公告生效时间三端都没动** — 前端不传、后端不接、DB 没列
