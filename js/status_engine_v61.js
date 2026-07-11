/* ============================================================
   水果突击 · Status Effect Engine v61 (Phase 3)
   ------------------------------------------------------------
   统一 7 种状态效果(fruit-assault-final.md §5):
    冰冻(frozen)、减速(slowed)、点燃(burning)、破甲(armorBreak)、
    眩晕(stunned)、隐身(invisible)、击退(knockback,瞬时)

   数据结构 s.statusEffects:{ ... } -- 统一在 createSoldier 无侵入懒初始化。
   叠层规则: 冰冻 > 眩晕 > 其他;击退是瞬时力,不入持续状态。

   4 个消费端:
   - 战斗: 点燃 tick 扣血, 破甲影响伤害公式
   - 移动: 冰冻 speed=0, 减速×0.7, 击退脉冲
   - 索敌: 隐身单位不被锁敌(Phase 0 预留的 isLockable 概念这里落地)
   - 渲染: 预留 FX 入口供 stickman 读取(Phase 1B)
   ============================================================ */

const STATUS = {
  frozen:     { label:'冰冻', priority:1 },
  stunned:    { label:'眩晕', priority:2 },
  slowed:     { label:'减速', priority:3 },
  burning:    { label:'点燃', priority:3 },
  armorBreak: { label:'破甲', priority:3 },
  invisible:  { label:'隐身', priority:3 },
  provoke:    { label:'嘲讽', priority:2 }, // 坦克拉仇恨:强制附近敌人锁定自己
  // knockback is instantaneous; no persistent entry
};

/* ---- lazy init: add s.statusEffects on first access ---- */
function ensureStatusEffects(s) {
  if (!s || s.statusEffects) return;
  s.statusEffects = {
    frozen:     { timer: 0 },
    burning:    { timer: 0, tickTimer: 0 },
    slowed:     { timer: 0 },
    stunned:    { timer: 0 },
    armorBreak: { timer: 0, value: 0 },
    invisible:  { timer: 0 },
    provoke:    { timer: 0 },                // 坦克嘲讽
    weakened:   { timer: 0, atkFull: 0 }, // 哈密瓜:降低目标 ATK
  };
}

/* ---- tick one soldier (called once/frame, before updateSoldier) ---- */
function tickStatus(s, dt) {
  ensureStatusEffects(s);
  const se = s.statusEffects;

  // --- frozen: highest priority, overrides everything ---
  if (se.frozen.timer > 0) {
    se.frozen.timer = Math.max(0, se.frozen.timer - dt);
    return; // frozen blocks all other processing this frame
  }

  // --- stunned ---
  if (se.stunned.timer > 0) {
    se.stunned.timer = Math.max(0, se.stunned.timer - dt);
    // stunned units skip their update but status still ticks
  }

  // --- burning damage ---
  if (se.burning.timer > 0) {
    se.burning.timer = Math.max(0, se.burning.timer - dt);
    se.burning.tickTimer -= dt;
    if (se.burning.tickTimer <= 0) {
      se.burning.tickTimer = 1.0; // 1 tick per second = 3 damage per tick
      const burnDmg = 3;
      s.hp -= burnDmg;
      s.hitFlash = Math.max(s.hitFlash || 0, 0.18);
      if (typeof addFx === 'function') addFx(s.x, s.y - 20, `🔥${burnDmg}`, '#ff6b3a', 10);
      // 点燃(DOT)也要能击杀:掉到 0 血立即结算死亡,否则单位卡在 hp<=0 仍存活
      if (s.hp <= 0 && s.alive && typeof killSoldier === 'function') {
        killSoldier(s, s.side === 'enemy' ? 'player' : 'enemy', burnDmg, 'burn');
        se.burning.timer = 0; // 已击杀,防后续帧重入
      }
    }
  }

  // --- slowed timer only (mul applied in movement) ---
  if (se.slowed.timer > 0) se.slowed.timer = Math.max(0, se.slowed.timer - dt);

  // --- armor break timer ---
  if (se.armorBreak.timer > 0) se.armorBreak.timer = Math.max(0, se.armorBreak.timer - dt);

  // --- weakened timer ---
  if (se.weakened.timer > 0) {
    se.weakened.timer = Math.max(0, se.weakened.timer - dt);
    if (se.weakened.timer <= 0 && se.weakened.atkFull > 0) {
      s.atk = se.weakened.atkFull;
      se.weakened.atkFull = 0;
    }
  }

  // --- invisible timer ---
  if (se.invisible.timer > 0) se.invisible.timer = Math.max(0, se.invisible.timer - dt);
  // --- provoke timer ---
  if (se.provoke.timer > 0) se.provoke.timer = Math.max(0, se.provoke.timer - dt);
}

/* ---- apply a status to a target soldier (from a source soldier) ---- */
function applyStatus(target, source, type, duration, opts = {}) {
  if (!target || !target.alive) return;
  ensureStatusEffects(target);
  const se = target.statusEffects;
  const srcType = (source && source.type) || '';
  const srcLevel = (source && source.level) || 1;

  switch (type) {
    case 'frozen':
      se.frozen.timer = Math.max(se.frozen.timer || 0, duration);
      break;
    case 'slowed':
      se.slowed.timer = Math.max(se.slowed.timer || 0, duration);
      se.slowed.mul = opts.mul || se.slowed.mul || 0.7; // 新施加默认 0.7,已有值保留(迁移时可能设 0.52)
      break;
    case 'burning':
      se.burning.timer = Math.max(se.burning.timer || 0, duration);
      se.burning.tickTimer = 0; // immediate first tick
      break;
    case 'armorBreak':
      se.armorBreak.timer = Math.max(se.armorBreak.timer || 0, duration);
      se.armorBreak.value = Math.max(se.armorBreak.value || 0, opts.value || 5);
      break;
    case 'stunned':
      se.stunned.timer = Math.max(se.stunned.timer || 0, duration);
      break;
    case 'weakened':
      if (se.weakened.timer <= 0) se.weakened.atkFull = target.atk; // snapshot
      se.weakened.timer = Math.max(se.weakened.timer || 0, duration);
      target.atk = Math.round((se.weakened.atkFull || target.atk) * 0.85);
      break;
    case 'invisible':
      se.invisible.timer = Math.max(se.invisible.timer || 0, (typeof window !== 'undefined' && window.__pvpMode ? duration * 0.67 : duration)); // PvP:3s→2s
      break;
    case 'provoke':
      se.provoke.timer = Math.max(se.provoke.timer || 0, duration);
      break;
    case 'knockback':
      // instantaneous: push target backward along lane (inline bounds)
      if (source) {
        const dir = target.side === 'player' ? 1 : -1;
        const top = (typeof fieldTop === 'function') ? fieldTop() : (LAYOUT ? LAYOUT.fieldY + 12 : 50);
        const bot = (typeof fieldBottom === 'function') ? fieldBottom() : (LAYOUT ? LAYOUT.fieldY + LAYOUT.fieldH - 12 : 400);
        const clampFn = typeof clamp === 'function' ? clamp : ((v,lo,hi) => Math.max(lo, Math.min(hi, v)));
        target.y = clampFn(target.y + dir * (opts.distance || 60), top, bot);
        if (typeof addFx === 'function') addFx(target.x, target.y, '💥', '#fff', 14);
      }
      break;
    default: break;
  }
}

/* ---- read helpers ---- */
function isFrozen(s) { ensureStatusEffects(s); return s.statusEffects.frozen.timer > 0; }
function isStunned(s) { ensureStatusEffects(s); return s.statusEffects.stunned.timer > 0; }
function isInvisible(s) { ensureStatusEffects(s); return s.statusEffects.invisible.timer > 0; }
function isDisabled(s) { return isFrozen(s) || isStunned(s); }
function statusSlowMul(s) {
  ensureStatusEffects(s);
  if (s.statusEffects.slowed.timer <= 0) return 1.0;
  return s.statusEffects.slowed.mul || 0.7; // 迁移保留原倍率(冰梨0.52),新施加用默认0.7
}
function statusArmorPenalty(s) {
  ensureStatusEffects(s);
  return s.statusEffects.armorBreak.timer > 0 ? (s.statusEffects.armorBreak.value || 5) : 0;
}

/* ---- shim: migrate old slowTimer/_v17ArmorBreak references ---- */
function migrateOldStatus(s) {
  if (!s) return;
  ensureStatusEffects(s);
  if ((s.slowTimer || 0) > 0 && s.statusEffects.slowed.timer <= 0) {
    s.statusEffects.slowed.timer = s.slowTimer;
    s.statusEffects.slowed.mul = s.slowMul || 0.52; // 保留原减速倍率(冰梨 0.52),不弱化成默认 0.7
    s.slowTimer = 0;
  }
  if ((s._v17ArmorBreak || 0) > 0 && s.statusEffects.armorBreak.timer <= 0) {
    s.statusEffects.armorBreak.timer = s._v17ArmorBreak;
    s.statusEffects.armorBreak.value = Math.max(s.statusEffects.armorBreak.value || 0, s._v17ArmorBreakValue || 4);
    s._v17ArmorBreak = 0; s._v17ArmorBreakValue = 0;
  }
}

/* ================================================================
   Integration hooks: installed in order by index.html load.
   ================================================================ */

/* hook B: updateSoldier frozen/stun gate merged into combat.js — layer removed */

/* hook C: slow in movement (fruitMoveSpeed uses old slowTimer — shim it) */
(function installStatusSlowMove() {
  if (typeof fruitMoveSpeed !== 'function' || fruitMoveSpeed._statusV61) return;
  const oldFruitMoveSpeed = fruitMoveSpeed;
  fruitMoveSpeed = function fruitMoveSpeedV61(s, base) {
    migrateOldStatus(s);
    const oldMul = (s.slowTimer > 0 ? (s.slowMul || 0.55) : 1);
    const newMul = statusSlowMul(s);
    // take the more restrictive multiplier (lower = slower)
    const effectiveMul = Math.min(oldMul, newMul);
    const t = TYPES[s.type] || {};
    const move = t.move || 86;
    return base * (move / 92) * effectiveMul;
  };
  fruitMoveSpeed._statusV61 = true;
})();

/* hook D: armor break in damage formula */
(function installStatusArmorHook() {
  if (typeof applyFruitDamage !== 'function' || applyFruitDamage._statusV61) return;
  const oldApplyDamage = applyFruitDamage;
  applyFruitDamage = function applyFruitDamageV61(target, raw, source) {
    migrateOldStatus(target);
    // 牛油果力士 Lv4+:受击 30% 概率免疫本次伤害(状态效果仍可施加)
    const immune = target.type === 'avocado_brawler' && (target.level || 1) >= 4 && Math.random() < 0.3;
    // add status armor penalty before old function runs
    // 合并旧 v17 破甲值,取大值不叠加(避免双重破甲)
    const oldV17Val = target._v17ArmorBreakValue || 0;
    const penalty = Math.max(statusArmorPenalty(target), oldV17Val);
    if (oldV17Val > 0) target._v17ArmorBreakValue = 0; // 已并入 penalty,防止内层再减
    if (penalty > 0) target.armor = Math.max(0, (target.armor || 0) - penalty);
    const result = immune ? 0 : oldApplyDamage(target, raw, source);
    if (immune && typeof addFx === 'function') addFx(target.x, target.y - 18, '免疫', '#dfe7ff', 11);
    // restore armor (old function already used the reduced value)
    if (penalty > 0) target.armor += penalty;

    if (source && target.alive) {
      const lv = source.level || 1;
      // 每次攻击都触发的
      if (source.type === 'dragonfruit_warrior' && lv >= 4) applyStatus(target, source, 'burning', 2.0);          // 火龙果:点燃
      else if (source.type === 'melon_shaman' && Math.random() < 0.5) applyStatus(target, source, 'weakened', 2.0); // 哈密瓜:削弱ATK
      else if (source.type === 'blueberry_sniper') applyStatus(target, source, 'armorBreak', 2.5, { value: 5 });  // 蓝莓:穿甲(削 5 护甲)
      else if (source.type === 'pear_frost' && lv >= 6) applyStatus(target, source, 'frozen', 1.2);               // 冰梨 Lv6:减速升级为冰冻
      // 仅首击触发的
      if (source.firstHit) {
        if (source.type === 'banana_raider' && lv >= 3) applyStatus(target, source, 'stunned', 0.5);              // 香蕉:首击眩晕
        else if (source.type === 'lemon_assassin') applyStatus(target, source, 'burning', 2.0);                   // 柠檬:首击点燃
        else if (source.type === 'strawberry_knight' && lv >= 4) applyStatus(target, source, 'knockback', 0, { distance: 60 }); // 草莓:冲锋击退
      }
    }
    return result;
  };
  applyFruitDamage._statusV61 = true;
})();

/* hook E: invisible blocks being targeted (only targeting, NOT the unit's own agency).
   Wrap canSeeTarget (used by findTarget/sticky) — invisible enemies are unseeable.
   isCombatant is intentionally NOT wrapped, so an invisible unit still acts/attacks. */
(function installStatusInvisTarget() {
  if (typeof canSeeTarget !== 'function' || canSeeTarget._statusV61) return;
  const oldCanSee = canSeeTarget;
  canSeeTarget = function canSeeTargetV61(s, e) {
    if (isInvisible(e)) return false;
    return oldCanSee(s, e);
  };
  canSeeTarget._statusV61 = true;
})();
