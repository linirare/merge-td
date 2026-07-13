/* ============================================================
   合成攻城 · 视觉皮肤覆盖层
   Loaded after render.js, overrides selected drawing functions.
   ============================================================ */

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

function drawPanel(x, y, w, h, r, fill = 'rgba(0,0,0,0.28)', stroke = 'rgba(255,228,90,0.14)') {
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
  sky.addColorStop(0, '#22170d');
  sky.addColorStop(0.28, '#342416');
  sky.addColorStop(0.62, '#1d160f');
  sky.addColorStop(1, '#15100c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let i = 0; i < 7; i++) {
    const bw = 42 + (i % 3) * 12;
    const bh = 26 + (i % 2) * 18;
    const x = 18 + i * 68;
    ctx.fillRect(x, LAYOUT.enemyWallY - 72 - bh, bw, bh);
    ctx.fillRect(x + 9, LAYOUT.enemyWallY - 78 - bh, bw - 18, 6);
  }

  const vignette = ctx.createRadialGradient(W / 2, H * 0.48, 80, W / 2, H * 0.5, 430);
  vignette.addColorStop(0, 'rgba(255,217,126,0.06)');
  vignette.addColorStop(0.6, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
}

function drawInfo() {
  drawPanel(8, 5, 216, 32, 10, 'rgba(0,0,0,0.30)', 'rgba(255,228,90,0.12)');
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = THEME.textBright;
  const stageName = state.levelConfig?.isBoss ? `第 ${state.currentLevel} 关 · Boss城门` : `第 ${state.currentLevel || 1} 关`;
  ctx.fillText(stageName, 18, 19);
  ctx.font = '11px sans-serif';
  ctx.fillStyle = THEME.textDim;
  ctx.fillText(state.levelConfig?.desc || '小兵合成 · 自动冲锋', 18, 32);
}

function drawBoard(slots, isEnemy, dragHint = null) {
  const by = isEnemy ? LAYOUT.enemyBoardY : LAYOUT.playerBoardY;
  const title = isEnemy ? '敌方兵营' : '我方兵营';
  drawPanel(BOARD_X - 10, by - 22, BOARD_W + 20, BOARD_H + 30, 14,
    isEnemy ? 'rgba(89,31,24,0.20)' : 'rgba(23,88,47,0.20)',
    isEnemy ? 'rgba(255,101,76,0.16)' : 'rgba(99,223,114,0.16)');

  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = isEnemy ? '#ff9a82' : '#94f59e';
  ctx.fillText(title, W / 2, by - 8);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = BOARD_X + c * (CELL + GAP);
      const y = by + r * (CELL + GAP);
      const ball = slots[r][c];
      const isMergeHint = dragHint && ball && dragHint.type === ball.type && dragHint.level === ball.level && ball.level < MAX_LEVEL;
      const isSnap = state.drag?.nearestSnap && state.drag.nearestSnap.r === r && state.drag.nearestSnap.c === c && !isEnemy;

      ctx.fillStyle = isMergeHint ? 'rgba(255,228,90,0.20)' : ((r + c) % 2 === 0 ? 'rgba(255,232,180,0.075)' : 'rgba(255,232,180,0.12)');
      roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 12);
      ctx.fill();
      ctx.strokeStyle = isEnemy ? 'rgba(255,125,91,0.10)' : 'rgba(255,228,145,0.12)';
      ctx.lineWidth = 1;
      roundRect(x + 2.5, y + 2.5, CELL - 5, CELL - 5, 12);
      ctx.stroke();

      if (isMergeHint || isSnap) {
        ctx.save();
        ctx.strokeStyle = '#ffe45a';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#ffe45a';
        ctx.shadowBlur = 12;
        roundRect(x + 3, y + 3, CELL - 6, CELL - 6, 12);
        ctx.stroke();
        ctx.restore();
      }

      if (state.pendingPlace && !ball && !isEnemy) {
        ctx.fillStyle = 'rgba(255,228,90,0.10)';
        roundRect(x + 7, y + 7, CELL - 14, CELL - 14, 10);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,228,90,0.36)';
        ctx.setLineDash([4, 4]);
        roundRect(x + 7, y + 7, CELL - 14, CELL - 14, 10);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (ball) {
        ctx.save();
        if (isEnemy) ctx.globalAlpha = 0.82;
        drawBall(ball, x + CELL / 2, y + CELL / 2, CELL * 0.36);
        ctx.restore();
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
    ctx.lineWidth = 1.6;
    roundRect(x - 3, y - 3, w + 6, h + 6, 14);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.38)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, t.color);
  g.addColorStop(1, '#2b2018');
  ctx.fillStyle = g;
  roundRect(x, y, w, h, 13);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.strokeStyle = ball.level >= 5 ? THEME.gold : 'rgba(255,255,255,0.26)';
  ctx.lineWidth = 2;
  roundRect(x + 1, y + 1, w - 2, h - 2, 12);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.moveTo(cx, y + 8);
  ctx.lineTo(x + w - 9, y + h * 0.43);
  ctx.lineTo(x + 9, y + h * 0.43);
  ctx.closePath();
  ctx.fill();

  ctx.font = `${Math.round(radius * 0.64)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(t.icon, cx, y + h * 0.50);

  const badgeR = Math.max(11, radius * 0.38);
  ctx.fillStyle = ball.level >= 5 ? '#ffe45a' : '#fff4d4';
  ctx.beginPath();
  ctx.arc(x + badgeR + 2, y + badgeR + 1, badgeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.font = `900 ${Math.round(badgeR * 0.95)}px sans-serif`;
  ctx.fillStyle = '#2b1f13';
  ctx.fillText(ball.level, x + badgeR + 2, y + badgeR + 2);

  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  roundRect(x + 7, y + h - 16, w - 14, 12, 6);
  ctx.fill();
  ctx.font = 'bold 9px sans-serif';
  ctx.fillStyle = '#fff4d4';
  ctx.fillText(t.name, cx, y + h - 9);

  if (state.phase === 'playing') {
    const cd = SPAWN_COOLDOWNS[ball.level] || SPAWN_COOLDOWNS[1];
    const ready = ball.spawnTimer <= 0;
    const progress = ready ? 1 : clamp01(1 - ball.spawnTimer / cd);
    ctx.strokeStyle = ready ? 'rgba(255,228,90,0.82)' : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = ready ? 3 : 2;
    if (ready) { ctx.shadowColor = THEME.gold; ctx.shadowBlur = 8; }
    ctx.beginPath();
    ctx.arc(cx, cy - bounceOff + extraY, Math.max(w, h) * 0.56, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

function drawWall(hp, maxHp, isEnemy) {
  const y = isEnemy ? LAYOUT.enemyWallY : LAYOUT.playerWallY;
  const w = W * 0.76;
  const h = LAYOUT.wallH;
  const x = (W - w) / 2;
  const frac = clamp01(hp / maxHp);

  ctx.save();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  if (isEnemy) { g.addColorStop(0, '#7e4a32'); g.addColorStop(1, '#3b261b'); }
  else { g.addColorStop(0, '#517044'); g.addColorStop(1, '#27351f'); }
  ctx.fillStyle = g;
  roundRect(x, y, w, h, 6);
  ctx.fill();

  const crenelCount = Math.max(2, Math.round(13 * Math.max(frac, 0.18)));
  ctx.fillStyle = isEnemy ? '#8e5639' : '#5d7b4c';
  for (let i = 0; i < crenelCount; i++) {
    const cw = (w - 10) / 13;
    ctx.fillRect(x + 5 + i * cw, y - 6, Math.max(6, cw - 3), 7);
  }

  if (frac < 0.55) {
    ctx.strokeStyle = frac < 0.25 ? 'rgba(255,90,55,0.75)' : 'rgba(255,220,150,0.38)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.26, y + 1);
    ctx.lineTo(x + w * 0.36, y + h * 0.48);
    ctx.lineTo(x + w * 0.31, y + h - 1);
    ctx.moveTo(x + w * 0.62, y + 1);
    ctx.lineTo(x + w * 0.71, y + h * 0.35);
    ctx.lineTo(x + w * 0.66, y + h - 1);
    ctx.stroke();
  }

  const barW = w - 14, barH = 8;
  const barX = x + 7, barY = y + h - barH - 4;
  ctx.fillStyle = 'rgba(0,0,0,0.52)';
  roundRect(barX, barY, barW, barH, 4);
  ctx.fill();
  ctx.fillStyle = frac > 0.5 ? THEME.safe : frac > 0.25 ? '#ffd24a' : '#ff5a3a';
  roundRect(barX + 1, barY + 1, Math.max(2, (barW - 2) * frac), barH - 2, 3);
  ctx.fill();

  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe6b0';
  ctx.strokeStyle = 'rgba(0,0,0,0.72)';
  ctx.lineWidth = 3;
  const label = isEnemy ? `敌城 ${hp}/${maxHp}` : `我方城墙 ${hp}/${maxHp}`;
  ctx.strokeText(label, W / 2, y - 10);
  ctx.fillText(label, W / 2, y - 10);
  ctx.restore();
}

function drawField() {
  const fy = LAYOUT.fieldY;
  const fh = LAYOUT.fieldH;
  const x = 22;
  const w = W - 44;
  const g = ctx.createLinearGradient(0, fy, 0, fy + fh);
  g.addColorStop(0, 'rgba(95,52,28,0.42)');
  g.addColorStop(0.5, 'rgba(54,38,25,0.36)');
  g.addColorStop(1, 'rgba(37,65,33,0.38)');
  drawPanel(x, fy, w, fh, 16, g, 'rgba(255,228,125,0.12)');

  for (let i = 0; i < 3; i++) {
    const laneY = fy + fh * (0.25 + i * 0.25);
    ctx.strokeStyle = 'rgba(255,225,150,0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 18, laneY);
    ctx.lineTo(x + w - 18, laneY);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(255,228,90,0.30)';
  ctx.setLineDash([8, 8]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 18, fy + fh / 2);
  ctx.lineTo(x + w - 18, fy + fh / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,116,92,0.85)';
  ctx.fillText('敌军推进', W / 2, fy + 18);
  ctx.fillStyle = 'rgba(105,236,118,0.85)';
  ctx.fillText('我方冲锋', W / 2, fy + fh - 8);
}

function drawSoldier(s) {
  const t = TYPES[s.type];
  const fy = LAYOUT.fieldY, fh = LAYOUT.fieldH;
  const depthFactor = 0.78 + 0.25 * ((s.y - fy) / fh);
  const r = (9 + s.level * 1.6) * depthFactor;
  const body = s.side === 'enemy' ? '#a53c33' : '#2f9b55';

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(s.x, s.y + r + 4, r * 0.9, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();

  if (s.hitFlash > 0) { ctx.fillStyle = '#ff2f1f'; ctx.shadowColor = '#ff2f1f'; ctx.shadowBlur = 8; }
  else ctx.fillStyle = body;
  roundRect(s.x - r * 0.62, s.y - r * 0.10, r * 1.24, r * 1.25, 6);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = t.color;
  ctx.beginPath();
  ctx.arc(s.x, s.y - r * 0.35, r * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = s.side === 'enemy' ? '#ff8a75' : '#98ff9f';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.font = `${Math.round(r * 0.86)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(t.icon, s.x, s.y - r * 0.36);

  ctx.fillStyle = 'rgba(0,0,0,0.48)';
  ctx.beginPath();
  ctx.arc(s.x + r * 0.72, s.y + r * 0.20, r * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `bold ${Math.round(r * 0.48)}px sans-serif`;
  ctx.fillStyle = THEME.gold;
  ctx.fillText(s.level, s.x + r * 0.72, s.y + r * 0.21);

  if (s.hp < s.maxHp) {
    const bw = r * 2.25, bh = 4;
    const bx = s.x - bw / 2, by = s.y - r - 9;
    ctx.fillStyle = 'rgba(0,0,0,0.58)';
    roundRect(bx, by, bw, bh, 2);
    ctx.fill();
    ctx.fillStyle = s.hp / s.maxHp > 0.5 ? THEME.safe : s.hp / s.maxHp > 0.25 ? '#ffd24a' : '#ff5a3a';
    roundRect(bx, by, bw * clamp01(s.hp / s.maxHp), bh, 2);
    ctx.fill();
  }

  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

function drawControlButton(rect, text, active = false) {
  drawPanel(rect.x, rect.y, rect.w, rect.h, 10, active ? 'rgba(255,228,90,0.20)' : 'rgba(0,0,0,0.34)', 'rgba(255,228,90,0.15)');
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = active ? THEME.gold : '#d7c49d';
  ctx.fillText(text, rect.x + rect.w / 2, rect.y + 19);
}
function drawPauseBtn(){} // → 壳HUD
function drawHelpBtn(){}  // → 壳HUD
function drawSpeedBtn(){}  // → 壳HUD

function drawOverflowIndicator() {
  if (state.overflowQueue.length === 0) return;
  drawPanel(OVERFLOW_RECT.x, OVERFLOW_RECT.y, OVERFLOW_RECT.w, OVERFLOW_RECT.h, 12, 'rgba(0,0,0,0.46)', 'rgba(255,228,90,0.26)');
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = THEME.gold;
  ctx.fillText(`📦 待部署 ×${state.overflowQueue.length}`, W / 2, OVERFLOW_RECT.y + 21);
}

function drawHUD() {
  if (state.phase !== 'playing' && state.phase !== 'paused') return;
  const pCount = state.playerSoldiers.filter(s => s.alive).length;
  const eCount = state.enemySoldiers.filter(s => s.alive).length;
  const total = pCount + eCount || 1;
  const elapsed = Math.floor(state.time);

  drawPanel(10, LAYOUT.fieldY + LAYOUT.fieldH - 34, 104, 26, 10, 'rgba(0,0,0,0.30)', null);
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = state.sp > 0 ? THEME.gold : '#695438';
  ctx.fillText(`士气 ⚡ ${state.sp}`, 20, LAYOUT.fieldY + LAYOUT.fieldH - 16);

  drawPanel(W - 112, LAYOUT.fieldY + LAYOUT.fieldH - 34, 102, 26, 10, 'rgba(0,0,0,0.30)', null);
  ctx.textAlign = 'right';
  ctx.fillStyle = THEME.textDim;
  ctx.fillText(`⏱ ${elapsed}s`, W - 20, LAYOUT.fieldY + LAYOUT.fieldH - 16);

  const barW = 116, barH = 8;
  const bx = W / 2 - barW / 2, by = LAYOUT.fieldY + LAYOUT.fieldH - 28;
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
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
  ctx.fillText(`我方 ${pCount}`, bx, by - 4);
  ctx.textAlign = 'right';
  ctx.fillStyle = THEME.accent;
  ctx.fillText(`${eCount} 敌方`, bx + barW, by - 4);
}

let _frameCount = 0;
function draw() {
  ctx.save();
  _frameCount++;
  if (!window.REDUCE_MOTION && state.shake > 0.05) ctx.translate(
    (_frameCount % 2 === 0 ? 1 : -1) * state.shake * 6,
    (_frameCount % 3 === 0 ? 1 : -1) * state.shake * 4
  );

  drawBackground();
  drawInfo();
  // 暂停/速度/帮助已迁移至壳HUD(#battleShellHud)

  drawBoard(state.enemySlots, true);
  drawWall(state.enemyWallHp, state.enemyWallMax, true);
  drawField();

  if (state.dust) {
    for (const d of state.dust) {
      ctx.fillStyle = `rgba(255,218,156,${d.alpha})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const s of state.enemySoldiers) drawSoldier(s);
  for (const s of state.playerSoldiers) drawSoldier(s);
  drawProjectiles();
  drawAttackFx();

  drawWall(state.playerWallHp, state.playerWallMax, false);

  let dragHint = null;
  if (state.drag && state.drag.moved) dragHint = { type: state.drag.unit.type, level: state.drag.unit.level };
  drawBoard(state.playerSlots, false, dragHint);

  if (state.drag && state.drag.moved) {
    const inBoard = slotAt(state.drag.x, state.drag.y, false) !== null;
    if (!inBoard) {
      ctx.fillStyle = 'rgba(255,80,60,0.12)';
      ctx.fillRect(0, LAYOUT.playerBoardY - 10, W, BOARD_H + 20);
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,118,92,0.82)';
      ctx.fillText('松手取消拖拽', W / 2, LAYOUT.playerBoardY + BOARD_H + 16);
    }
  }

  if (state.drag) {
    ctx.save();
    ctx.shadowColor = '#fff2be';
    ctx.shadowBlur = 20;
    drawBall(state.drag.unit, state.drag.x, state.drag.y, CELL * 0.42, 0);
    ctx.restore();
  }

  drawOverflowIndicator();
  drawRings();
  drawFx();
  drawHUD();

  if (state.phase === 'paused') {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.font = '900 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = THEME.gold;
    ctx.fillText('⏸ 已暂停', W / 2, H / 2);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = THEME.textDim;
    ctx.fillText('点击右上角 ▶ 继续', W / 2, H / 2 + 34);
  }
  ctx.restore();
}
