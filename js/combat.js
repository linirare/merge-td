/* ============================================================
   合成攻城 · Merge Siege —— 战斗系统
   设计目标：战线推进，而不是自由追怪。
   ============================================================ */

const SOLDIER_SPEED = 92;
const CHASE_SPEED = 82;
const SIEGE_SPEED = 112;
const FIELD_PAD = 12;
const LANE_TOLERANCE = 48;
const SCAN_RANGE = 168;
const WALL_ATTACK_INTERVAL = 0.82;

const ATTACK_RANGES = {
  bow: 116,
  sword: 24,
  spear: 30,
  shield: 22,
};

function fieldTop() { return LAYOUT.fieldY + FIELD_PAD; }
function fieldBottom() { return LAYOUT.fieldY + LAYOUT.fieldH - FIELD_PAD; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

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
  if (!s.laneX) s.laneX = laneXByIndex(s.laneIndex) + (Math.random() - 0.5) * 12;
  if (!s.mode) s.mode = 'march';
}

function steerToLane(s, ratio = 0.65) {
  ensureLane(s);
  const dx = s.laneX - s.x;
  const max = SOLDIER_SPEED * ratio * dt_global;
  if (Math.abs(dx) > 1) s.x += Math.sign(dx) * Math.min(Math.abs(dx), max);
  s.x = clamp(s.x, 24, W - 24);
}

function isInsideOwnCastle(s) {
  if (s.side === 'player') return s.y > fieldBottom();
  return s.y < fieldTop();
}

function isEngageable(s) {
  return !!s && s.alive && !isInsideOwnCastle(s) && s.mode !== 'dead';
}

function enterField(s) {
  ensureLane(s);
  steerToLane(s, 0.8);

  if (s.side === 'player' && s.y > fieldBottom()) {
    s.mode = 'deploy';
    s.invulnerable = true;
    s.y -= SOLDIER_SPEED * dt_global;
    if (s.y <= fieldBottom()) {
      s.y = fieldBottom();
      s.mode = 'march';
      s.invulnerable = false;
    }
    return true;
  }
  if (s.side === 'enemy' && s.y < fieldTop()) {
    s.mode = 'deploy';
    s.invulnerable = true;
    s.y += SOLDIER_SPEED * dt_global;
    if (s.y >= fieldTop()) {
      s.y = fieldTop();
      s.mode = 'march';
      s.invulnerable = false;
    }
    return true;
  }

  s.invulnerable = false;
  return false;
}

function isForwardOf(s, e) {
  return s.side === 'player' ? e.y <= s.y + 18 : e.y >= s.y - 18;
}

function findTarget(s, enemies) {
  ensureLane(s);
  const counterType = COUNTER[s.type];
  let best = null;
  let bestScore = Infinity;

  for (const e of enemies) {
    if (!isEngageable(e)) continue;
    ensureLane(e);
    const dx = e.x - s.x;
    const dy = e.y - s.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const laneGap = Math.abs(e.x - s.laneX);
    const sameLane = laneGap <= LANE_TOLERANCE;
    const forward = isForwardOf(s, e);

    const canSee = dist <= SCAN_RANGE || (sameLane && forward && Math.abs(dy) <= 240) || dist <= 52;
    if (!canSee) continue;

    let score = Math.abs(dy) + laneGap * 0.85 + dist * 0.22;
    if (!sameLane) score += 58;
    if (!forward && dist > 52) score += 180;
    if (e.type === counterType) score -= 85;
    if (s.target && e.id === s.target) score -= 28;

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

  s.x = clamp(s.x, 24, W - 24);
  s.y = clamp(s.y, fieldTop(), fieldBottom());
}

function advanceTowardWall(s) {
  s.mode = 'march';
  s.target = null;
  steerToLane(s, 0.55);
  if (s.side === 'player') s.y -= SIEGE_SPEED * dt_global;
  else s.y += SIEGE_SPEED * dt_global;
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

function attackWall(s) {
  s.mode = 'siege';
  const wall = wallDataFor(s);
  s.y = wall.attackY;
  steerToLane(s, 0.35);

  s.atkTimer -= dt_global;
  if (s.atkTimer > 0) return;

  if (s.side === 'player') {
    const dmg = Math.max(2, Math.round(s.level * 2.2 + s.atk * 0.15));
    state.enemyWallHp = Math.max(0, state.enemyWallHp - dmg);
    addFx(s.x, wall.wallY + wall.wallH + 4, `破城 -${dmg}`, THEME.gold, 13);
  } else {
    const dmg = Math.max(2, Math.round(s.level * 1.7 + s.atk * 0.1));
    state.playerWallHp = Math.max(0, state.playerWallHp - dmg);
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
    state.sp = Math.min(state.sp + 1, SP_MAX);
    state.kills++;
    if (killerAtk > state.maxSoldierAtk) {
      state.maxSoldierAtk = killerAtk;
      state.maxSoldierType = killerType;
    }
  }
}

function attackTarget(s, target) {
  if (!isEngageable(target)) {
    s.target = null;
    return;
  }

  const dx = s.x - target.x;
  const dy = s.y - target.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const range = ATTACK_RANGES[s.type] || 24;

  if (dist > range) {
    moveTowardEnemy(s, target);
    return;
  }

  s.mode = 'fight';
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
      speed: 235,
      color: TYPES[s.type]?.color || '#ff6b4a',
      life: 1.15,
      side: s.side,
      counterHit,
    });
    return;
  }

  playSfx('hit');
  target.hp -= dmg;
  target.hitFlash = 0.28;
  state.attackFx.push({ x1: s.x, y1: s.y, x2: target.x, y2: target.y, life: 0.22, maxLife: 0.22 });
  addFx((s.x + target.x) / 2, (s.y + target.y) / 2 - 8, counterHit ? `克制 -${dmg}` : `-${dmg}`, counterHit ? THEME.gold : THEME.accent, counterHit ? 14 : 12);

  if (target.hp <= 0) killSoldier(target, s.side, s.atk, s.type);
}

function updateSoldier(s, enemies) {
  if (!s.alive) return;
  ensureLane(s);

  if (enterField(s)) return;

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
    if (!a.alive) continue;
    let fx = 0;
    let fy = 0;
    for (let j = 0; j < soldiers.length; j++) {
      if (i === j) continue;
      const b = soldiers[j];
      if (!b.alive) continue;
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
      if (a.mode !== 'siege' && !isInsideOwnCastle(a)) a.y = clamp(a.y + fy * speed, fieldTop(), fieldBottom());
    }
  }
}

function updateProjectiles() {
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    p.life -= dt_global;
    if (p.life <= 0) { state.projectiles.splice(i, 1); continue; }

    const enemies = p.side === 'player' ? state.enemySoldiers : state.playerSoldiers;
    const tgt = enemies.find(e => e.id === p.targetId && isEngageable(e));
    if (!tgt) {
      const dx = p.targetX - p.x;
      const dy = p.targetY - p.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 5) { state.projectiles.splice(i, 1); continue; }
      if (d > 0.1) {
        p.x += (dx / d) * p.speed * dt_global;
        p.y += (dy / d) * p.speed * dt_global;
      }
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
      if (tgt.hp <= 0) killSoldier(tgt, p.side, p.dmg, 'bow');
      state.projectiles.splice(i, 1);
      continue;
    }

    if (d > 0.1) {
      p.x += (dx / d) * p.speed * dt_global;
      p.y += (dy / d) * p.speed * dt_global;
    }
  }
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

  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt_global * 4);

  if (state.playerWallHp <= 0) {
    state.phase = 'lost';
    onGameOver(false);
  } else if (state.enemyWallHp <= 0) {
    state.phase = 'won';
    onGameOver(true);
  }
}
