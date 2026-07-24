/* ============================================================
   水果突击 · Fruit Assault —— 配置常量 / 8海洋伙伴卡组制
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

/* ——— 8 个海洋伙伴：compatV1 职责三角体系 ——— */
const TYPES = {
  /* ——— T0 (epic/传说) ——— */
  lemon_assassin:   { id:'lemon_assassin',   name:'虾刀客', icon:'🍋', color:'#ffe76a', rarity:'epic', role:'raider', combatRole:'cavalry', combatV1:true, attackMode:'melee', range:'mid', attackRange:82, preferredDistance:68, retreatDistance:56, atk:55, hp:130, atkGrowth:0.029, hpGrowth:0.021, attackInterval:1.45, rate:2.175, move:114, tags:['rush','cavalry'], desc:'中程压缩水刃，优先攻击弓兵并收割低血目标。', skill:'mantis_cross' },
  kiwi_wildcard:    { id:'kiwi_wildcard',    name:'拟态章鱼', icon:'🥝', color:'#8bd34e', rarity:'epic', role:'wildcard', combatRole:'support', combatV1:true, attackMode:'support', range:'support', attackRange:110, preferredDistance:72, retreatDistance:58, atk:1, hp:120, atkGrowth:0.022, hpGrowth:0.025, attackInterval:1.70, rate:2.55, move:74, buffPct:0.06, tags:['merge','wildcard','support'], desc:'万能合成辅助；保留上场时为主力提供拟态增益。', skill:'mimic_echo' },

  /* ——— T1 (rare/稀有) ——— */
  blueberry_sniper: { id:'blueberry_sniper', name:'射水狙手', icon:'🫐', color:'#4d7dff', rarity:'rare', role:'shooter', combatRole:'archer', combatV1:true, attackMode:'projectile', range:'long', attackRange:165, preferredDistance:132, retreatDistance:112, atk:50, hp:110, atkGrowth:0.028, hpGrowth:0.022, attackInterval:1.50, rate:2.25, move:70, tags:['back','archer'], desc:'超远程单发水针，优先压制枪兵。', skill:'piercing_tide' },
  banana_raider:    { id:'banana_raider',    name:'旗鱼骑手', icon:'🍌', color:'#ffd447', rarity:'rare', role:'raider', combatRole:'cavalry', combatV1:true, attackMode:'melee', range:'mid', attackRange:92, preferredDistance:74, retreatDistance:60, atk:45, hp:170, atkGrowth:0.026, hpGrowth:0.024, attackInterval:1.15, rate:1.725, move:122, tags:['rush','cavalry'], desc:'中程侧翼掠射，优先弓兵和辅助。', skill:'tidal_skirmish' },
  pineapple_lancer: { id:'pineapple_lancer', name:'角鲸枪兵', icon:'🍍', color:'#ffb337', rarity:'rare', role:'spike', combatRole:'lancer', combatV1:true, attackMode:'melee', range:'mid', attackRange:112, preferredDistance:92, retreatDistance:76, atk:40, hp:200, atkGrowth:0.025, hpGrowth:0.026, attackInterval:1.15, rate:1.725, move:82, tags:['front','lancer'], desc:'中前排枪波，优先拦截骑兵。', skill:'narwhal_line' },
  grape_archer:     { id:'grape_archer',     name:'乌贼射手', icon:'🍇', color:'#9b5cff', rarity:'rare', role:'shooter', combatRole:'archer', combatV1:true, attackMode:'projectile', range:'far', attackRange:140, preferredDistance:108, retreatDistance:90, atk:35, hp:140, atkGrowth:0.024, hpGrowth:0.026, attackInterval:0.90, rate:1.35, move:74, tags:['back','archer'], desc:'快速墨弹连射，持续锁定同一目标逐步增伤。', skill:'ink_fan' },

  /* ——— T2 (normal/普通) ——— */
  watermelon_guard: { id:'watermelon_guard', name:'龟甲枪卫', icon:'🍉', color:'#34c96b', rarity:'normal', role:'shell', combatRole:'lancer', combatV1:true, attackMode:'melee', range:'mid', attackRange:98, preferredDistance:84, retreatDistance:70, atk:30, hp:250, atkGrowth:0.022, hpGrowth:0.029, attackInterval:1.05, rate:1.575, move:72, tags:['front','lancer','shield'], desc:'稳定枪线防守，每四次攻击获得薄护盾。', skill:'shell_guard' },
  peach_medic:      { id:'peach_medic',      name:'海星医者', icon:'🍑', color:'#ff9fbd', rarity:'normal', role:'wildcard', combatRole:'support', combatV1:true, attackMode:'support', range:'support', attackRange:120, preferredDistance:76, retreatDistance:60, atk:1, heal:20, hp:150, atkGrowth:0.027, hpGrowth:0.025, attackInterval:1.45, rate:2.175, move:68, tags:['support','heal'], desc:'治疗最低生命友军；无治疗目标时发射1点弱水泡。', skill:'star_recovery' },
};

/* ——— 技能效果分类：6 类，用于 VFX 调度 ——— */
const SKILL_TYPE_MAP = {
  /* self-buff: 自身增益（盾/冲锋/免疫） */
  watermelon_guard:'self-buff',
  /* single-projectile: 单体弹道 / 近战攻击附带效果 */
  grape_archer:'single-projectile', blueberry_sniper:'single-projectile',
  banana_raider:'single-projectile', lemon_assassin:'single-projectile',
  pineapple_lancer:'single-projectile',
  /* special: 治疗 / SP 经济 / 合成辅助 */
  peach_medic:'special', kiwi_wildcard:'special',
};
const SKILL_VFX = {
  'self-buff':         { ringColor:'#53e77b', ringRadius:8,  sparkCount:5,  label:'强化' },
  'single-projectile': { ringColor:null,       ringRadius:0,  sparkCount:3,  label:null },
  'line-aoe':          { ringColor:'#ff6b4a',  ringRadius:14, sparkCount:10, label:'范围' },
  special:             { ringColor:'#b076ff',  ringRadius:6,  sparkCount:4,  label:null },
};

if (typeof applyWorldThemeToTypes === 'function') applyWorldThemeToTypes(TYPES);

const ALL_TYPE_IDS = Object.keys(TYPES);
const UNIT_POOL = ['blueberry_sniper','grape_archer','pineapple_lancer','watermelon_guard','banana_raider','lemon_assassin','peach_medic','kiwi_wildcard'];
const OLD_DEFAULT_DECK = ['watermelon_guard','grape_archer','banana_raider','pineapple_lancer','peach_medic'];
const DEFAULT_DECK = ['watermelon_guard','grape_archer','banana_raider','pineapple_lancer','peach_medic'];
const STARTER_BUILD_DECK = DEFAULT_DECK.slice();
const DECK_SIZE = 5;
const TYPE_IDS = UNIT_POOL;
const BASIC_UNLOCKED = DEFAULT_DECK.slice();
const PROGRESS_UNLOCKS = [
  { level: 2, ids: ['blueberry_sniper'] },
  { level: 4, ids: ['lemon_assassin'] },
  { level: 6, ids: ['kiwi_wildcard'] },
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
    || sig === ['grape_archer','banana_raider','pineapple_lancer','watermelon_guard'].join('|');
}
function shouldAutoStarterBuildDeck(deck, unlocked) {
  const sig = deckSignature(deck);
  return Array.isArray(unlocked) && unlocked.includes('blueberry_sniper')
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
const ROLE_COUNTER_DMG = 1.30;
const ROLE_SOFT_COUNTER_DMG = 1.00;
const ROLE_WEAK_DMG = 0.80;
const COUNTER_DMG = ROLE_COUNTER_DMG;
function combatRoleOfType(type) {
  const t = TYPES[type] || {};
  if (t.combatRole) return t.combatRole;
  if (t.tags?.includes('support') || t.role === 'wildcard') return 'support';
  if (t.role === 'shooter') return 'archer';
  if (t.role === 'raider') return 'cavalry';
  return 'lancer';
}
// 三角克制：骑兵→弓兵→枪兵→骑兵；辅助保持中性。
const ROLE_COUNTER_MATRIX = {
  archer:  { archer:1.0, lancer:1.30, cavalry:0.80, support:1.0 },
  lancer:  { archer:0.80, lancer:1.0, cavalry:1.30, support:1.0 },
  cavalry: { archer:1.30, lancer:0.80, cavalry:1.0, support:1.0 },
  support: { archer:1.0, lancer:1.0, cavalry:1.0, support:1.0 },
};
function roleCounterMultiplier(sourceType, targetType) {
  const sr = combatRoleOfType(sourceType);
  const tr = combatRoleOfType(targetType);
  if (!sr || !tr || sr === 'support' || tr === 'support') return 1;
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
  const roleMap = { cavalry:'#FFD24A', archer:'#B076FF', lancer:'#FFB547', support:'#8FE0A0' };
  return roleMap[combatRoleOfType(sourceType)] || '#F5C242';
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
const LEVEL_MUL = [0, 1.00, 1.35, 1.75, 2.15, 2.55, 2.95, 3.40];
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
function heroMul(lv) {
  return 1 + (Math.min(Math.max(lv, 1), HERO_MAX) - 1) * 0.025;
}
function heroMulForType(typeId, lv, stat) {
  const cfg = TYPES[normalizeTypeId(typeId)] || {};
  const growth = stat === 'hp' ? cfg.hpGrowth : cfg.atkGrowth;
  return 1 + (Math.min(Math.max(lv, 1), HERO_MAX) - 1) * (Number.isFinite(growth) ? growth : 0.025);
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
    sum += Math.round(TYPES[id].atk * heroMulForType(id, lv, 'atk') + TYPES[id].hp * heroMulForType(id, lv, 'hp'));
  }
  return sum;
}
// PvE wall durability is stage-linear and symmetric. The player receives only
// the explicit meta wall bonus; combat stats never modify breach damage.
function getPlayerWallMax(stageId, meta) {
  return 80 + stageId * 25 + (meta.wallLv || 0) * 15;
}
function getEnemyWallMax(stageId) {
  return 60 + stageId * 20;
}
const PVP_WALL_HP = 720;
const SIEGE_SLOTS_PER_LANE = 3;
const BALL_SPAWN_INTERVAL = 4.4;
const SOLDIER_SPAWN_INTERVAL = 5;
const SPAWN_COOLDOWNS = [0, 7.00, 6.00, 5.00, 4.20, 3.40, 2.70, 2.20];
const OVERFLOW_MAX = 10;
const MAX_SOLDIERS = 8;
const SP_MAX = 40;
const SP_PASSIVE = 3.0;

const TUNING = {
  juice: {
    start: 8,
    enemyStart: 8,
    passiveInterval: 5.0,
    enemyActionInterval: 4.0,
    actionCostCurve: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6],
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
    const unlockAt = { 2: 'blueberry_sniper', 4: 'lemon_assassin', 6: 'kiwi_wildcard' };
    const types = ['normal','mechanic','resource','challenge'];
    const planByType = {
      normal: [
        ['watermelon_guard','grape_archer','banana_raider'],
        ['watermelon_guard','grape_archer','banana_raider'],
        ['watermelon_guard','blueberry_sniper','banana_raider'],
        ['pineapple_lancer','grape_archer','banana_raider'],
      ],
      mechanic: [
        ['pineapple_lancer','grape_archer','banana_raider'],
        ['pineapple_lancer','blueberry_sniper','lemon_assassin'],
        ['watermelon_guard','grape_archer','lemon_assassin'],
        ['pineapple_lancer','blueberry_sniper','banana_raider'],
      ],
      resource: [
        ['watermelon_guard','peach_medic','grape_archer'],
        ['pineapple_lancer','peach_medic','banana_raider'],
        ['watermelon_guard','kiwi_wildcard','blueberry_sniper'],
        ['pineapple_lancer','peach_medic','lemon_assassin'],
      ],
      challenge: [
        ['banana_raider','blueberry_sniper','pineapple_lancer'],
        ['lemon_assassin','grape_archer','watermelon_guard'],
        ['banana_raider','blueberry_sniper','watermelon_guard'],
        ['lemon_assassin','blueberry_sniper','pineapple_lancer'],
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
        // 回合胜方按幸存单位破墙：每个幸存单位固定造成1点伤害。
        enemyWallHp: 10 + id,
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
    enemyWallHp: 10 + stageId,
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
const WALL_PER_LV = 2;

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
  const fallbackWall = 10 + stageId;
  return {
    id: stageId,
    stageId,
    chapter: def.chapter || Math.floor((stageId - 1) / 5) + 1,
    type: def.type || (isBossStage ? TUNING.stageTypes.boss : TUNING.stageTypes.normal),
    isBoss: isBossStage,
    enemyInitLevel: tunedEnemyLv,
    enemyWallHp: Math.max(11, Math.round(def.enemyWallHp || fallbackWall)),
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
