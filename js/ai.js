/* ============================================================
   合成塔防 · PvE —— AI 对手（强化版）
   ============================================================ */

const AI_MERGE_INTERVAL = 5.6; // AI 基础合成间隔，随关卡缓慢加速
let aiTimer = 0;

/* ——— 分析玩家棋盘品类分布，返回AI应优先合成的品类 ——— */
function aiAnalyzePlayer() {
  const typeCount = {};
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ball = state.playerSlots[r][c];
      if (!ball) continue;
      typeCount[ball.type] = (typeCount[ball.type] || 0) + 1;
    }
  }

  // 找玩家最多的品类
  let maxType = null, maxCount = 0;
  for (const [t, cnt] of Object.entries(typeCount)) {
    if (cnt > maxCount) { maxType = t; maxCount = cnt; }
  }

  if (!maxType) return null;

  // 返回克制品类（克制链：弓→枪→刀→盾→弓）
  // 如果玩家最多是弓，AI优先合枪（弓→枪）
  const counterMap = { bow: 'spear', spear: 'sword', sword: 'shield', shield: 'bow' };
  return counterMap[maxType];
}

/* ——— AI 合成策略：优先克制品类，其次最高级对子 ——— */
function aiMerge() {
  const slots = state.enemySlots;
  const pairs = {}; // key: "type_level" → [{r, c, level, type}, ...]
  const preferType = aiAnalyzePlayer();

  // 按品类+等级分组
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ball = slots[r][c];
      if (!ball) continue;
      const key = ball.type + '_' + ball.level;
      if (!pairs[key]) pairs[key] = [];
      pairs[key].push({ r, c, level: ball.level, type: ball.type });
    }
  }

  // 前 3 关 AI 不强行针对玩家最高数量品类，避免新手被系统性克制。
  const allowCounterBias = state.currentLevel >= 4;

  // 先找可合的克制品类对子
  if (preferType && allowCounterBias) {
    for (const [key, list] of Object.entries(pairs)) {
      if (list.length >= 2 && list[0].type === preferType && list[0].level < MAX_LEVEL) {
        const src = list[0];
        const dst = list[1];
        const result = tryMerge(slots, src.r, src.c, dst.r, dst.c);
        if (result && result.merged) {
          const center = slotCenter(dst.r, dst.c, true);
          addFx(center.x, center.y - 12,
            `${TYPES[result.type].icon} AI合成 Lv.${result.newLevel}`, '#ffb84a', 11);
          state.rings.push({ x: center.x, y: center.y, r: 6, life: 0.3, maxLife: 0.3, color: '#ff8a5a' });
          return; // 本轮只合一次
        }
      }
    }
  }

  // 否则找最高级的可合对子
  let bestKey = null, bestLevel = 0;
  for (const [key, list] of Object.entries(pairs)) {
    if (list.length >= 2 && list[0].level > bestLevel && list[0].level < MAX_LEVEL) {
      bestKey = key;
      bestLevel = list[0].level;
    }
  }

  if (!bestKey) return;

  const list = pairs[bestKey];
  const result = tryMerge(slots, list[0].r, list[0].c, list[1].r, list[1].c);
  if (result && result.merged) {
    const center = slotCenter(list[1].r, list[1].c, true);
    addFx(center.x, center.y - 12,
      `${TYPES[result.type].icon} AI合成 Lv.${result.newLevel}`, '#ffb84a', 11);
    state.rings.push({ x: center.x, y: center.y, r: 6, life: 0.3, maxLife: 0.3, color: '#ff8a5a' });
  }
}

/* ——— AI 更新（由主循环调用） ——— */
function updateAI(dt) {
  if (state.phase !== 'playing') return;

  aiTimer += dt;
  const interval = Math.max(3.8, AI_MERGE_INTERVAL - state.currentLevel * 0.08);
  if (aiTimer >= interval) {
    aiTimer -= interval;
    aiMerge();
  }
}

/* ——— 重置 AI 计时器（随机开局延迟） ——— */
function resetAI() {
  aiTimer = -1.2 + Math.random() * 1.4; // 开局给玩家 4 秒左右读盘/合成窗口
}