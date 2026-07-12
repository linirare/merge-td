/* ============================================================
   水果突击 · Layout v59
   响应式布局:按实际 canvas 高度缩放 7 区 Y 坐标,多出的竖向空间分给战场。
   基准 H=854, canvas 放大时各区间距同比缩放。
   ============================================================ */
(function applyLayoutV59() {
  if (typeof LAYOUT === 'undefined') return;

  // 基准值(H=870 时,多16px给城墙-棋盘间距)
  const BASE_H = 870;
  // 固定段(不随高度缩放):顶栏30 + 敌棋盘204 + 敌墙20 + 我墙20 + 我棋盘204 + 操作条38 = 516
  const FIXED_SUM = 30 + 204 + 20 + 20 + 204 + 38; // 516
  const GAPS = 6 + 8 + 8 + 16 + 8; // 收紧上区间距,放大我方城墙→棋盘间距

  LAYOUT.recalc = function (w, h) {
    // 基准 fieldH=232(@H=870);多余高度全给战场
    const baseFH = 232;
    const extra = Math.max(0, h - BASE_H); // canvas比基准高多少
    const fieldH = Math.max(180, Math.round(baseFH + extra)); // floor 180
    const push = Math.max(0, fieldH - baseFH); // 战场额外高度,以下各区同量下推

    Object.assign(LAYOUT, {
      topBarY: 6, topBarH: 30, enemyInfoY: 6, enemyBoardY: 62,
      enemyWallY: 272,
      wallH: 20,
      fieldY: 300,
      fieldH: fieldH,
      playerWallY: 540 + push,
      playerBoardY: 584 + push,
      operationY: 796 + push,
      operationH: 38,
      bottomY: h - 22,
    });
  };

  // 首次加载:有canvas(浏览器)动态算;无canvas(无头/模拟)用静态原值
  if (typeof document !== 'undefined' && document.getElementById && document.getElementById('game')) {
    LAYOUT.recalc(480, 870);
  } else {
    Object.assign(LAYOUT, {topBarY:6,topBarH:30,enemyInfoY:6,enemyBoardY:62,enemyWallY:272,wallH:20,fieldY:300,fieldH:232,playerWallY:540,playerBoardY:584,operationY:796,operationH:38,bottomY:848});
  }
})();