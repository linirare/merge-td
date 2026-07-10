/* ============================================================
   水果突击 · Fruit Assault —— Final Fruit Board Skin v48
   职责：背景、棋盘、水果营。这里是最终视觉源，不再依赖 v23~v37 后置补丁。
   ============================================================ */

function clampV48(v, a, b) { return Math.max(a, Math.min(b, v)); }

function drawPanel(x, y, w, h, r, fill = 'rgba(255,255,255,0.54)', stroke = 'rgba(72,174,70,0.16)') {
  ctx.save();
  ctx.fillStyle = fill;
  roundRect(x, y, w, h, r);
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.1;
    roundRect(x + 0.5, y + 0.5, w - 1, h - 1, r);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#fff9c8');
  sky.addColorStop(0.25, '#eaffb8');
  sky.addColorStop(0.58, '#b9f29a');
  sky.addColorStop(1, '#73d98b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.fillStyle = 'rgba(69,166,73,0.12)';
  for (let i = 0; i < 8; i++) {
    const x = -20 + i * 68;
    ctx.beginPath();
    ctx.arc(x + 20, LAYOUT.enemyWallY - 64, 32, 0, Math.PI * 2);
    ctx.arc(x + 46, LAYOUT.enemyWallY - 72, 38, 0, Math.PI * 2);
    ctx.arc(x + 74, LAYOUT.enemyWallY - 62, 30, 0, Math.PI * 2);
    ctx.fill();
  }

  const fruits = [
    ['rgba(255,93,108,0.10)', 52, 86, 18],
    ['rgba(155,92,255,0.08)', 400, 102, 22],
    ['rgba(255,201,60,0.10)', 420, 740, 28],
    ['rgba(83,201,106,0.08)', 58, 730, 24],
  ];
  for (const [color, x, y, r] of fruits) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const vignette = ctx.createRadialGradient(W / 2, H * 0.46, 80, W / 2, H * 0.52, 470);
  vignette.addColorStop(0, 'rgba(255,255,255,0.16)');
  vignette.addColorStop(0.70, 'rgba(255,255,255,0)');
  vignette.addColorStop(1, 'rgba(40,130,60,0.10)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function boardContainerStyleV48(isEnemy) {
  return isEnemy
    ? { fill:'rgba(255,246,243,0.88)', stroke:'rgba(224,150,160,0.55)', title:'#c86e78', slot:'rgba(255,250,247,0.64)', slotLine:'rgba(220,165,175,0.42)' }
    : { fill:'rgba(250,255,247,0.90)', stroke:'rgba(160,205,150,0.52)', title:'#5ca45f', slot:'rgba(253,255,250,0.70)', slotLine:'rgba(140,195,130,0.42)' };
}

function drawBoard(slots, isEnemy, dragHint = null) {
  const by = isEnemy ? LAYOUT.enemyBoardY : LAYOUT.playerBoardY;
  const st = boardContainerStyleV48(isEnemy);
  const title = isEnemy ? '敌方水果营' : '我方水果营';

  drawPanel(BOARD_X - 10, by - 22, BOARD_W + 20, BOARD_H + 30, 17, st.fill, st.stroke);

  ctx.save();
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = st.title;
  ctx.fillText(title, W / 2, by - 8);
  ctx.restore();

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = BOARD_X + c * (CELL + GAP);
      const y = by + r * (CELL + GAP);
      const ball = slots?.[r]?.[c];
      const isSnap = !isEnemy && state.drag?.nearestSnap && state.drag.nearestSnap.r === r && state.drag.nearestSnap.c === c;
      const action = isSnap ? state.drag.snapAction : '';
      const canMerge = state.drag && ball && !isEnemy && state.drag.unit.type === ball.type && state.drag.unit.level === ball.level && ball.level < MAX_LEVEL;
      const isEmptyTarget = state.drag && !ball && !isEnemy;

      let fill = st.slot;
      let stroke = st.slotLine;
      if (canMerge || action === 'merge') { fill = 'rgba(255,247,214,0.88)'; stroke = 'rgba(255,200,60,0.82)'; }
      else if (isSnap || isEmptyTarget) { fill = 'rgba(245,255,248,0.80)'; stroke = 'rgba(110,205,145,0.66)'; }

      ctx.save();
      ctx.fillStyle = fill;
      roundRect(x + 3, y + 3, CELL - 6, CELL - 6, 12);
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.2;
      roundRect(x + 3.5, y + 3.5, CELL - 7, CELL - 7, 12);
      ctx.stroke();
      ctx.restore();

      if (canMerge) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,200,60,0.90)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        roundRect(x + 4, y + 4, CELL - 8, CELL - 8, 10);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      if (ball) {
        ctx.save();
        if (isEnemy) ctx.globalAlpha = 0.88;
        drawBall(ball, x + CELL / 2, y + CELL / 2, CELL * 0.39, 0, isEnemy);
        ctx.restore();
        drawSlotLevelBadgeV48(x, y, ball.level || 1, isEnemy);
      }

      if (state.pendingPlace && !ball && !isEnemy) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,201,60,0.58)';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([3, 3]);
        roundRect(x + 4, y + 4, CELL - 8, CELL - 8, 10);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      if (isSnap && !isEnemy) {
        const color = action === 'merge' ? THEME.gold : action === 'move' ? THEME.safe : THEME.info;
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.4;
        roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 12);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
      }
    }
  }
}

function fruitBoardLvScale(level) {
  return ({ 1:0.96, 2:1.02, 3:1.10, 4:1.19, 5:1.28, 6:1.38, 7:1.50 })[Math.max(1, Math.min(7, level || 1))] || 1;
}

function fruitBoardSkillColor(type) {
  return ({
    watermelon_guard:'#53e77b', grape_archer:'#b076ff', banana_raider:'#ffd24a', pineapple_lancer:'#ffb547', orange_cannon:'#ff9a35',
    coconut_guard:'#9be7ff', peach_medic:'#ff9fbd', pear_frost:'#8fe9ff', blueberry_sniper:'#829cff', lemon_assassin:'#ffe45a',
    pumpkin_roller:'#ff9a35', kiwi_wildcard:'#8dff91', passion_copy:'#d08cff'
  })[type] || '#ffd54f';
}

function drawBall(ball, cx, cy, radius, extraY = 0, isEnemy = false) {
  const t = TYPES[ball.type] || TYPES[DEFAULT_DECK[0]];
  const level = Math.max(1, Math.min(7, ball.level || 1));
  const bounceOff = ball.bounce ? -Math.sin(ball.bounce * Math.PI) * 9 : 0;
  const floatOff = Math.sin((state.time || 0) * 1.45 + cx * 0.06 + cy * 0.06) * 0.7;
  const drawY = cy - bounceOff + floatOff + extraY;
  const lvScale = fruitBoardLvScale(level);
  const emojiSize = Math.round(radius * 1.66 * lvScale);
  const trayRx = radius * 0.64 * lvScale;
  const trayRy = radius * 0.20;
  const arcR = radius * (0.94 + (level - 1) * 0.055);
  const ringColor = isEnemy ? '#ff6578' : (t.color || '#53c96a');

  ctx.save();

  // 米白托底 + 轻阴影，不再画基础彩色圆弧。
  ctx.globalAlpha = isEnemy ? 0.12 : 0.18;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(cx, drawY + radius * 0.86, trayRx, trayRy, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = isEnemy ? 0.36 : 0.48;
  ctx.fillStyle = '#fffdf4';
  ctx.beginPath();
  ctx.ellipse(cx, drawY + radius * 0.50, trayRx * 0.92, trayRy * 0.70, 0, 0, Math.PI * 2);
  ctx.fill();

  // 水果 emoji 主体。
  ctx.globalAlpha = isEnemy ? 0.84 : 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${emojiSize}px sans-serif`;
  ctx.lineWidth = Math.max(2.8, emojiSize * 0.050);
  ctx.strokeStyle = 'rgba(255,255,255,0.42)';
  ctx.strokeText(t.icon, cx, drawY + 1);
  ctx.fillStyle = '#fff';
  ctx.fillText(t.icon, cx, drawY + 1);

  // Lv4+ 技能小标。
  if (level >= 4) {
    const skillColor = fruitBoardSkillColor(ball.type);
    const markX = cx + arcR * 0.68;
    const markY = drawY - arcR * 0.68;
    const markR = Math.max(7, radius * 0.19);
    ctx.globalAlpha = isEnemy ? 0.72 : 0.96;
    ctx.fillStyle = 'rgba(20,24,16,0.52)';
    ctx.beginPath();
    ctx.arc(markX, markY, markR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = skillColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(markX, markY, markR, 0, Math.PI * 2);
    ctx.stroke();
    drawFruitBoardSkillMarkV48(markX, markY, ball.type, Math.max(4.4, radius * 0.12), skillColor);
  }

  // 唯一圆弧：出兵 CD。
  if (state.phase === 'playing') {
    const cd = SPAWN_COOLDOWNS[level] || SPAWN_COOLDOWNS[1] || 5;
    const ready = ball.spawnTimer <= 0;
    const progress = ready ? 1 : clamp01(1 - (ball.spawnTimer || 0) / cd);
    ctx.globalAlpha = ready ? 0.88 : 0.62;
    ctx.strokeStyle = ready ? '#fff176' : ringColor;
    ctx.lineWidth = ready ? 3.0 : 2.4;
    if (ready) { ctx.shadowColor = '#fff176'; ctx.shadowBlur = 7; }
    ctx.beginPath();
    ctx.arc(cx, drawY, arcR + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

function drawSlotLevelBadgeV48(x, y, level, isEnemy) {
  const lv = Math.max(1, Math.min(7, level || 1));
  const fill = lv >= 5 ? '#ffe37a' : '#fffdf7';
  const stroke = lv >= 5 ? '#d9aa26' : (isEnemy ? '#ef9ca7' : '#8bd38b');
  ctx.save();
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.4;
  roundRect(x + 2, y + 2, 28, 17, 7);
  ctx.fill();
  ctx.stroke();
  ctx.font = '900 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#2d6b36';
  ctx.fillText(`Lv${lv}`, x + 16, y + 10.5);
  ctx.restore();
}

function drawFruitBoardSkillMarkV48(x, y, type, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.8, size * 0.16);
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
  } else {
    ctx.beginPath();
    ctx.arc(x, y, size * 0.55, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
