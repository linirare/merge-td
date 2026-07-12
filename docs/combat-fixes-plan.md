# 战斗系统改造 · 交接方案

> 给正在做战斗屏的 agent。三件事都在战斗层(canvas/config/combat),**建议由你一人统一做,避免多方改战斗撞车**。
> 依据:`docs/combat-design-review.md`(sim 实测)+ `docs/battle-screen-design.md`(视觉/布局)+ 用户决定(去 boss + 拉平 + 铺满屏)。

---

## 一、去 Boss + 拉平难度 —— 已做完,待你整合进 config.js
我已在分支 **`no-boss`(commit 5282753)** 实现并验证(语法 OK、combat-baseline 绿、stage-real-sim 确认无 boss 类型、原 5/10 关 0%→100% 可胜)。**但你正改着 config.js 没提交,我没合(会冲掉你)。** 请把下面几处 apply 进你的 config.js / boss_v63.js:

**`js/boss_v63.js`**:`installBossV63()` 函数体第一行加 `return;` —— 禁用整个命名 Boss 层(不再刷 Boss 大怪/护盾/炮击/双生/召唤;代码保留可回退)。

**`js/config.js`**:
- `TUNING.bossMechanics` 整个改成 `{}`(清空)。
- 4 个原 boss 关(stageId 5/10/15/20):`type:'boss'`→`'normal'`,删掉 `bossMechanic:'...'`,墙血 **140/280/450/650 → 82/132/205/310**,敌等级微降(1.38→1.36 / 1.95→1.90 / 2.64→2.58 / 3.45→3.30)。`reward`/`unlockRules` 保留(保住解锁进度)。
- `getStageDefinition()` 里 `const boss = stageId % 5 === 0` → `const boss = false`(程序化 >20 关不再产 boss)。
- `generateLevel()` 里 `const isBossStage = def.type === ... || (stageId%5===0)` → 去掉 `|| %5`,只留 `def.type === TUNING.stageTypes.boss`(现已无 boss 类型 → 恒 false,不再加厚墙)。

> 或者你 config.js 提交完告诉我,我用 `git merge no-boss` 三方合(改动都是 boss 特定行,大概率不冲突)。你定。

---

## 二、僵局修复 —— 未做 · **这才是让游戏能通关的关键**
### 根因(代码实证 + sim)
- **胜负只在墙=0**(`combat.js:788-789`,在 update() 末尾),**无计时器 / 无平局** → 一旦僵住就是**无限局**(打不完也输不了)。
- **前线卡死**:`MAX_SOLDIERS=24`(`config.js:286`)+ `SCAN_RANGE=168`(`combat.js:12`)> 中场间距 → 兵在中路互殴,`advanceTowardWall`(`combat.js:277`)几乎不跑 → **走不到对方墙**。
- **sim 实证**:去 boss 后,第 9/11-16/18-20 关 standard bot **仍 0%**(`docs/combat-design-review.md`)。所以**去 boss ≠ 能通关,僵局是另一个病**。

### A. 加计时器 + 墙血%判胜(治"无限局")
- `state.time` 已在跟踪(`main.js:86`)。在 `combat.js:788` 的胜负判定后加一支:
  ```
  else if (state.mode !== 'pvp' && (state.time||0) >= battleTimeLimit()) {
    // 时间到:按墙血% 判胜,高者赢;相等按"进攻方伤害更多"或判守方
    const pPct = state.playerWallHp / maxPlayerWall, ePct = state.enemyWallHp / maxEnemyWall;
    win = pPct > ePct;  // 或结合 enemyWallDamageDealt
    ...onGameOver(win)
  }
  ```
- 时限:普通关 **75s**、后段(chapter 3-4)**90–110s**(可按 stageId 取)。
- **PvP 兼容**:用 `state.mode === 'pvp'`(`main.js:81`)gate 掉——PvP 有独立 `pvp-sim` 判定,别误伤。
- HUD 已有计时显示(`hud_skin` bTimer),可改成**倒计时/显示时限**,让玩家有紧迫感。

### B. 破前线卡死(让进攻真能打到墙)
- **`MAX_SOLDIERS` 24→14**(`config.js:286`)。它被 `main.js:34,127`、`input.js:95`、`juice_economy.js:323` 读,一处改全生效。兵少了→中路不淤积→缺口出现→兵能推进到墙。
- 配套:`combat_pacing_v19.js:82` 的反淤积窗口现在只在**整路清空**(`afterEnemy===0`)才触发,饱和下永不触发;兵上限降到 14 后它能正常 fire。若仍不够,放宽触发条件(如"某路我方压制且敌方<2")。
- **目标(sim 验证)**:9-20 关 standard bot 胜率 **>0**,且靠**打墙决出**而非纯 tie-break;局能在时限内结束。

### 验证
`node test/combat-baseline.js --check` 绿 · `node test/stage-real-sim.js` 看 9-20 关胜率提升 + 有超时→时限内结束 · `npm run check` 里 pvp/pvp-auth 门禁绿(确认没误伤 PvP)。

---

## 三、战斗屏视觉 / 布局 —— 见 `docs/battle-screen-design.md`
- **§2** 操作条(SP+出球)挪到屏幕最底 —— ✅ 你已实现(b44f8c9)。
- **§2.5** 【用户新要求】**canvas 铺满屏(对齐导航页)+ 响应式重排**:现在战斗是固定 480×854 letterbox、比导航页窄+留白;改成**逻辑高随设备比例、满宽无黑边**,多出的竖向空间**分给战场**。核心=把 `LAYOUT` 从固定常量改成 resize 时按 W/H 算的函数。详见文档。
- **§3** 克制可视化(交战飘 克制/优势/受制)—— ✅ 你已实现(b3c0bd2)。

---

## 协调建议
- 二、三都动战斗 canvas/config,**由你一人做最整齐**。
- 一(去 boss)已在 `no-boss` 分支跑通,你 apply 进 config.js 时**顺手就做了**(反正你在改 config)。
- 顺序建议:**先二-A(计时器,治无限局,改动最小最保险)→ 二-B(兵上限,破卡死)→ 每步跑 stage-real-sim 调参** → 再做三(铺满屏重排)。
