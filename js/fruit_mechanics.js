/* ============================================================
   水果突击 · Fruit Assault —— 12水果球战斗机制覆盖层
   Loaded after main.js / gameplay_assist.js and before juice.js.
   ============================================================ */

(function installFruitMechanics() {
  patchFruitAttackTarget();
  patchFruitAttackWall();
  patchFruitKillSoldier();
  patchFruitUpdateCombat();
})();

function fruitRange(s) {
  const t = TYPES[s.type] || {};
  if (t.range === 'long') return 154;
  if (t.range === 'far') return 118;
  if (t.range === 'mid') return 42;
  if (t.range === 'support') return 96;
  return 24;
}
function fruitIsBackline(s) {
  const role = TYPES[s.type]?.role;
  return role === 'back' || role === 'siege' || role === 'control' || role === 'support' || role === 'merge';
}
function fruitMoveSpeed(s, base) {
  const t = TYPES[s.type] || {};
  const move = t.move || 86;
  const slow = s.slowTimer > 0 ? (s.slowMul || 0.55) : 1;
  return base * (move / 92) * slow;
}
function applyFruitDamage(target, raw, source) {
  let dmg = Math.max(1, Math.round(raw));
  const armor = Math.max(0, target.armor || 0);
  if (source?.type === 'orange_cannon') dmg = Math.round(dmg * 0.72); // 橙子强在攻城，不强在清兵
  if (source?.type === 'lemon_assassin' && source.firstHit) dmg = Math.round(dmg * (1.8 + source.level * 0.08));
  if (source?.type === 'banana_raider' && source.firstHit && fruitIsBackline(target)) dmg = Math.round(dmg * 1.45);
  dmg = Math.max(1, Math.round(dmg * (1 - (armor / (armor + 50)))));

  if (target.shield > 0) {
    const used = Math.min(target.shield, dmg);
    target.shield -= used;
    dmg -= used;
    if (used > 0) addFx(target.x, target.y - 18, `盾-${used}`, '#72c4ff', 10);
  }
  if (dmg > 0) {
    target.hp -= dmg;
    target.hitFlash = 0.28;
  }
  return dmg;
}
function nearestAllyOnLane(side, lane) {
  const group = side === 'player' ? state.playerSoldiers : state.enemySoldiers;
  let best = null;
  for (const s of group) {
    if (!isCombatant(s) || s.laneIndex !== lane || s.hp >= s.maxHp) continue;
    if (!best) best = s;
    else if (side === 'player' ? s.y < best.y : s.y > best.y) best = s;
  }
  return best;
}
function updateFruitPassiveSkills(dt) {
  const all = [...state.playerSoldiers, ...state.enemySoldiers];
  for (const s of all) {
    if (!s.alive) continue;
    if (s.slowTimer > 0) s.slowTimer = Math.max(0, s.slowTimer - dt);
    if (!isCombatant(s)) continue;
    s.skillTimer = (s.skillTimer || 0) - dt;

    if (s.type === 'watermelon_guard' && s.level >= 3 && s.skillTimer <= 0) {
      const shield = Math.round(10 + s.level * 5 + s.maxHp * 0.08);
      s.shield = Math.min((s.shield || 0) + shield, Math.round(s.maxHp * 0.45));
      s.maxShield = Math.max(s.maxShield || 0, s.shield);
      s.skillTimer = 6.0;
      addFx(s.x, s.y - 26, '瓜皮盾', '#53c96a', 11);
      state.rings.push({ x: s.x, y: s.y, r: 7, life: 0.28, maxLife: 0.28, color: '#53c96a' });
    }

    if (s.type === 'coconut_guard' && !s._firstShield && s.battleReady) {
      s._firstShield = true;
      s.shield = Math.max(s.shield || 0, Math.round(s.maxHp * (0.38 + s.level * 0.04)));
      s.maxShield = Math.max(s.maxShield || 0, s.shield);
      addFx(s.x, s.y - 26, '椰壳护盾', '#9be7ff', 11);
      state.rings.push({ x: s.x, y: s.y, r: 7, life: 0.28, maxLife: 0.28, color: '#9be7ff' });
    }

    if (s.type === 'peach_medic' && s.skillTimer <= 0) {
      const ally = nearestAllyOnLane(s.side, s.laneIndex);
      if (ally) {
        const heal = Math.round(8 + s.level * 5 + s.atk * 0.55);
        ally.hp = Math.min(ally.maxHp, ally.hp + heal);
        s.damageDone = (s.damageDone || 0) + heal;
        if (s.side === 'player') state.damageByType[s.type] = (state.damageByType[s.type] || 0) + heal;
        addFx(ally.x, ally.y - 24, `+${heal}`, '#ff9fbd', 12);
        state.rings.push({ x: ally.x, y: ally.y, r: 6, life: 0.25, maxLife: 0.25, color: '#ff9fbd' });
      }
      s.skillTimer = Math.max(1.8, 4.4 - s.level * 0.22);
    }
  }
}
function updateRollingPumpkins(dt) {
  if (!state.rollings) state.rollings = [];
  for (let i = state.rollings.length - 1; i >= 0; i--) {
    const r = state.rollings[i];
    r.life -= dt;
    r.y += (r.side === 'player' ? -1 : 1) * r.speed * dt;
    r.x += (r.laneX - r.x) * Math.min(1, dt * 5);
    state.rings.push({ x: r.x, y: r.y, r: 3, life: 0.08, maxLife: 0.08, color: '#ff7d35' });

    const enemies = r.side === 'player' ? state.enemySoldiers : state.playerSoldiers;
    for (const e of enemies) {
      if (!isCombatant(e) || e.laneIndex !== r.lane) continue;
      if (Math.abs(e.y - r.y) < 18) {
        const dmg = Math.round(r.dmg * 0.75);
        applyFruitDamage(e, dmg, { type:'pumpkin_roller', firstHit:false });
        addFx(e.x, e.y - 18, `南瓜撞-${dmg}`, '#ff7d35', 12);
        if (e.hp <= 0) killSoldier(e, r.side, dmg, 'pumpkin_roller');
        r.life = 0;
        break;
      }
    }

    const wallY = r.side === 'player' ? LAYOUT.enemyWallY + LAYOUT.wallH + 4 : LAYOUT.playerWallY - 4;
    const hitWall = r.side === 'player' ? r.y <= wallY : r.y >= wallY;
    if (hitWall) {
      const dmg = Math.round(r.dmg * 1.35);
      if (r.side === 'player') {
        state.enemyWallHp = Math.max(0, state.enemyWallHp - dmg);
        state.enemyWallDamageDealt += dmg;
      } else {
        state.playerWallHp = Math.max(0, state.playerWallHp - dmg);
        state.playerWallDamageTaken += dmg;
      }
      addFx(r.x, wallY, `南瓜爆破 -${dmg}`, '#ff7d35', 13);
      state.shake = Math.max(state.shake, 0.55);
      r.life = 0;
    }

    if (r.life <= 0 || r.y < LAYOUT.enemyWallY - 30 || r.y > LAYOUT.playerWallY + 50) state.rollings.splice(i, 1);
  }
}

function patchFruitAttackTarget() {
  if (typeof attackTarget !== 'function' || attackTarget._fruitPatched) return;
  attackTarget = function fruitAttackTarget(s, target) {
    if (!isCombatant(s) || !isCombatant(target)) return;
    const dx = s.x - target.x;
    const dy = s.y - target.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const range = fruitRange(s);

    if (fruitIsBackline(s) && dist < BOW_SAFE_MIN) kiteAsBackline(s, target);
    else if (dist > range) { moveTowardEnemy(s, target); return; }
    if (dist > range + 6) return;

    s.mode = fruitIsBackline(s) ? 'backline' : 'fight';
    s.atkTimer -= dt_global;
    if (s.atkTimer > 0) return;

    let dmg = s.atk;
    const counterHit = target.type === COUNTER[s.type] || (COUNTER[s.type] === 'wall' && false);
    if (counterHit) dmg = Math.round(dmg * COUNTER_DMG);
    s.atkTimer = s.speed;

    if (fruitIsBackline(s) && s.type !== 'peach_medic') {
      playSfx('arrow');
      state.projectiles.push({
        x: s.x, y: s.y, targetX: target.x, targetY: target.y, targetId: target.id,
        dmg, speed: s.type === 'blueberry_sniper' ? 315 : 245,
        color: TYPES[s.type]?.color || '#ff6b4a', life: 1.15, side: s.side,
        counterHit, ownerType: s.type, slow: s.type === 'pear_frost', firstHit: s.firstHit,
      });
      s.firstHit = false;
      return;
    }

    playSfx('hit');
    const dealt = applyFruitDamage(target, dmg, s);
    trackDamage(s, dealt, false);
    if (s.type === 'pear_frost') { target.slowTimer = 2.2 + s.level * 0.18; target.slowMul = 0.52; }
    state.attackFx.push({ x1: s.x, y1: s.y, x2: target.x, y2: target.y, life: 0.22, maxLife: 0.22 });
    addFx((s.x + target.x) / 2, (s.y + target.y) / 2 - 8, counterHit ? `克制 -${dealt}` : `-${dealt}`, counterHit ? THEME.gold : THEME.accent, counterHit ? 14 : 12);
    s.firstHit = false;
    if (target.hp <= 0) killSoldier(target, s.side, s.atk, s.type);
  };
  attackTarget._fruitPatched = true;
}

function patchFruitAttackWall() {
  if (typeof attackWall !== 'function' || attackWall._fruitPatched) return;
  attackWall = function fruitAttackWall(s) {
    if (!isCombatant(s)) return;
    const wall = wallDataFor(s);
    const list = siegeListFor(s);
    const idx = Math.max(0, list.findIndex(u => u.id === s.id));
    const slotCount = laneSlotCount();
    s.siegeSlot = idx;
    if (idx >= slotCount) { moveToSiegeQueue(s, idx, wall); return; }

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
    const dmg = Math.max(1, base);

    if (s.side === 'player') {
      state.enemyWallHp = Math.max(0, state.enemyWallHp - dmg);
      state.enemyWallDamageDealt += dmg;
      state.wallDamageByLane[s.laneIndex] = (state.wallDamageByLane[s.laneIndex] || 0) + dmg;
      trackDamage(s, dmg, true);
      addFx(s.x, wall.wallY + wall.wallH + 4, s.type === 'orange_cannon' ? `橙炮 -${dmg}` : `破堡 -${dmg}`, THEME.gold, 13);
    } else {
      state.playerWallHp = Math.max(0, state.playerWallHp - dmg);
      state.playerWallDamageTaken += dmg;
      state.breachLane = s.laneIndex;
      addFx(s.x, wall.wallY - 8, `-${dmg}`, THEME.accent, 13);
    }
    state.attackFx.push({ x1: s.x - 8, y1: wall.attackY, x2: s.x + 8, y2: s.side === 'player' ? wall.wallY + 2 : wall.wallY + wall.wallH - 2, life: 0.22, maxLife: 0.22 });
    state.rings.push({ x: s.x, y: wall.attackY, r: 5, life: 0.24, maxLife: 0.24, color: THEME.gold });
    s.atkTimer = WALL_ATTACK_INTERVAL;
    state.shake = Math.max(state.shake, s.type === 'orange_cannon' ? 0.55 : 0.32);
  };
  attackWall._fruitPatched = true;
}

function patchFruitKillSoldier() {
  if (typeof killSoldier !== 'function' || killSoldier._fruitPatched) return;
  const oldKill = killSoldier;
  killSoldier = function fruitKillSoldier(target, killerSide, killerAtk, killerType) {
    if (target.type === 'pumpkin_roller' && !target.rolled) {
      target.rolled = true;
      if (!state.rollings) state.rollings = [];
      state.rollings.push({ side: target.side, lane: target.laneIndex, laneX: target.laneX, x: target.x, y: target.y, speed: 185 + target.level * 12, dmg: Math.round(target.atk * (1.6 + target.level * 0.15)), life: 2.2 });
      addFx(target.x, target.y - 20, '南瓜滚动!', '#ff7d35', 12);
    }
    return oldKill(target, killerSide, killerAtk, killerType);
  };
  killSoldier._fruitPatched = true;
}

function patchFruitUpdateCombat() {
  if (typeof updateCombat !== 'function' || updateCombat._fruitPatched) return;
  const oldUpdateCombat = updateCombat;
  updateCombat = function fruitUpdateCombat() {
    if (state.phase !== 'playing') return;
    updateFruitPassiveSkills(dt_global);
    updateRollingPumpkins(dt_global);
    oldUpdateCombat();
  };
  updateCombat._fruitPatched = true;
}
