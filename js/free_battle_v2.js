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

  function worldTideState() {
    return { phase: 'calm', remaining: 0, multiplier: 1 };
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
    if (source && source.side === 'player') {
      state.enemyWallDamageDealt = (state.enemyWallDamageDealt || 0) + damage;
      if (typeof trackDamage === 'function') trackDamage(source, damage, true);
    } else if (side === 'player') state.playerWallDamageTaken = (state.playerWallDamageTaken || 0) + damage;
    return { requested: Number(amount) || 0, absorbed, applied: damage, hp: state[keys.hp], shield: state[keys.shield] };
  }

  function freeRole(type) {
    if (typeof combatRoleOfType === 'function') return combatRoleOfType(type);
    const role = TYPES[type]?.role || 'shell';
    if (role === 'shell') return 'tank';
    if (role === 'spike') return 'front';
    if (role === 'shooter') return 'ranged';
    return role; // raider→raider, wildcard→wildcard
  }

  function formationBand(s) {
    const role = freeRole(s.type);
    if (role === 'lancer' || role === 'tank' || role === 'front') return 0;
    if (role === 'cavalry' || role === 'raider' || role === 'rush' || role === 'siege') return 1;
    return 2;
  }

  function assignFormationRanks() {
    state._formationSignatures = state._formationSignatures || {};
    for (const side of ['player', 'enemy']) {
      const soldiers = side === 'player' ? state.playerSoldiers : state.enemySoldiers;
      const active = soldiers.filter(isCombatant);
      const signature = active.map(s => `${s.id}:${freeRole(s.type)}`).join('|');
      if (state._formationSignatures[side] === signature) continue;
      state._formationSignatures[side] = signature;
      const byBand = [[], [], []];
      for (const s of active) {
        byBand[formationBand(s)].push(s);
      }
      for (let band = 0; band < byBand.length; band++) {
        const squad = byBand[band].sort((a, b) => String(a.id).localeCompare(String(b.id)));
        const pad = 52;
        squad.forEach((s, idx) => {
          const anchor = squad.length === 1
            ? W / 2
            : pad + idx * ((W - pad * 2) / Math.max(1, squad.length - 1));
          s._formationBand = band;
          s._formationSlot = idx;
          s._formationPosition = band * 5 + idx;
          s._formationAnchorX = Math.round(anchor);
          s._formationDepthOffset = ((idx % 3) - 1) * 4;
        });
      }
    }
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
      const targetRank = e._formationPosition !== undefined && e._formationPosition !== null ? Math.floor(e._formationPosition / 5) : 1;
      const rankBonus = Math.max(0, 2 - targetRank) * 45;
      let score = threatOf(s, e) - dist * 0.18 + (1 - Math.max(0, e.hp) / Math.max(1, e.maxHp)) * 35 + rankBonus;
      if (!forward && dist > 52) score -= 120; // 后方目标降权,避免后撤追敌
      if (role === 'lancer') score += er === 'cavalry' ? 45 : er === 'archer' ? -20 : 0;
      if (role === 'cavalry') score += er === 'archer' ? 45 : er === 'support' ? 25 : er === 'lancer' ? -20 : 0;
      if (role === 'archer') score += er === 'lancer' ? 45 : er === 'cavalry' ? -20 : 0;
      if (role === 'tank' || role === 'front') score += barrierThreat(s, e) * 230 + (['raider'].includes(er) ? 80 : 0);
      if (role === 'front') score += controlled(e) ? -180 : 110; // 枪刺兵:优先打受控的敌人
      if (role === 'raider') score += ['ranged'].includes(er) ? 220 : 0;
      if (role === 'ranged' || role === 'archer') score += dist <= combatRange(s) ? 75 : 0;
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
    const dt = typeof dt_global === 'number' ? dt_global : 1/60;
    const tide = worldTideState(state.time).multiplier;
    const base = typeof fruitMoveSpeed === 'function' ? fruitMoveSpeed(s, CHASE_SPEED) : (s.move || CHASE_SPEED);
    const step = Math.min(d, base * multiplier * tide * dt);
    s.x += dx / d * step; s.y += dy / d * step;
    // 前方有敌兵(含棋盘/待命)时钳制在阵型zone内,清完自动放行撞墙
    const enemiesAhead = (s.side === 'player' ? state.enemySoldiers : state.playerSoldiers)
      .filter(e => e && e.alive && (s.side === 'player' ? e.y < s.y : e.y > s.y));
    if (enemiesAhead.length > 0 && !(TYPES[s.type]?.attackMode === 'melee' && s.mode === 'fight')) {
      const cy = fieldCenter();
      const band = Number.isFinite(s._formationBand) ? s._formationBand : formationBand(s);
      const zones = [[5, 50], [55, 105], [112, 160]];
      const zone = zones[band] || zones[1];
      const depthOffset = Number(s._formationDepthOffset) || 0;
      const offsetLow = zone[0] + depthOffset;
      const offsetHigh = zone[1] + depthOffset;
      const yLow = s.side === 'player' ? cy + offsetLow : cy - offsetHigh;
      const yHigh = s.side === 'player' ? cy + offsetHigh : cy - offsetLow;
      const formationY = clamp(s.y, Math.min(yLow, yHigh), Math.max(yLow, yHigh));
      s.y += (formationY - s.y) * Math.min(1, dt * 6);
    }
    keepInsideBattlefield(s);
  }

  function moveTowardEnemyFree(s, target) {
    s.mode = 'fight';
    const anchor = Number.isFinite(s._formationAnchorX) ? s._formationAnchorX : s.x;
    const formationPull = clamp(anchor - target.x, -28, 28) * 0.5;
    const flank = freeRole(s.type) === 'cavalry' ? (s._cavalrySide || 1) * 54 : 0;
    const offset = flank + ((stableHash(`${s.id}|offset`) % 13) - 6) + formationPull;
    moveVector(s, clamp(target.x + offset, 24, W - 24), target.y, 1);
  }
  function kiteFree(s, target) {
    s.mode = 'backline';
    const prevY = s.y;
    const dx = s.x - target.x, dy = s.y - target.y, d = Math.max(1, Math.hypot(dx, dy));
    moveVector(s, clamp(s.x + dx / d * 70, 24, W - 24), clamp(s.y + dy / d * 70, fieldTop(), fieldBottom()), .82);
    // 后撤被边界阻挡（Y 几乎没有变化）→ 放行攻击
    if (Math.abs(s.y - prevY) < 0.5) return false;
    return true;
  }
  function advanceFree(s) {
    s.target = null; s.mode = 'march';
    const targetY = s.side === 'player' ? fieldTop() : fieldBottom();
    const targetX = Number.isFinite(s._formationAnchorX) ? s._formationAnchorX : freeSiegeX(s);
    moveVector(s, targetX, targetY, freeRole(s.type) === 'cavalry' ? 1 : .86);
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

  function primarySupportAlly(s) {
    const allies = s.side === 'player' ? state.playerSoldiers : state.enemySoldiers;
    return allies.filter(a => a !== s && isCombatant(a) && freeRole(a.type) !== 'support')
      .sort((a,b) => (b.atk || 0) - (a.atk || 0) || String(a.id).localeCompare(String(b.id)))[0] || null;
  }

  function updateSupportAction(s) {
    const cfg = TYPES[s.type] || {};
    const dt = typeof dt_global === 'number' ? dt_global : 1 / 60;
    const range = typeof combatRange === 'function' ? combatRange(s) : (cfg.attackRange || 110);
    const ally = s.type === 'peach_medic' ? woundedAlly(s) : s.type === 'kiwi_wildcard' ? primarySupportAlly(s) : null;
    if (!ally) return false;
    if (Math.hypot(ally.x - s.x, ally.y - s.y) > range) {
      s.mode = 'support';
      moveVector(s, ally.x, ally.y + (s.side === 'player' ? 52 : -52), .8);
      return true;
    }
    s.mode = 'support';
    s.atkTimer -= dt;
    if (s.atkTimer > 0) return true;
    s.atkTimer = s.rate;
    if (s.type === 'peach_medic') {
      const amount = Math.max(1, s.heal || cfg.heal || 7);
      ally.hp = Math.min(ally.maxHp, ally.hp + amount);
      s.damageDone = (s.damageDone || 0) + amount;
      s._starHealCount = (s._starHealCount || 0) + 1;
      if (s._starHealCount % 3 === 0) {
        const group = s.side === 'player' ? state.playerSoldiers : state.enemySoldiers;
        const second = group.filter(a => a !== s && a !== ally && isCombatant(a) && a.hp < a.maxHp)
          .sort((a,b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        if (second) second.hp = Math.min(second.maxHp, second.hp + Math.max(1, Math.round(amount * 0.35)));
      }
      state.rings.push({ x:ally.x, y:ally.y, r:4, life:0.12, maxLife:0.12, color:'#8FE0A0' });
    } else {
      ally._fourDamageBuffPct = Math.max(ally._fourDamageBuffPct || 0, cfg.buffPct || 0.06);
      ally._fourDamageBuffUntil = (state.time || 0) + 1.8;
    }
    return true;
  }

  function updateSoldierFree(s, enemies) {
    if (!s.alive) return;
    if (typeof isDisabled === 'function' && isDisabled(s)) return;
    if (!isCombatant(s)) { moveOutOfCastle(s); return; }
    const role = freeRole(s.type);
    if (role === 'support' && updateSupportAction(s)) return;
    if (role === 'cavalry') {
      const now = state.time || 0;
      if (s._nextCavalryShiftAt == null) s._nextCavalryShiftAt = now + 2.4;
      if (now >= s._nextCavalryShiftAt) {
        s._cavalrySide = -(s._cavalrySide || 1);
        s._fourEmpoweredShots = Math.max(1, s._fourEmpoweredShots || 0);
        s._nextCavalryShiftAt = now + 2.4;
      }
    }
    const isSiege = (TYPES[s.type]?.siege || 0) > 0.5;
    // 回合制 FIGHT 阶段不攻墙，留在中线交战
    if (state.roundPhase === 'fight') { const t = findTargetFree(s, enemies); if (t) { s.target = t.id; attackTarget(s, t); return; } advanceFree(s); return; }
    if (reachedWall(s)) {
      const scanR = isSiege ? 52 : 150;
      const blockers = enemies.filter(e => isCombatant(e) && Math.hypot(e.x - s.x, e.y - s.y) <= scanR
        && (Math.hypot(e.x - s.x, e.y - s.y) < 50 || (s.side === 'player' ? e.y <= s.y + 18 : e.y >= s.y - 18)));
      const blocker = blockers.length ? blockers.reduce((a, b) => Math.hypot(a.x - s.x, a.y - s.y) < Math.hypot(b.x - s.x, b.y - s.y) ? a : b) : null;
      if (blocker) { s.target = blocker.id; attackTarget(s, blocker); return; }
      ramWall(s);
      return;
    }
    const target = isSiege ? nearestBlocker(s, enemies, 64) : findTargetFree(s, enemies);
    if (target) { s.target = target.id; attackTarget(s, target); return; }
    advanceFree(s);
  }

  function applySeparationFree(soldiers) {
    const dt = typeof dt_global === 'number' ? dt_global : 1/60;
    const push = soldiers.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < soldiers.length; i++) {
      const a = soldiers[i]; if (!isCombatant(a)) continue;
      for (let j = i + 1; j < soldiers.length; j++) {
        const b = soldiers[j]; if (!isCombatant(b)) continue;
        let dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
        if (d >= 48) continue;
        if (d < 0.001) {
          const angle = (stableHash(`${a.id}|${b.id}`) % 360) * Math.PI / 180;
          dx = Math.cos(angle); dy = Math.sin(angle); d = 1;
        }
        const force = (48 - d) / 48;
        const nx = dx / d * force, ny = dy / d * force;
        push[i].x += nx; push[i].y += ny;
        push[j].x -= nx; push[j].y -= ny;
      }
    }
    for (let i = 0; i < soldiers.length; i++) {
      const a = soldiers[i]; if (!isCombatant(a)) continue;
      a.x = clamp(a.x + push[i].x * 28 * dt, 24, W - 24);
      if (!String(a.mode).startsWith('siege')) {
        const fighting = a.mode === 'fight' || a.mode === 'backline' || a.mode === 'support';
        a.y = clamp(a.y + push[i].y * 20 * dt * (fighting ? 0.15 : 1), fieldTop(), fieldBottom());
      }
    }
  }

  function attackWallFree(s) {
    if (!isCombatant(s) || state.roundPhase === 'fight') return;
    const dt = typeof dt_global === 'number' ? dt_global : 1/60;
    const wall = wallDataFor(s), x = freeSiegeX(s);
    s.mode = 'siege'; s.siegeSlot = stableHash(s.id) % 12;
    s.x += (x - s.x) * Math.min(1, dt * 7); s.y = wall.attackY;
    s.atkTimer -= dt * worldTideState(state.time).multiplier;
    if (s.atkTimer > 0) return;
    const siegeMul = Math.max(.2, s.siege || TYPES[s.type]?.siege || 1);
    const dmg = Math.max(1, Math.round((s.level * 1.45 + s.atk * 0.3) * siegeMul));
    damageReefBarrier(s.side === 'player' ? 'enemy' : 'player', dmg, s);
    state.attackFx.push({ x1:s.x-8, y1:wall.attackY, x2:s.x+8, y2:wall.wallY+wall.wallH/2, life:.22, maxLife:.22 });
    s.atkTimer = WALL_ATTACK_INTERVAL;
  }

  function rangedAttackWallFree(s) {
    if (!isCombatant(s) || state.roundPhase === 'fight') return;
    const dt = typeof dt_global === 'number' ? dt_global : 1/60;
    s.mode = 'siege';
    s.atkTimer -= dt * worldTideState(state.time).multiplier;
    if (s.atkTimer > 0) return;
    const wall = wallDataFor(s), siegeMul = Math.max(.2, s.siege || TYPES[s.type]?.siege || 1);
    const openFieldBalance = (TYPES[s.type]?.siege || 0) > 0.5 ? .64 : 1;
    const dmg = Math.max(1, Math.round((s.level * 1.25 + s.atk * 0.3) * siegeMul * openFieldBalance));
    damageReefBarrier(s.side === 'player' ? 'enemy' : 'player', dmg, s);
    state.projectiles.push({ x:s.x, y:s.y, targetX:freeSiegeX(s), targetY:wall.wallY+wall.wallH/2, dmg:0, speed:245, color:TYPES[s.type]?.color || '#7de6ff', life:.35, side:s.side, reefVisual:true });
    s.atkTimer = s.rate;
  }

  // 兵撞墙:清完面前兵→到墙→扣1血→兵消失
  function ramWall(s) {
    if (!isCombatant(s) || state.roundPhase !== 'idle') return;
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
  }

  function updateBattlePressure() {
    function sidePressure(list, side) {
      const alive = list.filter(isCombatant);
      const power = alive.reduce((n,u) => n + (u.atk || 0) + (u.hp || 0) * .32 + (u.level || 1) * 3, 0);
      const siege = alive.filter(u => (TYPES[u.type]?.siege || 0) > 0.5 || reachedWall(u)).length;
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
      preFightTick: assignFormationRanks,
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
