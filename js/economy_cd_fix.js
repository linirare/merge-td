/* ============================================================
   水果突击 · Economy Cooldown Fix
   修正倍速下击杀果汁冷却被重复加速的问题。
   Loaded after balance_fix_v15.js.
   ============================================================ */

(function installEconomyCdFix() {
  if (typeof update !== 'function' || update._economyCdFixPatched) return;
  const prevUpdate = update;
  update = function updateEconomyCdFix(dt) {
    const before = state?.killSpCd || 0;
    const speed = state?.speed || 1;
    prevUpdate(dt);
    if (before > 0 && speed > 1 && state && state.killSpCd >= 0) {
      state.killSpCd = Math.min(before, state.killSpCd + dt * (speed - 1));
    }
  };
  update._economyCdFixPatched = true;
})();