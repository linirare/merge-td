/* ============================================================
   水果突击 · Spawn Cooldown Minimal v22
   去掉棋盘出兵冷却常驻读秒：保留进度弧、底部进度条、即将出兵高亮。
   原因：战斗棋盘需要低认知负担，数字读秒放到详情/长按，不做常驻。
   Loaded after fruit_lab_unified_v21.js.
   ============================================================ */

(function installSpawnCooldownMinimalV22() {
  if (typeof drawOneCooldownV20 !== 'function') return;
  drawOneCooldownV20 = function drawOneCooldownMinimalV22(ball, r, c, isEnemy) {
    if (!ball) return;
    const rect = slotRect(r, c, isEnemy);
    const center = slotCenter(r, c, isEnemy);
    const full = SPAWN_COOLDOWNS[ball.level || 1] || SPAWN_COOLDOWNS[1];
    const progress = 1 - clamp01((ball.spawnTimer || 0) / full);
    const color = TYPES[ball.type]?.color || THEME.gold;

    ctx.save();

    // 冷却弧：主信息，表达“还差多少出兵”。
    ctx.globalAlpha = isEnemy ? 0.38 : 0.88;
    ctx.strokeStyle = color;
    ctx.lineWidth = isEnemy ? 2 : 3.2;
    ctx.beginPath();
    ctx.arc(center.x, center.y, CELL * 0.43, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.stroke();

    // 底部短条：辅助信息，便于扫视多个格子。
    ctx.globalAlpha = isEnemy ? 0.30 : 0.78;
    ctx.fillStyle = 'rgba(0,0,0,0.26)';
    roundRect(rect.x + 7, rect.y + CELL - 10, CELL - 14, 5, 3);
    ctx.fill();
    ctx.fillStyle = color;
    roundRect(rect.x + 7, rect.y + CELL - 10, Math.max(3, (CELL - 14) * progress), 5, 3);
    ctx.fill();

    // 即将出兵：强提示，不需要数字。
    if (!isEnemy && progress >= 0.96) {
      const pulse = 0.50 + Math.sin(performance.now() / 90) * 0.22;
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#fff176';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(center.x, center.y, CELL * 0.50, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = Math.min(0.55, pulse);
      ctx.fillStyle = '#fff176';
      ctx.beginPath();
      ctx.arc(center.x + CELL * 0.31, center.y - CELL * 0.31, 4.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };
})();
