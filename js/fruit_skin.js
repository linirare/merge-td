/* ============================================================
   水果突击 · Fruit Assault —— 清新果园 Canvas 皮肤
   v24：棋盘水果营改为“大号水果表情主体”，去掉厚重底色/圆盘。
   ============================================================ */

function drawPanel(x, y, w, h, r, fill = 'rgba(255,255,255,0.54)', stroke = 'rgba(72,174,70,0.16)') {
  ctx.fillStyle = fill;
  roundRect(x, y, w, h, r);
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    roundRect(x + 0.5, y + 0.5, w - 1, h - 1, r);
    ctx.stroke();
  }
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#fff9c8');
  sky.addColorStop(0.25, '#eaffb8');
  sky.addColorStop(0.58, '#b9f29a');
  sky.addColorStop(1, '#73d98b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(69,166,73,0.16)';
  for (let i = 0; i < 8; i++) {
    const x = -20 + i * 68;
    ctx.beginPath();
    ctx.arc(x + 20, LAYOUT.enemyWallY - 64, 32, 0, Math.PI * 2);
    ctx.arc(x + 46, LAYOUT.enemyWallY - 72, 38, 0, Math.PI * 2);
    ctx.arc(x + 74, LAYOUT.enemyWallY - 62, 30, 0, Math.PI * 2);
    ctx.fill();
  }

  const fruits = [
    ['rgba(255,93,108,0.12)', 52, 86, 18],
    ['rgba(155,92,255,0.10)', 400, 102, 22],
    ['rgba(255,201,60,0.13)', 420, 740, 28],
    ['rgba(83,201,106,0.10)', 58, 730, 24],
  ];
  for (const [color, x, y, r] of fruits) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const vignette = ctx.createRadialGradient(W / 2, H * 0.46, 80, W / 2, H * 0.52, 470);
  vignette.addColorStop(0, 'rgba(255,255,255,0.16)');
  vignette.addColorStop(0.64, 'rgba(255,255,255,0)');
  vignette.addColorStop(1, 'rgba(40,130,60,0.12)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
}

function drawInfo() {
  drawPanel(8, 5, 226, 34, 13, 'rgba(255,255,255,0.62)', 'rgba(83,201,106,0.18)');
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = THEME.textBright;
  const stageName = state.levelConfig?.isBoss ? `第 ${state.currentLevel} 关 · 腐坏果堡` : `第 ${state.currentLevel || 1} 关 · 果园突击`;
  ctx.fillText(stageName, 18, 20);
  ctx.font = '11px sans-serif';
  ctx.fillStyle = THEME.textDim;
  ctx.fillText(state.levelConfig?.desc || '水果合成 · 自动突击', 18, 33);
}

function fruitSlotFill(r, c, isEnemy, intent = '') {
  if (intent === 'merge') return 'rgba(255,201,60,0.18)';
  if (intent === 'move') return 'rgba(83,201,106,0.10)';
  if (intent === 'swap') return 'rgba(77,182,255,0.10)';
  if (isEnemy) return 'rgba(255,93,108,0.025)';
  return 'rgba(255,255,255,0.018)';
}

function fruitBoardLvScale(level) {
  return ({ 1:1.10, 2:1.18, 3:1.28, 4:1.40, 5:1.54, 6:1.68, 7:1.84 })[Math.max(1, Math.min(7, level || 1))] || 1;
}
function fruitBoardSkillColor(type) {
  return ({
    watermelon_guard:'#53e77b', grape_archer:'#b076ff', banana_raider:'#ffd24a', pineapple_lancer:'#ffb547', orange_cannon:'#ff9a35',
    coconut_guard:'#9be7ff', peach_medic:'#ff9fbd', pear_frost:'#8fe9ff', blueberry_sniper:'#829cff', lemon_assassin:'#ffe45a',
    pumpkin_roller:'#ff9a35', kiwi_wildcard:'#8dff91', passion_copy:'#d08cff'
  })[type] || '#ffd54f';
}
function drawFruitBoardSkillMark(x, y, type, size, color) {
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
  } else {
    ctx.beginPath();
    ctx.arc(x, y, size * 0.55, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBoard(slots, isEnemy, dragHint = null) {
  const by = isEnemy ? LAYOUT.enemyBoardY : LAYOUT.playerBoardY;
  const title = isEnemy ? '腐坏水果营' : '水果突击营';
  const fill = isEnemy ? 'rgba(255,240,231,0.24)' : 'rgba(255,255,239,0.30)';
  const stroke = isEnemy ? 'rgba(255,93,108,0.16)' : 'rgba(83,201,106,0.14)';
  drawPanel(BOARD_X - 10, by - 22, BOARD_W + 20, BOARD_H + 30, 16, fill, stroke);

  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = isEnemy ? '#ff5d6c' : '#2eb45a';
  ctx.fillText(title, W / 2, by - 8);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = BOARD_X + c * (CELL + GAP);
      const y = by + r * (CELL + GAP);
      const ball = slots[r][c];
      const isSnap = !isEnemy && state.drag?.nearestSnap && state.drag.nearestSnap.r === r && state.drag.nearestSnap.c === c;
      const action = isSnap ? state.drag.snapAction : '';
      const canMerge = state.drag && ball && !isEnemy && state.drag.unit.type === ball.type && state.drag.unit.level === ball.level && ball.level < MAX_LEVEL;
      const isEmptyTarget = state.drag && !ball && !isEnemy;
      const intent = isSnap ? action : canMerge ? 'merge' : isEmptyTarget ? 'move' : '';

      ctx.fillStyle = fruitSlotFill(r, c, isEnemy, intent);
      roundRect(x + 3, y + 3, CELL - 6, CELL - 6, 12);
      ctx.fill();
      ctx.strokeStyle = isEnemy ? 'rgba(255,93,108,0.07)' : 'rgba(83,201,106,0.08)';
      ctx.lineWidth = 1;
      roundRect(x + 4, y + 4, CELL - 8, CELL - 8, 11);
      ctx.stroke();

      if (canMerge) {
        ctx.strokeStyle = 'rgba(255,201,60,0.74)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        roundRect(x + 4, y + 4, CELL - 8, CELL - 8, 10);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (ball) {
        ctx.save();
        if (isEnemy) ctx.globalAlpha = 0.78;
        drawBall(ball, x + CELL / 2, y + CELL / 2, CELL * 0.39, 0, isEnemy);
        ctx.restore();
      }

      if (state.pendingPlace && !ball && !isEnemy) {
        ctx.strokeStyle = 'rgba(255,201,60,0.58)';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([3, 3]);
        roundRect(x + 4, y + 4, CELL - 8, CELL - 8, 10);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (isSnap && !isEnemy) {
        const color = action === 'merge' ? THEME.gold : action === 'move' ? THEME.safe : THEME.info;
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 12);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = color;
        const label = action === 'merge' ? '合成' : action === 'move' ? '移动' : '交换';
        ctx.fillText(label, x + CELL / 2, y + CELL - 6);
      }
    }
  }
}

function drawBall(ball, cx, cy, radius, extraY = 0, isEnemy = false) {
  const t = TYPES[ball.type] || TYPES[DEFAULT_DECK[0]];
  const level = Math.max(1, Math.min(7, ball.level || 1));
  const bounceOff = ball.bounce ? -Math.sin(ball.bounce * Math.PI) * 10 : 0;
  const floatOff = Math.sin(state.time * 1.45 + cx * 0.06 + cy * 0.06) * 0.9;
  const drawY = cy - bounceOff + floatOff + extraY;
  const lvScale = fruitBoardLvScale(level);
  const emojiSize = Math.round(radius * 1.78 * lvScale);
  const ringR = radius * (0.98 + (level - 1) * 0.09);
  const ringColor = isEnemy ? '#ff6578' : (t.color || '#53c96a');

  ctx.save();

  // 轻阴影：有落点，但没有厚重底盘。
  ctx.globalAlpha = isEnemy ? 0.14 : 0.20;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(cx, drawY + radius * 0.90, radius * 0.72 * lvScale, radius * 0.20, 0, 0, Math.PI * 2);
  ctx.fill();

  // 极淡外圈：敌我/边界识别。
  ctx.globalAlpha = isEnemy ? 0.48 : 0.62;
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = level >= 6 ? 3.2 : level >= 4 ? 2.6 : 2;
  ctx.beginPath();
  ctx.arc(cx, drawY, ringR, 0, Math.PI * 2);
  ctx.stroke();

  // 高级水果营光环，无文字等级。
  if (level >= 4) {
    ctx.globalAlpha = level >= 7 ? 0.36 : level >= 6 ? 0.28 : 0.18;
    ctx.shadowColor = ringColor;
    ctx.shadowBlur = level >= 7 ? 18 : level >= 6 ? 13 : 8;
    ctx.strokeStyle = level >= 7 ? '#fff176' : ringColor;
    ctx.lineWidth = level >= 7 ? 4 : 2.8;
    ctx.beginPath();
    ctx.arc(cx, drawY, ringR + 5 + level * 0.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // 大号水果表情主体。这里不再画任何彩色圆盘/矩形底色。
  ctx.globalAlpha = isEnemy ? 0.82 : 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${emojiSize}px sans-serif`;
  ctx.lineWidth = Math.max(3, emojiSize * 0.055);
  ctx.strokeStyle = 'rgba(255,255,255,0.34)';
  ctx.strokeText(t.icon, cx, drawY + 1);
  ctx.fillStyle = '#fff';
  ctx.fillText(t.icon, cx, drawY + 1);

  // Lv4+ 技能小标记。
  if (level >= 4) {
    const skillColor = fruitBoardSkillColor(ball.type);
    const markX = cx + ringR * 0.70;
    const markY = drawY - ringR * 0.70;
    const markR = Math.max(7, radius * 0.20);
    ctx.globalAlpha = isEnemy ? 0.70 : 0.96;
    ctx.fillStyle = 'rgba(20,24,16,0.56)';
    ctx.beginPath();
    ctx.arc(markX, markY, markR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = skillColor;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(markX, markY, markR, 0, Math.PI * 2);
    ctx.stroke();
    drawFruitBoardSkillMark(markX, markY, ball.type, Math.max(4.6, radius * 0.12), skillColor);
  }

  // 原始冷却弧保留，后续 v20/v22 还会叠加更清楚的短进度条。
  if (state.phase === 'playing') {
    const cd = SPAWN_COOLDOWNS[level] || SPAWN_COOLDOWNS[1];
    const ready = ball.spawnTimer <= 0;
    const progress = ready ? 1 : clamp01(1 - ball.spawnTimer / cd);
    ctx.globalAlpha = ready ? 0.88 : 0.52;
    ctx.strokeStyle = ready ? '#fff176' : ringColor;
    ctx.lineWidth = ready ? 3.0 : 2.4;
    if (ready) { ctx.shadowColor = '#fff176'; ctx.shadowBlur = 8; }
    ctx.beginPath();
    ctx.arc(cx, drawY, ringR + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

function drawWall(hp, maxHp, isEnemy) {
  const y = isEnemy ? LAYOUT.enemyWallY : LAYOUT.playerWallY;
  const ratio = clamp01(hp / maxHp);
  const x = 24;
  const w = W - 48;
  const h = LAYOUT.wallH;
  const fill = isEnemy ? '#ffb6b5' : '#a8ec7e';
  const fill2 = isEnemy ? '#ff6b7a' : '#59c96a';
  const line = isEnemy ? '#ff5d6c' : '#2eb45a';

  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, fill);
  g.addColorStop(1, fill2);
  drawPanel(x, y, w, h, 9, g, 'rgba(255,255,255,0.46)');

  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  for (let i = 0; i < 11; i++) {
    roundRect(x + 10 + i * 38, y + 4, 26, 5, 3);
    ctx.fill();
  }

  const bw = w - 20;
  const bx = x + 10;
  const by = y + h - 7;
  ctx.fillStyle = 'rgba(255,255,255,0.46)';
  roundRect(bx, by, bw, 4, 2);
  ctx.fill();
  ctx.fillStyle = line;
  roundRect(bx, by, bw * ratio, 4, 2);
  ctx.fill();

  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = isEnemy ? '#8f2737' : '#1c7738';
  ctx.fillText(isEnemy ? '腐坏果堡' : '水果果堡', W / 2, y + 14);
}

function drawField() {
  const fy = LAYOUT.fieldY;
  const fh = LAYOUT.fieldH;
  const x = 22;
  const w = W - 44;
  const g = ctx.createLinearGradient(0, fy, 0, fy + fh);
  g.addColorStop(0, 'rgba(255,246,210,0.80)');
  g.addColorStop(0.48, 'rgba(235,255,178,0.76)');
  g.addColorStop(1, 'rgba(142,231,168,0.76)');
  drawPanel(x, fy, w, fh, 18, g, 'rgba(255,255,255,0.55)');

  ctx.fillStyle = 'rgba(255,236,154,0.30)';
  roundRect(x + 14, fy + 12, w - 28, fh - 24, 16);
  ctx.fill();

  for (let c = 0; c < COLS; c++) {
    const lx = BOARD_X + c * (CELL + GAP) + CELL / 2;
    const st = state.laneStats?.[c];
    let laneColor = 'rgba(74,169,69,0.20)';
    if (st?.status === 'enemy_adv' || st?.status === 'wall_danger') laneColor = 'rgba(255,93,108,0.44)';
    else if (st?.status === 'player_adv' || st?.status === 'siege_ready') laneColor = 'rgba(83,201,106,0.42)';
    else if (st?.status === 'clash') laneColor = 'rgba(255,201,60,0.46)';

    if (st?.danger > 38) {
      ctx.fillStyle = 'rgba(255,93,108,0.10)';
      roundRect(lx - 26, fy + 10, 52, fh - 20, 13);
      ctx.fill();
    }

    ctx.strokeStyle = laneColor;
    ctx.lineWidth = c === 2 ? 2.4 : 1.7;
    ctx.beginPath();
    ctx.moveTo(lx, fy + 14);
    ctx.lineTo(lx, fy + fh - 14);
    ctx.stroke();

    const slotN = typeof SIEGE_SLOTS_PER_LANE === 'number' ? SIEGE_SLOTS_PER_LANE : 3;
    for (let i = 0; i < slotN; i++) {
      const off = (i - (slotN - 1) / 2) * 13;
      ctx.strokeStyle = 'rgba(255,159,55,0.34)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(lx + off, LAYOUT.enemyWallY + LAYOUT.wallH + 4, 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(lx + off, LAYOUT.playerWallY - 4, 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (st && st.pressureText) {
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = laneColor;
      ctx.fillText(st.pressureText, lx, fy + fh / 2 - 8);
    }
  }

  ctx.strokeStyle = 'rgba(255,201,60,0.52)';
  ctx.setLineDash([8, 7]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 18, fy + fh / 2);
  ctx.lineTo(x + w - 18, fy + fh / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,93,108,0.92)';
  ctx.fillText('腐坏水果向下推进', W / 2, fy + 18);
  ctx.fillStyle = 'rgba(46,180,90,0.94)';
  ctx.fillText('水果突击队向上进攻', W / 2, fy + fh - 8);

  for (const alert of state.laneAlerts || []) {
    const lx = BOARD_X + alert.lane * (CELL + GAP) + CELL / 2;
    const a = Math.max(0, alert.life / alert.maxLife);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(255,93,108,0.14)';
    roundRect(lx - 29, fy + 6, 58, fh - 12, 14);
    ctx.fill();
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5d6c';
    ctx.fillText(alert.text, lx, LAYOUT.playerWallY - 20);
    ctx.restore();
  }
}

function drawHUD() {
  if (state.phase !== 'playing' && state.phase !== 'paused') return;
  const pCount = state.playerSoldiers.filter(s => s.alive).length;
  const eCount = state.enemySoldiers.filter(s => s.alive).length;
  const total = pCount + eCount || 1;
  const elapsed = Math.floor(state.time);
  const spMax = typeof getSpMax === 'function' ? getSpMax(meta) : SP_MAX;
  const recoverCap = typeof getSpRecoverCap === 'function' ? getSpRecoverCap(meta) : 6;

  drawPanel(10, LAYOUT.fieldY + LAYOUT.fieldH - 40, 132, 32, 13, 'rgba(255,255,255,0.68)', 'rgba(83,201,106,0.22)');
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = state.sp > 0 ? '#f39200' : '#a1b786';
  ctx.fillText(`果汁 ⚡ ${state.sp}/${spMax}`, 20, LAYOUT.fieldY + LAYOUT.fieldH - 21);
  ctx.font = '9px sans-serif';
  ctx.fillStyle = THEME.textDim;
  ctx.fillText(`自动回复至 ${recoverCap}`, 20, LAYOUT.fieldY + LAYOUT.fieldH - 10);

  drawPanel(W - 112, LAYOUT.fieldY + LAYOUT.fieldH - 36, 102, 28, 13, 'rgba(255,255,255,0.62)', 'rgba(77,182,255,0.20)');
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#4f6a31';
  ctx.fillText(`⏱ ${elapsed}s`, W - 20, LAYOUT.fieldY + LAYOUT.fieldH - 17);

  const barW = 116, barH = 8;
  const bx = W / 2 - barW / 2, by = LAYOUT.fieldY + LAYOUT.fieldH - 28;
  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  roundRect(bx, by, barW, barH, 4);
  ctx.fill();
  ctx.fillStyle = THEME.safe;
  roundRect(bx, by, barW * (pCount / total), barH, 4);
  ctx.fill();
  ctx.fillStyle = THEME.accent;
  roundRect(bx + barW * (pCount / total), by, barW * (eCount / total), barH, 4);
  ctx.fill();

  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = THEME.safe;
  ctx.fillText(`水果 ${pCount}`, bx, by - 4);
  ctx.textAlign = 'right';
  ctx.fillStyle = THEME.accent;
  ctx.fillText(`${eCount} 腐坏`, bx + barW, by - 4);
}
