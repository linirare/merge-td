/* ============================================================
   合成攻城 · Merge Siege —— 数值模拟器
   用途：快速检查 1-20 关曲线是否离谱。不是精确战斗回放，而是基于当前配置的压力估算。
   ============================================================ */

function estimatePlayerPower(k) {
  const techAtk = 1 + averageUpgradeLevel('atk') * UPGRADE_PER_LV;
  const techHp = 1 + averageUpgradeLevel('hp') * UPGRADE_PER_LV;
  const opening = k >= 4 ? 7 : 6;
  const mergeFactor = 1 + Math.min(0.55, 0.07 * k);
  const moraleFactor = 1 + (meta.spLv || 0) * 0.025;
  const baseAtk = (TYPES.bow.atk + TYPES.sword.atk + TYPES.spear.atk + TYPES.shield.atk) / 4;
  const baseHp = (TYPES.bow.hp + TYPES.sword.hp + TYPES.spear.hp + TYPES.shield.hp) / 4;
  return opening * (baseAtk * techAtk + baseHp * 0.22 * techHp) * mergeFactor * moraleFactor;
}

function estimateEnemyPower(k) {
  const lv = generateLevel(k);
  const eLevel = Math.max(1, Math.round(lv.enemyInitLevel));
  const enemyCount = k === 1 ? 3 : k <= 3 ? 4 : 5;
  const baseAtk = (TYPES.bow.atk + TYPES.sword.atk + TYPES.spear.atk + TYPES.shield.atk) / 4;
  const baseHp = (TYPES.bow.hp + TYPES.sword.hp + TYPES.spear.hp + TYPES.shield.hp) / 4;
  const spawnPressure = BALL_SPAWN_INTERVAL / lv.enemySpawnInterval;
  const aiPressure = Math.max(0.8, 1 + (k - 4) * 0.025);
  const boss = lv.isBoss ? 1.13 : 1;
  return enemyCount * (baseAtk + baseHp * 0.22) * (LEVEL_MUL[eLevel] || 1) * spawnPressure * aiPressure * boss;
}

function averageUpgradeLevel(stat) {
  const vals = TYPE_IDS.map(t => getUpgradeLv(meta, t, stat));
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function estimateStage(k, runs = 80) {
  const lv = generateLevel(k);
  const player = estimatePlayerPower(k);
  const enemy = estimateEnemyPower(k);
  const wall = BASE_WALL_HP + getWallBonus(meta);
  const enemyWall = lv.enemyWallHp;
  const pressure = enemy / Math.max(1, player);
  const wallPressure = enemy * 0.16 / Math.max(1, wall);
  const siegeAbility = player * 0.13 / Math.max(1, enemyWall);

  let wins = 0;
  let totalTime = 0;
  let wallLeft = 0;
  let failReason = { wall: 0, dps: 0, time: 0 };

  for (let i = 0; i < runs; i++) {
    const noise = 0.86 + Math.random() * 0.28;
    const laneVariance = 0.90 + Math.random() * 0.22;
    const score = (player * noise * siegeAbility) / Math.max(1, enemy * laneVariance * 0.012 + enemyWall * 0.018);
    const survival = wall / Math.max(1, enemy * wallPressure * laneVariance);
    const winChance = clamp01(0.48 + (score - 0.52) * 0.9 + (survival - 0.42) * 0.28 - (k > 10 ? (k - 10) * 0.018 : 0));
    const win = Math.random() < winChance;
    if (win) wins++;
    else {
      if (survival < 0.35) failReason.wall++;
      else if (score < 0.48) failReason.dps++;
      else failReason.time++;
    }
    totalTime += Math.round(clamp(82 - siegeAbility * 120 + pressure * 20 + Math.random() * 18, 38, 125));
    wallLeft += win ? clamp01(0.86 - pressure * 0.45 + Math.random() * 0.18) : 0;
  }

  const mainFail = Object.entries(failReason).sort((a, b) => b[1] - a[1])[0][0];
  return {
    level: k,
    boss: lv.isBoss ? 'BOSS' : '',
    winRate: Math.round((wins / runs) * 100),
    avgTime: Math.round(totalTime / runs),
    avgWallLeft: wins ? Math.round((wallLeft / wins) * 100) : 0,
    pressure: Number(pressure.toFixed(2)),
    reward: lv.reward,
    fail: mainFail === 'wall' ? '城墙压力' : mainFail === 'dps' ? '输出不足' : '拖时过长',
  };
}

function runBalanceSim(maxLevel = 20, runs = 80) {
  const rows = [];
  for (let k = 1; k <= maxLevel; k++) rows.push(estimateStage(k, runs));
  console.table(rows);
  return rows;
}

function renderBalanceSim(maxLevel = 20, runs = 80) {
  const rows = runBalanceSim(maxLevel, runs);
  const target = document.getElementById('simResult');
  if (!target) return rows;

  const html = rows.map(r => {
    const cls = r.winRate >= 80 ? 'ok' : r.winRate >= 60 ? 'warn' : 'bad';
    return `<div class="sim-row ${cls}">
      <b>${r.level}${r.boss ? '·B' : ''}</b>
      <span>胜率 ${r.winRate}%</span>
      <span>${r.avgTime}s</span>
      <span>墙 ${r.avgWallLeft}%</span>
      <small>${r.fail}</small>
    </div>`;
  }).join('');
  target.innerHTML = `<div class="sim-head">当前科技：攻击均 ${averageUpgradeLevel('atk').toFixed(1)} / 血量均 ${averageUpgradeLevel('hp').toFixed(1)} / 城墙 ${meta.wallLv} / 士气 ${meta.spLv || 0}</div>${html}`;
  return rows;
}

window.runBalanceSim = runBalanceSim;
window.renderBalanceSim = renderBalanceSim;