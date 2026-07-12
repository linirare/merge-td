/* ============================================================
   合成攻城 · Merge Siege —— 战斗系统
   设计目标：五路战线推进 + 前后排 + 锁敌 + 攻城位。
   关键规则：未走出己方城墙的兵处于保护区，不可索敌/不可被攻击。
   ============================================================ */

const SOLDIER_SPEED = 92;
const CHASE_SPEED = 82;
const SIEGE_SPEED = 104;
const FIELD_PAD = 12;
const LANE_TOLERANCE = 48;
const SCAN_RANGE = 168;
const TARGET_STICK_RANGE = 220;
const WALL_ATTACK_INTERVAL = 1.05;
const BOW_SAFE_MIN = 66;
const CROSS_LANE_EMERGENCY_RANGE = 120; // 修#6:50→120。邻路正常间距(~72px)原来看不见→径直去撞墙;放宽后邻路近敌可见
const FIGHT_X_LEASH = 32;

const ATTACK_RANGES = {
  bow: 116,
  sword: 24,
  spear: 30,
  shield: 22,
};

function combatRange(s) {
  if (typeof fruitRange === 'function') return fruitRange(s);
  const t = TYPES[s.type] || {};
  if (t.range === 'long') return 154;
  if (t.range === 'far') return 118;
  if (t.range === 'mid') return 42;
  if (t.range === 'support') return 96;
  return ATTACK_RANGES[s.type] || 24;
}

function combatIsBackline(s) {
  const role = TYPES[s.type]?.role;
  return s.type === 'bow' || role === 'back' || role === 'siege' || role === 'control' || role === 'support';
}

/* 同路/邻路阻塞清理(原 lane_block_fix.js,已合并) */
function roleOfLB(type) { return (typeof TYPES === 'object' && TYPES[type] && TYPES[type].role) || ''; }
function isMeleeRoleLB(type) { return ['tank', 'front', 'rush'].includes(roleOfLB(type)); }
function convergeLaneLB(s, targetLane) {
  targetLane = clamp(targetLane, 0, COLS - 1);
  if (targetLane === s.laneIndex) return;
  s.laneIndex = targetLane;
  s.laneX = laneXByIndex(targetLane);
}
function sameLaneBlocker(s, enemies) {
  if (!isCombatant(s)) return null;
  const meleeS = isMeleeRoleLB(s.type);
  let best = null; let bestScore = Infinity;
  for (const e of enemies) {
    if (!isCombatant(e)) continue;
    if (typeof isInvisible === 'function' && isInvisible(e)) continue;
    ensureLane(e);
    const laneDiff = Math.abs(e.laneIndex - s.laneIndex);
    if (laneDiff > 2) continue; // 修#7:±1→±2,配合 #6 让邻路/隔一路的敌兵也能被兜底索敌
    if (laneDiff >= 1) {
      if (meleeS) { if (!isForwardOf(s, e) || Math.abs(e.y - s.y) > 110) continue; }
      else { const distAdj = Math.hypot(e.x - s.x, e.y - s.y); const rng = typeof combatRange === 'function' ? combatRange(s) : 120; if (distAdj > rng) continue; }
    }
    const dy = Math.abs(e.y - s.y), xGap = Math.abs(e.x - s.laneX);
    const forward = isForwardOf(s, e);
    const roleMul = typeof roleCounterMultiplier === 'function' ? roleCounterMultiplier(s.type, e.type) : 1;
    let score = dy + xGap * 0.35 + laneDiff * 42;
    if (forward) score -= 24; else if (dy > 70) score += 36;
    if (roleMul >= 1.32) score -= 70; else if (roleMul >= 1.15) score -= 32;
    if (typeof v15Role === 'function' && v15Role(s.type) === 'rush' && ['back','support','siege','control'].includes(v15Role(e.type))) score -= 55;
    if (score < bestScore) { bestScore = score; best = e; }
  }
  return best;
}

function fieldTop() { return LAYOUT.fieldY + FIELD_PAD; }
function fieldBottom() { return LAYOUT.fieldY + LAYOUT.fieldH - FIELD_PAD; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function laneSlotCount() { return typeof SIEGE_SLOTS_PER_LANE === 'number' ? SIEGE_SLOTS_PER_LANE : 3; }

function laneXByIndex(i) {
  const col = clamp(i ?? 2, 0, COLS - 1);
  return BOARD_X + col * (CELL + GAP) + CELL / 2;
}

function nearestLaneIndex(x) {
  let best = 0, bestDist = Infinity;
  for (let c = 0; c < COLS; c++) {
    const lx = laneXByIndex(c);
    const d = Math.abs(x - lx);
    if (d < bestDist) { best = c; bestDist = d; }
  }
  return best;
}

function ensureLane(s) {
  if (s.laneIndex === undefined || s.laneIndex === null) s.laneIndex = nearestLaneIndex(s.x || W / 2);
  s.laneIndex = clamp(s.laneIndex, 0, COLS - 1);
  if (!s.laneX) s.laneX = laneXByIndex(s.laneIndex) + (Math.random() - 0.5) * 12;
  if (!s.mode) s.mode = 'deploy';
}

function steerToLane(s, ratio = 0.65) {
  ensureLane(s);
  const dx = s.laneX - s.x;
  const speed = typeof fruitMoveSpeed === 'function' ? fruitMoveSpeed(s, SOLDIER_SPEED) : SOLDIER_SPEED;
  const max = speed * ratio * dt_global;
  if (Math.abs(dx) > 1) s.x += Math.sign(dx) * Math.min(Math.abs(dx), max);
  s.x = clamp(s.x, 24, W - 24);
}

function ownGateY(s) {
  return s.side === 'player'
    ? LAYOUT.playerWallY - 2
    : LAYOUT.enemyWallY + LAYOUT.wallH + 2;
}

function hasLeftOwnCastle(s) {
  const gateY = ownGateY(s);
  return s.side === 'player' ? s.y <= gateY : s.y >= gateY;
}

function markBattleReadyIfNeeded(s) {
  if (s.battleReady) return true;
  if (!hasLeftOwnCastle(s)) return false;
  s.battleReady = true;
  s.protected = false;
  s._spawnTimer = 0;
  s.mode = 'march';
  s.target = null;
  if (!s._gateFx) {
    s._gateFx = true;
    state.rings.push({ x: s.x, y: s.y, r: 4, life: 0.18, maxLife: 0.18, color: s.side === 'player' ? THEME.safe : THEME.accent });
  }
  return true;
}

function isCombatant(s) {
  return !!(s && s.alive && s.battleReady && !s.protected && s.mode !== 'dead');
}

function moveOutOfCastle(s) {
  ensureLane(s);
  steerToLane(s, 0.8);
  s.mode = 'deploy';

  const gateY = ownGateY(s);
  if (s.side === 'player') {
    if (s.y > gateY) {
      s.y -= (typeof fruitMoveSpeed === 'function' ? fruitMoveSpeed(s, SOLDIER_SPEED) * 2.2 : SOLDIER_SPEED) * dt_global; // 部署翻倍加速
      if (s.y <= gateY) s.y = gateY;
      markBattleReadyIfNeeded(s);
      return true;
    }
  } else {
    if (s.y < gateY) {
      s.y += (typeof fruitMoveSpeed === 'function' ? fruitMoveSpeed(s, SOLDIER_SPEED) * 2.2 : SOLDIER_SPEED) * dt_global;
      if (s.y >= gateY) s.y = gateY;
      markBattleReadyIfNeeded(s);
      return true;
    }
  }

  markBattleReadyIfNeeded(s);
  return false;
}

function keepInsideBattlefield(s) {
  s.x = clamp(s.x, 24, W - 24);
  if (s.mode !== 'siege' && s.mode !== 'siege_queue') s.y = clamp(s.y, fieldTop(), fieldBottom());
}

function isForwardOf(s, e) {
  return s.side === 'player' ? e.y <= s.y + 18 : e.y >= s.y - 18;
}

function dist2(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function soldierById(list, id) {
  if (!id) return null;
  return list.find(e => e.id === id && isCombatant(e)) || null;
}

function canSeeTarget(s, e) {
  ensureLane(e);
  const dx = e.x - s.x;
  const dy = e.y - s.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const laneGap = Math.abs(e.x - s.laneX);
  const sameLane = laneGap <= LANE_TOLERANCE;
  const forward = isForwardOf(s, e);
  if (sameLane && forward && Math.abs(dy) <= 250) return true;
  if (sameLane && dist <= SCAN_RANGE) return true;
  return dist <= CROSS_LANE_EMERGENCY_RANGE;
}

function findTarget(s, enemies) {
  if (!isCombatant(s)) return null;
  ensureLane(s);

  const sticky = soldierById(enemies, s.target);
  if (sticky && canSeeTarget(s, sticky)) {
    const d = Math.sqrt(dist2(s, sticky));
    if (d <= TARGET_STICK_RANGE || (typeof v15IsBackRole === 'function' && v15IsBackRole(s))) return sticky;
  } else if (!sticky) {
    s.target = null;
  }

  let best = null;
  let bestScore = Infinity;
  const ownWallY = s.side === 'player' ? LAYOUT.playerWallY : LAYOUT.enemyWallY + LAYOUT.wallH;
  const nearOwnWall = s.side === 'player' ? s.y >= ownWallY - 150 : s.y <= ownWallY + 150;
  for (const e of enemies) {
    if (!isCombatant(e)) continue;
    ensureLane(e);

    const dx = e.x - s.x;
    const dy = e.y - s.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const laneGap = Math.abs(e.x - s.laneX);
    const sameLane = laneGap <= LANE_TOLERANCE;
    const forward = isForwardOf(s, e);
    const eNearOwnWall = s.side === 'player' ? e.y >= ownWallY - 70 : e.y <= ownWallY + 70;
    const wallThreat = nearOwnWall && eNearOwnWall && dist <= 150;

    if (!wallThreat && !canSeeTarget(s, e)) continue;
    const roleMul = typeof roleCounterMultiplier === 'function' ? roleCounterMultiplier(s.type, e.type) : 1;

    let score = Math.abs(dy) + laneGap * (wallThreat ? 0.3 : 0.85) + dist * 0.22;
    // 嘲讽:被标记的敌人强制拉到最高优先级
    if (typeof isCombatant === 'function' && e.statusEffects && e.statusEffects.provoke && e.statusEffects.provoke.timer > 0) score -= 500;
    // 低血优先(刺客补刀):HP 低于 40% 的敌人额外加分
    if (e.hp < e.maxHp * 0.4) score -= 60;
    if (!sameLane) score += wallThreat ? 16 : 58;
    if (!forward && dist > 52 && !wallThreat) score += 180;
    if (wallThreat) score -= 200;
    if (roleMul >= 1.32) score -= 86;
    else if (roleMul >= 1.15) score -= 40;
    else if (roleMul <= 0.9) score += 36;
    if (s.target && e.id === s.target) score -= 36;
    const sr = (TYPES[s.type] || {}).role;
    if (sr === 'rush' && ['back','support','siege','control'].includes((TYPES[e.type] || {}).role)) score -= 70;
    if (sr === 'front' && (TYPES[e.type] || {}).role === 'rush') score -= 70;

    if (score < bestScore) { bestScore = score; best = e; }
  }
  s.target = best ? best.id : null;
  return best;
}

function moveTowardEnemy(s, target) {
  s.mode = 'fight';
  const leash = FIGHT_X_LEASH * 1.8;
  const desiredX = clamp(target.x, s.laneX - leash, s.laneX + leash);
  const dx = desiredX - s.x;
  const dy = target.y - s.y;
  const cspeed = typeof fruitMoveSpeed === 'function' ? fruitMoveSpeed(s, CHASE_SPEED) : CHASE_SPEED;
  const xStep = cspeed * 0.65 * dt_global;
  const yStep = cspeed * dt_global;

  if (Math.abs(dx) > 3) s.x += Math.sign(dx) * Math.min(Math.abs(dx), xStep);
  if (Math.abs(dy) > 3) s.y += Math.sign(dy) * Math.min(Math.abs(dy), yStep);
  if (Math.abs(s.x - s.laneX) > leash + 12) steerToLane(s, 0.12);
  keepInsideBattlefield(s);
}

function kiteAsBackline(s, target) {
  s.mode = 'backline';
  steerToLane(s, 0.9);
  const dir = s.side === 'player' ? 1 : -1;
  const kspeed = typeof fruitMoveSpeed === 'function' ? fruitMoveSpeed(s, CHASE_SPEED) : CHASE_SPEED;
  s.y += dir * kspeed * 0.68 * dt_global;
  keepInsideBattlefield(s);
}

function advanceTowardWall(s) {
  s.target = null;
  const role = (TYPES[s.type] || {}).role || '';
  const isBack = role === 'back' || role === 'support' || role === 'control' || role === 'siege';
  steerToLane(s, isBack ? 0.86 : 0.55);
  const sspeed = typeof fruitMoveSpeed === 'function' ? fruitMoveSpeed(s, SIEGE_SPEED) : SIEGE_SPEED;

  if (isBack) {
    s.mode = 'backline';
    // 后排跟随前排走,保持间距
    const group = s.side === 'player' ? state.playerSoldiers : state.enemySoldiers;
    let front = null;
    for (const u of group) {
      if (!isCombatant(u) || u.laneIndex !== s.laneIndex) continue;
      const ur = (TYPES[u.type] || {}).role;
      if (ur === 'merge' || ur === 'support' || ur === 'back' || ur === 'control' || ur === 'siege') continue;
      if (!front) front = u;
      else if (s.side === 'player' ? u.y < front.y : u.y > front.y) front = u;
    }
    const spacing = role === 'siege' ? 78 : role === 'support' ? 70 : 58;
    const wallDir = s.side === 'player' ? -1 : 1; // 朝敌方城墙方向
    if (front) {
      const frontSieging = front.mode === 'siege' || front.mode === 'siege_queue' || front.mode === 'siege_support' || reachedWall(front);
      if (frontSieging) {
        // 修#5:前排已到城墙攻城时,后排也压到城墙。旧逻辑停在 front.y+spacing(墙后)→ reachedWall 永为 false → 后排永不攻城
        s.mode = 'march';
        s.y += wallDir * sspeed * 0.7 * dt_global;
      } else {
        const desiredY = s.side === 'player' ? front.y + spacing : front.y - spacing;
        s.y += (clamp(desiredY, fieldTop() + 18, fieldBottom() - 18) - s.y) * Math.min(1, dt_global * 4.2);
      }
    } else {
      // 修#1:后排无前排时仍朝敌方城墙谨慎推进。旧逻辑锚点=己方墙(fieldBottom-42),
      //       前推力被锚拉力抵消→平衡点在敌墙前→后排永远到不了敌方城墙。
      s.mode = 'march';
      s.y += wallDir * sspeed * 0.55 * dt_global;
    }
    return;
  }

  s.mode = 'march';
  if (s.side === 'player') s.y -= sspeed * dt_global;
  else s.y += sspeed * dt_global;
}

function wallDataFor(s) {
  const wallY = s.side === 'player' ? LAYOUT.enemyWallY : LAYOUT.playerWallY;
  const wallH = LAYOUT.wallH;
  const attackY = s.side === 'player' ? wallY + wallH + 4 : wallY - 4;
  return { wallY, wallH, attackY };
}

function reachedWall(s) {
  const wall = wallDataFor(s);
  return s.side === 'player' ? s.y <= wall.attackY : s.y >= wall.attackY;
}

function siegeListFor(s) {
  const group = s.side === 'player' ? state.playerSoldiers : state.enemySoldiers;
  return group
    .filter(u => isCombatant(u) && u.laneIndex === s.laneIndex && reachedWall(u))
    .sort((a, b) => s.side === 'player' ? a.y - b.y || a.id.localeCompare(b.id) : b.y - a.y || a.id.localeCompare(b.id));
}

function moveToSiegeQueue(s, idx, wall) {
  s.mode = 'siege_queue';
  s.siegeSlot = idx;
  const row = Math.floor((idx - laneSlotCount()) / laneSlotCount()) + 1;
  const offset = ((idx % laneSlotCount()) - (laneSlotCount() - 1) / 2) * 11;
  const queueY = s.side === 'player' ? wall.attackY + 16 + row * 10 : wall.attackY - 16 - row * 10;
  s.x += ((s.laneX + offset) - s.x) * Math.min(1, dt_global * 7);
  s.y += (queueY - s.y) * Math.min(1, dt_global * 7);
}

function trackDamage(s, dmg, wall = false) {
  if (s.side !== 'player') return;
  state.damageByType[s.type] = (state.damageByType[s.type] || 0) + dmg;
  s.damageDone = (s.damageDone || 0) + dmg;
  if (wall) s.wallDamageDone = (s.wallDamageDone || 0) + dmg;
}

function attackWall(s) {
  if (!isCombatant(s)) return;
  // 前排攻城位:完整攻城倍率+橙子炮技能(原 fruitAttackWall + attackWallSkillV17)
  // 封顶协攻:排队兵给前排 +8%/名,最多 3 名 +24%(原 combat_pacing_v19 fullSquad)
  const wall = wallDataFor(s);
  const list = siegeListFor(s);
  const idx = Math.max(0, list.findIndex(u => u.id === s.id));
  const slotCount = laneSlotCount();
  s.siegeSlot = idx;

  // 前排攻城位:完整上游链
  if (idx < slotCount) {
    s.mode = 'siege';
    const offset = (idx - (slotCount - 1) / 2) * 13;
    s.x += ((s.laneX + offset) - s.x) * Math.min(1, dt_global * 8);
    s.y = wall.attackY;
    s.atkTimer -= dt_global;
    if (s.atkTimer > 0) return;
    const siegeMul = Math.max(0.2, s.siege || TYPES[s.type]?.siege || 1);
    const base = s.side === 'player'
      ? Math.round((s.level * 1.45 + s.atk * 0.105) * siegeMul)
      : Math.round((s.level * 1.25 + s.atk * 0.075) * siegeMul);
    let dmg = Math.max(1, base);
    if (s.side === 'player') {
      state.enemyWallHp = Math.max(0, state.enemyWallHp - dmg); state.enemyWallDamageDealt += dmg;
      state.wallDamageByLane[s.laneIndex] = (state.wallDamageByLane[s.laneIndex] || 0) + dmg;
      trackDamage(s, dmg, true);
    } else {
      state.playerWallHp = Math.max(0, state.playerWallHp - dmg); state.playerWallDamageTaken += dmg;
      state.breachLane = s.laneIndex;
    }
    state.attackFx.push({ x1: s.x - 8, y1: wall.attackY, x2: s.x + 8, y2: s.side === 'player' ? wall.wallY + 2 : wall.wallY + wall.wallH - 2, life: 0.22, maxLife: 0.22 });
    state.rings.push({ x: s.x, y: wall.attackY, r: 7, life: 0.35, maxLife: 0.35, color: THEME.gold });
    s.atkTimer = WALL_ATTACK_INTERVAL;
    state.shake = Math.max(state.shake, s.type === 'orange_cannon' ? 0.8 : 0.5); // VFX 強化:震感更明显
    if (typeof playSfx === 'function' && (state.time || 0) - (state._lastWallSfx ?? -1) > 0.2) { playSfx('wall'); state._lastWallSfx = state.time || 0; } // 墙破音效(审计#7:sfxWallBreak 原本定义了却从没触发)

    // 协攻加成:排队兵给前排 +8%/名,封顶 +24%(原 combat_pacing_v19)
    const group = s.side === 'player' ? state.playerSoldiers : state.enemySoldiers;
    let atWallCount = 0;
    for (const u of group) {
      if (!u || !u.alive || !isCombatant(u)) continue;
      if (u.laneIndex !== s.laneIndex) continue;
      if (['siege', 'siege_support', 'siege_queue'].includes(u.mode) || reachedWall(u)) atWallCount++;
    }
    const overflow = Math.max(0, atWallCount - slotCount);
    const assist = Math.min(3, overflow) * 0.08;
    if (assist > 0) {
      const extra = Math.max(1, Math.round(dmg * assist));
      if (s.side === 'player') { state.enemyWallHp = Math.max(0, state.enemyWallHp - extra); state.enemyWallDamageDealt += extra; trackDamage(s, extra, true); }
      else { state.playerWallHp = Math.max(0, state.playerWallHp - extra); state.playerWallDamageTaken += extra; }
    }
    return;
  }

  // 排队兵:移动无输出(协攻由前排结算)
  s.mode = 'siege_support';
  moveToSiegeQueue(s, idx, wall);
}

function killSoldier(target, killerSide, killerAtk, killerType) {
  if (!target || !target.alive) return;
  target.alive = false;
  target.mode = 'dead';
  clearTargetReferences(target.id);

  // 南瓜死亡滚动(原 fruit_mech killSoldier)
  if (target.type === 'pumpkin_roller' && !target.rolled) {
    target.rolled = true;
    if (!state.rollings) state.rollings = [];
    state.rollings.push({
      side: target.side, lane: target.laneIndex, laneX: target.laneX,
      x: target.x, y: target.y, speed: 185 + target.level * 12,
      dmg: Math.round(target.atk * (1.6 + target.level * 0.15)), life: 2.2,
    });
    addFx(target.x, target.y - 20, '南瓜滚动!', '#ff7d35', 12);
  }

  state.rings.push({ x: target.x, y: target.y, r: 4, life: 0.22, maxLife: 0.22, color: '#ff4a3a' });
  addFx(target.x, target.y - 7, '击破', '#ff8a68', 10);

  if (killerSide === 'player') {
    state.kills++;
    state.killSpProgress = (state.killSpProgress || 0) + 1;
    state.killSpCd = Math.max(0, state.killSpCd || 0);
    if (state.killSpProgress >= 4 && state.killSpCd <= 0 && state.sp < (typeof getSpRecoverCap === 'function' ? getSpRecoverCap(meta) : 18)) {
      state.killSpProgress = 0; state.killSpCd = 3.0;
      state.sp = Math.min(state.sp + 1, typeof getSpRecoverCap === 'function' ? getSpRecoverCap(meta) : 18, typeof getSpMax === 'function' ? getSpMax(meta) : 18);
      addFx(target.x, target.y - 22, '+1果汁', THEME.gold, 10);
    }
    if (killerAtk > state.maxSoldierAtk) { state.maxSoldierAtk = killerAtk; state.maxSoldierType = killerType; }
  }
}

function attackTarget(s, target) {
  if (!isCombatant(s) || !isCombatant(target)) return;
  const range = typeof fruitRange === 'function' ? fruitRange(s) : 24;
  const isBack = typeof fruitIsBackline === 'function' ? fruitIsBackline(s) : (TYPES[s.type]?.role === 'back' || TYPES[s.type]?.role === 'siege' || TYPES[s.type]?.role === 'control' || TYPES[s.type]?.role === 'support');
  const melee = ['tank','front','rush'].includes((TYPES[s.type] || {}).role);

  // 近战 stance(原 combat_pacing): 距离 > 30 先移近
  if (melee) { const d = Math.hypot(s.x - target.x, s.y - target.y); if (d > 30) { moveTowardEnemy(s, target); return; } }

  const dx = s.x - target.x, dy = s.y - target.y, dist = Math.sqrt(dx*dx + dy*dy);
  if (isBack && !reachedWall(s) && dist < BOW_SAFE_MIN) { kiteAsBackline(s, target); return; }
  if (dist > range) { moveTowardEnemy(s, target); return; }
  if (dist > range + 6) return;

  s.mode = isBack ? 'backline' : 'fight';
  s.atkTimer -= dt_global;
  if (s.atkTimer > 0) return;

  const counterMul = typeof roleCounterMultiplier === 'function' ? roleCounterMultiplier(s.type, target.type) : 1;
  const counterText = typeof roleCounterText === 'function' ? roleCounterText(s.type, target.type) : '';
  let dmg = Math.round(s.atk * counterMul);
  s.atkTimer = s.speed;

  if (isBack && s.type !== 'peach_medic') {
    playSfx('arrow');
    let cherryAoe = false;
    if (s.type === 'cherry_bomber' && (s.level || 1) >= 4) { s._cherryShot = (s._cherryShot || 0) + 1; if (s._cherryShot % 5 === 0) cherryAoe = true; }
    state.projectiles.push({ x: s.x, y: s.y, targetX: target.x, targetY: target.y, targetId: target.id, dmg, speed: s.type === 'blueberry_sniper' ? 315 : 245, color: TYPES[s.type]?.color || '#ff6b4a', life: 1.15, side: s.side, counterHit: !!counterText && counterMul > 1, ownerType: s.type, ownerLevel: s.level, slow: s.type === 'pear_frost', aoe: cherryAoe, firstHit: s.firstHit });
    s.firstHit = false;
    return;
  }

  playSfx('hit');
  const dealt = typeof applyFruitDamage === 'function' ? applyFruitDamage(target, dmg, s) : dmg;
  if (typeof applyFruitDamage !== 'function') { target.hp -= dealt; target.hitFlash = 0.28; }
  trackDamage(s, dealt, false);
  if (s.type === 'pear_frost') { target.slowTimer = 2.2 + s.level * 0.18; target.slowMul = 0.52; }
  state.attackFx.push({ x1: s.x, y1: s.y, x2: target.x, y2: target.y, life: 0.22, maxLife: 0.22 });
  const label = counterText && counterMul > 1 ? `${counterText} -${dealt}` : counterText === '受制' ? `受制 -${dealt}` : `-${dealt}`;
  addFx((s.x + target.x) / 2, (s.y + target.y) / 2 - 8, label, counterMul > 1 ? THEME.gold : THEME.accent, counterMul > 1 ? 13 : 11);
  s.firstHit = false;
  if (target.hp <= 0) killSoldier(target, s.side, s.atk, s.type);
}

function updateSoldier(s, enemies) {
  if (!s.alive) return;
  ensureLane(s);

  // 状态门:冰冻/眩晕跳过行动(来自 status_engine_v61)
  if (typeof isDisabled === 'function' && isDisabled(s)) {
    keepInsideBattlefield(s);
    return;
  }

  if (!isCombatant(s)) {
    moveOutOfCastle(s);
    return;
  }

  // 已到敌方城墙:优先攻城,不清完面前 blocker 不离开
  if (reachedWall(s)) {
    const blocker = sameLaneBlocker(s, enemies);
    if (blocker) {
      s.target = blocker.id;
      s.mode = 'fight';
      attackTarget(s, blocker);
      return;
    }
    attackWall(s);
    return;
  }

  // 出生缓冲:刚出城门稳步推进 0.35s,避免立即索敌导致 X 方向慢速"原地踏步"
  if ((s._spawnTimer || 0) < 0.35) {
    s._spawnTimer = (s._spawnTimer || 0) + dt_global;
    advanceTowardWall(s);
    return;
  }

  // 未到城墙:正常索敌推进
  const target = findTarget(s, enemies) || sameLaneBlocker(s, enemies);
  if (target) {
    ensureLane(target);
    // 近战转路收敛(来自 lane_block_fix)
    if (typeof isMeleeRoleLB === 'function' && isMeleeRoleLB(s.type) && target.laneIndex !== s.laneIndex) {
      const tLaneX = laneXByIndex(clamp(target.laneIndex, 0, COLS - 1));
      const step = 140 * dt_global;
      s.laneX += Math.sign(tLaneX - s.laneX) * Math.min(Math.abs(tLaneX - s.laneX), step);
    }
    // 平滑切路后同步 laneIndex,确保 applySeparation 能正确识别同路
    if (typeof isMeleeRoleLB === 'function' && isMeleeRoleLB(s.type) && target.laneIndex !== s.laneIndex) {
      if (Math.abs(s.laneX - laneXByIndex(clamp(target.laneIndex, 0, COLS - 1))) < 20) {
        s.laneIndex = clamp(target.laneIndex, 0, COLS - 1);
      }
    }
    s.target = target.id;
    attackTarget(s, target);
    return;
  }
  advanceTowardWall(s);
}

function applySeparation(soldiers) {
  const sepDist = 28; // 加大分离距离,防火柴人堆叠看不清
  for (let i = 0; i < soldiers.length; i++) {
    const a = soldiers[i];
    if (!isCombatant(a)) continue;
    let fx = 0;
    let fy = 0;
    for (let j = 0; j < soldiers.length; j++) {
      if (i === j) continue;
      const b = soldiers[j];
      if (!isCombatant(b)) continue;
      // 用 X 距离代替 laneIndex:平滑切路后 laneIndex 可能未同步,物理接近就该分离
      if (Math.abs(a.x - b.x) > (CELL + GAP) * 1.2) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < sepDist && dist > 0.1) {
        const force = (sepDist - dist) / sepDist;
        fx += (dx / dist) * force;
        fy += (dy / dist) * force * 0.80;
      } else if (dist <= 0.1) {
        fx += (i % 2 === 0 ? 1 : -1) * 0.45;
        fy += (i % 3 - 1) * 0.12;
      }
    }
    if (fx || fy) {
      const speed = 42 * dt_global;
      const leash = FIGHT_X_LEASH * 1.8;
      const nextX = a.x + fx * speed;
      a.x = clamp(nextX, a.laneX - leash, a.laneX + leash);
      // 修#4:攻城单位只做水平分散,Y 完全不碰。否则 y(城墙≈278) 被 clamp 到 fieldTop(296),
      //       每帧被弹离城墙 ~18px,attackWall 又把它拉回 → 墙边上下抖动。
      const sieging = a.mode === 'siege' || a.mode === 'siege_queue' || a.mode === 'siege_support';
      if (sieging) {
        const w = wallDataFor(a);
        a.y = clamp(a.y + fy * speed * 0.5, w.attackY - 10, w.attackY + 10);
      } else {
        a.y = clamp(a.y + fy * speed, fieldTop(), fieldBottom());
      }
    }
  }
}

function updateProjectiles() {
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    p.life -= dt_global;
    if (p.life <= 0) { state.projectiles.splice(i, 1); continue; }

    const enemies = p.side === 'player' ? state.enemySoldiers : state.playerSoldiers;
    const tgt = enemies.find(e => e.id === p.targetId && isCombatant(e));
    if (!tgt) {
      state.projectiles.splice(i, 1);
      continue;
    }

    p.targetX = tgt.x;
    p.targetY = tgt.y;
    const dx = tgt.x - p.x;
    const dy = tgt.y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 10) {
      tgt.hp -= p.dmg;
      tgt.hitFlash = 0.28;
      if (p.side === 'player') state.damageByType[p.ownerType || 'bow'] = (state.damageByType[p.ownerType || 'bow'] || 0) + p.dmg;
      addFx((p.x + tgt.x) / 2, (p.y + tgt.y) / 2 - 8, p.counterHit ? `克制 -${p.dmg}` : `-${p.dmg}`, p.counterHit ? THEME.gold : THEME.accent, p.counterHit ? 14 : 12);
      for (let j = 0; j < 3; j++) {
        state.fx.push({
          x: tgt.x,
          y: tgt.y,
          text: '·',
          color: p.color,
          size: 6,
          life: 0.26,
          maxLife: 0.26,
          vx: (Math.random() - 0.5) * 42,
          vy: (Math.random() - 0.5) * 42,
        });
      }
      if (tgt.hp <= 0) killSoldier(tgt, p.side, p.dmg, p.ownerType || 'bow');
      state.projectiles.splice(i, 1);
      continue;
    }

    if (d > 0.1) {
      p.x += (dx / d) * p.speed * dt_global;
      p.y += (dy / d) * p.speed * dt_global;
    }
  }
}

function lanePowerOf(s) {
  return s.atk + s.hp * 0.32 + s.level * 3;
}

function updateLaneStats() {
  const stats = emptyLaneStats();
  for (const s of state.playerSoldiers) {
    if (!isCombatant(s)) continue;
    const st = stats[s.laneIndex];
    st.playerCount++;
    st.playerPower += lanePowerOf(s);
    st.playerFront = st.playerFront === null ? s.y : Math.min(st.playerFront, s.y);
  }
  for (const s of state.enemySoldiers) {
    if (!isCombatant(s)) continue;
    const st = stats[s.laneIndex];
    st.enemyCount++;
    st.enemyPower += lanePowerOf(s);
    st.enemyFront = st.enemyFront === null ? s.y : Math.max(st.enemyFront, s.y);
  }

  for (const st of stats) {
    const enemyNearWall = st.enemyFront !== null ? clamp((st.enemyFront - (fieldBottom() - 48)) / 48, 0, 1) : 0;
    const playerNearEnemyWall = st.playerFront !== null ? clamp(((fieldTop() + 48) - st.playerFront) / 48, 0, 1) : 0;
    st.danger = Math.max(0, st.enemyPower - st.playerPower * 0.85) + enemyNearWall * 48;

    if (st.playerCount && st.enemyCount) {
      if (st.enemyPower > st.playerPower * 1.35 || enemyNearWall > 0.55) { st.status = 'enemy_adv'; st.pressureText = '敌方压线'; }
      else if (st.playerPower > st.enemyPower * 1.25 || playerNearEnemyWall > 0.55) { st.status = 'player_adv'; st.pressureText = '我方优势'; }
      else { st.status = 'clash'; st.pressureText = '接战中'; }
    } else if (st.enemyCount) {
      st.status = enemyNearWall > 0.45 ? 'wall_danger' : 'enemy_push';
      st.pressureText = enemyNearWall > 0.45 ? '城墙受压' : '敌军推进';
      st.danger += 20;
    } else if (st.playerCount) {
      st.status = playerNearEnemyWall > 0.45 ? 'siege_ready' : 'player_push';
      st.pressureText = playerNearEnemyWall > 0.45 ? '准备攻城' : '我方推进';
    } else {
      st.status = 'idle';
      st.pressureText = '';
    }
  }
  state.laneStats = stats;
}

function updateLaneAlerts() {
  state.laneAlertCd -= dt_global;
  for (let i = state.laneAlerts.length - 1; i >= 0; i--) {
    state.laneAlerts[i].life -= dt_global;
    if (state.laneAlerts[i].life <= 0) state.laneAlerts.splice(i, 1);
  }
  if (state.laneAlertCd > 0) return;

  let dangerLane = null;
  for (const st of state.laneStats) {
    if (st.danger > 38 && (!dangerLane || st.danger > dangerLane.danger)) dangerLane = st;
  }
  if (!dangerLane) return;

  const x = laneXByIndex(dangerLane.lane);
  state.laneAlerts.push({ lane: dangerLane.lane, text: `第${dangerLane.lane + 1}路危险`, life: 2.2, maxLife: 2.2 });
  addFx(x, LAYOUT.playerWallY - 18, `第${dangerLane.lane + 1}路危险！`, THEME.accent, 13);
  state.laneAlertCd = 3.2;
}

function dominantEnemyType(lane) {
  const count = {};
  for (const s of state.enemySoldiers) {
    if (!isCombatant(s) || s.laneIndex !== lane) continue;
    count[s.type] = (count[s.type] || 0) + 1;
  }
  let best = null, n = 0;
  for (const [type, c] of Object.entries(count)) if (c > n) { best = type; n = c; }
  return best;
}

function counterForEnemy(enemyType) {
  return bestCounterForEnemy(enemyType, activeDeck()) || bestCounterForEnemy(enemyType, progressUnlocked(meta));
}

function buildBattleReport(win) {
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
  const recommendType = enemyType ? counterForEnemy(enemyType) : null;

  const tips = [];
  if (bestType) tips.push(`本局主力：${TYPES[bestType].name}，贡献约 ${Math.round(bestDamage)} 伤害`);
  if (state.enemyWallDamageDealt > 0) tips.push(`攻城伤害：${Math.round(state.enemyWallDamageDealt)}`);
  if (!win && dangerLane >= 0) tips.push(`被突破路线：第${dangerLane + 1}路`);
  if (!win && recommendType) tips.push(`建议：补 ${TYPES[recommendType].name}，它克制 ${TYPES[enemyType].name}`);
  if (state.merges < 2 && state.currentLevel >= 3) tips.push('建议：至少合成 2 次再进入中期交战');
  if (state.sp <= 1) tips.push('建议：保留 1～2 点士气给高等级兵营双击救线');
  if (win && state.playerWallHp / state.playerWallMax < 0.45) tips.push('险胜：优先升级城墙或盾/枪血量');
  if (win && state.playerWallHp / state.playerWallMax > 0.75) tips.push('优势：可以优先升级主力攻击加快通关');

  return {
    bestType,
    bestDamage: Math.round(bestDamage),
    dangerLane,
    recommendType,
    tips,
  };
}

function updateCombat() {
  if (state.phase !== 'playing') return;

  // 被动技能 tick(原 fruit_mech updateFruitPassiveSkills, skill_v17 包装)
  if (typeof updateFruitPassiveSkills === 'function') updateFruitPassiveSkills(dt_global);
  // 南瓜滚动 tick(原 fruit_mech updateRollingPumpkins)
  if (typeof updateRollingPumpkins === 'function') updateRollingPumpkins(dt_global);

  // 状态引擎 tick(原 status_engine):迁移旧字段/施加着火/冰冻/减速
  const all = [...state.playerSoldiers, ...state.enemySoldiers];
  for (const s of all) {
    if (typeof migrateOldStatus === 'function') migrateOldStatus(s);
    // 橄榄刺客隐身入场(原 status_engine)
    if (s.type === 'olive_assassin' && (s.level || 1) >= 4 && s.battleReady && !s._stealthApplied) { s._stealthApplied = true; if (typeof applyStatus === 'function') applyStatus(s, s, 'invisible', 3.0); }
    if (typeof tickStatus === 'function') tickStatus(s, dt_global || 0.016);
  }

  state.playerSoldiers = state.playerSoldiers.filter(s => s.alive);
  state.enemySoldiers = state.enemySoldiers.filter(s => s.alive);
  for (const s of state.playerSoldiers) updateSoldier(s, state.enemySoldiers);
  for (const s of state.enemySoldiers) updateSoldier(s, state.playerSoldiers);
  state.playerSoldiers = state.playerSoldiers.filter(s => s.alive);
  state.enemySoldiers = state.enemySoldiers.filter(s => s.alive);

  applySeparation(state.playerSoldiers); applySeparation(state.enemySoldiers);
  updateProjectiles(); updateLaneStats(); updateLaneAlerts();
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt_global * 4);

  // Boss tick(原 boss_v63)
  if (typeof bossTick === 'function') bossTick(dt_global || 0.016);

  if (state.playerWallHp <= 0) { state.lastBattleReport = buildBattleReport(false); state.phase = 'lost'; onGameOver(false); }
  else if (state.enemyWallHp <= 0) { state.lastBattleReport = buildBattleReport(true); state.phase = 'won'; onGameOver(true); }
}
