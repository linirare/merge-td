/* ============================================================
   水果突击 · Dynamic Difficulty + Wall-HP Calibration v64 (Phase 5)
   ------------------------------------------------------------
   设计档 §9.3: 敌方属性 = 基础 × (1 + 玩家养成级 × 0.03),
   使玩家在养成提高时保持 10-17% 属性优势而不致轻松割草。
   同时把 Boss 城墙 HP 校准到设计值(140/280/450/650)。

   实现为独立层:hook spawnSoldierFromBall(敌方侧缩放) + hook initLevel
   (Boss 墙 HP 覆盖 combat_pacing 的 0.68/0.78 折扣)。
   ============================================================ */
(function installDynamicDifficultyV64() {
  const WALL_DIFFICULTY = 0.03; // 属性缩放每养成级的倍率

  /* --- 敌方属性均匀缩放(在士兵生成后) --- */
  if (typeof spawnSoldierFromBall === 'function' && !spawnSoldierFromBall._dynDiffV64) {
    const oldSpawn = spawnSoldierFromBall;
    spawnSoldierFromBall = function spawnSoldierWithScalingV64(ball, r, c, side, forced) {
      const soldier = oldSpawn(ball, r, c, side, forced);
      if (soldier && side === 'enemy' && typeof avgPlayerCultivateLv === 'function') {
        const lv = avgPlayerCultivateLv(meta);
        const mul = 1 + lv * WALL_DIFFICULTY;
        if (mul > 1) {
          soldier.atk = Math.round(soldier.atk * mul);
          soldier.hp = Math.round(soldier.hp * mul);
          soldier.maxHp = soldier.hp;
        }
      }
      return soldier;
    };
    spawnSoldierFromBall._dynDiffV64 = true;
  }

  /* --- Boss 城墙 HP 重校:覆盖 combat_pacing 的折扣,回到设计值附近 --- */
  if (typeof initLevel === 'function' && !initLevel._dynDiffV64) {
    const oldInit = initLevel;
    initLevel = function initLevelWithWallCalibrationV64(k) {
      oldInit(k);
      const lc = state.levelConfig;
      if (!lc || !lc.isBoss) return;
      // 设计 Boss 墙(§9.1):140/280/450/650 at 5/10/15/20;层间线性插值
      const designK = [5, 10, 15, 20], designHP = [140, 280, 450, 650];
      let target;
      for (let i = 0; i < designK.length; i++) {
        if (k <= designK[i]) {
          const prevK = i > 0 ? designK[i - 1] : 0, prevHP = i > 0 ? designHP[i - 1] : 0;
          target = Math.round(prevHP + (designHP[i] - prevHP) * (k - prevK) / (designK[i] - prevK));
          break;
        }
      }
      if (target === undefined) target = Math.round(650 * Math.pow(1.12, (k - 20) / 5));
      state.enemyWallHp = state.enemyWallMax = Math.max(24, target);
    };
    initLevel._dynDiffV64 = true;
  }
})();
