/* ============================================================
   水果突击 · Opening & Projectile Fix
   第一关教学开局 + 远程弹道走护甲/减速/击杀限频逻辑。
   ============================================================ */

(function installOpeningAndProjectileFix() {
  patchOpeningV15();
  patchProjectileV15();
})();

function patchOpeningV15() {
  if (typeof initPlayerOpening !== 'function' || initPlayerOpening._v15Patched) return;
  initPlayerOpening = function initPlayerOpeningV15(k) {
    syncProgressUnlocks(meta);
    const deck = activeDeck();
    const starter = deck[0] || DEFAULT_DECK[0];
    const second = deck[1] || starter;
    const third = deck[2] || starter;
    const fourth = deck[3] || second;
    const fifth = deck[4] || third;

    if (k === 1) {
      placeBall(state.playerSlots, 1, 1, starter, 1);
      placeBall(state.playerSlots, 2, 0, second, 1);
      placeBall(state.playerSlots, 2, 4, third, 1);
      return;
    }

    placeBall(state.playerSlots, 1, 1, starter, 1);
    placeBall(state.playerSlots, 1, 2, starter, 1);
    placeBall(state.playerSlots, 2, 0, second, 1);
    placeBall(state.playerSlots, 2, 4, third, 1);
    placeBall(state.playerSlots, 0, 0, fourth, 1);
    placeBall(state.playerSlots, 0, 4, fifth, 1);
    if (k >= 4) placeBall(state.playerSlots, 2, 2, randomType(deck), 2);
  };
  initPlayerOpening._v15Patched = true;
}

function patchProjectileV15() {
  if (typeof updateProjectiles !== 'function' || updateProjectiles._v15Patched) return;
  updateProjectiles = function updateProjectilesV15() {
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const p = state.projectiles[i];
      p.life -= dt_global;
      if (p.life <= 0) { state.projectiles.splice(i, 1); continue; }

      const enemies = p.side === 'player' ? state.enemySoldiers : state.playerSoldiers;
      const tgt = enemies.find(e => e.id === p.targetId && isCombatant(e));
      if (!tgt) { state.projectiles.splice(i, 1); continue; }

      p.targetX = tgt.x;
      p.targetY = tgt.y;
      const dx = tgt.x - p.x;
      const dy = tgt.y - p.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 10) {
        const source = { type: p.ownerType || 'grape_archer', firstHit: p.firstHit };
        const dealt = typeof applyFruitDamage === 'function' ? applyFruitDamage(tgt, p.dmg, source) : p.dmg;
        if (typeof applyFruitDamage !== 'function') {
          tgt.hp -= dealt;
          tgt.hitFlash = 0.28;
        }
        if (p.side === 'player') state.damageByType[p.ownerType || 'grape_archer'] = (state.damageByType[p.ownerType || 'grape_archer'] || 0) + dealt;
        if (p.slow) { tgt.slowTimer = 2.2 + (tgt.level || 1) * 0.12; tgt.slowMul = 0.52; }
        const text = p.counterHit ? `克制 -${dealt}` : `-${dealt}`;
        addFx((p.x + tgt.x) / 2, (p.y + tgt.y) / 2 - 8, text, p.counterHit ? THEME.gold : THEME.accent, p.counterHit ? 13 : 11);
        for (let j = 0; j < 2; j++) {
          state.fx.push({
            x: tgt.x,
            y: tgt.y,
            text: '·',
            color: p.color,
            size: 5,
            life: 0.22,
            maxLife: 0.22,
            vx: (Math.random() - 0.5) * 34,
            vy: (Math.random() - 0.5) * 34,
          });
        }
        if (tgt.hp <= 0) killSoldier(tgt, p.side, dealt, p.ownerType || 'grape_archer');
        state.projectiles.splice(i, 1);
        continue;
      }
      if (d > 0.1) {
        p.x += (dx / d) * p.speed * dt_global;
        p.y += (dy / d) * p.speed * dt_global;
      }
    }
  };
  updateProjectiles._v15Patched = true;
}