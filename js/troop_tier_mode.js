/* ============================================================
   水果突击 · Troop Tier Mode v2
   兵阶模式：小兵 → 大兵 → 精英兵 → 高级兵 → 将领。
   加大出兵CD，星级主要影响兵的形态和质量，不再主要拼出兵速度。
   ============================================================ */

(function installTroopTierMode() {
  patchTierSpawn();
  patchTierDraw();
  patchTierToast();
})();

const TROOP_TIER_BUILD = 'troop-tier-v2';
const TIER_LABEL = { small:'小兵', large:'大兵', elite:'精英兵', advanced:'高级兵', legendary:'将领' };
const TIER_COLOR = { small:'#eaffc3', large:'#9be7ff', elite:'#ffc93c', advanced:'#ff9fbd', legendary:'#fff176' };
const TIER_SCALE = { small:1.00, large:1.16, elite:1.32, advanced:1.46, legendary:1.62 };
const TIER_NAME = {
  watermelon_guard:['西瓜小盾兵','西瓜大盾兵','西瓜精英卫','西瓜统领','西瓜将军'],
  coconut_guard:['椰子小卫兵','椰子重卫','椰壳精英','椰壳统领','椰子堡垒'],
  grape_archer:['葡萄小射手','葡萄连弩兵','葡萄精英射手','葡萄狙击手','葡萄神射手'],
  blueberry_sniper:['蓝莓枪手','蓝莓狙击兵','蓝莓精英狙手','蓝莓鹰眼','蓝莓神狙'],
  banana_raider:['香蕉小兵','香蕉突击兵','香蕉精英先锋','香蕉影袭兵','香蕉队长'],
  lemon_assassin:['柠檬小兵','柠檬快刀兵','柠檬精英','柠檬影刃','柠檬队长'],
  pineapple_lancer:['菠萝小枪兵','菠萝长枪兵','菠萝精英枪卫','菠萝拒马卫','菠萝枪王'],
  orange_cannon:['橙子小炮','橙子重炮','橙子精英炮车','橙子攻城车','橙子巨炮'],
  pumpkin_roller:['南瓜滚兵','南瓜滚轮','南瓜爆破车','南瓜攻城车','南瓜毁城车'],
  pear_frost:['冰梨小术士','冰梨法师','冰梨精英法师','冰梨寒霜师','冰梨大贤者'],
  peach_medic:['蜜桃小医师','蜜桃医护兵','蜜桃精英医师','蜜桃祭司','蜜桃圣医'],
};

function tierKey(level) {
  if (level <= 2) return 'small';
  if (level <= 4) return 'large';
  if (level === 5) return 'elite';
  if (level === 6) return 'advanced';
  return 'legendary';
}
function tierIndex(level) {
  if (level <= 2) return 0;
  if (level <= 4) return 1;
  if (level === 5) return 2;
  if (level === 6) return 3;
  return 4;
}
function tierName(type, level) {
  return TIER_NAME[type]?.[tierIndex(level)] || `${TYPES[type]?.name || '水果'}${TIER_LABEL[tierKey(level)] || '兵'}`;
}
function tierDeployCd(type, level) {
  const role = TYPES[type]?.role;
  let cd = 12.0;
  if (role === 'rush') cd = 10.6;
  else if (role === 'back' || role === 'front') cd = 11.8;
  else if (role === 'tank') cd = 12.8;
  else if (role === 'control') cd = 13.2;
  else if (role === 'support') cd = 14.5;
  else if (role === 'siege') cd = 15.3;
  const discount = [0,0,0.03,0.06,0.08,0.11,0.14,0.17][Math.max(1, Math.min(MAX_LEVEL, level))] || 0;
  return Math.max(8.4, cd * (1 - discount));
}
function tierRoleSlot(type) {
  const role = TYPES[type]?.role;
  if (role === 'tank' || role === 'front' || role === 'rush') return 'front';
  if (role === 'siege') return 'siege';
  if (role === 'support' || role === 'control' || role === 'back') return 'back';
  return 'engine';
}
function tierTroops(side, lane = null) {
  const group = side === 'player' ? state.playerSoldiers : state.enemySoldiers;
  return group.filter(s => s.alive && s.squadMode && (lane == null || s.laneIndex === lane));
}
function findReinforceTarget(side, type, lane) {
  const same = tierTroops(side, lane).filter(s => s.type === type);
  if (same.length) return same.sort((a,b) => b.level - a.level)[0];
  const slot = tierRoleSlot(type);
  return tierTroops(side, lane).filter(s => s.squadSlot === slot && (s.reinforceStacks || 0) < 3).sort((a,b) => b.level - a.level)[0] || null;
}
function tierLaneLimit() { return (state.currentLevel || 1) <= 3 ? 2 : 3; }
function tierGlobalLimit() { return (state.currentLevel || 1) <= 8 ? 10 : 12; }
function applyTroopTierStats(s) {
  const type = s.type;
  const level = s.level || 1;
  const base = TYPES[type] || TYPES[DEFAULT_DECK[0]];
  const role = base.role;
  const tier = tierKey(level);
  const hpMul = { small:1, large:1.28, elite:1.62, advanced:1.92, legendary:2.35 }[tier] || 1;
  const atkMul = { small:1, large:1.22, elite:1.58, advanced:1.88, legendary:2.28 }[tier] || 1;
  const reinforceMul = 1 + (s.reinforceStacks || 0) * (role === 'tank' || role === 'front' ? 0.34 : role === 'siege' ? 0.25 : 0.28);
  const oldRatio = s.maxHp > 0 ? clamp01(s.hp / s.maxHp) : 1;
  const mul = LEVEL_MUL[level] || 1;
  s.maxHp = Math.round(base.hp * mul * hpMul * reinforceMul * (role === 'tank' ? 1.15 : 1));
  s.hp = Math.max(1, Math.round(s.maxHp * oldRatio));
  s.atk = Math.round(base.atk * mul * atkMul * reinforceMul);
  s.siege = base.siege || 1;
  s.armor = base.armor || 0;
  s.troopTier = tier;
  s.troopName = tierName(type, level);
  s.troopScale = TIER_SCALE[tier] || 1;
  s.squadLabel = s.troopName;
}
function reinforceTroop(target, ball, center) {
  const oldLevel = target.level || 1;
  target.level = Math.max(target.level || 1, ball.level || 1);
  target.reinforceStacks = Math.min(3, (target.reinforceStacks || 0) + 1);
  applyTroopTierStats(target);
  const heal = Math.round(target.maxHp * (0.18 + target.reinforceStacks * 0.04));
  target.hp = Math.min(target.maxHp, target.hp + heal);
  target.protected = false;
  target.battleReady = true;
  target._tierBoost = 1.8;
  const color = TIER_COLOR[target.troopTier] || THEME.gold;
  addFx(target.x, target.y - 30, target.level > oldLevel ? `${target.troopName} 进阶!` : `${target.troopName} 补强`, color, 12);
  addFx(target.x, target.y - 44, `+${heal}`, THEME.safe, 10);
  state.rings.push({ x: target.x, y: target.y, r: 10 + target.level, life: 0.28, maxLife: 0.28, color });
  return target;
}

function patchTierSpawn() {
  if (typeof spawnSoldierFromBall !== 'function' || spawnSoldierFromBall._troopTierPatched) return;
  const prevSpawn = spawnSoldierFromBall;
  spawnSoldierFromBall = function tierSpawn(ball, r, c, side, forced = false) {
    if (!ball) return null;
    ball.type = normalizeTypeId(ball.type);
    const role = TYPES[ball.type]?.role;
    const center = slotCenter(r, c, side === 'enemy');
    const lane = c;
    if (role === 'merge') {
      ball.spawnTimer = Math.max(ball.spawnTimer || 0, tierDeployCd(ball.type, ball.level));
      if (side === 'player') state.sp = Math.min(getSpMax(meta), state.sp + 1);
      if (side === 'player') addFx(center.x, center.y - 22, '合成引擎不出兵', '#8bd34e', 10);
      return null;
    }
    const laneList = tierTroops(side, lane);
    const target = findReinforceTarget(side, ball.type, lane);
    if (target || laneList.length >= tierLaneLimit()) {
      ball.spawnTimer = Math.max(ball.spawnTimer || 0, tierDeployCd(ball.type, ball.level));
      if (target) return reinforceTroop(target, ball, center);
      if (side === 'player') state.sp = Math.min(getSpMax(meta), state.sp + 1);
      if (side === 'player') addFx(center.x, center.y - 22, '本路位置已满', THEME.info, 10);
      return null;
    }
    const group = side === 'player' ? state.playerSoldiers : state.enemySoldiers;
    if (group.filter(s => s.alive).length >= tierGlobalLimit() && !forced) {
      ball.spawnTimer = Math.max(ball.spawnTimer || 0, tierDeployCd(ball.type, ball.level));
      if (side === 'player') state.sp = Math.min(getSpMax(meta), state.sp + 1);
      return null;
    }
    const s = prevSpawn(ball, r, c, side, forced);
    if (!s) return null;
    s.squadMode = true;
    s.squadCount = 1;
    s.squadSlot = tierRoleSlot(ball.type);
    s.reinforceStacks = 0;
    applyTroopTierStats(s);
    s.hp = s.maxHp;
    ball.spawnTimer = Math.max(ball.spawnTimer || 0, tierDeployCd(ball.type, ball.level));
    addFx(center.x, center.y - 24, `派遣 ${s.troopName}`, TIER_COLOR[s.troopTier] || THEME.gold, 12);
    return s;
  };
  spawnSoldierFromBall._troopTierPatched = true;
}

function patchTierDraw() {
  if (typeof drawSoldier !== 'function' || drawSoldier._troopTierPatched) return;
  const prevDraw = drawSoldier;
  drawSoldier = function tierDraw(s) {
    prevDraw(s);
    if (!s.squadMode || !s.alive) return;
    const tier = s.troopTier || tierKey(s.level);
    const color = TIER_COLOR[tier] || THEME.gold;
    const name = s.troopName || tierName(s.type, s.level);
    const fy = LAYOUT.fieldY, fh = LAYOUT.fieldH;
    const depth = 0.78 + 0.25 * ((s.y - fy) / fh);
    const r = (12 + s.level * 1.9) * (s.troopScale || 1) * depth;
    ctx.save();
    ctx.textAlign = 'center';
    const w = Math.min(94, Math.max(54, name.length * 10 + 14));
    ctx.fillStyle = 'rgba(0,0,0,0.58)';
    roundRect(s.x - w / 2, s.y + r + 5, w, 16, 8);
    ctx.fill();
    ctx.font = '900 10px sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(name, s.x, s.y + r + 17);
    ctx.font = 'bold 9px sans-serif';
    ctx.strokeStyle = 'rgba(0,0,0,0.50)';
    ctx.lineWidth = 3;
    ctx.strokeText(TIER_LABEL[tier] || '兵', s.x, s.y - r - 13);
    ctx.fillStyle = color;
    ctx.fillText(TIER_LABEL[tier] || '兵', s.x, s.y - r - 13);
    if ((s.reinforceStacks || 0) > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(s.x + r * 0.74, s.y - r * 0.62, 8, 0, Math.PI * 2); ctx.fill();
      ctx.font = '900 9px sans-serif'; ctx.fillStyle = '#2c8d3f'; ctx.fillText(`+${s.reinforceStacks}`, s.x + r * 0.74, s.y - r * 0.59);
    }
    ctx.restore();
  };
  drawSoldier._troopTierPatched = true;
}

function patchTierToast() {
  if (typeof update !== 'function' || update._troopTierPatched) return;
  const prevUpdate = update;
  update = function tierUpdate(dt) {
    prevUpdate(dt);
    if (state.phase !== 'playing') return;
    for (const s of [...state.playerSoldiers, ...state.enemySoldiers]) if (s._tierBoost > 0) s._tierBoost = Math.max(0, s._tierBoost - dt);
    if (!state._troopTierToast && state.time > 1.2) {
      state._troopTierToast = true;
      addFx(W / 2, LAYOUT.fieldY + 30, '兵阶模式：低频出兵，高星派出更高级兵种', THEME.gold, 12);
    }
  };
  update._troopTierPatched = true;
}
