/* ============================================================
   水果突击 · 服务器权威 PvP 战斗模拟 (Phase 1)
   ------------------------------------------------------------
   在 Node 里用 vm sandbox 载入真实战斗引擎链(与 test/combat-baseline
   /stage-real-sim 同套办法),跑一份"唯一真战斗"。服务器持权威,
   客户端只发操作 + 渲染快照。见 [[merge-td-hifi-graft]] PvP 架构。

   注意:main.js 顶层有 document.getElementById('game') 会在无头崩,
   故这里不载 main.js,自带 spawnSoldierFromBall(复刻 main.js 的出兵)。
   v1 数值归一化:双方都用 createSoldier(type,level) 基础值(不带养成 mul),
   双方等墙 —— 拼操作不拼氪金,养成加成留 v2。
   ============================================================ */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// 决定战斗结果的引擎链(index.html 加载顺序;纯视觉包装 juice*.js 省略)
const FILES = [
  'js/config.js',
  'js/layout_v56.js',
  'js/state.js',
  'js/board.js',
  'js/combat.js',
  'js/fruit_mechanics.js',
  'js/balance_fix_v15.js',
  'js/lane_block_fix.js',
  'js/skill_system_v17.js',
  'js/combat_pacing_v19.js',
  'js/status_engine_v61.js',
  'js/boss_v63.js',
  'js/dynamic_difficulty_v64.js',
];

const ENGINE_CODE = FILES.map(f => `\n/* ==== ${f} ==== */\n` + fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 驱动:在 sandbox 内定义 __pvp 控制面(init/applyAction/tick/snapshot/result)
const DRIVER = `
;(function () {
  const DT_DEFAULT = 1 / 30;
  const WALL = (typeof BASE_WALL_HP === 'number' ? BASE_WALL_HP : 600);
  const MAXS = (typeof MAX_SOLDIERS === 'number' ? MAX_SOLDIERS : 60);

  // 复刻 main.js 的出兵(归一化:不带养成 mul),稳定 id 供快照对齐
  function spawnFromBall(ball, r, c, side, forced) {
    const group = side === 'player' ? state.playerSoldiers : state.enemySoldiers;
    if (group.filter(s => s.alive).length >= MAXS) return null;
    const center = slotCenter(r, c, side === 'enemy');
    const soldier = createSoldier(ball.type, ball.level);
    const n = ++globalThis.__pvp._spawn[side];
    const offsetPattern = [-6, 0, 6, -3, 3];
    const offset = offsetPattern[(n - 1) % offsetPattern.length];
    soldier.x = center.x + offset;
    soldier.y = center.y;
    soldier.side = side;
    soldier.laneIndex = c;
    soldier.laneX = BOARD_X + c * (CELL + GAP) + CELL / 2 + offset * 0.45;
    soldier.mode = 'deploy';
    soldier.target = null;
    soldier.battleReady = false;
    soldier.protected = true;
    soldier._gateFx = false;
    soldier.id = side + '-' + n;
    group.push(soldier);
    return soldier;
  }

  function pvpOpening(slots, deck) {
    const safe = (typeof normalizeDeck === 'function' ? normalizeDeck(deck || DEFAULT_DECK) : (deck || DEFAULT_DECK));
    const picks = [[0,1,safe[3],1],[0,2,safe[0],1],[0,3,safe[4],1],[1,1,safe[1],1],[1,2,safe[0],1],[1,3,safe[2],1]];
    for (const [r, c, type, level] of picks) {
      const b = createBall(type || DEFAULT_DECK[0], level);
      b.spawnTimer = 2.2;
      slots[r][c] = b;
    }
  }

  function actionCost(sideName) {
    const key = sideName === 'enemy' ? 'enemySummonCostCounter' : 'summonCostCounter';
    state[key] = Math.max(1, Number(state[key] || 1));
    return Math.min(12, state[key]);
  }
  function spendJuice(sideName, cost) {
    if (sideName === 'enemy') { state.enemySp = Math.max(0, Number(state.enemySp || 0) - cost); state.enemySummonCostCounter = cost + 1; }
    else { state.sp = Math.max(0, Number(state.sp || 0) - cost); state.summonCostCounter = cost + 1; }
  }

  globalThis.__pvp = {
    _spawn: { player: 0, enemy: 0 },
    _result: null,

    init(seed, deckA, deckB) {
      state = createState();
      state.mode = 'pvp';
      state.phase = 'playing';
      state.playerWallHp = state.playerWallMax = WALL;
      state.enemyWallHp = state.enemyWallMax = WALL;
      state.playerSlots = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      state.enemySlots = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      state.playerSoldiers = [];
      state.enemySoldiers = [];
      state.sp = (typeof getSpStart === 'function' ? getSpStart(createMeta()) : 8);
      state.enemySp = state.sp;
      state.summonCostCounter = 1;
      state.enemySummonCostCounter = 1;
      state.time = 0;
      state._spTimer = 0;
      state.currentLevel = 1;
      state.levelConfig = { id: 1, isBoss: false, enemyInitLevel: 1, enemyWallHp: state.enemyWallMax, enemySpawnInterval: 999999, reward: 0, desc: 'PVP' };
      state.laneStats = (typeof emptyLaneStats === 'function' ? emptyLaneStats() : []);
      this._spawn = { player: 0, enemy: 0 };
      this._result = null;
      pvpOpening(state.playerSlots, deckA);
      pvpOpening(state.enemySlots, deckB);
    },

    // side: 0=player, 1=enemy
    applyAction(side, action) {
      if (!action || state.phase !== 'playing') return { ok: false, err: 'not_playing' };
      const slots = side === 1 ? state.enemySlots : state.playerSlots;
      const sideName = side === 1 ? 'enemy' : 'player';
      const p = action.payload || {};
      try {
        if (action.type === 'summon_cell') {
          if (!slots[p.r] || slots[p.r][p.c]) return { ok: false, err: 'cell_occupied' };
          const b = createBall(p.type, p.level || 1);
          b.spawnTimer = (p.spawnTimer == null ? 2.2 : Number(p.spawnTimer || 0));
          slots[p.r][p.c] = b;
          spendJuice(sideName, Number(p.cost || actionCost(sideName)));
        } else if (action.type === 'move_cell') {
          const r = tryMove(slots, p.fromR, p.fromC, p.toR, p.toC);
          if (!r || !r.moved) return { ok: false, err: 'move_fail' };
        } else if (action.type === 'merge_or_swap_cell') {
          const r = tryMerge(slots, p.fromR, p.fromC, p.toR, p.toC);
          if (!r) return { ok: false, err: 'merge_fail' };
        } else if (action.type === 'urgent_dispatch') {
          const ball = slots[p.r] && slots[p.r][p.c];
          if (!ball) return { ok: false, err: 'empty_cell' };
          spendJuice(sideName, Number(p.cost || actionCost(sideName)));
          spawnFromBall(ball, p.r, p.c, sideName, true);
          ball.spawnTimer = Math.max(ball.spawnTimer || 0, 1.2);
        } else return { ok: false, err: 'unknown_action' };
        return { ok: true };
      } catch (e) { return { ok: false, err: String((e && e.message) || e) }; }
    },

    tick(dt) {
      dt = dt || DT_DEFAULT;
      dt_global = dt;
      if (state.phase !== 'playing') return this.status();
      state.time += dt;

      const pi = (typeof TUNING !== 'undefined' && TUNING.juice ? Number(TUNING.juice.passiveInterval) : 5) || 5;
      state._spTimer = (state._spTimer || 0) + dt;
      while (state._spTimer >= pi) { state._spTimer -= pi; state.sp = (state.sp || 0) + 1; state.enemySp = (state.enemySp || 0) + 1; }

      const groups = [
        { slots: state.playerSlots, side: 'player', arr: state.playerSoldiers },
        { slots: state.enemySlots, side: 'enemy', arr: state.enemySoldiers },
      ];
      for (const g of groups) {
        if (MAXS - g.arr.filter(s => s.alive).length <= 0) continue;
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          const ball = g.slots[r][c];
          if (!ball) continue;
          ball.spawnTimer -= dt;
          if (ball.spawnTimer <= 0) {
            ball.spawnTimer += ((typeof SPAWN_COOLDOWNS !== 'undefined' && SPAWN_COOLDOWNS[ball.level]) || (typeof SPAWN_COOLDOWNS !== 'undefined' && SPAWN_COOLDOWNS[1]) || 3);
            spawnFromBall(ball, r, c, g.side);
          }
        }
      }

      updateCombat();

      if (state.playerWallHp <= 0 && !this._result) this._result = { winner: 1, reason: 'wall', duration: Math.floor(state.time) };
      else if (state.enemyWallHp <= 0 && !this._result) this._result = { winner: 0, reason: 'wall', duration: Math.floor(state.time) };
      // 引擎 updateCombat 破墙时会把 phase 置 'won'/'lost';统一归一为 'ended'
      if (this._result) state.phase = 'ended';
      return this.status();
    },

    status() { return { phase: state.phase, time: Math.round(state.time * 100) / 100, result: this._result }; },
    result() { return this._result; },
    _test_setWalls(p, e) { if (p != null) { state.playerWallHp = p; } if (e != null) { state.enemyWallHp = e; } },
    _test_clearSide(side) {
      if (side === 1) { state.enemySlots = Array.from({ length: ROWS }, () => Array(COLS).fill(null)); state.enemySoldiers = []; }
      else { state.playerSlots = Array.from({ length: ROWS }, () => Array(COLS).fill(null)); state.playerSoldiers = []; }
    },

    snapshot() {
      const ser = (s) => ({
        id: s.id, side: s.side === 'enemy' ? 1 : 0, type: s.type, level: s.level,
        x: Math.round(s.x * 10) / 10, y: Math.round(s.y * 10) / 10,
        hp: Math.round(s.hp), maxHp: Math.round(s.maxHp), mode: s.mode,
        shield: Math.round(s.shield || 0), hit: s.hitFlash > 0 ? 1 : 0, face: s._faceDir || 0,
      });
      const serBoard = (slots) => slots.map(row => row.map(b => (b ? { type: b.type, level: b.level, sp: Math.round((b.spawnTimer || 0) * 100) / 100 } : null)));
      return {
        t: Math.round(state.time * 100) / 100,
        phase: state.phase,
        result: this._result,
        walls: { p: Math.round(state.playerWallHp), pMax: state.playerWallMax, e: Math.round(state.enemyWallHp), eMax: state.enemyWallMax },
        sp: { p: Math.round(state.sp || 0), e: Math.round(state.enemySp || 0) },
        boards: { p: serBoard(state.playerSlots), e: serBoard(state.enemySlots) },
        soldiers: [...state.playerSoldiers.filter(s => s.alive), ...state.enemySoldiers.filter(s => s.alive)].map(ser),
      };
    },
  };
})();
`;

function buildSandbox(seed) {
  const seeded = mulberry32((seed >>> 0) || 0x51A2B3C4);
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
    resetAI: () => {}, resetJuiceEconomyForLevel: () => {}, syncProgressUnlocks: () => {}, saveMeta: () => {}, saveAll: () => {},
    dt_global: 1 / 30,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.window.innerWidth = 430;
  sandbox.window.innerHeight = 900;
  sandbox.devicePixelRatio = 1;
  vm.createContext(sandbox);
  vm.runInContext(ENGINE_CODE + DRIVER, sandbox, { filename: 'pvp-battle-bundle.js' });
  return sandbox;
}

class PvpBattle {
  constructor(seed, deckA, deckB) {
    this.seed = (seed >>> 0) || 1;
    this.sb = buildSandbox(this.seed);
    this.sb.__pvp.init(this.seed, deckA || null, deckB || null);
  }
  applyAction(side, action) { return this.sb.__pvp.applyAction(Number(side) === 1 ? 1 : 0, action); }
  tick(dt) { return this.sb.__pvp.tick(dt); }
  snapshot() { return this.sb.__pvp.snapshot(); }
  get result() { return this.sb.__pvp.result(); }
  get phase() { return this.sb.__pvp.status().phase; }
}

module.exports = { PvpBattle, FILES };
