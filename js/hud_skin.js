/* ============================================================
   水果突击 · Fruit Assault —— Final HUD Skin v48
   职责：关卡信息、HUD、阶段提示、速度/帮助/暂停按钮。这里是最终视觉源。
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
  const pCount = state.playerSoldiers.filter(s => s.alive).length;
  const eCount = state.enemySoldiers.filter(s => s.alive).length;
  const total = pCount + eCount || 1;
  const elapsed = Math.floor(state.time || 0);
  const spMax = typeof getSpMax === 'function' ? getSpMax(meta) : SP_MAX;
  const recoverCap = typeof getSpRecoverCap === 'function' ? getSpRecoverCap(meta) : 6;

  // 果汁信息放左下，不压中场。
  drawPanel(10, LAYOUT.fieldY + LAYOUT.fieldH - 40, 132, 32, 13, 'rgba(255,255,255,0.72)', 'rgba(83,201,106,0.20)');
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = state.sp > 0 ? '#f39200' : '#a1b786';
  ctx.fillText(`果汁 ⚡ ${state.sp}/${spMax}`, 20, LAYOUT.fieldY + LAYOUT.fieldH - 21);
  ctx.font = '9px sans-serif';
  ctx.fillStyle = THEME.textDim;
  ctx.fillText(`自动回复至 ${recoverCap}`, 20, LAYOUT.fieldY + LAYOUT.fieldH - 10);

  // 时间放右下。
  drawPanel(W - 112, LAYOUT.fieldY + LAYOUT.fieldH - 36, 102, 28, 13, 'rgba(255,255,255,0.68)', 'rgba(77,182,255,0.18)');
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#4f6a31';
  ctx.fillText(`⏱ ${elapsed}s`, W - 20, LAYOUT.fieldY + LAYOUT.fieldH - 17);

  // 兵数对比底部中间。
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

  drawBattlePhaseStripV48();
}

function battlePhaseMetaV48() {
  if (typeof battlePhaseV20 === 'function') {
    const ph = battlePhaseV20();
    if (ph?.key === 'prep') return { main:'#69b8ff', bg:'#eef9ff', label: ph.label || '合成期' };
    if (ph?.key === 'fight') return { main:'#d7a351', bg:'#fff3d7', label: ph.label || '交战期' };
    if (ph?.key === 'wall') return { main:'#65cb7b', bg:'#eaffea', label: ph.label || '攻墙期' };
    if (ph?.key === 'danger') return { main:'#ea737f', bg:'#ffe8eb', label: ph.label || '危险' };
  }
  return { main:'#d7a351', bg:'#fff3d7', label:'交战期' };
}

function drawBattlePhaseStripV48() {
  const meta = battlePhaseMetaV48();
  const w = 118;
  const h = 16;
  const x = W / 2 - w / 2;
  const y = LAYOUT.fieldY + 4;
  ctx.save();
  ctx.globalAlpha = 0.86;
  ctx.fillStyle = meta.bg;
  roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = meta.main;
  ctx.lineWidth = 1.1;
  roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 8);
  ctx.stroke();
  ctx.font = '900 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#3e4d29';
  ctx.fillText(meta.label, x + w / 2, y + h / 2 + 0.5);
  ctx.restore();
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
