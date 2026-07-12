# 第二轮修复验收

对照第一轮验收的 18 项遗漏，逐项核实。

---

## ✅ 本轮修掉的（7 项）

| # | 问题 | 验证 |
|---|------|------|
| P0-1 邮件附件 | `admin.html:346-349` 读了三个 input，组装 `rewards_json` ✅ |
| P0-2 已发送记录 | `admin.html:288-295` loadMailLog() + `line 285` go() 调用 ✅ |
| P0-4 admin 聊天查 DB | `admin.js:138` 改查 chat_logs 表 ✅ |
| P0-6 僵尸连接清理 | `pvp-server.js:9-15` setInterval 90s 清理 ✅ |
| P0-7 实时推送 | `admin.js:85,98,112,126,155` 五处 broadcastAll ✅ |
| P0-3 公告生效时间(后端) | `db.js:61-62` start_time/end_time 列 + `admin.js:150,154` 读写 ✅ |
| P1-12 公告 toast | 现在真有推送了，文本不再算假 ✅ |

---

## ❌ 本轮仍没修的（9 项）

| # | 问题 | 文件:行 |
|---|------|--------|
| P0-5 用户列表分页搜索 | `admin.js:72` 仍一次 500 条，无 `?page=&limit=&q=` |
| P1-8 分页按钮 | `admin.html:166` 仍是静态 HTML |
| P1-9 搜索框 | `admin.html:141` input 仍无事件监听 |
| P1-10 "最新注册"表头 | `admin.html:157` 仍写 `<th>渠道</th>`，数据是等级 |
| P1-11 "发邮件/发资源"按钮 | `admin.html:331-332` 仍只 toast，不跳转 |
| P2-14 审计日志查看 | `GET /api/admin/logs` 仍未实现 |
| P2-15 SIGTERM | 仍未加 |
| P2-16 unhandledRejection | 仍未加 |
| P2-17 tasks 竞态 | social.js:103-107 仍有窗口 |

---

## ⚠️ 本轮修出新 bug（3 项）

| # | 问题 | 详情 |
|---|------|------|
| **N1** | `GET /api/announcements` 不按时间过滤 | `index.js:129` 仍只 `WHERE active=1`。DB 和 admin.js 都支持 start_time/end_time 了，但玩家端查询不用，等于白加 |
| **N2** | 公告 start_time 永远传不上去 | `admin.html:379` 用 `querySelector('input[placeholder*="时间"]')` 找输入框，但 HTML `line 199` 那个 input **没有 placeholder 属性**（只有 value），所以 querySelector 返回 `null`，start_time 永远是 `''` |
| **N3** | end_time 硬编码为空 | `admin.html:380` `end_time: ''` 写死。UI 只有一个文本框，无法分开传起止时间 |

---

## 总结

| | 第一轮验收 | 第二轮验收 |
|---|----------|----------|
| 总遗漏 | 18 | **12**（9 未修 + 3 新 bug） |
| 已修 | 26 | **+7 = 33** |
| 修复率 | 59% | **73%**（33/45） |

第二轮新引入的 3 个 bug 必须修，不然公告生效时间功能整个白做：
1. `admin.html:379` 改 `querySelector` 匹配方式（用 `type="text"` 或给 input 加 id）
2. `index.js:129` announcements 查询加时间过滤
3. `admin.html:380` end_time 不能硬编码
