/* ============================================================
   水果突击 · Combat Pacing v19 CLEAN
   职责：战斗节奏、清线窗口、全兵种参与攻城。
   注意：不再绘制“清线完成/破墙窗口”等战场文字提示，不再追加棋盘视觉覆盖。
   ============================================================ */
(function installCombatPacingV19() {
  patchLevelPacingV19();
  patchEnemyReinforceWindowV19();
  patchMeleeTargetStanceV19();
  patchFullSquadWallAttackV19();
})();

const COMBAT_PACING_BUILD = 'combat-pacing-v19-clean';

/* ------------------------------------------------------------
   1) 城墙血量与敌方节奏：给玩家清兵后打墙窗口
   ------------------------------------------------------------ */
function patchLevelPacingV19() {
  if (typeof initLevel !== 'function' || initLevel._pacingV19) return;
  const oldInitLevel = initLevel;
  initLevel = function initLevelPacingV19(k) {
    oldInitLevel(k);

    const enemyMul = state.levelConfig?.isBoss ? 0.78 : 0.68;
    const playerMul = 0.92;
    state.enemyWallMax = Math.max(24, Math.round(state.enemyWallMax * enemyMul));
    state.enemyWallHp = Math.min(state.enemyWallHp, state.enemyWallMax);
    state.playerWallMax = Math.max(32, Math.round(state.playerWallMax * playerMul));
    state.playerWallHp = Math.min(state.playerWallHp, state.playerWallMax);

    if (state.levelConfig) {
      state.levelConfig.enemySpawnInterval = Math.max(4.8, (state.levelConfig.enemySpawnInterval || BALL_SPAWN_INTERVAL) * 1.34);
    }
    state.enemyBallTimer = Math.min(state.enemyBallTimer || 0, -1.2);
    state._enemyReinforcePause = 1.4;
    state._lastEnemyCombatantsV19 = 0;
  };
  initLevel._pacingV19 = true;
}

function enemyCombatantsV19() {
  return (state.enemySoldiers || []).filter(s => s && s.alive && typeof isCombatant === 'function' && isCombatant(s)).length;
}
function playerCombatantsV19() {
  return (state.playerSoldiers || []).filter(s => s && s.alive && typeof isCombatant === 'function' && isCombatant(s)).length;
}
function hasPlayerPressureV19() {
  return (state.playerSoldiers || []).some(s => s && s.alive && s.battleReady && s.y < LAYOUT.playerWallY - 30);
}

function patchEnemyReinforceWindowV19() {
  if (typeof spawnSoldierFromBall === 'function' && !spawnSoldierFromBall._pacingV19) {
    const oldSpawn = spawnSoldierFromBall;
    spawnSoldierFromBall = function spawnSoldierFromBallPacingV19(ball, r, c, side, forced = false) {
      if (side === 'enemy' && (state._enemyReinforcePause || 0) > 0) return null;
      return oldSpawn(ball, r, c, side, forced);
    };
    spawnSoldierFromBall._pacingV19 = true;
  }

  if (typeof updateAI === 'function' && !updateAI._pacingV19) {
    const oldAI = updateAI;
    updateAI = function updateAIPacingV19(dt) {
      if ((state._enemyReinforcePause || 0) > 0) return;
      oldAI(dt * 0.78);
    };
    updateAI._pacingV19 = true;
  }

  if (typeof update === 'function' && !update._pacingV19) {
    const oldUpdate = update;
    update = function updatePacingV19(dt) {
      const beforeEnemy = enemyCombatantsV19();
      oldUpdate(dt);
      if (state.phase !== 'playing') return;

      if ((state._enemyReinforcePause || 0) > 0) {
        state._enemyReinforcePause = Math.max(0, state._enemyReinforcePause - dt);
        state.enemyBallTimer = Math.min(state.enemyBallTimer || 0, -state._enemyReinforcePause);
      }

      const afterEnemy = enemyCombatantsV19();
      if (beforeEnemy > 0 && afterEnemy === 0 && playerCombatantsV19() > 0 && hasPlayerPressureV19()) {
        const windowSec = state.currentLevel <= 3 ? 5.0 : 4.1;
        state._enemyReinforcePause = Math.max(state._enemyReinforcePause || 0, windowSec);
        state.enemyBallTimer = Math.min(state.enemyBallTimer || 0, -windowSec);
      }
    };
    update._pacingV19 = true;
  }
}

/* ------------------------------------------------------------
   2) 近战攻击必须贴近目标；不再阻止远程/辅助/攻城单位推进到城墙
   ------------------------------------------------------------ */
function roleOfPacingV19(type) { return TYPES[type]?.role || ''; }
function isMeleeRoleV19(type) { return ['tank','front','rush'].includes(roleOfPacingV19(type)); }

function patchMeleeTargetStanceV19() {
  if (typeof attackTarget === 'function' && !attackTarget._stanceV19) {
    const oldAttackTarget = attackTarget;
    attackTarget = function attackTargetStanceV19(s, target) {
      if (s && target && isMeleeRoleV19(s.type)) {
        const d = Math.hypot(s.x - target.x, s.y - target.y);
        if (d > 30) {
          moveTowardEnemy(s, target);
          return;
        }
      }
      return oldAttackTarget(s, target);
    };
    attackTarget._stanceV19 = true;
  }
}

/* ------------------------------------------------------------
   3) 全兵种参与攻城
   旧逻辑：同路只有前排攻城位能打墙，后排排队/站桩。
   新逻辑：到达城墙后的所有兵都能输出，前排满额，后排支援输出衰减。
   ------------------------------------------------------------ */
function wallRoleDamageMulV19(s) {
  const role = TYPES[s.type]?.role || '';
  if (role === 'siege') return 1.25;
  if (role === 'back') return 0.78;
  if (role === 'support' || role === 'control') return 0.58;
  if (role === 'tank') return 0.62;
  if (role === 'rush') return 0.82;
  return 0.92;
}

function patchFullSquadWallAttackV19() {
  if (typeof attackWall !== 'function' || attackWall._fullSquadV19) return;
  const oldWall = attackWall; // = skillV17 → juice → fruit 链（含攻城倍率与橙子炮 Lv4-7 技能）

  attackWall = function attackWallFullSquadV19(s) {
    if (!isCombatant(s)) return;
    const wall = wallDataFor(s);
    const list = siegeListFor(s);
    const idx = Math.max(0, list.findIndex(u => u.id === s.id));
    const slotCount = laneSlotCount();
    s.siegeSlot = idx;

    // 前排攻城位：走完整上游链，保留攻城倍率(orange_cannon siege:2.45)与橙子炮技能。
    // 之前这里用 replace 覆盖整条链，导致橙子炮的攻城核心身份被静默吃掉。
    if (idx < slotCount) {
      oldWall(s);
      return;
    }

    // 后排支援位：v19 的新增能力——排队的兵也能输出，伤害衰减，但仍按攻城倍率计算。
    s.mode = 'siege_support';
    moveToSiegeQueue(s, idx, wall);

    s.atkTimer -= dt_global;
    if (s.atkTimer > 0) return;

    const siegeMul = Math.max(0.2, s.siege || TYPES[s.type]?.siege || 1);
    const queueMul = 0.48;
    let dmg;
    if (s.side === 'player') {
      dmg = Math.max(1, Math.round((s.level * 1.45 + s.atk * 0.105) * siegeMul * queueMul));
      state.enemyWallHp = Math.max(0, state.enemyWallHp - dmg);
      state.enemyWallDamageDealt += dmg;
      state.wallDamageByLane[s.laneIndex] = (state.wallDamageByLane[s.laneIndex] || 0) + dmg;
      trackDamage(s, dmg, true);
      if (Math.random() < 0.35) addFx(s.x, wall.wallY + wall.wallH + 4, `-${dmg}`, THEME.gold, 10);
    } else {
      dmg = Math.max(1, Math.round((s.level * 1.25 + s.atk * 0.075) * siegeMul * queueMul));
      state.playerWallHp = Math.max(0, state.playerWallHp - dmg);
      state.playerWallDamageTaken += dmg;
      state.breachLane = s.laneIndex;
      if (Math.random() < 0.30) addFx(s.x, wall.wallY - 8, `-${dmg}`, THEME.accent, 10);
    }

    state.attackFx.push({
      x1: s.x - 8,
      y1: s.y,
      x2: s.x + 8,
      y2: s.side === 'player' ? wall.wallY + 2 : wall.wallY + wall.wallH - 2,
      life: 0.18,
      maxLife: 0.18,
    });
    s.atkTimer = WALL_ATTACK_INTERVAL;
    state.shake = Math.max(state.shake || 0, 0.12);
  };
  attackWall._fullSquadV19 = true;
}

/* 兼容旧调用名，不做额外视觉覆盖。 */
function patchSkillAwakenBoardVisualV19() {}
function patchRoleStanceV19() { patchMeleeTargetStanceV19(); }
function patchDeckEditV19() {}
