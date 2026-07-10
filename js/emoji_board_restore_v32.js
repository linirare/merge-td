/* ============================================================
   水果突击 · Emoji Board Restore v32
   修正：Art Resource Pack 把棋盘水果营从 emoji 表情变成了手绘 SVG。
   这里强制恢复“棋盘水果营 = emoji 表情主体”。
   注意：只恢复棋盘/营地水果，不影响其它 UI 资源包。
   Loaded last.
   ============================================================ */

(function installEmojiBoardRestoreV32() {
  patchEmojiBoardDrawBallV32();
})();

const EMOJI_BOARD_RESTORE_BUILD = 'emoji-board-restore-v32';

const EMOJI_FRUIT_SCALE_V32 = {
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
function emojiFruitScaleV32(type) {
  return EMOJI_FRUIT_SCALE_V32[type] ?? 0.99;
}
function emojiLevelScaleV32(level) {
  return ({ 1:0.94, 2:1.00, 3:1.08, 4:1.17, 5:1.26, 6:1.37, 7:1.49 })[Math.max(1, Math.min(7, level || 1))] || 1;
}
function emojiSkillColorV32(type) {
  if (typeof boardSkillColorV25 === 'function') return boardSkillColorV25(type);
  return TYPES[type]?.color || '#ffd54f';
}
function drawEmojiSkillGlyphV32(x, y, type, size, color) {
  if (typeof drawBoardSkillMarkV25 === 'function') return drawBoardSkillMarkV25(x, y, type, size, color);
  if (typeof drawMiniSkillGlyphV19 === 'function') return drawMiniSkillGlyphV19(x, y, type, size, color);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.6, size * 0.18);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (type === 'watermelon_guard' || type === 'coconut_guard') {
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size * 0.70, y - size * 0.32);
    ctx.lineTo(x + size * 0.38, y + size * 0.75);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x - size * 0.38, y + size * 0.75);
    ctx.lineTo(x - size * 0.70, y - size * 0.32);
    ctx.closePath();
    ctx.stroke();
  } else if (type === 'grape_archer' || type === 'blueberry_sniper') {
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(x - size * 0.72, y + i * size * 0.32);
      ctx.lineTo(x + size * 0.72, y + i * size * 0.08);
      ctx.stroke();
    }
  } else if (type === 'banana_raider' || type === 'lemon_assassin') {
    ctx.beginPath();
    ctx.moveTo(x - size * 0.62, y + size * 0.46);
    ctx.lineTo(x + size * 0.05, y - size * 0.75);
    ctx.lineTo(x + size * 0.65, y - size * 0.05);
    ctx.stroke();
  } else if (type === 'pineapple_lancer') {
    ctx.beginPath();
    ctx.moveTo(x - size * 0.72, y + size * 0.62);
    ctx.lineTo(x + size * 0.75, y - size * 0.62);
    ctx.stroke();
  } else if (type === 'orange_cannon' || type === 'pumpkin_roller') {
    ctx.strokeRect(x - size * 0.58, y - size * 0.24, size, size * 0.48);
  } else {
    ctx.beginPath();
    ctx.arc(x, y, size * 0.52, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function patchEmojiBoardDrawBallV32() {
  drawBall = function drawBallEmojiBoardV32(ball, cx, cy, radius, extraY = 0, isEnemy = false) {
    if (!ball) return;
    const t = TYPES[ball.type] || TYPES[DEFAULT_DECK[0]];
    const level = Math.max(1, Math.min(7, ball.level || 1));
    const bounceOff = ball.bounce ? -Math.sin(ball.bounce * Math.PI) * 8 : 0;
    const floatOff = Math.sin((state?.time || 0) * 1.25 + cx * 0.05 + cy * 0.05) * 0.55;
    const drawY = cy - bounceOff + floatOff + extraY;
    const lvScale = emojiLevelScaleV32(level) * emojiFruitScaleV32(ball.type);
    const emojiSize = Math.round(radius * 1.52 * lvScale);
    const ringR = radius * (0.83 + (level - 1) * 0.060) * emojiFruitScaleV32(ball.type);
    const ringColor = isEnemy ? '#ff6578' : (t.color || '#53c96a');
    const icon = t.icon || '🍉';

    ctx.save();

    // 轻阴影。
    ctx.globalAlpha = isEnemy ? 0.12 : 0.16;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(cx, drawY + radius * 0.74, radius * 0.50 * lvScale, radius * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    // 轻承托，不是手绘底盘。
    ctx.globalAlpha = isEnemy ? 0.70 : 0.84;
    ctx.fillStyle = 'rgba(255,255,255,0.52)';
    ctx.beginPath();
    ctx.ellipse(cx, drawY + 1, radius * 0.86, radius * 0.76, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isEnemy ? 'rgba(210,150,160,0.18)' : 'rgba(120,160,110,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, drawY + 1, radius * 0.86, radius * 0.76, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 敌我/等级外圈。
    ctx.globalAlpha = isEnemy ? 0.42 : 0.52;
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = level >= 6 ? 2.5 : level >= 4 ? 2.1 : 1.7;
    ctx.beginPath();
    ctx.arc(cx, drawY, ringR, 0, Math.PI * 2);
    ctx.stroke();

    // Lv4+ 觉醒光环。
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

    // 关键：恢复 emoji 表情主体，不绘制 ART.camps / SVG 手绘图。
    ctx.globalAlpha = isEnemy ? 0.82 : 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${emojiSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.lineWidth = Math.max(2.0, emojiSize * 0.045);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.strokeText(icon, cx, drawY + 1);
    ctx.fillStyle = '#fff';
    ctx.fillText(icon, cx, drawY + 1);

    // Lv4+ 技能小标。
    if (level >= 4) {
      const skillColor = emojiSkillColorV32(ball.type);
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
      drawEmojiSkillGlyphV32(markX, markY, ball.type, Math.max(3.9, radius * 0.098), skillColor);
    }

    // 冷却弧。
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
