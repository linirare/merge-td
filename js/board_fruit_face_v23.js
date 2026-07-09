/* ============================================================
   水果突击 · Board Fruit Face v23
   棋盘水果营视觉重做：去掉厚重底色/圆盘，直接以大号水果表情作为主体。
   保留极淡格子边界、敌我细外圈、冷却弧/短进度条、技能小标记和即将出兵高亮。
   Loaded after spawn_cooldown_minimal_v22.js.
   ============================================================ */

(function installBoardFruitFaceV23() {
  patchBoardFruitFaceV23();
})();

const BOARD_FRUIT_FACE_BUILD = 'board-fruit-face-v23';

function fruitFaceLevelScaleV23(level) {
  return ({ 1:1.00, 2:1.07, 3:1.16, 4:1.27, 5:1.39, 6:1.52, 7:1.66 })[Math.max(1, Math.min(7, level || 1))] || 1;
}
function fruitFaceRingColorV23(ball, isEnemy = false) {
  if (isEnemy) return '#ff6578';
  const t = TYPES[ball?.type] || TYPES[DEFAULT_DECK[0]];
  return t.color || '#53c96a';
}
function fruitFaceSkillColorV23(type) {
  return ({
    watermelon_guard:'#53e77b', grape_archer:'#b076ff', banana_raider:'#ffd24a',
    pineapple_lancer:'#ffb547', orange_cannon:'#ff9a35', coconut_guard:'#9be7ff',
    peach_medic:'#ff9fbd', pear_frost:'#8fe9ff', blueberry_sniper:'#829cff',
    lemon_assassin:'#ffe45a', pumpkin_roller:'#ff9a35', kiwi_wildcard:'#8dff91', passion_copy:'#d08cff'
  })[type] || '#ffd54f';
}
function drawFruitSkillGlyphV23(x, y, type, size, color) {
  if (typeof drawMiniSkillGlyphV19 === 'function') {
    drawMiniSkillGlyphV19(x, y, type, size, color);
    return;
  }
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.18);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (type === 'watermelon_guard' || type === 'coconut_guard') {
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size * 0.72, y - size * 0.35);
    ctx.lineTo(x + size * 0.40, y + size * 0.78);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x - size * 0.40, y + size * 0.78);
    ctx.lineTo(x - size * 0.72, y - size * 0.35);
    ctx.closePath();
    ctx.stroke();
  } else if (type === 'grape_archer' || type === 'blueberry_sniper') {
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(x - size * 0.72, y + i * size * 0.34);
      ctx.lineTo(x + size * 0.72, y + i * size * 0.08);
      ctx.stroke();
    }
  } else if (type === 'banana_raider' || type === 'lemon_assassin') {
    ctx.beginPath();
    ctx.moveTo(x - size * 0.65, y + size * 0.48);
    ctx.lineTo(x + size * 0.06, y - size * 0.78);
    ctx.lineTo(x + size * 0.68, y - size * 0.05);
    ctx.stroke();
  } else if (type === 'pineapple_lancer') {
    ctx.beginPath();
    ctx.moveTo(x - size * 0.72, y + size * 0.62);
    ctx.lineTo(x + size * 0.75, y - size * 0.62);
    ctx.stroke();
  } else if (type === 'orange_cannon' || type === 'pumpkin_roller') {
    ctx.strokeRect(x - size * 0.62, y - size * 0.25, size * 1.05, size * 0.50);
    ctx.beginPath();
    ctx.arc(x - size * 0.32, y + size * 0.50, size * 0.20, 0, Math.PI * 2);
    ctx.arc(x + size * 0.36, y + size * 0.50, size * 0.20, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(x, y, size * 0.58, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function patchBoardFruitFaceV23() {
  const oldDrawBoard = typeof drawBoard === 'function' ? drawBoard : null;
  const oldDrawBall = typeof drawBall === 'function' ? drawBall : null;

  drawBall = function drawBallFruitFaceV23(ball, cx, cy, radius, extraY = 0, isEnemy = false) {
    if (!ball) return;
    const t = TYPES[ball.type] || TYPES[DEFAULT_DECK[0]];
    const level = Math.max(1, Math.min(7, ball.level || 1));
    const scale = fruitFaceLevelScaleV23(level);
    const bounceOff = ball.bounce ? -Math.sin(ball.bounce * Math.PI) * 10 : 0;
    const floatOff = Math.sin((state?.time || 0) * 1.45 + cx * 0.06 + cy * 0.06) * 0.9;
    const drawY = cy - bounceOff + floatOff + extraY;
    const ringColor = fruitFaceRingColorV23(ball, isEnemy);
    const emojiSize = Math.max(24, radius * 1.76 * scale);
    const ringR = radius * (0.95 + (level - 1) * 0.085);

    ctx.save();

    // 轻阴影：让水果表情有落点，但不再有厚底盘。
    ctx.globalAlpha = isEnemy ? 0.16 : 0.20;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(cx, drawY + radius * 0.86, radius * 0.66 * scale, radius * 0.20, 0, 0, Math.PI * 2);
    ctx.fill();

    // 极淡敌我外圈：识别边界，不做彩色实底。
    ctx.globalAlpha = isEnemy ? 0.46 : 0.58;
    ctx.strokeStyle = isEnemy ? '#ff6578' : ringColor;
    ctx.lineWidth = level >= 6 ? 3 : level >= 4 ? 2.5 : 2;
    ctx.beginPath();
    ctx.arc(cx, drawY, ringR, 0, Math.PI * 2);
    ctx.stroke();

    // 高等级轻光环：只表达成长，不显示数字。
    if (level >= 4) {
      ctx.globalAlpha = level >= 7 ? 0.34 : level >= 6 ? 0.26 : 0.18;
      ctx.shadowColor = ringColor;
      ctx.shadowBlur = level >= 7 ? 18 : level >= 6 ? 13 : 8;
      ctx.strokeStyle = level >= 7 ? '#fff176' : ringColor;
      ctx.lineWidth = level >= 7 ? 4 : 2.8;
      ctx.beginPath();
      ctx.arc(cx, drawY, ringR + 5 + level * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 大号水果表情主体：现在它就是主体，不再画圆盘底色。
    ctx.globalAlpha = isEnemy ? 0.82 : 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.round(emojiSize)}px sans-serif`;
    ctx.lineWidth = Math.max(3, emojiSize * 0.055);
    ctx.strokeStyle = 'rgba(255,255,255,0.34)';
    ctx.strokeText(t.icon, cx, drawY + 1);
    ctx.fillStyle = '#fff';
    ctx.fillText(t.icon, cx, drawY + 1);

    // 技能小标记：Lv4+ 才出现，不显示文字。
    if (level >= 4) {
      const skillColor = fruitFaceSkillColorV23(ball.type);
      const markX = cx + ringR * 0.68;
      const markY = drawY - ringR * 0.68;
      ctx.globalAlpha = isEnemy ? 0.70 : 0.94;
      ctx.fillStyle = 'rgba(20,24,16,0.56)';
      ctx.beginPath();
      ctx.arc(markX, markY, Math.max(7, radius * 0.20), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = skillColor;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(markX, markY, Math.max(7, radius * 0.20), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = isEnemy ? 0.72 : 1;
      drawFruitSkillGlyphV23(markX, markY, ball.type, Math.max(4.5, radius * 0.12), skillColor);
    }

    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  };
  drawBall._fruitFaceV23 = true;

  if (oldDrawBoard) {
    drawBoard = function drawBoardFruitFaceV23(slots, isEnemy, dragHint = null) {
      const by = isEnemy ? LAYOUT.enemyBoardY : LAYOUT.playerBoardY;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = BOARD_X + c * (CELL + GAP);
          const y = by + r * (CELL + GAP);
          const ball = slots[r][c];
          const isMergeHint = dragHint && ball && dragHint.type === ball.type && dragHint.level === ball.level;

          // 棋盘格不再铺厚底色：只保留极淡边界和必要的交互提示。
          ctx.fillStyle = isMergeHint ? 'rgba(255,228,90,0.11)' : 'rgba(255,255,255,0.015)';
          roundRect(x + 3, y + 3, CELL - 6, CELL - 6, 9);
          ctx.fill();
          ctx.strokeStyle = isEnemy ? 'rgba(255,96,120,0.08)' : 'rgba(120,190,90,0.08)';
          ctx.lineWidth = 1;
          roundRect(x + 4, y + 4, CELL - 8, CELL - 8, 8);
          ctx.stroke();

          if (isMergeHint) {
            ctx.strokeStyle = '#ffe45a';
            ctx.lineWidth = 2.4;
            ctx.shadowColor = '#ffe45a';
            ctx.shadowBlur = 12;
            roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 8);
            ctx.stroke();
            ctx.shadowBlur = 0;
          }

          if (ball) {
            ctx.save();
            if (isEnemy) ctx.globalAlpha = 0.72;
            drawBall(ball, x + CELL / 2, y + CELL / 2, CELL * 0.39, 0, isEnemy);
            ctx.restore();
          }

          if (state.pendingPlace && !ball && !isEnemy) {
            ctx.fillStyle = 'rgba(255,228,90,0.06)';
            roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 8);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,228,90,0.34)';
            ctx.lineWidth = 1.6;
            ctx.setLineDash([3, 3]);
            roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 8);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          const isSnap = state.drag?.nearestSnap && state.drag.nearestSnap.r === r && state.drag.nearestSnap.c === c;
          if (isSnap && !isEnemy) {
            ctx.shadowColor = '#ffe45a';
            ctx.shadowBlur = 18;
            ctx.strokeStyle = '#ffe45a';
            ctx.lineWidth = 2.5;
            roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 8);
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
        }
      }
    };
    drawBoard._fruitFaceV23 = true;
  }
})();
