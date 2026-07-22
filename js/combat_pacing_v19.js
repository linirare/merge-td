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

    // Stage data is now authoritative. Do not secretly discount wall HP or slow
    // the opponent here; those late multipliers made stage strength non-obvious.
    state.enemyWallMax = Math.max(24, Math.round(state.enemyWallMax));
    state.enemyWallHp = Math.min(state.enemyWallHp, state.enemyWallMax);
    state.playerWallMax = Math.max(32, Math.round(state.playerWallMax));
    state.playerWallHp = Math.min(state.playerWallHp, state.playerWallMax);

    state.enemyBallTimer = Math.min(state.enemyBallTimer || 0, -0.6);
    // Round combat owns reinforcement timing. A legacy clear-line pause must
    // never cancel the enemy half of a newly started round.
    state._enemyReinforcePause = 0;
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

function usesRoundCombatV19() {
  return typeof state.roundPhase === 'string';
}

function patchEnemyReinforceWindowV19() {
  if (typeof spawnSoldierFromBall === 'function' && !spawnSoldierFromBall._pacingV19) {
    const oldSpawn = spawnSoldierFromBall;
    spawnSoldierFromBall = function spawnSoldierFromBallPacingV19(ball, r, c, side, forced = false) {
      if (!usesRoundCombatV19() && side === 'enemy' && (state._enemyReinforcePause || 0) > 0) return null;
      return oldSpawn(ball, r, c, side, forced);
    };
    spawnSoldierFromBall._pacingV19 = true;
  }

  if (typeof updateAI === 'function' && !updateAI._pacingV19) {
    const oldAI = updateAI;
    updateAI = function updateAIPacingV19(dt) {
      if (!usesRoundCombatV19() && (state._enemyReinforcePause || 0) > 0) return;
      oldAI(dt);
    };
    updateAI._pacingV19 = true;
  }

  if (typeof update === 'function' && !update._pacingV19) {
    const oldUpdate = update;
    update = function updatePacingV19(dt) {
      const beforeEnemy = enemyCombatantsV19();
      oldUpdate(dt);
      if (state.phase !== 'playing') return;

      if (usesRoundCombatV19()) {
        state._enemyReinforcePause = 0;
        return;
      }

      if ((state._enemyReinforcePause || 0) > 0) {
        state._enemyReinforcePause = Math.max(0, state._enemyReinforcePause - dt);
        state.enemyBallTimer = Math.min(state.enemyBallTimer || 0, -state._enemyReinforcePause);
      }

      const afterEnemy = enemyCombatantsV19();
      if (beforeEnemy > 0 && afterEnemy === 0 && playerCombatantsV19() > 0 && hasPlayerPressureV19()) {
        const windowSec = state.currentLevel <= 3 ? 2.6 : 2.2;
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
function isMeleeRoleV19(type) { return ['shell','spike','raider'].includes(roleOf(type)); }

function patchMeleeTargetStanceV19() { attackTarget._stanceV19 = true; }

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

// 本路贴墙/攻城单位计数(同侧同路,处于攻城/排队状态或已到墙)。用于协攻加成的溢出人数。
function laneAtWallCountV19(s) {
  const group = s.side === 'player' ? state.playerSoldiers : state.enemySoldiers;
  let n = 0;
  for (const u of group) {
    if (!u || !u.alive) continue;
    if (typeof isCombatant === 'function' && !isCombatant(u)) continue;
    if (u.laneIndex !== s.laneIndex) continue;
    if (['siege', 'siege_support', 'siege_queue'].includes(u.mode) || reachedWall(u)) n++;
  }
  return n;
}

function patchFullSquadWallAttackV19() { attackWall._fullSquadV19 = true; }

/* 兼容旧调用名，不做额外视觉覆盖。 */
function patchSkillAwakenBoardVisualV19() {}
function patchRoleStanceV19() { patchMeleeTargetStanceV19(); }
function patchDeckEditV19() {}
