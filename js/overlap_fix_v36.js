/* ============================================================
   水果突击 · Overlap Fix v36
   目标：
   1) 只保留一个右上角速度按钮
   2) 去掉战场中部重复阶段提示
   3) 把阶段提示压成顶部细条，不遮挡战场单位
   Loaded last.
   ============================================================ */
(function installOverlapFixV36() {
  neutralizeOverlapUiV36();
  patchFinalOverlayV36();
})();

const OVERLAP_FIX_BUILD = 'overlap-fix-v36';

function neutralizeOverlapUiV36() {
  // 尽量把旧提示条函数置空，避免重复绘制。
  if (typeof drawPhasePillUnifiedV31 === 'function') drawPhasePillUnifiedV31 = function noopPhaseUnifiedV36() {};
  if (typeof drawPhasePillV30 === 'function') drawPhasePillV30 = function noopPhaseV30V36() {};
  if (typeof drawTinyPhaseHudV27 === 'function') drawTinyPhaseHudV27 = function noopPhaseV27V36() {};
}

function patchFinalOverlayV36() {
  if (typeof draw !== 'function' || draw._overlapFixV36) return;
  const oldDraw = draw;
  draw = function drawOverlapFixV36() {
    oldDraw();
    if (!state || state.phase !== 'playing') return;
    cleanupTopRightV36();
    drawSingleSpeedPillV36();
    cleanupMidPhaseAreaV36();
    drawTopPhaseStripV36();
  };
  draw._overlapFixV36 = true;
}

function cleanupTopRightV36() {
  const x = W - 78;
  const y = Math.max(6, LAYOUT.enemyBoardY - 24);
  ctx.save();
  ctx.fillStyle = 'rgba(247,243,231,0.98)';
  roundRect(x, y, 70, 72, 10);
  ctx.fill();
  ctx.restore();
}

function drawSingleSpeedPillV36() {
  const x = W - 72;
  const y = Math.max(10, LAYOUT.enemyBoardY - 20);
  const w = 56;
  const h = 26;
  const speed = state.speed || 1;
  const label = `×${speed}`;
  ctx.save();
  ctx.fillStyle = 'rgba(202,192,133,0.94)';
  roundRect(x, y, w, h, 9);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,248,220,0.90)';
  ctx.lineWidth = 1.2;
  roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 9);
  ctx.stroke();
  ctx.font = '900 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fffdf1';
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 2;
  ctx.strokeText(label, x + w / 2, y + h / 2 + 0.5);
  ctx.fillText(label, x + w / 2, y + h / 2 + 0.5);
  ctx.restore();
}

function cleanupMidPhaseAreaV36() {
  // 清掉旧大阶段条和残影，覆盖范围收敛在战场上缘附近。
  const x = W / 2 - 100;
  const y = LAYOUT.fieldY + 6;
  const w = 200;
  const h = 44;
  ctx.save();
  ctx.fillStyle = 'rgba(244,232,200,0.98)';
  roundRect(x, y, w, h, 13);
  ctx.fill();
  // 重新补一点车道线，避免清理区域出现突兀空洞。
  ctx.globalAlpha = 0.32;
  ctx.strokeStyle = 'rgba(130,170,105,0.45)';
  ctx.lineWidth = 1.1;
  for (let c = 0; c < COLS; c++) {
    const lx = BOARD_X + c * (CELL + GAP) + CELL / 2;
    if (lx < x || lx > x + w) continue;
    ctx.beginPath();
    ctx.moveTo(lx, y + 4);
    ctx.lineTo(lx, y + h - 4);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTopPhaseStripV36() {
  const meta = battlePhaseMetaV36();
  const w = 118;
  const h = 15;
  const x = W / 2 - w / 2;
  const y = LAYOUT.fieldY + 5;
  ctx.save();
  ctx.globalAlpha = 0.88;
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

function battlePhaseMetaV36() {
  if (typeof battlePhaseV20 === 'function') {
    const ph = battlePhaseV20();
    if (ph?.key === 'prep') return { main: '#69b8ff', bg: '#eef9ff', label: ph.label || '合成期' };
    if (ph?.key === 'fight') return { main: '#d7a351', bg: '#fff3d7', label: ph.label || '交战期' };
    if (ph?.key === 'wall') return { main: '#65cb7b', bg: '#eaffea', label: ph.label || '攻墙期' };
    if (ph?.key === 'danger') return { main: '#ea737f', bg: '#ffe8eb', label: ph.label || '危险' };
  }
  return { main: '#d7a351', bg: '#fff3d7', label: '交战期' };
}
