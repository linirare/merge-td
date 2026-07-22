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
const CELL = 54;
const GAP = 5;
const BOARD_W = COLS * CELL + (COLS - 1) * GAP;
const BOARD_H = ROWS * CELL + (ROWS - 1) * GAP;
const BOARD_X = (W - BOARD_W) / 2;
const ENEMY_BOARD_X = 64;
const PLAYER_BOARD_X = W - ENEMY_BOARD_X - BOARD_W;
function boardX(isEnemy) { return isEnemy ? ENEMY_BOARD_X : PLAYER_BOARD_X; }

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
  olive_assassin:   { id:'olive_assassin',   name:'橄榄刺客', icon:'🫒', color:'#8a9a5b', rarity:'epic',   role:'raider',  range:'melee', atk:22, hp:24, rate:0.96,  tags:['rush','stealth'], desc:'Lv4+ 出场3s隐身，首击暴击×2.5。', skill:'stealth' },
  lemon_assassin:   { id:'lemon_assassin',   name:'柠檬刺客', icon:'🍋', color:'#ffe76a', rarity:'epic',   role:'raider',  range:'melee', atk:20, hp:28, rate:0.92,  tags:['rush','crit'], desc:'首击爆发暴击x2,适合切远程和补刀。怕控制与枪线。', skill:'first_crit' },
  cherry_bomber:    { id:'cherry_bomber',    name:'樱桃炸弹', icon:'🍒', color:'#d44155', rarity:'epic',   role:'shooter', range:'far',   atk:18, hp:28, rate:1.55,  siege:0.88,  tags:['back','aoe'], desc:'Lv4+ 每5次攻击投掷范围炸弹。', skill:'aoe' },
  kiwi_wildcard:    { id:'kiwi_wildcard',    name:'奇异果万能', icon:'🥝', color:'#8bd34e', rarity:'epic',   role:'wildcard',range:'support', atk:0,  hp:20, rate:1.80,  siege:0.20,  tags:['merge','wildcard'], desc:'同星万能合成材料。合成辅助，不派兵。', skill:'wildcard' },
  passion_copy:     { id:'passion_copy',     name:'百香果复制', icon:'🟣', color:'#b85cff', rarity:'epic',   role:'wildcard',range:'support', atk:0,  hp:20, rate:1.80,  siege:0.20,  tags:['merge','copy'], desc:'拖到同星目标上复制成目标水果。合成辅助，不派兵。', skill:'copy' },

  /* ——— T1 (rare/稀有) ——— */
  dragonfruit_warrior:{id:'dragonfruit_warrior',name:'火龙果战士',icon:'🐉',color:'#ff3b6e',rarity:'rare', role:'spike',   range:'mid',   atk:16, hp:44, rate:1.10,  siege:0.90,  tags:['front','burn'], desc:'Lv4+ 攻击附带点燃(3伤害/s,2s)。', skill:'burn' },
  blueberry_sniper: { id:'blueberry_sniper', name:'蓝莓狙手', icon:'🫐', color:'#4d7dff', rarity:'rare',   role:'shooter', range:'long',  atk:15, hp:28, rate:1.75,  siege:1.05,  tags:['back','burst'], desc:'长射程爆发,优先后排,忽略5护甲。怕突击贴脸。', skill:'snipe' },
  banana_raider:    { id:'banana_raider',    name:'香蕉突击', icon:'🍌', color:'#ffd447', rarity:'rare',   role:'raider',  range:'melee', atk:14, hp:32, rate:0.82,  tags:['rush','assassin'], desc:'快速突击,Lv3+首次攻击眩晕0.5s。怕枪线拦截。', skill:'dash' },
  pineapple_lancer: { id:'pineapple_lancer', name:'菠萝枪兵', icon:'🍍', color:'#ffb337', rarity:'rare',   role:'spike',   range:'mid',   atk:12, hp:48, rate:1.10,  siege:0.95,  tags:['front','anti_rush'], desc:'中线枪兵，职责克制突击单位。', skill:'anti_rush' },
  orange_cannon:    { id:'orange_cannon',    name:'橙子炮手', icon:'🍊', color:'#ff9838', rarity:'rare',   role:'shooter', range:'far',   atk:12, hp:40, rate:1.65,  siege:2.45,  tags:['siege','range'], desc:'攻城核心,对城墙x1.3。拆果堡极强,打兵偏弱,怕突击。', skill:'siege' },
  strawberry_knight:{ id:'strawberry_knight',name:'草莓骑士', icon:'🍓', color:'#ff4d5a', rarity:'rare',   role:'shell',   range:'melee', atk:11, hp:74, rate:1.40,  siege:0.85, tags:['tank','charge'], desc:'Lv4+ 首次接战冲锋60px+击退。', skill:'charge' },
  pumpkin_roller:   { id:'pumpkin_roller',   name:'南瓜滚轮', icon:'🎃', color:'#ff7d35', rarity:'rare',   role:'raider',  range:'melee', atk:10, hp:36, rate:1.20,  siege:1.55,  tags:['siege','death'], desc:'死亡时爆炸(ATKx2范围伤害+眩晕)。适合制造攻城突破点。', skill:'death_roll' },
  mango_arbalest:   { id:'mango_arbalest',   name:'芒果弩手', icon:'🥭', color:'#ffbd43', rarity:'rare',   role:'shooter', range:'long',  atk:11, hp:30, rate:0.55,  siege:0.92,  tags:['back','rapid'], desc:'攻速0.55s，全游戏最快。', skill:'rapid' },
  grape_archer:     { id:'grape_archer',     name:'葡萄射手', icon:'🍇', color:'#9b5cff', rarity:'rare',   role:'shooter', range:'far',   atk:10, hp:32, rate:1.00,  siege:0.90,  tags:['back','dps'], desc:'稳定后排输出,连续攻击同目标伤害+10%/次。怕突击切入。', skill:'rapid' },
  pear_frost:       { id:'pear_frost',       name:'冰梨术士', icon:'🍐', color:'#9be7ff', rarity:'rare',   role:'shooter', range:'far',   atk:7,  hp:31, rate:1.35,  siege:0.70,  tags:['control','slow'], desc:'攻击附带减速30%1.5s,Lv6减速升级为冰冻。', skill:'slow' },

  /* ——— T2 (normal/普通) ——— */
  watermelon_guard: { id:'watermelon_guard', name:'西瓜盾卫', icon:'🍉', color:'#34c96b', rarity:'normal', role:'shell',   range:'melee', atk:9,  hp:80, rate:1.5,  move:76,  siege:0.75, tags:['tank','shield'], desc:'主坦抗线。Lv4+每8s获得20点护盾。', skill:'shield' },
  coconut_guard:    { id:'coconut_guard',    name:'椰子守卫', icon:'🥥', color:'#9f7a4c', rarity:'normal', role:'shell',   range:'melee', atk:8,  hp:88, rate:1.62,  siege:0.65, tags:['tank','shield'], desc:'硬坦。第一次接战获得35临时护盾，适合抗爆发。', skill:'first_shield' },
  avocado_brawler:  { id:'avocado_brawler',  name:'牛油果力士', icon:'🥑', color:'#8fa64a', rarity:'normal', role:'shell',   range:'melee', atk:9,  hp:96, rate:1.65,  siege:0.70, tags:['tank','immune'], desc:'Lv4+ 受击30%概率免疫伤害。', skill:'immune' },
  melon_shaman:     { id:'melon_shaman',     name:'哈密瓜萨满', icon:'🍈', color:'#c8e670', rarity:'normal', role:'shooter', range:'far',   atk:7,  hp:29, rate:1.40,  siege:0.65,  tags:['control','weaken'], desc:'攻击概率减敌ATK×0.85,2s。', skill:'weaken' },
  peach_medic:      { id:'peach_medic',      name:'蜜桃医师', icon:'🍑', color:'#ff9fbd', rarity:'normal', role:'shell',   range:'support', atk:5,  hp:32, rate:1.65,  siege:0.40,  tags:['support','heal'], desc:'周期治疗同路前排。怕突击切入。', skill:'heal' },
  mint_supply:      { id:'mint_supply',      name:'薄荷补给球', icon:'🌿', color:'#7ed6a0', rarity:'normal', role:'shell',  range:'support',atk:3,  hp:28, rate:1.55,  siege:0.12,  tags:['econ','sp_regen'], desc:'在场时自然回复提速→4s, Lv4→3.5s, Lv7→3s。', skill:'sp_regen' },
  shock_lemon:      { id:'shock_lemon',      name:'电击柠檬球', icon:'⚡', color:'#ffe76a', rarity:'normal', role:'spike',  range:'support',atk:5,  hp:24, rate:1.45,  siege:0.10,  tags:['econ','kill_sp'], desc:'击杀敌方额外+SP: Lv1+1, Lv4+2, Lv7+3+攻速。', skill:'kill_sp' },
  honey_save:       { id:'honey_save',       name:'蜂蜜储蓄球', icon:'🍯', color:'#f5b642', rarity:'normal', role:'shell', range:'support',atk:4,  hp:30, rate:1.50,  siege:0.10,  tags:['econ','sp_refund'], desc:'操作后返还SP: Lv1+1, Lv4+2, Lv7+3(8s CD)。', skill:'sp_refund' },
  ferment_grape:    { id:'ferment_grape',    name:'发酵葡萄球', icon:'🍷', color:'#b86bce', rarity:'normal', role:'shell', range:'support',atk:0,  hp:22, rate:1.35,  siege:0.05,  tags:['econ','sp_bank'], desc:'每15s产1SP,死亡吐出累计值(上限15), Lv4 12s, Lv7+额外5。', skill:'sp_bank' },
  chill_juice:      { id:'chill_juice',      name:'冰镇果汁球', icon:'🧊', color:'#9be7ff', rarity:'normal', role:'shell', range:'support',atk:3,  hp:26, rate:1.50,  siege:0.05,  tags:['econ','sp_discount'], desc:'每20s下一次操作消耗减半, Lv4 15s, Lv7 免费。', skill:'sp_discount' },
};

/* ——— 技能效果分类：6 类，用于 VFX 调度 ——— */
const SKILL_TYPE_MAP = {
  /* self-buff: 自身增益（盾/冲锋/免疫） */
  watermelon_guard:'self-buff', coconut_guard:'self-buff', avocado_brawler:'self-buff', strawberry_knight:'self-buff',
  /* single-projectile: 单体弹道 / 近战攻击附带效果 */
  grape_archer:'single-projectile', orange_cannon:'single-projectile', blueberry_sniper:'single-projectile',
  mango_arbalest:'single-projectile', pear_frost:'single-projectile', banana_raider:'single-projectile',
  lemon_assassin:'single-projectile', olive_assassin:'single-projectile', pineapple_lancer:'single-projectile',
  dragonfruit_warrior:'single-projectile', melon_shaman:'single-projectile',
  /* line-aoe: 范围伤害 */
  cherry_bomber:'line-aoe', pumpkin_roller:'line-aoe',
  /* special: 治疗 / SP 经济 / 合成辅助 */
  peach_medic:'special', mint_supply:'special', shock_lemon:'special',
  honey_save:'special', ferment_grape:'special', chill_juice:'special',
  kiwi_wildcard:'special', passion_copy:'special',
};
const SKILL_VFX = {
  'self-buff':         { ringColor:'#53e77b', ringRadius:8,  sparkCount:5,  label:'强化' },
  'single-projectile': { ringColor:null,       ringRadius:0,  sparkCount:3,  label:null },
  'line-aoe':          { ringColor:'#ff6b4a',  ringRadius:14, sparkCount:10, label:'范围' },
  special:             { ringColor:'#b076ff',  ringRadius:6,  sparkCount:4,  label:null },
};

if (typeof applyWorldThemeToTypes === 'function') applyWorldThemeToTypes(TYPES);

const UNIT_POOL = Object.keys(TYPES);
const OLD_DEFAULT_DECK = ['watermelon_guard','grape_archer','banana_raider','pineapple_lancer','orange_cannon'];
const DEFAULT_DECK = ['watermelon_guard','grape_archer','banana_raider','pineapple_lancer','orange_cannon'];
const STARTER_BUILD_DECK = ['watermelon_guard','grape_archer','pineapple_lancer','orange_cannon','mint_supply'];
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
  if ((Math.max(1, m.highestLevel || 1) >= 6) && shouldAutoStarterBuildDeck(m.deck, m.unlocked)) m.deck = STARTER_BUILD_DECK.slice();
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
function shouldAutoStarterBuildDeck(deck, unlocked) {
  const sig = deckSignature(deck);
  return Array.isArray(unlocked)
    && unlocked.includes('mint_supply')
    && (sig === DEFAULT_DECK.join('|') || sig === OLD_DEFAULT_DECK.join('|'));
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
// 4×4 职责克制矩阵(设计档 fruit-assault-final.md §2.3),幅度 ±35%(0.80~1.35)。
// 行=攻击方职责,列=防御方职责。wildcard(万能)不参与克制,返回 1。
// 克制环: 甲壳兵→射手→枪刺兵→游骑兵→甲壳兵
const ROLE_COUNTER_MATRIX = {
  //          shell spike shooter raider
  shell:   { shell:1.0, spike:0.90, shooter:1.35, raider:0.80 },
  spike:   { shell:1.10, spike:1.0, shooter:0.80, raider:1.35 },
  shooter: { shell:0.80, spike:1.35, shooter:1.0, raider:1.05 },
  raider:  { shell:1.35, spike:0.80, shooter:1.10, raider:1.0 },
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
  const t = TYPES[sourceType] || {};
  const tags = Array.isArray(t.tags) ? t.tags : [];
  for (const tag of tags) {
    const color = ({ rush: '#FFD24A', back: '#B076FF', tank: '#53E77B', siege: '#FF9A35', front: '#FFB547', control: '#38C6E8', support: '#8FE0A0' })[tag];
    if (color) return color;
  }
  const roleMap = { raider: '#FFD24A', shooter: '#B076FF', shell: '#53E77B', spike: '#FFB547', wildcard: '#8FE0A0' };
  return roleMap[t.role || ''] || '#F5C242';
}
/* 职责基础属性：护甲/攻城/移速 — 各兵种 TYPES 中的显式值会优先于此处 */
function roleStats(role) {
  const map = {
    shell:    { armor:12, siege:0.75, move:78 },
    spike:    { armor:8,  siege:0.92, move:82 },
    shooter:  { armor:3,  siege:1.00, move:86 },
    raider:   { armor:5,  siege:1.00, move:92 },
    wildcard: { armor:0,  siege:0.20, move:86 },
  };
  return map[role] || { armor:0, siege:1, move:86 };
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

// 局内合成强调“机制节点 + 稳定成长”，避免高星纯数值碾压克制关系。
// 星级倍率：Lv1-3快感区(×1.40), Lv4-5平稳区(×1.25), Lv6-7功能区(×1.15+技能解锁)
// 参考三国: 1-5星×1.9→6-10星×1.4→11-15星×1.3 的三段加速设计
const LEVEL_MUL = [0, 1.00, 1.40, 1.96, 2.45, 3.06, 3.52, 4.05];
const MAX_LEVEL = 7;

/* ——— 局外养成:英雄等级 Lv1-20 (设计档 §7) ——— */
const HERO_MAX = 20;
function heroFragCost(lv) {                                    // 单级碎片消耗,lv=当前等级,升到 lv+1
  if (lv < 1 || lv >= HERO_MAX) return Infinity;
  const band = Math.floor((lv - 1) / 5);
  return 8 + lv * 4 + band * 12;
}
function heroGoldCost(lv) {                                    // 单级金币消耗
  if (lv < 1 || lv >= HERO_MAX) return Infinity;
  return heroFragCost(lv) * 18 + lv * 25;
}
function heroMul(lv) {                                         // 平滑局外成长:Lv1=1.0x,Lv20=1.665x
  return 1 + (Math.min(Math.max(lv, 1), HERO_MAX) - 1) * 0.035;
}
function recommendedHeroLevel(stageId) {
  const k = Math.max(1, Math.floor(Number(stageId) || 1));
  return Math.min(HERO_MAX, 1 + Math.floor((k - 1) * 0.65));
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
const BASE_WALL_HP = 100;
const PVP_WALL_HP = 720;
const SIEGE_SLOTS_PER_LANE = 3;
const BALL_SPAWN_INTERVAL = 4.4;
const SOLDIER_SPAWN_INTERVAL = 5;
const SPAWN_COOLDOWNS = [0, 7.00, 6.00, 5.00, 4.20, 3.40, 2.70, 2.20];
const OVERFLOW_MAX = 10;
const MAX_SOLDIERS = 10; // 24→14→10:降低兵淤积,给战场留呼吸空间
const SP_MAX = 24;
const SP_PASSIVE = 5.0;

const TUNING = {
  juice: {
    start: 8,
    enemyStart: 8,
    passiveInterval: 5.0,
    enemyActionInterval: 4.0,
    actionCostCurve: [1, 1, 2, 2, 3, 3, 4, 4, 5, 6],
    urgentCost: 1,
    maxActionCost: 12,
    wallPitySteps: 4,
    wallPityGain: 2,
  },
  rewards: { baseGold: 18, goldPerStage: 8, bossGoldBonus: 24 },
  pve: {
    // 一局集中在约 1 分钟：先成型、再交战、最后出现明确破墙窗口。
    normalTargetSeconds: [35, 75],
    bossTargetSeconds: [40, 90],
    standardWinRate: [0.80, 0.95],
    bossWinRate: [0.65, 0.85],
    bossesEnabled: false,
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
  bossMechanics: {},
  stages: (function generateStages() {
    const s = [];
    const unlockAt = { 2: 'coconut_guard', 3: 'peach_medic', 4: 'blueberry_sniper', 6: 'pumpkin_roller', 8: 'kiwi_wildcard', 11: 'strawberry_knight', 14: 'avocado_brawler', 16: 'ferment_grape', 18: 'chill_juice' };
    const types = ['normal','mechanic','resource','challenge'];
    const planByType = {
      normal: [
        ['watermelon_guard','grape_archer','banana_raider'],
        ['watermelon_guard','grape_archer','banana_raider'],
        ['watermelon_guard','grape_archer','banana_raider'],
        ['watermelon_guard','mango_arbalest','banana_raider'],
      ],
      mechanic: [
        ['pineapple_lancer','pear_frost','grape_archer'],
        ['dragonfruit_warrior','melon_shaman','banana_raider'],
        ['pineapple_lancer','cherry_bomber','pear_frost'],
        ['dragonfruit_warrior','melon_shaman','olive_assassin'],
      ],
      resource: [
        ['watermelon_guard','orange_cannon','grape_archer'],
        ['watermelon_guard','orange_cannon','grape_archer'],
        ['strawberry_knight','orange_cannon','pear_frost'],
        ['avocado_brawler','orange_cannon','cherry_bomber'],
      ],
      challenge: [
        ['banana_raider','blueberry_sniper','pineapple_lancer'],
        ['olive_assassin','dragonfruit_warrior','mango_arbalest'],
        ['banana_raider','cherry_bomber','strawberry_knight'],
        ['olive_assassin','blueberry_sniper','avocado_brawler'],
      ],
    };
    const hintByType = {
      normal: '稳住前排，观察敌方主力后再决定合成方向。',
      mechanic: '控制与突击单位较多，优先保护后排输出。',
      resource: '敌方攻城压力更高，保留潮汐能及时补充防线。',
      challenge: '敌方阵容进攻性更强，尽早形成二星核心。',
    };
    for (let id = 1; id <= 20; id++) {
      const ch = Math.floor((id - 1) / 5) + 1;
      const tIdx = (id - 1) % 4;
      const type = types[tIdx];
      const opening = planByType[type][ch - 1].slice();
      s.push({
        stageId: id, chapter: ch,
        type,
        enemyLevel: +(1 + (id - 1) * 0.12).toFixed(2),
        // 回合胜方按幸存单位破墙：1 关 24 HP，之后每关线性 +2。
        enemyWallHp: 24 + (id - 1) * 2,
        enemySpawnInterval: +(6.8 - id * 0.10).toFixed(2),
        bossMechanic: '',
        reward: { gold: 18 + id * 8 },
        tutorialHint: hintByType[type],
        unlockRules: unlockAt[id] ? [unlockAt[id]] : [],
        enemyPlan: {
          opening,
          initialCount: Math.min(3, 1 + Math.floor((id - 1) / 6)),
          count: Math.min(5, 3 + Math.floor((id - 1) / 5)),
        },
      });
    }
    return s;
  })(),
};

function upgradeCost(lv) { return 10 + lv * 8; }
function getStageDefinition(k) {
  const stageId = Math.max(1, Math.floor(Number(k) || 1));
  const direct = TUNING.stages.find(stage => stage.stageId === stageId);
  if (direct) return direct;
  const chapter = Math.floor((stageId - 1) / 5) + 1;
  return {
    stageId,
    chapter,
    type: TUNING.stageTypes.normal,
    enemyLevel: +(1 + (stageId - 1) * 0.12).toFixed(2),
    enemyWallHp: 24 + (stageId - 1) * 2,
    enemySpawnInterval: Math.max(4.2, +(6.8 - stageId * 0.10).toFixed(2)),
    enemyPlan: { opening: ['watermelon_guard','grape_archer','banana_raider'], initialCount: 3, count: 5 },
    bossMechanic: '',
    reward: { gold: TUNING.rewards.baseGold + stageId * TUNING.rewards.goldPerStage },
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
  const isBossStage = !!TUNING.pve.bossesEnabled && def.type === TUNING.stageTypes.boss;
  const tunedEnemyLv = Number.isFinite(def.enemyLevel) ? def.enemyLevel : 1 + (stageId - 1) * 0.19 + (isBossStage ? 0.18 : 0);
  const fallbackWall = 24 + (stageId - 1) * 2;
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
    bossMechanic: isBossStage ? (def.bossMechanic || TUNING.bossMechanics[stageId] || '') : '',
    reward: stageReward(stageId),
    rewardInfo: def.reward || { gold: stageReward(stageId) },
    tutorialHint: def.tutorialHint || '',
    unlockRules: Array.isArray(def.unlockRules) ? def.unlockRules.slice() : [],
    desc: def.desc || (isBossStage ? `Stage ${stageId} Boss · ${def.bossMechanic || 'special'} · +${TUNING.rewards.bossGoldBonus}` : `Stage ${stageId} · Enemy Lv${tunedEnemyLv.toFixed(1)} · ${def.type || 'normal'}`),
  };
}
