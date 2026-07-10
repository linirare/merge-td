/* ============================================================
   水果突击 · Fruit Assault —— 配置常量 / 13水果球卡组制
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

/* ——— Y 坐标布局：v51 五段式网格 ——— */
const TOP_H = 42;
const FIELD_H = 254;
const LAYOUT = {
  enemyInfoY:  6,
  enemyBoardY: TOP_H,
  enemyWallY:  TOP_H + BOARD_H + 8,
  wallH: 20,
  fieldY:      TOP_H + BOARD_H + 8 + 20 + 10,
  fieldH: FIELD_H,
  playerWallY: TOP_H + BOARD_H + 8 + 20 + 10 + FIELD_H + 12,
  operationY:  TOP_H + BOARD_H + 8 + 20 + 10 + FIELD_H + 12 + 28,
  playerBoardY:TOP_H + BOARD_H + 8 + 20 + 10 + FIELD_H + 12 + 20 + 50,
  bottomY:     TOP_H + BOARD_H + 8 + 20 + 10 + FIELD_H + 12 + 20 + 50 + BOARD_H + 8,
};

/* ——— 13 个水果球：局内只从5个上阵水果中随机召唤 ——— */
const TYPES = {
  watermelon_guard: { id:'watermelon_guard', name:'西瓜盾卫', icon:'🍉', color:'#34c96b', rarity:'normal', role:'tank',    range:'melee', atk:8,  hp:68, speed:1.55, move:76,  siege:0.75, armor:12, tags:['front','tank','anti_range'], desc:'主坦抗线。Lv3周期护盾，Lv5进场嘲讽同路敌人。', skill:'shield' },
  coconut_guard:    { id:'coconut_guard',    name:'椰子守卫', icon:'🥥', color:'#9f7a4c', rarity:'normal', role:'tank',    range:'melee', atk:7,  hp:62, speed:1.62, move:72,  siege:0.65, armor:16, tags:['front','shield'], desc:'硬坦。第一次接战获得厚护盾，适合抗爆发。', skill:'first_shield' },
  grape_archer:     { id:'grape_archer',     name:'葡萄射手', icon:'🍇', color:'#9b5cff', rarity:'normal', role:'back',    range:'far',   atk:10, hp:30, speed:1.00, move:86,  siege:0.90, armor:2,  tags:['range','dps'], desc:'稳定后排输出。怕突击切入，需要前排保护。', skill:'rapid' },
  blueberry_sniper: { id:'blueberry_sniper', name:'蓝莓狙手', icon:'🫐', color:'#4d7dff', rarity:'rare',   role:'back',    range:'long',  atk:18, hp:26, speed:1.75, move:72,  siege:1.05, armor:1,  tags:['range','burst','backline'], desc:'长射程爆发，优先处理后排。怕突击贴脸。', skill:'snipe' },
  banana_raider:    { id:'banana_raider',    name:'香蕉突击', icon:'🍌', color:'#ffd447', rarity:'normal', role:'rush',    range:'melee', atk:13, hp:36, speed:0.82, move:118, siege:0.95, armor:3,  tags:['rush','assassin'], desc:'快速突击，克制后排、医师和炮车。怕枪线拦截。', skill:'dash' },
  lemon_assassin:   { id:'lemon_assassin',   name:'柠檬刺客', icon:'🍋', color:'#ffe76a', rarity:'rare',   role:'rush',    range:'melee', atk:17, hp:28, speed:0.92, move:126, siege:0.80, armor:1,  tags:['rush','crit'], desc:'首击爆发，适合切远程和补刀。怕控制与枪线。', skill:'first_crit' },
  pineapple_lancer: { id:'pineapple_lancer', name:'菠萝枪兵', icon:'🍍', color:'#ffb337', rarity:'normal', role:'front',   range:'mid',   atk:11, hp:48, speed:1.10, move:90,  siege:0.95, armor:7,  tags:['front','anti_rush'], desc:'中线枪兵，职责克制突击单位。', skill:'anti_rush' },
  orange_cannon:    { id:'orange_cannon',    name:'橙子炮手', icon:'🍊', color:'#ff9838', rarity:'rare',   role:'siege',   range:'far',   atk:9,  hp:34, speed:1.65, move:64,  siege:2.45, armor:2,  tags:['siege','range'], desc:'攻城核心。拆果堡极强，打兵偏弱，怕突击。', skill:'siege' },
  pumpkin_roller:   { id:'pumpkin_roller',   name:'南瓜滚轮', icon:'🎃', color:'#ff7d35', rarity:'rare',   role:'siege',   range:'melee', atk:10, hp:42, speed:1.20, move:96,  siege:1.55, armor:6,  tags:['siege','death'], desc:'死亡后向前滚动爆破。适合制造攻城突破点。', skill:'death_roll' },
  pear_frost:       { id:'pear_frost',       name:'冰梨术士', icon:'🍐', color:'#9be7ff', rarity:'rare',   role:'control', range:'far',   atk:7,  hp:31, speed:1.35, move:70,  siege:0.70, armor:1,  tags:['control','slow'], desc:'攻击附带减速，职责克制高速突击。', skill:'slow' },
  peach_medic:      { id:'peach_medic',      name:'蜜桃医师', icon:'🍑', color:'#ff9fbd', rarity:'rare',   role:'support', range:'support', atk:4,  hp:32, speed:1.65, move:70,  siege:0.40, armor:1,  tags:['support','heal'], desc:'周期治疗同路前排。怕突击切入。', skill:'heal' },
  kiwi_wildcard:    { id:'kiwi_wildcard',    name:'奇异果万能', icon:'🥝', color:'#8bd34e', rarity:'epic',   role:'merge',   range:'support', atk:2,  hp:24, speed:1.80, move:62,  siege:0.20, armor:0,  tags:['merge','wildcard'], desc:'同星万能合成材料。合成辅助，不派兵。', skill:'wildcard' },
  passion_copy:     { id:'passion_copy',     name:'百香果复制', icon:'🟣', color:'#b85cff', rarity:'epic',   role:'merge',   range:'support', atk:2,  hp:24, speed:1.80, move:62,  siege:0.20, armor:0,  tags:['merge','copy'], desc:'拖到同星目标上复制成目标水果。合成辅助，不派兵。', skill:'copy' },
};

const UNIT_POOL = Object.keys(TYPES);
const OLD_DEFAULT_DECK = ['watermelon_guard','grape_archer','banana_raider','pineapple_lancer','orange_cannon'];
const DEFAULT_DECK = ['watermelon_guard','grape_archer','banana_raider','pineapple_lancer','orange_cannon'];
const DECK_SIZE = 5;
const TYPE_IDS = UNIT_POOL;
const BASIC_UNLOCKED = DEFAULT_DECK.slice();
const PROGRESS_UNLOCKS = [
  { level: 2, ids: ['coconut_guard'] },
  { level: 3, ids: ['peach_medic','pear_frost'] },
  { level: 4, ids: ['blueberry_sniper','lemon_assassin'] },
  { level: 5, ids: ['pumpkin_roller'] },
  { level: 6, ids: ['kiwi_wildcard'] },
  { level: 8, ids: ['passion_copy'] },
];
function unlockLevelFor(id) {
  if (BASIC_UNLOCKED.includes(id)) return 1;
  for (const item of PROGRESS_UNLOCKS) if (item.ids.includes(id)) return item.level;
  return 1;
}
function progressUnlocked(m = null) {
  const highest = Math.max(1, m?.highestLevel || 1);
  const list = BASIC_UNLOCKED.slice();
  for (const item of PROGRESS_UNLOCKS) if (highest >= item.level) for (const id of item.ids) if (!list.includes(id)) list.push(id);
  return list.filter(id => TYPES[id]);
}
function syncProgressUnlocks(m = null) {
  if (!m) return BASIC_UNLOCKED.slice();
  const list = progressUnlocked(m);
  m.unlocked = list.slice();
  if (!Array.isArray(m.deck) || m.deck.length === 0) m.deck = DEFAULT_DECK.slice();
  m.deck = normalizeDeck(m.deck).filter(id => list.includes(id));
  for (const id of DEFAULT_DECK) if (m.deck.length < DECK_SIZE && list.includes(id) && !m.deck.includes(id)) m.deck.push(id);
  return list;
}

/* 老存档/老代码兼容 */
const LEGACY_TYPE_MAP = {
  bow: 'grape_archer',
  sword: 'banana_raider',
  spear: 'pineapple_lancer',
  shield: 'watermelon_guard',
};
function normalizeTypeId(id) {
  return LEGACY_TYPE_MAP[id] || id || DEFAULT_DECK[0];
}
function deckSignature(deck) {
  return normalizeDeckNoFill(deck).join('|');
}
function normalizeDeckNoFill(deck) {
  const result = [];
  for (const raw of deck || []) {
    const id = normalizeTypeId(raw);
    if (TYPES[id] && !result.includes(id)) result.push(id);
  }
  return result.slice(0, DECK_SIZE);
}
function shouldForceNewDefaultDeck(deck) {
  const sig = deckSignature(deck);
  return !sig
    || sig === OLD_DEFAULT_DECK.join('|')
    || sig === ['grape_archer','banana_raider','pineapple_lancer','watermelon_guard'].join('|')
    || sig === ['watermelon_guard','grape_archer','orange_cannon','peach_medic','kiwi_wildcard'].join('|');
}
function normalizeDeck(deck) {
  const result = shouldForceNewDefaultDeck(deck) ? DEFAULT_DECK.slice() : normalizeDeckNoFill(deck);
  for (const id of DEFAULT_DECK) if (result.length < DECK_SIZE && !result.includes(id)) result.push(id);
  return result.slice(0, DECK_SIZE);
}
function activeDeck() {
  return normalizeDeck(meta?.deck || DEFAULT_DECK);
}

/* 职责克制：不再要求玩家背水果表 */
const ROLE_COUNTER_DMG = 1.35;
const ROLE_SOFT_COUNTER_DMG = 1.22;
const ROLE_WEAK_DMG = 0.85;
const COUNTER_DMG = ROLE_COUNTER_DMG;
const COUNTER = {
  grape_archer: 'front',
  blueberry_sniper: 'back',
  banana_raider: 'back',
  lemon_assassin: 'support',
  pineapple_lancer: 'rush',
  watermelon_guard: 'back',
  coconut_guard: 'back',
  orange_cannon: 'tank',
  pumpkin_roller: 'tank',
  pear_frost: 'rush',
  peach_medic: '',
  kiwi_wildcard: '',
  passion_copy: '',
};
function roleCounterMultiplier(sourceType, targetType) {
  const source = TYPES[sourceType] || {};
  const target = TYPES[targetType] || {};
  const sr = source.role;
  const tr = target.role;
  if (!sr || !tr || sr === 'merge') return 1;
  if (sr === 'rush' && ['back','support','siege','control'].includes(tr)) return ROLE_COUNTER_DMG;
  if (sr === 'rush' && ['tank','front'].includes(tr)) return ROLE_WEAK_DMG;
  if (sr === 'front' && tr === 'rush') return 1.40;
  if (sr === 'control' && (tr === 'rush' || (target.move || 0) >= 112)) return ROLE_COUNTER_DMG;
  if (sr === 'siege' && tr === 'tank') return ROLE_SOFT_COUNTER_DMG;
  if (sr === 'siege' && tr === 'rush') return ROLE_WEAK_DMG;
  if (sr === 'back' && tr === 'front') return ROLE_SOFT_COUNTER_DMG;
  if (sr === 'back' && tr === 'tank') return 0.92;
  if (sr === 'back' && tr === 'rush') return ROLE_WEAK_DMG;
  if (sr === 'tank' && tr === 'back') return 1.12;
  if (sr === 'tank' && ['siege','control'].includes(tr)) return 0.90;
  return 1;
}
function roleCounterText(sourceType, targetType) {
  const mul = roleCounterMultiplier(sourceType, targetType);
  if (mul >= 1.32) return '克制';
  if (mul >= 1.15) return '优势';
  if (mul <= 0.9) return '受制';
  return '';
}
function bestCounterForEnemy(enemyType, pool = null) {
  const list = pool || UNIT_POOL;
  let best = null, bestScore = 1;
  for (const id of list) {
    if (!TYPES[id] || TYPES[id].role === 'merge') continue;
    const score = roleCounterMultiplier(id, enemyType);
    if (score > bestScore) { best = id; bestScore = score; }
  }
  return best;
}

const LEVEL_MUL = [0, 1.0, 1.45, 2.05, 2.8, 3.75, 4.9, 6.2];
const MAX_LEVEL = 7;
const BASE_WALL_HP = 72;
const SIEGE_SLOTS_PER_LANE = 3;
const BALL_SPAWN_INTERVAL = 4.4;
const SOLDIER_SPAWN_INTERVAL = 5;
const SPAWN_COOLDOWNS = [0, 5.6, 4.9, 4.25, 3.65, 3.15, 2.7, 2.35];
const OVERFLOW_MAX = 10;
const MAX_SOLDIERS = 24;
const SP_MAX = 18;
const SP_PASSIVE = 3.0;

function upgradeCost(lv) { return 10 + lv * 8; }
function stageReward(k) { return k * 8 + 18; }
const UPGRADE_MAX = 20;
const WALL_UPGRADE_MAX = 10;
const SP_UPGRADE_MAX = 10;
const UPGRADE_PER_LV = 0.05;
const WALL_PER_LV = 5;

const TECH_MILESTONES = {};
for (const id of UNIT_POOL) {
  TECH_MILESTONES[id + '_atk'] = { title: TYPES[id].name + '强化', at: 5, desc: TYPES[id].desc };
  TECH_MILESTONES[id + '_hp'] = { title: TYPES[id].name + '耐久', at: 5, desc: '提升该水果球在战线上的容错。' };
}
TECH_MILESTONES.wall = { title: '果堡加固', at: 5, desc: '降低被偷家失败概率。' };
TECH_MILESTONES.sp = { title: '果汁号角', at: 5, desc: '开局果汁能量和上限提升。' };

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
    desc: boss ? `第 ${k} 关 · 腐坏果堡Boss · 破堡奖励+24` : `第 ${k} 关 · 腐坏水果 Lv${enemyLv.toFixed(1)} · 推倒果堡`,
  };
}
