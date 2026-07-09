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
  bow:    { id: 'bow',    name: '弓营', icon: '🏹', color: '#ff735c',  atk: 10, hp: 30, speed: 1.05, role: 'back',  range: 'far',   desc: '远程后排，克制枪兵' },
  sword:  { id: 'sword',  name: '刀营', icon: '🗡️', color: '#58b7ff',  atk: 12, hp: 36, speed: 0.82, role: 'rush',  range: 'melee', desc: '突进近战，克制盾兵' },
  spear:  { id: 'spear',  name: '枪营', icon: '🔱', color: '#63df72',  atk: 11, hp: 46, speed: 1.12, role: 'front', range: 'melee', desc: '稳健前排，克制刀兵' },
  shield: { id: 'shield', name: '盾营', icon: '🛡️', color: '#f0cd67',  atk: 8,  hp: 60, speed: 1.50, role: 'tank',  range: 'melee', desc: '高血量抗线，克制弓兵' },
};
const TYPE_IDS = Object.keys(TYPES);

/* 克制表：弓→枪→刀→盾→弓 */
const COUNTER = { bow: 'spear', spear: 'sword', sword: 'shield', shield: 'bow' };
const COUNTER_DMG = 1.55;

/* ——— 等级系数 ——— */
const LEVEL_MUL = [0, 1.0, 1.58, 2.34, 3.32, 4.62, 6.3, 8.5];
const MAX_LEVEL = 7;

/* ——— 城墙 ——— */
const BASE_WALL_HP = 72;
const SIEGE_SLOTS_PER_LANE = 3;

/* ——— 时序 ——— */
const BALL_SPAWN_INTERVAL = 4.4;
const SOLDIER_SPAWN_INTERVAL = 5;
const SPAWN_COOLDOWNS = [0, 5.6, 4.9, 4.25, 3.65, 3.15, 2.7, 2.35];
const OVERFLOW_MAX = 10;
const MAX_SOLDIERS = 22;
const SP_MAX = 18;
const SP_PASSIVE = 3.6;

/* ——— 经济/科技 ——— */
function upgradeCost(lv) {
  return 10 + lv * 8;
}
function stageReward(k) {
  return k * 8 + 18;
}
const UPGRADE_MAX = 20;
const WALL_UPGRADE_MAX = 10;
const SP_UPGRADE_MAX = 10;
const UPGRADE_PER_LV = 0.05;
const WALL_PER_LV = 5;

const TECH_MILESTONES = {
  bow_atk:   { title: '鹰眼校准',    at: 5,  desc: '弓兵更适合压制枪兵线。' },
  bow_hp:    { title: '轻甲训练',    at: 5,  desc: '弓兵不再被流弹轻易带走。' },
  sword_atk: { title: '破盾斩',      at: 5,  desc: '刀兵突破盾线更稳定。' },
  sword_hp:  { title: '冲阵步法',    at: 5,  desc: '刀兵突进时容错提高。' },
  spear_atk: { title: '枪阵推进',    at: 5,  desc: '枪兵对刀兵优势更明显。' },
  spear_hp:  { title: '拒马阵',      at: 5,  desc: '枪兵更能守住中线。' },
  shield_atk:{ title: '盾击',        at: 5,  desc: '盾兵不只是抗，也能清弓兵。' },
  shield_hp: { title: '铁壁',        at: 5,  desc: '盾兵成为可靠前排。' },
  wall:      { title: '城防加固',    at: 5,  desc: '降低被偷家失败概率。' },
  sp:        { title: '号角训练',    at: 5,  desc: '开局士气和士气上限提升。' },
};

/* ——— 关卡 ——— */
function generateLevel(k) {
  const boss = k > 0 && k % 5 === 0;
  const enemyLv = 1 + (k - 1) * 0.19 + (boss ? 0.18 : 0);
  const wallBase = boss ? 82 : 56;
  const wallGrow = boss ? 1.15 : 1.10;
  return {
    id: k,
    isBoss: boss,
    enemyInitLevel: enemyLv,
    enemyWallHp: Math.round(wallBase * Math.pow(wallGrow, k - 1)),
    enemySpawnInterval: Math.max(4.25, 6.2 - k * 0.13),
    reward: stageReward(k) + (boss ? 24 : 0),
    desc: boss
      ? `第 ${k} 关 · 城门Boss · 破门奖励+24`
      : `第 ${k} 关 · 敌营 Lv${enemyLv.toFixed(1)} · 推倒城墙`,
  };
}