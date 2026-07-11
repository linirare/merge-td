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
  watermelon_guard: { id:'watermelon_guard', name:'西瓜盾卫', icon:'🍉', color:'#34c96b', rarity:'normal', role:'tank',    range:'melee', atk:7,  hp:80, speed:1.5,  move:76,  siege:0.75, armor:16, tags:['tank','shield'], desc:'主坦抗线。Lv4+每8s获得20点护盾。', skill:'shield' },
  coconut_guard:    { id:'coconut_guard',    name:'椰子守卫', icon:'🥥', color:'#9f7a4c', rarity:'normal', role:'tank',    range:'melee', atk:6,  hp:88, speed:1.62, move:72,  siege:0.65, armor:14, tags:['tank','shield'], desc:'硬坦。第一次接战获得35临时护盾，适合抗爆发。', skill:'first_shield' },
  grape_archer:     { id:'grape_archer',     name:'葡萄射手', icon:'🍇', color:'#9b5cff', rarity:'normal', role:'back',    range:'far',   atk:10, hp:32, speed:1.00, move:86,  siege:0.90, armor:2,  tags:['back','dps'], desc:'稳定后排输出,连续攻击同目标伤害+10%/次。怕突击切入。', skill:'rapid' },
  blueberry_sniper: { id:'blueberry_sniper', name:'蓝莓狙手', icon:'🫐', color:'#4d7dff', rarity:'rare',   role:'back',    range:'long',  atk:13, hp:28, speed:1.75, move:72,  siege:1.05, armor:1,  tags:['back','burst'], desc:'长射程爆发,优先后排,忽略5护甲。怕突击贴脸。', skill:'snipe' },
  banana_raider:    { id:'banana_raider',    name:'香蕉突击', icon:'🍌', color:'#ffd447', rarity:'normal', role:'rush',    range:'melee', atk:15, hp:30, speed:0.82, move:118, siege:0.95, armor:2,  tags:['rush','assassin'], desc:'快速突击,Lv3+首次攻击眩晕0.5s。怕枪线拦截。', skill:'dash' },
  lemon_assassin:   { id:'lemon_assassin',   name:'柠檬刺客', icon:'🍋', color:'#ffe76a', rarity:'rare',   role:'rush',    range:'melee', atk:17, hp:26, speed:0.92, move:126, siege:0.80, armor:2,  tags:['rush','crit'], desc:'首击爆发暴击x2,适合切远程和补刀。怕控制与枪线。', skill:'first_crit' },
  pineapple_lancer: { id:'pineapple_lancer', name:'菠萝枪兵', icon:'🍍', color:'#ffb337', rarity:'normal', role:'front',   range:'mid',   atk:11, hp:48, speed:1.10, move:90,  siege:0.95, armor:7,  tags:['front','anti_rush'], desc:'中线枪兵，职责克制突击单位。', skill:'anti_rush' },
  orange_cannon:    { id:'orange_cannon',    name:'橙子炮手', icon:'🍊', color:'#ff9838', rarity:'rare',   role:'siege',   range:'far',   atk:10, hp:40, speed:1.65, move:64,  siege:2.45, armor:4,  tags:['siege','range'], desc:'攻城核心,对城墙x1.3。拆果堡极强,打兵偏弱,怕突击。', skill:'siege' },
  pumpkin_roller:   { id:'pumpkin_roller',   name:'南瓜滚轮', icon:'🎃', color:'#ff7d35', rarity:'rare',   role:'siege',   range:'melee', atk:8,  hp:36, speed:1.20, move:96,  siege:1.55, armor:4,  tags:['siege','death'], desc:'死亡时爆炸(ATKx2范围伤害+眩晕)。适合制造攻城突破点。', skill:'death_roll' },
  pear_frost:       { id:'pear_frost',       name:'冰梨术士', icon:'🍐', color:'#9be7ff', rarity:'rare',   role:'control', range:'far',   atk:6,  hp:31, speed:1.35, move:70,  siege:0.70, armor:1,  tags:['control','slow'], desc:'攻击附带减速30%1.5s,Lv6减速升级为冰冻。', skill:'slow' },
  peach_medic:      { id:'peach_medic',      name:'蜜桃医师', icon:'🍑', color:'#ff9fbd', rarity:'rare',   role:'support', range:'support', atk:4,  hp:32, speed:1.65, move:70,  siege:0.40, armor:1,  tags:['support','heal'], desc:'周期治疗同路前排。怕突击切入。', skill:'heal' },
  kiwi_wildcard:    { id:'kiwi_wildcard',    name:'奇异果万能', icon:'🥝', color:'#8bd34e', rarity:'epic',   role:'merge',   range:'support', atk:0,  hp:20, speed:1.80, move:62,  siege:0.20, armor:0,  tags:['merge','wildcard'], desc:'同星万能合成材料。合成辅助，不派兵。', skill:'wildcard' },
  passion_copy:     { id:'passion_copy',     name:'百香果复制', icon:'🟣', color:'#b85cff', rarity:'epic',   role:'merge',   range:'support', atk:0,  hp:20, speed:1.80, move:62,  siege:0.20, armor:0,  tags:['merge','copy'], desc:'拖到同星目标上复制成目标水果。合成辅助，不派兵。', skill:'copy' },

  /* ——— Phase 4: 7 个新增战斗英雄 ——— */
  strawberry_knight:{ id:'strawberry_knight',name:'草莓骑士', icon:'🍓', color:'#ff4d5a', rarity:'rare',   role:'tank',    range:'melee', atk:9,  hp:74, speed:1.40, move:80,  siege:0.85, armor:14, tags:['tank','charge'], desc:'Lv4+ 首次接战冲锋60px+击退。', skill:'charge' },
  avocado_brawler:  { id:'avocado_brawler',  name:'牛油果力士', icon:'🥑', color:'#8fa64a', rarity:'rare',   role:'tank',    range:'melee', atk:5,  hp:96, speed:1.65, move:68,  siege:0.70, armor:18, tags:['tank','immune'], desc:'Lv4+ 受击30%概率免疫伤害。', skill:'immune' },
  dragonfruit_warrior:{id:'dragonfruit_warrior',name:'火龙果战士',icon:'🐉',color:'#ff3b6e',rarity:'rare', role:'front',   range:'mid',   atk:13, hp:44, speed:1.10, move:88,  siege:0.90, armor:5,  tags:['front','burn'], desc:'Lv4+ 攻击附带点燃(3伤害/s,2s)。', skill:'burn' },
  olive_assassin:   { id:'olive_assassin',   name:'橄榄刺客', icon:'🫒', color:'#8a9a5b', rarity:'epic',   role:'rush',    range:'melee', atk:19, hp:22, speed:0.96, move:125, siege:0.78, armor:0,  tags:['rush','stealth'], desc:'Lv4+ 出场3s隐身，首击暴击×2.5。', skill:'stealth' },
  mango_arbalest:   { id:'mango_arbalest',   name:'芒果弩手', icon:'🥭', color:'#ffbd43', rarity:'rare',   role:'back',    range:'long',  atk:8,  hp:30, speed:0.55, move:68,  siege:0.92, armor:1,  tags:['back','rapid'], desc:'攻速0.55s，全游戏最快。', skill:'rapid' },
  cherry_bomber:    { id:'cherry_bomber',    name:'樱桃炸弹', icon:'🍒', color:'#d44155', rarity:'rare',   role:'back',    range:'far',   atk:14, hp:26, speed:1.55, move:74,  siege:0.88, armor:1,  tags:['back','aoe'], desc:'Lv4+ 每5次攻击投掷范围炸弹。', skill:'aoe' },
  melon_shaman:     { id:'melon_shaman',     name:'哈密瓜萨满', icon:'🍈', color:'#c8e670', rarity:'rare',   role:'control', range:'far',   atk:6,  hp:29, speed:1.40, move:68,  siege:0.65, armor:1,  tags:['control','weaken'], desc:'攻击概率减敌ATK×0.85,2s。', skill:'weaken' },

  /* ——— Phase 4: 5 个辅助球(经济型,role=support+econ) ——— */
  mint_supply:      { id:'mint_supply',      name:'薄荷补给球', icon:'🌿', color:'#7ed6a0', rarity:'rare',   role:'support',range:'support',atk:3,  hp:28, speed:1.55, move:60,  siege:0.12, armor:2,  tags:['econ','sp_regen'], desc:'在场时自然回复提速→4s, Lv4→3.5s, Lv7→3s。', skill:'sp_regen' },
  shock_lemon:      { id:'shock_lemon',      name:'电击柠檬球', icon:'⚡', color:'#ffe76a', rarity:'rare',   role:'support',range:'support',atk:5,  hp:24, speed:1.45, move:58,  siege:0.10, armor:1,  tags:['econ','kill_sp'], desc:'击杀敌方额外+SP: Lv1+1, Lv4+2, Lv7+3+攻速。', skill:'kill_sp' },
  honey_save:       { id:'honey_save',       name:'蜂蜜储蓄球', icon:'🍯', color:'#f5b642', rarity:'rare',   role:'support',range:'support',atk:4,  hp:30, speed:1.50, move:60,  siege:0.10, armor:2,  tags:['econ','sp_refund'], desc:'操作后返还SP: Lv1+1, Lv4+2, Lv7+3(8s CD)。', skill:'sp_refund' },
  ferment_grape:    { id:'ferment_grape',    name:'发酵葡萄球', icon:'🍷', color:'#b86bce', rarity:'epic',   role:'support',range:'support',atk:0,  hp:22, speed:1.35, move:55,  siege:0.05, armor:0,  tags:['econ','sp_bank'], desc:'每15s产1SP,死亡吐出累计值(上限15), Lv4 12s, Lv7+额外5。', skill:'sp_bank' },
  chill_juice:      { id:'chill_juice',      name:'冰镇果汁球', icon:'🧊', color:'#9be7ff', rarity:'epic',   role:'support',range:'support',atk:3,  hp:26, speed:1.50, move:56,  siege:0.05, armor:1,  tags:['econ','sp_discount'], desc:'每20s下一次操作消耗减半, Lv4 15s, Lv7 免费。', skill:'sp_discount' },
};

const UNIT_POOL = Object.keys(TYPES);
const OLD_DEFAULT_DECK = ['watermelon_guard','grape_archer','banana_raider','pineapple_lancer','orange_cannon'];
const DEFAULT_DECK = ['watermelon_guard','grape_archer','banana_raider','pineapple_lancer','orange_cannon'];
const DECK_SIZE = 5;
const TYPE_IDS = UNIT_POOL;
const BASIC_UNLOCKED = DEFAULT_DECK.slice();
const PROGRESS_UNLOCKS = [
  { level: 2, ids: ['coconut_guard'] },
  { level: 3, ids: ['peach_medic','pear_frost','mint_supply'] },
  { level: 4, ids: ['blueberry_sniper','lemon_assassin'] },
  { level: 5, ids: ['pumpkin_roller','shock_lemon'] },
  { level: 6, ids: ['kiwi_wildcard','mango_arbalest'] },
  { level: 7, ids: ['dragonfruit_warrior','cherry_bomber'] },
  { level: 8, ids: ['passion_copy','olive_assassin','melon_shaman'] },
  { level: 9, ids: ['strawberry_knight','honey_save'] },
  { level: 10, ids: ['avocado_brawler'] },
  { level: 12, ids: ['ferment_grape'] },
  { level: 14, ids: ['chill_juice'] },
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
// 完整 7×7 职责克制矩阵(设计档 fruit-assault-final.md §2.3),幅度 ±50%(0.7~1.5)。
// 行=攻击方职责,列=防御方职责。merge(奇异果/百香果)不参与克制,返回 1。
const ROLE_COUNTER_MATRIX = {
  //          tank front rush  back siege control support
  tank:    { tank:1.0, front:0.8, rush:1.2, back:0.9, siege:1.1, control:1.0, support:1.0 },
  front:   { tank:1.2, front:1.0, rush:0.8, back:1.1, siege:1.0, control:1.1, support:1.0 },
  rush:    { tank:0.8, front:1.1, rush:1.0, back:1.5, siege:1.0, control:1.2, support:1.3 },
  back:    { tank:1.1, front:1.2, rush:0.7, back:1.0, siege:0.9, control:1.0, support:1.1 },
  siege:   { tank:1.3, front:1.0, rush:0.9, back:0.8, siege:1.0, control:0.9, support:1.0 },
  control: { tank:1.0, front:0.9, rush:1.1, back:1.0, siege:1.0, control:1.0, support:1.0 },
  support: { tank:0.9, front:0.9, rush:0.8, back:1.0, siege:1.0, control:1.0, support:1.0 },
};
function roleCounterMultiplier(sourceType, targetType) {
  const sr = (TYPES[sourceType] || {}).role;
  const tr = (TYPES[targetType] || {}).role;
  if (!sr || !tr || sr === 'merge' || tr === 'merge') return 1;
  const row = ROLE_COUNTER_MATRIX[sr];
  return (row && row[tr] != null) ? row[tr] : 1;
}
function roleCounterText(sourceType, targetType) {
  const mul = roleCounterMultiplier(sourceType, targetType);
  if (mul >= 1.25) return '克制';
  if (mul >= 1.08) return '优势';
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

const LEVEL_MUL = [0, 1.0, 1.4, 1.9, 2.5, 3.2, 4.0, 5.0];
const MAX_LEVEL = 7;

/* ——— 局外养成:碎片指数消耗 Lv1-20 + ★1-7 星级(设计档 §7)——— */
const CULTIVATE_MAX = 20;
function cultivateShardCost(lv) { return 10 * Math.pow(2, lv - 1); }        // 升到 Lv 的单级消耗
function cultivateCumCost(lv) { return 10 * (Math.pow(2, lv) - 1); }        // 升满 Lv 的累计消耗
function cultivateBonusAt(lv) {                                            // ATK/HP 加成(§7.2)
  if (lv <= 0) return 0;
  if (lv <= 10) return lv * 0.05;                                          // Lv1-10:+5%/级 → +50%
  return [0.54, 0.58, 0.62, 0.66, 0.70, 0.73, 0.76, 0.79, 0.82, 0.85][Math.min(lv, 20) - 11]; // Lv11-20
}
function cultivateLevelFromShards(shards) {                                // 累计碎片自动投资到最高可达级
  let lv = 0;
  while (lv < CULTIVATE_MAX && (shards || 0) >= cultivateCumCost(lv + 1)) lv++;
  return lv;
}
const STAR_THRESHOLDS = [0, 20, 60, 140, 290, 540, 940];                    // ★1..★7 累计碎片门槛(§7.3)
function starLevelFromShards(shards) {
  let st = 1;
  for (let i = 1; i < STAR_THRESHOLDS.length; i++) if ((shards || 0) >= STAR_THRESHOLDS[i]) st = i + 1;
  return st;
}
function starAtkBonus(star) { return [0, 0, 0.05, 0.10, 0.16, 0.23, 0.30, 0.38][Math.min(Math.max(star, 1), 7)]; }
function starHpBonus(star)  { return [0, 0, 0.03, 0.06, 0.10, 0.15, 0.20, 0.26][Math.min(Math.max(star, 1), 7)]; }
// 碎片 → 最终 ATK/HP 乘子:(1+养成加成)×(1+星级加成)
function fragmentAtkMul(shards) { return (1 + cultivateBonusAt(cultivateLevelFromShards(shards))) * (1 + starAtkBonus(starLevelFromShards(shards))); }
function fragmentHpMul(shards)  { return (1 + cultivateBonusAt(cultivateLevelFromShards(shards))) * (1 + starHpBonus(starLevelFromShards(shards))); }
// 玩家平均养成级(用于动态难度,设计 §9.3):取前一半水果的养成级平均,
// 避免中位数被大量零养成果拖成 0(玩家专精一两果时也会随投入产生难度)。
function avgPlayerCultivateLv(meta) {
  const shards = (meta && meta.shardsTotal) ? meta.shardsTotal : {};
  const vals = UNIT_POOL.filter(id => TYPES[id]).map(id => cultivateLevelFromShards(shards[id] || 0));
  if (!vals.length) return 0;
  vals.sort((a, b) => b - a); // 降序
  const n = Math.max(1, Math.floor(vals.length / 2));
  let sum = 0; for (let i = 0; i < n; i++) sum += vals[i];
  return Math.round(sum / n);
}
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
