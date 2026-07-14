/* ============================================================
   球球英雄二 · Layout v60
   敌我 3×5 棋盘严格同尺寸镜像；中间战场吃掉弹性高度。
   ============================================================ */
(function applyLayoutV60() {
  if (typeof LAYOUT === 'undefined') return;

  LAYOUT.recalc = function (_w, h) {
    const enemyBoardY = 58;
    const enemyWallY = enemyBoardY + BOARD_H + 8;
    const operationH = 54;
    const operationY = h - operationH - 8;
    const playerBoardY = operationY - BOARD_H - 10;
    const playerWallY = playerBoardY - 28;
    const fieldY = enemyWallY + 32;
    const fieldH = Math.max(220, playerWallY - fieldY - 8);

    Object.assign(LAYOUT, {
      topBarY: 5,
      topBarH: 42,
      enemyInfoY: 5,
      enemyBoardY,
      enemyWallY,
      wallH: 20,
      fieldY,
      fieldH,
      playerWallY,
      playerBoardY,
      operationY,
      operationH,
      bottomY: h - 4,
    });
  };

  LAYOUT.recalc(W, H);
})();
