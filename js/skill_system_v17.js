/* ============================================================
   水果突击 · Skill System v17
   默认5水果技能落地：Lv4解锁技能，Lv5增强，Lv6强化克制，Lv7质变。
   只扩展战斗机制；不提高基础星级倍率，不恢复合成/自动出兵扣果汁。
   Loaded after juice_absorb_v16.js.
   ============================================================ */

(function installSkillSystemV17() {
  patchSkillStatsV17();
  patchFruitPassiveSkillsV17();
  patchFruitDamageV17();
  patchSkillAttackTargetV17();
  patchSkillAttackWallV17();
})();

const SKILL_SYSTEM_BUILD = 'skill-system-v17-default-five';
const SKILL_IDS_V17 = ['watermelon_guard','grape_archer','banana_raider','pineapple_lancer','orange_cannon'];
const SKILL_NAME_V17 = {
  watermelon_guard: '果盾壁垒',
  grape_archer: '葡萄连射',
  banana_raider: '香蕉突进',
  pineapple_lancer: '拒马枪阵',
  orange_cannon: '重炮破城',
};
const SKILL_COLOR_V17 = {
  watermelon_guard: '#53e77b',
  grape_archer: '#b076ff',
  banana_raider: '#ffd24a',
  pineapple_lancer: '#ffb547',
  orange_cannon: '#ff9a35',
};

function skillRankV17(level) {
  if ((level || 1) < 4) return 0;
  if (level === 4) return 1;
  if (level === 5) return 2;
  if (level === 6) return 3;
  return 4;
}
function hasSkillV17(s) {
  return !!(s && SKILL_IDS_V17.includes(s.type) && skillRankV17(s.level) > 0);
}
function roleOfV17(type) { return TYPES[type]?.role || ''; }
function unitRoleV17(s) { return roleOfV17(s?.type); }
function isRoleV17(s, roles) { return roles.includes(unitRoleV17(s)); }
function enemyGroupV17(side) { return side === 'player' ? state.enemySoldiers : state.playerSoldiers; }
function allyGroupV17(side) { return side === 'player' ? state.playerSoldiers : state.enemySoldiers; }
function skillColorV17(type) { return SKILL_COLOR_V17[type] || TYPES[type]?.color || THEME.gold; }
function skillPowerV17(rank) { return [0, 1.00, 1.15, 1.30, 1.50][Math.max(0, Math.min(4, rank || 0))] || 1; }
function ensureSkillStateV17(s) {
  if (!s) return s;
  const rank = skillRankV17(s.level || 1);
  s.skillRank = rank;
  if (!s.skillState) s.skillState = {};
  s.skillCd = Math.max(0, s.skillCd || 0);
  s.skillCasts = s.skillCasts || 0;
  s.skillDamage = s.skillDamage || 0;
  s.skillHeal = s.skillHeal || 0;
  s.skillShield = s.skillShield || 0;
  s.skillWallDamage = s.skillWallDamage || 0;
  s.counterHits = s.counterHits || 0;
  return s;
}
function countSkillCastV17(s) {
  ensureSkillStateV17(s);
  s.skillCasts++;
}
function addSkillDamageV17(s, dmg) {
  ensureSkillStateV17(s);
  s.skillDamage += Math.max(0, Math.round(dmg || 0));
  if (s.side === 'player') state.damageByType[s.type] = (state.damageByType[s.type] || 0) + Math.max(0, Math.round(dmg || 0));
}
function addSkillWallDamageV17(s, dmg) {
  ensureSkillStateV17(s);
  s.skillWallDamage += Math.max(0, Math.round(dmg || 0));
}
function addSkillShieldV17(s, amount) {
  ensureSkillStateV17(s);
  s.skillShield += Math.max(0, Math.round(amount || 0));
}
function isBackValueTargetV17(target) {
  return isRoleV17(target, ['back','support','siege','control']);
}
function nearbyEnemiesV17(s, radius = 64, sameLane = true) {
  return enemyGroupV17(s.side)
    .filter(e => isCombatant(e) && (!sameLane || e.laneIndex === s.laneIndex))
    .map(e => ({ e, d: Math.hypot(e.x - s.x, e.y - s.y) }))
    .filter(o => o.d <= radius)
    .sort((a,b) => a.d - b.d)
    .map(o => o.e);
}
function closestAllyV17(s, radius = 72) {
  return allyGroupV17(s.side)
    .filter(a => a.id !== s.id && isCombatant(a) && a.laneIndex === s.laneIndex)
    .map(a => ({ a, d: Math.hypot(a.x - s.x, a.y - s.y) }))
    .filter(o => o.d <= radius)
    .sort((a,b) => a.d - b.d)[0]?.a || null;
}
function visualSkillBurstV17(x, y, color, label = '', strong = false) {
  if (typeof addJuiceShockV16 === 'function') addJuiceShockV16(x, y, color, strong ? 42 : 26, strong ? 0.40 : 0.28, strong ? 4 : 3);
  else state.rings.push({ x, y, r: strong ? 13 : 8, life: 0.28, maxLife: 0.28, color });
  if (typeof addJuiceSparkV16 === 'function') addJuiceSparkV16(x, y, color, strong ? 12 : 7, strong ? 72 : 48, strong ? 3.2 : 2.4);
  if (label && typeof addJuiceTextV16 === 'function') addJuiceTextV16(x, y - 28, label, color, strong ? 16 : 13, 0.50);
  else if (label) addFx(x, y - 24, label, color, strong ? 14 : 12);
}
function visualBeamV17(x1, y1, x2, y2, color, width = 4) {
  if (typeof addJuiceBeamV16 === 'function') addJuiceBeamV16(x1, y1, x2, y2, color, 0.16, width);
  else state.attackFx.push({ x1, y1, x2, y2, life: 0.20, maxLife: 0.20 });
}
function visualSlashV17(x1, y1, x2, y2, color, width = 4) {
  if (typeof addJuiceSlashV16 === 'function') addJuiceSlashV16(x1, y1, x2, y2, color, 0.16, width);
  else state.attackFx.push({ x1, y1, x2, y2, life: 0.20, maxLife: 0.20 });
}

function patchSkillStatsV17() {
  if (typeof applyTroopTierStats === 'function' && !applyTroopTierStats._skillV17) {
    const oldApply = applyTroopTierStats;
    applyTroopTierStats = function applyTroopTierStatsSkillV17(s) {
      oldApply(s);
      ensureSkillStateV17(s);
      if (hasSkillV17(s) && !s._skillAwakenedShown && s.side === 'player') {
        s._skillAwakenedShown = true;
        visualSkillBurstV17(s.x || W / 2, s.y || LAYOUT.playerWallY, skillColorV17(s.type), '觉醒', s.level >= 7);
      }
      return s;
    };
    applyTroopTierStats._skillV17 = true;
  }

  if (typeof spawnSoldierFromBall === 'function' && !spawnSoldierFromBall._skillV17) {
    const oldSpawn = spawnSoldierFromBall;
    spawnSoldierFromBall = function spawnSoldierSkillV17(ball, r, c, side, forced = false) {
      const s = oldSpawn(ball, r, c, side, forced);
      if (s) ensureSkillStateV17(s);
      return s;
    };
    spawnSoldierFromBall._skillV17 = true;
  }
}

function patchFruitPassiveSkillsV17() {
  if (typeof updateFruitPassiveSkills !== 'function' || updateFruitPassiveSkills._skillV17) return;

  updateFruitPassiveSkills = function updateFruitPassiveSkillsV17(dt) {
    const all = [...state.playerSoldiers, ...state.enemySoldiers];
    for (const s of all) {
      if (!s.alive) continue;
      ensureSkillStateV17(s);
      if (s.slowTimer > 0) s.slowTimer = Math.max(0, s.slowTimer - dt);
      if (s._v17ArmorBreak > 0) { s._v17ArmorBreak = Math.max(0, s._v17ArmorBreak - dt); if (s._v17ArmorBreak <= 0) s._v17ArmorBreakValue = 0; }
      if (s.skillCd > 0) s.skillCd = Math.max(0, s.skillCd - dt);
      if (s.skillState?.bananaFury > 0) s.skillState.bananaFury = Math.max(0, s.skillState.bananaFury - dt);
      if (s.skillState?.grandCannonCd > 0) s.skillState.grandCannonCd = Math.max(0, s.skillState.grandCannonCd - dt);
      if (!isCombatant(s)) continue;

      // 西瓜 Lv4：果盾壁垒。Lv6 遇突击压力时护盾更强；Lv7 给同路友军小护盾。
      if (s.type === 'watermelon_guard' && hasSkillV17(s)) {
        s.skillTimer = (s.skillTimer || 0) - dt;
        if (s.skillTimer <= 0) {
          const rank = skillRankV17(s.level);
          const nearRush = enemyGroupV17(s.side).some(e => isCombatant(e) && e.laneIndex === s.laneIndex && isRoleV17(e, ['rush']) && Math.abs(e.y - s.y) < 100);
          const pct = [0, 0.12, 0.16, 0.18, 0.20][rank] || 0.12;
          const counterMul = rank >= 3 && nearRush ? 1.35 : 1;
          const shield = Math.round(s.maxHp * pct * counterMul);
          const cap = Math.round(s.maxHp * (rank >= 4 ? 0.42 : 0.34));
          s.shield = Math.min(cap, (s.shield || 0) + shield);
          s.maxShield = Math.max(s.maxShield || 0, cap);
          const cdReduce = (typeof starSkillCdReduce === 'function' && typeof window !== 'undefined' && window.shell) ? (() => { const s = window.shell; const maxLv = Math.max(...UNIT_POOL.map(id => s?.fruitLv?.[id] || 1), 1); const st = typeof heroStarTier === 'function' ? heroStarTier(maxLv) : 1; return starSkillCdReduce(st); })() : 0;
          s.skillTimer = Math.max(2.5, ([0, 6.0, 5.7, 5.4, 5.0][rank] || 6.0) - cdReduce);
          addSkillShieldV17(s, shield);
          countSkillCastV17(s);
          visualSkillBurstV17(s.x, s.y - 6, '#53e77b', '', rank >= 4);

          if (rank >= 4) {
            const ally = closestAllyV17(s, 82);
            if (ally) {
              const allyShield = Math.round(s.maxHp * 0.06);
              ally.shield = Math.min(Math.round(ally.maxHp * 0.24), (ally.shield || 0) + allyShield);
              ally.maxShield = Math.max(ally.maxShield || 0, Math.round(ally.maxHp * 0.24));
              addSkillShieldV17(s, allyShield);
              state.rings.push({ x: ally.x, y: ally.y, r: 8, life: 0.26, maxLife: 0.26, color:'#53e77b' });
            }
          }
        }
      }

      // 修#10:椰子首盾/蜜桃治疗恢复 fruit_mechanics 原版数值(v17 REPLACE 时被悄悄削弱 ~20-25%;
      //        叠加已修的 #3(去掉每帧2倍调用)后更弱 → 改回原值,达到与 WRAP 等效但无双重衰减风险)。
      if (s.type === 'coconut_guard' && !s._firstShield && s.battleReady) {
        s._firstShield = true;
        s.shield = Math.max(s.shield || 0, Math.round(s.maxHp * (0.38 + s.level * 0.04)));
        s.maxShield = Math.max(s.maxShield || 0, s.shield);
        if (typeof addFx === 'function') addFx(s.x, s.y - 26, '椰壳护盾', '#9be7ff', 11);
        state.rings.push({ x: s.x, y: s.y, r: 7, life: 0.28, maxLife: 0.28, color: '#9be7ff' });
      }

      if (s.type === 'peach_medic') {
        s.skillTimer = (s.skillTimer || 0) - dt;
        if (s.skillTimer <= 0) {
          const ally = nearestAllyOnLane(s.side, s.laneIndex);
          if (ally) {
            const heal = Math.round(8 + s.level * 5 + s.atk * 0.55);
            ally.hp = Math.min(ally.maxHp, ally.hp + heal);
            s.damageDone = (s.damageDone || 0) + heal;
            if (s.side === 'player') state.damageByType[s.type] = (state.damageByType[s.type] || 0) + heal;
            state.rings.push({ x: ally.x, y: ally.y, r: 6, life: 0.25, maxLife: 0.25, color: '#ff9fbd' });
          }
          s.skillTimer = Math.max(1.8, 4.4 - s.level * 0.22);
        }
      }
    }
  };
  updateFruitPassiveSkills._skillV17 = true;
}

function patchFruitDamageV17() {
  if (typeof applyFruitDamage !== 'function' || applyFruitDamage._skillV17) return;
  const oldApply = applyFruitDamage;
  applyFruitDamage = function applyFruitDamageSkillV17(target, raw, source) {
    const oldArmor = target.armor || 0;
    if ((target._v17ArmorBreak || 0) > 0) target.armor = Math.max(0, oldArmor - (target._v17ArmorBreakValue || 4));
    const dealt = oldApply(target, raw, source);
    target.armor = oldArmor;
    return dealt;
  };
  applyFruitDamage._skillV17 = true;
}

function shouldAttackEventV17(s, target, before) {
  return !!(
    target &&
    before &&
    (state.projectiles.length > before.projectiles || state.attackFx.length > before.attackFx || target.hp < before.hp || (target.shield || 0) < before.shield)
  );
}

function patchSkillAttackTargetV17() { attackTarget._skillV17 = true; }

function patchSkillAttackWallV17() { attackWall._skillV17 = true; }
