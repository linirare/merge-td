/* ============================================================
   水果突击 · Layout v59
   目标：维持 7 区块竖屏布局；顶部 HUD 继续减压；战场保持干净。
   只集中调整 LAYOUT，不碰战斗逻辑。
   ============================================================ */
(function applyLayoutV59() {
  if (typeof LAYOUT === 'undefined') return;

  Object.assign(LAYOUT, {
    // 1. 顶部状态栏：独立安全区，避免贴边。
    topBarY: 6,
    topBarH: 30,
    enemyInfoY: 6,

    // 2. 敌方棋盘区：比 v58 再下移 4px，给顶部 HUD 留呼吸。
    enemyBoardY: 62,

    // 3. 敌方城墙区。
    enemyWallY: 278,
    wallH: 20,

    // 4. 战场区：纯战斗内容，不放资源/提示。
    fieldY: 306,
    fieldH: 232,

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