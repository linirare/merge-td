# 战场兵移动问题分析与修复方案

> 对 merge-td 战斗系统的移动逻辑进行完整审计，识别导致"兵移动混乱、重叠、抖动"的根因，并提供可落地的修复方案。

---

## 1. 要解决的问题

**目标：** 让战场上的兵移动有规则——各走各路、前后排分明、攻城集中但不重叠、战斗时不抽搐。

**现状：** 
- 兵经常汇聚成一团，视觉上像"疙瘩"
- 兵在原地左右微抖动
- 同路兵在 Y 方向叠在一起
- 墙前攻城兵全部固定在同一个 Y 坐标
- 近战兵追逐目标时"瞬移"到另一路

---

## 2. 发现的问题

经完整代码审计（`js/combat.js`、`js/main.js`、`js/fruit_mechanics.js`、`js/status_engine_v61.js`、`js/skill_system_v17.js` 等），定位 3 个根因 + 3 个加剧因素：

### 根因 1：近战切路导致多路兵汇聚到同一 X 坐标

**文件：** `js/combat.js:516-519`

```js
// 当前代码：瞬间跳变
if (typeof isMeleeRoleLB === 'function' && isMeleeRoleLB(s.type) && target.laneIndex !== s.laneIndex) {
  s.laneIndex = clamp(target.laneIndex, 0, COLS - 1);
  s.laneX = laneXByIndex(s.laneIndex);
}
```

**说明：** 当一个近战兵发现目标在另一路时，`laneIndex` 和 `laneX` 瞬间跳到目标的路。第 2 路的兵跳到第 3 路，第 4 路的兵也跳到第 3 路——最终 5 路的近战兵全部汇聚到同一个 X 坐标上。

**为什么这样设计：** 原意是让近战兵能追击跨路敌人（"邻路阻塞清理"），但实现方式太粗暴——直接跳变而不是逐步过渡。

### 根因 2：FIGHT_X_LEASH=18 形成"囚笼"，分离和归位互相对抗

**文件：** `js/combat.js:17, 255, 567`

```js
const FIGHT_X_LEASH = 18;

// moveTowardEnemy: 战斗时 X 被限制在 laneX±18
const desiredX = clamp(target.x, s.laneX - FIGHT_X_LEASH, s.laneX + FIGHT_X_LEASH);

// applySeparation: 分离后 X 又被拉回
a.x = clamp(nextX, a.laneX - FIGHT_X_LEASH, a.laneX + FIGHT_X_LEASH);
```

**说明：** 战斗中的兵只能在 `36px`（18×2）宽的范围内移动。这意味着：
- `steerToLane`（归位函数）每帧把兵往 `laneX` 拉
- `applySeparation`（分离函数）每帧把兵往外推
- `FIGHT_X_LEASH` 把兵拉回 18px 内

**三个力每帧都在对抗 → 兵在原地左右微抖动，看起来像"站不稳"。**

### 根因 3：applySeparation Y 方向排斥力极弱，攻城跳过 Y

**文件：** `js/combat.js:540-573`

```js
// 跨层不处理
if (a.laneIndex !== b.laneIndex) continue;

// Y 方向仅 0.30 系数
fy += (dy / dist) * force * 0.30;

// 攻城单位跳过 Y 分离
const sieging = a.mode === 'siege' || a.mode === 'siege_queue' || a.mode === 'siege_support';
if (!sieging) a.y = clamp(a.y + fy * speed, fieldTop(), fieldBottom());
```

**说明：** 分离系统有 4 个缺陷：
1. **跨层不处理**（`laneIndex !== laneIndex` 直接跳过）—— 但根因 1 让多个近战兵跳到同层 → 这个跳过本来正确，但被根因 1 破坏
2. **分离触发距离仅 28px** —— 士兵图标半径约 10-15px，28px 才开始分离时已经明显重叠
3. **Y 方向系数仅 0.30** —— 水平还能推开，垂直几乎不动，兵在 Y 方向叠在一起
4. **攻城兵跳过 Y 分离** —— 墙前所有兵固定在 `wall.attackY`，完全重叠

### 加剧因素 4：目标评分 8 因子，分数接近时每帧跳舞

**文件：** `js/combat.js:199-251`

```js
let score = Math.abs(dy) + laneGap * (wallThreat ? 0.3 : 0.85) + dist * 0.22;
if (!sameLane) score += wallThreat ? 16 : 58;
if (!forward && dist > 52 && !wallThreat) score += 180;
if (wallThreat) score -= 200;
if (roleMul >= 1.32) score -= 86;
...
```

**说明：** 评分公式含 8 个加权因子，每帧对所有敌方重新计算。当多个目标分数接近时（例如两个同种兵一前一后），每帧选中的目标可能不同，导致兵在 A/B 目标之间反复切换——视觉上表现为"左右摇摆"。

### 加剧因素 5：X/Y 移动速度不对称

**文件：** `js/combat.js:258-263`

```js
const xStep = cspeed * 0.42 * dt_global;  // X 仅 42%
const yStep = cspeed * dt_global;          // Y 全速
```

**说明：** X 方向移动速度只有 Y 的 42%。追斜向目标时，兵 Y 方向先到位，X 方向慢慢漂。目标移动后兵走出一条"L 形路径"而不是直线。

### 加剧因素 6：攻城兵 Y 硬编码到同一坐标

**文件：** `js/combat.js:371-373`

```js
s.mode = 'siege';
const offset = (idx - (slotCount - 1) / 2) * 13;
s.x += ((s.laneX + offset) - s.x) * Math.min(1, dt_global * 8);
s.y = wall.attackY;  // 所有攻城兵 Y 设成同一个值
```

**说明：** 所有攻城兵的 Y 坐标被强制设成 `wall.attackY`。即使 X 方向做了 ±13px 的偏移，3 个前排攻城兵的 Y 完全相同——视觉上"黏在墙的一条线上"。超过 3 个的进入 `siege_queue` 也只是在 `attackY ± 16 ± row*10`，区分度很低。

---

## 3. 问题影响评估

| 问题 | 对视觉的影响 | 对玩法的影响 |
|------|-------------|-------------|
| 根因 1：切路瞬移汇聚 | 严重——多路兵挤成一团 | 中等——实际战斗力没变，但无法分辨谁在打谁 |
| 根因 2：FIGHT_X_LEASH 囚笼 | 严重——兵左右抖动 | 低——不影响伤害输出 |
| 根因 3：Y 分离力弱 | 严重——同路兵垂直重叠 | 低——不影响伤害，但范围攻击看不清覆盖 |
| 因素 4：目标跳舞 | 中等——兵摇摆 | 中等——可能被拉扯浪费移动时间 |
| 因素 5：X/Y 速度不对称 | 中等——走 L 形路径 | 低——最终能到位 |
| 因素 6：攻城 Y 固定 | 中等——墙前粘成一条线 | 低——攻城效率正常 |

---

## 4. 解决方案

### 方案 A（推荐）：低风险最小修复

只改 3 处代码，最大改善/最小改动比：

#### A1. 近战切路改为逐步过渡

**修改 `js/combat.js:516-519`：**

```js
// 改前：瞬间跳变
if (typeof isMeleeRoleLB === 'function' && isMeleeRoleLB(s.type) && target.laneIndex !== s.laneIndex) {
  s.laneIndex = clamp(target.laneIndex, 0, COLS - 1);
  s.laneX = laneXByIndex(s.laneIndex);
}

// 改后：逐步过渡
if (typeof isMeleeRoleLB === 'function' && isMeleeRoleLB(s.type) && target.laneIndex !== s.laneIndex) {
  const targetLaneX = laneXByIndex(clamp(target.laneIndex, 0, COLS - 1));
  const step = 120 * dt_global;  // 每帧最多移 120px，约 0.5 秒跨一路
  s.laneX += Math.sign(targetLaneX - s.laneX) * Math.min(Math.abs(targetLaneX - s.laneX), step);
}
```

**效果：** 兵在 0.5 秒内平滑过渡到目标路，不瞬移，不汇聚。

#### A2. FIGHT_X_LEASH 从 18→32，减少 steerToLane 归位强度

**修改 `js/combat.js:17`：**

```js
const FIGHT_X_LEASH = 32;  // 18→32，释放战斗范围到 64px
```

**修改 `js/combat.js:264`（moveTowardEnemy 内的归位强度）：**

```js
// 改前：战斗中额外归位 0.35
if (Math.abs(target.x - s.laneX) > FIGHT_X_LEASH) steerToLane(s, 0.35);

// 改后：只有在超出 leash 时才弱归位
if (Math.abs(s.x - s.laneX) > FIGHT_X_LEASH + 10) steerToLane(s, 0.15);
```

**效果：** 战斗范围从 36px 放宽到 64px，4 个兵可以自然散开。减少归位强度后 steerToLane 和 separation 不再激烈对抗，抖动消失。

#### A3. applySeparation Y 系数从 0.30→0.80，攻城兵启用 Y 分离

**修改 `js/combat.js:558, 570-571`：**

```js
// Y 系数 0.30 → 0.80
fy += (dy / dist) * force * 0.80;

// 攻城兵启用 Y 分离，但用更窄的范围
const sieging = a.mode === 'siege' || a.mode === 'siege_queue' || a.mode === 'siege_support';
if (sieging) {
  a.y = clamp(a.y + fy * speed * 0.5, wallDataFor(a).attackY - 8, wallDataFor(a).attackY + 8);
} else {
  a.y = clamp(a.y + fy * speed, fieldTop(), fieldBottom());
}
```

**效果：** Y 方向分离增强 2.7 倍，同路兵在 Y 方向自然散开。攻城兵在墙前 16px 范围内做 Y 微调，不再完全重叠。

---

### 方案 B（完整修复）：包含方案 A + 目标选择 + 攻城 Y + X/Y 速度

在方案 A 的基础上增加：

#### B4. 目标增加粘性冷却

**修改 `js/combat.js:199-206`：**

```js
// 在 findTarget 开头增加：上次选中的目标额外 -50 分，防止跳舞
if (s.target && soldierById(enemies, s.target)) {
  // 已在粘性逻辑中处理
}
// 在评分时如果 e.id === s._prevTarget，额外减 30 分
```

**效果：** 目标切换门槛提高，减少每帧跳舞。

#### B5. X/Y 移动速度对齐

**修改 `js/combat.js:258-260`：**

```js
// 改前：X 0.42
const xStep = cspeed * 0.42 * dt_global;

// 改后：X 0.75（仍比 Y 慢，方向感更自然）
const xStep = cspeed * 0.75 * dt_global;
```

**效果：** X 方向加速 78%，兵走更直的路径靠近目标。

---

### 方案对比

| 维度 | 方案 A（最小修复） | 方案 B（完整修复） |
|------|-------------------|-------------------|
| 改文件数 | 1 个（combat.js） | 1 个（combat.js） |
| 改行数 | ~10 行 | ~20 行 |
| 风险 | 低（数值调整 + 行为小改） | 中（评分逻辑改动） |
| 解决抖动 | ✅ 显著减少 | ✅ 显著减少 |
| 解决重叠 | ✅ 显著改善 | ✅ 显著改善 |
| 解决汇聚 | ✅ | ✅ |
| 解决目标跳舞 | ❌ | ✅ |
| 解决 L 形路径 | ❌ | ✅ |
| 解决攻城 Y 固定 | ✅ | ✅ |

---

## 5. 验证方法

1. **部署 5 个 watermelon_guard + 5 个 banana_raider**，观察近战兵是否汇聚到同一点
2. **部署 6 个 grape_archer**，观察后排 Y 方向是否自然散开
3. **部署 orange_cannon × 4**，观察墙前兵是否叠在一条线上
4. **目测**: 兵不再左右微抖动，移动路径更直
5. 运行 `node test/combat-baseline.js --check` 确认数值 baseline 未破坏
6. 运行 `node test/pvp-sim-unit.js` 确认 PvP 模拟测试通过
