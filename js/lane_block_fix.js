/* ============================================================
   水果突击 · Lane Block Fix
   修正攻城前缺少同路阻塞判定的问题。
   规则：同路还有可战斗敌兵时，不允许直接打墙，先拉回接战。
   ============================================================ */

// updateSoldier + sameLaneBlocker/helpers 已合并到 combat.js,此文件仅保留标记。
(function installLaneBlockFix() {
  updateSoldier._laneBlockFixPatched = true;
})();
