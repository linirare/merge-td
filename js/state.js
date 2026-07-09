/* ============================================================
   水果突击 · Fruit Assault —— 游戏状态管理
   ============================================================ */

/* ——— 兵营对象 ——— */
function createBall(typeId, level = 1) {
  const id = normalizeTypeId(typeId);
  const cd = SPAWN_COOLDOWNS[Math.min(level, MAX_LEVEL)] || SPAWN_COOLDOWNS[1];
  return { type: id, level: Math.min(level, MAX_LEVEL), bounce: 0, spawnTimer: cd * Math.random() };
}

/* ——— 兵对象 ——— */
function createSoldier(typeId, level, atkMul = 1, hpMul = 1) {
  const id = normalizeTypeId(typeId);
  const t = TYPES[id] || TYPES[DEFAULT_DECK[0]];
  const mul = LEVEL_MUL[level] || 1;
  const hp = Math.round(t.hp * mul * hpMul);
  return {
    type: id,
    level,
    id: Math.random().toString(36).slice(2),
    atk: Math.round(t.atk * mul * atkMul),
    hp,
    maxHp: hp,
    shield: 0,
    maxShield: 0,
    armor: t.armor || 0,
    siege: t.siege || 1,
    move: t.move || 86,
    slowTimer: 0,
    slowMul: 1,
    firstHit: true,
    skillTimer: 0,
    rolled: false,
    x: 0, y: 0,
    speed: t.speed,
    target: null,
    alive: true,
    atkTimer: 0,
    hitFlash: 0,
    side: '',
    laneIndex: 0,
    laneX: 0,
    mode: 'deploy',
    battleReady: false,
    protected: true,
    siegeSlot: -1,
    damageDone: 0,
    wallDamageDone: 0,
  };
}

function emptyLaneStats() {
  return Array.from({ length: COLS }, (_, i) => ({
    lane: i,
    playerPower: 0,
    enemyPower: 0,
    playerCount: 0,
    enemyCount: 0,
    playerFront: null,
    enemyFront: null,
    status: 'idle',
    danger: 0,
    pressureText: '',
  }));
}

/* ——— 主游戏状态 ——— */
function createState() {
  return {
    phase: 'menu',
    playerSlots: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
    enemySlots:  Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
    overflowQueue: [],
    enemyOverflow: 0,
    playerWallHp: BASE_WALL_HP,
    playerWallMax: BASE_WALL_HP,
    enemyWallHp: BASE_WALL_HP,
    enemyWallMax: BASE_WALL_HP,
    playerSoldiers: [],
    enemySoldiers: [],
    ballTimer: 0,
    enemyBallTimer: 0,
    playerSpawnTimer: 0,
    enemySpawnTimer: 0,
    summonCount: 0,
    currentLevel: 1,
    levelConfig: null,
    kills: 0,
    killSpCd: 0,
    killSpProgress: 0,
    merges: 0,
    specialMerges: 0,
    maxSoldierAtk: 0,
    maxSoldierType: '',
    laneStats: emptyLaneStats(),
    laneAlertCd: 0,
    laneAlerts: [],
    enemyWallDamageDealt: 0,
    playerWallDamageTaken: 0,
    damageByType: {},
    wallDamageByLane: Array(COLS).fill(0),
    breachLane: -1,
    lastBattleReport: null,
    drag: null,
    pendingPlace: null,
    fx: [],
    attackFx: [],
    projectiles: [],
    dust: [],
    rings: [],
    rollings: [],
    time: 0,
    speed: 1,
    sp: 6,
    shake: 0,
  };
}

/* ——— 永久升级（局外 Meta） ——— */
function createMeta() {
  return {
    gold: 0,
    upgrades: {},
    wallLv: 0,
    spLv: 0,
    highestLevel: 1,
    totalWins: 0,
    stars: {},
    deck: DEFAULT_DECK.slice(),
    unlocked: BASIC_UNLOCKED.slice(),
  };
}

function upgradeKey(typeId, stat) {
  return normalizeTypeId(typeId) + '_' + stat;
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
  return meta.wallLv * WALL_PER_LV;
}
function getSpStart(meta) {
  return 6 + Math.floor((meta.spLv || 0) / 2);
}
function getSpMax(meta) {
  return SP_MAX + (meta.spLv || 0);
}
function getSpRecoverCap(meta) {
  return 8 + Math.floor((meta.spLv || 0) / 2);
}

/* ——— init ——— */
let state = createState();
let meta = createMeta();