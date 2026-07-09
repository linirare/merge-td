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

const ATTACK_RANGES = {
  bow: 116,
  sword: 24,
  spear: 30,
  shield: 22,
};

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
  const max = SOLDIER_SPEED * ratio * dt_global;
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
      s.y -= SOLDIER_SPEED * dt_global;
      if (s.y <= gateY) s.y = gateY;
      markBattleReadyIfNeeded(s);
      return true;
    }
  } else {
    if (s.y < gateY) {
      s.y += SOLDIER_SPEED * dt_global;
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
  return dist <= SCAN_RANGE || (sameLane && forward && Math.abs(dy) <= 240) || dist <= 52;
}

function findTarget(s, enemies) {
  if (!isCombatant(s)) return null;
  ensureLane(s);

  const sticky = soldierById(enemies, s.target);
  if (sticky && canSeeTarget(s, sticky)) {
    const d = Math.sqrt(dist2(s, sticky));
    if (d <= TARGET_STICK_RANGE || s.type === 'bow') return sticky;
  }

  const counterType = COUNTER[s.type];
  let best = null;
  let bestScore = Infinity;

  for (const e of enemies) {
    if (!isCombatant(e)) continue;
    ensureLane(e);
    const dx = e.x - s.x;
    const dy = e.y - s.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const laneGap = Math.abs(e.x - s.laneX);
    const sameLane = laneGap <= LANE_TOLERANCE;
    const forward = isForwardOf(s, e);

    if (!canSeeTarget(s, e)) continue;

    let score = Math.abs(dy) + laneGap * 0.85 + dist * 0.22;
    if (!sameLane) score += 58;
    if (!forward && dist > 52) score += 180;
    if (e.type === counterType) score -= 85;
    if (s.type === 'bow' && sameLane) score -= 24;
    if (s.target && e.id === s.target) score -= 36;

    if (score < bestScore) {
      bestScore = score;
      best = e;
    }
  }

  if (best) s.target = best.id;
  return best;
}

function moveTowardEnemy(s, target) {
  s.mode = 'fight';
  const dx = target.x - s.x;
  const dy = target.y - s.y;
  const xStep = CHASE_SPEED * 0.58 * dt_global;
  const yStep = CHASE_SPEED * dt_global;

  if (Math.abs(dx) > 3) s.x += Math.sign(dx) * Math.min(Math.abs(dx), xStep);
  if (Math.abs(dy) > 3) s.y += Math.sign(dy) * Math.min(Math.abs(dy), yStep);
  keepInsideBattlefield(s);
}

function kiteAsBackline(s, target) {
  s.mode = 'backline';
  steerToLane(s, 0.9);
  const dir = s.side === 'player' ? 1 : -1;
  s.y += dir * CHASE_SPEED * 0.68 * dt_global;
  keepInsideBattlefield(s);
}

function advanceTowardWall(s) {
  s.mode = s.type === 'bow' ? 'backline' : 'march';
  s.target = null;
  steerToLane(s, 0.55);
  const mod = s.type === 'bow' ? 0.72 : 1;
  if (s.side === 'player') s.y -= SIEGE_SPEED * mod * dt_global;
  else s.y += SIEGE_SPEED * mod * dt_global;
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
  const wall = wallDataFor(s);
  const list = siegeListFor(s);
  const idx = Math.max(0, list.findIndex(u => u.id === s.id));
  const slotCount = laneSlotCount();
  s.siegeSlot = idx;

  if (idx >= slotCount) {
    moveToSiegeQueue(s, idx, wall);
    return;
  }

  s.mode = 'siege';
  const offset = (idx - (slotCount - 1) / 2) * 13;
  s.x += ((s.laneX + offset) - s.x) * Math.min(1, dt_global * 8);
  s.y = wall.attackY;

  s.atkTimer -= dt_global;
  if (s.atkTimer > 0) return;

  let dmg;
  if (s.side === 'player') {
    dmg = Math.max(2, Math.round(s.level * 1.75 + s.atk * 0.11));
    state.enemyWallHp = Math.max(0, state.enemyWallHp - dmg);
    state.enemyWallDamageDealt += dmg;
    state.wallDamageByLane[s.laneIndex] = (state.wallDamageByLane[s.laneIndex] || 0) + dmg;
    trackDamage(s, dmg, true);
    addFx(s.x, wall.wallY + wall.wallH + 4, `破城 -${dmg}`, THEME.gold, 13);
  } else {
    dmg = Math.max(2, Math.round(s.level * 1.45 + s.atk * 0.08));
    state.playerWallHp = Math.max(0, state.playerWallHp - dmg);
    state.playerWallDamageTaken += dmg;
    state.breachLane = s.laneIndex;
    addFx(s.x, wall.wallY - 8, `-${dmg}`, THEME.accent, 13);
  }

  state.attackFx.push({
    x1: s.x - 8,
    y1: wall.attackY,
    x2: s.x + 8,
    y2: s.side === 'player' ? wall.wallY + 2 : wall.wallY + wall.wallH - 2,
    life: 0.22,
    maxLife: 0.22,
  });
  state.rings.push({ x: s.x, y: wall.attackY, r: 5, life: 0.24, maxLife: 0.24, color: THEME.gold });
  s.atkTimer = WALL_ATTACK_INTERVAL;
  state.shake = 0.32;
}

function killSoldier(target, killerSide, killerAtk, killerType) {
  target.alive = false;
  target.mode = 'dead';
  state.rings.push({ x: target.x, y: target.y, r: 4, life: 0.24, maxLife: 0.24, color: '#ff4a3a' });
  addFx(target.x, target.y - 7, '击破', '#ff8a68', 11);

  if (killerSide === 'player') {
    state.sp = Math.min(state.sp + 1, getSpMax(meta));
    state.kills++;
    if (killerAtk > state.maxSoldierAtk) {
      state.maxSoldierAtk = killerAtk;
      state.maxSoldierType = killerType;
    }
  }
}

function attackTarget(s, target) {
  if (!isCombatant(s) || !isCombatant(target)) return;
  const dx = s.x - target.x;
  const dy = s.y - target.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const range = ATTACK_RANGES[s.type] || 24;

  if (s.type === 'bow' && dist < BOW_SAFE_MIN) {
    kiteAsBackline(s, target);
  } else if (dist > range) {
    moveTowardEnemy(s, target);
    return;
  }

  if (dist > range + 6) return;

  s.mode = s.type === 'bow' ? 'backline' : 'fight';
  s.atkTimer -= dt_global;
  if (s.atkTimer > 0) return;

  let dmg = s.atk;
  const counterHit = target.type === COUNTER[s.type];
  if (counterHit) dmg = Math.round(dmg * COUNTER_DMG);
  s.atkTimer = s.speed;

  if (s.type === 'bow') {
    playSfx('arrow');
    state.projectiles.push({
      x: s.x,
      y: s.y,
      targetX: target.x,
      targetY: target.y,
      targetId: target.id,
      dmg,
      speed: 245,
      color: TYPES[s.type]?.color || '#ff6b4a',
      life: 1.15,
      side: s.side,
      counterHit,
      ownerType: s.type,
    });
    return;
  }

  playSfx('hit');
  target.hp -= dmg;
  target.hitFlash = 0.28;
  trackDamage(s, dmg, false);
  state.attackFx.push({ x1: s.x, y1: s.y, x2: target.x, y2: target.y, life: 0.22, maxLife: 0.22 });
  addFx((s.x + target.x) / 2, (s.y + target.y) / 2 - 8, counterHit ? `克制 -${dmg}` : `-${dmg}`, counterHit ? THEME.gold : THEME.accent, counterHit ? 14 : 12);

  if (target.hp <= 0) killSoldier(target, s.side, s.atk, s.type);
}

function updateSoldier(s, enemies) {
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

  if (reachedWall(s)) attackWall(s);
  else advanceTowardWall(s);
}

function applySeparation(soldiers) {
  const sepDist = 16;
  for (let i = 0; i < soldiers.length; i++) {
    const a = soldiers[i];
    if (!isCombatant(a)) continue;
    let fx = 0;
    let fy = 0;
    for (let j = 0; j < soldiers.length; j++) {
      if (i === j) continue;
      const b = soldiers[j];
      if (!isCombatant(b)) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < sepDist && dist > 0.1) {
        const force = (sepDist - dist) / sepDist;
        fx += (dx / dist) * force;
        fy += (dy / dist) * force * 0.22;
      }
    }
    if (fx || fy) {
      const speed = 42 * dt_global;
      a.x = clamp(a.x + fx * speed, 24, W - 24);
      if (a.mode !== 'siege' && a.mode !== 'siege_queue') a.y = clamp(a.y + fy * speed, fieldTop(), fieldBottom());
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
  for (const [type, target] of Object.entries(COUNTER)) if (target === enemyType) return type;
  return null;
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

  state.playerSoldiers = state.playerSoldiers.filter(s => s.alive);
  state.enemySoldiers = state.enemySoldiers.filter(s => s.alive);

  for (const s of state.playerSoldiers) updateSoldier(s, state.enemySoldiers);
  for (const s of state.enemySoldiers) updateSoldier(s, state.playerSoldiers);

  state.playerSoldiers = state.playerSoldiers.filter(s => s.alive);
  state.enemySoldiers = state.enemySoldiers.filter(s => s.alive);

  applySeparation(state.playerSoldiers);
  applySeparation(state.enemySoldiers);
  updateProjectiles();
  updateLaneStats();
  updateLaneAlerts();

  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt_global * 4);

  if (state.playerWallHp <= 0) {
    state.lastBattleReport = buildBattleReport(false);
    state.phase = 'lost';
    onGameOver(false);
  } else if (state.enemyWallHp <= 0) {
    state.lastBattleReport = buildBattleReport(true);
    state.phase = 'won';
    onGameOver(true);
  }
}