/* ============================================================
   水果突击 · Fruit Size Tune v28
   用户反馈 v27 水果略小：在不恢复撑满格子的前提下，整体回提约 7%。
   葡萄/南瓜/椰子等视觉面积大的水果仍单独压一点。
   Loaded last.
   ============================================================ */

(function installFruitSizeTuneV28() {
  patchFruitSizeTuneV28();
})();

const FRUIT_SIZE_TUNE_BUILD = 'fruit-size-tune-v28';

const FRUIT_VISUAL_SCALE_V28 = {
  grape_archer: 0.91,
  pumpkin_roller: 0.93,
  coconut_guard: 0.95,
  watermelon_guard: 0.99,
  pineapple_lancer: 0.99,
  orange_cannon: 0.99,
  peach_medic: 1.01,
  pear_frost: 0.99,
  blueberry_sniper: 0.97,
  banana_raider: 1.03,
  lemon_assassin: 1.01,
  kiwi_wildcard: 0.99,
  passion_copy: 0.97,
};
function fruitVisualScaleV28(type) {
  return FRUIT_VISUAL_SCALE_V28[type] ?? 0.99;
}
function boardLvScaleV28(level) {
  return ({ 1:0.94, 2:1.00, 3:1.08, 4:1.17, 5:1.26, 6:1.37, 7:1.49 })[Math.max(1, Math.min(7, level || 1))] || 1;
}
function patchFruitSizeTuneV28() {
  drawBall = function drawBallFruitSizeTuneV28(ball, cx, cy, radius, extraY = 0, isEnemy = false) {
    if (!ball) return;
    const t = TYPES[ball.type] || TYPES[DEFAULT_DECK[0]];
    const level = Math.max(1, Math.min(7, ball.level || 1));
    const bounceOff = ball.bounce ? -Math.sin(ball.bounce * Math.PI) * 8 : 0;
    const floatOff = Math.sin((state?.time || 0) * 1.25 + cx * 0.05 + cy * 0.05) * 0.55;
    const drawY = cy - bounceOff + floatOff + extraY;
    const lvScale = boardLvScaleV28(level) * fruitVisualScaleV28(ball.type);
    const emojiSize = Math.round(radius * 1.52 * lvScale);
    const ringR = radius * (0.83 + (level - 1) * 0.060) * fruitVisualScaleV28(ball.type);
    const ringColor = isEnemy ? '#ff6578' : (t.color || '#53c96a');

    ctx.save();
    ctx.globalAlpha = isEnemy ? 0.12 : 0.16;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(cx, drawY + radius * 0.74, radius * 0.50 * lvScale, radius * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = isEnemy ? 0.42 : 0.52;
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = level >= 6 ? 2.5 : level >= 4 ? 2.1 : 1.7;
    ctx.beginPath();
    ctx.arc(cx, drawY, ringR, 0, Math.PI * 2);
    ctx.stroke();

    if (level >= 4) {
      ctx.globalAlpha = level >= 7 ? 0.25 : level >= 6 ? 0.19 : 0.13;
      ctx.shadowColor = ringColor;
      ctx.shadowBlur = level >= 7 ? 12 : level >= 6 ? 9 : 6;
      ctx.strokeStyle = level >= 7 ? '#fff176' : ringColor;
      ctx.lineWidth = level >= 7 ? 3 : 2.1;
      ctx.beginPath();
      ctx.arc(cx, drawY, ringR + 4 + level * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.globalAlpha = isEnemy ? 0.82 : 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${emojiSize}px sans-serif`;
    ctx.lineWidth = Math.max(2.0, emojiSize * 0.045);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.strokeText(t.icon, cx, drawY + 1);
    ctx.fillStyle = '#fff';
    ctx.fillText(t.icon, cx, drawY + 1);

    if (level >= 4) {
      const skillColor = typeof boardSkillColorV25 === 'function' ? boardSkillColorV25(ball.type) : (t.color || '#ffd54f');
      const markX = cx + ringR * 0.72;
      const markY = drawY - ringR * 0.72;
      const markR = Math.max(5.8, radius * 0.155);
      ctx.globalAlpha = isEnemy ? 0.60 : 0.84;
      ctx.fillStyle = 'rgba(20,24,16,0.46)';
      ctx.beginPath();
      ctx.arc(markX, markY, markR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = skillColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(markX, markY, markR, 0, Math.PI * 2);
      ctx.stroke();
      if (typeof drawBoardSkillMarkV25 === 'function') {
        drawBoardSkillMarkV25(markX, markY, ball.type, Math.max(3.9, radius * 0.098), skillColor);
      }
    }

    if (state.phase === 'playing') {
      const cd = SPAWN_COOLDOWNS[level] || SPAWN_COOLDOWNS[1];
      const ready = ball.spawnTimer <= 0;
      const progress = ready ? 1 : clamp01(1 - ball.spawnTimer / cd);
      ctx.globalAlpha = ready ? 0.74 : 0.38;
      ctx.strokeStyle = ready ? '#fff176' : ringColor;
      ctx.lineWidth = ready ? 2.4 : 1.9;
      if (ready) { ctx.shadowColor = '#fff176'; ctx.shadowBlur = 6; }
      ctx.beginPath();
      ctx.arc(cx, drawY, ringR + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  };
}
