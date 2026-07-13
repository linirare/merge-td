/* ============================================================
   水果突击 · Fruit Assault —— 配置常量 / 13水果球卡组制
   ============================================================ */

const W = 480, H = 920;

/* ——— 烫金暖深主题色(战斗屏着色统一:canvas→hifi_shell 烫金) ——— */
const THEME = {
  bg:        '#201510',
  panelBg:   'rgba(255,250,235,0.88)',
  gold:      '#F5C242',
  goldGlow:  'rgba(245,194,66,0.32)',
  accent:    '#E23B4E',
  safe:      '#B58A2E',
  info:      '#38C6E8',
  text:      '#C9B48A',
  textDim:   '#8a7a5a',
  textBright:'#FFE9A8',
};

/* ——— 棋盘 ——— */
const ROWS = 3, COLS = 5;
const CELL = 64;
const GAP = 6;
const BOARD_W = COLS * CELL + (COLS - 1) * GAP;
const BOARD_H = ROWS * CELL + (ROWS - 1) * GAP;
const BOARD_X = (W - BOARD_W) / 2;

/* ——— Y 坐标布局：v51 五段式网格(战场纵向拉伸版) ——— */
const TOP_H = 40;
const FIELD_H = 310;
const LAYOUT = {
  enemyInfoY:  6,
  enemyBoardY: TOP_H,
  enemyWallY:  TOP_H + BOARD_H + 6,
  wallH: 20,
  fieldY:      TOP_H + BOARD_H + 6 + 20 + 8,
  fieldH: FIELD_H,
  playerWallY: TOP_H + BOARD_H + 6 + 20 + 8 + FIELD_H + 8,
  operationY:  TOP_H + BOARD_H + 6 + 20 + 8 + FIELD_H + 8 + 20,
  playerBoardY:TOP_H + BOARD_H + 6 + 20 + 8 + FIELD_H + 8 + 20 + 40,
  bottomY:     TOP_H + BOARD_H + 6 + 20 + 8 + FIELD_H + 8 + 20 + 40 + BOARD_H + 8,
};

/* ——— 13 个水果球：局内只从5个上阵水果中随机召唤 ——— */
const TYPES = {
  /* ——— T0 (epic/传说) ——— */
  olive_assassin:   { id:'olive_assassin',   name:'橄榄刺客', icon:'🫒', color:'#8a9a5b', rarity:'epic',   role:'rush',    range:'melee', atk:22, hp:24, speed:0.96, move:125, siege:0.78, armor:0,  tags:['rush','stealth'], desc:'Lv4+ 出场3s隐身，首击暴击×2.5。', skill:'stealth' },
  lemon_assassin:   { id:'lemon_assassin',   name:'柠檬刺客', icon:'🍋', color:'#ffe76a', rarity:'epic',   role:'rush',    range:'melee', atk:20, hp:28, speed:0.92, move:126, siege:0.80, armor:2,  tags:['rush','crit'], desc:'首击爆发暴击x2,适合切远程和补刀。怕控制与枪线。', skill:'first_crit' },
  cherry_bomber:    { id:'cherry_bomber',    name:'樱桃炸弹', icon:'🍒', color:'#d44155', rarity:'epic',   role:'back',    range:'far',   atk:18, hp:28, speed:1.55, move:74,  siege:0.88, armor:1,  tags:['back','aoe'], desc:'Lv4+ 每5次攻击投掷范围炸弹。', skill:'aoe' },
  kiwi_wildcard:    { id:'kiwi_wildcard',    name:'奇异果万能', icon:'🥝', color:'#8bd34e', rarity:'epic',   role:'merge',   range:'support', atk:0,  hp:20, speed:1.80, move:62,  siege:0.20, armor:0,  tags:['merge','wildcard'], desc:'同星万能合成材料。合成辅助，不派兵。', skill:'wildcard' },
  passion_copy:     { id:'passion_copy',     name:'百香果复制', icon:'🟣', color:'#b85cff', rarity:'epic',   role:'merge',   range:'support', atk:0,  hp:20, speed:1.80, move:62,  siege:0.20, armor:0,  tags:['merge','copy'], desc:'拖到同星目标上复制成目标水果。合成辅助，不派兵。', skill:'copy' },

  /* ——— T1 (rare/稀有) ——— */
  dragonfruit_warrior:{id:'dragonfruit_warrior',name:'火龙果战士',icon:'🐉',color:'#ff3b6e',rarity:'rare', role:'tank',    range:'mid',   atk:16, hp:44, speed:1.10, move:88,  siege:0.90, armor:5,  tags:['front','burn'], desc:'Lv4+ 攻击附带点燃(3伤害/s,2s)。', skill:'burn' },
  blueberry_sniper: { id:'blueberry_sniper', name:'蓝莓狙手', icon:'🫐', color:'#4d7dff', rarity:'rare',   role:'back',    range:'long',  atk:15, hp:28, speed:1.75, move:72,  siege:1.05, armor:1,  tags:['back','burst'], desc:'长射程爆发,优先后排,忽略5护甲。怕突击贴脸。', skill:'snipe' },
  banana_raider:    { id:'banana_raider',    name:'香蕉突击', icon:'🍌', color:'#ffd447', rarity:'rare',   role:'rush',    range:'melee', atk:14, hp:32, speed:0.82, move:118, siege:0.95, armor:2,  tags:['rush','assassin'], desc:'快速突击,Lv3+首次攻击眩晕0.5s。怕枪线拦截。', skill:'dash' },
  pineapple_lancer: { id:'pineapple_lancer', name:'菠萝枪兵', icon:'🍍', color:'#ffb337', rarity:'rare',   role:'tank',    range:'mid',   atk:12, hp:48, speed:1.10, move:90,  siege:0.95, armor:7,  tags:['front','anti_rush'], desc:'中线枪兵，职责克制突击单位。', skill:'anti_rush' },
  orange_cannon:    { id:'orange_cannon',    name:'橙子炮手', icon:'🍊', color:'#ff9838', rarity:'rare',   role:'siege',   range:'far',   atk:12, hp:40, speed:1.65, move:64,  siege:2.45, armor:4,  tags:['siege','range'], desc:'攻城核心,对城墙x1.3。拆果堡极强,打兵偏弱,怕突击。', skill:'siege' },
  strawberry_knight:{ id:'strawberry_knight',name:'草莓骑士', icon:'🍓', color:'#ff4d5a', rarity:'rare',   role:'tank',    range:'melee', atk:11, hp:74, speed:1.40, move:80,  siege:0.85, armor:14, tags:['tank','charge'], desc:'Lv4+ 首次接战冲锋60px+击退。', skill:'charge' },
  pumpkin_roller:   { id:'pumpkin_roller',   name:'南瓜滚轮', icon:'🎃', color:'#ff7d35', rarity:'rare',   role:'siege',   range:'melee', atk:10, hp:36, speed:1.20, move:96,  siege:1.55, armor:4,  tags:['siege','death'], desc:'死亡时爆炸(ATKx2范围伤害+眩晕)。适合制造攻城突破点。', skill:'death_roll' },
  mango_arbalest:   { id:'mango_arbalest',   name:'芒果弩手', icon:'🥭', color:'#ffbd43', rarity:'rare',   role:'back',    range:'long',  atk:11, hp:30, speed:0.55, move:68,  siege:0.92, armor:1,  tags:['back','rapid'], desc:'攻速0.55s，全游戏最快。', skill:'rapid' },
  grape_archer:     { id:'grape_archer',     name:'葡萄射手', icon:'🍇', color:'#9b5cff', rarity:'rare',   role:'back',    range:'far',   atk:10, hp:32, speed:1.00, move:86,  siege:0.90, armor:2,  tags:['back','dps'], desc:'稳定后排输出,连续攻击同目标伤害+10%/次。怕突击切入。', skill:'rapid' },
  pear_frost:       { id:'pear_frost',       name:'冰梨术士', icon:'🍐', color:'#9be7ff', rarity:'rare',   role:'back',    range:'far',   atk:7,  hp:31, speed:1.35, move:70,  siege:0.70, armor:1,  tags:['control','slow'], desc:'攻击附带减速30%1.5s,Lv6减速升级为冰冻。', skill:'slow' },

  /* ——— T2 (normal/普通) ——— */
  watermelon_guard: { id:'watermelon_guard', name:'西瓜盾卫', icon:'🍉', color:'#34c96b', rarity:'normal', role:'tank',    range:'melee', atk:9,  hp:80, speed:1.5,  move:76,  siege:0.75, armor:16, tags:['tank','shield'], desc:'主坦抗线。Lv4+每8s获得20点护盾。', skill:'shield' },
  coconut_guard:    { id:'coconut_guard',    name:'椰子守卫', icon:'🥥', color:'#9f7a4c', rarity:'normal', role:'tank',    range:'melee', atk:8,  hp:88, speed:1.62, move:72,  siege:0.65, armor:14, tags:['tank','shield'], desc:'硬坦。第一次接战获得35临时护盾，适合抗爆发。', skill:'first_shield' },
  avocado_brawler:  { id:'avocado_brawler',  name:'牛油果力士', icon:'🥑', color:'#8fa64a', rarity:'normal', role:'tank',    range:'melee', atk:9,  hp:96, speed:1.65, move:68,  siege:0.70, armor:18, tags:['tank','immune'], desc:'Lv4+ 受击30%概率免疫伤害。', skill:'immune' },
  melon_shaman:     { id:'melon_shaman',     name:'哈密瓜萨满', icon:'🍈', color:'#c8e670', rarity:'normal', role:'back',    range:'far',   atk:7,  hp:29, speed:1.40, move:68,  siege:0.65, armor:1,  tags:['control','weaken'], desc:'攻击概率减敌ATK×0.85,2s。', skill:'weaken' },
  peach_medic:      { id:'peach_medic',      name:'蜜桃医师', icon:'🍑', color:'#ff9fbd', rarity:'normal', role:'support', range:'support', atk:5,  hp:32, speed:1.65, move:70,  siege:0.40, armor:1,  tags:['support','heal'], desc:'周期治疗同路前排。怕突击切入。', skill:'heal' },
  mint_supply:      { id:'mint_supply',      name:'薄荷补给球', icon:'🌿', color:'#7ed6a0', rarity:'normal', role:'support',range:'support',atk:3,  hp:28, speed:1.55, move:60,  siege:0.12, armor:2,  tags:['econ','sp_regen'], desc:'在场时自然回复提速→4s, Lv4→3.5s, Lv7→3s。', skill:'sp_regen' },
  shock_lemon:      { id:'shock_lemon',      name:'电击柠檬球', icon:'⚡', color:'#ffe76a', rarity:'normal', role:'support',range:'support',atk:5,  hp:24, speed:1.45, move:58,  siege:0.10, armor:1,  tags:['econ','kill_sp'], desc:'击杀敌方额外+SP: Lv1+1, Lv4+2, Lv7+3+攻速。', skill:'kill_sp' },
  honey_save:       { id:'honey_save',       name:'蜂蜜储蓄球', icon:'🍯', color:'#f5b642', rarity:'normal', role:'support',range:'support',atk:4,  hp:30, speed:1.50, move:60,  siege:0.10, armor:2,  tags:['econ','sp_refund'], desc:'操作后返还SP: Lv1+1, Lv4+2, Lv7+3(8s CD)。', skill:'sp_refund' },
  ferment_grape:    { id:'ferment_grape',    name:'发酵葡萄球', icon:'🍷', color:'#b86bce', rarity:'normal', role:'support',range:'support',atk:0,  hp:22, speed:1.35, move:55,  siege:0.05, armor:0,  tags:['econ','sp_bank'], desc:'每15s产1SP,死亡吐出累计值(上限15), Lv4 12s, Lv7+额外5。', skill:'sp_bank' },
  chill_juice:      { id:'chill_juice',      name:'冰镇果汁球', icon:'🧊', color:'#9be7ff', rarity:'normal', role:'support',range:'support',atk:3,  hp:26, speed:1.50, move:56,  siege:0.05, armor:1,  tags:['econ','sp_discount'], desc:'每20s下一次操作消耗减半, Lv4 15s, Lv7 免费。', skill:'sp_discount' },
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
  // 合并抽卡已解锁但进度未到的水果,不丢失 gacha 成果
  m.unlocked = [...new Set([...list, ...(Array.isArray(m.unlocked) ? m.unlocked : [])])].filter(id => TYPES[id]);
  if (!Array.isArray(m.deck) || m.deck.length === 0) m.deck = DEFAULT_DECK.slice();
  m.deck = normalizeDeck(m.deck).filter(id => (Array.isArray(m.unlocked) ? m.unlocked : list).includes(id));
  for (const id of DEFAULT_DECK) if (m.deck.length < DECK_SIZE && (Array.isArray(m.unlocked) ? m.unlocked : list).includes(id) && !m.deck.includes(id)) m.deck.push(id);
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
// 克制飘字按"攻击方职责"配色(战斗屏 UI 规范 §3):突击黄/后排紫/坦克绿/攻城橙/前排琥珀/控制青/辅助浅绿
function roleFxColor(sourceType) {
  const r = (TYPES[sourceType] || {}).role;
  return ({ rush: '#FFD24A', back: '#B076FF', tank: '#53E77B', siege: '#FF9A35', front: '#FFB547', control: '#38C6E8', support: '#8FE0A0' })[r] || '#F5C242';
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

/* ——— 局外养成:英雄等级 Lv1-20 (设计档 §7) ——— */
const HERO_MAX = 20;
function heroFragCost(lv) {                                    // 单级碎片消耗,lv=当前等级,升到 lv+1
  if (lv < 1 || lv >= HERO_MAX) return Infinity;
  return Math.round(10 * Math.pow(2, lv));
}
function heroGoldCost(lv) {                                    // 单级金币消耗
  if (lv < 1 || lv >= HERO_MAX) return Infinity;
  return heroFragCost(lv) * 10;
}
function heroMul(lv) {                                         // 攻血倍率 Lv1=1.0x Lv20=8.6x
  return 1 + (Math.min(Math.max(lv, 1), HERO_MAX) - 1) * 0.40;
}
// 英雄等级→星级特效档位(用于开局SP/技能CD等全局判定)
function heroStarTier(heroLv) {
  if (heroLv >= 20) return 7;
  if (heroLv >= 16) return 6;
  if (heroLv >= 12) return 5;
  if (heroLv >= 8) return 4;
  if (heroLv >= 5) return 3;
  return 1;
}
// 玩家平均英雄等级(用于动态难度)
function avgPlayerHeroLv(meta) {
  const s = typeof window !== 'undefined' ? window.shell : null;
  const vals = UNIT_POOL.filter(id => TYPES[id]).map(id => s?.fruitLv?.[id] || 1);
  if (!vals.length) return 0;
  vals.sort((a, b) => b - a);
  const n = Math.max(1, Math.floor(vals.length / 2));
  let sum = 0; for (let i = 0; i < n; i++) sum += vals[i];
  return Math.round(sum / n);
}

/* 星级特效(设计档 §7.3) */
function starSkillCdReduce(star) { return star >= 3 ? 0.5 : 0; }      // ★3: 技能 CD -0.5s
function starSkillEnhanced(star)   { return star >= 5; }               // ★5: 技能强化(Lv7 技能额外效果)
function starAuraAtkBonus(star)    { return star >= 6 ? 0.03 : 0; }    // ★6: 同职责光环 +3% ATK
function starStartSpBonus(star)    { return star >= 7 ? 2 : 0; }       // ★7: 开局 SP+2
// PvP 调整:★7 开局 SP+2 → +1
function starStartSpBonusPvp(star) { return star >= 7 ? 1 : 0; }

/* 战力统一值:求和,未拥有不计入 */
function computePower() {
  const s = typeof window !== 'undefined' ? window.shell : null;
  let sum = 0;
  for (const id of UNIT_POOL) {
    if (!TYPES[id]) continue;
    // 未拥有(无碎片记录)不计入
    if (!meta?.shardsTotal?.[id]) continue;
    const lv = s?.fruitLv?.[id] || 1;
    sum += Math.round((TYPES[id].atk + TYPES[id].hp) * heroMul(lv));
  }
  return sum;
}
const BASE_WALL_HP = 72;
const SIEGE_SLOTS_PER_LANE = 3;
const BALL_SPAWN_INTERVAL = 4.4;
const SOLDIER_SPAWN_INTERVAL = 5;
const SPAWN_COOLDOWNS = [0, 5.6, 4.9, 4.25, 3.65, 3.15, 2.7, 2.35];
const OVERFLOW_MAX = 10;
const MAX_SOLDIERS = 14; // 24→14:降低中路兵淤积→兵能推进到墙(combat-fixes-plan §2B)
const SP_MAX = 18;
const SP_PASSIVE = 3.0;

const TUNING = {
  juice: {
    start: 8,
    enemyStart: 8,
    passiveInterval: 5.0,
    enemyActionInterval: 4.0,
    maxActionCost: 12,
    wallPitySteps: 4,
    wallPityGain: 3,
  },
  rewards: { baseGold: 18, goldPerStage: 8, bossGoldBonus: 24 },
  pve: {
    normalTargetSeconds: [35, 55],
    bossTargetSeconds: [55, 85],
    standardWinRate: [0.80, 0.95],
    bossWinRate: [0.65, 0.85],
  },
  pvp: {
    actionRateLimitPerSecond: 15,
    statMultiplier: 1.0,
  },
  stageTypes: {
    normal: 'normal',
    mechanic: 'mechanic',
    boss: 'boss',
    resource: 'resource',
    challenge: 'challenge',
  },
  bossMechanics: {}, // 去Boss:清空所有Boss机制(不再刷Boss大怪/护盾/炮击/双生/召唤)
  stages: [
    { stageId: 1, chapter: 1, type: 'normal', enemyLevel: 1.00, enemyWallHp: 48, enemySpawnInterval: 6.1, enemyPlan: { opening: ['watermelon_guard', 'banana_raider'], count: 2 }, reward: { gold: 26 }, tutorialHint: 'merge_pair', unlockRules: ['starter_deck'] },
    { stageId: 2, chapter: 1, type: 'normal', enemyLevel: 1.08, enemyWallHp: 56, enemySpawnInterval: 6.0, enemyPlan: { opening: ['watermelon_guard', 'grape_archer', 'banana_raider'], count: 3 }, reward: { gold: 34 }, tutorialHint: 'hold_frontline', unlockRules: [] },
    { stageId: 3, chapter: 1, type: 'normal', enemyLevel: 1.16, enemyWallHp: 64, enemySpawnInterval: 5.9, enemyPlan: { opening: ['pineapple_lancer', 'grape_archer', 'banana_raider'], count: 3 }, reward: { gold: 42 }, tutorialHint: 'urgent_dispatch', unlockRules: [] },
    { stageId: 4, chapter: 1, type: 'mechanic', enemyLevel: 1.26, enemyWallHp: 76, enemySpawnInterval: 5.75, enemyPlan: { opening: ['watermelon_guard', 'pineapple_lancer', 'orange_cannon', 'grape_archer'], count: 4 }, reward: { gold: 50 }, tutorialHint: 'lane_pressure', unlockRules: [] },
    { stageId: 5, chapter: 1, type: 'normal', enemyLevel: 1.36, enemyWallHp: 82, enemySpawnInterval: 5.8, enemyPlan: { opening: ['watermelon_guard', 'watermelon_guard', 'grape_archer'], count: 3 }, reward: { gold: 82 }, tutorialHint: '', unlockRules: ['boss_1'] },
    { stageId: 6, chapter: 2, type: 'normal', enemyLevel: 1.45, enemyWallHp: 88, enemySpawnInterval: 5.55, enemyPlan: { opening: ['banana_raider', 'grape_archer', 'pineapple_lancer', 'watermelon_guard'], count: 4 }, reward: { gold: 66 }, tutorialHint: 'counter_rush', unlockRules: ['coconut_guard'] },
    { stageId: 7, chapter: 2, type: 'mechanic', enemyLevel: 1.55, enemyWallHp: 98, enemySpawnInterval: 5.45, enemyPlan: { opening: ['orange_cannon', 'watermelon_guard', 'grape_archer', 'banana_raider'], count: 4 }, reward: { gold: 74 }, tutorialHint: 'bring_siege', unlockRules: [] },
    { stageId: 8, chapter: 2, type: 'resource', enemyLevel: 1.64, enemyWallHp: 108, enemySpawnInterval: 5.55, enemyPlan: { opening: ['coconut_guard', 'pineapple_lancer', 'grape_archer'], count: 4 }, reward: { gold: 90 }, tutorialHint: 'farm_juice', unlockRules: ['peach_medic'] },
    { stageId: 9, chapter: 2, type: 'challenge', enemyLevel: 1.75, enemyWallHp: 122, enemySpawnInterval: 5.25, enemyPlan: { opening: ['banana_raider', 'banana_raider', 'pineapple_lancer', 'orange_cannon'], count: 5 }, reward: { gold: 90 }, tutorialHint: 'protect_backline', unlockRules: [] },
    { stageId: 10, chapter: 2, type: 'normal', enemyLevel: 1.90, enemyWallHp: 132, enemySpawnInterval: 5.5, enemyPlan: { opening: ['orange_cannon', 'pineapple_lancer', 'watermelon_guard'], count: 4 }, reward: { gold: 122 }, tutorialHint: '', unlockRules: ['boss_2'] },
    { stageId: 11, chapter: 3, type: 'normal', enemyLevel: 2.05, enemyWallHp: 142, enemySpawnInterval: 5.15, enemyPlan: { opening: ['pear_frost', 'watermelon_guard', 'grape_archer', 'orange_cannon'], count: 5 }, reward: { gold: 106 }, tutorialHint: 'control_counter', unlockRules: ['blueberry_sniper'] },
    { stageId: 12, chapter: 3, type: 'mechanic', enemyLevel: 2.18, enemyWallHp: 158, enemySpawnInterval: 5.05, enemyPlan: { opening: ['pumpkin_roller', 'pineapple_lancer', 'grape_archer', 'watermelon_guard'], count: 5 }, reward: { gold: 114 }, tutorialHint: 'burst_before_roll', unlockRules: [] },
    { stageId: 13, chapter: 3, type: 'resource', enemyLevel: 2.30, enemyWallHp: 174, enemySpawnInterval: 5.15, enemyPlan: { opening: ['peach_medic', 'watermelon_guard', 'orange_cannon', 'banana_raider'], count: 5 }, reward: { gold: 136 }, tutorialHint: 'focus_support', unlockRules: ['lemon_assassin'] },
    { stageId: 14, chapter: 3, type: 'challenge', enemyLevel: 2.44, enemyWallHp: 192, enemySpawnInterval: 4.95, enemyPlan: { opening: ['banana_raider', 'lemon_assassin', 'grape_archer', 'pineapple_lancer', 'watermelon_guard'], count: 5 }, reward: { gold: 130 }, tutorialHint: 'anti_assassin_front', unlockRules: [] },
    { stageId: 15, chapter: 3, type: 'normal', enemyLevel: 2.58, enemyWallHp: 205, enemySpawnInterval: 5.3, enemyPlan: { opening: ['coconut_guard', 'lemon_assassin', 'grape_archer', 'orange_cannon'], count: 5 }, reward: { gold: 162 }, tutorialHint: '', unlockRules: ['boss_3'] },
    { stageId: 16, chapter: 4, type: 'normal', enemyLevel: 2.75, enemyWallHp: 218, enemySpawnInterval: 4.85, enemyPlan: { opening: ['strawberry_knight', 'grape_archer', 'pineapple_lancer', 'orange_cannon'], count: 5 }, reward: { gold: 146 }, tutorialHint: 'frontline_rotation', unlockRules: ['pumpkin_roller'] },
    { stageId: 17, chapter: 4, type: 'mechanic', enemyLevel: 2.90, enemyWallHp: 240, enemySpawnInterval: 4.75, enemyPlan: { opening: ['avocado_brawler', 'pear_frost', 'grape_archer', 'banana_raider'], count: 5 }, reward: { gold: 154 }, tutorialHint: 'sustain_damage', unlockRules: [] },
    { stageId: 18, chapter: 4, type: 'resource', enemyLevel: 3.05, enemyWallHp: 264, enemySpawnInterval: 4.85, enemyPlan: { opening: ['orange_cannon', 'orange_cannon', 'watermelon_guard', 'peach_medic'], count: 5 }, reward: { gold: 180 }, tutorialHint: 'win_siege_race', unlockRules: ['kiwi_wildcard'] },
    { stageId: 19, chapter: 4, type: 'challenge', enemyLevel: 3.20, enemyWallHp: 292, enemySpawnInterval: 4.65, enemyPlan: { opening: ['olive_assassin', 'banana_raider', 'mango_arbalest', 'pineapple_lancer', 'watermelon_guard'], count: 5 }, reward: { gold: 170 }, tutorialHint: 'protect_support', unlockRules: [] },
    { stageId: 20, chapter: 4, type: 'normal', enemyLevel: 3.30, enemyWallHp: 310, enemySpawnInterval: 5.1, enemyPlan: { opening: ['pumpkin_roller', 'pear_frost', 'orange_cannon', 'watermelon_guard', 'peach_medic'], count: 5 }, reward: { gold: 210 }, tutorialHint: '', unlockRules: ['boss_4'] },
  ],
};

function upgradeCost(lv) { return 10 + lv * 8; }
function getStageDefinition(k) {
  const stageId = Math.max(1, Math.floor(Number(k) || 1));
  const direct = TUNING.stages.find(stage => stage.stageId === stageId);
  if (direct) return direct;
  const boss = false; // 去Boss:程序化生成>20 关不再产生 boss 类型(combat-fixes-plan §1)
  const chapter = Math.floor((stageId - 1) / 5) + 1;
  const bossCycle = ['shield', 'summon', 'charge', 'heal', 'siege'];
  return {
    stageId,
    chapter,
    type: TUNING.stageTypes.normal,
    enemyPlan: { count: boss ? 5 : Math.min(5, 3 + Math.floor(stageId / 4)) },
    bossMechanic: boss ? bossCycle[(stageId / 5 - 1) % bossCycle.length] : '',
    reward: { gold: TUNING.rewards.baseGold + stageId * TUNING.rewards.goldPerStage + (boss ? TUNING.rewards.bossGoldBonus : 0) },
    tutorialHint: '',
    unlockRules: [],
  };
}
function stageReward(k) {
  const def = getStageDefinition(k);
  return def.reward && Number.isFinite(def.reward.gold) ? def.reward.gold : k * 8 + 18;
}
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

function roleOf(type) { return TYPES[type]?.role || ''; }
function generateLevel(k) {
  const stageId = Math.max(1, Math.floor(Number(k) || 1));
  const def = getStageDefinition(stageId);
  const isBossStage = def.type === TUNING.stageTypes.boss; // 去Boss:移除%5整除检测(现有定义无boss→恒false,不再加厚墙)
  const tunedEnemyLv = Number.isFinite(def.enemyLevel) ? def.enemyLevel : 1 + (stageId - 1) * 0.19 + (isBossStage ? 0.18 : 0);
  const tunedWallBase = isBossStage ? 82 : 56;
  const tunedWallGrow = isBossStage ? 1.15 : 1.10;
  const fallbackWall = Math.round(tunedWallBase * Math.pow(tunedWallGrow, stageId - 1));
  return {
    id: stageId,
    stageId,
    chapter: def.chapter || Math.floor((stageId - 1) / 5) + 1,
    type: def.type || (isBossStage ? TUNING.stageTypes.boss : TUNING.stageTypes.normal),
    isBoss: isBossStage,
    enemyInitLevel: tunedEnemyLv,
    enemyWallHp: Math.max(24, Math.round(def.enemyWallHp || fallbackWall)),
    enemySpawnInterval: Number.isFinite(def.enemySpawnInterval) ? def.enemySpawnInterval : Math.max(4.25, 6.2 - stageId * 0.13),
    enemyPlan: def.enemyPlan || null,
    bossMechanic: def.bossMechanic || TUNING.bossMechanics[stageId] || '',
    reward: stageReward(stageId),
    rewardInfo: def.reward || { gold: stageReward(stageId) },
    tutorialHint: def.tutorialHint || '',
    unlockRules: Array.isArray(def.unlockRules) ? def.unlockRules.slice() : [],
    desc: def.desc || (isBossStage ? `Stage ${stageId} Boss · ${def.bossMechanic || 'special'} · +${TUNING.rewards.bossGoldBonus}` : `Stage ${stageId} · Enemy Lv${tunedEnemyLv.toFixed(1)} · ${def.type || 'normal'}`),
  };
}
