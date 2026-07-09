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
  bow:    { id: 'bow',    name: '弓', icon: '🏹', color: '#ff6b4a',  atk: 10, hp: 28, speed: 1.0,  range: 'far',   desc: '远程优先攻击' },
  sword:  { id: 'sword',  name: '刀', icon: '🗡️', color: '#4ab0ff',  atk: 13, hp: 32, speed: 0.7,  range: 'melee', desc: '高攻速快' },
  spear:  { id: 'spear',  name: '枪', icon: '🔱', color: '#6fd44e',  atk: 11, hp: 42, speed: 1.2,  range: 'melee', desc: '血厚防高' },
  shield: { id: 'shield', name: '盾', icon: '🛡️', color: '#e8c96a',  atk: 7,  hp: 52, speed: 1.6,  range: 'melee', desc: '极肉抗线' },
};
const TYPE_IDS = Object.keys(TYPES);

/* 克制表：弓→枪→刀→盾→弓 */
const COUNTER = { bow: 'spear', spear: 'sword', sword: 'shield', shield: 'bow' };
const COUNTER_DMG = 1.6; // 克制额外伤害（1.5→1.6）

/* ——— 等级系数 ——— */
const LEVEL_MUL = [0, 1.0, 1.6, 2.4, 3.5, 5.0, 7.0, 10.0]; // Lv.7=10x (原21x)
const MAX_LEVEL = 7;

/* ——— 城墙 ——— */
const BASE_WALL_HP = 60; // 原20

/* ——— 时序 ——— */
const BALL_SPAWN_INTERVAL = 5;    // 每5秒产1个球
const SOLDIER_SPAWN_INTERVAL = 5; // 每5秒产1个兵
const SPAWN_COOLDOWNS = [0, 6.0, 5.2, 4.5, 3.8, 3.2, 2.7, 2.2]; // Lv1=6s → Lv7=2.2s
const OVERFLOW_MAX = 10;          // 溢出队列上限
const MAX_SOLDIERS = 18;          // 每方战场兵上限

/* ——— 经济 ——— */
function upgradeCost(lv) {
  return 8 + lv * 7; // Lv1=15, Lv10=78, Lv20=148
}
function stageReward(k) {
  return k * 6 + 12; // Lv1=18, Lv10=72, Lv20=132
}
const UPGRADE_MAX = 20;
const WALL_UPGRADE_MAX = 10;
const UPGRADE_PER_LV = 0.05; // 每级+5%
const WALL_PER_LV = 3; // 城墙每级+3HP

/* ——— 关卡 ——— */
function generateLevel(k) {
  const enemyLv = 1 + (k - 1) * 0.25;
  return {
    id: k,
    enemyInitLevel: enemyLv,
    enemyWallHp: Math.round(60 + (k - 1) * 5), // 原20+1.5
    enemySpawnInterval: Math.max(3.5, 5 - k * 0.1),
    reward: stageReward(k),
    desc: `第 ${k} 关 · 敌球 Lv${enemyLv.toFixed(1)} · 城${Math.round(60 + (k - 1) * 5)}HP`,
  };
}
