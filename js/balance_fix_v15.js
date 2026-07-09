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
function v15IsBackRole(s) {
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

function patchKillRewardV15() {
  if (typeof killSoldier !== 'function' || killSoldier._balanceV15Patched) return;
  killSoldier = function killSoldierV15(target, killerSide, killerAtk, killerType) {
    if (!target || !target.alive) return;
    target.alive = false;
    target.mode = 'dead';

    if (target.type === 'pumpkin_roller' && !target.rolled) {
      target.rolled = true;
      if (!state.rollings) state.rollings = [];
      state.rollings.push({
        side: target.side,
        lane: target.laneIndex,
        laneX: target.laneX,
        x: target.x,
        y: target.y,
        speed: 185 + target.level * 12,
        dmg: Math.round(target.atk * (1.45 + target.level * 0.12)),
        life: 2.2,
      });
      addFx(target.x, target.y - 20, '南瓜滚动!', '#ff7d35', 12);
    }

    state.rings.push({ x: target.x, y: target.y, r: 4, life: 0.22, maxLife: 0.22, color: '#ff4a3a' });
    addFx(target.x, target.y - 7, '击破', '#ff8a68', 10);

    if (killerSide === 'player') {
      state.kills++;
      state.killSpProgress = (state.killSpProgress || 0) + 1;
      state.killSpCd = Math.max(0, state.killSpCd || 0);
      if (state.killSpProgress >= 4 && state.killSpCd <= 0 && state.sp < getSpRecoverCap(meta)) {
        state.killSpProgress = 0;
        state.killSpCd = 3.0;
        state.sp = Math.min(state.sp + 1, getSpRecoverCap(meta), getSpMax(meta));
        addFx(target.x, target.y - 22, '+1果汁', THEME.gold, 10);
      }
      if (killerAtk > state.maxSoldierAtk) {
        state.maxSoldierAtk = killerAtk;
        state.maxSoldierType = killerType;
      }
    }
  };
  killSoldier._balanceV15Patched = true;

  if (typeof update !== 'function' || update._killSpCdV15Patched) return;
  const oldUpdate = update;
  update = function updateKillSpCdV15(dt) {
    oldUpdate(dt);
    if (state && state.killSpCd > 0) state.killSpCd = Math.max(0, state.killSpCd - dt * (state.speed || 1));
  };
  update._killSpCdV15Patched = true;
}

function patchRoleTargetingV15() {
  if (typeof findTarget !== 'function' || findTarget._balanceV15Patched) return;
  findTarget = function findTargetV15(s, enemies) {
    if (!isCombatant(s)) return null;
    ensureLane(s);

    const sticky = soldierById(enemies, s.target);
    if (sticky && canSeeTarget(s, sticky)) {
      const d = Math.sqrt(dist2(s, sticky));
      if (d <= TARGET_STICK_RANGE || v15IsBackRole(s)) return sticky;
    }

    let best = null;
    let bestScore = Infinity;
    for (const e of enemies) {
      if (!isCombatant(e)) continue;
      ensureLane(e);
      if (!canSeeTarget(s, e)) continue;

      const dx = e.x - s.x;
      const dy = e.y - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const laneGap = Math.abs(e.x - s.laneX);
      const sameLane = laneGap <= LANE_TOLERANCE;
      const forward = isForwardOf(s, e);
      const roleMul = typeof roleCounterMultiplier === 'function' ? roleCounterMultiplier(s.type, e.type) : 1;

      let score = Math.abs(dy) + laneGap * 0.85 + dist * 0.22;
      if (!sameLane) score += 58;
      if (!forward && dist > 52) score += 180;
      if (roleMul >= 1.32) score -= 86;
      else if (roleMul >= 1.15) score -= 40;
      else if (roleMul <= 0.9) score += 36;
      if (s.target && e.id === s.target) score -= 36;
      if (v15Role(s.type) === 'rush' && ['back','support','siege','control'].includes(v15Role(e.type))) score -= 70;
      if (v15Role(s.type) === 'front' && v15Role(e.type) === 'rush') score -= 70;

      if (score < bestScore) { bestScore = score; best = e; }
    }
    if (best) s.target = best.id;
    return best;
  };
  findTarget._balanceV15Patched = true;
}

function patchBacklineAdvanceV15() {
  if (typeof advanceTowardWall !== 'function' || advanceTowardWall._balanceV15Patched) return;
  advanceTowardWall = function advanceTowardWallV15(s) {
    s.target = null;
    steerToLane(s, v15IsBackRole(s) ? 0.86 : 0.55);
    const role = v15Role(s.type);

    if (v15IsBackRole(s)) {
      s.mode = 'backline';
      const front = v15FrontAlly(s.side, s.laneIndex);
      const spacing = role === 'siege' ? 78 : role === 'support' ? 70 : 58;
      if (front) {
        const desiredY = s.side === 'player' ? front.y + spacing : front.y - spacing;
        v15ClampBacklineY(s, desiredY);
      } else {
        const safeAnchor = s.side === 'player' ? fieldBottom() - 42 : fieldTop() + 42;
        const slowAdvance = s.side === 'player' ? -1 : 1;
        s.y += slowAdvance * SIEGE_SPEED * 0.28 * dt_global;
        v15ClampBacklineY(s, s.y + (safeAnchor - s.y) * 0.12);
      }
      return;
    }

    s.mode = 'march';
    if (s.side === 'player') s.y -= SIEGE_SPEED * dt_global;
    else s.y += SIEGE_SPEED * dt_global;
  };
  advanceTowardWall._balanceV15Patched = true;
}

function patchRoleDamageV15() {
  if (typeof attackTarget !== 'function' || attackTarget._balanceV15Patched) return;
  attackTarget = function attackTargetV15(s, target) {
    if (!isCombatant(s) || !isCombatant(target)) return;
    const dx = s.x - target.x;
    const dy = s.y - target.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const range = typeof fruitRange === 'function' ? fruitRange(s) : 24;

    if (v15IsBackRole(s) && dist < BOW_SAFE_MIN) kiteAsBackline(s, target);
    else if (dist > range) { moveTowardEnemy(s, target); return; }
    if (dist > range + 6) return;

    s.mode = v15IsBackRole(s) ? 'backline' : 'fight';
    s.atkTimer -= dt_global;
    if (s.atkTimer > 0) return;

    const mul = typeof roleCounterMultiplier === 'function' ? roleCounterMultiplier(s.type, target.type) : 1;
    let dmg = Math.round(s.atk * mul);
    const counterText = typeof roleCounterText === 'function' ? roleCounterText(s.type, target.type) : '';
    s.atkTimer = s.speed;

    if (v15IsBackRole(s) && s.type !== 'peach_medic') {
      playSfx('arrow');
      state.projectiles.push({
        x: s.x,
        y: s.y,
        targetX: target.x,
        targetY: target.y,
        targetId: target.id,
        dmg,
        speed: s.type === 'blueberry_sniper' ? 315 : 245,
        color: TYPES[s.type]?.color || '#ff6b4a',
        life: 1.15,
        side: s.side,
        counterHit: !!counterText && mul > 1,
        ownerType: s.type,
        slow: s.type === 'pear_frost',
        firstHit: s.firstHit,
      });
      s.firstHit = false;
      return;
    }

    playSfx('hit');
    const dealt = typeof applyFruitDamage === 'function' ? applyFruitDamage(target, dmg, s) : dmg;
    if (typeof applyFruitDamage !== 'function') {
      target.hp -= dealt;
      target.hitFlash = 0.28;
    }
    trackDamage(s, dealt, false);
    if (s.type === 'pear_frost') { target.slowTimer = 2.2 + s.level * 0.18; target.slowMul = 0.52; }
    state.attackFx.push({ x1: s.x, y1: s.y, x2: target.x, y2: target.y, life: 0.22, maxLife: 0.22 });
    const label = counterText && mul > 1 ? `${counterText} -${dealt}` : counterText === '受制' ? `受制 -${dealt}` : `-${dealt}`;
    addFx((s.x + target.x) / 2, (s.y + target.y) / 2 - 8, label, mul > 1 ? THEME.gold : THEME.accent, mul > 1 ? 13 : 11);
    s.firstHit = false;
    if (target.hp <= 0) killSoldier(target, s.side, s.atk, s.type);
  };
  attackTarget._balanceV15Patched = true;
}

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
