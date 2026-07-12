/* ============================================================
   水果突击 · Fruit Assault —— 棋盘 / 卡组 / 合成逻辑
   ============================================================ */

function slotCenter(r, c, isEnemy) {
  const bx = BOARD_X, by = isEnemy ? LAYOUT.enemyBoardY : LAYOUT.playerBoardY;
  return { x: bx + c * (CELL + GAP) + CELL / 2, y: by + r * (CELL + GAP) + CELL / 2 };
}
function slotRect(r, c, isEnemy) {
  const bx = BOARD_X, by = isEnemy ? LAYOUT.enemyBoardY : LAYOUT.playerBoardY;
  return { x: bx + c * (CELL + GAP), y: by + r * (CELL + GAP), w: CELL, h: CELL };
}
function slotAt(px, py, isEnemy) {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const rect = slotRect(r, c, isEnemy);
    if (px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h) return [r, c];
  }
  return null;
}
function emptySlots(slots) {
  const result = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (!slots[r][c]) result.push([r, c]);
  return result;
}

/* ——— 随机池：玩家只从5个上阵水果中刷；敌人用战斗池，不用合成辅助球 ——— */
const ENEMY_POOL = ['watermelon_guard','coconut_guard','grape_archer','banana_raider','pineapple_lancer','orange_cannon','pumpkin_roller','pear_frost','strawberry_knight','avocado_brawler','dragonfruit_warrior','olive_assassin','mango_arbalest','cherry_bomber','melon_shaman'];
function randomType(pool = null) {
  const list = pool || activeDeck();
  return list[Math.floor(Math.random() * list.length)] || DEFAULT_DECK[0];
}
function randomEnemyType() {
  return ENEMY_POOL[Math.floor(Math.random() * ENEMY_POOL.length)] || 'watermelon_guard';
}
function shuffleSlots(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
function placeBall(slots, r, c, type, level = 1) {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
  slots[r][c] = createBall(type, level);
}
function initBalls(slots, n, level = 1, enemy = false) {
  const empties = shuffleSlots(emptySlots(slots));
  for (let i = 0; i < Math.min(n, empties.length); i++) {
    const [r, c] = empties[i];
    slots[r][c] = createBall(enemy ? randomEnemyType() : randomType(), level);
  }
}

function initPlayerOpening(k) {
  // 初始战场不再预置水果营:玩家开局获果汁能量,自行点空格召唤
}
function initEnemyOpening(k, level) {
  const plan = state.levelConfig && state.levelConfig.enemyPlan;
  if (plan) {
    const positions = [[1, 2], [0, 2], [2, 2], [1, 1], [1, 3], [0, 1], [2, 3], [0, 0], [2, 4], [0, 4]];
    const opening = Array.isArray(plan.opening) ? plan.opening : [];
    const targetCount = Math.max(opening.length, Math.min(positions.length, Number(plan.count || 0)));
    const enemyLevel = Math.max(1, level);
    let placed = 0;
    for (; placed < Math.min(opening.length, positions.length); placed++) {
      const [r, c] = positions[placed];
      const id = normalizeTypeId(opening[placed]);
      placeBall(state.enemySlots, r, c, TYPES[id] ? id : randomEnemyType(), enemyLevel);
    }
    while (placed < targetCount) {
      const [r, c] = positions[placed];
      placeBall(state.enemySlots, r, c, randomEnemyType(), enemyLevel);
      placed++;
    }
    if (k % 5 === 0) {
      const empties = emptySlots(state.enemySlots);
      if (empties.length) {
        const [r, c] = empties[0];
        state.enemySlots[r][c] = createBall(randomEnemyType(), Math.min(MAX_LEVEL, enemyLevel + 1));
      }
    }
    return;
  }
  const enemyCount = k === 1 ? 3 : k <= 3 ? 4 : 5;
  initBalls(state.enemySlots, enemyCount, Math.max(1, level), true);
  if (k % 5 === 0) {
    const empties = emptySlots(state.enemySlots);
    if (empties.length) {
      const [r, c] = empties[0];
      state.enemySlots[r][c] = createBall(randomEnemyType(), Math.min(MAX_LEVEL, level + 1));
    }
  }
}
function autoSpawnBall(slots, level = 1, enemy = false) {
  const empties = emptySlots(slots);
  if (empties.length === 0) return null;
  const [r, c] = empties[Math.floor(Math.random() * empties.length)];
  slots[r][c] = createBall(enemy ? randomEnemyType() : randomType(), level);
  return [r, c];
}
function drainOverflow(slots, queue) {
  while (queue.length > 0) {
    const empties = emptySlots(slots);
    if (empties.length === 0) break;
    const item = queue.shift();
    const [r, c] = empties[Math.floor(Math.random() * empties.length)];
    slots[r][c] = createBall(item.type, item.level);
  }
}
function pushOverflow(queue, type, level = 1) {
  if (queue.length < OVERFLOW_MAX) { queue.push({ type, level }); return true; }
  return false;
}

/* ——— 合成：普通同类、奇异果万能、百香果复制 ——— */
function isWildcard(ball) { return ball?.type === 'kiwi_wildcard'; }
function isCopyBall(ball) { return ball?.type === 'passion_copy'; }
function isMergeSupport(ball) { return isWildcard(ball) || isCopyBall(ball); }

function resetSpawnAfterMerge(ball) {
  const newCd = SPAWN_COOLDOWNS[ball.level] || SPAWN_COOLDOWNS[1];
  ball.spawnTimer = newCd * 0.25;
  ball.bounce = 1;
}

function tryMerge(slots, fromR, fromC, toR, toC) {
  const src = slots[fromR][fromC];
  const dst = slots[toR][toC];
  if (!src || !dst) return null;
  src.type = normalizeTypeId(src.type);
  dst.type = normalizeTypeId(dst.type);
  if (src.level !== dst.level || src.level >= MAX_LEVEL) {
    slots[fromR][fromC] = dst;
    slots[toR][toC] = src;
    return { merged: false, swap: true };
  }

  // 百香果复制：拖到同星目标上，原位变成目标水果，不消耗目标，专门养核心。
  if (isCopyBall(src) && !isMergeSupport(dst)) {
    src.type = dst.type;
    src.bounce = 1;
    src.spawnTimer = Math.max(0.2, src.spawnTimer * 0.25);
    return { merged: false, copied: true, type: dst.type, level: src.level, fromR, fromC, toR, toC };
  }

  // 奇异果万能：任意同星合成成目标水果 +1。
  if (isWildcard(src) && !isMergeSupport(dst)) {
    slots[fromR][fromC] = null;
    dst.level++;
    resetSpawnAfterMerge(dst);
    return { merged: true, wildcard: true, newLevel: dst.level, type: dst.type, fromR, fromC, toR, toC };
  }
  if (isWildcard(dst) && !isMergeSupport(src)) {
    slots[toR][toC] = createBall(src.type, src.level + 1);
    slots[fromR][fromC] = null;
    resetSpawnAfterMerge(slots[toR][toC]);
    return { merged: true, wildcard: true, newLevel: src.level + 1, type: src.type, fromR, fromC, toR, toC };
  }

  if (src.type === dst.type) {
    slots[fromR][fromC] = null;
    dst.level++;
    resetSpawnAfterMerge(dst);
    return { merged: true, newLevel: dst.level, type: src.type, fromR, fromC, toR, toC };
  }

  slots[fromR][fromC] = dst;
  slots[toR][toC] = src;
  return { merged: false, swap: true };
}

function tryMove(slots, fromR, fromC, toR, toC) {
  const src = slots[fromR][fromC];
  const dst = slots[toR][toC];
  if (!src || dst) return null;
  slots[fromR][fromC] = null;
  slots[toR][toC] = src;
  return { moved: true };
}

function initLevel(k) {
  meta.deck = normalizeDeck(meta.deck);
  const lv = generateLevel(k);
  state.currentLevel = k;
  state.levelConfig = lv;
  state.playerSlots = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  state.enemySlots  = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

  initPlayerOpening(k);
  const eLv = Math.floor(lv.enemyInitLevel);
  const eFrac = lv.enemyInitLevel - eLv;
  const eLevel = eFrac > 0.68 ? eLv + 1 : eLv;
  // 敌方也不再预置水果营:由AI用敌方果汁自行召唤(见 juice_economy.js tryEnemyJuiceSummon)

  state.playerWallHp = BASE_WALL_HP + getWallBonus(meta);
  state.playerWallMax = state.playerWallHp;
  state.enemyWallHp = lv.enemyWallHp;
  state.enemyWallMax = lv.enemyWallHp;
  state.playerSoldiers = [];
  state.enemySoldiers = [];
  state.overflowQueue = [];
  state.enemyOverflow = 0;
  state.ballTimer = 1.9;
  state.enemyBallTimer = 0.2;
  state.playerSpawnTimer = 0;
  state.enemySpawnTimer = 0;
  state.kills = 0;
  state.merges = 0;
  state.specialMerges = 0;
  state.maxSoldierAtk = 0;
  state.maxSoldierType = '';
  state.laneStats = emptyLaneStats();
  state.laneAlertCd = 0;
  state.laneAlerts = [];
  state.enemyWallDamageDealt = 0;
  state.playerWallDamageTaken = 0;
  state.damageByType = {};
  state.wallDamageByLane = Array(COLS).fill(0);
  state.breachLane = -1;
  state.lastBattleReport = null;
  state.drag = null;
  state.pendingPlace = null;
  state.fx = [];
  state.attackFx = [];
  state.projectiles = [];
  state.rings = [];
  state.rollings = [];
  state.sp = getSpStart(meta);
  state._spTimer = 0;
  state.shake = 0;
  state.time = 0;
  state.dust = Array.from({ length: 8 }, (_, i) => ({
    x: 42 + i * 54 + Math.random() * 12,
    y: LAYOUT.fieldY + 26 + Math.random() * (LAYOUT.fieldH - 52),
    vx: (Math.random() - 0.5) * 4,
    vy: -1.5 - Math.random() * 2,
    size: 1.1 + Math.random() * 1.4,
    alpha: 0.018 + Math.random() * 0.028,
  }));
  addFx(W / 2, LAYOUT.playerBoardY - 14, `消耗果汁点空格召唤 · ${activeDeck().map(id => TYPES[id].icon).join(' ')} 刷这5种`, THEME.gold, 14);
  state.phase = 'playing';
  resetAI();
}
