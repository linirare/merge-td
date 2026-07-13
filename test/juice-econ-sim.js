/* ============================================================
   水果突击 · 果汁经济合成深度仿真测试
   ------------------------------------------------------------
   对照 baseline / 方案 A / A1 / C1 / C2，对比：
   - 破墙时间  wallBreakTime
   - 最大合成等级 maxMergeLv（棋盘上最高 ball.level）
   - 最大场上兵数 maxUnits
   - 胜率 winRate / 城墙剩余 wallLeft%
   - 峰值果汁 peakJuice
   ============================================================ */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const SCENARIO_ID = (process.argv[2] || 'all');

const SCENARIOS = {
  baseline: {
    label: '基线(当前代码)',
    wallLvMul: null,
    enemyDmgMul: null,
    passiveInterval: null,
  },
  A: {
    label: 'A Lv1=0.35 Lv2=0.55 Lv3=0.75 Lv4=1.0',
    wallLvMul: { 1:0.35, 2:0.55, 3:0.75, 4:1.0, 5:1.1, 6:1.2, 7:1.2 },
    enemyDmgMul: null,
    passiveInterval: null,
  },
  A1: {
    label: 'A1 Lv1=0.50 Lv2=0.70 Lv3=0.85 Lv4=1.0',
    wallLvMul: { 1:0.50, 2:0.70, 3:0.85, 4:1.0, 5:1.1, 6:1.2, 7:1.2 },
    enemyDmgMul: null,
    passiveInterval: null,
  },
  A2: {
    label: 'A2 Lv1=0.60 Lv2=0.75 Lv3=0.90 Lv4=1.0',
    wallLvMul: { 1:0.60, 2:0.75, 3:0.90, 4:1.0, 5:1.1, 6:1.2, 7:1.2 },
    enemyDmgMul: null,
    passiveInterval: null,
  },
  C1: {
    label: 'C1 A + 敌攻我墙×0.85',
    wallLvMul: { 1:0.35, 2:0.55, 3:0.75, 4:1.0, 5:1.1, 6:1.2, 7:1.2 },
    enemyDmgMul: 0.85,
    passiveInterval: null,
  },
  C2: {
    label: 'C2 A + 敌攻×0.90 + 被动1SP/4s',
    wallLvMul: { 1:0.35, 2:0.55, 3:0.75, 4:1.0, 5:1.1, 6:1.2, 7:1.2 },
    enemyDmgMul: 0.90,
    passiveInterval: 4.0,
  },
  E: {
    label: 'E 大招:敌墙×1.8 Lv1=0.25 Lv2=0.50 Lv3=1.0 Lv4=1.5 被1SP/3s 费8',
    wallLvMul: { 1:0.25, 2:0.50, 3:1.0, 4:1.5, 5:2.0, 6:2.5, 7:3.0 },
    enemyDmgMul: 0.85,
    passiveInterval: 3.0,
    enemyWallHpMul: 1.8,
    maxActionCost: 8,
  },
  E1: {
    label: 'E1 中招:敌墙×1.5 Lv1=0.30 Lv2=0.60 Lv3=1.0 Lv4=1.3 被1SP/3.5s 费10',
    wallLvMul: { 1:0.30, 2:0.60, 3:1.0, 4:1.3, 5:1.6, 6:2.0, 7:2.5 },
    enemyDmgMul: 0.90,
    passiveInterval: 3.5,
    enemyWallHpMul: 1.5,
    maxActionCost: 10,
  },
};

const FILES = [
  'js/config.js',
  'js/layout_v56.js',
  'js/state.js',
  'js/board.js',
  'js/combat.js',
  'js/ai.js',
  'js/fruit_mechanics.js',
  'js/balance_fix_v15.js',
  'js/lane_block_fix.js',
  'js/skill_system_v17.js',
  'js/combat_pacing_v19.js',
  'js/status_engine_v61.js',
  'js/boss_v63.js',
  'js/dynamic_difficulty_v64.js',
];

/* ---- helpers (same as stage-real-sim) ---- */
function buildSandbox() {
  let rng = 0x51A2B3C4 >>> 0;
  const seeded = function () {
    rng |= 0; rng = (rng + 0x6D2B79F5) | 0;
    let t = Math.imul(rng ^ (rng >>> 15), 1 | rng);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const realMath = Math;
  return {
    console, JSON,
    Math: new Proxy(realMath, { get: (t, p) => (p === 'random' ? seeded : t[p]) }),
    __reseed__: (n) => { rng = (n >>> 0); },
    Date: { now: () => 0 },
    performance: { now: () => 0 },
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    document: {
      getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
      addEventListener: () => {}, createElement: () => ({
        getContext: () => ({}), style: {}, classList: { add() {}, remove() {}, toggle() {} },
      }),
    },
    addFx: () => {}, playSfx: () => {}, onGameOver: () => {},
    saveMeta: () => {}, refreshGold: () => {}, saveAll: () => {},
    resetJuiceEconomyForLevel: () => {}, syncProgressUnlocks: () => {},
    dt_global: 1 / 60,
    window: null, globalThis: null,
    innerWidth: 430, innerHeight: 900, devicePixelRatio: 1,
  };
}

/* ---- build VM code with scenario patches ---- */
function buildCode(scenario) {
  let parts = [];
  for (const f of FILES) {
    let content = fs.readFileSync(path.join(ROOT, f), 'utf8');

    // patch combat.js: attackWall player-only level-based wall damage
    if (f === 'js/combat.js' && scenario.wallLvMul) {
      const mulJson = JSON.stringify(scenario.wallLvMul);
      // Insert level multiplier after siegeMul calc in player branch
      content = content.replace(
        'let dmg = Math.max(1, base);',
        `let dmg = Math.max(1, base);
      if (s.side === 'player') dmg = Math.max(1, Math.round(dmg * (${mulJson}[s.level] || 0.5)));`
      );
    }

    // patch combat_pacing_v19.js: enemy dmg to player wall
    if (f === 'js/combat_pacing_v19.js' && scenario.enemyDmgMul) {
      // The enemy wall damage is applied in combat.js, not combat_pacing.
      // combat_pacing reduces wall HP with enemyMul/playerMul.
      // The actual damage formula is in combat.js.
      // We need to patch combat.js enemy damage branch instead.
      // Already handled below for combat.js.
    }

    // patch combat_pacing_v19.js: enemy/player wall HP mul
    if (f === 'js/combat_pacing_v19.js' && scenario.enemyWallHpMul) {
      content = content.replace(
        'state.enemyWallMax = Math.max(24, Math.round(state.enemyWallMax * enemyMul));',
        `state.enemyWallMax = Math.max(24, Math.round(state.enemyWallMax * enemyMul * ${scenario.enemyWallHpMul}));`
      );
    }

    parts.push(`\n/* ==== ${f} ==== */\n` + content);
  }

  // Patch TUNING.juice.maxActionCost if specified
  if (scenario.maxActionCost) {
    // We need to patch config.js which contains the TUNING.juice definition
    // TUNING.juice is in config.js; patch it by replacing the maxActionCost value
    let combined = parts.join('');
    combined = combined.replace(
      /maxActionCost:\s*\d+/,
      `maxActionCost:${scenario.maxActionCost}`
    );
    parts = [combined];
  }

  // Patch combat.js enemy damage branch for enemyDmgMul
  if (scenario.enemyDmgMul) {
    // Find the enemy damage line in combat.js (already loaded in parts)
    // The line is: `Math.round((s.level * 1.25 + s.atk * 0.075) * siegeMul)`
    // We need to patch it from the combined code
    let combined = parts.join('');
    // Patch the enemy wall damage formula (the one for enemy side)
    combined = combined.replace(
      /let dmg = Math\.max\(1, base\);\s+if \(s\.side === 'player'\)/,
      (match) => {
        // Add enemy multiplier before the 'if player' check
        return `let dmg = Math.max(1, base);
      if (s.side === 'enemy') dmg = Math.max(1, Math.round(dmg * ${scenario.enemyDmgMul}));
      if (s.side === 'player')`;
      }
    );
    // Because the content might have been modified by wallLvMul already, handle both cases
    // Actually, let me handle this differently - patch the original base calc
    parts = [combined];
  }

  return parts.join('');
}

/* ---- DRIVER (based on stage-real-sim but with mergeLevel tracking) ---- */
const DRIVER = `;(function () {
  const STRATEGIES = [
    { id: 'no_action', label: 'No Op', botEvery: 999, summon: 0, urgentEvery: 999 },
    { id: 'light', label: 'Light', botEvery: 1.0, summon: 1, urgentEvery: 7.0 },
    { id: 'standard', label: 'Standard', botEvery: 0.45, summon: 2, urgentEvery: 3.5 },
  ];
  const DT = 1 / 30;
  const MAX_FRAMES = 65 * 60;   // 65s cap
  const RUNS = 3;                // 3 runs per stage per strategy
  const MAX_STAGES = 15;         // test stages 1-15

  function spawnSoldierFromBall(ball, r, c, side, forced) {
    const group = side === 'player' ? state.playerSoldiers : state.enemySoldiers;
    if (group.filter(s => s.alive).length >= MAX_SOLDIERS) return null;
    const center = slotCenter(r, c, side === 'enemy');
    const soldier = side === 'player'
      ? createSoldier(ball.type, ball.level, getAtkMul(meta, ball.type), getHpMul(meta, ball.type))
      : createSoldier(ball.type, ball.level);
    soldier.x = center.x + (Math.random() - 0.5) * 8;
    soldier.y = center.y;
    soldier.side = side;
    soldier.laneIndex = c;
    soldier.laneX = BOARD_X + c * (CELL + GAP) + CELL / 2 + (Math.random() - 0.5) * 10;
    soldier.mode = 'deploy';
    soldier.target = null;
    soldier.battleReady = false;
    soldier.protected = true;
    soldier._gateFx = false;
    group.push(soldier);
    return soldier;
  }

  function botMerge() {
    const seen = {};
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const b = state.playerSlots[r][c];
      if (!b || b.level >= MAX_LEVEL) continue;
      const key = b.type + '#' + b.level;
      if (seen[key]) {
        const [pr, pc] = seen[key];
        tryMerge(state.playerSlots, r, c, pr, pc);
        delete seen[key];
      } else {
        seen[key] = [r, c];
      }
    }
  }

  const botMergeOnce = botMerge;
  botMerge = function botMergeMultiPass() {
    for (let i = 0; i < 4; i++) botMergeOnce();
  };

  function botActionCost() {
    const cfg = TUNING && TUNING.juice ? TUNING.juice : {};
    state.summonCostCounter = Math.max(1, Number(state.summonCostCounter || 1));
    return Math.min(Number(cfg.maxActionCost || 12), state.summonCostCounter);
  }

  function botPickType(strategy) {
    const k = state.currentLevel || 1;
    const boss = k % 5 === 0;
    const pattern = boss
      ? ['orange_cannon', 'watermelon_guard', 'grape_archer', 'pineapple_lancer', 'banana_raider']
      : ['watermelon_guard', 'grape_archer', 'orange_cannon', 'banana_raider', 'pineapple_lancer'];
    const deck = activeDeck();
    const preferred = pattern.filter(id => deck.includes(id));
    const pool = preferred.length ? preferred : deck;
    return pool[(state.summonCount || 0) % pool.length] || randomType(deck);
  }

  function botSummonLevel(strategy) {
    if (strategy.id !== 'standard') return 1;
    const k = state.currentLevel || 1;
    if (k >= 16) return 3;
    if (k >= 8) return 2;
    return 1;
  }

  function botSummon(limit, strategy) {
    let placed = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (placed >= limit) return;
      const cost = botActionCost();
      if (state.sp < cost) return;
      if (state.playerSlots[r][c]) continue;
      state.sp -= cost;
      state.summonCostCounter = cost + 1;
      state.summonCount = (state.summonCount || 0) + 1;
      const type = botPickType(strategy);
      const ball = createBall(type, botSummonLevel(strategy));
      ball.spawnTimer = Math.max(ball.spawnTimer, 2.2);
      state.playerSlots[r][c] = ball;
      placed++;
    }
  }

  function botUrgentDispatch() {
    let best = null;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const ball = state.playerSlots[r][c];
      if (!ball || ball.level < 2) continue;
      if (!best || ball.level > best.ball.level) best = { r, c, ball };
    }
    if (!best) return;
    const cost = botActionCost();
    if (state.sp < cost) return;
    state.sp -= cost;
    state.summonCostCounter = cost + 1;
    spawnSoldierFromBall(best.ball, best.r, best.c, 'player', true);
    best.ball.spawnTimer = Math.max(best.ball.spawnTimer || 0, 1.2);
  }

  function prepareMetaForStrategy(k, strategy) {
    meta = createMeta();
    meta.highestLevel = k;
    meta.gold = 999999;
    meta.deck = DEFAULT_DECK.slice();
    meta.unlocked = typeof progressUnlocked === 'function' ? progressUnlocked(meta) : DEFAULT_DECK.slice();
    const growth = strategy.id === 'standard'
      ? Math.min(10, Math.floor((k + 1) / 2))
      : strategy.id === 'light'
        ? Math.min(5, Math.floor((k + 2) / 4))
        : 0;
    meta.wallLv = strategy.id === 'standard' ? Math.min(WALL_UPGRADE_MAX, Math.floor(k / 3)) : (strategy.id === 'light' ? Math.min(WALL_UPGRADE_MAX, Math.floor(k / 6)) : 0);
    meta.spLv = strategy.id === 'standard' ? Math.min(SP_UPGRADE_MAX, Math.floor(k / 4)) : (strategy.id === 'light' ? Math.min(SP_UPGRADE_MAX, Math.floor(k / 8)) : 0);
    for (const id of DEFAULT_DECK) {
      meta.upgrades[id + '_atk'] = growth;
      meta.upgrades[id + '_hp'] = Math.max(0, growth - 1);
      meta.shardsTotal[id] = strategy.id === 'standard' ? k * 12 : (strategy.id === 'light' ? k * 5 : 0);
    }
  }

  function stepFrame(scenario) {
    const dt = DT;
    dt_global = dt;
    if (state.phase !== 'playing') return;
    state.time += dt;

    // Override passive interval if scenario specifies
    const juiceCfg = TUNING && TUNING.juice ? TUNING.juice : {};
    const passiveInterval = scenario && scenario.passiveInterval
      ? scenario.passiveInterval
      : (Number(juiceCfg.passiveInterval || SP_PASSIVE || 5));
    if (!state._spTimer) state._spTimer = 0;
    state._spTimer += dt;
    while (state._spTimer >= passiveInterval) {
      state._spTimer -= passiveInterval;
      state.sp = (state.sp || 0) + 1;
    }

    state.enemyBallTimer += dt;
    const ebi = (state.levelConfig && state.levelConfig.enemySpawnInterval) || BALL_SPAWN_INTERVAL;
    if (state.enemyBallTimer >= ebi) {
      state.enemyBallTimer -= ebi;
      const added = autoSpawnBall(state.enemySlots, 1, true);
      if (!added) state.enemyOverflow++;
      if (state.enemyOverflow > 0) {
        const empties = emptySlots(state.enemySlots);
        let placed = 0;
        while (state.enemyOverflow > 0 && placed < empties.length) {
          const [r, c] = empties[placed];
          state.enemySlots[r][c] = createBall(randomEnemyType(), 1);
          state.enemyOverflow--; placed++;
        }
      }
    }

    updateAI(dt);

    const groups = [
      { slots: state.playerSlots, side: 'player' },
      { slots: state.enemySlots, side: 'enemy' },
    ];
    for (const grp of groups) {
      const soldiers = grp.side === 'player' ? state.playerSoldiers : state.enemySoldiers;
      if (MAX_SOLDIERS - soldiers.filter(s => s.alive).length <= 0) continue;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const ball = grp.slots[r][c];
        if (!ball) continue;
        ball.spawnTimer -= dt;
        if (ball.spawnTimer <= 0) {
          ball.spawnTimer += (SPAWN_COOLDOWNS[ball.level] || SPAWN_COOLDOWNS[1]);
          spawnSoldierFromBall(ball, r, c, grp.side);
        }
      }
    }

    updateCombat();
  }

  function boardMaxLevel(slots) {
    let maxLv = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const b = slots[r][c];
      if (b && b.level > maxLv) maxLv = b.level;
    }
    return maxLv;
  }

  function runStage(k, strategy, seed, scenario) {
    if (typeof __reseed__ === 'function') __reseed__(seed >>> 0);
    prepareMetaForStrategy(k, strategy);
    if (typeof resetAI === 'function') resetAI();
    if (typeof resetJuiceEconomyForLevel === 'function') resetJuiceEconomyForLevel(k);
    initLevel(k);
    state.phase = 'playing';
    state.sp = Number((TUNING && TUNING.juice && TUNING.juice.start) || state.sp || 8);
    state.summonCostCounter = 1;
    let botTimer = 0;
    let urgentTimer = 0;
    let peakJuice = state.sp || 0;
    let maxUnits = 0;
    let maxMergeLv = 1;  // starting level is 1
    const wallStartHp = state.enemyWallMax;
    let wallBreakTime = null;

    for (let f = 0; f < MAX_FRAMES; f++) {
      botTimer += DT;
      urgentTimer += DT;
      if (botTimer >= strategy.botEvery) {
        botTimer -= strategy.botEvery;
        botMerge();
        if (strategy.summon > 0) botSummon(strategy.summon, strategy);
      }
      if (urgentTimer >= strategy.urgentEvery) {
        urgentTimer -= strategy.urgentEvery;
        botUrgentDispatch();
      }
      stepFrame(scenario);
      peakJuice = Math.max(peakJuice, state.sp || 0);
      maxUnits = Math.max(maxUnits, (state.playerSoldiers || []).filter(s => s && s.alive).length);
      const curMergeLv = boardMaxLevel(state.playerSlots);
      if (curMergeLv > maxMergeLv) maxMergeLv = curMergeLv;

      if (state.enemyWallHp <= 0) {
        wallBreakTime = state.time;
        return { win: 1, time: state.time, wall: state.playerWallHp / state.playerWallMax, peakJuice, maxUnits, maxMergeLv, wallBreakTime };
      }
      if (state.playerWallHp <= 0) {
        wallBreakTime = state.time;
        return { win: 0, time: state.time, wall: 0, peakJuice, maxUnits, maxMergeLv, wallBreakTime };
      }
    }
    return { win: 0, time: state.time, wall: state.playerWallHp / state.playerWallMax, timeout: 1, peakJuice, maxUnits, maxMergeLv, wallBreakTime: null };
  }

  const thisScenario = globalThis.__SCENARIO__;
  const rows = [];
  for (let k = 1; k <= MAX_STAGES; k++) {
    const def = getStageDefinition(k);
    for (let sIdx = 0; sIdx < STRATEGIES.length; sIdx++) {
      const strategy = STRATEGIES[sIdx];
      let wins = 0, timeouts = 0, tSum = 0, wallSum = 0;
      let peakJuiceSum = 0, maxUnitsSum = 0, maxMergeLvSum = 0, wallBreakSum = 0;
      let wallBreakCount = 0;
      for (let i = 0; i < RUNS; i++) {
        const seed = (0x51A2B3C4 ^ (k * 100003 + sIdx * 9973 + i * 101)) >>> 0;
        const r = runStage(k, strategy, seed, thisScenario);
        if (r.win) { wins++; tSum += r.time; wallSum += r.wall; }
        if (r.timeout) timeouts++;
        peakJuiceSum += r.peakJuice || 0;
        maxUnitsSum += r.maxUnits || 0;
        maxMergeLvSum += r.maxMergeLv || 1;
        if (r.wallBreakTime != null) { wallBreakSum += r.wallBreakTime; wallBreakCount++; }
      }
      rows.push({
        stage: k,
        type: def.type,
        boss: k % 5 === 0 ? 1 : 0,
        strategy: strategy.id,
        runs: RUNS,
        winRate: Math.round((wins / RUNS) * 100),
        avgWinTime: wins ? +(tSum / wins).toFixed(1) : null,
        avgWallLeft: wins ? Math.round((wallSum / wins) * 100) : 0,
        avgPeakJuice: Math.round(peakJuiceSum / RUNS),
        avgMaxUnits: Math.round(maxUnitsSum / RUNS),
        avgMaxMergeLv: Math.round((maxMergeLvSum / RUNS) * 10) / 10,
        avgWallBreakTime: wallBreakCount ? +(wallBreakSum / wallBreakCount).toFixed(1) : null,
        timeouts,
      });
    }
  }
  globalThis.__STAGE_RESULTS__ = { rows };
})();
`;

/* ---- runner ---- */
function runScenario(scenario) {
  const code = buildCode(scenario);
  const sandbox = buildSandbox();
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.__SCENARIO__ = scenario;
  vm.createContext(sandbox);
  vm.runInContext(code + DRIVER, sandbox, { filename: 'juice-econ-sim-bundle.js' });
  return sandbox.__STAGE_RESULTS__;
}

/* ---- output ---- */
function printResults(label, rows) {
  console.log(`\n>>> ${label}`);
  console.log('关 策略       类型    胜率  时长   墙剩% 果汁峰 兵峰  合成Lv 破墙时 超时');
  for (const r of rows) {
    // Only show light & standard for readability (no_action has no merge/summon)
    if (r.strategy === 'no_action') continue;
    console.log(
      String(r.stage).padStart(2) + ' ' +
      String(r.strategy).padEnd(9) + ' ' +
      String(r.type).padEnd(9) + ' ' +
      (r.winRate + '%').padStart(5) + ' ' +
      String(r.avgWinTime == null ? '-' : r.avgWinTime + 's').padStart(6) + ' ' +
      String(r.avgWallLeft + '%').padStart(5) + ' ' +
      String(r.avgPeakJuice).padStart(4) + ' ' +
      String(r.avgMaxUnits).padStart(4) + ' ' +
      String(r.avgMaxMergeLv).padStart(5) + ' ' +
      String(r.avgWallBreakTime == null ? '-' : r.avgWallBreakTime + 's').padStart(6) + ' ' +
      String(r.timeouts).padStart(3)
    );
  }
}

function printComparison(allResults) {
  // Compare standard strategy across scenarios, stages 4-10 (where merge depth matters)
  console.log('\n\n========== 方案对比 (Standard 策略, 4-10关) ==========');
  console.log('方案    关  胜率  时长   墙剩% 兵峰  合成Lv 破墙时');
  for (const { label, rows } of allResults) {
    for (const r of rows) {
      if (r.strategy !== 'standard') continue;
      if (r.stage < 4 || r.stage > 10) continue;
      console.log(
        String(label).padEnd(7) + ' ' +
        String(r.stage).padStart(2) + ' ' +
        (r.winRate + '%').padStart(5) + ' ' +
        String(r.avgWinTime == null ? '-' : r.avgWinTime + 's').padStart(6) + ' ' +
        String(r.avgWallLeft + '%').padStart(5) + ' ' +
        String(r.avgMaxUnits).padStart(4) + ' ' +
        String(r.avgMaxMergeLv).padStart(5) + ' ' +
        String(r.avgWallBreakTime == null ? '-' : r.avgWallBreakTime + 's').padStart(6)
      );
    }
    console.log(''); // blank line between scenarios
  }
}

/* ---- main ---- */
const idsToRun = SCENARIO_ID.toLowerCase() === 'all'
  ? Object.keys(SCENARIOS)
  : [SCENARIO_ID];

console.log(`果汁经济仿真 · 场景: ${idsToRun.join(', ')}`);
console.log(`每关 x 3策略 x 3 run, 关卡1-15, 65s上限`);

const allResults = [];
for (const id of idsToRun) {
  const key = Object.keys(SCENARIOS).find(k => k.toLowerCase() === id.toLowerCase());
  const scenario = SCENARIOS[key];
  if (!scenario) { console.error(`Unknown scenario: ${id}`); process.exit(1); }
  console.log(`\n--- 运行 ${id}: ${scenario.label} ---`);
  const { rows } = runScenario(scenario);
  printResults(scenario.label, rows);
  allResults.push({ label: id, rows });
}

if (allResults.length > 1) printComparison(allResults);

console.log('\n仿真完成');
