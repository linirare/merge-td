/* ============================================================
   水果突击 · Single Cooldown Arc v33
   修正棋盘水果双圆弧问题：去掉明显基础彩色圆环，只保留单一出兵 CD 圆弧。
   等级由 Lv 固定牌表达；水果主体靠米白托底和轻阴影承托。
   Loaded last on top of v39/v30 stack.
   ============================================================ */

(function installSingleCooldownArcV33() {
  patchSingleCooldownFruitV33();
})();

const SINGLE_COOLDOWN_ARC_BUILD = 'single-cooldown-arc-v33';

const FRUIT_SCALE_V33 = {
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
function fruitScaleV33(type) { return FRUIT_SCALE_V33[type] ?? 0.99; }
function levelScaleV33(level) {
  return ({ 1:0.94, 2:1.00, 3:1.08, 4:1.17, 5:1.26, 6:1.37, 7:1.49 })[Math.max(1, Math.min(7, level || 1))] || 1;
}
function skillColorV33(type) {
  if (typeof boardSkillColorV25 === 'function') return boardSkillColorV25(type);
  return TYPES[type]?.color || '#ffd54f';
}

function patchSingleCooldownFruitV33() {
  drawBall = function drawBallSingleCooldownArcV33(ball, cx, cy, radius, extraY = 0, isEnemy = false) {
    if (!ball) return;
    const t = TYPES[ball.type] || TYPES[DEFAULT_DECK[0]];
    const level = Math.max(1, Math.min(7, ball.level || 1));
    const bounceOff = ball.bounce ? -Math.sin(ball.bounce * Math.PI) * 8 : 0;
    const floatOff = Math.sin((state?.time || 0) * 1.25 + cx * 0.05 + cy * 0.05) * 0.55;
    const drawY = cy - bounceOff + floatOff + extraY;
    const lvScale = levelScaleV33(level) * fruitScaleV33(ball.type);
    const emojiSize = Math.round(radius * 1.52 * lvScale);
    const ringR = radius * (0.83 + (level - 1) * 0.060) * fruitScaleV33(ball.type);
    const cdColor = isEnemy ? '#ff6578' : (t.color || '#53c96a');

    ctx.save();

    // 轻落地阴影。
    ctx.globalAlpha = isEnemy ? 0.12 : 0.16;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(cx, drawY + radius * 0.74, radius * 0.50 * lvScale, radius * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    // 米白托底：保留承托，不再画彩色基础圆环。
    ctx.globalAlpha = isEnemy ? 0.72 : 0.86;
    ctx.fillStyle = 'rgba(255,255,255,0.58)';
    ctx.beginPath();
    ctx.ellipse(cx, drawY + 1, radius * 0.88, radius * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isEnemy ? 'rgba(210,150,160,0.16)' : 'rgba(120,160,110,0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, drawY + 1, radius * 0.88, radius * 0.78, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Lv4+ 只留很淡觉醒光，不再形成第二个圆弧。
    if (level >= 4) {
      ctx.globalAlpha = level >= 7 ? 0.16 : level >= 6 ? 0.12 : 0.08;
      ctx.shadowColor = cdColor;
      ctx.shadowBlur = level >= 7 ? 10 : level >= 6 ? 7 : 5;
      ctx.fillStyle = cdColor;
      ctx.beginPath();
      ctx.ellipse(cx, drawY + 1, radius * 0.93, radius * 0.82, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 水果 emoji 主体。
    ctx.globalAlpha = isEnemy ? 0.82 : 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${emojiSize}px sans-serif`;
    ctx.lineWidth = Math.max(2.0, emojiSize * 0.045);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.strokeText(t.icon, cx, drawY + 1);
    ctx.fillStyle = '#fff';
    ctx.fillText(t.icon, cx, drawY + 1);

    // Lv4+ 技能小标记。
    if (level >= 4) {
      const skillColor = skillColorV33(ball.type);
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

    // 唯一圆弧：出兵 CD。没有额外基础彩色环。
    if (state.phase === 'playing') {
      const cd = SPAWN_COOLDOWNS[level] || SPAWN_COOLDOWNS[1];
      const ready = ball.spawnTimer <= 0;
      const progress = ready ? 1 : clamp01(1 - ball.spawnTimer / cd);
      ctx.globalAlpha = ready ? 0.78 : 0.46;
      ctx.strokeStyle = ready ? '#fff176' : cdColor;
      ctx.lineWidth = ready ? 2.5 : 2.0;
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
