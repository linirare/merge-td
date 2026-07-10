/* ============================================================
   水果突击 · Fruit Assault —— Final HUD Skin v55
   职责：顶部状态、操作资源条、速度/帮助/暂停按钮。战场内保持干净。
   果汁为无上限主动资源，只显示当前值与下次行动成本；不再显示合成提示。
   ============================================================ */

function drawInfo() {
  drawPanel(8, 5, 116, 34, 13, 'rgba(255,255,255,0.72)', 'rgba(83,201,106,0.20)');
  ctx.save();
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = THEME.textBright;
  ctx.fillText(`第 ${state.currentLevel || 1} 关`, 18, 20);
  ctx.font = '11px sans-serif';
  ctx.fillStyle = THEME.textDim;
  ctx.fillText(state.levelConfig?.isBoss ? '果堡突击' : '果园突击', 18, 33);
  ctx.restore();
}

function drawHUD() {
  if (state.phase !== 'playing' && state.phase !== 'paused') return;
  drawOperationResourceStripV55();
}

function nextActionCostV55() {
  if (typeof nextJuiceActionCost === 'function') return nextJuiceActionCost();
  return Math.max(1, Number(state.summonCostCounter || 1));
}

function drawOperationResourceStripV55() {
  const y = LAYOUT.operationY || (LAYOUT.playerWallY + LAYOUT.wallH + 16);
  const x = BOARD_X;
  const h = 30;
  const w = BOARD_W;
  const cost = nextActionCostV55();
  const canAct = (state.sp || 0) >= cost;

  ctx.save();
  ctx.globalAlpha = 0.96;
  drawPanel(x, y, w, h, 14, 'rgba(255,253,238,0.78)', canAct ? 'rgba(255,201,60,0.46)' : 'rgba(255,93,108,0.34)');

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '900 12px sans-serif';
  ctx.fillStyle = canAct ? '#f39200' : '#ba5f5f';
  ctx.fillText(`果汁 ⚡ ${state.sp || 0}`, x + 14, y + 11);

  ctx.font = '9px sans-serif';
  ctx.fillStyle = THEME.textDim;
  ctx.fillText(`下次行动 ${cost} · 每5秒+1 · 击杀返等级`, x + 14, y + 23);

  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

function drawSpeedBtn() {
  if (state.phase !== 'playing' && state.phase !== 'paused') return;
  ctx.save();
  const x = SPEED_RECT.x + 8;
  const y = SPEED_RECT.y + 2;
  const w = SPEED_RECT.w - 16;
  const h = SPEED_RECT.h - 4;
  ctx.fillStyle = 'rgba(202,192,133,0.88)';
  roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,248,220,0.78)';
  ctx.lineWidth = 1;
  roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 8);
  ctx.stroke();
  ctx.font = '900 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fffdf1';
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 2;
  const label = `×${state.speed || 1}`;
  ctx.strokeText(label, x + w / 2, y + h / 2 + 0.5);
  ctx.fillText(label, x + w / 2, y + h / 2 + 0.5);
  ctx.restore();
}

function drawPauseBtn() {
  if (state.phase !== 'playing' && state.phase !== 'paused') return;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.46)';
  roundRect(PAUSE_RECT.x, PAUSE_RECT.y + 2, PAUSE_RECT.w, PAUSE_RECT.h - 4, 8);
  ctx.fill();
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#7c8750';
  ctx.fillText(state.phase === 'paused' ? '▶' : '⏸', PAUSE_RECT.x + PAUSE_RECT.w / 2, PAUSE_RECT.y + PAUSE_RECT.h / 2 + 1);
  ctx.restore();
}

function drawHelpBtn() {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.46)';
  roundRect(HELP_RECT.x, HELP_RECT.y + 2, HELP_RECT.w, HELP_RECT.h - 4, 8);
  ctx.fill();
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#7c8750';
  ctx.fillText('?', HELP_RECT.x + HELP_RECT.w / 2, HELP_RECT.y + HELP_RECT.h / 2 + 1);
  ctx.restore();
}
