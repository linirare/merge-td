/* ============================================================
   合成塔防 · PvE —— 游戏状态管理
   ============================================================ */

/* ——— 球对象 ——— */
function createBall(typeId, level = 1) {
  return { type: typeId, level: Math.min(level, MAX_LEVEL), bounce: 0 };
}

/* ——— 兵对象 ——— */
function createSoldier(typeId, level, atkMul = 1, hpMul = 1) {
  const t = TYPES[typeId];
  const mul = LEVEL_MUL[level] || 1;
  return {
    type: typeId,
    level,
    id: Math.random().toString(36).slice(2),
    atk: Math.round(t.atk * mul * atkMul),
    hp: Math.round(t.hp * mul * hpMul),
    maxHp: Math.round(t.hp * mul * hpMul),
    x: 0, y: 0,
    speed: t.speed,
    target: null,
    alive: true,
    atkTimer: 0,
    hitFlash: 0,
    side: '', // 'player' | 'enemy'
  };
}

/* ——— 主游戏状态 ——— */
function createState() {
  return {
    phase: 'menu', // 'menu' | 'playing' | 'paused' | 'won' | 'lost'

    // 棋盘
    playerSlots: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
    enemySlots:  Array.from({ length: ROWS }, () => Array(COLS).fill(null)),

    // 队列
    overflowQueue: [],
    enemyOverflow: 0,

    // 城墙
    playerWallHp: BASE_WALL_HP,
    playerWallMax: BASE_WALL_HP,
    enemyWallHp: BASE_WALL_HP,
    enemyWallMax: BASE_WALL_HP,

    // 兵
    playerSoldiers: [],
    enemySoldiers: [],

    // 计时器
    ballTimer: 0,
    enemyBallTimer: 0,
    playerSpawnTimer: 0,
    enemySpawnTimer: 0,

    // 关卡
    currentLevel: 1,
    levelConfig: null,

    // 拖拽
    drag: null, // { unit, fromR, fromC, x, y, sx, sy, moved }

    // 特效
    fx: [], // [{x, y, text, color, life, maxLife, size}]
    attackFx: [], // [{x1, y1, x2, y2, life, maxLife}] 攻击划痕
    projectiles: [], // [{x, y, targetX, targetY, targetId, dmg, speed, color, life}]
    dust: [], // [{x, y, vx, vy, size, alpha}] 环境尘埃
    // 环特效
    rings: [], // [{x, y, r, life, maxLife, color}]

    // 时间
    time: 0,
    speed: 1,

    // 震动
    shake: 0,
  };
}

/* ——— 永久升级（局外 Meta） ——— */
function createMeta() {
  return {
    gold: 0,
    upgrades: {}, // { 'bow_atk': 1, 'bow_hp': 0, ... }
    wallLv: 0,
    highestLevel: 1,
    totalWins: 0,
  };
}

function upgradeKey(typeId, stat) {
  return typeId + '_' + stat; // e.g. 'bow_atk', 'bow_hp'
}

function getUpgradeLv(meta, typeId, stat) {
  return meta.upgrades[upgradeKey(typeId, stat)] || 0;
}

function getAtkMul(meta, typeId) {
  return 1 + getUpgradeLv(meta, typeId, 'atk') * UPGRADE_PER_LV;
}

function getHpMul(meta, typeId) {
  return 1 + getUpgradeLv(meta, typeId, 'hp') * UPGRADE_PER_LV;
}

function getWallBonus(meta) {
  return meta.wallLv * 2;
}

/* ——— init ——— */
let state = createState();
let meta = createMeta();
