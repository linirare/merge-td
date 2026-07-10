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
    }
  }

  // --- slowed timer only (mul applied in movement) ---
  if (se.slowed.timer > 0) se.slowed.timer = Math.max(0, se.slowed.timer - dt);

  // --- armor break timer ---
  if (se.armorBreak.timer > 0) se.armorBreak.timer = Math.max(0, se.armorBreak.timer - dt);

  // --- invisible timer ---
  if (se.invisible.timer > 0) se.invisible.timer = Math.max(0, se.invisible.timer - dt);
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
    case 'invisible':
      se.invisible.timer = Math.max(se.invisible.timer || 0, duration);
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
  return s.statusEffects.slowed.timer > 0 ? 0.7 : 1.0;
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

/* hook A: tick all soldiers each frame in updateCombat */
(function installStatusTick() {
  if (typeof updateCombat !== 'function' || updateCombat._statusV61) return;
  const oldUpdateCombat = updateCombat;
  updateCombat = function updateCombatStatusV61() {
    if (state.phase === 'playing') {
      // migrate old fields for any soldier that hasn't been touched yet
      const all = [...state.playerSoldiers, ...state.enemySoldiers];
      for (const s of all) { migrateOldStatus(s); tickStatus(s, dt_global); }
    }
    return oldUpdateCombat();
  };
  updateCombat._statusV61 = true;
})();

/* hook B: gating frozen/stunned units in the soldier update */
(function installStatusGateSoldier() {
  if (typeof updateSoldier !== 'function' || updateSoldier._statusV61) return;
  const oldUpdateSoldier = updateSoldier;
  updateSoldier = function updateSoldierStatusV61(s, enemies) {
    if (!s.alive) return;
    if (isDisabled(s)) {
      // frozen or stunned: skip actions this frame, but still ensure positional integrity
      ensureLane(s);
      keepInsideBattlefield(s);
      return;
    }
    return oldUpdateSoldier(s, enemies);
  };
  updateSoldier._statusV61 = true;
})();

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
    // add status armor penalty before old function runs
    const penalty = statusArmorPenalty(target);
    if (penalty > 0) target.armor = Math.max(0, (target.armor || 0) - penalty);
    const result = oldApplyDamage(target, raw, source);
    // restore armor (old function already used the reduced value)
    if (penalty > 0) target.armor += penalty;

    // on-hit status application — design skills for the current roster
    // (source.firstHit is still true here; v15/skill layer clears it after applyFruitDamage)
    if (source && source.firstHit && target.alive) {
      if (source.type === 'banana_raider' && (source.level || 1) >= 3) {
        applyStatus(target, source, 'stunned', 0.5); // 香蕉 Lv3+ 首击眩晕
      } else if (source.type === 'lemon_assassin') {
        applyStatus(target, source, 'burning', 2.0); // 柠檬 首击暴击附带点燃
      }
    }
    return result;
  };
  applyFruitDamage._statusV61 = true;
})();

/* hook E: invisible blocks targeting (Phase 0 concept) */
(function installStatusInvisTarget() {
  if (typeof isCombatant !== 'function' || isCombatant._statusV61) return;
  const oldIsCombatant = isCombatant;
  isCombatant = function isCombatantV61(s) {
    if (!oldIsCombatant(s)) return false;
    if (isInvisible(s)) return false; // invisible units are not valid targets
    return true;
  };
  isCombatant._statusV61 = true;
})();
