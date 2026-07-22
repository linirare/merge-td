/* ============================================================
   水果突击 · 真战斗逐帧仿真验证 20 关平衡 (headless)
   ------------------------------------------------------------
   与 combat-baseline 同样把真 combat 链载入一个 vm 沙箱、种子化
   Math.random,但这里驱动【整关】:复刻 main.js 的 update(dt) 主循环
   (SP 回复 / 敌方补营 / updateAI / 双方按 CD 自动派兵 / updateCombat),
   玩家侧用"尊重果汁经济的简单 bot"(果汁够就往空格召唤 + 贪心合成)。

   敌方 100% 真(补营+真 updateAI+真派兵+真 combat);仅玩家决策是脚本化的,
   因此胜率反映的是"一个简单 bot"而非高手 —— 但战斗数值/城墙/经济全部真算,
   这是相对 balance_sim 估算器的关键升级。

     node test/stage-real-sim.js            # 打印平衡报告
     node test/stage-real-sim.js --check    # 仅断言结构合理(不因失衡而 fail)
   ============================================================ */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// 最小"结局决定链" + ai.js(敌方 AI),按 index.html 加载顺序。
// 渲染/UI/DOM 文件一律不载(无头不需要,且会拖 canvas 依赖)。
// 已补全所有 gameplay-critical 文件(2026-07-21: 合并缺失的 9 个文件,使 update() wrapper 链完整)
const FILES = [
  'js/world_theme.js',
  'js/config.js',
  'js/layout_v56.js',
  'js/state.js',
  'js/hooks.js',
  'js/board.js',
  'js/combat.js',
  'js/ai.js',
  'js/tutorial_balance.js',
  'js/troop_tier_mode.js',
  'js/fruit_deck_runtime.js',
  'js/fruit_mechanics.js',
  'js/juice.js',
  'js/balance_fix_v15.js',
  'js/economy_cd_fix.js',
  'js/opening_and_projectile_fix.js',
  'js/lane_block_fix.js',
  'js/juice_absorb_v16.js',
  'js/skill_system_v17.js',
  'js/skill_system_v70.js',
  'js/combat_pacing_v19.js',
  'js/status_engine_v61.js',
  'js/dynamic_difficulty_v64.js',
  'js/free_battle_v2.js',
  'js/juice_economy.js',
  'js/economy_balls_v62.js',
  'js/commander_system_v1.js',
  'js/build_combo_v2.js',
  'js/bond_system.js',
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildSandbox() {
  // 可重置的种子随机流:每关/每 run 由 __reseed__ 重置,使各关随机独立
  // (旧版单条共享流→改任何早关行为会把下游流冲错位→前后对照假性 shuffle)
  let rng = 0x51A2B3C4 >>> 0;
  const seeded = function () {
    rng |= 0; rng = (rng + 0x6D2B79F5) | 0;
    let t = Math.imul(rng ^ (rng >>> 15), 1 | rng);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const realMath = Math;
  const sandbox = {
    console, JSON,
    Math: new Proxy(realMath, { get: (t, p) => (p === 'random' ? seeded : t[p]) }),
    __reseed__: (n) => { rng = (n >>> 0); },
    Date: { now: () => 0 },
    performance: { now: () => 0 },
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {}, createElement: () => ({ getContext: () => ({}), style: {}, classList: { add() {}, remove() {}, toggle() {} } }) },
    addFx: () => {}, playSfx: () => {}, onGameOver: () => {},
    saveMeta: () => {}, refreshGold: () => {}, saveAll: () => {},
    resetJuiceEconomyForLevel: () => {}, syncProgressUnlocks: () => {},
    draw: () => {},  // juice.js 的 patchUpdateDrawJuice 需要 draw(渲染函数,无头环境不存在,给空桩)
    dt_global: 1 / 60,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.window.innerWidth = 430;
  sandbox.window.innerHeight = 900;
  sandbox.devicePixelRatio = 1;
  return sandbox;
}

function argValue(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find(value => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : '';
}

const isFullRun = process.argv.includes('--full');
const isGateRun = process.argv.includes('--gate');
const verbose = process.argv.includes('--verbose');
const simRunsPerStage = Math.max(1, Number(argValue('runs') || (isFullRun ? 3 : 1)) || 1);
const simMaxSeconds = Math.max(30, Number(argValue('cap') || (isFullRun ? 165 : 135)) || 135);
const requestedStrategies = (argValue('strategies') || 'no_action,light,standard').split(',').map(v => v.trim()).filter(Boolean);
const requestedStages = (argValue('stages') || Array.from({ length: 20 }, (_, i) => i + 1).join(','))
  .split(',').map(Number).filter(k => Number.isInteger(k) && k >= 1 && k <= 20);

// —— 预置游戏基函数(必须在 game patching 文件加载前定义,以便 wrapper 链生效) ——
const PRELUDE = `
function clamp01(v) { return Math.max(0, Math.min(1, v)); }

function spawnSoldierFromBall(ball, r, c, side, forced) {
  const group = side === 'player' ? state.playerSoldiers : state.enemySoldiers;
  if (group.filter(function(s){return s.alive}).length >= MAX_SOLDIERS) return null;
  const center = slotCenter(r, c, side === 'enemy');
  const soldier = side === 'player'
    ? createSoldier(ball.type, ball.level, getAtkMul(meta, ball.type), getHpMul(meta, ball.type))
    : createSoldier(ball.type, ball.level);
  if (side === 'enemy' && typeof enemyPveStatMultipliersV64 === 'function') {
    const mul = enemyPveStatMultipliersV64();
    soldier.atk = Math.round(soldier.atk * mul.atk);
    soldier.hp = Math.round(soldier.hp * mul.hp);
    soldier.maxHp = soldier.hp;
  }
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
function update(dt) {
  dt_global = dt;
  if (state.phase !== 'playing') return;
  state.time += dt;
  if (!state._spTimer) state._spTimer = 0;
  state._spTimer += dt;
  if (state._spTimer >= SP_PASSIVE && state.sp < getSpRecoverCap(meta)) {
    state._spTimer -= SP_PASSIVE;
    state.sp = Math.min(state.sp + 1, getSpMax(meta));
  }
  updateAI(dt);
  var slotsArr = [
    { slots: state.playerSlots, side: 'player' },
    { slots: state.enemySlots, side: 'enemy' },
  ];
  for (var g = 0; g < slotsArr.length; g++) {
    var grp = slotsArr[g];
    var soldiers = grp.side === 'player' ? state.playerSoldiers : state.enemySoldiers;
    var alive = soldiers.filter(function(s){return s.alive}).length;
    if (alive >= MAX_SOLDIERS) continue;
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var ball = grp.slots[r][c];
        if (!ball) continue;
        ball.spawnTimer -= dt;
        if (ball.spawnTimer <= 0) {
          var cd = SPAWN_COOLDOWNS[ball.level] || SPAWN_COOLDOWNS[1];
          ball.spawnTimer += cd;
          spawnSoldierFromBall(ball, r, c, grp.side);
        }
      }
    }
  }
  updateCombat();
}
`;

const DRIVER = `
;(function () {
  const DT = 1 / 30;
  const SUMMON_COST = 1;                 // 与 input.js 一致
  const MAX_SIM_FRAMES = Math.round(${simMaxSeconds} / DT);
  const RUNS_PER_STAGE = ${simRunsPerStage};
  const VERBOSE = ${verbose ? 'true' : 'false'};
  const REQUESTED_STRATEGIES = ${JSON.stringify(requestedStrategies)};
  const SIM_STAGES = ${JSON.stringify(requestedStages)};
  const STRATEGIES = [
    { id: 'no_action', label: 'No Op', botEvery: 999, summon: 0, urgentEvery: 999 },
    { id: 'light', label: 'Light', botEvery: 1.0, summon: 1, urgentEvery: 7.0 },
    { id: 'standard', label: 'Standard', botEvery: 0.65, summon: 1, urgentEvery: 3.5 },
  ].filter(strategy => REQUESTED_STRATEGIES.includes(strategy.id));

  // —— 玩家 bot:贪心合成(同类同级) ——
  function botMerge() {
    const seen = {};
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const b = state.playerSlots[r][c];
      if (!b || b.level >= MAX_LEVEL) continue;
      const key = b.type + '#' + b.level;
      if (seen[key]) {
        const [pr, pc] = seen[key];
        tryMerge(state.playerSlots, r, c, pr, pc);   // 把 (r,c) 合入之前那个
        delete seen[key];
      } else {
        seen[key] = [r, c];
      }
    }
  }

  // —— 玩家 bot:果汁够就往空格召唤(复刻 input.js summonFruitAt 的经济) ——
  const botMergeOnce = botMerge;
  botMerge = function botMergeMultiPass() {
    for (let i = 0; i < 4; i++) botMergeOnce();
  };

  function botActionCost() {
    const cfg = TUNING && TUNING.juice ? TUNING.juice : {};
    const count = Math.max(0, Math.floor(Number(state.summonActionCount || 0)));
    const curve = Array.isArray(cfg.actionCostCurve) ? cfg.actionCostCurve : null;
    let cost = curve && curve.length ? Number(curve[Math.min(count, curve.length - 1)]) || 1 : Math.max(1, Number(state.summonCostCounter || 1));
    state.summonCostCounter = count + 1;
    return Math.min(Number(cfg.maxActionCost || 12), cost);
  }

  function botMarkSummonAction() {
    state.summonActionCount = Math.max(0, Math.floor(Number(state.summonActionCount || 0))) + 1;
    state.summonCostCounter = state.summonActionCount + 1;
  }

  function botUrgentCost() {
    const cfg = TUNING && TUNING.juice ? TUNING.juice : {};
    return Math.max(1, Number(cfg.urgentCost || 2));
  }

  function botPickType(strategy) {
    const k = state.currentLevel || 1;
    const boss = !!(state.levelConfig && state.levelConfig.isBoss);
    const pattern = boss
      ? ['orange_cannon', 'watermelon_guard', 'grape_archer', 'pineapple_lancer', 'banana_raider']
      : ['watermelon_guard', 'grape_archer', 'orange_cannon', 'banana_raider', 'pineapple_lancer'];
    const deck = activeDeck();
    const preferred = pattern.filter(id => deck.includes(id));
    const pool = preferred.length ? preferred : deck;
    return randomType(pool);
  }

  function botSummonLevel(strategy) {
    return 1;
  }

  function botSummon(limit, strategy) {
    let placed = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (placed >= limit) return;
      if (state.playerSlots[r][c]) continue;
      const cost = typeof nextJuiceActionCost === 'function' ? nextJuiceActionCost() : botActionCost();
      if (state.sp < cost) return;
      state.sp -= cost;
      botMarkSummonAction();
      state.summonCount = (state.summonCount || 0) + 1;
      const pool = activeDeck();
      const type = typeof pickSmoothSummonTypeV1 === 'function'
        ? pickSmoothSummonTypeV1(pool)
        : botPickType(strategy);
      const ball = createBall(type, botSummonLevel(strategy));
      ball.spawnTimer = Math.max(ball.spawnTimer, 2.2);
      state.playerSlots[r][c] = ball;
      if (typeof noteSmoothSummonV1 === 'function') noteSmoothSummonV1();
      placed++;
    }
  }

  function botUrgentDispatch() {
    const dangerLine = LAYOUT.fieldY + LAYOUT.fieldH * 0.62;
    const underPressure = (state.enemySoldiers || []).some(s => s && s.alive && s.battleReady && s.y >= dangerLine);
    if (!underPressure && state.playerWallHp >= state.playerWallMax * 0.88) return;
    let best = null;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const ball = state.playerSlots[r][c];
      if (!ball || ball.level < 2) continue;
      if (!best || ball.level > best.ball.level) best = { r, c, ball };
    }
    if (!best) return;
    const cost = typeof nextUrgentDispatchCost === 'function' ? nextUrgentDispatchCost() : botUrgentCost();
    if (state.sp < cost) return;
    state.sp -= cost;
    spawnSoldierFromBall(best.ball, best.r, best.c, 'player', true);
    best.ball.spawnTimer = Math.max(best.ball.spawnTimer || 0, 1.2);
  }

  function prepareMetaForStrategy(k, strategy) {
    meta = createMeta();
    meta.highestLevel = k;
    meta.gold = 999999;
    meta.unlocked = typeof progressUnlocked === 'function' ? progressUnlocked(meta) : DEFAULT_DECK.slice();
    meta.deck = DEFAULT_DECK.slice();
    if (strategy.id === 'standard' && k >= 6 && meta.unlocked.includes('mint_supply')) {
      meta.deck = normalizeDeck(['watermelon_guard', 'grape_archer', 'pineapple_lancer', 'orange_cannon', 'mint_supply']);
    }
    const growth = strategy.id === 'standard'
      ? Math.min(10, Math.floor((k + 1) / 2))
      : strategy.id === 'light'
        ? Math.min(5, Math.floor((k + 2) / 4))
        : 0;
    const heroLv = strategy.id === 'standard'
      ? (typeof recommendedHeroLevel === 'function' ? recommendedHeroLevel(k) : Math.min(13, 1 + Math.floor((k - 1) * 0.65)))
      : strategy.id === 'light'
        ? Math.min(6, 1 + Math.floor((k - 1) / 4))
        : 1;
    window.shell = { commanderId: 'orchard_lord', commanderLv: { orchard_lord: heroLv }, fruitLv: {} };
    for (const id of UNIT_POOL) window.shell.fruitLv[id] = heroLv;
    meta.wallLv = strategy.id === 'standard' ? Math.min(WALL_UPGRADE_MAX, Math.floor(k / 3)) : (strategy.id === 'light' ? Math.min(WALL_UPGRADE_MAX, Math.floor(k / 6)) : 0);
    meta.spLv = strategy.id === 'standard' ? Math.min(SP_UPGRADE_MAX, Math.floor(k / 4)) : (strategy.id === 'light' ? Math.min(SP_UPGRADE_MAX, Math.floor(k / 8)) : 0);
    for (const id of DEFAULT_DECK) {
      meta.upgrades[id + '_atk'] = growth;
      meta.upgrades[id + '_hp'] = Math.max(0, growth - 1);
      meta.shardsTotal[id] = strategy.id === 'standard' ? k * 12 : (strategy.id === 'light' ? k * 5 : 0);
    }
  }

  function stepFrame() {
    update(DT);
    // 指挥官系统(如果外层 wrapper 未覆盖)
    if (state._simAutoCommander && state.commander && state.commander.cd <= 0 && typeof activateCommanderSkillV1 === 'function') {
      activateCommanderSkillV1();
    }
  }

  function comboSnapshot() {
    const m = state._buildComboV2 && state._buildComboV2.metrics ? state._buildComboV2.metrics : {};
    return {
      maxMergeLevel: Number(m.maxMergeLevel || 0),
      firstLv2Time: m.firstLv2Time == null ? null : Number(m.firstLv2Time),
      firstLv3Time: m.firstLv3Time == null ? null : Number(m.firstLv3Time),
      pairComboCount: Number(m.pairComboCount || 0),
      formedAt: m.formedAt == null ? null : Number(m.formedAt),
      summonCount: Number(m.summonCount || state.summonCount || 0),
      mergeCount: Number(m.mergeCount || state.merges || 0),
    };
  }

  function stageResult(extra) {
    return Object.assign(extra, comboSnapshot());
  }

  function runStage(k, strategy, seed) {
    if (typeof __reseed__ === 'function') __reseed__(seed >>> 0); // 每关每run独立随机,消除共享流串扰
    prepareMetaForStrategy(k, strategy);
    if (typeof resetAI === 'function') resetAI();
    if (typeof resetJuiceEconomyForLevel === 'function') resetJuiceEconomyForLevel(k);
    initLevel(k);
    state.phase = 'playing';
    // SP 由 resetJuiceEconomyForLevel(initLevel wrapper) 设置,不自覆盖
    state.summonCostCounter = 1;
    state.summonActionCount = 0;
    state._simAutoCommander = strategy.id === 'standard';
    let botTimer = 0;
    let urgentTimer = 0;
    let peakJuice = state.sp || 0;
    let maxUnits = 0;
    for (let f = 0; f < MAX_SIM_FRAMES; f++) {
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
      stepFrame();
      peakJuice = Math.max(peakJuice, state.sp || 0);
      maxUnits = Math.max(maxUnits, (state.playerSoldiers || []).filter(s => s && s.alive).length);
      if (state.enemyWallHp <= 0) return stageResult({ win: 1, time: state.time, wall: state.playerWallHp / state.playerWallMax, peakJuice, maxUnits });
      if (state.playerWallHp <= 0) return stageResult({ win: 0, time: state.time, wall: 0, peakJuice, maxUnits });
    }
    return stageResult({ win: 0, time: state.time, wall: state.playerWallHp / state.playerWallMax, timeout: 1, peakJuice, maxUnits });
  }

  const rows = [];
  for (const k of SIM_STAGES) {
    const def = getStageDefinition(k);
    for (let sIdx = 0; sIdx < STRATEGIES.length; sIdx++) {
      const strategy = STRATEGIES[sIdx];
      let wins = 0, timeouts = 0, tSum = 0, wallSum = 0, peakJuice = 0, maxUnits = 0;
      let maxMergeLevel = 0, pairComboCount = 0, summonCount = 0, mergeCount = 0;
      let lv2Sum = 0, lv2N = 0, lv3Sum = 0, lv3N = 0, formedSum = 0, formedN = 0;
      for (let i = 0; i < RUNS_PER_STAGE; i++) {
        const seed = (0x51A2B3C4 ^ (k * 100003 + i * 101)) >>> 0; // 同关同run跨策略共享初始种子，便于公平比较
        const r = runStage(k, strategy, seed);
        if (r.win) { wins++; tSum += r.time; wallSum += r.wall; }
        if (r.timeout) timeouts++;
        peakJuice += r.peakJuice || 0;
        maxUnits += r.maxUnits || 0;
        maxMergeLevel = Math.max(maxMergeLevel, r.maxMergeLevel || 0);
        pairComboCount += r.pairComboCount || 0;
        summonCount += r.summonCount || 0;
        mergeCount += r.mergeCount || 0;
        if (r.firstLv2Time != null) { lv2Sum += r.firstLv2Time; lv2N++; }
        if (r.firstLv3Time != null) { lv3Sum += r.firstLv3Time; lv3N++; }
        if (r.formedAt != null) { formedSum += r.formedAt; formedN++; }
      }
      rows.push({
        stage: k,
        type: def.type,
        boss: def.type === 'boss' ? 1 : 0,
        strategy: strategy.id,
        runs: RUNS_PER_STAGE,
        winRate: Math.round((wins / RUNS_PER_STAGE) * 100),
        avgWinTime: wins ? +(tSum / wins).toFixed(1) : null,
        avgWallLeft: wins ? Math.round((wallSum / wins) * 100) : 0,
        avgPeakJuice: Math.round(peakJuice / RUNS_PER_STAGE),
        avgMaxUnits: Math.round(maxUnits / RUNS_PER_STAGE),
        maxMergeLevel,
        firstLv2Time: lv2N ? +(lv2Sum / lv2N).toFixed(1) : null,
        firstLv3Time: lv3N ? +(lv3Sum / lv3N).toFixed(1) : null,
        pairComboCount: +(pairComboCount / RUNS_PER_STAGE).toFixed(1),
        formedAt: formedN ? +(formedSum / formedN).toFixed(1) : null,
        summonCount: +(summonCount / RUNS_PER_STAGE).toFixed(1),
        mergeCount: +(mergeCount / RUNS_PER_STAGE).toFixed(1),
        timeouts,
      });
      if (VERBOSE) console.error('  stage ' + k + ' ' + strategy.id + ' done (' + wins + '/' + RUNS_PER_STAGE + ' win, ' + timeouts + ' timeout)');
    }
  }
  globalThis.__STAGE_REAL__ = { rows, tuning: TUNING.pve };
})();
`;

function run() {
  const code = FILES.map(f => `\n/* ==== ${f} ==== */\n` + fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  const sandbox = buildSandbox();
  vm.createContext(sandbox);
  // PRELUDE 在前:定义基函数使 game patching 文件的 wrapper 链能捕获并包装
  // 单次 eval, const/let/function 在同一 scope
  vm.runInContext(PRELUDE + '\n' + code + '\n' + DRIVER, sandbox, { filename: 'stage-real-sim-bundle.js' });
  return sandbox.__STAGE_REAL__;
}

const { rows, tuning } = run();
const check = process.argv[2] === '--check';

function band(v, [lo, hi]) { return v >= lo && v <= hi ? 'OK ' : (v < lo ? 'LOW' : 'HIGH'); }

console.log(`\n=== 真战斗仿真 · ${requestedStages.length}关 x ${requestedStrategies.length}档操作 (${simRunsPerStage} run/stage, ${simMaxSeconds}s cap) ===`);
console.log('关 操作档      类型      胜率   胜均时长  城墙剩% 果汁峰 单位峰 超时  vs目标(时长/胜率)');
for (const r of rows) {
  const winTarget = r.strategy === 'no_action' ? [0, 0.45] : (r.strategy === 'light' ? [0.35, 0.85] : (r.boss ? tuning.bossWinRate : tuning.standardWinRate));
  const timeTarget = r.boss ? tuning.bossTargetSeconds : tuning.normalTargetSeconds;
  const wr = (r.winRate / 100);
  const wrFlag = band(wr, winTarget);
  const tFlag = r.avgWinTime == null ? ' - ' : band(r.avgWinTime, timeTarget);
  console.log(
    String(r.stage).padStart(2) + ' ' +
    String(r.strategy).padEnd(11) + ' ' +
    String(r.type).padEnd(9) + ' ' +
    (r.winRate + '%').padStart(5) + '  ' +
    String(r.avgWinTime == null ? '-' : r.avgWinTime + 's').padStart(7) + '  ' +
    String(r.avgWallLeft + '%').padStart(5) + '  ' +
    String(r.avgPeakJuice).padStart(5) + '  ' +
    String(r.avgMaxUnits).padStart(5) + '  ' +
    String(r.maxMergeLevel).padStart(5) + '  ' +
    String(r.firstLv2Time == null ? '-' : r.firstLv2Time + 's').padStart(5) + '  ' +
    String(r.firstLv3Time == null ? '-' : r.firstLv3Time + 's').padStart(5) + '  ' +
    String(r.pairComboCount).padStart(5) + ' ' +
    String(r.formedAt == null ? '-' : r.formedAt + 's').padStart(6) + ' ' +
    String(r.timeouts).padStart(3) + '   ' +
    'time:' + tFlag + ' win:' + wrFlag
  );
}

// 结构性断言(CI 安全:失衡只报告不 fail)
const assert = require('assert');
assert.strictEqual(rows.length, requestedStages.length * requestedStrategies.length, 'should cover requested stages and strategies');
for (const r of rows) {
  assert.ok(r.winRate >= 0 && r.winRate <= 100, 'winRate in range');
  assert.ok(r.runs === simRunsPerStage, 'ran configured runs');
  assert.ok(['no_action', 'light', 'standard'].includes(r.strategy), 'known strategy');
  assert.ok(r.maxMergeLevel >= 0 && r.maxMergeLevel <= 7, 'maxMergeLevel in range');
  assert.ok(r.pairComboCount >= 0, 'pairComboCount should be non-negative');
  assert.ok(r.summonCount >= 0, 'summonCount should be non-negative');
  assert.ok(r.mergeCount >= 0, 'mergeCount should be non-negative');
}
const standardRows = rows.filter(r => r.strategy === 'standard');
assert.ok(standardRows.length > 0, 'standard strategy records present');
const anyWin = standardRows.some(r => r.winRate > 0);
assert.ok(anyWin, 'PVE gate: standard strategy must be able to clear at least one requested stage');
const playableStageRatio = standardRows.filter(r => r.winRate > 0).length / standardRows.length;
if (standardRows.length >= 5) {
  assert.ok(playableStageRatio >= 0.60, `PVE gate: standard strategy only clears ${Math.round(playableStageRatio * 100)}% of requested stages`);
  if (isGateRun && simRunsPerStage >= 3) {
    const blockedStages = standardRows.filter(r => r.winRate === 0).map(r => r.stage);
    assert.strictEqual(blockedStages.length, 0, `PVE gate: zero-win stages detected: ${blockedStages.join(',')}`);
  }
}
const firstStage = standardRows.find(r => r.stage === 1);
if (firstStage) assert.ok(firstStage.winRate > 0, 'PVE gate: stage 1 must be clearable by standard strategy');
if (requestedStrategies.includes('no_action')) {
  assert.ok(rows.filter(r => r.strategy === 'no_action').length > 0, 'no_action records present');
}
if (typeof tuning.bossesEnabled === 'boolean' && !tuning.bossesEnabled) {
  assert.strictEqual(rows.filter(r => r.boss).length, 0, 'bosses are disabled for the current PVE season');
}
console.log(`\nOK: real-combat PVE gate passed (${Math.round(playableStageRatio * 100)}% requested stages clearable)`);
