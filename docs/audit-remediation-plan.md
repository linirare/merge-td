# 水果突击 · 审计落地计划

> 基于 2026-07-12 全项目审计 + 2026-07-12 逐行复核修正，按优先级分阶段执行。
> 每个阶段结束后跑 `npm run check` 验证不回归。
>
> **复核修正摘要**：drawSoldier 实为 6 文件覆盖（非 4）；battle_skin.js 用函数声明断裂渲染链导致 troop_tier_mode/combat_clarity 逻辑丢失；peach_medic 三重治疗路径确认；update() 调用链 9 层全部验证；JWT_SECRET fallback 实为死代码（throw 在前）。

---

## 阶段 0：安全快修（半天，立刻做）

### 0.1 UID 熵值提升
- **文件**: `server/index.js` 第 65 行
- **改法**: `uuid.v4().replace(/-/g,'').slice(0,8)` → `uuid.v4().replace(/-/g,'').slice(0,16)`
- **影响**: 同步更新 `account_client.js` 里所有引用 UID 长度的地方

### 0.2 PvP JWT 从 URL 迁移到子协议
- **文件**: `server/pvp-server.js` 第 498 行, `js/pvp.js` 的 WebSocket 连接
- **改法**: WebSocket 构造函数不再传 `?token=xxx`，改用首条握手消息传 token
- **服务端**: `authFromUrl` → 改为从首帧消息解析 `{type:"auth", token:"..."}`

### 0.3 ~~JWT 密钥环境变量强制~~
- **复核结论: 无需修改。** `auth.js` 第 5 行 `throw new Error('JWT_SECRET is required')` 在第 8 行 fallback 前执行，`DEFAULT_JWT_SECRET` 已是死代码。服务器本身就强制要求环境变量，比原审计描述的更安全。
- **可选清理**: 删掉 `auth.js` 第 2 行 `DEFAULT_JWT_SECRET` 常量，避免代码阅读者误以为它会被使用

### 0.4 ID 生成改用 crypto
- **文件**: `server/social.js` 第 82, 203 行
- **改法**: `Math.random().toString(36).slice(2,8)` → `crypto.randomBytes(4).toString('hex')`

---

## 阶段 1：死代码清扫（半天）

### 1.1 可删除的文件

| 文件 | 原因 |
|---|---|
| `js/lane_block_fix.js` | 只有标记，功能已合并到 combat.js |
| `js/gameplay_assist.js` | 所有函数为空/已弃用 |

### 1.2 index.html 清理
- 删除上述两个 `<script>` 标签（第 128, 135 行）

### 1.3 config.js 死代码
- **文件**: `js/config.js` 第 405-418 行
- **改法**: 删除 `return` 之后的不可达代码块

### 1.4 balance_fix_v15.js 空补丁
- **文件**: `js/balance_fix_v15.js` 第 57-66 行
- **复核修正**: `patchRoleTargetingV15` 和 `patchBacklineAdvanceV15` 并非语法上的空函数体——它们设置了 `_balanceV15Patched` 标记，阻止其他层重复补丁。但其补丁逻辑已注释写明"合并到 combat.js"，属于功能存根。
- **改法**: 保留标记设置，删除注释中声称的已迁移逻辑引用。或整体评估该文件是否仍需要独立存在。
- **关联**: `combat_pacing_v19.js` 尾部还有两个真·空函数 (`patchSkillAwakenBoardVisualV19`, `patchDeckEditV19`) 和一个有效函数 (`patchRoleStanceV19` 调用 `patchMeleeTargetStanceV19`)

---

## 阶段 2：打包器引入 + 模块化（2-3 天）

### 2.1 安装 esbuild
```bash
npm install --save-dev esbuild
```

### 2.2 新建入口文件 `js/game.mjs`
把所有脚本按依赖顺序 re-export：
```js
// 核心层
import './config.js';
import './layout_v56.js';
import './version_guard.js';
import './state.js';
import './board.js';
// ... 按 index.html 原顺序
```

### 2.3 新增 build 脚本
`package.json`:
```json
"build": "esbuild js/game.mjs --bundle --minify --outfile=dist/game.min.js",
"watch": "esbuild js/game.mjs --bundle --sourcemap --outfile=dist/game.min.js --watch"
```

### 2.4 index.html 替换
把 41 个 `<script>` 标签替换为一个：
```html
<script src="dist/game.min.js?v=BUILD_TIME"></script>
```

### 2.5 验证
- `npm run check` 全部通过
- Playwright 截图对比（`node test/visual-check.mjs`）无差异

---

## 阶段 3：合并重复系统（2 天）

### 3.1 Juice 系统统一

**目标**: 合并 `js/juice.js` + `js/juice_absorb_v16.js` → `js/juice_v2.js`

**步骤**:
1. 新建 `js/juice_v2.js`，从 juice.js 的 `state.juice` 为基底
2. 把 juice_absorb_v16.js 中有价值的效果（斩击/光束/冲击波变体）合并到同一粒子池
3. 统一 `addSpark`, `addShockwave`, `addSlash`, `addBeam` 到一个函数签名
4. 把 `patchTryMergeJuice` 和 `patchMergeJuiceV16` 合并为单一 `installJuiceMergePatch()`
5. 更新 index.html：删除 juice.js + juice_absorb_v16.js，引入 juice_v2.js
6. 运行 `npm run check` 验证

### 3.2 技能系统统一

**目标**: 合并 `js/skill_system_v17.js` + `js/skill_system_v70.js` → `js/skill_system.js`

**复核发现 — peach_medic 三重治疗路径**:
1. `fruit_mechanics.js` 第 92 行 — 定义了原始 `updateFruitPassiveSkills`，含 peach_medic 治疗逻辑
2. `skill_system_v17.js` 第 142 行 — **声明式替换**（非包裹）`updateFruitPassiveSkills`，保留了相同的治疗公式
3. `skill_system_v70.js` 第 8 行 — **包裹** v17 版本，Lv5+ 时对第二目标施加独立治疗（`s._v70Timer`）
4. 两个 timer 独立计时，可以在同一帧同时触发

**步骤**:
1. 把 v70 的 15 种水果技能代码移到 v17 文件末尾
2. 删除 v70 的 `updateFruitPassiveSkills` 包裹器
3. v17 的 `updateFruitPassiveSkills` 里统一遍历所有 25 种水果
4. **修复 peach_medic**: 合并 v17 主治疗 + v70 链式治疗为单一函数，共用同一个 timer，每帧最多触发一次。链式治疗应该是主治疗的附加效果而非独立系统
5. 删掉 `._skillV70` 守卫标志
6. 更新 index.html

### 3.3 渲染层统一

**复核修正**: drawSoldier 实为 **6 个文件**参与（非 4），加载链如下：

| 加载序 | 文件 | 机制 | 作用 |
|---|---|---|---|
| 1 | `render.js:275` | 原始定义 | `function drawSoldier(s)` |
| 2 | `skin.js:300` | **声明式替换** | 完全覆盖 render.js 版 |
| 3 | `troop_tier_mode.js:170` | **包裹**（`prevDraw`） | 在 skin 版上叠加兵种名称标签 |
| 4 | `combat_clarity.js:140` | **条件包裹** | squad-mode 用 `drawCleanSoldierBody`，否则透传 |
| 5 | `battle_skin.js:241` | **声明式替换** 🔴 | **断裂点** — 覆盖了 troop_tier_mode 和 combat_clarity 的包裹，两者逻辑丢失 |
| 6 | `stickman_render_v60.js:350` | **条件替换** | 有 helper 时画火柴人，否则 fallback 到 battle_skin |

**🔴 关键问题**: `battle_skin.js` 用函数声明（非包裹）替换 `drawSoldier`，导致 `troop_tier_mode.js` 的兵种名称标签和 `combat_clarity.js` 的清洁兵体绘制**被静默丢弃**。这些功能可能已在游戏中消失而不为人知。

**同样的问题**: `skin.js` 用函数声明替换了 `render.js` 的 `draw()`，render.js 的原版绘制代码永不执行。

**目标**: 6 文件覆盖链 → 单一渲染管线

**步骤**:
1. 保留 `stickman_render_v60.js` 作为最终士兵渲染器（当前实际生效的版本）
2. 审计 `troop_tier_mode.js` 和 `combat_clarity.js` 中是否有需要恢复的功能：
   - `troop_tier_mode.js`: 兵种名称标签 — 确认是否需要，如需要则集成到 stickman 渲染
   - `combat_clarity.js`: `drawCleanSoldierBody` — 确认 squad-mode 是否仍在用
3. `battle_skin.js` 改为通过 hook 注入而非声明式替换
4. 新建 `renderHooks` 对象：
```js
window.renderHooks = {
  beforeDrawSoldier: [],   // (ctx, s) => void
  afterDrawSoldier: [],    // (ctx, s) => void
  beforeDrawBall: [],
  afterDrawBall: [],
  beforeDrawHUD: [],
  afterDrawHUD: [],
};
```
5. `stickman_render_v60.js` 的 `drawSoldier` 里：
```js
for (const hook of window.renderHooks.beforeDrawSoldier) hook(ctx, s);
// ... 火柴人绘制逻辑 ...
for (const hook of window.renderHooks.afterDrawSoldier) hook(ctx, s);
```
6. 其他文件改为注册 hook 而非覆盖函数
7. 更新 index.html，删除声明式替换的加载顺序依赖

---

## 阶段 4：猴子补丁 → Hook 系统（2-3 天）

### 4.1 建立 `js/hooks.js`

```js
// 全局 hook 注册中心
window.Hooks = {
  _hooks: {},
  on(name, fn, priority = 0) {
    if (!this._hooks[name]) this._hooks[name] = [];
    this._hooks[name].push({ fn, priority });
    this._hooks[name].sort((a, b) => b.priority - a.priority);
  },
  off(name, fn) {
    if (!this._hooks[name]) return;
    this._hooks[name] = this._hooks[name].filter(h => h.fn !== fn);
  },
  call(name, ...args) {
    if (!this._hooks[name]) return;
    for (const h of this._hooks[name]) h.fn(...args);
  },
  // 用于替换"包裹并返回修改值"模式的 hook
  reduce(name, initial, ...args) {
    if (!this._hooks[name]) return initial;
    let result = initial;
    for (const h of this._hooks[name]) {
      result = h.fn(result, ...args);
    }
    return result;
  }
};
```

### 4.2 迁移清单（复核验证后的精确数据）

**已验证的包裹链深度**:

| 函数 | 原始文件 | 实际深度 | 实际包裹文件（非标记） | 仅设标记的文件 |
|---|---|---|---|---|
| `update()` | main.js:62 | **9** | troop_tier_mode, juice, balance_fix_v15, economy_cd_fix, juice_absorb_v16, combat_pacing_v19, juice_economy, economy_balls_v62 | — |
| `updateCombat()` | combat.js:738 | **2** | fruit_mechanics | — |
| `killSoldier()` | combat.js:418 | **3** | juice_economy, economy_balls_v62 | fruit_mechanics, balance_fix_v15 |
| `attackTarget()` | combat.js:452 | **3** | juice, juice_absorb_v16 | fruit_mechanics, balance_fix_v15, combat_pacing_v19, skill_system_v17 |
| `attackWall()` | combat.js:358 | **3** | juice, juice_absorb_v16 | fruit_mechanics, combat_pacing_v19, skill_system_v17 |
| `tryMerge()` | board.js:140 | **4** | juice, juice_absorb_v16, pvp | — |
| `draw()` | render.js:555→skin.js 替换 | **4** | juice, juice_absorb_v16, experience_flow | skin.js 用声明式替换了 render.js 原版 |
| `drawSoldier()` | render.js:275→断裂链 | **2 有效** | stickman_render_v60(包裹), battle_skin(声明式替换→断裂) | troop_tier_mode, combat_clarity 因 battle_skin 断裂而丢失 |

**hitStop 短路**: juice.js 和 juice_absorb_v16.js 各自维护独立的 `state.juice.hitStop` / `state.juiceV16.hitStop`。当任一 hitStop > 0 时，对应层的 `oldUpdate(dt)` 被跳过，其下所有层不执行——这是两个独立且可能冲突的短路机制。

把以下包裹器改为 hook 注册：

| 原文件 | 包裹的函数 | Hook 名称 |
|---|---|---|
| `juice.js` | `update` | `game:update` |
| `juice_absorb_v16.js` | `update` | `game:update` (合并后) |
| `juice_economy.js` | `update` | `game:update` |
| `economy_balls_v62.js` | `update`, `actionCost`, `killSoldier` | `game:update`, `economy:actionCost`, `combat:killSoldier` |
| `economy_cd_fix.js` | `update` | `game:update` |
| `combat_pacing_v19.js` | `update` | `game:update` |
| `troop_tier_mode.js` | `update` | `game:update` |
| `experience_flow.js` | `update`, `draw` | `game:update`, `render:draw` |
| `fruit_mechanics.js` | `updateCombat`, `attackTarget`, `attackWall` | `combat:update`, `combat:attackTarget`, `combat:attackWall` |
| `status_engine_v61.js` | `updateCombat`, `attackTarget`, `killSoldier` | `combat:update`, `combat:attackTarget`, `combat:killSoldier` |
| `boss_v63.js` | `updateCombat`, `attackWall` | `combat:update`, `combat:attackWall` |
| `dynamic_difficulty_v64.js` | `updateCombat` | `combat:update` |

### 4.3 核心函数改造

`js/main.js` 的 `update()`:
```js
function update(dt) {
  // ... 自身逻辑 (SP, spawning, state) ...
  Hooks.call('game:update', dt);
  // ... 自身逻辑 (render, effects) ...
}
```

`js/combat.js` 的 `updateCombat()`:
```js
function updateCombat(dt) {
  Hooks.call('combat:beforeUpdate', dt);
  // ... 原有战斗逻辑 ...
  Hooks.call('combat:afterUpdate', dt);
}
```

### 4.4 迁移策略
- **不要一次性全部迁移** — 容易引入 bug
- 按文件名后缀顺序一个一个来：先迁移 `juice.js`，跑测试，再下一个
- 每个文件迁移后立即删除该文件并更新 index.html

---

## 阶段 5：数据库加固（1 天）

### 5.1 添加索引
**复核发现**: 数据库目前**没有任何显式索引**，仅有主键和 UNIQUE 约束隐含的索引。以下查询存在全表扫描：

| 查询 | 文件 | 影响 |
|---|---|---|
| `SELECT * FROM mail WHERE uid=?` | index.js:97 | 每用户全表扫描 mail |
| `SELECT ... FROM friends WHERE uid2=?` | social.js:30,43,49 | 复合 PK `(uid1,uid2)` 不覆盖 uid2 单独查询 |
| `SELECT ... FROM leaderboard ORDER BY power DESC` | index.js:117 | 每次排行榜请求全表扫描+排序 |
| `SELECT ... FROM replays WHERE uid1=? OR uid2=?` | social.js:194 | OR 条件无法用单列索引，需复合策略 |

**文件**: `server/db.js`，在 `createTables()` 末尾加：
```sql
CREATE INDEX IF NOT EXISTS idx_mail_uid ON mail(uid);
CREATE INDEX IF NOT EXISTS idx_mail_uid_read ON mail(uid, read_flag);
CREATE INDEX IF NOT EXISTS idx_friends_uid2 ON friends(uid2);
CREATE INDEX IF NOT EXISTS idx_friends_uid1_status ON friends(uid1, status);
CREATE INDEX IF NOT EXISTS idx_leaderboard_power ON leaderboard(power DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_stage ON leaderboard(highest_stage DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_ladder ON leaderboard(ladder_score DESC);
CREATE INDEX IF NOT EXISTS idx_replays_uid1 ON replays(uid1);
CREATE INDEX IF NOT EXISTS idx_replays_uid2 ON replays(uid2);
CREATE INDEX IF NOT EXISTS idx_replays_created ON replays(created_at);
```

### 5.2 添加数据清理
**文件**: `server/index.js`，启动时加定时任务：
```js
// 每小时清理 7 天前的回放和 30 天前的邮件
setInterval(() => {
  db.prepare('DELETE FROM replays WHERE created_at < ?').run(Date.now() - 7*86400000);
  db.prepare('DELETE FROM mail WHERE created_at < ? AND read_flag = 1').run(Date.now() - 30*86400000);
}, 3600000);
```

---

## 阶段 6：触控与无障碍（1 天）

### 6.1 Canvas 按钮热区增大
**文件**: `js/render.js` 或 `js/input.js`
- `PAUSE_RECT`: 28×26 → **44×44**
- `HELP_RECT`: 28×26 → **44×44**
- `SPEED_RECT`: 72×26 → **72×44**

### 6.2 低对比度修复
**文件**: `css/hifi_shell.css`
- 灰色按钮文字 `#d8d4c8` → `#f5f0e8`，背景 `#8f897c` → `#5c5648`
- 输入框 placeholder `#999` → `#666`
- 目标: 所有文本对比度 ≥ 4.5:1

### 6.3 Canvas 层 reduced-motion
**文件**: `js/render.js` 的 `draw()`
- 在 `window.REDUCE_MOTION` 时跳过所有粒子动画 (`state.fx`, `state.juice.*`, `state.rollings`)

---

## 阶段 7：性能收尾（半天）

### 7.1 PvP Sandbox 缓存
**文件**: `server/pvp-server.js`
- 首次 `vm.runInContext(ENGINE_CODE)` 后缓存编译结果
- 后续 `PvpBattle` 实例复用缓存

### 7.2 applySeparation 上线
**文件**: `js/combat.js`
- 当士兵 < 30 时维持 O(n²)，≥30 时加 spatial bucket 优化（当前最多48兵，暂时不急，加注释标记即可）

### 7.3 减少 shadowBlur
**文件**: `js/render.js`, `js/skin.js`
- 把 glow 效果从 `shadowBlur=12` 降到 `shadowBlur=6`
- 在低端设备检测 (`navigator.hardwareConcurrency < 4`) 时完全关闭 shadowBlur

---

## 验证清单

每个阶段完成后执行：

```bash
# 功能回归
npm run check                     # 10 项测试（⚠️ CI 只跑 test:pvp-sim + test:combat）
npm run check:full                # 完整端到端

# 视觉回归
node test/visual-check.mjs        # 8 张截图对比

# 手动验证
# 1. 打开 index.html，确认 FOUC 不闪烁
# 2. 打 3-5 关，确认合并/战斗/特效正常
# 3. 快速模式 x2 跑 1 关，确认无闪烁
# 4. PvP 建房 → 对战 → 结算
# 5. Chrome DevTools Performance 录制 10 秒，确认帧率 ≥55fps
```

### CI 修复
**文件**: `.github/workflows/deploy.yml`
- **问题**: 当前 `npm test` 仅跑 `test:pvp-sim` + `test:combat`，安全测试全部跳过
- **改法**: 改为 `npm run check`（覆盖 10 项测试）
- **注意**: `check` 包含 `test:ui-security`（需要 Playwright 浏览器），CI 环境需安装 Chromium

### .env.example 修正
**文件**: `.env.example`
- ~~**问题**: 写的是 `DB_PATH=./data/game.db`，实际代码 `server/db.js:7` 硬编码 `data/fruits.db`~~
- **复核结论: 无需修改。** `.env.example` 实际内容为 `DB_PATH=./data/fruits.db`，与代码一致。原审计此处有误。

---

## 预估总工期

| 阶段 | 内容 | 工时 | 复核后变化 |
|---|---|---|---|
| 0 | 安全快修 | 0.5 天 | 0.3 改为不需要改（JWT_SECRET 已强制） |
| 1 | 死代码清扫 | 0.5 天 | +测试 sandbox 文件同步更新 |
| 2 | 打包器 + 模块化 | 2-3 天 | — |
| 3 | 合并重复系统 | 2.5 天 | +0.5 天（渲染链断裂修复比预期复杂） |
| 4 | Hook 系统 | 2-3 天 | — |
| 5 | 数据库加固 | 1 天 | +索引数量从 6 个增加到 10 个 |
| 6 | 触控/无障碍 | 1 天 | — |
| 7 | 性能收尾 | 0.5 天 | — |
| 8 | CI + 配置修复 | 0.5 天 | 新增（deploy.yml + .env.example） |
| **合计** | | **10.5-12.5 天** | |

**建议分三輪迭代**:
- **第一轮** (3-4 天): 阶段 0→1→2→8 — 安全 + 打包 + 死代码 + 配置
- **第二轮** (5-7 天): 阶段 3→4 — 合并重复 + Hook 重构（最危险）
- **收尾** (2 天): 阶段 5→6→7

---

## 风险提示

1. **阶段 2 (打包器) 的脚本加载顺序**: 当前项目严重依赖全局变量加载顺序。打包后 IIFE 顺序可能改变。必须逐文件验证 `typeof xxx === 'function'` 守卫仍生效。已知最脆弱的是 `update()` 的 9 层包裹链——全部依赖加载顺序保证正确嵌套。

2. **阶段 4 (Hook) 是最危险的**: 猴子补丁链深达 9 层，迁移时容易遗漏副作用。**强烈建议每次只迁移一个文件并立即跑全量测试**。特别注意 `juice.js` 和 `juice_absorb_v16.js` 各自维护独立的 `hitStop` 状态——迁移时必须保证短路语义不变。

3. **阶段 3.3 (渲染层统一)**: `battle_skin.js` 用声明式替换断裂了 `drawSoldier` 的包裹链，导致 `troop_tier_mode.js` 和 `combat_clarity.js` 的绘制逻辑静默丢失。统一前需先确认这些丢失的功能是否需要恢复。**统一后必须逐帧 Playwright 截图对比，不能仅靠肉眼**。

4. **阶段 4 的 `draw()` 链**: `skin.js` 用声明式替换了 `render.js` 的 `draw()`——这是第二个声明式替换断裂点。迁移时需确认 render.js 的绘制逻辑是否已全部迁移到 skin.js。

5. **不要跳过阶段 1 (死代码清扫)**: 死代码文件虽然无外部引用（已 grep 确认），但 `lane_block_fix.js` 同时被 3 个测试 sandbox 引用（`combat-baseline.js:42`, `stage-real-sim.js:33`, `pvp-sim.js:28`）。删除时需同步更新这些测试文件。

6. **测试覆盖盲区**: `npm test`（CI 中 `deploy.yml` 执行）仅跑 `test:pvp-sim` + `test:combat`，未覆盖安全测试和社交测试。建议 CI 改用 `npm run check`。

---

## 附录：第三轮复核补充发现

### A. 先前战斗逻辑审查报告（`战斗逻辑审查报告.md`）

根目录存在一份独立的第 3 轮战斗逻辑审查报告（2026-07-12），发现 20 个问题（5🔴严重 + 7🟡中等 + 7🟠低 + 1🟢极低）。与本审计重叠的发现已省略，**本审计未覆盖**的关键发现：

| # | 问题 | 状态 |
|---|---|---|
| 🔴 问题1 | 后排单位"安全锚"指向己方城墙 → 战场中段停滞/后退，永远无法靠自己到达敌方城墙 (`combat.js:300-305`) | **疑似仍存在** |
| 🔴 问题2 | `fruitMoveSpeed` 被 `status_engine_v61.js` 覆写后丢失 78% 速度下限 → 减速单位爬行/卡住 (`status_engine_v61.js:191-205`) | **疑似仍存在** |
| 🔴 问题3 | `updateFruitPassiveSkills` + `updateRollingPumpkins` 每帧调用两次 | **已修复** — `fruit_mechanics.js:160` 注释确认"修#3"，现只透传 |

> **建议**: 将 `战斗逻辑审查报告.md` 中未修复的问题并入本计划阶段 3（合并重复系统时一并修复）。

### B. 缺失的 CSS 文件引用

**文件**: `主页FOUC闪烁问题分析.md`
- **问题**: 文档描述了三份 CSS 的激活机制，其中 `css/ui_redesign.css` 在当前项目中**不存在**。当前 `index.html` 仅引用 `css/style.css` + `css/hifi_shell.css`
- **影响**: FOUC 修复方案可能与实际部署不一致。`ui_redesign.css` 的样式可能已合并到 `hifi_shell.css`，也可能修复不完整

### C. `server/util.js`（审计遗漏文件）

- `clampInt`, `safeText`, `safeJsonText` 三个工具函数
- **代码质量: 好** — NaN/infinity 防护、控制字符剥离、JSON 有效性双重验证（`JSON.parse` 校验）
- `safeJsonText` 用 `Buffer.byteLength` 而非 `string.length` 限制大小（120KB），正确处理多字节字符
- **无问题**

### D. `server/activity.js`（审计遗漏文件）

- 活动列表（硬编码 2 个）+ 新手引导状态读写
- **代码质量: 好** — 参数化查询、authMiddleware 保护
- **无安全问题**

### E. `test/_shot.mjs`（审计遗漏文件）

- Playwright 截图工具脚本，非测试用例
- 支持两种模式: `stickman_preview.html` 截图 / 服务器页面截图
- **无需处理**

### F. `docs/battle-screen-design.md`

- 2026-07-12 的战斗屏 UI/UX 设计规范，描述了从"程序员美术"到烫金 Claymorphism 的改造方案
- 7 区布局重设计，将操作条从棋盘上方移到屏幕最底（拇指区）
- **不是审计问题，但影响阶段 3（渲染层统一）的实施方向** — 渲染重构时应参考此设计规范，避免做两次
