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

function hudPanel(x, y, w, h, r, fill, stroke = 'rgba(122,78,8,.14)') {
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
  ctx.fillStyle = '#FFE9A8';
  ctx.font = '900 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(mode, x + 11, y + 12);
  ctx.fillStyle = '#C9B48A';
  ctx.font = '700 12px sans-serif';
  ctx.fillText(desc, x + 11, y + 25);

  const elapsed = Math.floor(state.time || 0);
  hudPanel(W / 2 - 34, y, 68, 34, 10, 'rgba(34,22,12,.88)', 'rgba(255,255,255,.18)');
  ctx.fillStyle = '#fff8cf';
  ctx.font = '900 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${elapsed}s`, W / 2, y + 18);
  ctx.restore();
}

function drawHUD() {
  if (state.phase !== 'playing' && state.phase !== 'paused') return;
  drawOperationResourceStripV61();
}

function nextActionCostV60() {
  if (typeof nextJuiceActionCost === 'function') return nextJuiceActionCost();
  return Math.max(1, Number(state.summonCostCounter || 1));
}

function drawOperationResourceStripV60() { return drawOperationResourceStripV61(); }
function getJuiceSpawnButtonRectV60() {
  const y = LAYOUT.operationY || (LAYOUT.playerWallY + LAYOUT.wallH + 16);
  const x = BOARD_X; const h = LAYOUT.operationH || 38; const w = BOARD_W;
  return { x: x + 132, y: y + 4, w: w - 133, h: h - 8 };
}
window.getJuiceSpawnButtonRectV60 = getJuiceSpawnButtonRectV60;
window.getJuiceSpawnButtonRectV60 = getJuiceSpawnButtonRectV60;

function drawOperationResourceStripV61() {
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
  hudPanel(
    x,
    y,
    w,
    h,
    12,
    'rgba(255,255,255,.88)',
    pulseKind === 'lack' && pulse > 0 ? 'rgba(223,89,100,.48)' : 'rgba(122,78,8,.14)'
  );

  const juiceW = 112;
  const juiceFill = canAct ? '#3E2716' : '#6f3a3d';
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
  ctx.font = '700 12px sans-serif';
  ctx.fillStyle = canAct ? '#F3E3C0' : '#ffd1d6';
  ctx.fillText('\u679c\u6c41', x + 15, y + 14);
  ctx.font = '950 20px sans-serif';
  ctx.fillStyle = '#FFE9A8';
  ctx.fillText(String(juice), x + 56, y + 21);

  const btn = getJuiceSpawnButtonRectV60();
  const btnGrad = ctx.createLinearGradient(0, btn.y, 0, btn.y + btn.h);
  if (canAct) {
    btnGrad.addColorStop(0, '#ffe47a');
    btnGrad.addColorStop(1, '#ff9d3f');
  } else {
    btnGrad.addColorStop(0, '#f7d9b7');
    btnGrad.addColorStop(1, '#d9a081');
  }
  ctx.fillStyle = btnGrad;
  hudRoundRect(btn.x, btn.y, btn.w, btn.h, 10);
  ctx.fill();
  ctx.strokeStyle = canAct ? 'rgba(151,86,20,.30)' : 'rgba(112,68,60,.26)';
  ctx.lineWidth = 1;
  hudRoundRect(btn.x + 0.5, btn.y + 0.5, btn.w - 1, btn.h - 1, 10);
  ctx.stroke();

  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#fffdf0';
  hudRoundRect(btn.x + 4, btn.y + 3, btn.w - 8, 6, 5);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '950 17px sans-serif';
  ctx.fillStyle = canAct ? '#6a320c' : '#8c5950';
  ctx.fillText('\u51fa\u7403', btn.x + btn.w * 0.44, btn.y + btn.h / 2 + 1);

  const badgeW = 44;
  const badgeH = 22;
  const badgeX = btn.x + btn.w - badgeW - 8;
  const badgeY = btn.y + (btn.h - badgeH) / 2;
  ctx.fillStyle = canAct ? '#c94b55' : '#a76b67';
  hudRoundRect(badgeX, badgeY, badgeW, badgeH, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.54)';
  hudRoundRect(badgeX + 0.5, badgeY + 0.5, badgeW - 1, badgeH - 1, 8);
  ctx.stroke();
  ctx.font = '950 13px sans-serif';
  ctx.fillStyle = '#fff8cf';
  ctx.fillText(`-${cost}`, badgeX + badgeW / 2, badgeY + badgeH / 2 + 0.5);

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
    ctx.fillStyle = strong ? '#2C1B0E' : 'rgba(181,117,10,.12)';
    hudRoundRect(bx, by, bw, bh, 8);
    ctx.fill();
    ctx.fillStyle = strong ? '#FFE9A8' : '#B58A2E';
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

// drawSpeedBtn/drawPauseBtn/drawHelpBtn → 已迁移至壳HUD(#battleShellHud)
