/* ============================================================
   水果突击 · Board Slot Level Badge v26
   最终兜底：等级不再绑在水果表情上，而是画在格子固定左上角。
   这样无论水果主体/冷却层/技能层怎么变化，都能看到 Lv.1~Lv.7。
   Loaded last.
   ============================================================ */

(function installBoardSlotLevelBadgeV26() {
  if (typeof drawBoard !== 'function') return;
  const oldDrawBoard = drawBoard;
  drawBoard = function drawBoardWithSlotLevelBadgeV26(slots, isEnemy, dragHint = null) {
    oldDrawBoard(slots, isEnemy, dragHint);
    drawSlotLevelBadgesV26(slots, isEnemy);
  };
})();

const BOARD_SLOT_LEVEL_BADGE_BUILD = 'board-slot-level-badge-v26';

function levelBadgeColorV26(level, isEnemy) {
  if (level >= 7) return { fill:'#fff176', stroke:'#ffb300', text:'#6b3f00' };
  if (level >= 5) return { fill:'#ffe37a', stroke:'#f39200', text:'#6b3f00' };
  if (level >= 4) return { fill:'#ffffff', stroke:isEnemy ? '#ff6578' : '#53c96a', text:isEnemy ? '#9c2034' : '#186b34' };
  return { fill:'rgba(255,255,255,0.96)', stroke:isEnemy ? '#ff8ca0' : '#73d98b', text:'#2c5d35' };
}
function drawSlotLevelBadgesV26(slots, isEnemy) {
  const by = isEnemy ? LAYOUT.enemyBoardY : LAYOUT.playerBoardY;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ball = slots?.[r]?.[c];
      if (!ball) continue;
      const level = Math.max(1, Math.min(7, ball.level || 1));
      const x = BOARD_X + c * (CELL + GAP);
      const y = by + r * (CELL + GAP);
      const colors = levelBadgeColorV26(level, isEnemy);
      const bw = level >= 4 ? 28 : 25;
      const bh = 16;
      const bx = x + 3;
      const byy = y + 3;

      ctx.save();
      ctx.globalAlpha = isEnemy ? 0.86 : 1;
      ctx.shadowColor = 'rgba(0,0,0,0.18)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = colors.fill;
      roundRect(bx, byy, bw, bh, 7);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = 1.6;
      roundRect(bx + 0.5, byy + 0.5, bw - 1, bh - 1, 7);
      ctx.stroke();

      ctx.font = '900 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = colors.text;
      ctx.fillText(`Lv${level}`, bx + bw / 2, byy + bh / 2 + 0.5);
      ctx.restore();
    }
  }
}
