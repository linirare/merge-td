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
  const seeded = mulberry32(0x51A2B3C4);
  const realMath = Math;
  const sandbox = {
    console, JSON,
    Math: new Proxy(realMath, { get: (t, p) => (p === 'random' ? seeded : t[p]) }),
    Date: { now: () => 0 },
    performance: { now: () => 0 },
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {}, createElement: () => ({ getContext: () => ({}), style: {}, classList: { add() {}, remove() {}, toggle() {} } }) },
    addFx: () => {}, playSfx: () => {}, onGameOver: () => {},
    saveMeta: () => {}, refreshGold: () => {}, saveAll: () => {},
    resetJuiceEconomyForLevel: () => {}, syncProgressUnlocks: () => {},
    dt_global: 1 / 60,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.window.innerWidth = 430;
  sandbox.window.innerHeight = 900;
  sandbox.devicePixelRatio = 1;
  return sandbox;
}

const DRIVER = `
;(function () {
  const DT = 1 / 60;
  const SUMMON_COST = 1;                 // 与 input.js 一致
  const MAX_FRAMES = 90 * 60;            // 90s 超时上限(目标 35-85s,超此即判过慢/僵持)
  const RUNS_PER_STAGE = 4;

  // —— 复刻 main.js 的出兵封装(渲染副作用走 stub) ——
  function spawnSoldierFromBall(ball, r, c, side, forced = false) {
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
  function botSummon() {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (state.sp < SUMMON_COST) return;
      if (state.playerSlots[r][c]) continue;
      state.sp -= SUMMON_COST;
      state.summonCount = (state.summonCount || 0) + 1;
      const type = randomType(activeDeck());
      const ball = createBall(type, 1);
      ball.spawnTimer = Math.max(ball.spawnTimer, 2.2);
      state.playerSlots[r][c] = ball;
    }
  }

  // —— 复刻 main.js update(dt):敌方全真,玩家兵按 CD 真派 ——
  function stepFrame() {
    const dt = DT;
    dt_global = dt;
    if (state.phase !== 'playing') return;
    state.time += dt;

    if (!state._spTimer) state._spTimer = 0;
    state._spTimer += dt;
    if (state._spTimer >= SP_PASSIVE && state.sp < getSpRecoverCap(meta)) {
      state._spTimer -= SP_PASSIVE;
      state.sp = Math.min(state.sp + 1, getSpMax(meta));
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

  function runStage(k) {
    if (typeof resetAI === 'function') resetAI();
    if (typeof resetJuiceEconomyForLevel === 'function') resetJuiceEconomyForLevel(k);
    initLevel(k);
    state.phase = 'playing';
    let botTimer = 0;
    for (let f = 0; f < MAX_FRAMES; f++) {
      botTimer += DT;
      if (botTimer >= 0.4) { botTimer -= 0.4; botMerge(); botSummon(); }
      stepFrame();
      if (state.enemyWallHp <= 0) return { win: 1, time: state.time, wall: state.playerWallHp / state.playerWallMax };
      if (state.playerWallHp <= 0) return { win: 0, time: state.time, wall: 0 };
    }
    return { win: 0, time: state.time, wall: state.playerWallHp / state.playerWallMax, timeout: 1 };
  }

  const rows = [];
  for (let k = 1; k <= 20; k++) {
    let wins = 0, timeouts = 0, tSum = 0, wallSum = 0;
    for (let i = 0; i < RUNS_PER_STAGE; i++) {
      const r = runStage(k);
      if (r.win) { wins++; tSum += r.time; wallSum += r.wall; }
      if (r.timeout) timeouts++;
    }
    const def = getStageDefinition(k);
    rows.push({
      stage: k,
      type: def.type,
      boss: k % 5 === 0 ? 1 : 0,
      runs: RUNS_PER_STAGE,
      winRate: Math.round((wins / RUNS_PER_STAGE) * 100),
      avgWinTime: wins ? +(tSum / wins).toFixed(1) : null,
      avgWallLeft: wins ? Math.round((wallSum / wins) * 100) : 0,
      timeouts,
    });
    console.error('  stage ' + k + ' done (' + wins + '/' + RUNS_PER_STAGE + ' win, ' + timeouts + ' timeout)');
  }
  globalThis.__STAGE_REAL__ = { rows, tuning: TUNING.pve };
})();
`;

function run() {
  const code = FILES.map(f => `\n/* ==== ${f} ==== */\n` + fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  const sandbox = buildSandbox();
  vm.createContext(sandbox);
  vm.runInContext(code + DRIVER, sandbox, { filename: 'stage-real-sim-bundle.js' });
  return sandbox.__STAGE_REAL__;
}

const { rows, tuning } = run();
const check = process.argv[2] === '--check';

function band(v, [lo, hi]) { return v >= lo && v <= hi ? 'OK ' : (v < lo ? 'LOW' : 'HIGH'); }

console.log('\n=== 真战斗仿真 · 20 关平衡报告 (bot 玩家, 每关 4 局) ===');
console.log('关 类型      胜率   胜均时长  城墙剩% 超时  vs目标(时长/胜率)');
for (const r of rows) {
  const winTarget = r.boss ? tuning.bossWinRate : tuning.standardWinRate;
  const timeTarget = r.boss ? tuning.bossTargetSeconds : tuning.normalTargetSeconds;
  const wr = (r.winRate / 100);
  const wrFlag = band(wr, winTarget);
  const tFlag = r.avgWinTime == null ? ' - ' : band(r.avgWinTime, timeTarget);
  console.log(
    String(r.stage).padStart(2) + ' ' +
    String(r.type).padEnd(9) + ' ' +
    (r.winRate + '%').padStart(5) + '  ' +
    String(r.avgWinTime == null ? '-' : r.avgWinTime + 's').padStart(7) + '  ' +
    String(r.avgWallLeft + '%').padStart(5) + '  ' +
    String(r.timeouts).padStart(3) + '   ' +
    'time:' + tFlag + ' win:' + wrFlag
  );
}

// 结构性断言(CI 安全:失衡只报告不 fail)
const assert = require('assert');
assert.strictEqual(rows.length, 20, 'should cover stages 1-20');
for (const r of rows) {
  assert.ok(r.winRate >= 0 && r.winRate <= 100, 'winRate in range');
  assert.ok(r.runs === 4, 'ran 4 runs');
}
assert.strictEqual(rows.filter(r => r.boss).length, 4, 'four boss stages in 1-20');
console.log('\nOK: real-combat sim ran stages 1-20 (structure valid)');
