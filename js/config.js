/* ============================================================
   合成塔防 · PvE —— 配置常量
   ============================================================ */

const W = 480, H = 854;

/* ——— 主题色 ——— */
const THEME = {
  bg:        '#1a1410',
  panelBg:   '#241c10',
  gold:      '#ffe45a',
  goldGlow:  'rgba(255,228,90,0.3)',
  accent:    '#ff6b4a',
  safe:      '#6fd44e',
  info:      '#4ab0ff',
  text:      '#e8dcc0',
  textDim:   '#8a7a5a',
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
  enemyBoardY: 22,
  enemyWallY:  22 + BOARD_H + 10,
  wallH: 20,
  fieldY:      22 + BOARD_H + 10 + 20 + 8,
  fieldH: 220,
  playerWallY: 22 + BOARD_H + 10 + 20 + 8 + 220 + 8,
  playerBoardY: 22 + BOARD_H + 10 + 20 + 8 + 220 + 8 + 20 + 10,
  bottomY:     22 + BOARD_H + 10 + 20 + 8 + 220 + 8 + 20 + 10 + BOARD_H + 4,
};

/* ——— 品类 ——— */
const TYPES = {
  bow:    { id: 'bow',    name: '弓', icon: '🏹', color: '#ff6b4a',  atk: 8,  hp: 20, speed: 1.2, range: 'far',   desc: '远程优先攻击' },
  sword:  { id: 'sword',  name: '刀', icon: '🗡️', color: '#4ab0ff',  atk: 12, hp: 30, speed: 0.8, range: 'melee', desc: '高攻速快' },
  spear:  { id: 'spear',  name: '枪', icon: '🔱', color: '#6fd44e',  atk: 10, hp: 40, speed: 1.5, range: 'melee', desc: '血厚防高' },
  shield: { id: 'shield', name: '盾', icon: '🛡️', color: '#e8c96a',  atk: 5,  hp: 55, speed: 2.0, range: 'melee', desc: '极肉抗线' },
};
const TYPE_IDS = Object.keys(TYPES);

/* 克制表：弓→枪→刀→盾→弓 */
const COUNTER = { bow: 'spear', spear: 'sword', sword: 'shield', shield: 'bow' };
const COUNTER_DMG = 1.5; // 克制额外伤害

/* ——— 等级系数 ——— */
const LEVEL_MUL = [0, 1.0, 1.8, 3.0, 5.0, 8.0, 13.0, 21.0];
const MAX_LEVEL = 7;

/* ——— 城墙 ——— */
const BASE_WALL_HP = 20;

/* ——— 时序 ——— */
const BALL_SPAWN_INTERVAL = 5;    // 每5秒产1个球
const SOLDIER_SPAWN_INTERVAL = 5; // 每5秒产1个兵
const OVERFLOW_MAX = 10;          // 溢出队列上限

/* ——— 经济 ——— */
function upgradeCost(lv) {
  return Math.round(10 * Math.pow(1.3, lv - 1));
}
function stageReward(k) {
  return k * 5 + 10;
}
const UPGRADE_MAX = 20;
const WALL_UPGRADE_MAX = 10;
const UPGRADE_PER_LV = 0.05; // 每级+5%

/* ——— 关卡 ——— */
function generateLevel(k) {
  const enemyLv = 1 + (k - 1) * 0.3;
  return {
    id: k,
    enemyInitLevel: enemyLv,
    enemyWallHp: Math.round(20 + (k - 1) * 1.5),
    enemySpawnInterval: Math.max(3.5, 5 - k * 0.1),
    reward: stageReward(k),
    desc: `第 ${k} 关 · 敌球 Lv${enemyLv.toFixed(1)} · 城${Math.round(20 + (k - 1) * 1.5)}HP`,
  };
}
