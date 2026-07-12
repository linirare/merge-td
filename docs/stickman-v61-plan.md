# 战斗火柴人 v61 重设计计划

> 日期: 2026-07-12 | 基于 stickman_render_v60.js 现有实现的升级方案

---

## 一、现状分析

### 1.1 项目概览

- **技术栈**: 纯 HTML5 Canvas 2D，无框架；Node.js (Express + better-sqlite3) 后端
- **游戏类型**: 移动端竖屏合成塔防，"水果突击"(Fruit Assault)
- **战场布局**: 五段式 — 敌方棋盘 → 敌方城墙 → 战斗场地(254px) → 我方城墙 → 我方棋盘
- **单位数量**: 25 种水果单位，最大上场 14 兵

### 1.2 当前火柴人系统 (v60)

文件: `js/stickman_render_v60.js` (414 行)

**渲染流程:**
1. `installStickmanRenderV60()` IIFE 替换全局 `drawSoldier` 函数
2. 每个士兵调用 `drawStickmanShape(ctx, o)` 画几何形体
3. 头部用 `ctx.fillText(emoji, hx, hy)` 渲染水果 emoji
4. `drawStickWeapon()` 按职责画 5 种武器
5. `drawStatusFX()` 叠加冰冻/点燃/减速/眩晕/破甲视觉效果

**武器映射 (`stickWeaponForRole`):**

| 职责 | 武器 | 代表单位 |
|------|------|---------|
| tank | shield 盾 | 西瓜/椰子/草莓/牛油果 |
| front | spear 枪 | 菠萝/火龙果 |
| rush | sword 剑 | 香蕉/柠檬/橄榄 |
| back | bow 弓 | 葡萄/蓝莓/芒果/樱桃/冰梨/哈密瓜/蜜桃 |
| siege | cannon 炮 | 橙子/南瓜 |
| control/support | bow 弓 | 归入远程 |
| merge | none 无 | 奇异果/百香果 |

**现存问题:**
- 头身比固定 (rBase 始终用 level=1，scaleBody 不随等级变)
- 头部缩放线性且单调 (r * 0.74)，Lv1→Lv7 差异不够明显
- 走路动画统一 (所有兵共用同一套 STICK_KEYS)
- 投射物统一渲染为三角箭头，无武器类型区分
- 攻击特效统一 (近战=slash+spark，远程=beam+spark)

### 1.3 关键代码位置

| 文件 | 行号 | 功能 |
|------|------|------|
| `stickman_render_v60.js` | 22-27 | STICK_KEYS 4 帧走路关键帧 |
| `stickman_render_v60.js` | 36-49 | `stickWeaponForRole()` 武器映射 |
| `stickman_render_v60.js` | 93-196 | `drawStickmanShape()` 几何渲染 |
| `stickman_render_v60.js` | 198-264 | `drawStickWeapon()` 武器绘制 |
| `stickman_render_v60.js` | 328-413 | `installStickmanRenderV60()` 游戏集成 |
| `combat.js` | 487 | 投射物创建 (push 到 state.projectiles) |
| `combat.js` | 615-670 | `updateProjectiles()` 投射物移动 |
| `render.js` | 371-387 | `drawProjectiles()` 投射物渲染 |
| `juice.js` | 141-179 | `patchAttackJuice()` 攻击特效包裹 |
| `battle_skin.js` | 192-352 | 缩放/深度/血条工具函数 |
| `index.html` | 148 | v60 脚本加载 |

---

## 二、需求分析

1. **Emoji 头大小 = 等级指示器**: 等级越高 emoji 越大，一眼识别强弱
2. **头大身子小**: 极致 Q 版比例，头占主导，身体紧凑
3. **5 种兵 = 5 种特色兵器**: 盾/枪/剑/弓/炮各具视觉辨识度
4. **同兵器攻击特效一致**: 弓兵都射箭(可见箭矢路径)，炮兵都开炮
5. **箭矢路径必须可见**: A 弓兵→B 敌兵的飞行轨迹全程可见
6. **每种兵独特动效**: 走路姿态/待机动画各不相同，便于区分兵种

---

## 三、实现方案

### 3.1 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `js/stickman_render_v61.js` | **新建** | v61 火柴人渲染器，替代 v60 |
| `index.html` L148 | **修改** | 删除 v60 脚本，加载 v61 |
| `js/combat.js` L487 | **修改** | 投射物加 `weaponType` 字段 |
| `js/render.js` L371-387 | **修改** | `drawProjectiles()` 武器类型感知 |
| `js/juice.js` L141-179 | **修改** | `patchAttackJuice()` 按武器分发特效 |

### 3.2 不改动的文件

- `config.js` — 不改数值/克制矩阵
- `state.js` — 不改数据结构
- `board.js` — 不改棋盘逻辑
- `battle_skin.js` — 不改(复用其 depth/pos/HP/tierScale 工具函数)
- `status_engine_v61.js` — 不改(复用状态特效层)
- `fruit_mechanics.js` — 不改伤害公式

---

## 四、详细设计

### 4.1 等级驱动头部缩放

```js
HEAD_SCALE[Lv] = [0, 0.65, 0.78, 0.94, 1.15, 1.42, 1.75, 2.15]
BODY_SCALE[Lv] = [0, 0.10, 0.11, 0.12, 0.13, 0.14, 0.15, 0.16]

headR  = 22 × HEAD_SCALE[level] × depth × tierScale × roleScale
bodyS  = 22 × BODY_SCALE[level] × depth × tierScale × roleScale
```

**效果**: Lv1→Lv7 头直径增长 ~3.3×，身体仅增长 ~1.6×。头身比从 ~2:1 到 ~3.5:1。

### 4.2 Q 版身体比例

所有身体尺寸用 `headR` 的分数表达，随头部自动等比缩放：

| 部位 | 新公式 (占 headR 的倍数) | v60 原值 |
|------|-------------------------|---------|
| 躯干高 | `headR × 0.45` | `s × 7.6` |
| 脖子 | `headR × 0.15` | `s × 4` |
| 手臂长 | `headR × 0.55` | `s × 9` |
| 跨步幅度 | `headR × 0.50` | `s × 9.5` |
| 起伏 | `headR × 0.18` | `s × 3.6` |
| 腿粗 | `headR × 0.16` | `s × 3.4` |
| 躯干椭圆宽 | `headR × 0.22` | `s × 4.1` |
| 躯干椭圆高 | `headR × 0.30` | `s × 5.7` |

### 4.3 五种兵器重设计

兵器缩放基准: `wScale = headR × 0.45`

#### 盾 (tank — 西瓜/椰子/草莓/牛油果)
- 大圆盾在身前(dir 侧)，半径 `headR × 0.55`
- 外环粗描边(木质色) + 内盘半透明队色填充 + 中心星标
- **待机**: 盾稳持，极慢呼吸起伏
- **攻击**: 前顶 `headR × 0.25`，命中出波纹扩散

#### 枪 (front — 菠萝/火龙果)
- 长杆(木质色，长 `headR × 1.1`) + 菱形枪头(金属渐变，宽 `headR × 0.28`) + 红缨穗
- 30° 前倾持枪
- **待机**: 重心微移，枪尖轻晃
- **攻击**: 向前突刺 `headR × 0.4`，枪尖闪光直线

#### 剑 (rush — 香蕉/柠檬/橄榄)
- 弯刀形(quadraticCurveTo 弧线路径)，长 `headR × 0.85`
- 金属渐变(刃亮背暗) + 十字护手(宽 `headR × 0.15`) + 短握柄
- **待机**: 脚尖弹跳(3× 频率小幅 bob)，剑微颤
- **攻击**: 120° 横斩弧 + 2~3 条渐淡残影

#### 弓 (back/control/support — 葡萄/蓝莓/芒果/樱桃/冰梨/哈密瓜/蜜桃/辅助球)
- 反曲弓 160° 弧(半径 `headR × 0.65`)，两端回钩，弦(细线)
- 箭矢可见(杆+三角形箭头+箭羽短线)
- **待机**: 头每 2 秒 ±10° 转动，弓微旋
- **攻击**: 拉弦(`headR × 0.05→0.25`，0.15s) → 松弦 → 箭矢射出 → 弓回弹

#### 炮 (siege — 橙子/南瓜)
- 粗炮管(长 `headR × 0.9`，宽 `headR × 0.25`，圆头) + 炮口环 + 后膛方块
- 双手扛在胸高
- **待机**: 炮管独立钟摆晃动 + 沉重呼吸起伏
- **攻击**: 炮口火光爆扩(橙圆从 `headR × 0.1` → `headR × 0.35`) + 后坐 `headR × 0.12` + 2~3 团灰色烟雾上飘

### 4.4 每种兵独特动画

```js
ROLE_ANIM = {
  tank:    { strideMul:0.55, bobMul:0.70, leanAngle:0.16, armSwingMul:0.50, stepSpeed:0.035 },
  front:   { strideMul:0.75, bobMul:0.85, leanAngle:0.22, armSwingMul:0.75, stepSpeed:0.045 },
  rush:    { strideMul:1.05, bobMul:1.00, leanAngle:0.32, armSwingMul:1.10, stepSpeed:0.065 },
  back:    { strideMul:0.70, bobMul:0.65, leanAngle:0.18, armSwingMul:0.60, stepSpeed:0.038 },
  siege:   { strideMul:0.45, bobMul:1.15, leanAngle:0.20, armSwingMul:0.40, stepSpeed:0.028 },
  control: { strideMul:0.68, bobMul:0.60, leanAngle:0.15, armSwingMul:0.55, stepSpeed:0.036 },
  support: { strideMul:0.65, bobMul:0.55, leanAngle:0.14, armSwingMul:0.50, stepSpeed:0.034 },
  merge:   { strideMul:0.00, bobMul:0.30, leanAngle:0.00, armSwingMul:0.20, stepSpeed:0.000 },
};
```

走路动画直观差异:
- **坦克**: 沉重慢步，小幅跨步，大起伏
- **前排**: 稳健行军，中等一切
- **突击**: 快速小碎步，大幅前倾，手臂大摆
- **后排**: 轻盈踱步，小起伏
- **攻城**: 蹒跚负重，最小跨步，最大起伏(炮重)
- **辅助/控制**: 飘浮感，极小幅动作

### 4.5 投射物可见路径

**`combat.js` L487** — 投射物创建时加字段:
```js
weaponType: stickWeaponForRoleV61(TYPES[s.type].role) // 'bow' | 'cannon'
```

**`render.js` `drawProjectiles()`** — 按武器类型区分:

| 武器 | 弹体形状 | 拖尾 |
|------|---------|------|
| bow | 长三角形箭矢(16px) + 尾部箭羽 3 短线 | 4 个渐小渐淡圆点(间距=速度×帧时间) |
| cannon | 实心圆炮弹(半径 5px) + 光环 | 4~5 个渐大渐淡灰烟圈 |

### 4.6 攻击特效按武器分发

在 `juice.js` 的 `patchAttackJuice` 中检测 weaponType：

| 武器 | 击中特效 |
|------|---------|
| bow | 光束(射箭线) + 目标命中点针扎火花 ×4 |
| cannon | 粗光束(橙) + 爆炸火花(14 粒,半径 95) + 震波(28px) + 3 团烟雾 + 强化顿帧(0.022s) |
| sword | 扇形 3 条弧斩击 + 命中火花 |
| spear | 粗直刺线(白) + 命中星爆火花 |
| shield | 攻击者为中心的盾击冲击波 + 小火花 |

新增 `state.smokePuffs[]` 烟雾团状态: 向上飘 + 渐大 + 淡出。

---

## 五、非功能需求

### 5.1 性能

- 最多 14 兵 + ~20 投射物 + ~15 烟雾团
- 每帧额外 ~80 个 arc/路径调用
- 目标: 桌面 60fps，手机视口 30fps+
- `REDUCE_MOTION` 模式下跳过拖尾粒子、简化武器形状

### 5.2 兼容性

- 不改战斗数值、伤害公式、hitbox
- 兼容 `battle_skin.js` 的 depth/pos/HP/tierScale/roleScale 工具函数
- 兼容 `status_engine_v61.js` 的状态特效层
- 如果 v61 未加载，combat.js 和 juice.js 的 weaponType 字段有 undefined 回退

---

## 六、验证清单

- [ ] Lv1~Lv7 西瓜并列，头部大小肉眼可见差异
- [ ] Lv7 头部占全身 ~70%，Lv1 占 ~50%
- [ ] 5 种兵同屏，任意缩放级别可区分兵器
- [ ] 坦克 vs 突击并排走路，步频/幅度/前倾明显不同
- [ ] 弓兵射箭有白色拖尾 + 箭矢形状，全程可见
- [ ] 炮击=爆炸+烟团，剑斩=弧斩+残影，枪刺=白光直线，盾击=冲击波
- [ ] 25 种水果全部部署，武器分配正确
- [ ] 冰冻/点燃/减速/眩晕/破甲特效在新比例下正常显示
- [ ] 血条位置在放大后的头部上方正确
- [ ] Stage 20 满兵不卡顿
- [ ] 战斗基线不变 (combat baseline 测试通过)
