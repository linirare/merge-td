/* ============================================================
   海域羁绊系统 —— 参考三国2人/3人羁绊设计
   核心规则:同羁绊的单位同时在战场上时,全员获得乘法加成
   ============================================================ */
(function installBondSystem() {
  'use strict';

  // 羁绊定义: [id, [单位id列表], 效果描述, 加成函数(soldiers, side)]
  const BONDS = [
    {
      id: 'shooter_squad',
      name: '射手编队',
      units: ['grape_archer', 'blueberry_sniper'],
      desc: '射程+10%',
      apply(sideList) {
        for (const s of sideList) s._bondRangeBonus = 0.10;
      },
    },
    {
      id: 'logistics',
      name: '铁壁后勤',
      units: ['watermelon_guard', 'peach_medic'],
      desc: '受治疗量+30%',
      apply(sideList) {
        for (const s of sideList) s._bondHealReceived = 0.30;
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
