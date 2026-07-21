/* 梦幻水世界 · 开放式 2D 自由战场（不读取棋盘列与路线状态）。 */
(function installFreeBattleV2(global) {
  'use strict';

  function stableHash(value) {
    let h = 2166136261;
    for (const ch of String(value || '')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function freeSpawnX(type, spawnIndex, side, ignoredBoardColumn) {
    const pad = 46;
    const hash = stableHash(`${type}|${spawnIndex}|${side}`);
    return Math.round(pad + (hash % Math.max(1, (W - pad * 2))));
  }

  function freeSiegeX(s) {
    if (!Number.isFinite(s._freeSiegeX)) {
      // 用实际位置就近计算攻城坐标,避免跨战场斜向走位
      const pad = 38;
      const posX = s.laneX || s.x || Math.random() * (W - pad * 2);
      const col = Math.round((posX - pad) / ((W - pad * 2) / COLS));
      s._freeSiegeX = Math.round(pad + col * ((W - pad * 2) / COLS));
    }
    return s._freeSiegeX;
  }

  function worldTideState(time) {
    const t = ((Number(time) || 0) % 24 + 24) % 24;
    const surge = t >= 12;
    return { phase: surge ? 'surge' : 'calm', remaining: Math.ceil((surge ? 24 : 12) - t), multiplier: surge ? 1.08 : 1 };
  }

  function reefKeys(side) {
    const prefix = side === 'player' ? 'player' : 'enemy';
    return { hp:`${prefix}WallHp`, max:`${prefix}WallMax`, shield:`${prefix}ReefShield`, used:`${prefix}ReefShieldUsed`, until:`${prefix}ReefShieldUntil` };
  }

  function damageReefBarrier(side, amount, source) {
    const keys = reefKeys(side);
    let damage = Math.max(0, Number(amount) || 0);
    if ((state[keys.until] || 0) <= (state.time || 0)) state[keys.shield] = 0;
    const absorbed = Math.min(damage, Math.max(0, Number(state[keys.shield]) || 0));
    state[keys.shield] = Math.max(0, (Number(state[keys.shield]) || 0) - absorbed);
    damage -= absorbed;
    const before = Math.max(0, Number(state[keys.hp]) || 0);
    state[keys.hp] = Math.max(0, before - damage);
    if (!state[keys.used] && state[keys.max] > 0 && state[keys.hp] / state[keys.max] <= 0.30) {
      state[keys.used] = true;
      state[keys.shield] = Math.round(state[keys.max] * 0.10);
      state[keys.until] = (state.time || 0) + 5;
    }
    if (source && source.side === 'player') {
      state.enemyWallDamageDealt = (state.enemyWallDamageDealt || 0) + damage;
      if (typeof trackDamage === 'function') trackDamage(source, damage, true);
    } else if (side === 'player') state.playerWallDamageTaken = (state.playerWallDamageTaken || 0) + damage;
    return { requested: Number(amount) || 0, absorbed, applied: damage, hp: state[keys.hp], shield: state[keys.shield] };
  }

  function freeRole(type) {
    const role = TYPES[type]?.role || 'shell';
    if (role === 'shell') return 'tank';
    if (role === 'spike') return 'front';
    if (role === 'shooter') return 'ranged';
    return role; // raider→raider, wildcard→wildcard
  }

  function ownBarrierY(s) { return s.side === 'player' ? LAYOUT.playerWallY : LAYOUT.enemyWallY + LAYOUT.wallH; }
  function barrierThreat(s, e) {
    const y = ownBarrierY(s);
    return Math.max(0, 240 - Math.abs(e.y - y)) / 240;
  }
  function threatOf(s, e) {
    const er = freeRole(e.type);
    return (e.atk || 0) * 1.6 + (e.level || 1) * 6 + barrierThreat(s, e) * 150 + (er === 'siege' ? 55 : 0);
  }
  function controlled(e) {
    const fx = e.statusEffects || {};
    return !!(fx.frozen?.timer > 0 || fx.stunned?.timer > 0 || e.stunTimer > 0);
  }

  function canSeeTargetFree(s, e) {
    return !!(isCombatant(s) && isCombatant(e) && Math.hypot(e.x - s.x, e.y - s.y) <= 620 && !(typeof isInvisible === 'function' && isInvisible(e)));
  }

  function findTargetFree(s, enemies) {
    if (!isCombatant(s)) return null;
    const sticky = soldierById(enemies, s.target);
    if (sticky && canSeeTargetFree(s, sticky) && Math.hypot(sticky.x - s.x, sticky.y - s.y) <= 520) return sticky;
    const role = freeRole(s.type);
    let best = null, bestScore = -Infinity;
    for (const e of enemies) {
      if (!canSeeTargetFree(s, e)) continue;
      const er = freeRole(e.type);
      const dist = Math.hypot(e.x - s.x, e.y - s.y);
      // 朝前优先:敌方应该在兵的前进方向(玩家向下/敌方向上),否则降权
      const forward = s.side === 'player' ? e.y <= s.y : e.y >= s.y;
      let score = threatOf(s, e) - dist * 0.18 + (1 - Math.max(0, e.hp) / Math.max(1, e.maxHp)) * 35;
      if (!forward && dist > 52) score -= 120; // 后方目标降权,避免后撤追敌
      if (role === 'tank' || role === 'front') score += barrierThreat(s, e) * 230 + (['raider'].includes(er) ? 80 : 0);
      if (role === 'front') score += controlled(e) ? -180 : 110; // 枪刺兵:优先打受控的敌人
      if (role === 'raider') score += ['ranged'].includes(er) ? 220 : 0;
      if (role === 'ranged') score += dist <= combatRange(s) ? 75 : 0;
      if (s.target === e.id) score += 120;
      // 深入敌阵时,后方目标额外降权
      const midY = fieldTop() + (fieldBottom() - fieldTop()) * 0.5;
      const deepAdvance = s.side === 'player' ? s.y < midY : s.y > midY;
      if (!forward && deepAdvance) score -= 200;
      if (score > bestScore || (score === bestScore && String(e.id) < String(best?.id || ''))) { best = e; bestScore = score; }
    }
    // 所有目标分数为负 → 没有值得追的敌人 → 直接攻城推进
    if (best && bestScore < 0) return null;
    s.target = best ? best.id : null;
    return best;
  }

  function moveVector(s, tx, ty, multiplier = 1) {
    const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy);
    if (d <= 0.5) return;
    const tide = worldTideState(state.time).multiplier;
    const base = typeof fruitMoveSpeed === 'function' ? fruitMoveSpeed(s, CHASE_SPEED) : (s.move || CHASE_SPEED);
    const step = Math.min(d, base * multiplier * tide * dt_global);
    s.x += dx / d * step; s.y += dy / d * step;
    keepInsideBattlefield(s);
  }

  function moveTowardEnemyFree(s, target) {
    s.mode = 'fight';
    const offset = (stableHash(`${s.id}|offset`) % 31) - 15;
    moveVector(s, clamp(target.x + offset, 24, W - 24), target.y, 1);
  }
  function kiteFree(s, target) {
    s.mode = 'backline';
    const dx = s.x - target.x, dy = s.y - target.y, d = Math.max(1, Math.hypot(dx, dy));
    moveVector(s, clamp(s.x + dx / d * 70, 24, W - 24), clamp(s.y + dy / d * 70, fieldTop(), fieldBottom()), .82);
  }
  function advanceFree(s) {
    s.target = null; s.mode = 'march';
    const targetY = s.side === 'player' ? fieldTop() : fieldBottom();
    moveVector(s, freeSiegeX(s), targetY, freeRole(s.type) === 'raider' ? 1 : .86); // 游骑兵冲刺速度1.0,其他0.86
  }

  function nearestBlocker(s, enemies, maxDistance) {
    let best = null, dist = Infinity;
    for (const e of enemies) if (isCombatant(e)) {
      const d = Math.hypot(e.x - s.x, e.y - s.y);
      if (d <= maxDistance && d < dist) { best = e; dist = d; }
    }
    return best;
  }

  function woundedAlly(s) {
    const allies = s.side === 'player' ? state.playerSoldiers : state.enemySoldiers;
    return allies.filter(a => a !== s && isCombatant(a) && a.hp < a.maxHp * .92)
      .sort((a,b) => a.hp / a.maxHp - b.hp / b.maxHp || String(a.id).localeCompare(String(b.id)))[0] || null;
  }

  function updateSoldierFree(s, enemies) {
    if (!s.alive) return;
    if (typeof isDisabled === 'function' && isDisabled(s)) return;
    if (!isCombatant(s)) { moveOutOfCastle(s); return; }
    const role = freeRole(s.type);
    if (role === 'support') {
      const ally = woundedAlly(s);
      if (ally && Math.hypot(ally.x - s.x, ally.y - s.y) > 52) { s.mode = 'support'; moveVector(s, ally.x, ally.y + (s.side === 'player' ? 42 : -42), .8); return; }
    }
    if (reachedWall(s)) {
      // 到墙了:先找面前敌人,有就打,没就撞墙
      const blockers = enemies.filter(e => isCombatant(e) && Math.hypot(e.x - s.x, e.y - s.y) <= (role === 'siege' ? 52 : 150)
        && (Math.hypot(e.x - s.x, e.y - s.y) < 50 || (s.side === 'player' ? e.y <= s.y + 18 : e.y >= s.y - 18)));
      const blocker = blockers.length ? blockers.reduce((a, b) => Math.hypot(a.x - s.x, a.y - s.y) < Math.hypot(b.x - s.x, b.y - s.y) ? a : b) : null;
      if (blocker) { s.target = blocker.id; attackTarget(s, blocker); return; }
      ramWall(s);
      return;
    }
    const target = role === 'siege' ? nearestBlocker(s, enemies, 64) : findTargetFree(s, enemies);
    if (target) { s.target = target.id; attackTarget(s, target); return; }
    advanceFree(s);
  }

  function applySeparationFree(soldiers) {
    for (let i = 0; i < soldiers.length; i++) {
      const a = soldiers[i]; if (!isCombatant(a)) continue;
      let px = 0, py = 0;
      for (let j = 0; j < soldiers.length; j++) {
        if (i === j || !isCombatant(soldiers[j])) continue;
        const b = soldiers[j], dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
        if (d > 0 && d < 34) { const f = (34 - d) / 34; px += dx / d * f; py += dy / d * f; }
        else if (d === 0) px += stableHash(a.id) % 2 ? .4 : -.4;
      }
      a.x = clamp(a.x + px * 34 * dt_global, 24, W - 24);
      if (!String(a.mode).startsWith('siege')) a.y = clamp(a.y + py * 24 * dt_global, fieldTop(), fieldBottom());
    }
  }

  function attackWallFree(s) {
    if (!isCombatant(s)) return;
    const wall = wallDataFor(s), x = freeSiegeX(s);
    s.mode = 'siege'; s.siegeSlot = stableHash(s.id) % 12;
    s.x += (x - s.x) * Math.min(1, dt_global * 7); s.y = wall.attackY;
    s.atkTimer -= dt_global * worldTideState(state.time).multiplier;
    if (s.atkTimer > 0) return;
    const siegeMul = Math.max(.2, s.siege || TYPES[s.type]?.siege || 1);
    const dmg = Math.max(1, Math.round((s.level * (s.side === 'player' ? 1.45 : 1.25) + s.atk * (s.side === 'player' ? .105 : .075)) * siegeMul));
    damageReefBarrier(s.side === 'player' ? 'enemy' : 'player', dmg, s);
    state.attackFx.push({ x1:s.x-8, y1:wall.attackY, x2:s.x+8, y2:wall.wallY+wall.wallH/2, life:.22, maxLife:.22 });
    s.atkTimer = WALL_ATTACK_INTERVAL;
  }

  function rangedAttackWallFree(s) {
    if (!isCombatant(s)) return;
    s.mode = 'siege';
    s.atkTimer -= dt_global * worldTideState(state.time).multiplier;
    if (s.atkTimer > 0) return;
    const wall = wallDataFor(s), siegeMul = Math.max(.2, s.siege || TYPES[s.type]?.siege || 1);
    const openFieldBalance = freeRole(s.type) === 'siege' ? .64 : 1;
    const dmg = Math.max(1, Math.round((s.level * 1.25 + s.atk * .085) * siegeMul * openFieldBalance));
    damageReefBarrier(s.side === 'player' ? 'enemy' : 'player', dmg, s);
    state.projectiles.push({ x:s.x, y:s.y, targetX:freeSiegeX(s), targetY:wall.wallY+wall.wallH/2, dmg:0, speed:245, color:TYPES[s.type]?.color || '#7de6ff', life:.35, side:s.side, reefVisual:true });
    s.atkTimer = s.rate;
  }

  // 兵撞墙:清完面前兵→到墙→扣1血→兵消失
  function ramWall(s) {
    if (!isCombatant(s)) return;
    const wall = wallDataFor(s);
    // 撞墙前检查:面前还有敌人就不能撞
    const ramFoes = (s.side === 'player' ? state.enemySoldiers : state.playerSoldiers) || [];
    const ramBlocker = ramFoes.find(e => isCombatant(e) && Math.hypot(e.x - s.x, e.y - s.y) < 60
      && (s.side === 'player' ? e.y <= s.y + 25 : e.y >= s.y - 25));
    if (ramBlocker) { s.target = ramBlocker.id; attackTarget(s, ramBlocker); return; }
    // 撞墙 -1血,兵消失
    s.alive = false; s.hp = 0;
    const side = s.side === 'player' ? 'enemy' : 'player';
    damageReefBarrier(side, 1, s);
    // 撞墙粒子
    for (let k = 0; k < 6; k++) {
      state.fx.push({ x: s.x + (Math.random() - 0.5) * 16, y: wall.attackY + (Math.random() - 0.5) * 12,
        color: '#ffd24a', size: 3 + Math.random() * 3, life: 0.3 + Math.random() * 0.2, maxLife: 0.5,
        vx: (Math.random() - 0.5) * 50, vy: (Math.random() - 0.5) * 40 });
    }
  }

  function updateBattlePressure() {
    function sidePressure(list, side) {
      const alive = list.filter(isCombatant);
      const power = alive.reduce((n,u) => n + (u.atk || 0) + (u.hp || 0) * .32 + (u.level || 1) * 3, 0);
      const siege = alive.filter(u => freeRole(u.type) === 'siege' || reachedWall(u)).length;
      const depth = alive.length ? alive.reduce((n,u) => n + (side === 'player' ? (fieldBottom()-u.y) : (u.y-fieldTop())) / Math.max(1, LAYOUT.fieldH), 0) / alive.length : 0;
      return { power:Math.round(power), count:alive.length, siege, depth:Math.max(0, Math.min(1, depth)) };
    }
    state.battlePressure = {
      player: sidePressure(state.playerSoldiers, 'player'), enemy: sidePressure(state.enemySoldiers, 'enemy'),
      playerBarrierDanger: 1 - state.playerWallHp / Math.max(1, state.playerWallMax),
      enemyBarrierDanger: 1 - state.enemyWallHp / Math.max(1, state.enemyWallMax),
    };
    state.tide = worldTideState(state.time);
  }

  function buildBattleReportFree(win) {
    let bestType = '', bestDamage = 0;
    for (const [type,dmg] of Object.entries(state.damageByType || {})) if (dmg > bestDamage) { bestType=type; bestDamage=dmg; }
    const tips = [];
    if (bestType) tips.push(`本局主力：${TYPES[bestType].name}，单位伤害 ${Math.round(bestDamage)}`);
    tips.push(`总攻城伤害：${Math.round(state.enemyWallDamageDealt || 0)}`);
    tips.push(`堡垒承伤：${Math.round(state.playerWallDamageTaken || 0)}`);
    if (!win) tips.push('建议：根据敌方职责调整前排、突击与辅助比例。');
    return { bestType, bestDamage:Math.round(bestDamage), siegeDamage:Math.round(state.enemyWallDamageDealt || 0), barrierDamage:Math.round(state.playerWallDamageTaken || 0), tips };
  }

  global.freeSpawnX = freeSpawnX;
  global.worldTideState = worldTideState;
  global.damageReefBarrier = damageReefBarrier;
  // 通过 combat.js 的注册口替换战斗函数,不再直接覆盖
  if (typeof global.__useFreeBattleCombat === 'function') {
    global.__useFreeBattleCombat({
      canSeeTarget: canSeeTargetFree,
      findTarget: findTargetFree,
      moveTowardEnemy: moveTowardEnemyFree,
      kiteAsBackline: kiteFree,
      advanceTowardWall: advanceFree,
      sameLaneBlocker: (s, enemies) => nearestBlocker(s, enemies, 120),
      updateSoldier: updateSoldierFree,
      applySeparation: applySeparationFree,
    });
  }
  global.ramWall = ramWall;
  global.updateLaneStats = updateBattlePressure; // 覆盖旧版updateLaneStats为战斗压力统计
  global.updateLaneAlerts = function () { state.laneAlerts = []; };
  global.buildBattleReport = buildBattleReportFree;

  if (typeof global.addFx === 'function' && !global.addFx._waterThemeV2) {
    const previousAddFx = global.addFx;
    global.addFx = function addWaterThemeFx(x,y,message,color,size) {
      return previousAddFx(x,y,typeof worldThemeText === 'function' ? worldThemeText(message) : message,color,size);
    };
    global.addFx._waterThemeV2 = true;
  }

  if (typeof spawnSoldierFromBall === 'function' && !spawnSoldierFromBall._freeBattleV2) {
    const previousSpawn = spawnSoldierFromBall;
    spawnSoldierFromBall = function spawnFreeBattle(ball, r, c, side, forced) {
      const soldier = previousSpawn(ball, r, c, side, forced);
      if (!soldier) return soldier;
      state._freeSpawnSerial = state._freeSpawnSerial || { player:0, enemy:0 };
      const serial = ++state._freeSpawnSerial[side];
      soldier.x = freeSpawnX(soldier.type, serial, side, c);
      soldier.laneIndex = 0; soldier.laneX = soldier.x;
      return soldier;
    };
    spawnSoldierFromBall._freeBattleV2 = true;
  }
})(typeof window !== 'undefined' ? window : globalThis);
