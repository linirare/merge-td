/* ============================================================
   水果突击 · Fruit Assault —— Final HUD Skin v59
   职责：顶部状态、统一操作栏、果汁主资源栏。战场内保持干净。
   v59：果汁轻反馈；顶部卡片降重；不恢复任何大提示条。
   ============================================================ */

function drawInfo() {
  const x = 8;
  const y = LAYOUT.enemyInfoY || 6;
  const h = 30;
  drawPanel(x, y, 112, h, 12, 'rgba(255,255,255,0.76)', 'rgba(83,201,106,0.22)');
  ctx.save();
  ctx.font = '900 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = THEME.textBright;
  ctx.fillText(`第 ${state.currentLevel || 1} 关`, x + 10, y + 13);
  ctx.font = '10px sans-serif';
  ctx.fillStyle = THEME.textDim;
  ctx.fillText(state.levelConfig?.isBoss ? '果堡突击' : '果园突击', x + 10, y + 25);
  ctx.restore();
}

function drawHUD() {
  if (state.phase !== 'playing' && state.phase !== 'paused') return;
  drawOperationResourceStripV59();
}

function nextActionCostV59() {
  if (typeof nextJuiceActionCost === 'function') return nextJuiceActionCost();
  return Math.max(1, Number(state.summonCostCounter || 1));
}

function drawOperationResourceStripV59() {
  const y = LAYOUT.operationY || (LAYOUT.playerWallY + LAYOUT.wallH + 16);
  const x = BOARD_X;
  const h = LAYOUT.operationH || 38;
  const w = BOARD_W;
  const cost = nextActionCostV59();
  const juice = Number(state.sp || 0);
  const canAct = juice >= cost;
  const pulse = Math.max(0, Math.min(1, Number(state._juicePulse || 0) / 0.50));
  const pulseKind = state._juicePulseKind || 'info';

  ctx.save();
  ctx.globalAlpha = 0.98;

  drawPanel(x, y, w, h, 15, 'rgba(255,252,230,0.70)', pulse > 0 ? 'rgba(255,201,60,0.52)' : 'rgba(255,201,60,0.30)');

  const juiceW = 124;
  if (pulse > 0) {
    ctx.save();
    ctx.globalAlpha = 0.22 * pulse;
    ctx.fillStyle = pulseKind === 'lack' ? '#ff5d6c' : '#ffc93c';
    roundRect(x + 1, y + 1, juiceW + 8, h - 2, 16);
    ctx.fill();
    ctx.restore();
  }

  const juiceGrad = ctx.createLinearGradient(x, y, x + juiceW, y + h);
  juiceGrad.addColorStop(0, canAct ? '#fff1a6' : '#ffe4e4');
  juiceGrad.addColorStop(1, canAct ? '#ffbf3d' : '#ff8f8f');
  ctx.fillStyle = juiceGrad;
  roundRect(x + 4, y + 4, juiceW, h - 8, 13);
  ctx.fill();
  ctx.strokeStyle = canAct ? `rgba(255,144,0,${0.48 + 0.22 * pulse})` : `rgba(210,72,72,${0.42 + 0.24 * pulse})`;
  ctx.lineWidth = 1.2 + pulse * 0.8;
  roundRect(x + 4.5, y + 4.5, juiceW - 1, h - 9, 13);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '900 11px sans-serif';
  ctx.fillStyle = canAct ? '#9c6200' : '#9c4b4b';
  ctx.fillText('🍹 果汁', x + 15, y + 13);
  ctx.font = `900 ${22 + pulse * 1.5}px sans-serif`;
  ctx.fillStyle = canAct ? '#fffdf2' : '#fff6f6';
  ctx.strokeStyle = canAct ? 'rgba(120,70,0,0.34)' : 'rgba(120,30,30,0.30)';
  ctx.lineWidth = 3;
  ctx.strokeText(String(juice), x + 70, y + 22);
  ctx.fillText(String(juice), x + 70, y + 22);

  const actionX = x + 138;
  const actionW = 94;
  ctx.fillStyle = canAct ? 'rgba(255,255,255,0.74)' : 'rgba(255,238,238,0.82)';
  roundRect(actionX, y + 5, actionW, h - 10, 12);
  ctx.fill();
  ctx.strokeStyle = canAct ? 'rgba(255,201,60,0.42)' : 'rgba(255,93,108,0.38)';
  ctx.lineWidth = 1;
  roundRect(actionX + 0.5, y + 5.5, actionW - 1, h - 11, 12);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.font = '800 9px sans-serif';
  ctx.fillStyle = THEME.textDim;
  ctx.fillText('下次行动', actionX + actionW / 2, y + 14);
  ctx.font = '900 16px sans-serif';
  ctx.fillStyle = canAct ? '#f39200' : '#d14d4d';
  ctx.fillText(String(cost), actionX + actionW / 2, y + 27);

  ctx.textAlign = 'left';
  ctx.font = '800 10px sans-serif';
  ctx.fillStyle = '#7e874e';
  ctx.fillText('每5秒 +1', x + 248, y + 15);
  ctx.fillText('击杀返等级', x + 248, y + 28);

  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

function drawTopActionBarV59() {
  if (state.phase !== 'playing' && state.phase !== 'paused') return;
  const x = PAUSE_RECT.x - 8;
  const y = LAYOUT.topBarY || 6;
  const h = 28;
  const w = (SPEED_RECT.x + SPEED_RECT.w) - x;

  ctx.save();
  ctx.globalAlpha = 0.95;
  drawPanel(x, y, w, h, 12, 'rgba(255,255,255,0.74)', 'rgba(124,160,80,0.24)');

  function drawMiniButton(rect, label, wide = false) {
    const bx = rect.x;
    const by = y + 3;
    const bw = rect.w;
    const bh = h - 6;
    ctx.fillStyle = wide ? 'rgba(255,201,60,0.42)' : 'rgba(236,255,222,0.78)';
    roundRect(bx, by, bw, bh, 8);
    ctx.fill();
    ctx.strokeStyle = wide ? 'rgba(207,146,22,0.32)' : 'rgba(83,201,106,0.22)';
    ctx.lineWidth = 1;
    roundRect(bx + 0.5, by + 0.5, bw - 1, bh - 1, 8);
    ctx.stroke();
    ctx.font = wide ? '900 13px sans-serif' : '900 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = wide ? '#795317' : '#5a7840';
    ctx.fillText(label, bx + bw / 2, by + bh / 2 + 0.5);
  }

  drawMiniButton(PAUSE_RECT, state.phase === 'paused' ? '▶' : '⏸');
  drawMiniButton(HELP_RECT, '?');
  drawMiniButton(SPEED_RECT, `×${state.speed || 1}`, true);
  ctx.restore();
}

function drawSpeedBtn() { drawTopActionBarV59(); }
function drawPauseBtn() { /* v59：统一由 drawSpeedBtn 绘制整组操作栏，保留点击热区。 */ }
function drawHelpBtn() { /* v59：统一由 drawSpeedBtn 绘制整组操作栏，保留点击热区。 */ }