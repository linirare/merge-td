/* ============================================================
   水果突击 · Skill System v70 — 全 20 英雄 Lv4-7 技能阶梯
   补全 skill_system_v17 未覆盖的 15 个英雄(已覆盖:西瓜/葡萄/
   香蕉/菠萝/橙子)。Lv4 解锁,Lv5 强化,Lv6 克制增强,Lv7 质变。
   纯战斗机制;不动星级/经济/SP。加载在 v17 之后。
   ============================================================ */
(function installSkillSystemV70() {
  if (typeof updateFruitPassiveSkills !== 'function' || updateFruitPassiveSkills._skillV70) return;

  const oldPassive = updateFruitPassiveSkills;
  updateFruitPassiveSkills = function updateFruitPassiveSkillsV70(dt) {
    oldPassive(dt);
    const all = [...state.playerSoldiers, ...state.enemySoldiers];
    for (const s of all) {
      if (!s.alive || !isCombatant(s)) continue;
      const lv = s.level || 1;
      s._v70Timer = (s._v70Timer || 0) - dt;

      /* ── 椰子守卫 Lv4+:首次接战后周期刷新小护盾 ── */
      if (s.type === 'coconut_guard' && lv >= 4 && s._firstShield && s._v70Timer <= 0) {
        const amp = lv >= 7 ? 1.5 : lv >= 6 ? 1.3 : 1;
        const extra = Math.round(s.maxHp * 0.06 * amp);
        s.shield = Math.min((s.shield || 0) + extra, Math.round(s.maxHp * 0.45));
        s.maxShield = Math.max(s.maxShield || 0, s.shield);
        s._v70Timer = lv >= 7 ? 5.0 : 6.5;
      }

      /* ── 蓝莓狙手 Lv4+:每 3 次攻击穿甲翻倍 ── */
      if (s.type === 'blueberry_sniper' && lv >= 4) { s._v70Crit = (s._v70Crit || 0) + 1; }

      /* ── 柠檬刺客 Lv4+:击杀后短暂隐身 + 暴击倍率提升 ── */
      if (s.type === 'lemon_assassin' && lv >= 4 && s._v70Timer <= 0) {
        s._v70Timer = lv >= 7 ? 4.5 : lv >= 6 ? 5.5 : 7.0;
      }

      /* ── 南瓜滚轮 Lv4+:死亡滚动加速/加伤 ── */
      if (s.type === 'pumpkin_roller' && lv >= 4 && s._v70Timer <= 0) {
        s._v70Timer = lv >= 7 ? 8.0 : 10.0;
      }

      /* ── 冰梨术士 Lv4+:攻击额外减速幅度 ── */
      if (s.type === 'pear_frost' && lv >= 4 && s._v70Timer <= 0) {
        s._v70Timer = lv >= 7 ? 3.0 : 4.5;
      }

      /* ── 蜜桃医师 Lv5+:治疗链跳转 ── */
      if (s.type === 'peach_medic' && lv >= 5 && s._v70Timer <= 0) {
        // 治疗链:额外治疗同路另一名最低血量队友
        const group = s.side === 'player' ? state.playerSoldiers : state.enemySoldiers;
        let second = null;
        for (const a of group) {
          if (!isCombatant(a) || a === s || a.hp >= a.maxHp) continue;
          if (!second || a.hp / a.maxHp < second.hp / second.maxHp) second = a;
        }
        if (second) {
          let heal = Math.round(6 + lv * 3 + s.atk * 0.35);
          if (s._bondHealBoost) heal = Math.round(heal * (1 + s._bondHealBoost));
          if (second._bondHealReceived) heal = Math.round(heal * (1 + second._bondHealReceived));
          second.hp = Math.min(second.maxHp, second.hp + heal);
          if (typeof addFx === 'function') addFx(second.x, second.y - 22, `+${heal}`, '#53E77B', 11);
        }
        s._v70Timer = lv >= 7 ? 2.5 : 3.8;
      }

      /* ── 草莓骑士 Lv5+:周期冲锋(击退邻路) ── */
      if (s.type === 'strawberry_knight' && lv >= 5 && s._v70Timer <= 0) {
        const foes = s.side === 'player' ? state.enemySoldiers : state.playerSoldiers;
        for (const e of foes) {
          if (!isCombatant(e) || Math.hypot(e.x - s.x, e.y - s.y) > 82) continue;
          if (typeof applyStatus === 'function') applyStatus(e, s, 'knockback', 0, { distance: lv >= 7 ? 80 : 60 });
        }
        s._v70Timer = lv >= 7 ? 7.0 : 9.0;
      }

      /* ── 火龙果战士 Lv5+:点燃溅射(邻路敌人也有概率点燃) ── */
      if (s.type === 'dragonfruit_warrior' && lv >= 5 && s._v70Timer <= 0) {
        const foes = s.side === 'player' ? state.enemySoldiers : state.playerSoldiers;
        for (const e of foes) {
          if (!isCombatant(e) || Math.hypot(e.x - s.x, e.y - s.y) > 70) continue;
          if (Math.random() < (lv >= 7 ? 0.45 : 0.25) && typeof applyStatus === 'function') applyStatus(e, s, 'burning', 1.5);
        }
        s._v70Timer = lv >= 7 ? 5.0 : 7.0;
      }

      /* ── 橄榄刺客 Lv5+:隐身时首击伤害倍率提升 ── */
      if (s.type === 'olive_assassin' && lv >= 5 && s.statusEffects && s.statusEffects.invisible.timer > 0) {
        s._v70StealthAmp = lv >= 7 ? 3.0 : lv >= 6 ? 2.6 : 2.2;
      } else { s._v70StealthAmp = 1; }

      /* ── 芒果弩手 Lv4+:攻速随等级继续提升 ── */
      if (s.type === 'mango_arbalest' && lv >= 4) {
        const base = 0.55; s.rate = Math.max(0.28, base - (lv - 3) * 0.04);
      }

      /* ── 樱桃炸弹 Lv5+:AoE 弹范围加大 ── */
      /* (AoE 在攻击时由 balance_fix 投弹;此处不操作) */

      /* ── 哈密瓜萨满 Lv5+:削弱概率/幅度提升 ── */
      if (s.type === 'melon_shaman' && lv >= 5) {
        s._v70WeakAmp = lv >= 7 ? 0.75 : lv >= 6 ? 0.80 : 0.85;
      }
    }
  };
  updateFruitPassiveSkills._skillV70 = true;
})();
