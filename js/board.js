/* ============================================================
   合成攻城 · Merge Siege —— 棋盘逻辑
   ============================================================ */

/* ——— 棋盘辅助 ——— */
function slotCenter(r, c, isEnemy) {
  const bx = BOARD_X, by = isEnemy ? LAYOUT.enemyBoardY : LAYOUT.playerBoardY;
  return {
    x: bx + c * (CELL + GAP) + CELL / 2,
    y: by + r * (CELL + GAP) + CELL / 2,
  };
}

function slotRect(r, c, isEnemy) {
  const bx = BOARD_X, by = isEnemy ? LAYOUT.enemyBoardY : LAYOUT.playerBoardY;
  return { x: bx + c * (CELL + GAP), y: by + r * (CELL + GAP), w: CELL, h: CELL };
}

function slotAt(px, py, isEnemy) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const rect = slotRect(r, c, isEnemy);
      if (px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h) return [r, c];
    }
  }
  return null;
}

function emptySlots(slots) {
  const result = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (!slots[r][c]) result.push([r, c]);
  return result;
}

/* ——— 兵营逻辑 ——— */
function randomType() {
  return TYPE_IDS[Math.floor(Math.random() * TYPE_IDS.length)];
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

function initBalls(slots, n, level = 1) {
  const empties = shuffleSlots(emptySlots(slots));
  for (let i = 0; i < Math.min(n, empties.length); i++) {
    const [r, c] = empties[i];
    slots[r][c] = createBall(randomType(), level);
  }
}

// 前几关给玩家可合成对子，降低冷启动挫败。
function initPlayerOpening(k) {
  const starter = k === 1 ? 'bow' : k === 2 ? 'spear' : k === 3 ? 'shield' : randomType();
  placeBall(state.playerSlots, 1, 1, starter, 1);
  placeBall(state.playerSlots, 1, 2, starter, 1);
  placeBall(state.playerSlots, 2, 0, 'sword', 1);
  placeBall(state.playerSlots, 2, 4, 'shield', 1);
  placeBall(state.playerSlots, 0, 0, 'bow', 1);
  placeBall(state.playerSlots, 0, 4, 'spear', 1);
  if (k >= 4) placeBall(state.playerSlots, 2, 2, randomType(), 2);
}

function initEnemyOpening(k, level) {
  const enemyCount = k === 1 ? 3 : k <= 3 ? 4 : 5;
  initBalls(state.enemySlots, enemyCount, Math.max(1, level));
  if (k % 5 === 0) {
    const empties = emptySlots(state.enemySlots);
    if (empties.length) {
      const [r, c] = empties[0];
      state.enemySlots[r][c] = createBall(randomType(), Math.min(MAX_LEVEL, level + 1));
    }
  }
}

function autoSpawnBall(slots, level = 1) {
  const empties = emptySlots(slots);
  if (empties.length === 0) return null;
  const [r, c] = empties[Math.floor(Math.random() * empties.length)];
  slots[r][c] = createBall(randomType(), level);
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
  if (queue.length < OVERFLOW_MAX) {
    queue.push({ type, level });
    return true;
  }
  return false;
}

/* ——— 合成 ——— */
function tryMerge(slots, fromR, fromC, toR, toC) {
  const src = slots[fromR][fromC];
  const dst = slots[toR][toC];
  if (!src || !dst) return null;

  if (src.type === dst.type && src.level === dst.level && src.level < MAX_LEVEL) {
    slots[fromR][fromC] = null;
    dst.level++;
    dst.bounce = 1;
    const newCd = SPAWN_COOLDOWNS[dst.level] || SPAWN_COOLDOWNS[1];
    dst.spawnTimer = newCd * 0.28;
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

/* ——— 关卡初始化 ——— */
function initLevel(k) {
  const lv = generateLevel(k);
  state.currentLevel = k;
  state.levelConfig = lv;

  state.playerSlots = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  state.enemySlots  = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

  initPlayerOpening(k);
  const eLv = Math.floor(lv.enemyInitLevel);
  const eFrac = lv.enemyInitLevel - eLv;
  const eLevel = eFrac > 0.68 ? eLv + 1 : eLv;
  initEnemyOpening(k, eLevel);

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

  addFx(W / 2, LAYOUT.playerBoardY - 14, k <= 3 ? '拖拽同类兵营合成升级' : (lv.isBoss ? 'Boss城门：集中高等级兵营破门' : '合成升级，压过中线'), THEME.gold, 14);
  state.phase = 'playing';
  resetAI();
}