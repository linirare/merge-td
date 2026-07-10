/* ============================================================
   Fruit Assault - Clean HUD Skin v60
   Keeps existing hit areas and gameplay hooks; redraws the visual HUD only.
   ============================================================ */

function hudRoundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hudPanel(x, y, w, h, r, fill, stroke = 'rgba(38,82,57,.14)') {
  ctx.fillStyle = fill;
  hudRoundRect(x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  hudRoundRect(x + 0.5, y + 0.5, w - 1, h - 1, r);
  ctx.stroke();
}

function drawInfo() {
  if (state.phase !== 'playing' && state.phase !== 'paused') return;
  const mode = state.mode === 'pvp' ? 'PVP' : (state.endless ? `天梯 ${state.endlessWave || 1}` : `第 ${state.currentLevel || 1} 关`);
  const desc = state.mode === 'pvp'
    ? `房间 ${state.pvpRoomId || '----'}`
    : (state.levelConfig?.isBoss ? '果堡 Boss' : '闯关推进');
  const x = 8;
  const y = LAYOUT.enemyInfoY || 6;

  ctx.save();
  hudPanel(x, y, 148, 34, 10, 'rgba(255,255,255,.84)');
  ctx.fillStyle = '#1f3328';
  ctx.font = '900 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(mode, x + 11, y + 12);
  ctx.fillStyle = '#6b7d68';
  ctx.font = '800 10px sans-serif';
  ctx.fillText(desc, x + 11, y + 25);

  const elapsed = Math.floor(state.time || 0);
  hudPanel(W / 2 - 34, y, 68, 34, 10, 'rgba(32,54,41,.88)', 'rgba(255,255,255,.18)');
  ctx.fillStyle = '#fff8cf';
  ctx.font = '900 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${elapsed}s`, W / 2, y + 18);
  ctx.restore();
}

function drawHUD() {
  if (state.phase !== 'playing' && state.phase !== 'paused') return;
  drawOperationResourceStripV60();
}

function nextActionCostV60() {
  if (typeof nextJuiceActionCost === 'function') return nextJuiceActionCost();
  return Math.max(1, Number(state.summonCostCounter || 1));
}

function drawOperationResourceStripV60() {
  const y = LAYOUT.operationY || (LAYOUT.playerWallY + LAYOUT.wallH + 16);
  const x = BOARD_X;
  const h = LAYOUT.operationH || 38;
  const w = BOARD_W;
  const cost = nextActionCostV60();
  const juice = Number(state.sp || 0);
  const canAct = juice >= cost;
  const pulse = Math.max(0, Math.min(1, Number(state._juicePulse || 0) / 0.50));
  const pulseKind = state._juicePulseKind || 'info';

  ctx.save();
  hudPanel(x, y, w, h, 12, 'rgba(255,255,255,.86)', pulseKind === 'lack' && pulse > 0 ? 'rgba(223,89,100,.48)' : 'rgba(38,82,57,.14)');

  const juiceW = 118;
  const juiceFill = canAct ? '#203629' : '#6f3a3d';
  ctx.fillStyle = juiceFill;
  hudRoundRect(x + 5, y + 5, juiceW, h - 10, 9);
  ctx.fill();
  if (pulse > 0) {
    ctx.globalAlpha = 0.20 * pulse;
    ctx.fillStyle = pulseKind === 'lack' ? '#df5964' : '#f4c64f';
    hudRoundRect(x + 5, y + 5, juiceW, h - 10, 9);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '800 10px sans-serif';
  ctx.fillStyle = canAct ? '#d9f0dc' : '#ffd1d6';
  ctx.fillText('果汁', x + 15, y + 14);
  ctx.font = '950 20px sans-serif';
  ctx.fillStyle = '#fff8cf';
  ctx.fillText(String(juice), x + 62, y + 21);

  const actionX = x + 132;
  hudPanel(actionX, y + 5, 78, h - 10, 9, canAct ? 'rgba(47,184,104,.12)' : 'rgba(223,89,100,.10)', canAct ? 'rgba(47,184,104,.24)' : 'rgba(223,89,100,.28)');
  ctx.textAlign = 'center';
  ctx.font = '800 9px sans-serif';
  ctx.fillStyle = '#6b7d68';
  ctx.fillText('下次消耗', actionX + 39, y + 14);
  ctx.font = '950 15px sans-serif';
  ctx.fillStyle = canAct ? '#167a48' : '#df5964';
  ctx.fillText(String(cost), actionX + 39, y + 27);

  ctx.textAlign = 'left';
  ctx.font = '800 10px sans-serif';
  ctx.fillStyle = '#6b7d68';
  ctx.fillText(canAct ? '点空格召唤' : '击杀/等待回果汁', x + 224, y + 15);
  ctx.fillText('双击营地急派', x + 224, y + 28);
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

function drawTopActionBarV60() {
  if (state.phase !== 'playing' && state.phase !== 'paused') return;
  const x = PAUSE_RECT.x - 8;
  const y = LAYOUT.topBarY || 6;
  const h = 34;
  const w = (SPEED_RECT.x + SPEED_RECT.w) - x;

  ctx.save();
  hudPanel(x, y, w, h, 10, 'rgba(255,255,255,.86)');

  function drawMiniButton(rect, label, strong = false) {
    const bx = rect.x;
    const by = y + 5;
    const bw = rect.w;
    const bh = h - 10;
    ctx.fillStyle = strong ? '#203629' : 'rgba(47,184,104,.10)';
    hudRoundRect(bx, by, bw, bh, 8);
    ctx.fill();
    ctx.fillStyle = strong ? '#fff8cf' : '#167a48';
    ctx.font = '900 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + bw / 2, by + bh / 2 + 0.5);
  }

  drawMiniButton(PAUSE_RECT, state.phase === 'paused' ? '▶' : 'Ⅱ');
  drawMiniButton(HELP_RECT, '?');
  drawMiniButton(SPEED_RECT, `×${state.speed || 1}`, true);
  ctx.restore();
}

function drawSpeedBtn() { drawTopActionBarV60(); }
function drawPauseBtn() {}
function drawHelpBtn() {}
