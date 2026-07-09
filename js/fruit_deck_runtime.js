/* ============================================================
   水果突击 · 运行时兼容补丁
   ============================================================ */

(function installFruitDeckRuntime() {
  if (typeof autoSpawnBall === 'function' && !autoSpawnBall._deckRuntimePatched) {
    const oldAutoSpawnBall = autoSpawnBall;
    autoSpawnBall = function deckAwareAutoSpawnBall(slots, level = 1, enemy = false) {
      return oldAutoSpawnBall(slots, level, enemy || slots === state.enemySlots);
    };
    autoSpawnBall._deckRuntimePatched = true;
  }

  if (typeof pushOverflow === 'function' && !pushOverflow._deckRuntimePatched) {
    const oldPushOverflow = pushOverflow;
    pushOverflow = function deckAwarePushOverflow(queue, type, level = 1) {
      return oldPushOverflow(queue, normalizeTypeId(type || randomType(activeDeck())), level);
    };
    pushOverflow._deckRuntimePatched = true;
  }
})();