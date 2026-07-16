/* ============================================================
   球球英雄二 · Layout v60
   敌我 3×5 棋盘严格同尺寸镜像；中间战场吃掉弹性高度。
   ============================================================ */
(function applyLayoutV60() {
  if (typeof LAYOUT === 'undefined') return;

  LAYOUT.recalc = function (_w, h) {
    // 坐标直接匹配 battlefield-flat-2d-v5.png 内已经绘制好的框位。
    // 战斗逻辑区域保持 270..640，不因 UI 对齐改变既有移动/攻墙数值。
    const enemyBoardY = 86;
    const enemyWallY = 260;
    const fieldY = 270;
    const fieldH = 370;
    const playerWallY = 648;
    const playerBoardY = 684;
    const operationY = 864;
    const operationH = Math.max(44, h - operationY - 8);

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
