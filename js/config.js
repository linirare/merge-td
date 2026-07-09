/* ============================================================
   合成攻城 · Merge Siege —— 配置常量
   ============================================================ */

const W = 480, H = 854;

/* ——— 主题色 ——— */
const THEME = {
  bg:        '#17110c',
  panelBg:   '#2b1f13',
  gold:      '#ffe45a',
  goldGlow:  'rgba(255,228,90,0.26)',
  accent:    '#ff6b4a',
  safe:      '#63df72',
  info:      '#5bb9ff',
  text:      '#ead8b8',
  textDim:   '#9d8a66',
  textBright:'#fff8e0',
};

/* ——— 棋盘 ——— */
const ROWS = 3, COLS = 5;
const CELL = 64;
const GAP = 6;
const BOARD_W = COLS * CELL + (COLS - 1) * GAP;
const BOARD_H = ROWS * CELL + (ROWS - 1) * GAP;
const BOARD_X = (W - BOARD_W) / 2;

/* ——— Y 坐标布局 ——— */
const LAYOUT = {
  enemyInfoY:  6,
  enemyBoardY: 24,
  enemyWallY:  24 + BOARD_H + 10,
  wallH: 22,
  fieldY:      24 + BOARD_H + 10 + 22 + 8,
  fieldH: 222,
  playerWallY: 24 + BOARD_H + 10 + 22 + 8 + 222 + 8,
  playerBoardY:24 + BOARD_H + 10 + 22 + 8 + 222 + 8 + 22 + 10,
  bottomY:     24 + BOARD_H + 10 + 22 + 8 + 222 + 8 + 22 + 10 + BOARD_H + 4,
};

/* ——— 兵营品类 ——— */
const TYPES = {
  bow:    { id: 'bow',    name: '弓营', icon: '🏹', color: '#ff735c',  atk: 11, hp: 28, speed: 1.0,  range: 'far',   desc: '远程输出，克制枪兵' },
  sword:  { id: 'sword',  name: '刀营', icon: '🗡️', color: '#58b7ff',  atk: 13, hp: 34, speed: 0.72, range: 'melee', desc: '高速近战，克制盾兵' },
  spear:  { id: 'spear',  name: '枪营', icon: '🔱', color: '#63df72',  atk: 11, hp: 44, speed: 1.15, range: 'melee', desc: '稳健前排，克制刀兵' },
  shield: { id: 'shield', name: '盾营', icon: '🛡️', color: '#f0cd67',  atk: 8,  hp: 56, speed: 1.55, range: 'melee', desc: '高血量抗线，克制弓兵' },
};
const TYPE_IDS = Object.keys(TYPES);

/* 克制表：弓→枪→刀→盾→弓 */
const COUNTER = { bow: 'spear', spear: 'sword', sword: 'shield', shield: 'bow' };
const COUNTER_DMG = 1.65;

/* ——— 等级系数 ——— */
const LEVEL_MUL = [0, 1.0, 1.62, 2.45, 3.55, 5.05, 7.1, 10.0];
const MAX_LEVEL = 7;

/* ——— 城墙 ——— */
const BASE_WALL_HP = 64;

/* ——— 时序 ——— */
const BALL_SPAWN_INTERVAL = 4.6;
const SOLDIER_SPAWN_INTERVAL = 5;
const SPAWN_COOLDOWNS = [0, 5.4, 4.7, 4.1, 3.45, 2.95, 2.5, 2.15];
const OVERFLOW_MAX = 10;
const MAX_SOLDIERS = 20;
const SP_MAX = 16;
const SP_PASSIVE = 4.4;

/* ——— 经济 ——— */
function upgradeCost(lv) {
  return 8 + lv * 7;
}
function stageReward(k) {
  return k * 7 + 14;
}
const UPGRADE_MAX = 20;
const WALL_UPGRADE_MAX = 10;
const UPGRADE_PER_LV = 0.05;
const WALL_PER_LV = 4;

/* ——— 关卡 ——— */
function generateLevel(k) {
  const boss = k > 0 && k % 5 === 0;
  const enemyLv = 1 + (k - 1) * 0.23 + (boss ? 0.25 : 0);
  const wallBase = boss ? 94 : 58;
  const wallGrow = boss ? 1.18 : 1.13;
  return {
    id: k,
    isBoss: boss,
    enemyInitLevel: enemyLv,
    enemyWallHp: Math.round(wallBase * Math.pow(wallGrow, k - 1)),
    enemySpawnInterval: Math.max(3.25, 4.8 - k * 0.08),
    reward: stageReward(k) + (boss ? 18 : 0),
    desc: boss
      ? `第 ${k} 关 · 城门Boss · 破门奖励+18`
      : `第 ${k} 关 · 敌营 Lv${enemyLv.toFixed(1)} · 推倒城墙`,
  };
}
