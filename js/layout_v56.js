/* ============================================================
   水果突击 · Layout v58
   目标：顶部 HUD 与敌方棋盘彻底分层；7区块竖屏布局继续收口。
   只集中调整 LAYOUT，不碰战斗逻辑。
   ============================================================ */
(function applyLayoutV58() {
  if (typeof LAYOUT === 'undefined') return;

  Object.assign(LAYOUT, {
    // 1. 顶部状态栏：保留独立安全区，避免贴屏幕边缘。
    topBarY: 6,
    topBarH: 32,
    enemyInfoY: 6,

    // 2. 敌方棋盘区：整体下移，和顶部 HUD 拉开。
    enemyBoardY: 58,

    // 3. 敌方城墙区。
    enemyWallY: 274,
    wallH: 20,

    // 4. 战场区：纯战斗内容，不放资源/提示。
    fieldY: 302,
    fieldH: 236,

    // 5. 我方城墙区。
    playerWallY: 546,

    // 6. 操作信息区：只放果汁主资源与下次行动成本。
    operationY: 574,
    operationH: 38,

    // 7. 我方棋盘区：与敌方棋盘同宽同中心线。
    playerBoardY: 620,
    bottomY: 832,
  });
})();