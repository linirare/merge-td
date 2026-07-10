/* ============================================================
   水果突击 · Overlap Cleanup v35
   目标：修复两个遮挡点
   1) 右上角速度按钮压敌方棋盘
   2) 战场阶段提示压单位/战场信息
   Loaded last.
   ============================================================ */

(function installOverlapCleanupV35() {
  patchSpeedButtonV35();
  patchPhasePillV35();
})();

const OVERLAP_CLEANUP_BUILD = 'overlap-cleanup-v35';

function patchSpeedButtonV35() {
  // 旧版 drawTopBar / drawTopHud / drawHUD 可能会画速度按钮。
  // 这里不强行改输入区，只在最终 draw 后用背景色清理旧按钮区域，再重绘一个更小、更靠上的速度按钮。
  if (typeof draw !== 'function' || draw._overlapCleanupSpeedV35) return;
  const oldDraw = draw;
  draw = function drawWithOverlapCleanupSpeedV35() {
    oldDraw();
    if (!state || state.phase !== 'playing') return;
    drawCompactSpeedChipV35();
  };
  draw._overlapCleanupSpeedV35 = true;
}

function drawCompactSpeedChipV35() {
  const speed = state.speed || 1;

  // 清掉旧速度按钮残影区域。位置覆盖截图右上角红框。
  ctx.save();
  ctx.globalAlpha = 0.98;
  const clearGrad = ctx.createLinearGradient(0, 0, 0, 90);
  clearGrad.addColorStop(0, 'rgba(230,249,172,0.96)');
  clearGrad.addColorStop(1, 'rgba(223,248,175,0.78)');
  ctx.fillStyle = clearGrad;
  roundRect(W - 88, 54, 78, 42, 14);
  ctx.fill();

  // 新速度按钮：更小，靠右上，不压敌方棋盘角。
  const x = W - 66;
  const y = 62;
  const w = 50;
  const h = 22;
  ctx.shadowColor = 'rgba(60,90,40,0.12)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = 'rgba(118,132,76,0.66)';
  roundRect(x, y, w, h, 11);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.42)';
  ctx.lineWidth = 1;
  roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 11);
  ctx.stroke();
  ctx.font = '900 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fffbe6';
  ctx.fillText(`×${speed}`, x + w / 2, y + h / 2 + 0.5);
  ctx.restore();
}

function patchPhasePillV35() {
  // 屏蔽 v30/v33 旧阶段提示，避免中场遮挡。
  if (typeof drawPhasePillV30 === 'function') drawPhasePillV30 = function noopPhasePillV35() {};
  if (typeof drawTinyPhaseHudV27 === 'function') drawTinyPhaseHudV27 = function noopTinyPhaseV35() {};

  if (typeof draw !== 'function' || draw._overlapCleanupPhaseV35) return;
  const oldDraw = draw;
  draw = function drawWithOverlapCleanupPhaseV35() {
    oldDraw();
    if (!state || state.phase !== 'playing') return;
    drawEdgePhaseHintV35();
  };
  draw._overlapCleanupPhaseV35 = true;
}

function drawEdgePhaseHintV35() {
  if (typeof battlePhaseV20 !== 'function') return;
  const ph = battlePhaseV20();

  // 清掉旧中场提示区域，避免残影压单位。
  const oldX = W / 2 - 100;
  const oldY = LAYOUT.fieldY + 18;
  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = 'rgba(244,232,200,0.78)';
  roundRect(oldX, oldY, 200, 34, 14);
  ctx.fill();
  ctx.restore();

  // 新提示贴到战场上边缘，变窄变薄，不压中线和单位。
  const map = {
    prep: ['#4db6ff', '#e5f7ff'],
    fight: ['#d9a24a', '#fff1c2'],
    wall: ['#63c97a', '#e3ffd8'],
    danger: ['#e86e78', '#ffe0e5'],
  };
  const [main, bg] = map[ph.key] || ['#d9a24a', '#fff4c0'];
  const label = ph.label || '交战期';
  const x = W / 2 - 44;
  const y = LAYOUT.fieldY + 2;
  const w = 88;
  const h = 15;

  ctx.save();
  ctx.globalAlpha = 0.78;
  ctx.fillStyle = bg;
  roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = main;
  ctx.lineWidth = 1;
  roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 8);
  ctx.stroke();
  ctx.font = '900 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#31502d';
  ctx.fillText(label, x + w / 2, y + h / 2 + 0.5);
  ctx.restore();
}
