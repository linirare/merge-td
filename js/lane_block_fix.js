/* ============================================================
   水果突击 · Lane Block Fix
   修正攻城前缺少同路阻塞判定的问题。
   规则：同路还有可战斗敌兵时，不允许直接打墙，先拉回接战。
   ============================================================ */

(function installLaneBlockFix() {
  if (typeof updateSoldier !== 'function' || updateSoldier._laneBlockFixPatched) return;

  function sameLaneBlocker(s, enemies) {
    if (!isCombatant(s)) return null;
    let best = null;
    let bestScore = Infinity;
    for (const e of enemies) {
      if (!isCombatant(e)) continue;
      ensureLane(e);
      if (e.laneIndex !== s.laneIndex) continue;
      if (Math.abs(e.x - s.laneX) > LANE_TOLERANCE + 10) continue;

      const dy = Math.abs(e.y - s.y);
      const roleMul = typeof roleCounterMultiplier === 'function' ? roleCounterMultiplier(s.type, e.type) : 1;
      let score = dy;
      if (roleMul >= 1.32) score -= 70;
      else if (roleMul >= 1.15) score -= 32;
      if (v15Role && v15Role(s.type) === 'rush' && ['back','support','siege','control'].includes(v15Role(e.type))) score -= 55;
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

    const target = findTarget(s, enemies);
    if (target) {
      attackTarget(s, target);
      return;
    }

    if (reachedWall(s)) {
      const blocker = sameLaneBlocker(s, enemies);
      if (blocker) {
        s.target = blocker.id;
        s.mode = 'fight';
        addFx(s.x, s.y - 20, '同路有敌，先清线', THEME.info, 10);
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