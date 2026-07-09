/* ============================================================
   水果突击 · Board Level Readability v25
   修正：棋盘水果表情略缩小，并补回清晰等级徽章。
   原则：水果仍是主体；等级只做小徽章，不恢复大底色/大文字。
   Loaded after board_fruit_face_v23.js.
   ============================================================ */

(function installBoardLevelReadabilityV25() {
  patchBoardLevelReadabilityV25();
})();

const BOARD_LEVEL_READABILITY_BUILD = 'board-level-readability-v25';

function boardLvScaleV25(level) {
  return ({ 1:0.98, 2:1.04, 3:1.12, 4:1.21, 5:1.31, 6:1.42, 7:1.54 })[Math.max(1, Math.min(7, level || 1))] || 1;
}
function boardSkillColorV25(type) {
  if (typeof fruitBoardSkillColor === 'function') return fruitBoardSkillColor(type);
  if (typeof fruitFaceSkillColorV23 === 'function') return fruitFaceSkillColorV23(type);
  return ({
    watermelon_guard:'#53e77b', grape_archer:'#b076ff', banana_raider:'#ffd24a', pineapple_lancer:'#ffb547', orange_cannon:'#ff9a35',
    coconut_guard:'#9be7ff', peach_medic:'#ff9fbd', pear_frost:'#8fe9ff', blueberry_sniper:'#829cff', lemon_assassin:'#ffe45a',
    pumpkin_roller:'#ff9a35', kiwi_wildcard:'#8dff91', passion_copy:'#d08cff'
  })[type] || '#ffd54f';
}
function drawBoardSkillMarkV25(x, y, type, size, color) {
  if (typeof drawFruitBoardSkillMark === 'function') return drawFruitBoardSkillMark(x, y, type, size, color);
  if (typeof drawFruitSkillGlyphV23 === 'function') return drawFruitSkillGlyphV23(x, y, type, size, color);
  if (typeof drawMiniSkillGlyphV19 === 'function') return drawMiniSkillGlyphV19(x, y, type, size, color);
}
function drawLevelBadgeV25(cx, cy, ringR, level, isEnemy) {
  const badgeR = Math.max(8.5, Math.min(13, ringR * 0.28));
  const x = cx - ringR * 0.72;
  const y = cy - ringR * 0.72;
  const fill = level >= 7 ? '#fff176' : level >= 5 ? '#ffe37a' : '#ffffff';
  const stroke = isEnemy ? '#ff6578' : '#53c96a';

  ctx.save();
  ctx.globalAlpha = isEnemy ? 0.84 : 0.96;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, badgeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.font = `900 ${Math.round(badgeR * 1.10)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = level >= 5 ? '#9a5a00' : '#2c8d3f';
  ctx.fillText(String(level), x, y + 0.5);
  ctx.restore();
}

function patchBoardLevelReadabilityV25() {
  drawBall = function drawBallLevelReadableV25(ball, cx, cy, radius, extraY = 0, isEnemy = false) {
    if (!ball) return;
    const t = TYPES[ball.type] || TYPES[DEFAULT_DECK[0]];
    const level = Math.max(1, Math.min(7, ball.level || 1));
    const bounceOff = ball.bounce ? -Math.sin(ball.bounce * Math.PI) * 9 : 0;
    const floatOff = Math.sin((state?.time || 0) * 1.35 + cx * 0.06 + cy * 0.06) * 0.7;
    const drawY = cy - bounceOff + floatOff + extraY;
    const lvScale = boardLvScaleV25(level);
    const emojiSize = Math.round(radius * 1.62 * lvScale);
    const ringR = radius * (0.88 + (level - 1) * 0.072);
    const ringColor = isEnemy ? '#ff6578' : (t.color || '#53c96a');

    ctx.save();

    // 轻阴影，压低体积感。
    ctx.globalAlpha = isEnemy ? 0.13 : 0.18;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(cx, drawY + radius * 0.82, radius * 0.60 * lvScale, radius * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();

    // 细外圈。
    ctx.globalAlpha = isEnemy ? 0.46 : 0.58;
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = level >= 6 ? 2.8 : level >= 4 ? 2.3 : 1.8;
    ctx.beginPath();
    ctx.arc(cx, drawY, ringR, 0, Math.PI * 2);
    ctx.stroke();

    // 高等级光环保留，但缩小。
    if (level >= 4) {
      ctx.globalAlpha = level >= 7 ? 0.30 : level >= 6 ? 0.22 : 0.15;
      ctx.shadowColor = ringColor;
      ctx.shadowBlur = level >= 7 ? 14 : level >= 6 ? 10 : 7;
      ctx.strokeStyle = level >= 7 ? '#fff176' : ringColor;
      ctx.lineWidth = level >= 7 ? 3.4 : 2.4;
      ctx.beginPath();
      ctx.arc(cx, drawY, ringR + 4 + level * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 中等大小水果表情，仍然无底色。
    ctx.globalAlpha = isEnemy ? 0.82 : 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${emojiSize}px sans-serif`;
    ctx.lineWidth = Math.max(2.5, emojiSize * 0.050);
    ctx.strokeStyle = 'rgba(255,255,255,0.30)';
    ctx.strokeText(t.icon, cx, drawY + 1);
    ctx.fillStyle = '#fff';
    ctx.fillText(t.icon, cx, drawY + 1);

    // 等级徽章：用户必须能看出等级。
    drawLevelBadgeV25(cx, drawY, ringR, level, isEnemy);

    // Lv4+ 技能小标记。
    if (level >= 4) {
      const skillColor = boardSkillColorV25(ball.type);
      const markX = cx + ringR * 0.70;
      const markY = drawY - ringR * 0.70;
      const markR = Math.max(6.5, radius * 0.18);
      ctx.globalAlpha = isEnemy ? 0.68 : 0.92;
      ctx.fillStyle = 'rgba(20,24,16,0.54)';
      ctx.beginPath();
      ctx.arc(markX, markY, markR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = skillColor;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(markX, markY, markR, 0, Math.PI * 2);
      ctx.stroke();
      drawBoardSkillMarkV25(markX, markY, ball.type, Math.max(4.2, radius * 0.105), skillColor);
    }

    // 冷却弧。
    if (state.phase === 'playing') {
      const cd = SPAWN_COOLDOWNS[level] || SPAWN_COOLDOWNS[1];
      const ready = ball.spawnTimer <= 0;
      const progress = ready ? 1 : clamp01(1 - ball.spawnTimer / cd);
      ctx.globalAlpha = ready ? 0.86 : 0.50;
      ctx.strokeStyle = ready ? '#fff176' : ringColor;
      ctx.lineWidth = ready ? 2.8 : 2.1;
      if (ready) { ctx.shadowColor = '#fff176'; ctx.shadowBlur = 7; }
      ctx.beginPath();
      ctx.arc(cx, drawY, ringR + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  };

  // v20/v22 的冷却外挂会再绘制一次；这里降低它的存在感，避免和等级徽章抢信息。
  if (typeof drawOneCooldownV20 === 'function') {
    drawOneCooldownV20 = function drawOneCooldownReadableV25(ball, r, c, isEnemy) {
      if (!ball) return;
      const rect = slotRect(r, c, isEnemy);
      const center = slotCenter(r, c, isEnemy);
      const full = SPAWN_COOLDOWNS[ball.level || 1] || SPAWN_COOLDOWNS[1];
      const progress = 1 - clamp01((ball.spawnTimer || 0) / full);
      const color = isEnemy ? '#ff6578' : (TYPES[ball.type]?.color || THEME.gold);
      ctx.save();
      ctx.globalAlpha = isEnemy ? 0.22 : 0.42;
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      roundRect(rect.x + 9, rect.y + CELL - 8, CELL - 18, 4, 2);
      ctx.fill();
      ctx.fillStyle = color;
      roundRect(rect.x + 9, rect.y + CELL - 8, Math.max(3, (CELL - 18) * progress), 4, 2);
      ctx.fill();
      if (!isEnemy && progress >= 0.96) {
        ctx.globalAlpha = 0.42 + Math.sin(performance.now() / 90) * 0.18;
        ctx.strokeStyle = '#fff176';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(center.x, center.y, CELL * 0.43, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    };
  }
})();
