/* ============================================================
   水果突击 · Fruit Assault —— Gameplay Assist Clean v56
   旧版本会在战场/操作区绘制“危险/合成/双击出兵”等大提示，
   与 v56 的干净战场和果汁主资源栏冲突。

   本文件保留兼容占位，但不再包裹 draw()，不再绘制提示条，
   不再绘制红色车道遮罩或棋盘推荐框。
   ============================================================ */

(function installGameplayAssistCleanV56() {
  window.__gameplayAssistCleanV56 = true;
})();

function ensureAssistState() {
  if (!state.assist) {
    state.assist = {
      tip: '',
      sub: '',
      kind: 'info',
      lane: -1,
      type: '',
      cd: 0,
      life: 0,
      mercyCd: 0,
      pulse: 0,
      highlights: [],
    };
  }
  return state.assist;
}

function setAssistTip() {
  // v56：不再显示局内大提示，避免遮挡战场和果汁栏。
}

function findBestMergeOption() {
  return null;
}

function findDangerLane() {
  return null;
}

function enemyTypeOnLane() {
  return '';
}

function counterTypeFor() {
  return '';
}

function findBestCounterBall() {
  return null;
}

function updateAssistHighlights() {
  const a = ensureAssistState();
  a.highlights = [];
}

function updateMercyJuice() {
  // v56：果汁经济已由 juice_economy.js 接管，不再做额外危急补给提示。
}

function updateGameplayAssist() {
  const a = ensureAssistState();
  a.tip = '';
  a.sub = '';
  a.life = 0;
  a.highlights = [];
}

function drawGameplayAssist() {
  // v56：彻底不画覆盖层。
}

function drawAssistHighlights() {
  // v56：彻底不画战场车道遮罩和棋盘推荐框。
}
