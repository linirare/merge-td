/* ============================================================
   水果突击 · Economy Balls v62 (Phase 4B)
   ------------------------------------------------------------
   5 个辅助球的果汁(SP)经济效果,作为附加层包裹 SP 循环,
   不修改 juice_economy.js(并行改动方在维护)。原则:同类取最高,不叠加。

   - 薄荷补给球 sp_regen : 在场时额外果汁回复(近似 5s→4s→3s 提速)
   - 电击柠檬球 kill_sp  : 玩家击杀额外 +SP (Lv1+1 / Lv4+2 / Lv7+3)
   - 蜂蜜储蓄球 sp_refund: 每次操作后返还 SP (8s CD)
   - 发酵葡萄球 sp_bank  : 每 15s(Lv4 12s)产 1SP,死亡吐出累计(上限15, Lv7+5)
   - 冰镇果汁球 sp_discount: 每 20s(Lv4 15s)下一次操作消耗减半(Lv7 免费)
   ============================================================ */
(function installEconomyBallsV62() {
  function playerUnits() {
    const out = [];
    if (state && state.playerSlots) for (const row of state.playerSlots) for (const b of row) if (b) out.push(b);
    if (state && state.playerSoldiers) for (const s of state.playerSoldiers) if (s && s.alive) out.push(s);
    return out;
  }
  function econLevel(skill) {
    let lv = 0;
    for (const u of playerUnits()) {
      const t = TYPES[u.type];
      if (t && t.skill === skill) lv = Math.max(lv, u.level || 1);
    }
    return lv;
  }
  function grantSp(n) {
    if (n > 0) {
      // 深海储能羁绊:SP恢复+15%
      const hasSpBond = state.playerSoldiers.some(s => s.alive && s._bondSpRegen);
      if (hasSpBond) n = Math.round(n * 1.15);
      state.sp = (state.sp || 0) + n;
      if (typeof pulseJuice === 'function') pulseJuice(n, 'gain');
    }
  }
  function tier(lv) { return lv >= 7 ? 3 : lv >= 4 ? 2 : 1; }

  /* --- wrap update: regen / refund-detection / ferment production / chill flag --- */
  if (typeof update === 'function' && !update._econV62) {
    const oldUpdate = update;
    update = function updateEconV62(dt) {
      oldUpdate(dt);
      if (!state || state.phase !== 'playing') return;

      // 薄荷:额外回复
      const mint = econLevel('sp_regen');
      if (mint > 0) {
        state._econRegenAcc = (state._econRegenAcc || 0) + (0.06 + mint * 0.012) * dt;
        while (state._econRegenAcc >= 1) { state._econRegenAcc -= 1; grantSp(1); }
      }

      // 操作检测(召唤/急派使 summonCostCounter 递增)
      const cc = state.summonCostCounter || 1;
      if (state._econLastCounter === undefined) state._econLastCounter = cc;
      if (cc > state._econLastCounter) {
        // 蜂蜜:操作后返还
        const honey = econLevel('sp_refund');
        if (honey > 0 && (state._econRefundCd || 0) <= 0) { grantSp(tier(honey)); state._econRefundCd = 8; }
        // 冰镇:本次操作已用掉折扣,清标记
        state._econChillReady = null;
      }
      state._econLastCounter = cc;
      if (state._econRefundCd > 0) state._econRefundCd = Math.max(0, state._econRefundCd - dt);

      // 发酵葡萄:周期产 SP + 累计
      for (const u of playerUnits()) {
        if (!(TYPES[u.type] && TYPES[u.type].skill === 'sp_bank')) continue;
        const lv = u.level || 1, interval = lv >= 4 ? 12 : 15;
        u._fermTimer = (u._fermTimer || 0) + dt;
        if (u._fermTimer >= interval) { u._fermTimer -= interval; grantSp(1); u._fermBank = Math.min(15, (u._fermBank || 0) + 1); }
      }

      // 冰镇果汁:周期上折扣
      const chill = econLevel('sp_discount');
      if (chill > 0) {
        const interval = chill >= 4 ? 15 : 20;
        state._econChillTimer = (state._econChillTimer || 0) + dt;
        if (state._econChillTimer >= interval) {
          state._econChillTimer -= interval;
          state._econChillReady = chill >= 7 ? 'free' : 'half';
          if (typeof addFx === 'function' && typeof LAYOUT !== 'undefined') addFx(W / 2, (LAYOUT.operationY || 570) - 8, '冰镇:下次操作省果汁', (typeof THEME !== 'undefined' && THEME.info) || '#8fd', 11);
        }
      }
    };
    update._econV62 = true;
  }

  /* --- wrap actionCost: apply chill discount --- */
  if (typeof actionCost === 'function' && !actionCost._econV62) {
    const oldCost = actionCost;
    actionCost = function actionCostEconV62() {
      let c = oldCost.apply(this, arguments);
      if (state && state._econChillReady) c = state._econChillReady === 'free' ? 0 : Math.max(0, Math.ceil(c / 2));
      return c;
    };
    actionCost._econV62 = true;
  }

  /* --- wrap killSoldier: shock_lemon kill bonus + ferment death dump --- */
  if (typeof killSoldier === 'function' && !killSoldier._econV62) {
    const oldKill = killSoldier;
    killSoldier = function killSoldierEconV62(target, killerSide, killerAtk, killerType) {
      if (target && TYPES[target.type] && TYPES[target.type].skill === 'sp_bank' && target.side === 'player') {
        const lv = target.level || 1, dump = (target._fermBank || 0) + (lv >= 7 ? 5 : 0);
        if (dump > 0) grantSp(dump);
      }
      const r = oldKill(target, killerSide, killerAtk, killerType);
      if (killerSide === 'player') { const shock = econLevel('kill_sp'); if (shock > 0) grantSp(tier(shock)); }
      return r;
    };
    killSoldier._econV62 = true;
  }
})();
