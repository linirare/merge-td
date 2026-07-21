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
  const type = s?.type;
  const tags = TYPES[type]?.tags;
  if (Array.isArray(tags) && (tags.includes('back') || tags.includes('siege') || tags.includes('control') || tags.includes('support'))) return true;
  const role = v15Role(type);
  return role === 'shooter' || role === 'wildcard';
}
function v15FrontAlly(side, lane) {
  const group = side === 'player' ? state.playerSoldiers : state.enemySoldiers;
  let best = null;
  for (const s of group) {
    if (!isCombatant(s) || s.laneIndex !== lane) continue;
    const type = s.type;
    const tags = TYPES[type]?.tags;
    if (tags?.includes('merge') || tags?.includes('back') || tags?.includes('siege') || tags?.includes('control') || tags?.includes('support')) continue;
    const role = v15Role(type);
    if (role === 'wildcard' || role === 'shooter') continue;
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
    const unlocked = typeof progressUnlocked === 'function' ? progressUnlocked(meta) : activeDeck();
    const recommendType = enemyType ? (bestCounterForEnemy(enemyType, activeDeck()) || bestCounterForEnemy(enemyType, unlocked)) : null;
    const deckTypes = (activeDeck() || []).map(id => TYPES[id]).filter(Boolean);
    const hasTag = tag => deckTypes.some(t => t.tags && t.tags.includes(tag));
    const missingRoles = [];
    if (!hasTag('tank')) missingRoles.push('前排');
    if (!hasTag('back') && !hasTag('rush')) missingRoles.push('输出');
    if (!hasTag('siege')) missingRoles.push('攻城');
    if (!hasTag('control')) missingRoles.push('控制');
    if (!hasTag('support') && state.currentLevel >= 8) missingRoles.push('辅助');
    const rolePick = (role, tag) => (unlocked || []).find(id => {
      const t = TYPES[id];
      return t && (t.role === role || (t.tags && t.tags.includes(tag)));
    }) || '';
    const bossTip = ({
      shield: 'Boss机制：护盾期用攻城单位破盾，别只堆普攻。',
      artillery: 'Boss机制：炮击会惩罚中路扎堆，三路分散推进。',
      twin_pressure: 'Boss机制：双生压力会同时压两路，至少保留一支救线队。',
      summon_aura: 'Boss机制：先清召唤物，再让攻城单位压 Boss 本体。',
    })[state.levelConfig?.bossMechanic || ''];
    const tips = [];
    if (bestType) tips.push(`本局主力：${TYPES[bestType].name}，贡献约 ${Math.round(bestDamage)} 伤害`);
    if (state.enemyWallDamageDealt > 0) tips.push(`攻城伤害：${Math.round(state.enemyWallDamageDealt)}`);
    if (!win && dangerLane >= 0) tips.push(`被突破路线：第${dangerLane + 1}路`);
    if (!win && recommendType && enemyType) tips.push(`建议：补 ${TYPES[recommendType].name}，职责克制 ${TYPES[enemyType].name}`);
    if (!win && missingRoles.length) tips.push(`阵容缺口：${missingRoles.slice(0, 3).join(' / ')}${rolePick('shell', 'tank') ? `，可试 ${TYPES[rolePick('shell', 'tank')].name}` : ''}${rolePick('', 'siege') ? `、${TYPES[rolePick('', 'siege')].name}` : ''}`);
    if (!win && bossTip) tips.push(bossTip);
    if (!win && state.playerWallDamageTaken > state.enemyWallDamageDealt) tips.push('升级方向：先升前排血量和果堡，再补主力攻击。');
    else if (!win) tips.push('升级方向：优先升本局主力攻击，攻城关同步升攻城单位。');
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
      // 审计:确保 deck 卡都在 unlocked 中(旧版存档或抽卡后 unlocked 可能缺卡)
      if (Array.isArray(meta.deck) && Array.isArray(meta.unlocked)) {
        for (const id of meta.deck) {
          if (TYPES[id] && !meta.unlocked.includes(id)) meta.unlocked.push(id);
        }
      }
      syncProgressUnlocks(meta);
      const before = JSON.stringify(meta.deck);
      const r = oldSaveMeta();
      console.log('[deck] saveMeta deck:', before, '->', JSON.stringify(meta.deck));
      return r;
    };
    saveMeta._balanceV15Patched = true;
  }
}
