# merge-td-gpt 战场 Bug 修复计划

---

## P1 — 攻速属性名写错

**问题：** `state.js:36` 用 `speed: t.rate` 存储攻速，`combat.js:387,569` 读取 `s.rate`。

属性名对不上：
- `s.rate` → `undefined`
- `s.atkTimer = s.rate` → `s.atkTimer = undefined`
- `s.atkTimer -= dt_global` → `NaN`
- `NaN > 0` → `false`
- 攻速冷却守卫 `if (s.atkTimer > 0) return;` **永远不触发**
- 结果：**士兵每帧攻击一次，约 60 次/秒**

**修复：** `state.js` `createSoldier()` 第 36 行：
```
speed: t.rate  →  rate: t.rate
```

`speed` 属性在战场上从未被读取，改名不影响其他逻辑。

---

## P1 — 羁绊铁壁护甲指数增长

**问题：** `bond_system.js:16` 在 `apply()` 中每帧执行：

```js
s.armor = Math.round((s.armor || 0) * 1.15);
```

该函数在 `updateCombat()` 中**每帧调用**，导致护甲帧累积指数增长：
- 100 护甲 → 1 帧后 115 → 60 帧后 ≈ 438,400
- 完全破坏游戏平衡

**修复：** 改为基于单位基准护甲的固定值计算（幂等）：

```js
const base = TYPES[s.type]?.armor || 0;
s.armor = base + Math.round(base * 0.15);
```

即使每帧执行，`TYPES[s.type]?.armor` 不变，结果始终一致。

---

## P1 — 自由战场 `dt_global` 未定义

**问题：** `free_battle_v2.js` 多处使用全局变量 `dt_global`：

| 行号 | 函数 | 用途 |
|------|------|------|
| 122 | `moveVector` | `step = Math.min(d, base * multiplier * tide * dt_global)` |
| 191-192 | `applySeparationFree` | `dx * dt_global, dy * dt_global` |
| 200-201 | `attackWallFree` | `dt_global` |
| 213 | `attackWallFree` | `dt_global` |

`dt_global` 在 `main.js` 中声明，如果 `free_battle_v2.js` 在 `main.js` 之前执行，或脱离主循环调用，`dt_global` 为 `undefined` → 士兵不移动、不攻击。

**修复：** 在 4 个函数入口加 guard：

```js
if (typeof dt_global === 'undefined' || dt_global == null) return;
```

---

## P2 — `combat.js` 模式切换冷却死代码

**问题：** `combat.js:677-682`：

```js
s._prevMode = s.mode;
if (enterMode && enterMode !== s.mode && s._modeCd <= 0 && s.target) {
  s._modeCd = 0.10;
}
```

两个 bug：
1. **`enterMode` 变量未声明** — 永远是 `undefined`，条件永远不成立
2. **`s._modeCd` 设置后永不递减** — 即使条件成立，`s._modeCd > 0` 永真，后续帧不会进入该分支

**修复：**
- `enterMode` → `s._prevMode`（注释说"记录当前模式供下次切换冷却检测"，意图显然是读取之前保存的模式）
- 在 `updateCombat` 的主循环（dt 帧处理）中加：
  ```js
  if (s._modeCd > 0) s._modeCd -= dt_global;
  ```

---

## P2 — PVP 测试 180 秒破墙超时

**问题：** `test/pvp-sim-unit.js:109-121`

bot 策略只使用 `orange_cannon`（每 15 帧）和 `watermelon_guard`（每 30 帧），且只用 `merge_or_swap_cell`。在 `MAX_SOLDIERS=10`、`PVP_WALL_HP=720` 的配置下，双方对称阵容形成僵局，无法在 180 秒内破墙。

**修复：** 在 bot 策略中增加：
- `urgent_dispatch` — 每 60 帧调用一次，增加出兵频率
- `commander_skill` — 能量累积到 5 时释放

---

## 实施顺序

| 顺序 | 文件 | 改动 |
|------|------|------|
| 1 | `js/state.js:36` | 攻速属性名 `speed` → `rate` |
| 2 | `js/bond_system.js:15-17` | 铁壁护甲幂等计算 |
| 3 | `js/free_battle_v2.js:122,191,200,213` | `dt_global` guard |
| 4 | `js/combat.js:677-682` | `enterMode` 修复 + `_modeCd` 递减 |
| 5 | `test/pvp-sim-unit.js:89-121` | bot 策略增强 |

---

## Verification

修复后运行以下测试全部通过：

```bash
node test/combat-baseline.js --check
node test/water-world-free-combat.js
node test/pvp-sim-unit.js
node test/wall-reachability.js
node test/stage-real-sim.js
```
