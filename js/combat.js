/* ============================================================
   合成攻城 · Merge Siege —— 战斗系统
   设计目标：五路战线推进 + 前后排 + 锁敌 + 攻城位。
   关键规则：未走出己方城墙的兵处于保护区，不可索敌/不可被攻击。
   ============================================================ */

const SOLDIER_SPEED = 92;
const CHASE_SPEED = 82;
const SIEGE_SPEED = 104;
const FIELD_PAD = 12;

/* ——— VFX 事件系统：战斗逻辑 emit → 渲染层消费 ——— */
const _vfxListeners = [];
let _preFightTick = null;
function onVfx(fn) { _vfxListeners.push(fn); return fn; }
function offVfx(fn) { const i = _vfxListeners.indexOf(fn); if (i >= 0) _vfxListeners.splice(i, 1); }
function emitVfx(type, data) {
  for (const fn of _vfxListeners) fn(type, data, state);
}

/* ——— 4 层同步命中反馈：将散落的 VFX 调用统一为单点入口 ——— */
function triggerHitFeedback(target, source, dealt, opts = {}) {
  const { isCrit = false, counterMul = 1, counterText = '', isProjectile = false, projectileColor = '#ffd24a', ownerType = '' } = opts;
  if (!target) return;

  // Layer 1: hitFlash — 受击闪白
  target.hitFlash = isCrit ? 0.42 : 0.28;
  if (isCrit) target._critHit = true;

  // Layer 2: camera impulse. Ordinary hits use local flash only; shaking the
  // whole battlefield on every hit reads as frame stutter in a crowded fight.
  if (!isProjectile && dealt >= 40) state.shake = Math.max(state.shake, 0.08);
  if (isCrit) state.shake = Math.max(state.shake, 0.16);

  // Layer 3: attack slash — 攻击划线 (仅近战)
  if (source && !isProjectile) {
    state.attackFx.push({ x1: source.x, y1: source.y, x2: target.x, y2: target.y, life: 0.22, maxLife: 0.22 });
  }

  // Layer 4: damage text — 伤害数字 + 克制文本
  const srcRef = source || { type: ownerType, x: target.x, y: target.y };
  const fxCol = typeof roleFxColor === 'function' ? roleFxColor(srcRef.type) : THEME.gold;
  if (counterMul >= 1.25) {
    addFx(target.x, target.y - 14, `克制 -${dealt}`, fxCol, 16);
    state.rings.push({ x: target.x, y: target.y, r: 6, life: 0.3, maxLife: 0.3, color: fxCol });
  } else if (counterMul > 1) {
    addFx(target.x, target.y - 12, `优势 -${dealt}`, fxCol, 13);
  } else if (counterText === '受制') {
    addFx((srcRef.x + target.x) / 2, (srcRef.y + target.y) / 2 - 8, `受制 -${dealt}`, '#E23B4E', 12);
  } else {
    addFx((srcRef.x + target.x) / 2, (srcRef.y + target.y) / 2 - 8, `-${dealt}`, '#FFFFFF', 11);
  }

  // Layer 5: crit visuals — 暴击文字 + 光环
  if (isCrit) {
    addFx(target.x, target.y - 24, '暴击! x2', '#FFD700', 18);
    state.rings.push({ x: target.x, y: target.y, r: 10, life: 0.35, maxLife: 0.35, color: '#fff2a9' });
    state.shake = Math.max(state.shake, 0.16);
  }

  // Layer 6: projectile burst particles — 弹射物命中爆裂粒子
  if (isProjectile) {
    for (let j = 0; j < 5; j++) {
      state.fx.push({
        x: target.x + (Math.random() - 0.5) * 20, y: target.y + (Math.random() - 0.5) * 20,
        text: '✦', color: projectileColor, size: 4 + Math.random() * 5,
        life: 0.3 + Math.random() * 0.2, maxLife: 0.5,
        vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60,
      });
    }
    for (let j = 0; j < 3; j++) {
      state.fx.push({
        x: target.x, y: target.y, text: '·', color: projectileColor, size: 6,
        life: 0.26, maxLife: 0.26,
        vx: (Math.random() - 0.5) * 42, vy: (Math.random() - 0.5) * 42,
      });
    }
  }

  // Layer 7: emitVfx event for sprite backend
  emitVfx('hit', { target, source, dealt, crit: isCrit, counterText, ownerType });
}

function _wrapVfxArrays() {
  if (state.__vfxWrapped) return;
  for (const key of ['attackFx', 'rings', 'fx']) {
    const arr = state[key];
    if (!arr || arr.__vfxWrapped) continue;
    const origPush = arr.push.bind(arr);
    arr.push = function(...items) {
      const r = origPush(...items);
      emitVfx(key, { action: 'push', items, array: this });
      return r;
    };
    arr.__vfxWrapped = true;
  }
  state.__vfxWrapped = true;
}
window.emitVfx = emitVfx;
window.onVfx = onVfx;
window.offVfx = offVfx;
function battleTimeLimit() {
  const pve = typeof TUNING === 'object' && TUNING && TUNING.pve ? TUNING.pve : {};
  const boss = !!(state && state.levelConfig && (state.levelConfig.isBoss || state.levelConfig.type === 'boss'));
  const target = boss ? pve.bossTargetSeconds : pve.normalTargetSeconds;
  return Array.isArray(target) && Number(target[1]) > 0 ? Number(target[1]) : (boss ? 90 : 75);
}
const ROUND_PREPARE_INITIAL = 4.0;
const ROUND_PREPARE_BETWEEN = 1.2;
const ROUND_FIGHT_LIMIT = 16.0;
const LANE_TOLERANCE = 48;
const SCAN_RANGE = 168;
const TARGET_STICK_RANGE = 220;
const WALL_ATTACK_INTERVAL = 1.05;
const BOW_SAFE_MIN = 0;
const CROSS_LANE_EMERGENCY_RANGE = 120; // 修#6:50→120。邻路正常间距(~72px)原来看不见→径直去撞墙;放宽后邻路近敌可见
const FIGHT_X_LEASH = 20;

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
  return s.type === 'bow' || role === 'shooter' || role === 'wildcard';
}

/* 同路/邻路阻塞清理(原 lane_block_fix.js,已合并) */
function isMeleeRoleLB(type) { return ['shell', 'spike', 'raider'].includes(roleOf(type)); }
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
    if (TYPES[s.type]?.tags?.includes('rush') && TYPES[e.type]?.tags?.some(t => ['back','support','siege','control'].includes(t))) score -= 55;
    if (score < bestScore) { bestScore = score; best = e; }
  }
  return best;
}

function fieldTop() { return LAYOUT.fieldY + FIELD_PAD; }
function fieldBottom() { return LAYOUT.fieldY + LAYOUT.fieldH - FIELD_PAD; }
function fieldCenter() { return (fieldTop() + fieldBottom()) / 2; }
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

/* 间距分组（近程/远程/AOE/辅助），用于分离力 + 攻城行为区分 */
function spacingGroup(type) {
  const t = TYPES[type];
  const r = t?.role || '';
  if (t?.tags?.includes('aoe') || t?.skill === 'aoe' || t?.skill === 'death_roll') return 'aoe';
  if (r === 'shell' || r === 'spike' || r === 'raider') return 'melee';
  if (r === 'wildcard') return 'support';
  if (t?.range === 'far' || t?.range === 'long') return 'ranged';
  return 'melee';
}
function sepWeight(a, b) {
  const ga = spacingGroup(a.type);
  const gb = spacingGroup(b.type);
  if (ga === gb) {
    if (ga === 'support') return 0.4;
    if (ga === 'ranged') return 0.6;
    if (ga === 'aoe') return 1.2;
    return 0.9;
  }
  if ((ga === 'melee' && gb === 'ranged') || (ga === 'ranged' && gb === 'melee')) return 1.6;
  if (ga === 'support' || gb === 'support') return 1.4;
  if (ga === 'aoe' || gb === 'aoe') return 1.2;
  return 1.0;
}

function steerToLane(s, ratio = 0.65) {
  ensureLane(s);
  const targetX = s.laneX + (s._subLane ?? 0) * 18;
  const dx = targetX - s.x;
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
    if (sr === 'raider' && ['shooter'].includes((TYPES[e.type] || {}).role)) score -= 70;
    if (sr === 'spike' && (TYPES[e.type] || {}).role === 'raider') score -= 70;

    if (score < bestScore) { bestScore = score; best = e; }
  }
  s.target = best ? best.id : null;
  return best;
}

function moveTowardEnemy(s, target) {
  s.mode = 'fight';
  if (s._subLane === undefined) s._subLane = (s.id.charCodeAt(s.id.length - 1) % 3) - 1;
  const leash = FIGHT_X_LEASH * 1.8;
  const laneAnchor = s.laneX + s._subLane * 18;
  const desiredX = clamp(target.x, laneAnchor - leash, laneAnchor + leash);
  const dx = desiredX - s.x;
  const dy = target.y - s.y;
  const cspeed = typeof fruitMoveSpeed === 'function' ? fruitMoveSpeed(s, CHASE_SPEED) : CHASE_SPEED;
  const xStep = cspeed * 0.65 * dt_global;
  const yStep = cspeed * dt_global;

  if (Math.abs(dx) > 3) s.x += Math.sign(dx) * Math.min(Math.abs(dx), xStep);
  // 只前进不后退:向敌方城墙方向移动,绝对不向己方城墙方向走
  if (Math.abs(dy) > 3) {
    const fwd = s.side === 'player' ? -1 : 1;
    if (Math.sign(dy) === fwd) {
      const targetDist = Math.abs(dy);
      const minGap = 20; // 保留最小间距,防敌我重合
      if (targetDist > minGap) s.y += fwd * Math.min(targetDist - minGap, yStep);
    }
  }
  if (Math.abs(s.x - s.laneX) > leash + 12) steerToLane(s, 0.12);
  if (state.roundPhase === 'fight') {
    const cy = fieldCenter();
    if (s.side === 'player') s.y = Math.max(s.y, cy + 2);
    else s.y = Math.min(s.y, cy - 2);
  }
  keepInsideBattlefield(s);
}

function kiteAsBackline(s, target) {
  s.mode = 'backline';
  // 后退上限:最多退到战场本侧前 1/3,不再一路退到己方城墙
  const top = fieldTop(), bot = fieldBottom();
  const limitY = top + (bot - top) * (s.side === 'player' ? 0.32 : 0.68);
  if (s.side === 'player' ? s.y >= limitY : s.y <= limitY) return false;
  steerToLane(s, 0.9);
  const dir = s.side === 'player' ? 1 : -1;
  const kspeed = typeof fruitMoveSpeed === 'function' ? fruitMoveSpeed(s, CHASE_SPEED) : CHASE_SPEED;
  s.y += dir * kspeed * 0.50 * dt_global;
  keepInsideBattlefield(s);
  return true;
}

function advanceTowardWall(s) {
  s.target = null;
  const role = (TYPES[s.type] || {}).role || '';
  const isBack = role === 'shooter';
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
      if (ur === 'shooter' || ur === 'wildcard') continue;
      if (!front) front = u;
      else if (s.side === 'player' ? u.y < front.y : u.y > front.y) front = u;
    }
    const spacing = role === 'shooter' ? 70 : 58;
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
  if (state.roundPhase === 'fight') {
    const cy = fieldCenter();
    if (s.side === 'player') s.y = Math.max(s.y, cy + 2);
    else s.y = Math.min(s.y, cy - 2);
  }
}

function wallDataFor(s) {
  const wallY = s.side === 'player' ? LAYOUT.enemyWallY : LAYOUT.playerWallY;
  const wallH = LAYOUT.wallH;
  // v5 战场与城墙之间保留了视觉缓冲带，近战接触线必须落在可移动区域内。
  // 旧值 262/644 超出 fieldTop/fieldBottom(282/628)，导致近战永远无法攻墙。
  const attackY = s.side === 'player' ? fieldTop() : fieldBottom();
  return { wallY, wallH, attackY };
}

function reachedWall(s) {
  const wall = wallDataFor(s);
  return s.side === 'player' ? s.y <= wall.attackY : s.y >= wall.attackY;
}

/* 远程攻城：判断远程兵是否在攻击范围内够得到城墙 */
function canRangedSiege(s) {
  if (spacingGroup(s.type) === 'melee') return false;
  const wall = wallDataFor(s);
  const range = typeof fruitRange === 'function' ? fruitRange(s) : 24;
  const distToWall = s.side === 'player' ? s.y - wall.attackY : wall.attackY - s.y;
  return distToWall <= range * 1.2;
}
/* 远程射弹射物打墙，不移动位置 */
function rangedAttackWall(s) {
  if (!isCombatant(s)) return;
  s.mode = 'backline';
  s.atkTimer -= dt_global;
  if (s.atkTimer > 0) return;
  s.atkTimer = s.rate;
  const wall = wallDataFor(s);
  const siegeMul = Math.max(0.2, s.siege || TYPES[s.type]?.siege || 1);
  const siegeBoost = 1 + (s._bondSiegeBoost || 0);
  const base = Math.round((s.level * 1.25 + s.atk * 0.3) * siegeMul * siegeBoost);
  const dmg = Math.max(1, base);
  state.projectiles.push({
    x: s.x, y: s.y,
    targetX: s.laneX,
    targetY: wall.wallY + wall.wallH / 2,
    dmg, speed: 245,
    color: TYPES[s.type]?.color || '#ff6b4a',
    life: 1.0, side: s.side,
    wallHit: true,
  });
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
  // 攻城排队超时：5 秒没进城就回撤（仅当墙前有阻挡者时退去打阻挡者）
  const hasBlocker = sameLaneBlocker(s, s.side === 'player' ? state.enemySoldiers : state.playerSoldiers);
  if (hasBlocker) {
    s._siegeWaitTimer = (s._siegeWaitTimer || 0) + dt_global;
    if (s._siegeWaitTimer > 5.0) {
      s.mode = 'march';
      s.target = hasBlocker.id;
      delete s._siegeWaitTimer;
      return;
    }
  } else {
    delete s._siegeWaitTimer;
  }
  const row = Math.floor((idx - laneSlotCount()) / laneSlotCount()) + 1;
  const QSPREAD = 22, QROW = 18;
  const offset = ((idx % laneSlotCount()) - (laneSlotCount() - 1) / 2) * QSPREAD;
  const queueY = s.side === 'player' ? wall.attackY + 16 + row * QROW : wall.attackY - 16 - row * QROW;
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

  // 前排攻城位:完整上游链；间距加宽至 28px + Y 错位
  if (idx < slotCount) {
    s.mode = 'siege';
    const WSPREAD = 28;
    const offset = (idx - (slotCount - 1) / 2) * WSPREAD;
    s.x += ((s.laneX + offset) - s.x) * Math.min(1, dt_global * 8);
    s.y = wall.attackY + (idx % 2 === 0 ? 0 : 6);
    s.atkTimer -= dt_global;
    if (s.atkTimer > 0) return;
    const siegeMul = Math.max(0.2, s.siege || TYPES[s.type]?.siege || 1);
    const siegeBoost = 1 + (s._bondSiegeBoost || 0);
    const base = Math.round((s.level * 1.45 + s.atk * 0.3) * siegeMul * siegeBoost);
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
    state.shake = Math.max(state.shake, s.type === 'orange_cannon' ? 0.24 : 0.12);
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

  // 击杀爆发粒子:普通14颗,高等级/大伤害更多
  const killLv = target.level || 1;
  const killParticleCount = Math.min(24, 8 + killLv * 2 + Math.floor((killerAtk || 0) / 8));
  const roleColor = TYPES[target.type]?.color || '#ffd24a';
  for (let j = 0; j < killParticleCount; j++) {
    const angle = (j / killParticleCount) * Math.PI * 2 + Math.random() * 0.3;
    const speed = 30 + Math.random() * 50 + killLv * 5;
    state.fx.push({
      x: target.x + (Math.random() - 0.5) * 10,
      y: target.y + (Math.random() - 0.5) * 10,
      text: ['✦', '●', '▪', '◆'][j % 4],
      color: j % 2 === 0 ? '#ffd24a' : roleColor,
      size: 3 + Math.random() * 4 + killLv * 0.3,
      life: 0.35 + Math.random() * 0.25,
      maxLife: 0.6,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    });
  }
  // 击杀震屏
  state.shake = Math.max(state.shake, Math.min(0.16, 0.06 + killLv * 0.012));

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
  const isBack = typeof fruitIsBackline === 'function' ? fruitIsBackline(s) : (TYPES[s.type]?.role === 'shooter');
  const melee = ['shell','spike','raider'].includes((TYPES[s.type] || {}).role);

  // 近战 stance:距离 >30 先移近,目标在身后时只前进不后退
  if (melee) {
    const d = Math.hypot(s.x - target.x, s.y - target.y);
    if (d > 30) {
      if (!isForwardOf(s, target)) { advanceTowardWall(s); return; }
      moveTowardEnemy(s, target); return;
    }
  }

  const dx = s.x - target.x, dy = s.y - target.y, dist = Math.sqrt(dx*dx + dy*dy);
  if (isBack && !reachedWall(s) && dist < BOW_SAFE_MIN) { if (kiteAsBackline(s, target)) return; }
  if (dist > range) {
    if (!isForwardOf(s, target)) { advanceTowardWall(s); return; }
    moveTowardEnemy(s, target); return;
  }
  if (dist > range + 6) return;

  s.mode = isBack ? 'backline' : 'fight';
  s.atkTimer -= dt_global;
  if (s.atkTimer > 0) return;

  const counterMul = typeof roleCounterMultiplier === 'function' ? roleCounterMultiplier(s.type, target.type) : 1;
  const counterText = typeof roleCounterText === 'function' ? roleCounterText(s.type, target.type) : '';
  const antiRaider = (s._bondAntiRaider || 0) > 0 && (TYPES[target.type]?.role === 'raider') ? (1 + s._bondAntiRaider) : 1;
  let dmg = Math.round(s.atk * counterMul * antiRaider);
  // 暴击:10%基础概率 + 羁绊加成(如双鲨突击+20%)
  const isCrit = Math.random() < (0.10 + (s._bondCritBonus || 0));
  if (isCrit) dmg = Math.round(dmg * 2);
  s.atkTimer = s.rate * (s._bondRateBoost || 1);

  if (isBack && s.type !== 'peach_medic') {
    playSfx('arrow');
    let cherryAoe = false;
    if (s.type === 'cherry_bomber' && (s.level || 1) >= 4) { s._cherryShot = (s._cherryShot || 0) + 1; if (s._cherryShot % 5 === 0) cherryAoe = true; }
    state.projectiles.push({ x: s.x, y: s.y, targetX: target.x, targetY: target.y, targetId: target.id, dmg, speed: s.type === 'blueberry_sniper' ? 315 : 245, color: TYPES[s.type]?.color || '#ff6b4a', life: 1.15, side: s.side, counterHit: !!counterText && counterMul > 1, counterMul: counterMul, ownerType: s.type, ownerLevel: s.level, slow: s.type === 'pear_frost', aoe: cherryAoe, firstHit: s.firstHit, crit: isCrit, bondAoeRange: s._bondAoeRange || 0 });
    s.firstHit = false;
    return;
  }

  playSfx('hit');
  const dealt = typeof applyFruitDamage === 'function' ? applyFruitDamage(target, dmg, s) : dmg;
  if (typeof applyFruitDamage !== 'function') { target.hp -= dealt; }
  trackDamage(s, dealt, false);
  if (s.type === 'pear_frost') { target.slowTimer = 2.2 + s.level * 0.18; target.slowMul = 0.52; }
  triggerHitFeedback(target, s, dealt, { isCrit, counterMul, counterText });
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

  // 已到敌方城墙:优先攻城,不清完面前 blocker 不离开；远程兵可在攻击范围内射墙
  // siege_queue/siege_support 模式保持攻城路径,防排队兵Y漂移后反复进出
  if (reachedWall(s) || canRangedSiege(s) || s.mode === 'siege_queue' || s.mode === 'siege_support' || s.mode === 'siege') {
    const blocker = sameLaneBlocker(s, enemies);
    if (blocker) {
      s.target = blocker.id;
      s.mode = 'fight';
      attackTarget(s, blocker);
      return;
    }
    if (spacingGroup(s.type) === 'melee') {
      attackWall(s);
    } else {
      rangedAttackWall(s);
    }
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
    // 近战转路收敛:只追Y距离近的目标,防远路画圈
    if (typeof isMeleeRoleLB === 'function' && isMeleeRoleLB(s.type) && target.laneIndex !== s.laneIndex && Math.abs(s.y - target.y) < 100) {
      const tLaneX = laneXByIndex(clamp(target.laneIndex, 0, COLS - 1));
      const step = 140 * dt_global;
      s.laneX += Math.sign(tLaneX - s.laneX) * Math.min(Math.abs(tLaneX - s.laneX), step);
    }
    // 平滑切路后同步 laneIndex,确保 applySeparation 能正确识别同路
    if (typeof isMeleeRoleLB === 'function' && isMeleeRoleLB(s.type) && target.laneIndex !== s.laneIndex && Math.abs(s.y - target.y) < 100) {
      if (Math.abs(s.laneX - laneXByIndex(clamp(target.laneIndex, 0, COLS - 1))) < 20) {
        s.laneIndex = clamp(target.laneIndex, 0, COLS - 1);
        delete s._subLane;
      }
    }
    s.target = target.id;
    attackTarget(s, target);
    return;
  }
  advanceTowardWall(s);
  // 记录当前模式供下次切换冷却检测(当前未启用)
  s._prevMode = s.mode;
}

/* V3: 角色感知分离力 — 加大检测半径 + 按间距分组加权 + 硬间距阶段 */
function applySeparation(soldiers) {
  const SEP_DIST = 50;
  const MIN_SPACING = 28;
  for (let i = 0; i < soldiers.length; i++) {
    const a = soldiers[i];
    if (!isCombatant(a)) continue;
    const inFight = a.mode === 'fight' || a.mode === 'backline';
    let fx = 0, fy = 0;
    for (let j = 0; j < soldiers.length; j++) {
      if (i === j) continue;
      const b = soldiers[j];
      if (!isCombatant(b)) continue;
      if (Math.abs(a.x - b.x) > (CELL + GAP) * 1.2) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // 软分离
      if (dist < SEP_DIST && dist > 0.1) {
        const w = sepWeight(a, b);
        const fightMul = inFight ? 0.55 : 1.0;
        const force = (SEP_DIST - dist) / SEP_DIST * w * fightMul;
        fx += (dx / dist) * force;
        if (!inFight) fy += (dy / dist) * force * 0.80;
      } else if (dist <= 0.1) {
        fx += (i % 2 === 0 ? 1 : -1) * 0.45 * (inFight ? 0.55 : 1.0);
        if (!inFight) fy += (i % 3 - 1) * 0.12;
      }
      if (dist < MIN_SPACING && dist > 0.1) {
        const w = sepWeight(a, b);
        const push = (MIN_SPACING - dist) / 2 * w * 0.6;
        fx += (dx / dist) * push;
        if (!inFight) {
          const sieging = b.mode === 'siege' || b.mode === 'siege_queue' || b.mode === 'siege_support';
          if (!sieging) fy += (dy / dist) * push * 0.5;
        } // 战斗中Y靠 minGap=20 防重合,不再加推开力防振荡
      }
    }
    if (fx || fy) {
      const speed = 42 * dt_global;
      const leash = FIGHT_X_LEASH * 1.8;
      const nextX = a.x + fx * speed;
      a.x = clamp(nextX, a.laneX - leash, a.laneX + leash);
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
    // wallHit 弹射物:到期直接扣墙
    if (p.wallHit) {
      if (p.life <= 0) {
        if (p.side === 'player') {
          state.enemyWallHp = Math.max(0, state.enemyWallHp - p.dmg);
          state.enemyWallDamageDealt += p.dmg;
        } else {
          state.playerWallHp = Math.max(0, state.playerWallHp - p.dmg);
        }
        state.attackFx.push({ x1: p.x, y1: p.y, x2: p.targetX, y2: p.targetY, life: 0.22, maxLife: 0.22 });
        state.projectiles.splice(i, 1);
      }
      continue;
    }
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
      if (p.side === 'player') state.damageByType[p.ownerType || 'bow'] = (state.damageByType[p.ownerType || 'bow'] || 0) + p.dmg;
      const pcm = p.counterMul || (p.counterHit ? 1.3 : 1);
      triggerHitFeedback(tgt, null, p.dmg, {
        isCrit: !!p.crit,
        counterMul: pcm,
        isProjectile: true,
        projectileColor: p.color || '#ffd24a',
        ownerType: p.ownerType || 'bow',
      });
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

/* ——— 回合制战场管理 ——— */

function clearAllStatus(s) {
  if (!s) return;
  if (s.statusEffects) {
    for (const key of Object.keys(s.statusEffects)) {
      s.statusEffects[key].timer = 0;
    }
  }
  s.stunTimer = 0;
  s.slowTimer = 0;
  s.slowMul = 1;
}

function roundSpawnAll() {
  const groups = [
    { slots: state.playerSlots, side: 'player' },
    { slots: state.enemySlots, side: 'enemy' },
  ];
  for (const grp of groups) {
    const soldiers = grp.side === 'player' ? state.playerSoldiers : state.enemySoldiers;
    const alive = soldiers.filter(s => s.alive).length;
    const remaining = Math.max(0, MAX_SOLDIERS - alive);
    if (remaining <= 0) continue;
    const candidates = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ball = grp.slots[r][c];
        if (!ball) continue;
        candidates.push({ ball, r, c });
      }
    }
    // A full 3x5 board has more barracks than the battlefield cap. Select the
    // strongest barracks first instead of silently excluding the bottom row.
    candidates.sort((a, b) =>
      (Number(b.ball.level) || 1) - (Number(a.ball.level) || 1)
      || a.r - b.r || a.c - b.c);
    const selected = candidates.slice(0, remaining);
    const spawnFn = typeof spawnSoldierFromBall === 'function' ? spawnSoldierFromBall : null;
    for (const entry of selected) {
      if (spawnFn) spawnFn(entry.ball, entry.r, entry.c, grp.side);
      // Cooldown is not part of the round model. Keep the barracks ready so
      // renderers cannot show a countdown that has no gameplay effect.
      entry.ball.spawnTimer = 0;
    }
    state.roundReserveCount = state.roundReserveCount || { player: 0, enemy: 0 };
    state.roundReserveCount[grp.side] = Math.max(0, candidates.length - selected.length);
  }
}

function startBreach(winnerSide) {
  state.roundPhase = 'breach';
  const winners = winnerSide === 'player' ? state.playerSoldiers : state.enemySoldiers;
  state.breachList = winners.filter(isCombatant).map(s => s.id);
  // 清除所有兵状态
  for (const s of [...state.playerSoldiers, ...state.enemySoldiers]) {
    if (s && s.alive) clearAllStatus(s);
  }
}

function roundBreachDamage(s) {
  const level = Math.max(1, Number(s && s.level) || 1);
  const tags = (TYPES[s.type] && TYPES[s.type].tags) || [];
  const siegeBonus = tags.includes('siege') ? 1 : 0;
  return 1 + Math.floor(level / 2) + siegeBonus;
}

function roundSideScore(list) {
  return list.filter(isCombatant).reduce((score, s) => {
    const hp = Math.max(0, Number(s.hp) || 0);
    const atk = Math.max(0, Number(s.atk) || 0);
    return score + hp + atk * 2;
  }, 0);
}

function resolveTimedRound() {
  const player = state.playerSoldiers.filter(isCombatant);
  const enemy = state.enemySoldiers.filter(isCombatant);
  const pScore = roundSideScore(player);
  const eScore = roundSideScore(enemy);
  const spread = Math.abs(pScore - eScore) / Math.max(1, pScore, eScore);

  if (spread < 0.05) {
    for (const s of [...player, ...enemy]) { s.alive = false; s.hp = 0; }
    state.playerSoldiers = state.playerSoldiers.filter(s => s.alive);
    state.enemySoldiers = state.enemySoldiers.filter(s => s.alive);
    state.roundPhase = 'prepare';
    state.roundTimer = ROUND_PREPARE_BETWEEN;
    state._roundSpawned = false;
    return;
  }

  const winnerSide = pScore > eScore ? 'player' : 'enemy';
  const losers = winnerSide === 'player' ? enemy : player;
  for (const s of losers) { s.alive = false; s.hp = 0; }
  state.playerSoldiers = state.playerSoldiers.filter(s => s.alive);
  state.enemySoldiers = state.enemySoldiers.filter(s => s.alive);
  startBreach(winnerSide);
}

function breachChargeMove(s) {
  const wallY = s.side === 'player' ? fieldTop() : fieldBottom();
  const dir = s.side === 'player' ? -1 : 1;
  s.y += dir * SIEGE_SPEED * 2 * dt_global;
  if ((s.side === 'player' && s.y <= wallY) || (s.side !== 'player' && s.y >= wallY)) {
    damageReefBarrier(s.side === 'player' ? 'enemy' : 'player', roundBreachDamage(s), s);
    state.attackFx.push({ x1: s.x - 8, y1: wallY, x2: s.x + 8, y2: wallY, life: 0.3, maxLife: 0.3 });
    for (let k = 0; k < 6; k++) {
      state.fx.push({ x: s.x + (Math.random() - 0.5) * 16, y: s.y + (Math.random() - 0.5) * 12,
        color: '#ffd24a', size: 3 + Math.random() * 3, life: 0.3 + Math.random() * 0.2, maxLife: 0.5,
        vx: (Math.random() - 0.5) * 50, vy: (Math.random() - 0.5) * 40 });
    }
    s.alive = false; s.hp = 0;
  }
}

function tickBreach() {
  const allSoldiers = [...state.playerSoldiers, ...state.enemySoldiers];
  for (const s of allSoldiers) {
    if (!s.alive) continue;
    if (state.breachList.includes(s.id)) {
      breachChargeMove(s);
    }
  }
  state.playerSoldiers = state.playerSoldiers.filter(s => s.alive);
  state.enemySoldiers = state.enemySoldiers.filter(s => s.alive);
  const aliveIds = new Set([
    ...state.playerSoldiers.map(s => s.id),
    ...state.enemySoldiers.map(s => s.id),
  ]);
  state.breachList = state.breachList.filter(id => aliveIds.has(id));
  if (state.breachList.length === 0) {
    state.roundPhase = 'prepare';
    state.roundTimer = ROUND_PREPARE_BETWEEN;
    state._roundSpawned = false;
  }
}

function updateCombat() {
  if (state.phase !== 'playing') return;
  _wrapVfxArrays();

  // The match clock is authoritative in every round phase, including prepare
  // and breach. Previously a charge animation could run past the configured
  // PvE limit because only the fight phase performed this check.
  if (state.mode !== 'pvp' && (state.time || 0) >= battleTimeLimit()) {
    const pPct = state.playerWallHp / Math.max(1, state.playerWallMax);
    const ePct = state.enemyWallHp / Math.max(1, state.enemyWallMax);
    const win = pPct > ePct + 0.02 || (Math.abs(pPct - ePct) <= 0.02 && (state.enemyWallDamageDealt || 0) > (state.playerWallDamageTaken || 0));
    state.lastBattleReport = buildBattleReport(win);
    state.phase = win ? 'won' : 'lost';
    onGameOver(win);
    return;
  }

  // === 回合状态机调度 ===
  if (state.roundPhase === 'idle') {
    state.roundPhase = 'prepare';
    state.roundTimer = ROUND_PREPARE_INITIAL;
    state._roundSpawned = false;
  }
  if (state.roundPhase === 'prepare') {
    state.roundTimer = Math.max(0, state.roundTimer - dt_global);
    if (state.roundTimer > 0) return;
    state.roundPhase = 'fight';
    state.roundTimer = 0;
  }
  if (state.roundPhase === 'breach') {
    tickBreach();
    if (state.playerWallHp <= 0) { state.lastBattleReport = buildBattleReport(false); state.phase = 'lost'; onGameOver(false); }
    else if (state.enemyWallHp <= 0) { state.lastBattleReport = buildBattleReport(true); state.phase = 'won'; onGameOver(true); }
    return;
  }

  // === FIGHT 阶段：回合出兵 ===
  if (!state._roundSpawned) {
    state._roundSpawned = true;
    state.roundIndex++;
    if (typeof roundSpawnAll === 'function') roundSpawnAll();
  }

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
  // preFightTick: 阵型排位刷新
  if (typeof _preFightTick === 'function') _preFightTick();
  for (const s of state.playerSoldiers) updateSoldier(s, state.enemySoldiers);
  for (const s of state.enemySoldiers) updateSoldier(s, state.playerSoldiers);
  state.playerSoldiers = state.playerSoldiers.filter(s => s.alive);
  state.enemySoldiers = state.enemySoldiers.filter(s => s.alive);

  applySeparation(state.playerSoldiers); applySeparation(state.enemySoldiers);
  updateProjectiles(); updateLaneStats(); updateLaneAlerts();
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt_global * 4);

  // FIGHT 结束检测：一方全灭 → BREACH（最少战斗 3 秒，给兵出城时间）
  state.roundTimer += dt_global;
  if (state.roundTimer > 3.0) {
    const _pAlive = state.playerSoldiers.filter(isCombatant).length;
    const _eAlive = state.enemySoldiers.filter(isCombatant).length;
    if (_pAlive === 0 || _eAlive === 0) {
      if (_pAlive === 0 && _eAlive === 0) {
        state.roundPhase = 'prepare';
        state.roundTimer = ROUND_PREPARE_BETWEEN;
        state._roundSpawned = false;
      } else {
        startBreach(_pAlive > 0 ? 'player' : 'enemy');
      }
      return;
    }
    if (state.roundTimer >= ROUND_FIGHT_LIMIT) {
      resolveTimedRound();
      return;
    }
  }

  // Boss tick(原 boss_v63)
  if (typeof bossTick === 'function') bossTick(dt_global || 0.016);

  if (state.playerWallHp <= 0) { state.lastBattleReport = buildBattleReport(false); state.phase = 'lost'; onGameOver(false); }
  else if (state.enemyWallHp <= 0) { state.lastBattleReport = buildBattleReport(true); state.phase = 'won'; onGameOver(true); }
  // 计时器:治无限局(combat-fixes-plan §2A)。PvP 由 pvp-sim 独立判定,不参与。
  else if (state.mode !== 'pvp' && (state.time || 0) >= battleTimeLimit()) {
    const pPct = state.playerWallHp / Math.max(1, state.playerWallMax);
    const ePct = state.enemyWallHp / Math.max(1, state.enemyWallMax);
    const win = pPct > ePct + 0.02 || (Math.abs(pPct - ePct) <= 0.02 && (state.enemyWallDamageDealt || 0) > (state.playerWallDamageTaken || 0));
    state.lastBattleReport = buildBattleReport(win);
    state.phase = win ? 'won' : 'lost';
    onGameOver(win);
  }
}

/* ——— 开放战场模式注册口 ——— */
// free_battle_v2.js 加载后调用此函数,替换为核心战斗函数。
// 这样做的好处:combat.js 拥有注册权,所有改动都在 combat.js 可追溯。
window.__useFreeBattleCombat = function __useFreeBattleCombat(api) {
  if (!api) return;
  canSeeTarget = api.canSeeTarget;
  findTarget = api.findTarget;
  moveTowardEnemy = api.moveTowardEnemy;
  kiteAsBackline = api.kiteAsBackline;
  advanceTowardWall = api.advanceTowardWall;
  sameLaneBlocker = api.sameLaneBlocker;
  updateSoldier = api.updateSoldier;
  applySeparation = api.applySeparation;
  if (api.preFightTick) _preFightTick = api.preFightTick;
};
