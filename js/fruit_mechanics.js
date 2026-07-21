/* ============================================================
   水果突击 · Fruit Assault —— 12水果球战斗机制覆盖层
   Loaded after main.js and before juice.js.
   ============================================================ */

(function installFruitMechanics() {
  patchFruitAttackTarget();
  patchFruitAttackWall();
  patchFruitKillSoldier();
  patchFruitUpdateCombat();
})();

function fruitRange(s) {
  const t = TYPES[s.type] || {};
  let r;
  if (t.range === 'long') r = 154;
  else if (t.range === 'far') r = 118;
  else if (t.range === 'mid') r = 42;
  else if (t.range === 'support') r = 96;
  else r = 24;
  return Math.round(r * (1 + (s._bondRangeBonus || 0)));
}
function fruitIsBackline(s) {
  const role = TYPES[s.type]?.role;
  return role === 'shooter' || role === 'wildcard';
}
function fruitMoveSpeed(s, base) {
  const t = TYPES[s.type] || {};
  const move = (t.move != null ? t.move : (typeof roleStats === 'function' ? roleStats(t.role).move : 86));
  const slow = s.slowTimer > 0 ? (s.slowMul || 0.55) : 1;
  return Math.max(base * 0.78, base * (move / 92) * slow); // 不低于基准的 78%,防慢速单位在攻城/追击时像卡住
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
    if (!isCombatant(s) || s.hp >= s.maxHp) continue;
    const ratio = s.hp / Math.max(1, s.maxHp);
    const bestRatio = best ? best.hp / Math.max(1, best.maxHp) : Infinity;
    if (!best || ratio < bestRatio || (ratio === bestRatio && String(s.id) < String(best.id))) best = s;
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
      // 嘲讽:强制同路敌人锁定自己(Lv3+,Lv6+延长时间)
      const foes = s.side === 'player' ? state.enemySoldiers : state.playerSoldiers;
      for (const e of foes) {
        if (!isCombatant(e) || Math.hypot(e.x - s.x, e.y - s.y) > 100) continue;
        if (typeof applyStatus === 'function') applyStatus(e, s, 'provoke', s.level >= 6 ? 3.0 : 2.0);
      }
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
        let heal = Math.round(8 + s.level * 5 + s.atk * 0.55);
        if (s._bondHealBoost) heal = Math.round(heal * (1 + s._bondHealBoost));
        if (ally._bondHealReceived) heal = Math.round(heal * (1 + ally._bondHealReceived));
        ally.hp = Math.min(ally.maxHp, ally.hp + heal);
        s.damageDone = (s.damageDone || 0) + heal;
        if (s.side === 'player') state.damageByType[s.type] = (state.damageByType[s.type] || 0) + heal;
        addFx(ally.x, ally.y - 24, `+${heal}`, '#53E77B', 12);
        state.rings.push({ x: ally.x, y: ally.y, r: 6, life: 0.25, maxLife: 0.25, color: '#53E77B' });
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
    r.x = clamp(r.x, 24, W - 24);
    state.rings.push({ x: r.x, y: r.y, r: 3, life: 0.08, maxLife: 0.08, color: '#ff7d35' });

    const enemies = r.side === 'player' ? state.enemySoldiers : state.playerSoldiers;
    let hitAny = false;
    for (const e of enemies) {
      if (!isCombatant(e)) continue;
      if (Math.hypot(e.x - r.x, e.y - r.y) < 34) {
        const dmg = Math.round(r.dmg * 0.9);
        applyFruitDamage(e, dmg, { type: 'pumpkin_roller', firstHit: false });
        if (typeof applyStatus === 'function') applyStatus(e, { type: 'pumpkin_roller' }, 'stunned', 0.6); // 南瓜爆炸眩晕
        addFx(e.x, e.y - 18, `南瓜爆-${dmg}`, '#ff7d35', 12);
        if (e.hp <= 0) killSoldier(e, r.side, dmg, 'pumpkin_roller');
        hitAny = true;
      }
    }
    if (hitAny) { r.life = 0; }

    const wallY = r.side === 'player' ? LAYOUT.enemyWallY + LAYOUT.wallH + 4 : LAYOUT.playerWallY - 4;
    const hitWall = r.side === 'player' ? r.y <= wallY : r.y >= wallY;
    if (hitWall) {
      const dmg = Math.round(r.dmg * 1.35);
      if (typeof damageReefBarrier === 'function') damageReefBarrier(r.side === 'player' ? 'enemy' : 'player', dmg, { side:r.side, type:'pumpkin_roller' });
      else if (r.side === 'player') { state.enemyWallHp = Math.max(0, state.enemyWallHp - dmg); state.enemyWallDamageDealt += dmg; }
      else { state.playerWallHp = Math.max(0, state.playerWallHp - dmg); state.playerWallDamageTaken += dmg; }
      addFx(r.x, wallY, `南瓜爆破 -${dmg}`, '#ff7d35', 13);
      state.shake = Math.max(state.shake, 0.55);
      r.life = 0;
    }

    if (r.life <= 0 || r.y < LAYOUT.enemyWallY - 30 || r.y > LAYOUT.playerWallY + 50) state.rollings.splice(i, 1);
  }
}

function patchFruitAttackTarget() { attackTarget._fruitPatched = true; }
function patchFruitAttackWall() { attackWall._fruitPatched = true; }

function patchFruitKillSoldier() { killSoldier._fruitPatched = true; }

function patchFruitUpdateCombat() {
  if (typeof updateCombat !== 'function' || updateCombat._fruitPatched) return;
  const oldUpdateCombat = updateCombat;
  updateCombat = function fruitUpdateCombat() {
    if (state.phase !== 'playing') return;
    // 修#3:被动/南瓜 tick 交给 combat.js updateCombat 内部单点调用。原来这里再调一次 = 每帧 2 倍
    //       (所有护盾/治疗/buff/技能冷却时序全被 ×2)。此处只保留对原 updateCombat 的透传。
    oldUpdateCombat();
  };
  updateCombat._fruitPatched = true;
}
