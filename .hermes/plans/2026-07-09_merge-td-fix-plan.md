# 合成塔防 v2 改善/修复计划

> 审查时间：2026-07-09
> 基准 commit：5450311

---

## P0：致命 Bug 修复

### 1. 敌方弓兵箭矢目标错误

**文件**：`js/combat.js:227`

**问题**：箭矢更新时 `const enemies = state.enemySoldiers` 写死，敌方弓兵箭矢也瞄准 `enemySoldiers`（即敌方自己人）。

**修复**：
```javascript
// 行227，改为按阵营选择目标
const enemies = p.side === 'player' ? state.enemySoldiers : state.playerSoldiers;
```

**回归风险**：低。现有逻辑只有玩家弓兵（p.side === 'player'），改动不影响当前行为。

---

### 2. `drawFx` transform 死代码

**文件**：`js/render.js:422-423`

**问题**：
```javascript
const baseY = f.vx ? f.y : (f.y - (1 - alpha) * 30);
ctx.translate(baseY === f.y ? f.x : f.x, baseY);  // 两分支都是 f.x
```

**修复**：简化为 `ctx.translate(f.x, baseY);`

---

## P1：体验重大提升

### 3. 音效系统

**新增文件**：`js/audio.js`（约80行）

**方案**：Web Audio API 生成短音效（不依赖外部文件），零依赖。

| 事件 | 音效 | 实现 |
|------|------|------|
| 合成成功 | 上升和弦 | 三角波 sweep 300→600Hz, 0.15s |
| 士兵攻击命中 | 短促敲击 | 噪声 burst 0.05s |
| 弓兵射箭 | 拉弦 | 正弦 sweep 400→200Hz, 0.1s |
| 城墙倒塌 | 低频轰鸣 | 方波 80Hz 衰减 0.5s |
| 胜利 | 胜利号角 | 三音和弦 C-E-G 依次播放 |
| 战败 | 低沉嗡鸣 | 正弦 120Hz 长衰减 |

在 `main.js` 的 `update` 中，`state.rings` 新增 `sfx` 字段标记音效类型，`draw` 循环中触发。

**改动范围**：`main.js`（2行）、新增 `js/audio.js`、`index.html`（加 script 标签）

---

### 4. 城墙后期数值崩坏

**文件**：`js/config.js`、`js/board.js`

**问题**：20关城墙 ≈160HP，Lv7弓兵 10x 基础 + 永久升级 2x = 一箭打穿。

**方案 A（推荐，改动最小）**：
- `generateLevel` 中城墙HP公式改为指数：`enemyWallHp = Math.round(60 * Math.pow(1.15, k - 1))`
  - 第1关=60 → 第10关=211 → 第20关=852 → 第30关=3354
- 兵砍墙伤害从 `s.level * 2` 改为 `s.level * 2 + s.atk * 0.1`（关联攻击力）

**方案 B**：城墙增加"伤害减免"机制——每击最低造成1伤害，但减免 `enemyWallHp * 0.02`。大后期不会秒破但也不会卡关。

**选 A**。只改 `config.js:89` 一行公式 + `combat.js:120` 一处。

---

### 5. 兵碰撞/排斥

**新增逻辑**：`js/combat.js` 加 `applySeparation()` 函数（约25行）

**方案**：对同阵营的兵施加短程排斥力（距离 < 15px 时推开），每兵每帧 O(n²) 对比。18兵上限 → 18×18=324 次/帧，性能无影响。

**改动**：`combat.js` 新增函数，`updateCombat` 末尾调用。

---

## P2：设计完善

### 6. AI 强化

**文件**：`js/ai.js`

当前AI：每4秒找最高级同类对子合成。

改进：

| 维度 | 当前 | 改进 |
|------|------|------|
| 合成策略 | 只合最高级 | 优先合克制玩家的品类（读完玩家棋盘品类分布） |
| 布局优化 | 无 | 合成后若相邻格有同品但不同级的球，尝试交换靠近 |
| CD随机 | 开局1秒 | 开局随机 0.5-2.0s，不同场次节奏不同 |

新增函数 `aiAnalyzePlayer()` 读 `state.playerSlots` 统计品类分布，返回玩家最弱的克制品类。

**改动**：`ai.js` ~30行新增，现有逻辑微调。

---

### 7. 手动强制产兵

**方案**：双击棋盘上的球 → 立即消耗 1SP（若有SP且球冷却未就绪）→ 强制产1兵 + 重置冷却。

**文件**：`js/input.js`

**实现**：在 `onDown` 中检测双击（300ms 内同球两次点击），判断 SP>0 且球未就绪，执行强制产兵。

**改动**：`input.js` ~20行，`render.js` 加一个双击提示高亮。

---

## P3：锦上添花

### 8. 重置存档按钮

**文件**：`js/ui.js`、`index.html`

在菜单面板加一个"重置数据"按钮（小字、灰色、长按确认），调用 `localStorage.removeItem(META_KEY)` + `location.reload()`。

**改动**：`index.html` +2行，`ui.js` +8行。

---

### 9. 战斗结算面板

**文件**：`js/render.js`、`js/combat.js`

胜利/失败后在结果面板显示：
- 本场击杀数
- 最高DPS兵种
- 合成次数
- 用时

在 `state` 中加统计字段，`updateCombat` 和 `tryMerge` 中累加。结果面板 `#resultDetail` 替换为结构化信息。

**改动**：`state.js` +6字段，`combat.js` +4行，`input.js` +1行，`ui.js` 改 `onGameOver` 传参。

---

### 10. 首通/三星奖励

**文件**：`js/config.js`、`js/board.js`

每关记录最佳表现（用时/城墙剩余HP），达成条件给额外金币：

| 星 | 条件 | 奖励 |
|----|------|------|
| ⭐ | 通关 | 基础奖励 |
| ⭐⭐ | 城墙HP>50% | 基础×1.5 |
| ⭐⭐⭐ | 城墙HP>80% + 用时<60s | 基础×2 |

新增 `meta.stars` 字段（`{ [level]: 3 }`），`stageReward` 根据星级计算。

**改动**：`state.js` +1字段，`ui.js` +8行，`board.js` `initLevel` 传参，`main.js` `onGameOver` 计算星级。

---

## 实施顺序

```
P0 → P1 → P2 → P3
```

| 阶段 | 内容 | 预计工作量 | 依赖 |
|------|------|-----------|------|
| **Phase 1** | Bug 修复 #1 #2 | 10分钟 | 无 |
| **Phase 2** | 音效 + 城墙上限 + 兵碰撞 | 40分钟 | Phase 1 |
| **Phase 3** | AI强化 + 手动产兵 | 30分钟 | Phase 1 |
| **Phase 4** | 重置 + 结算 + 三星 | 30分钟 | Phase 2 |

---

## 不改的

- Canvas 渲染整体架构 — 工作正常，不重构
- 克制链逻辑 — 反直觉但有策略深度，不改
- 经济公式 — 改城墙上限已缓解，不改金币曲线
- 输入/拖拽系统 — 稳定，不重构
