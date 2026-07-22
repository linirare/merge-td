/* Four-class combat v1: compact ultimates, status expiry and timer-free round HUD. */
(function installFourClassCombatV1() {
  const ULT_DELAY = {
    banana_raider:4.5, lemon_assassin:5.0, pineapple_lancer:5.0,
    grape_archer:5.2, watermelon_guard:5.8, blueberry_sniper:6.0,
    peach_medic:6.0, kiwi_wildcard:6.5,
  };

  function alive(unit) {
    return !!unit && unit.alive && unit.battleReady !== false && unit.hp > 0;
  }
  function groupFor(side) {
    return side === 'player' ? state.playerSoldiers : state.enemySoldiers;
  }
  function enemiesFor(side) {
    return side === 'player' ? state.enemySoldiers : state.playerSoldiers;
  }
  function nearestEnemy(unit) {
    return enemiesFor(unit.side).filter(alive).sort((a,b) =>
      Math.hypot(a.x-unit.x,a.y-unit.y) - Math.hypot(b.x-unit.x,b.y-unit.y) || String(a.id).localeCompare(String(b.id))
    )[0] || null;
  }
  function currentEnemy(unit) {
    return enemiesFor(unit.side).find(e => alive(e) && e.id === unit.target) || nearestEnemy(unit);
  }
  function deal(source, target, raw) {
    if (!alive(source) || !alive(target)) return 0;
    const dealt = typeof applyFruitDamage === 'function' ? applyFruitDamage(target, Math.max(1, Math.round(raw)), source) : Math.max(1, Math.round(raw));
    if (typeof applyFruitDamage !== 'function') target.hp -= dealt;
    if (typeof trackDamage === 'function') trackDamage(source, dealt, false);
    if (target.hp <= 0 && typeof killSoldier === 'function') killSoldier(target, source.side, source.atk, source.type);
    return dealt;
  }
  function smallCastFx(unit) {
    if (!state.rings) return;
    state.rings.push({ x:unit.x, y:unit.y, r:6, life:.18, maxLife:.18, color:TYPES[unit.type]?.color || '#fff2a9' });
  }
  function reduceDamage(unit, pct, seconds) {
    unit._fourDamageReductionPct = Math.max(unit._fourDamageReductionPct || 0, pct);
    unit._fourDamageReductionUntil = Math.max(unit._fourDamageReductionUntil || 0, (state.time || 0) + seconds);
  }
  function grantShield(unit, pct, seconds) {
    const amount = Math.max(1, Math.round(unit.maxHp * pct));
    unit.shield = (unit.shield || 0) + amount;
    unit.maxShield = Math.max(unit.maxShield || 0, unit.shield);
    unit._fourShieldAmount = (unit._fourShieldAmount || 0) + amount;
    unit._fourShieldUntil = Math.max(unit._fourShieldUntil || 0, (state.time || 0) + seconds);
  }
  function castUltimate(unit) {
    const target = currentEnemy(unit);
    if (!target && unit.type !== 'peach_medic' && unit.type !== 'kiwi_wildcard' && unit.type !== 'watermelon_guard') return false;
    const atk = Math.max(1, unit.atk || 1);
    const foes = enemiesFor(unit.side).filter(alive);
    const allies = groupFor(unit.side).filter(alive);
    if (unit.type === 'blueberry_sniper') {
      [target, ...foes.filter(e => e !== target).sort((a,b) => Math.abs(a.x-target.x)-Math.abs(b.x-target.x)).slice(0,2)]
        .forEach((e,i) => deal(unit, e, atk * 2.4 * (1 - i * .2)));
    } else if (unit.type === 'grape_archer') {
      foes.sort((a,b) => Math.hypot(a.x-target.x,a.y-target.y)-Math.hypot(b.x-target.x,b.y-target.y)).slice(0,5).forEach(e => {
        deal(unit, e, atk * .55); e._fourDamageDownMul = .88; e._fourDamageDownUntil = (state.time || 0) + 3;
      });
    } else if (unit.type === 'pineapple_lancer') {
      deal(unit, target, atk * 1.9);
      target.y = clamp(target.y + (target.y >= unit.y ? 25 : -25), fieldTop(), fieldBottom());
      reduceDamage(unit, .20, 3.5);
    } else if (unit.type === 'watermelon_guard') {
      allies.filter(a => Math.hypot(a.x-unit.x,a.y-unit.y) <= 90).forEach(a => reduceDamage(a, .15, 4.5));
    } else if (unit.type === 'banana_raider') {
      for (let i=0;i<3 && alive(target);i++) deal(unit, target, atk * .60);
      unit._fourRateBuffUntil = (state.time || 0) + 3;
    } else if (unit.type === 'lemon_assassin') {
      for (let i=0;i<2 && alive(target);i++) deal(unit, target, atk * .95);
      unit._fourUltShots = 3;
    } else if (unit.type === 'peach_medic') {
      unit._fourHealPulses = 4; unit._fourNextHealPulseAt = state.time || 0;
    } else if (unit.type === 'kiwi_wildcard') {
      const ally = allies.filter(a => a !== unit && combatRoleOfType(a.type) !== 'support')
        .sort((a,b) => (b.atk || 0) - (a.atk || 0) || String(a.id).localeCompare(String(b.id)))[0];
      if (!ally) return false;
      ally._fourDamageBuffPct = Math.max(ally._fourDamageBuffPct || 0, .08);
      ally._fourDamageBuffUntil = (state.time || 0) + 4;
      ally._fourEchoShots = Math.max(ally._fourEchoShots || 0, 3);
    } else return false;
    unit._fourUltUsedRound = state.roundIndex;
    smallCastFx(unit);
    return true;
  }
  function tickStatusesAndPulses() {
    const now = state.time || 0;
    for (const unit of [...state.playerSoldiers, ...state.enemySoldiers]) {
      if ((unit._fourShieldUntil || 0) > 0 && now >= unit._fourShieldUntil) {
        unit.shield = Math.max(0, (unit.shield || 0) - (unit._fourShieldAmount || 0));
        unit._fourShieldAmount = 0; unit._fourShieldUntil = 0;
      }
      if (alive(unit) && unit._fourHealPulses > 0 && now >= (unit._fourNextHealPulseAt || 0)) {
        groupFor(unit.side).filter(alive).forEach(a => { a.hp = Math.min(a.maxHp, a.hp + Math.max(1, Math.round(a.maxHp * .05))); });
        unit._fourHealPulses--; unit._fourNextHealPulseAt = now + 1;
        if (unit._fourHealPulses === 0) groupFor(unit.side).filter(alive).forEach(a => grantShield(a, .08, 3));
      }
    }
  }
  function tickUltimates() {
    if (state.roundPhase !== 'fight') return;
    if (state._fourUltRound !== state.roundIndex) {
      state._fourUltRound = state.roundIndex; state._fourUltRoundStartedAt = state.time || 0;
      state._fourUltCount = { player:0, enemy:0 }; state._fourLastUltAt = -Infinity;
    }
    const now = state.time || 0;
    if (now - (state._fourLastUltAt || 0) < .65) return;
    const elapsed = now - (state._fourUltRoundStartedAt || now);
    const candidates = [...state.playerSoldiers, ...state.enemySoldiers].filter(u =>
      alive(u) && TYPES[u.type]?.combatV1 && ULT_DELAY[u.type] != null && u._fourUltUsedRound !== state.roundIndex &&
      elapsed >= ULT_DELAY[u.type] && (state._fourUltCount?.[u.side] || 0) < 4
    ).sort((a,b) => ULT_DELAY[a.type]-ULT_DELAY[b.type] || String(a.id).localeCompare(String(b.id)));
    const caster = candidates[0];
    if (caster && castUltimate(caster)) {
      state._fourUltCount[caster.side] = (state._fourUltCount[caster.side] || 0) + 1;
      state._fourLastUltAt = now;
    }
  }

  if (typeof updateCombat === 'function' && !updateCombat._fourClassV1) {
    const previousUpdateCombat = updateCombat;
    updateCombat = function updateCombatFourClassV1() {
      tickStatusesAndPulses();
      previousUpdateCombat();
      tickUltimates();
    };
    updateCombat._fourClassV1 = true;
  }
  if (typeof drawInfo === 'function' && !drawInfo._fourClassV1) {
    const previousDrawInfo = drawInfo;
    drawInfo = function drawInfoFourClassV1() {
      previousDrawInfo();
      if (state.phase !== 'playing' && state.phase !== 'paused') return;
      ctx.save();
      window._battlePanel(W / 2 - 38, 7, 76, 36, 10, '#31545a', '#ffe5a5', 1.5);
      ctx.fillStyle = '#fff7dd'; ctx.font = '900 13px "Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`回合 ${Math.max(1, state.roundIndex || 1)}`, W / 2, 25);
      ctx.restore();
    };
    drawInfo._fourClassV1 = true;
  }
})();
