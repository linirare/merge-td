/* ============================================================
   水果突击 · Fruit Assault —— 清新果园 Canvas 皮肤
   Loaded after existing skin files and overrides visual-only functions.
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

  // 远处果园树冠
  ctx.fillStyle = 'rgba(69,166,73,0.16)';
  for (let i = 0; i < 8; i++) {
    const x = -20 + i * 68;
    ctx.beginPath();
    ctx.arc(x + 20, LAYOUT.enemyWallY - 64, 32, 0, Math.PI * 2);
    ctx.arc(x + 46, LAYOUT.enemyWallY - 72, 38, 0, Math.PI * 2);
    ctx.arc(x + 74, LAYOUT.enemyWallY - 62, 30, 0, Math.PI * 2);
    ctx.fill();
  }

  // 清新的水果泡泡点缀，不使用脏纹理
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
  if (intent === 'merge') return 'rgba(255,201,60,0.24)';
  if (intent === 'move') return 'rgba(83,201,106,0.16)';
  if (intent === 'swap') return 'rgba(77,182,255,0.16)';
  if (isEnemy) return (r + c) % 2 === 0 ? 'rgba(255,93,108,0.08)' : 'rgba(255,120,145,0.13)';
  return (r + c) % 2 === 0 ? 'rgba(255,255,255,0.48)' : 'rgba(255,252,211,0.62)';
}

function drawBoard(slots, isEnemy, dragHint = null) {
  const by = isEnemy ? LAYOUT.enemyBoardY : LAYOUT.playerBoardY;
  const title = isEnemy ? '腐坏水果营' : '水果突击营';
  const fill = isEnemy ? 'rgba(255,240,231,0.42)' : 'rgba(255,255,239,0.54)';
  const stroke = isEnemy ? 'rgba(255,93,108,0.24)' : 'rgba(83,201,106,0.22)';
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
      roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 12);
      ctx.fill();
      ctx.strokeStyle = isEnemy ? 'rgba(255,93,108,0.15)' : 'rgba(83,201,106,0.18)';
      ctx.lineWidth = 1;
      roundRect(x + 2.5, y + 2.5, CELL - 5, CELL - 5, 12);
      ctx.stroke();

      if (canMerge) {
        ctx.strokeStyle = 'rgba(255,201,60,0.70)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        roundRect(x + 4, y + 4, CELL - 8, CELL - 8, 10);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (ball) {
        ctx.save();
        if (isEnemy) ctx.globalAlpha = 0.82;
        drawBall(ball, x + CELL / 2, y + CELL / 2, CELL * 0.38);
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

function drawBall(ball, cx, cy, radius, extraY = 0) {
  const t = TYPES[ball.type];
  const bounceOff = ball.bounce ? -Math.sin(ball.bounce * Math.PI) * 12 : 0;
  const pulse = Math.sin(state.time * 4 + ball.level) * 0.018;
  const lvScale = 1 + (ball.level - 1) * 0.08 + pulse;
  const w = radius * 2.15 * lvScale;
  const h = radius * 1.86 * lvScale;
  const x = cx - w / 2;
  const y = cy - h / 2 - bounceOff + extraY;

  if (ball.level >= 3) {
    ctx.save();
    ctx.globalAlpha = 0.20 + ball.level * 0.035;
    ctx.shadowColor = t.color;
    ctx.shadowBlur = 8 + ball.level * 3;
    ctx.strokeStyle = ball.level >= 5 ? THEME.gold : t.color;
    ctx.lineWidth = 1.8;
    roundRect(x - 3, y - 3, w + 6, h + 6, 15);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.shadowColor = 'rgba(57,126,47,0.24)';
  ctx.shadowBlur = 9;
  ctx.shadowOffsetY = 3;
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, '#fffbd0');
  g.addColorStop(0.18, t.color);
  g.addColorStop(1, ball.type === 'bow' ? '#6d37cf' : ball.type === 'sword' ? '#f4a91f' : ball.type === 'spear' ? '#df7d1e' : '#189a4e');
  ctx.fillStyle = g;
  roundRect(x, y, w, h, 15);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.strokeStyle = ball.level >= 5 ? '#fff176' : 'rgba(255,255,255,0.72)';
  ctx.lineWidth = 2.2;
  roundRect(x + 1, y + 1, w - 2, h - 2, 14);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.moveTo(cx, y + 7);
  ctx.lineTo(x + w - 9, y + h * 0.42);
  ctx.lineTo(x + 9, y + h * 0.42);
  ctx.closePath();
  ctx.fill();

  ctx.font = `${Math.round(radius * 0.72)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(t.icon, cx, y + h * 0.50);

  const badgeR = Math.max(11, radius * 0.38);
  ctx.fillStyle = ball.level >= 5 ? '#fff176' : '#ffffff';
  ctx.beginPath();
  ctx.arc(x + badgeR + 2, y + badgeR + 1, badgeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(63,139,49,0.28)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.font = `900 ${Math.round(badgeR * 0.95)}px sans-serif`;
  ctx.fillStyle = ball.level >= 5 ? '#e38300' : '#2c8d3f';
  ctx.fillText(ball.level, x + badgeR + 2, y + badgeR + 2);
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

  // 果园小径
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
