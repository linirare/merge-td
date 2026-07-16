/* ============================================================
   水果突击 · Opening & Projectile Fix
   第一关教学开局 + 远程弹道走护甲/减速/击杀限频逻辑。
   ============================================================ */

(function installOpeningAndProjectileFix() {
  patchOpeningV15();
  patchProjectileV15();
})();

function patchOpeningV15() {
  // 初始战场不再预置水果营:玩家开局获果汁能量,自行点空格召唤
  if (typeof initPlayerOpening !== 'function' || initPlayerOpening._v15Patched) return;
  initPlayerOpening = function initPlayerOpeningV15(k) {
    syncProgressUnlocks(meta);
    // 不再预置球——玩家用果汁自行召唤
  };
  initPlayerOpening._v15Patched = true;
}

function patchProjectileV15() {
  if (typeof updateProjectiles !== 'function' || updateProjectiles._v15Patched) return;
  updateProjectiles = function updateProjectilesV15() {
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const p = state.projectiles[i];
      p.life -= dt_global;
      // 远程攻城弹:悬停 ~1s 后直接伤墙
      if (p.wallHit) {
        if (p.life <= 0) {
          if (p.side === 'player') {
            state.enemyWallHp = Math.max(0, state.enemyWallHp - p.dmg);
            state.enemyWallDamageDealt += p.dmg;
          } else {
            state.playerWallHp = Math.max(0, state.playerWallHp - p.dmg);
          }
          state.attackFx.push({ x1: p.x, y1: p.y, x2: p.targetX, y2: p.targetY, life: 0.36, maxLife: 0.36, attackerSide: p.side, ownerType: p.ownerType, ownerLevel: p.ownerLevel, ownerId: p.ownerId });
          state.projectiles.splice(i, 1);
        }
        continue;
      }
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
        const source = { type: p.ownerType || 'grape_archer', firstHit: p.firstHit, level: p.ownerLevel || 1 };
        const dealt = typeof applyFruitDamage === 'function' ? applyFruitDamage(tgt, p.dmg, source) : p.dmg;
        if (typeof applyFruitDamage !== 'function') {
          tgt.hp -= dealt;
          tgt.hitFlash = 0.28;
        }
        if (p.side === 'player') state.damageByType[p.ownerType || 'grape_archer'] = (state.damageByType[p.ownerType || 'grape_archer'] || 0) + dealt;
        if (p.slow) { tgt.slowTimer = 2.2 + (tgt.level || 1) * 0.12; tgt.slowMul = 0.52; }
        // 樱桃炸弹:范围炸弹,炸目标周围同侧敌人
        if (p.aoe) {
          const aoeR = 44, aoeDmg = Math.max(1, Math.round(p.dmg * 0.6));
          for (const e of enemies) {
            if (e === tgt || !isCombatant(e)) continue;
            if (Math.hypot(e.x - tgt.x, e.y - tgt.y) <= aoeR) {
              const dd = typeof applyFruitDamage === 'function' ? applyFruitDamage(e, aoeDmg, { type: 'cherry_bomber', firstHit: false, level: p.ownerLevel || 4 }) : aoeDmg;
              if (typeof applyFruitDamage !== 'function') e.hp -= dd;
              if (e.hp <= 0) killSoldier(e, p.side, dd, 'cherry_bomber');
            }
          }
          addFx(tgt.x, tgt.y, '💥', THEME.accent, 14);
          state.shake = Math.max(state.shake || 0, 0.4);
        }
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
        state.attackFx.push({
          x1: p.x, y1: p.y, x2: tgt.x, y2: tgt.y,
          life: 0.28, maxLife: 0.28,
          attackerSide: p.side,
          ownerType: p.ownerType,
          ownerLevel: p.ownerLevel,
          ownerId: p.ownerId,
          targetId: p.targetId,
          crit: !!p.counterHit,
          projectileImpact: true,
        });
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
