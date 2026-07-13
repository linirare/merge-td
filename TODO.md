# 水果突击 · 项目待办清单

> 由项目审查报告整理，所有状态经 2026-07-13 实时命令验证。

---

## ✅ 已核实完成（不再关注）

| 项目 | 证据 |
|------|------|
| `.env` 文件 | `ls .env` → EXISTS |
| 新手关不覆盖阵容 | `grep` → tutorial_balance.js 已无 `meta.deck = TUTORIAL_DECK` |
| rate limiter 拆分 | authLimiter 20次/15min + apiLimiter 500次/15min |
| SIGINT 处理 | `process.on('SIGINT', gracefulShutdown)` |
| tools/ patcher 幂等 | restore_juice.js 首行即有 idempotency check |
| PvP 免费出兵漏洞 | pvp-sim.js 用 actionCost()，忽略客户端 cost |
| PvP 城墙血量首帧 | pvp.js 直接 BASE_WALL_HP |
| PvP 断线重连 | pvp.js 含 reconnect 相关代码 21 处 |
| PvP observer 限制 | 已禁用（`observers_disabled`） |
| cloneNode 事件丢失 | 已改用 createElement + replaceChild |
| pvp-sim.js async no-op | setTimeout/setInterval 覆写含 console.warn |
| 孤死文件 v60 | 已删除 |
| test/ 调试 HTML | 已移入 tools/ |
| PvP 战场黑屏 | pvp.js 已加 `classList.remove('hifi-menu')` |
| CI JWT_SECRET | deploy.yml 已配置 |
| WebSocket 分片帧 | 已有 opcode 0x0 处理 |
| computePower 公式 | 已改为求和、跳过未拥有 |
| _targetOffX 目标偏移 | combat.js:287 已实现 |
| _subLane 副航线 | combat.js:288 已实现 |
| 攻城 Y 错位 | combat.js:441 `idx%2` 错开 6px |
| PvP 聊天去重 | chat_logs DB 写入已移除 |
| activity.js 无尽挑战 | 已删除 |
| Google Fonts | index.html 已移除 |
| index.html 死桩 | 已无残留 |

---

## 🔴 待办

### 安全

- [ ] **PvP WebSocket 限制**：`server/pvp-server.js` 加 per-IP 上限(5) + 全局最大房间(200) + roomId 重试上限(100)

### 架构

- [ ] **product_shell.js**：1687 行（比审查时还多），需要拆模块
- [ ] **CSS 分工**：hifi_shell.css 611 行 vs style.css 53 行
- [ ] **SVG 图标去重**：提取为独立 `img/icons.svg`
- [ ] **数据库种子数据**：tasks=0, skins=0, events=0
- [ ] **44 个 script 标签**：仍无 bundling

### 士兵堆叠（V3 未完成部分）

- [ ] **生成偏移**：`main.js` SPAWN_SPREAD 未加大
- [ ] **分离力**：`combat.js` 无 sepDist 相关代码
- [ ] **攻城队列间距**：`combat.js` 队列 offset 未改为 22

### 果汁经济

- [ ] **城墙等级伤害系数**：`combat.js` 未实现 player-only level-based wall damage
- [ ] **被动收入**：`juice_economy.js` passiveInterval 仍为 5.0

### PvP 视觉特效（当前活跃）

- [x] `pvp.js` — snapPos 索引、环半径、addFx、attackerSide
- [ ] `render.js:drawAttackFx()` — 根据 `attackerSide` 切换攻击线颜色（金/红/白）

### 低优先级

- [ ] **account_client.js 死函数**：25/36 个未调用
- [ ] **前端性能**：render.js 渐变未缓存（fruit_skin/battle_skin 已缓存）

---

> 最后验证：2026-07-13
