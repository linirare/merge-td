/* ============================================================
   水果突击 · 新手体验 / 节奏修正
   目标：第1～3关先让玩家看懂接战、克制、治疗、攻城，而不是被合成速度压死。
   Loaded after main.js and before mechanics/juice.
   ============================================================ */

(function installTutorialBalance() {
  patchTutorialInitLevel();
  patchTutorialSpawnCap();
})();

const TUTORIAL_DECK = ['watermelon_guard','grape_archer','orange_cannon','peach_medic','kiwi_wildcard'];

function tutorialClearSlots(slots) {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) slots[r][c] = null;
}

function tutorialSetBall(slots, r, c, type, lv = 1) {
  if (r >= 0 && r < ROWS && c >= 0 && c < COLS) slots[r][c] = createBall(type, lv);
}

function tutorialResetPlayerOpening(k) {
  tutorialClearSlots(state.playerSlots);
  // 第1关：直接给出“前排 + 输出对子 + 治疗 + 攻城 + 万能”的可读组合。
  tutorialSetBall(state.playerSlots, 1, 1, 'grape_archer', 1);
  tutorialSetBall(state.playerSlots, 1, 2, 'grape_archer', 1);
  tutorialSetBall(state.playerSlots, 2, 1, 'watermelon_guard', 1);
  tutorialSetBall(state.playerSlots, 2, 2, 'peach_medic', 1);
  tutorialSetBall(state.playerSlots, 0, 2, 'orange_cannon', 1);
  tutorialSetBall(state.playerSlots, 0, 3, 'kiwi_wildcard', 1);

  if (k >= 2) tutorialSetBall(state.playerSlots, 2, 3, 'watermelon_guard', 1);
  if (k >= 3) tutorialSetBall(state.playerSlots, 0, 1, 'pear_frost', 1);
}

function tutorialResetEnemyOpening(k) {
  tutorialClearSlots(state.enemySlots);
  if (k === 1) {
    // 第1关只做“看得懂的少量接战”：敌方不铺满，不抢节奏。
    tutorialSetBall(state.enemySlots, 1, 2, 'banana_raider', 1);
    tutorialSetBall(state.enemySlots, 0, 2, 'watermelon_guard', 1);
    return;
  }
  if (k === 2) {
    tutorialSetBall(state.enemySlots, 1, 1, 'banana_raider', 1);
    tutorialSetBall(state.enemySlots, 1, 3, 'pineapple_lancer', 1);
    tutorialSetBall(state.enemySlots, 0, 2, 'grape_archer', 1);
    return;
  }
  if (k === 3) {
    tutorialSetBall(state.enemySlots, 1, 1, 'banana_raider', 1);
    tutorialSetBall(state.enemySlots, 1, 2, 'pineapple_lancer', 1);
    tutorialSetBall(state.enemySlots, 1, 3, 'grape_archer', 1);
    tutorialSetBall(state.enemySlots, 0, 2, 'coconut_guard', 1);
  }
}

function applyTutorialLevelTuning(k) {
  if (k > 3) return;

  meta.deck = TUTORIAL_DECK.slice();
  state.sp = Math.max(state.sp, k === 1 ? 12 : 10);
  state.playerWallMax = k === 1 ? 180 : k === 2 ? 150 : 130;
  state.playerWallHp = state.playerWallMax;
  state.enemyWallMax = k === 1 ? 54 : k === 2 ? 70 : 90;
  state.enemyWallHp = state.enemyWallMax;
  state.levelConfig.enemySpawnInterval = k === 1 ? 999 : k === 2 ? 13.5 : 10.8;
  state.levelConfig.enemyWallHp = state.enemyWallMax;
  state.ballTimer = k === 1 ? 6.5 : 5.2;
  state.enemyBallTimer = k === 1 ? 999 : 6.0;
  state._tutorialUnitCap = k === 1
    ? { player: 8, enemy: 3 }
    : k === 2
      ? { player: 10, enemy: 5 }
      : { player: 12, enemy: 7 };

  tutorialResetPlayerOpening(k);
  tutorialResetEnemyOpening(k);

  const msg = k === 1
    ? '教学1：先合成葡萄，看西瓜顶线、蜜桃回血、橙子拆墙'
    : k === 2
      ? '教学2：敌人开始补兵，用西瓜+葡萄稳住中线'
      : '教学3：加入控制/克制，观察哪一路在接战';
  addFx(W / 2, LAYOUT.fieldY + LAYOUT.fieldH / 2, msg, THEME.gold, 13);
}

function patchTutorialInitLevel() {
  if (typeof initLevel !== 'function' || initLevel._tutorialPatched) return;
  const oldInitLevel = initLevel;
  initLevel = function tutorialInitLevel(k) {
    oldInitLevel(k);
    applyTutorialLevelTuning(k);
  };
  initLevel._tutorialPatched = true;
}

function patchTutorialSpawnCap() {
  if (typeof spawnSoldierFromBall !== 'function' || spawnSoldierFromBall._tutorialPatched) return;
  const oldSpawnSoldier = spawnSoldierFromBall;
  spawnSoldierFromBall = function tutorialSpawnSoldier(ball, r, c, side, forced = false) {
    const cap = state._tutorialUnitCap;
    if (cap && side) {
      const group = side === 'player' ? state.playerSoldiers : state.enemySoldiers;
      const alive = group.filter(s => s.alive).length;
      const limit = cap[side] || 999;
      if (alive >= limit && !forced) return null;
    }
    return oldSpawnSoldier(ball, r, c, side, forced);
  };
  spawnSoldierFromBall._tutorialPatched = true;
}
