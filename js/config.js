/* ============================================================
   水果突击 · Fruit Assault —— 配置常量
   ============================================================ */

const W = 480, H = 854;

/* ——— 清新水果主题色 ——— */
const THEME = {
  bg:        '#f4ffd9',
  panelBg:   '#fff7d6',
  gold:      '#ffc93c',
  goldGlow:  'rgba(255,201,60,0.32)',
  accent:    '#ff5d6c',
  safe:      '#53c96a',
  info:      '#4db6ff',
  text:      '#4f6a31',
  textDim:   '#7fa05a',
  textBright:'#23471f',
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

/* ——— 水果兵营品类 ——— */
const TYPES = {
  bow:    { id: 'bow',    name: '葡萄弓营', icon: '🍇', color: '#9b5cff',  atk: 10, hp: 30, speed: 1.05, role: 'back',  range: 'far',   desc: '葡萄籽远程后排，克制菠萝枪兵' },
  sword:  { id: 'sword',  name: '香蕉突击营', icon: '🍌', color: '#ffd447',  atk: 12, hp: 36, speed: 0.82, role: 'rush',  range: 'melee', desc: '香蕉忍者突进，克制西瓜盾兵' },
  spear:  { id: 'spear',  name: '菠萝枪营', icon: '🍍', color: '#ffb337',  atk: 11, hp: 46, speed: 1.12, role: 'front', range: 'melee', desc: '菠萝长枪稳推，克制香蕉突击' },
  shield: { id: 'shield', name: '西瓜盾营', icon: '🍉', color: '#34c96b',  atk: 8,  hp: 60, speed: 1.50, role: 'tank',  range: 'melee', desc: '西瓜重盾抗线，克制葡萄弓手' },
};
const TYPE_IDS = Object.keys(TYPES);

/* 克制表：葡萄→菠萝→香蕉→西瓜→葡萄 */
const COUNTER = { bow: 'spear', spear: 'sword', sword: 'shield', shield: 'bow' };
const COUNTER_DMG = 1.55;

/* ——— 等级系数 ——— */
const LEVEL_MUL = [0, 1.0, 1.58, 2.34, 3.32, 4.62, 6.3, 8.5];
const MAX_LEVEL = 7;

/* ——— 果堡 ——— */
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
  bow_atk:   { title: '葡萄籽连射',  at: 5,  desc: '葡萄弓手压制菠萝线更明显。' },
  bow_hp:    { title: '果皮护甲',    at: 5,  desc: '葡萄弓手不再被流弹轻易带走。' },
  sword_atk: { title: '香蕉旋斩',    at: 5,  desc: '香蕉突击突破西瓜盾线更爽。' },
  sword_hp:  { title: '滑步闪避',    at: 5,  desc: '香蕉突击容错提高。' },
  spear_atk: { title: '菠萝尖刺阵',  at: 5,  desc: '菠萝枪兵克制香蕉突击更稳定。' },
  spear_hp:  { title: '厚果甲',      at: 5,  desc: '菠萝枪兵更能守住中线。' },
  shield_atk:{ title: '西瓜盾撞',    at: 5,  desc: '西瓜盾兵能更快清掉葡萄弓手。' },
  shield_hp: { title: '超厚瓜皮',    at: 5,  desc: '西瓜盾兵成为可靠前排。' },
  wall:      { title: '果堡加固',    at: 5,  desc: '降低被偷家失败概率。' },
  sp:        { title: '果汁号角',    at: 5,  desc: '开局果汁能量和上限提升。' },
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
      ? `第 ${k} 关 · 腐坏果堡Boss · 破堡奖励+24`
      : `第 ${k} 关 · 腐坏水果 Lv${enemyLv.toFixed(1)} · 推倒果堡`,
  };
}