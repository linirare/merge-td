/* ============================================================
   水果突击 · Layout v56
   目标：7区块竖屏布局落地。只集中调整 LAYOUT，不碰战斗逻辑。
   ============================================================ */
(function applyLayoutV56() {
  if (typeof LAYOUT === 'undefined') return;

  Object.assign(LAYOUT, {
    // 1. 顶部状态栏
    topBarY: 4,
    topBarH: 36,
    enemyInfoY: 6,

    // 2. 敌方棋盘区：预留顶部按钮安全区
    enemyBoardY: 44,

    // 3. 敌方城墙区
    enemyWallY: 254,
    wallH: 20,

    // 4. 战场区：纯战斗内容，不放资源/提示
    fieldY: 282,
    fieldH: 252,

    // 5. 我方城墙区
    playerWallY: 542,

    // 6. 操作信息区：只放果汁主资源与下次行动成本
    operationY: 570,
    operationH: 38,

    // 7. 我方棋盘区：与敌方棋盘同宽同中心线
    playerBoardY: 614,
    bottomY: 826,
  });
})();
