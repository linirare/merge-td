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
  'js/world_theme.js',
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
  'js/opening_and_projectile_fix.js',
  'js/skill_system_v70.js',
  'js/free_battle_v2.js',
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
  const WALL = (typeof PVP_WALL_HP === 'number' ? PVP_WALL_HP : 240);
  const MAXS = (typeof MAX_SOLDIERS === 'number' ? MAX_SOLDIERS : 60);
  const WAVE_INTERVAL = 3;
  const COMMANDER_IDS = ['orchard_lord', 'berry_general', 'juice_sage'];

  function makeCommander(id) {
    const safe = COMMANDER_IDS.includes(id) ? id : 'orchard_lord';
    const maxCd = safe === 'berry_general' ? 27 : safe === 'juice_sage' ? 26 : 24;
    return { id: safe, cd: 0, maxCd, active: 0 };
  }

  // 复刻 main.js 的出兵(归一化:不带养成 mul),稳定 id 供快照对齐
  function spawnFromBall(ball, r, c, side, forced) {
    const group = side === 'player' ? state.playerSoldiers : state.enemySoldiers;
    if (group.filter(s => s.alive).length >= MAXS) return null;
    const center = slotCenter(r, c, side === 'enemy');
    const soldier = createSoldier(ball.type, ball.level);
    const n = ++globalThis.__pvp._spawn[side];
    soldier.x = freeSpawnX(ball.type, n, side, c);
    soldier.y = center.y;
    soldier.side = side;
    soldier.laneIndex = 0;
    soldier.laneX = soldier.x;
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
    const count = Math.max(0, Number(globalThis.__pvp._actions[sideName] || 0));
    const cfg = typeof TUNING !== 'undefined' && TUNING.juice ? TUNING.juice : {};
    const curve = Array.isArray(cfg.actionCostCurve) ? cfg.actionCostCurve : [1,1,2,2,3,3,4,4,5,6];
    return Math.min(Number(cfg.maxActionCost || 12), Number(curve[Math.min(count, curve.length - 1)] || 1));
  }
  function spendJuice(sideName, cost) {
    const key = sideName === 'enemy' ? 'enemySp' : 'sp';
    if (Number(state[key] || 0) < cost) return false;
    state[key] = Number(state[key] || 0) - cost;
    globalThis.__pvp._actions[sideName] = Number(globalThis.__pvp._actions[sideName] || 0) + 1;
    return true;
  }

  globalThis.__pvp = {
    _spawn: { player: 0, enemy: 0 },
    _actions: { player: 0, enemy: 0 },
    _decks: { player: DEFAULT_DECK.slice(), enemy: DEFAULT_DECK.slice() },
    _commanders: { player: makeCommander('orchard_lord'), enemy: makeCommander('orchard_lord') },
    _result: null,

    init(seed, deckA, deckB, commanderA, commanderB) {
      state = createState();
      state.mode = 'pvp';
      state.phase = 'playing';
      state.playerWallHp = state.playerWallMax = WALL;
      state.enemyWallHp = state.enemyWallMax = WALL;
      state.playerSlots = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      state.enemySlots = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      state.playerSoldiers = [];
      state.enemySoldiers = [];
      state.sp = Number(typeof TUNING !== 'undefined' && TUNING.juice ? TUNING.juice.start : 8) || 8;
      state.enemySp = state.sp;
      state.summonCostCounter = 1;
      state.enemySummonCostCounter = 1;
      state.time = 0;
      state._spTimer = 0;
      state._waveTimer = 0;
      state.currentLevel = 1;
      state.levelConfig = { id: 1, isBoss: false, enemyInitLevel: 1, enemyWallHp: state.enemyWallMax, enemySpawnInterval: 999999, reward: 0, desc: 'PVP' };
      state.laneStats = (typeof emptyLaneStats === 'function' ? emptyLaneStats() : []);
      this._spawn = { player: 0, enemy: 0 };
      this._actions = { player: 0, enemy: 0 };
      this._decks = {
        player: (typeof normalizeDeck === 'function' ? normalizeDeck(deckA || DEFAULT_DECK) : (deckA || DEFAULT_DECK)).slice(),
        enemy: (typeof normalizeDeck === 'function' ? normalizeDeck(deckB || DEFAULT_DECK) : (deckB || DEFAULT_DECK)).slice(),
      };
      this._commanders = { player: makeCommander(commanderA), enemy: makeCommander(commanderB) };
      this._result = null;
    },

    // side: 0=player, 1=enemy
    applyAction(side, action) {
      if (!action || state.phase !== 'playing') return { ok: false, err: 'not_playing' };
      const slots = side === 1 ? state.enemySlots : state.playerSlots;
      const sideName = side === 1 ? 'enemy' : 'player';
      const p = action.payload || {};
      try {
        if (action.type === 'summon_cell') {
          if (!Number.isInteger(p.r) || !Number.isInteger(p.c) || p.r < 0 || p.r >= ROWS || p.c < 0 || p.c >= COLS) return { ok: false, err: 'bad_cell' };
          if (!slots[p.r] || slots[p.r][p.c]) return { ok: false, err: 'cell_occupied' };
          if (!this._decks[sideName].includes(p.type)) return { ok: false, err: 'type_not_in_deck' };
          if (Number(p.level || 1) !== 1) return { ok: false, err: 'level_must_be_one' };
          const cost = actionCost(sideName);
          if (!spendJuice(sideName, cost)) return { ok: false, err: 'not_enough_juice' };
          const b = createBall(p.type, 1);
          b.spawnTimer = 2.2;
          slots[p.r][p.c] = b;
        } else if (action.type === 'move_cell') {
          const r = tryMove(slots, p.fromR, p.fromC, p.toR, p.toC);
          if (!r || !r.moved) return { ok: false, err: 'move_fail' };
        } else if (action.type === 'merge_or_swap_cell') {
          const r = tryMerge(slots, p.fromR, p.fromC, p.toR, p.toC);
          if (!r) return { ok: false, err: 'merge_fail' };
        } else if (action.type === 'urgent_dispatch') {
          const ball = slots[p.r] && slots[p.r][p.c];
          if (!ball) return { ok: false, err: 'empty_cell' };
          const cost = actionCost(sideName);
          if (!spendJuice(sideName, cost)) return { ok: false, err: 'not_enough_juice' };
          spawnFromBall(ball, p.r, p.c, sideName, true);
          ball.spawnTimer = Math.max(ball.spawnTimer || 0, 1.2);
        } else if (action.type === 'commander_skill') {
          const commander = this._commanders[sideName];
          if (!commander || commander.cd > 0) return { ok: false, err: 'commander_cooldown' };
          commander.cd = commander.maxCd;
          if (commander.id === 'orchard_lord') {
            commander.active = 6;
            for (const row of slots) for (const ball of row) if (ball) ball.spawnTimer = Math.max(0, (ball.spawnTimer || 0) - 2);
          } else if (commander.id === 'berry_general') {
            commander.active = 5;
            const wallKey = sideName === 'player' ? 'playerWallHp' : 'enemyWallHp';
            const maxKey = sideName === 'player' ? 'playerWallMax' : 'enemyWallMax';
            state[wallKey] = Math.min(state[maxKey], state[wallKey] + Math.round(state[maxKey] * 0.12));
          } else {
            commander.active = 8;
            const spKey = sideName === 'player' ? 'sp' : 'enemySp';
            state[spKey] = Math.min(typeof SP_MAX === 'number' ? SP_MAX : 24, Number(state[spKey] || 0) + 5);
          }
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
      const cap = typeof SP_MAX === 'number' ? SP_MAX : 24;
      while (state._spTimer >= pi) {
        state._spTimer -= pi;
        state.sp = Math.min(cap, (state.sp || 0) + 1);
        state.enemySp = Math.min(cap, (state.enemySp || 0) + 1);
      }
      for (const sideName of ['player', 'enemy']) {
        const commander = this._commanders[sideName];
        commander.cd = Math.max(0, commander.cd - dt);
        commander.active = Math.max(0, commander.active - dt);
        if (commander.id === 'orchard_lord' && commander.active > 0) {
          const slots = sideName === 'player' ? state.playerSlots : state.enemySlots;
          const soldiers = sideName === 'player' ? state.playerSoldiers : state.enemySoldiers;
          for (const row of slots) for (const ball of row) if (ball) ball.spawnTimer = Math.max(0, (ball.spawnTimer || 0) - dt * 0.45);
          for (const soldier of soldiers) if (soldier && soldier.alive) soldier.atkTimer = Math.max(0, (soldier.atkTimer || 0) - dt * 0.30);
        }
      }

      state._waveTimer = (state._waveTimer || 0) + dt;
      let waveReady = false;
      if (state._waveTimer >= WAVE_INTERVAL) {
        state._waveTimer -= WAVE_INTERVAL;
        waveReady = true;
      }

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
          if (waveReady && ball.spawnTimer <= 0) {
            ball.spawnTimer += ((typeof SPAWN_COOLDOWNS !== 'undefined' && SPAWN_COOLDOWNS[ball.level]) || (typeof SPAWN_COOLDOWNS !== 'undefined' && SPAWN_COOLDOWNS[1]) || 3);
            spawnFromBall(ball, r, c, g.side);
          }
        }
      }

      updateCombat();
      // 敌军一旦贴墙，该路普通补兵暂缓；玩家仍可花果汁“急派”救线。
      // 这给清线成功的一方形成真实破墙窗口，避免无限门口续兵。

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
        hp: Math.round(s.hp), maxHp: Math.round(s.maxHp), target: s.target || null, mode: s.mode,
        shield: Math.round(s.shield || 0), hit: s.hitFlash > 0 ? 1 : 0, face: s._faceDir || 0,
      });
      const serBoard = (slots) => slots.map(row => row.map(b => (b ? { type: b.type, level: b.level, sp: Math.round((b.spawnTimer || 0) * 100) / 100 } : null)));
      return {
        t: Math.round(state.time * 100) / 100,
        phase: state.phase,
        result: this._result,
        walls: { p: Math.round(state.playerWallHp), pMax: state.playerWallMax, pShield:Math.round(state.playerReefShield||0), e: Math.round(state.enemyWallHp), eMax: state.enemyWallMax, eShield:Math.round(state.enemyReefShield||0) },
        sp: { p: Math.round(state.sp || 0), e: Math.round(state.enemySp || 0) },
        boards: { p: serBoard(state.playerSlots), e: serBoard(state.enemySlots) },
        commanders: {
          p: { ...this._commanders.player, cd: Math.round(this._commanders.player.cd * 100) / 100, active: Math.round(this._commanders.player.active * 100) / 100 },
          e: { ...this._commanders.enemy, cd: Math.round(this._commanders.enemy.cd * 100) / 100, active: Math.round(this._commanders.enemy.active * 100) / 100 },
        },
        soldiers: [...state.playerSoldiers.filter(s => s.alive), ...state.enemySoldiers.filter(s => s.alive)].map(ser),
        tide: worldTideState(state.time),
        battlePressure: state.battlePressure,
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
    setTimeout: () => { console.warn('[pvp-sim] setTimeout called in sandbox — async not supported'); return 0; }, clearTimeout: () => {}, setInterval: () => { console.warn('[pvp-sim] setInterval called in sandbox — async not supported'); return 0; }, clearInterval: () => {},
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
  constructor(seed, deckA, deckB, commanderA, commanderB) {
    this.seed = (seed >>> 0) || 1;
    this.sb = buildSandbox(this.seed);
    this.sb.__pvp.init(this.seed, deckA || null, deckB || null, commanderA || 'orchard_lord', commanderB || 'orchard_lord');
  }
  applyAction(side, action) { return this.sb.__pvp.applyAction(Number(side) === 1 ? 1 : 0, action); }
  tick(dt) { return this.sb.__pvp.tick(dt); }
  snapshot() { return this.sb.__pvp.snapshot(); }
  get result() { return this.sb.__pvp.result(); }
  get phase() { return this.sb.__pvp.status().phase; }
}

module.exports = { PvpBattle, FILES };
