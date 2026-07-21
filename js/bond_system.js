/* ============================================================
   海域羁绊系统 —— 参考三国2人/3人羁绊设计
   核心规则:同羁绊的单位同时在战场上时,全员获得乘法加成
   ============================================================ */
(function installBondSystem() {
  'use strict';

  // 羁绊定义: [id, [单位id列表], 效果描述, 加成函数(soldiers, side)]
  const BONDS = [
    {
      id: 'iron_wall',
      name: '龟蟹铁壁',
      units: ['watermelon_guard', 'coconut_guard'],
      desc: '甲壳+15%',
      apply(sideList) {
        for (const s of sideList) s.armor = Math.round((s.armor || 0) * 1.15);
      },
    },
    {
      id: 'dual_shark',
      name: '双鲨突击',
      units: ['banana_raider', 'olive_assassin'],
      desc: '首击暴击率+20%',
      apply(sideList) {
        for (const s of sideList) s._bondCritBonus = 0.20;
      },
    },
    {
      id: 'jelly_mirage',
      name: '水母幻境',
      units: ['pear_frost', 'melon_shaman', 'passion_copy'],
      desc: '控制时长+0.5s',
      apply(sideList) {
        for (const s of sideList) s._bondControlExtend = 0.5;
      },
    },
    {
      id: 'spike_line',
      name: '枪刺阵线',
      units: ['pineapple_lancer', 'dragonfruit_warrior'],
      desc: '反游骑兵伤害+20%',
      apply(sideList) {
        for (const s of sideList) s._bondAntiRaider = 0.20;
      },
    },
    {
      id: 'medic_escort',
      name: '医疗护航',
      units: ['peach_medic', 'mint_supply'],
      desc: '治疗量+25%',
      apply(sideList) {
        for (const s of sideList) s._bondHealBoost = 0.25;
      },
    },
    {
      id: 'deep_battery',
      name: '深海储能',
      units: ['honey_save', 'ferment_grape', 'chill_juice'],
      desc: 'SP恢复+15%',
      apply(sideList) {
        for (const s of sideList) s._bondSpRegen = 0.15;
      },
    },
    {
      id: 'shooter_squad',
      name: '射手编队',
      units: ['grape_archer', 'blueberry_sniper', 'mango_arbalest'],
      desc: '射程+10%',
      apply(sideList) {
        for (const s of sideList) s._bondRangeBonus = 0.10;
      },
    },
    {
      id: 'blast_team',
      name: '爆破小队',
      units: ['cherry_bomber', 'pumpkin_roller'],
      desc: '爆炸范围+20%',
      apply(sideList) {
        for (const s of sideList) s._bondAoeRange = 0.20;
      },
    },
    {
      id: 'logistics',
      name: '铁壁后勤',
      units: ['watermelon_guard', 'peach_medic', 'mint_supply'],
      desc: '受治疗量+30%',
      apply(sideList) {
        for (const s of sideList) s._bondHealReceived = 0.30;
      },
    },
    {
      id: 'blade_hunters',
      name: '快刀猎手',
      units: ['lemon_assassin', 'olive_assassin'],
      desc: '攻速×0.90',
      apply(sideList) {
        for (const s of sideList) {
          s._bondRateBoost = 0.90;
        }
      },
    },
    {
      id: 'heavy_siege',
      name: '攻城重器',
      units: ['orange_cannon', 'pumpkin_roller'],
      desc: '攻城伤害+20%',
      apply(sideList) {
        for (const s of sideList) s._bondSiegeBoost = 0.20;
      },
    },
    {
      id: 'coral_fire',
      name: '珊瑚火种',
      units: ['dragonfruit_warrior', 'ferment_grape'],
      desc: '点燃伤害+50%',
      apply(sideList) {
        for (const s of sideList) s._bondBurnBoost = 0.50;
      },
    },
  ];

  // 缓存:按单位ID索引所属羁绊
  const UNIT_BONDS = {};
  for (const bond of BONDS) {
    for (const uid of bond.units) {
      if (!UNIT_BONDS[uid]) UNIT_BONDS[uid] = [];
      UNIT_BONDS[uid].push(bond);
    }
  }

  // 检查某个阵营有哪些羁绊生效
  function getActiveBonds(sideSoldiers) {
    const present = new Set(sideSoldiers.filter(s => s && s.alive).map(s => s.type));
    const active = [];
    for (const bond of BONDS) {
      const matchCount = bond.units.filter(id => present.has(id)).length;
      if (matchCount >= 2) active.push(bond);
    }
    return active;
  }

  // 应用羁绊加成
  function applyBonds() {
    if (!state) return;
    const sides = [
      { list: state.playerSoldiers || [], key: 'player' },
      { list: state.enemySoldiers || [], key: 'enemy' },
    ];
    for (const { list } of sides) {
      const alive = list.filter(s => s && s.alive);
      const active = getActiveBonds(alive);
      for (const bond of active) {
        const bonded = alive.filter(s => bond.units.includes(s.type));
        if (bonded.length >= 2) bond.apply(bonded);
      }
    }
  }

  // hook到updateCombat
  if (typeof updateCombat === 'function' && !updateCombat._bondInstalled) {
    const oldUpdate = updateCombat;
    updateCombat = function updateCombatWithBonds() {
      applyBonds();
      oldUpdate();
    };
    updateCombat._bondInstalled = true;
  }

  // 导出给UI使用
  window.BONDS = BONDS;
  window.getActiveBonds = getActiveBonds;

})();
