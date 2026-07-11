/* ============================================================
   水果突击 · Balance Fix v15
   经济限频 / 职责克制 / 后排站位 / 战斗复盘文案收口。
   Loaded after fruit_mechanics + combat_clarity.
   ============================================================ */

(function installBalanceFixV15() {
  patchKillRewardV15();
  patchRoleTargetingV15();
  patchBacklineAdvanceV15();
  patchRoleDamageV15();
  patchBattleReportV15();
  patchProgressUnlocksV15();
})();

function v15Role(type) { return TYPES[type]?.role || ''; }
// 死亡结算时统一释放所有指向该单位的锁定,避免攻击者残留在 fight 状态
function clearTargetReferences(deadId) {
  if (!deadId) return;
  const all = [...(state.playerSoldiers || []), ...(state.enemySoldiers || [])];
  for (const u of all) if (u && u.target === deadId) u.target = null;
}function v15IsBackRole(s) {
  const role = v15Role(s?.type);
  return role === 'back' || role === 'support' || role === 'control' || role === 'siege';
}
function v15FrontAlly(side, lane) {
  const group = side === 'player' ? state.playerSoldiers : state.enemySoldiers;
  let best = null;
  for (const s of group) {
    if (!isCombatant(s) || s.laneIndex !== lane) continue;
    const role = v15Role(s.type);
    if (role === 'merge' || role === 'support' || role === 'back' || role === 'control' || role === 'siege') continue;
    if (!best) best = s;
    else if (side === 'player' ? s.y < best.y : s.y > best.y) best = s;
  }
  return best;
}
function v15ClampBacklineY(s, desiredY) {
  const top = fieldTop() + 18;
  const bottom = fieldBottom() - 18;
  s.y += (clamp(desiredY, top, bottom) - s.y) * Math.min(1, dt_global * 4.2);
}

function patchKillRewardV15() { killSoldier._balanceV15Patched = true; }

(function installKillSpCdV15() {
  if (typeof update !== 'function' || update._killSpCdV15Patched) return;
  const oldUpdate = update;
  update = function updateKillSpCdV15(dt) {
    oldUpdate(dt);
    if (state && state.killSpCd > 0) state.killSpCd = Math.max(0, state.killSpCd - dt * (state.speed || 1));
  };
  update._killSpCdV15Patched = true;
})();

function patchRoleTargetingV15() {
  // findTarget 已合并到 combat.js(含城墙防守优先逻辑),不再需要此补丁层。
  // 保留安装声明以防止重复调用,但不做任何赋值。
  if (typeof findTarget !== 'function' || findTarget._balanceV15Patched) return;
  findTarget._balanceV15Patched = true;
}

function patchBacklineAdvanceV15() {
  // advanceTowardWall 已合并到 combat.js(含后排跟随、攻速缩放),此层已移除。
  advanceTowardWall._balanceV15Patched = true;
}

function patchRoleDamageV15() { attackTarget._balanceV15Patched = true; }

function patchBattleReportV15() {
  if (typeof counterForEnemy === 'function') {
    counterForEnemy = function counterForEnemyV15(enemyType) {
      return bestCounterForEnemy(enemyType, activeDeck()) || bestCounterForEnemy(enemyType, progressUnlocked(meta));
    };
  }
  if (typeof buildBattleReport !== 'function' || buildBattleReport._balanceV15Patched) return;
  buildBattleReport = function buildBattleReportV15(win) {
    let bestType = '';
    let bestDamage = 0;
    for (const [type, dmg] of Object.entries(state.damageByType || {})) {
      if (dmg > bestDamage) { bestType = type; bestDamage = dmg; }
    }
    let dangerLane = state.breachLane;
    if (dangerLane < 0) {
      let maxD = -1;
      for (const st of state.laneStats || []) if (st.danger > maxD) { maxD = st.danger; dangerLane = st.lane; }
    }
    const enemyType = dangerLane >= 0 ? dominantEnemyType(dangerLane) : null;
    const recommendType = enemyType ? (bestCounterForEnemy(enemyType, activeDeck()) || bestCounterForEnemy(enemyType, progressUnlocked(meta))) : null;
    const tips = [];
    if (bestType) tips.push(`本局主力：${TYPES[bestType].name}，贡献约 ${Math.round(bestDamage)} 伤害`);
    if (state.enemyWallDamageDealt > 0) tips.push(`攻城伤害：${Math.round(state.enemyWallDamageDealt)}`);
    if (!win && dangerLane >= 0) tips.push(`被突破路线：第${dangerLane + 1}路`);
    if (!win && recommendType && enemyType) tips.push(`建议：补 ${TYPES[recommendType].name}，职责克制 ${TYPES[enemyType].name}`);
    if (state.merges < 2 && state.currentLevel >= 3) tips.push('建议：至少合成 2 次再进入中期交战');
    if (state.sp <= 1) tips.push('建议：保留 1～2 点果汁给高等级水果营双击救线');
    if (win && state.playerWallHp / state.playerWallMax < 0.45) tips.push('险胜：优先升级城墙或盾/枪血量');
    if (win && state.playerWallHp / state.playerWallMax > 0.75) tips.push('优势：可以优先升级主力攻击加快通关');
    return { bestType, bestDamage: Math.round(bestDamage), dangerLane, recommendType, tips };
  };
  buildBattleReport._balanceV15Patched = true;
}

function patchProgressUnlocksV15() {
  if (meta) syncProgressUnlocks(meta);
  const oldSaveMeta = typeof saveMeta === 'function' ? saveMeta : null;
  if (oldSaveMeta && !saveMeta._balanceV15Patched) {
    saveMeta = function saveMetaV15() {
      syncProgressUnlocks(meta);
      return oldSaveMeta();
    };
    saveMeta._balanceV15Patched = true;
  }
}
