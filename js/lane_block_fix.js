/* ============================================================
   水果突击 · Lane Block Fix
   修正攻城前缺少同路阻塞判定的问题。
   规则：同路还有可战斗敌兵时，不允许直接打墙，先拉回接战。
   ============================================================ */

(function installLaneBlockFix() {
  if (typeof updateSoldier !== 'function' || updateSoldier._laneBlockFixPatched) return;

  function roleOfLB(type) { return (typeof TYPES === 'object' && TYPES[type] && TYPES[type].role) || ''; }
  function isMeleeRoleLB(type) { return ['tank', 'front', 'rush'].includes(roleOfLB(type)); }

  // 邻路接战收敛：近战单位锁定邻路敌人后，直接切换自身路并把 laneX 落到目标路中心；
  // 位移的“斜切滑动”交给既有的 moveTowardEnemy/steerToLane 让 s.x 平滑逼近。
  // 注意：必须一次性把 laneX 设到目标路，否则 laneX 卡在两路之间时，
  // moveTowardEnemy 往敌人推、steerToLane 往 laneX 拉，两力抵消，x 永远合不拢。
  function convergeLaneLB(s, targetLane) {
    targetLane = clamp(targetLane, 0, COLS - 1);
    if (targetLane === s.laneIndex) return;
    s.laneIndex = targetLane;
    s.laneX = laneXByIndex(targetLane);
  }

  // 找出应先清理的阻塞敌兵：同路一律纳入；邻路仅在近战贴脸(前方且近)或远程处于射程内时纳入。
  function sameLaneBlocker(s, enemies) {
    if (!isCombatant(s)) return null;
    const meleeS = isMeleeRoleLB(s.type);
    let best = null;
    let bestScore = Infinity;
    for (const e of enemies) {
      if (!isCombatant(e)) continue;
      if (typeof isInvisible === 'function' && isInvisible(e)) continue; // 隐身单位不被锁定
      ensureLane(e);
      const laneDiff = Math.abs(e.laneIndex - s.laneIndex);
      if (laneDiff > 1) continue;

      if (laneDiff === 1) {
        if (meleeS) {
          // 近战：仅当邻路敌人在前方且足够近时才考虑转线，避免来回横跳。
          if (!isForwardOf(s, e) || Math.abs(e.y - s.y) > 110) continue;
        } else {
          // 远程/攻城/辅助：只有能直接开火(在射程内)才锁邻路，且不转线，原地放。
          const distAdj = Math.hypot(e.x - s.x, e.y - s.y);
          const rng = typeof combatRange === 'function' ? combatRange(s) : 120;
          if (distAdj > rng) continue;
        }
      }

      const dy = Math.abs(e.y - s.y);
      const xGap = Math.abs(e.x - s.laneX);
      const forward = isForwardOf(s, e);
      const roleMul = typeof roleCounterMultiplier === 'function' ? roleCounterMultiplier(s.type, e.type) : 1;
      let score = dy + xGap * 0.35 + laneDiff * 42; // 强烈偏好同路：邻路仅在本路无敌兵时才会被选中
      if (forward) score -= 24;
      else if (dy > 70) score += 36;
      if (roleMul >= 1.32) score -= 70;
      else if (roleMul >= 1.15) score -= 32;
      if (typeof v15Role === 'function' && v15Role(s.type) === 'rush' && ['back','support','siege','control'].includes(v15Role(e.type))) score -= 55;
      if (score < bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  const oldUpdateSoldier = updateSoldier;
  updateSoldier = function updateSoldierLaneBlock(s, enemies) {
    if (!s.alive) return;
    ensureLane(s);

    if (!isCombatant(s)) {
      moveOutOfCastle(s);
      return;
    }

    const target = findTarget(s, enemies) || sameLaneBlocker(s, enemies);
    if (target) {
      ensureLane(target);
      if (isMeleeRoleLB(s.type) && target.laneIndex !== s.laneIndex) convergeLaneLB(s, target.laneIndex);
      s.target = target.id;
      attackTarget(s, target);
      return;
    }

    if (reachedWall(s)) {
      const blocker = sameLaneBlocker(s, enemies);
      if (blocker) {
        if (isMeleeRoleLB(s.type) && blocker.laneIndex !== s.laneIndex) convergeLaneLB(s, blocker.laneIndex);
        s.target = blocker.id;
        s.mode = 'fight';
        s._laneBlockFxCd = Math.max(0, (s._laneBlockFxCd || 0) - dt_global);
        if (s._laneBlockFxCd <= 0) {
          addFx(s.x, s.y - 20, '同路有敌，先清线', THEME.info, 10);
          s._laneBlockFxCd = 0.9;
        }
        attackTarget(s, blocker);
        return;
      }
      attackWall(s);
      return;
    }

    advanceTowardWall(s);
  };
  updateSoldier._laneBlockFixPatched = true;
})();
