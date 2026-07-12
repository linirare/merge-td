# 前后端 API 对齐专项审计

## 审计范围

逐端点交叉对照：
- **51** 个后端路由（`server/index.js` + `server/admin.js` + `server/social.js` + `server/activity.js`）
- **36** 个 account_client.js 包装函数
- **admin.html** 全部 API 调用 + UI 元素数据来源
- **product_shell.js** 全部 account.* 调用

---

## 核心发现：account_client.js 70% 是死代码

`account_client.js` 有 36 个 API 包装函数，但 `product_shell.js`（游戏主 UI）只调用了 **11 个**。

### 实线（11 个，被游戏 UI 实际调用）

| 函数 | 对应端点 | product_shell.js 调用位置 |
|------|---------|--------------------------|
| `register()` | `POST /api/auth/register` | L904-906, L1346-1347 |
| `login()` | `POST /api/auth/login` | L904-906, L1346-1347 |
| `restoreSession()` | `GET /api/user/profile` + `GET /api/save` | L1357 |
| `loadSave()` | `GET /api/save` | 被 restoreSession 间接调用 |
| `saveToCloud()` | `POST /api/save` | L134 saveAll hook |
| `sendChat()` | `POST /api/chat` | L972 |
| `chatMessages()` | `GET /api/chat` | L963 |
| `getMail()` | `GET /api/mail` | L946 |
| `readMail()` | `POST /api/mail/read` | L949 |
| `leaderboard()` | `GET /api/leaderboard/:type` | L841 |
| `addExp()` | `POST /api/user/exp` | onGameOver hook |

### 死代码（25 个，account_client.js 有包装但 product_shell.js 从不调用）

| 函数 | 对应后端端点 | 说明 |
|------|------------|------|
| `checkin()` | `POST /api/checkin` | 签到走 localStorage，不调后端 |
| `announcements()` | `GET /api/announcements` | 游戏中无公告展示 UI |
| `reportLadder()` | `POST /api/ladder/report` | 天梯结果不走后端 |
| `friends()` | `GET /api/friends` | 无好友 UI |
| `friendRequests()` | `GET /api/friends/pending` | 无好友 UI |
| `addFriend()` | `POST /api/friends/add` | 无好友 UI |
| `acceptFriend()` | `POST /api/friends/accept` | 无好友 UI |
| `removeFriend()` | `DELETE /api/friends` | 无好友 UI |
| `guildMembers()` | `GET /api/guild/members` | 无公会 UI |
| `createGuild()` | `POST /api/guild/create` | 无公会 UI |
| `joinGuild()` | `POST /api/guild/join` | 无公会 UI |
| `tasks()` | `GET /api/tasks` | 无任务 UI |
| `taskProgress()` | `POST /api/tasks/progress` | 无任务 UI |
| `achievements()` | `GET /api/achievements` | 无成就 UI |
| `unlockAchievement()` | `POST /api/achievements/unlock` | 无成就 UI |
| `battlepass()` | `GET /api/battlepass` | 无通行证 UI |
| `bpExp()` | `POST /api/battlepass/exp` | 无通行证 UI |
| `skins()` | `GET /api/skins` | 无皮肤商店 UI |
| `mySkins()` | `GET /api/skins/my` | 无皮肤装备 UI |
| `buySkin()` | `POST /api/skins/buy` | 无皮肤商店 UI |
| `equipSkin()` | `POST /api/skins/equip` | 无皮肤装备 UI |
| `events()` | `GET /api/events` | 无活动 UI |
| `eventScore()` | `POST /api/events/score` | 无活动 UI |
| `saveReplay()` | `POST /api/replay/save` | 无回放 UI |
| `myReplays()` | `GET /api/replays` | 无回放浏览器 UI |

---

## 分类对齐清单

### 类别A：后端有 / 前端没用（8 个端点）

| # | 端点 | 文件 | 说明 |
|---|------|------|------|
| A1 | `GET /api/admin/stats` | admin.js:61 | admin.html 用 `/api/admin/users`（全量 500 条）客户端计数，stats 端点完全没人调 |
| A2 | `GET /api/activities` | activity.js:11 | account_client.js 没有 `activities()` 包装函数 |
| A3 | `GET /api/guide` | activity.js:14 | 没有包装函数 |
| A4 | `POST /api/guide` | activity.js:21 | 没有包装函数 |
| A5 | `GET /api/events/my` | social.js:170 | 有 `events()` 但没有 `myEvents()` |
| A6 | `GET /api/replay/:id` | social.js:190 | 有 `myReplays()` 但没有 `getReplay(id)` |
| A7 | `POST /api/friends/reject` | social.js:47 | 有 `acceptFriend()` 但没有 `rejectFriend()` |
| A8 | `POST /api/battlepass/buy` | social.js:140 | 有 `battlepass()` + `bpExp()` 但没有 `buyBattlepass()` |

### 类别B：前端显示 / 后端缺失（13 个假数据源）

| # | admin.html 元素 | 行号 | 实际数据来源 | 显示值 |
|---|----------------|------|-------------|--------|
| B1 | topbar 在线人数 | 143 | HTML 硬编码 | "当前 1,284 人" |
| B2 | 统计卡片-累计注册 | 150 | HTML 硬编码→JS 覆盖 | "48,203" |
| B3 | 统计卡片-今日新增 | 151 | HTML 硬编码→JS 覆盖 | "1,842" |
| B4 | 统计卡片-当前在线 | 152 | HTML 硬编码，JS 从不更新 | "1,284" |
| B5 | 统计卡片-今日流水 | 153 | HTML 硬编码，无后端 | "¥26,540" |
| B6 | 三个增长百分比 | 150-153 | HTML 硬编码 | "▲6.2% ▲12% ▲3.4%" |
| B7 | 分页按钮 | 166 | HTML 静态按钮，无 JS 事件 | "1 2 3 ... 1284" |
| B8 | "最新注册"表"渠道"列 | 157 | 无数据源（表中填的是等级） | 永远空/错 |
| B9 | "已发送记录"表格 | 187 | 无 API，无 JS，永远空 | 永远空 |
| B10 | 邮件 toast 文本 | 183 | 读的 B2 硬编码值 | "全服 48,203 名玩家" |
| B11 | 公告"生效时间"输入框 | 199 | HTML 硬编码日期 | "2026-07-12 12:00 ~ ..." |
| B12 | 统计卡片数字（HTML静态） | 150-153 | 页面加载时显示 4 秒假数据再被 JS 覆盖 | 48,203/1,842/1,284/26,540 |
| B13 | "正常"状态标签 | 317 | 永远显示"正常"，无在线/离线区分 | "正常" |

### 类别C：前端调用 / 参数不匹配（4 个）

| # | 位置 | 问题 |
|---|------|------|
| C1 | admin.html 邮件附件 | `rewards_json` 始终为 `'{}'`（第 333 行），金币/钻石/碎片三个 input 值从未被读取 |
| C2 | admin.html 资源发放 | 始终发 `{gold: amount, diamonds: 0}`（第 393 行），`<select>` 选择器完全忽略 |
| C3 | admin.html 邮件"指定 UID" | 该选项下没有 UID 输入框，`querySelector('input[placeholder*="UID"]')` 返回 null，发送必定报错 |
| C4 | `DELETE /api/friends` | account_client.js 用 body 传 `{uid}`，非标准 REST 但后端能解析 |

### 类别D：product_shell.js 本地假功能（5 个——按钮有点击反应但只操作 localStorage）

| # | 功能 | 文件位置 | 实际行为 | 应该调用 |
|---|------|---------|---------|---------|
| D1 | 签到按钮 | product_shell.js:1044-1052 | `shell.lastDaily` 判断 + localStorage 写 | `account.checkin()` |
| D2 | 商店升级包 | product_shell.js:1054-1068 | `meta.gold -= cost` 纯本地 | 后端扣款端点 |
| D3 | 抽卡(gacha) | product_shell.js:1110-1135 | `shell.gems -= cost` 全在 localStorage | 后端 gacha 端点 |
| D4 | 天梯开始 | product_shell.js:1153-1160 | `state.endless = true` 纯本地 | `account.reportLadder()` |
| D5 | 邮件"领取"按钮 | product_shell.js:949 | 调 `account.readMail()` 只标记已读，不发奖励 | 需后端处理 `rewards_json` |

### 类别E：游戏 UI 完全不存在的功能（虽然后端 + client 包装都写好了）

以下功能后端有完整 CRUD、account_client.js 有包装函数，但 product_shell.js 中没有任何渲染/入口：

| 功能 | 后端 | account_client | product_shell |
|------|------|---------------|---------------|
| 好友列表/添加/接受/拒绝/删除 | ✅ social.js | ✅ 6 个函数 | ❌ 无 UI |
| 公会创建/加入/成员列表 | ✅ social.js | ✅ 3 个函数 | ❌ 无 UI |
| 任务列表/进度 | ✅ social.js | ✅ 2 个函数 | ❌ 无 UI |
| 成就列表/解锁 | ✅ social.js | ✅ 2 个函数 | ❌ 无 UI |
| 通行证等级/经验/购买 | ✅ social.js | ✅ 2 个函数（缺 buy） | ❌ 无 UI |
| 皮肤商店/购买/装备 | ✅ social.js | ✅ 4 个函数 | ❌ 无 UI |
| 活动列表/参加/排名 | ✅ social.js | ✅ 2 个函数 | ❌ 无 UI |
| 回放保存/列表/查看 | ✅ social.js | ✅ 2 个函数（缺单条） | ❌ 无 UI |
| **公告展示** | ✅ index.js | ✅ announcements() | ❌ 无 UI（按钮打开的是帮助面板） |
| 活动中心 | ✅ activity.js | ❌ 无包装 | ❌ 无 UI |
| 新手引导 | ✅ activity.js | ❌ 无包装 | ❌ 无 UI |

---

## Admin 后台专项对齐

### admin.html 调用的后端端点（9 个）

| admin.html 调用 | 后端端点 | 参数正确？ | 响应处理正确？ |
|----------------|---------|-----------|--------------|
| adminLogin() | `POST /api/admin/login` | ✅ `{username, password}` | ✅ |
| loadDash() | `GET /api/admin/users` | ❌ 应该调 stats 端点 | ⚠️ 客户端计数 |
| loadUsers() | `GET /api/admin/users` | ❌ 缺少 page/limit/q | ⚠️ 数据全但分页搜索假 |
| 发邮件 | `POST /api/admin/mail` / `mail-all` | ❌ rewards_json 始终 {} | ⚠️ |
| loadNotices() | `GET /api/announcements` | ✅ | ✅ |
| 发公告 | `POST /api/admin/announcement` | ❌ 生效时间未传 | ⚠️ |
| 下架公告 | `DELETE /api/admin/announcement/:id` | ✅ | ✅ |
| loadChat() | `GET /api/admin/chat` | ✅ | ✅ |
| 清空聊天 | `DELETE /api/admin/chat` | ✅ | ✅ |
| 发资源 | `POST /api/admin/resource` | ❌ 忽略类型选择器 | ❌ |

### admin.html 有但后端没有的数据需求

| 需求 | 当前状态 |
|------|---------|
| 实时在线人数 | 无后端 |
| 今日流水 | 无支付系统，无后端 |
| 增长百分比 | 无计算端点 |
| 已发邮件记录 | 无 `/api/admin/mail-log` |
| 全服资源发放 | 无 `/api/admin/resource-all` |
| 审计日志查看 | 无 `/api/admin/logs` |
| 公告生效时间 | announcements 表缺少时间字段 |
| 碎片(指定英雄)发放 | 无后端支持 |
| 改名卡发放 | 道具系统不存在 |

---

## 按文件汇总需要修复的对齐问题

### server/admin.js 需新增的端点
- `GET /api/admin/mail-log` — 已发邮件记录
- `GET /api/admin/logs` — 操作审计日志  
- `POST /api/admin/resource-all` — 全服资源发放

### server/index.js 需修改
- `POST /api/mail/read` — 处理 rewards_json 发放奖励
- `POST /api/checkin` — （已存在，但前端签到应改为调此端点）
- `GET /api/announcements` — 增加时间过滤

### admin.html 需修改
- loadDash() 改为调 `GET /api/admin/stats` 而非 `/users`
- 四个 stat card 全部从 stats API 取数据
- 移除硬编码百分比
- 分页按钮改为 JS 动态生成
- "最新注册"表修正列头（"渠道"→"等级"）
- 邮件发送读取附件字段组装 rewards_json
- 资源发放读取 select 类型选择器
- 邮件"指定 UID"加 UID 输入框
- 移除"改名卡"选项
- 公告生效时间传到后端
- 用户管理"发邮件/发资源"按钮改为页面跳转

### product_shell.js 需修改（游戏侧，超 admin 范围但标注）
- 签到按钮调 `account.checkin()`
- 邮件"领取"改为真正领取奖励
- 聊天增加定时刷新或对接 WS 消息
- （后续）为公告/好友/公会等加上 UI

### js/pvp.js 需修改
- handleServerMessage 增加 chat/new_mail/new_announcement/resource_grant 处理

### js/account_client.js 需修改
- readMail 后刷新本地 diamond/gold 显示
- （后续）新增 activities/guide/events-my/replay/rejectFriend/buyBattlepass 包装函数

---

## 量化统计

| 类别 | 数量 |
|------|------|
| 后端端点总数 | 51 |
| account_client 包装函数 | 36 |
| 被游戏 UI 实际调用 | 11 (30%) |
| 死代码函数 | 25 (70%) |
| admin.html 假数据项 | 13 |
| 后端有前端没用 | 8 |
| 参数不匹配 | 4 |
| 本地假功能 | 5 |
| 游戏 UI 完全缺失的功能模块 | 11 |
| admin 后台缺失的后端端点 | 6 |
