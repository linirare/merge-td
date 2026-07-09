/* ============================================================
   合成塔防 · PvE —— 棋盘逻辑
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
  return {
    x: bx + c * (CELL + GAP),
    y: by + r * (CELL + GAP),
    w: CELL, h: CELL,
  };
}

function slotAt(px, py, isEnemy) {
  const by = isEnemy ? LAYOUT.enemyBoardY : LAYOUT.playerBoardY;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const rect = slotRect(r, c, isEnemy);
      if (px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h)
        return [r, c];
    }
  }
  return null;
}

function emptySlots(slots) {
  const result = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (!slots[r][c]) result.push([r, c]);
  return result;
}

/* ——— 球逻辑 ——— */
function randomType() {
  return TYPE_IDS[Math.floor(Math.random() * TYPE_IDS.length)];
}

// 初始放 N 个球
function initBalls(slots, n, level = 1) {
  const empties = emptySlots(slots);
  // 随机打乱，让球散落在棋盘不同位置
  for (let i = empties.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [empties[i], empties[j]] = [empties[j], empties[i]];
  }
  for (let i = 0; i < Math.min(n, empties.length); i++) {
    const [r, c] = empties[i];
    slots[r][c] = createBall(randomType(), level);
  }
}

// 自动产球：找空闲位放一个随机球
function autoSpawnBall(slots, level = 1) {
  const empties = emptySlots(slots);
  if (empties.length === 0) return null; // 满了
  const [r, c] = empties[Math.floor(Math.random() * empties.length)];
  slots[r][c] = createBall(randomType(), level);
  return [r, c];
}

// 溢出队列处理：有空位就补
function drainOverflow(slots, queue) {
  while (queue.length > 0) {
    const empties = emptySlots(slots);
    if (empties.length === 0) break;
    const item = queue.shift();
    const [r, c] = empties[Math.floor(Math.random() * empties.length)];
    slots[r][c] = createBall(item.type, item.level);
  }
}

// 入溢出队列
function pushOverflow(queue, type, level = 1) {
  if (queue.length < OVERFLOW_MAX) {
    queue.push({ type, level });
    return true;
  }
  return false; // 队列也满了，丢弃
}

/* ——— 合成 ——— */
function tryMerge(slots, fromR, fromC, toR, toC) {
  const src = slots[fromR][fromC];
  const dst = slots[toR][toC];
  if (!src || !dst) return null;

  // 同品类 + 同级 → 合成
  if (src.type === dst.type && src.level === dst.level && src.level < MAX_LEVEL) {
    slots[fromR][fromC] = null;
    dst.level++;
    dst.bounce = 1;
    // 合并后按新等级重设冷却
    const newCd = SPAWN_COOLDOWNS[dst.level] || SPAWN_COOLDOWNS[1];
    dst.spawnTimer = newCd * 0.3; // 合并后快速产出一个兵
    return { merged: true, newLevel: dst.level, type: src.type, fromR, fromC, toR, toC };
  }

  // 否则交换位置
  slots[fromR][fromC] = dst;
  slots[toR][toC] = src;
  return { merged: false, swap: true };
}

// 移动到空格
function tryMove(slots, fromR, fromC, toR, toC) {
  const src = slots[fromR][fromC];
  const dst = slots[toR][toC];
  if (!src) return null;
  if (dst) return null; // 目标不是空格，不处理
  slots[fromR][fromC] = null;
  slots[toR][toC] = src;
  return { moved: true };
}

/* ——— 关卡初始化 ——— */
function initLevel(k) {
  const lv = generateLevel(k);
  state.currentLevel = k;
  state.levelConfig = lv;

  // 重置棋盘
  state.playerSlots = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  state.enemySlots  = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

  // 初始球
  initBalls(state.playerSlots, 5, 1);
  const eLv = Math.floor(lv.enemyInitLevel);
  const eFrac = lv.enemyInitLevel - eLv;
  const eLevel = eFrac > 0.5 ? eLv + 1 : eLv;
  initBalls(state.enemySlots, 5, eLevel);

  // 城墙
  state.playerWallHp = BASE_WALL_HP + getWallBonus(meta);
  state.playerWallMax = state.playerWallHp;
  state.enemyWallHp = lv.enemyWallHp;
  state.enemyWallMax = lv.enemyWallHp;

  // 清零
  state.playerSoldiers = [];
  state.enemySoldiers = [];
  state.overflowQueue = [];
  state.ballTimer = 0;
  state.enemyBallTimer = 0;
  state.playerSpawnTimer = 0;
  state.enemySpawnTimer = 0;
  state.enemyOverflow = 0;
  state.fx = [];
  state.attackFx = [];
  state.projectiles = [];
  state.dust = Array.from({ length: 12 }, () => ({
    x: Math.random() * W,
    y: LAYOUT.fieldY + Math.random() * LAYOUT.fieldH,
    vx: (Math.random() - 0.5) * 6,
    vy: -Math.random() * 4 - 2,
    size: 1 + Math.random() * 2,
    alpha: 0.02 + Math.random() * 0.04,
  }));
  state.time = 0;
  state.drag = null;
  state.shake = 0;
  state.phase = 'playing';
  resetAI();
}
