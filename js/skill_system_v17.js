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
      if (s._v17ArmorBreak > 0) s._v17ArmorBreak = Math.max(0, s._v17ArmorBreak - dt);
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
          s.skillTimer = [0, 6.0, 5.7, 5.4, 5.0][rank] || 6.0;
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

      // 保留非默认水果的原有基础被动，避免已解锁内容空掉。
      if (s.type === 'coconut_guard' && !s._firstShield && s.battleReady) {
        s._firstShield = true;
        s.shield = Math.max(s.shield || 0, Math.round(s.maxHp * (0.30 + s.level * 0.035)));
        s.maxShield = Math.max(s.maxShield || 0, s.shield);
        state.rings.push({ x: s.x, y: s.y, r: 7, life: 0.28, maxLife: 0.28, color: '#9be7ff' });
      }

      if (s.type === 'peach_medic') {
        s.skillTimer = (s.skillTimer || 0) - dt;
        if (s.skillTimer <= 0) {
          const ally = nearestAllyOnLane(s.side, s.laneIndex);
          if (ally) {
            const heal = Math.round(6 + s.level * 4 + s.atk * 0.38);
            ally.hp = Math.min(ally.maxHp, ally.hp + heal);
            s.damageDone = (s.damageDone || 0) + heal;
            if (s.side === 'player') state.damageByType[s.type] = (state.damageByType[s.type] || 0) + heal;
            state.rings.push({ x: ally.x, y: ally.y, r: 6, life: 0.25, maxLife: 0.25, color: '#ff9fbd' });
          }
          s.skillTimer = Math.max(2.4, 5.2 - s.level * 0.18);
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

function patchSkillAttackTargetV17() {
  if (typeof attackTarget !== 'function' || attackTarget._skillV17) return;
  const oldAttack = attackTarget;

  attackTarget = function attackTargetSkillV17(s, target) {
    if (!s || !target) return oldAttack(s, target);
    ensureSkillStateV17(s);
    const rank = skillRankV17(s.level || 1);
    const color = skillColorV17(s.type);

    // 香蕉 Lv4：第一次锁到后排/辅助/攻城时短突进。Lv5 后有攻速/伤害窗口，Lv6 对后排强化，Lv7 击杀后可再突进。
    if (s.type === 'banana_raider' && rank > 0 && isBackValueTargetV17(target) && s.skillCd <= 0) {
      const dy = target.y - s.y;
      const step = Math.min(Math.abs(dy) * 0.62, 82 + rank * 14);
      s.y += Math.sign(dy) * step;
      s.x += (target.x - s.x) * 0.22;
      s.skillCd = rank >= 4 && s.skillState?.chainReady ? 0.8 : Math.max(4.8, 8.0 - rank * 0.45);
      s.skillState.chainReady = false;
      if (rank >= 2) s.skillState.bananaFury = 2.0;
      countSkillCastV17(s);
      visualSlashV17(s.x, s.y, target.x, target.y, color, rank >= 4 ? 6 : 4);
      visualSkillBurstV17(s.x, s.y, color, '', rank >= 4);
    }

    // 菠萝 Lv4：拒马，首次接触突击时击退。Lv5减速，Lv6反伤更强，Lv7同路防冲锋光环。
    if (s.type === 'pineapple_lancer' && rank > 0 && isRoleV17(target, ['rush']) && s.skillCd <= 0) {
      const dir = target.side === 'player' ? 1 : -1;
      target.y += dir * (26 + rank * 8);
      target.slowTimer = Math.max(target.slowTimer || 0, rank >= 2 ? 1.4 + rank * 0.2 : 0.6);
      target.slowMul = Math.min(target.slowMul || 1, rank >= 2 ? 0.55 : 0.72);
      const reflect = Math.round(s.atk * (rank >= 3 ? 0.48 : 0.30));
      const dealt = typeof applyFruitDamage === 'function' ? applyFruitDamage(target, reflect, { type: s.type, level: s.level, firstHit: false }) : reflect;
      if (typeof applyFruitDamage !== 'function') target.hp -= dealt;
      addSkillDamageV17(s, dealt);
      if (rank >= 3) s.counterHits++;
      s.skillCd = Math.max(4.0, 7.0 - rank * 0.5);
      countSkillCastV17(s);
      visualSlashV17(s.x, s.y - 4, target.x, target.y, color, rank >= 4 ? 7 : 5);
      visualSkillBurstV17(target.x, target.y, color, '', rank >= 3);
      if (rank >= 4) {
        for (const ally of allyGroupV17(s.side)) {
          if (ally.id !== s.id && isCombatant(ally) && ally.laneIndex === s.laneIndex && Math.abs(ally.y - s.y) < 90) {
            ally.skillState = ally.skillState || {};
            ally.skillState.antiRush = Math.max(ally.skillState.antiRush || 0, 2.4);
            state.rings.push({ x: ally.x, y: ally.y, r: 7, life: 0.22, maxLife: 0.22, color });
          }
        }
      }
      if (target.hp <= 0) killSoldier(target, s.side, s.atk, s.type);
    }

    // 临时倍率：香蕉突进窗口/后排克制；反冲锋光环只给小幅减伤思想，这里表现为反突击攻击加成。
    const oldAtk = s.atk;
    let atkMul = 1;
    if (s.type === 'banana_raider' && rank > 0) {
      if (s.skillState?.bananaFury > 0) atkMul *= rank >= 2 ? 1.20 : 1.08;
      if (rank >= 3 && isBackValueTargetV17(target)) { atkMul *= 1.25; s.counterHits++; }
    }
    if (s.skillState?.antiRush > 0 && isRoleV17(target, ['rush'])) atkMul *= 1.12;
    if (s.type === 'orange_cannon' && rank >= 3 && isRoleV17(target, ['tank','front'])) {
      target._v17ArmorBreak = Math.max(target._v17ArmorBreak || 0, 2.6 + rank * 0.35);
      target._v17ArmorBreakValue = Math.max(target._v17ArmorBreakValue || 0, 4 + rank * 2);
    }
    if (atkMul !== 1) s.atk = Math.max(1, Math.round(s.atk * atkMul));

    const before = { hp: target.hp, shield: target.shield || 0, projectiles: state.projectiles.length, attackFx: state.attackFx.length, alive: target.alive };
    const ret = oldAttack(s, target);
    const attacked = shouldAttackEventV17(s, target, before);
    s.atk = oldAtk;

    if (!attacked || rank <= 0) return ret;

    // 葡萄 Lv4：连射。Lv6对突击强化，Lv7散射三箭。
    if (s.type === 'grape_archer') {
      s.skillState.grapeShots = (s.skillState.grapeShots || 0) + 1;
      const threshold = rank >= 3 ? 3 : 4;
      if (s.skillState.grapeShots >= threshold) {
        s.skillState.grapeShots = 0;
        const enemies = enemyGroupV17(s.side).filter(e => isCombatant(e));
        let targets = [target].filter(e => isCombatant(e));
        if (rank >= 4) {
          const extra = enemies
            .filter(e => e.id !== target.id && (e.laneIndex === s.laneIndex || Math.abs(e.x - target.x) < 70))
            .sort((a,b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y))
            .slice(0, 2);
          targets = targets.concat(extra);
        }
        for (const e of targets) {
          let dmg = Math.round(s.atk * ([0,0.45,0.60,0.78,0.55][rank] || 0.45));
          const counter = isRoleV17(e, ['rush']);
          if (rank >= 3 && counter) { dmg = Math.round(dmg * 1.35); s.counterHits++; }
          state.projectiles.push({
            x: s.x, y: s.y, targetX: e.x, targetY: e.y, targetId: e.id,
            dmg, speed: 285, color, life: 1.05, side: s.side,
            counterHit: counter, ownerType: s.type, firstHit: false, v17Skill: 'grape_volley'
          });
          visualBeamV17(s.x, s.y, e.x, e.y, color, rank >= 4 ? 4 : 3);
        }
        countSkillCastV17(s);
        visualSkillBurstV17(s.x, s.y - 8, color, '', rank >= 4);
      }
    }

    // 香蕉 Lv7：击杀后一次短刷新。
    if (s.type === 'banana_raider' && rank >= 4 && before.alive && target.hp <= 0) {
      s.skillState.chainReady = true;
      s.skillCd = Math.min(s.skillCd || 0, 0.2);
      visualSkillBurstV17(target.x, target.y, color, '', true);
    }

    return ret;
  };
  attackTarget._skillV17 = true;
}

function patchSkillAttackWallV17() {
  if (typeof attackWall !== 'function' || attackWall._skillV17) return;
  const oldWall = attackWall;

  attackWall = function attackWallSkillV17(s) {
    if (!s) return oldWall(s);
    ensureSkillStateV17(s);
    const beforeEnemy = state.enemyWallHp;
    const beforePlayer = state.playerWallHp;
    const ret = oldWall(s);
    const rank = skillRankV17(s.level || 1);
    if (s.type !== 'orange_cannon' || rank <= 0 || !isCombatant(s)) return ret;

    const hitEnemyWall = s.side === 'player' && state.enemyWallHp < beforeEnemy;
    const hitPlayerWall = s.side === 'enemy' && state.playerWallHp < beforePlayer;
    if (!hitEnemyWall && !hitPlayerWall) return ret;

    s.skillState.orangeHits = (s.skillState.orangeHits || 0) + 1;
    const threshold = rank >= 3 ? 2 : 3;
    let bigCannon = false;
    if (rank >= 4 && (s.skillState.grandCannonCd || 0) <= 0) {
      bigCannon = true;
      s.skillState.grandCannonCd = 8.0;
    }
    if (s.skillState.orangeHits < threshold && !bigCannon) return ret;
    s.skillState.orangeHits = 0;

    const wall = wallDataFor(s);
    const color = skillColorV17(s.type);
    const base = Math.round((s.atk * (bigCannon ? 0.34 : 0.18) + s.level * (bigCannon ? 3.2 : 1.8)) * (s.siege || 1));
    const dmg = Math.max(2, Math.round(base * skillPowerV17(rank)));

    if (s.side === 'player') {
      state.enemyWallHp = Math.max(0, state.enemyWallHp - dmg);
      state.enemyWallDamageDealt += dmg;
      state.wallDamageByLane[s.laneIndex] = (state.wallDamageByLane[s.laneIndex] || 0) + dmg;
      trackDamage(s, dmg, true);
    } else {
      state.playerWallHp = Math.max(0, state.playerWallHp - dmg);
      state.playerWallDamageTaken += dmg;
      state.breachLane = s.laneIndex;
    }
    addSkillWallDamageV17(s, dmg);
    countSkillCastV17(s);
    visualSkillBurstV17(s.x, s.side === 'player' ? wall.wallY + wall.wallH + 4 : wall.wallY - 4, color, '', bigCannon);
    if (typeof addJuiceTextV16 === 'function') addJuiceTextV16(s.x, s.side === 'player' ? wall.wallY + wall.wallH + 22 : wall.wallY - 12, bigCannon ? '重炮!' : '爆破!', color, bigCannon ? 17 : 13, 0.52);
    state.shake = Math.max(state.shake || 0, bigCannon ? 0.75 : 0.48);

    // Lv5 起：攻城爆破对墙边同路敌人产生少量溅射；Lv6 对前排/坦克附带破甲。
    if (rank >= 2) {
      const enemies = enemyGroupV17(s.side).filter(e => isCombatant(e) && e.laneIndex === s.laneIndex && Math.abs(e.y - wall.attackY) < 74).slice(0, rank >= 4 ? 3 : 2);
      for (const e of enemies) {
        let splash = Math.round(s.atk * (bigCannon ? 0.30 : 0.18));
        if (rank >= 3 && isRoleV17(e, ['tank','front'])) {
          e._v17ArmorBreak = Math.max(e._v17ArmorBreak || 0, 3.2);
          e._v17ArmorBreakValue = Math.max(e._v17ArmorBreakValue || 0, 7);
          splash = Math.round(splash * 1.20);
          s.counterHits++;
        }
        const dealt = typeof applyFruitDamage === 'function' ? applyFruitDamage(e, splash, { type: s.type, level: s.level, firstHit: false }) : splash;
        if (typeof applyFruitDamage !== 'function') e.hp -= dealt;
        addSkillDamageV17(s, dealt);
        visualBeamV17(s.x, wall.attackY, e.x, e.y, color, 3);
        if (e.hp <= 0) killSoldier(e, s.side, s.atk, s.type);
      }
    }

    return ret;
  };
  attackWall._skillV17 = true;
}
