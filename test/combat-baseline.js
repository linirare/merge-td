/* ============================================================
   水果突击 · Combat Regression Baseline (headless, deterministic)
   ------------------------------------------------------------
   Loads the real outcome-determining combat chain (config → … →
   combat_pacing_v19) concatenated into ONE vm script, so top-level
   const/let are shared like browser <script> tags. Math.random is
   replaced by a seeded PRNG, so every run is byte-identical.

   Purpose: a characterization guard for the Phase 1 patch-chain
   consolidation. Capture the snapshot BEFORE refactoring:

       node test/combat-baseline.js --save

   Then after each consolidation step, re-run and diff:

       node test/combat-baseline.js            # prints current
       node test/combat-baseline.js --check     # exits 1 if drifted

   The invariant is OUTCOMES (winner, HP left, wall damage, timing),
   not the internal layering. If the file list changes during
   consolidation, update FILES below; the recorded fingerprint must
   stay within tolerance.
   ============================================================ */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASELINE = path.join(__dirname, 'combat-baseline.json');

// Outcome-determining chain in index.html load order. Pure-visual wrappers
// (juice.js / juice_absorb_v16.js) are omitted: they wrap-and-delegate and
// never change damage math, so outcomes are identical without them.
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
  'js/free_battle_v2.js',
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
  const seeded = mulberry32(0x9E3779B9);
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
    resetAI: () => {}, resetJuiceEconomyForLevel: () => {}, syncProgressUnlocks: () => {},
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
  const R = {};
  const midY = () => LAYOUT.fieldY + LAYOUT.fieldH / 2;

  function fresh() {
    state = createState();
    state.phase = 'playing';
    state.playerWallHp = state.playerWallMax = 600;
    state.enemyWallHp = state.enemyWallMax = 600;
  }
  function place(typeId, level, side, lane, y) {
    const s = createSoldier(typeId, level);
    s.side = side; s.laneIndex = lane; s.laneX = laneXByIndex(lane); s.x = s.laneX; s.y = y;
    s.alive = true; s.battleReady = true; s.protected = false; s.mode = 'march'; s.atkTimer = 0;
    return s;
  }
  function duel(pType, eType, level, pLane, eLane, frames) {
    fresh();
    const p = place(pType, level, 'player', pLane, midY() + 20);
    const e = place(eType, level, 'enemy', eLane, midY() - 20);
    state.playerSoldiers = [p]; state.enemySoldiers = [e];
    const pHp0 = p.hp, eHp0 = e.hp;
    let engage = -1;
    for (let f = 0; f < frames; f++) {
      updateCombat();
      if (engage < 0 && ((p.alive ? p.hp < pHp0 : true) || (e.alive ? e.hp < eHp0 : true))) engage = f;
      if (!p.alive || !e.alive) return { engage, frames: f, winner: p.alive ? 'player' : 'enemy', pHp: Math.max(0, Math.round(p.hp)), eHp: Math.max(0, Math.round(e.hp)) };
    }
    return { engage, frames, winner: 'draw', pHp: Math.max(0, Math.round(p.hp)), eHp: Math.max(0, Math.round(e.hp)), pLane: p.laneIndex, eLane: e.laneIndex };
  }
  function wallDps(typeId, level, frames) {
    fresh();
    const s = place(typeId, level, 'player', 2, midY());
    const wall = wallDataFor(s); s.y = wall.attackY; s.mode = 'siege';
    state.playerSoldiers = [s]; state.enemySoldiers = [];
    const ew0 = state.enemyWallHp;
    for (let f = 0; f < frames; f++) updateCombat();
    return ew0 - state.enemyWallHp;
  }
  function skirmish(frames) {
    fresh();
    const my = midY();
    state.playerSoldiers = [
      place('banana_raider', 3, 'player', 0, my + 30),
      place('pineapple_lancer', 3, 'player', 2, my + 30),
      place('blueberry_sniper', 2, 'player', 4, my + 60),
    ];
    state.enemySoldiers = [
      place('watermelon_guard', 3, 'enemy', 1, my - 30),
      place('lemon_assassin', 3, 'enemy', 2, my - 30),
      place('grape_archer', 2, 'enemy', 3, my - 60),
    ];
    for (let f = 0; f < frames; f++) { updateCombat(); if (state.phase !== 'playing') break; }
    return {
      pAlive: state.playerSoldiers.filter(s => s.alive).length,
      eAlive: state.enemySoldiers.filter(s => s.alive).length,
      pWall: Math.round(state.playerWallHp), eWall: Math.round(state.enemyWallHp),
      phase: state.phase,
    };
  }

  R.duels = {
    banana_vs_watermelon_adjacent: duel('banana_raider', 'watermelon_guard', 3, 1, 2, 360),
    banana_vs_watermelon_sameLane: duel('banana_raider', 'watermelon_guard', 3, 2, 2, 360),
    lemon_vs_pineapple: duel('lemon_assassin', 'pineapple_lancer', 3, 2, 2, 600),
    sniper_vs_banana: duel('blueberry_sniper', 'banana_raider', 3, 2, 2, 600),
    frost_vs_coconut: duel('pear_frost', 'coconut_guard', 3, 2, 2, 900),
  };
  R.wallDps = {
    orange_cannon_600f: wallDps('orange_cannon', 3, 600),
    watermelon_600f: wallDps('watermelon_guard', 3, 600),
    pumpkin_600f: wallDps('pumpkin_roller', 3, 600),
  };
  R.skirmish_900f = skirmish(900);

  // Boss L5 护盾脉冲:初始化 Boss 关,放一个敌方杂兵,tick 10s 看护盾
  function bossShield(){ fresh(); meta.shardsTotal={}; const my=midY(); initLevel(5); state.phase='playing'; state.enemyWallHp=state.enemyWallMax=1e6; const ally=place('grape_archer',2,'enemy',2,my-30); ally.shield=0; state.enemySoldiers.push(ally); for(let f=0;f<105;f++) updateCombat(); return ally.shield||0; }
  R.boss_melon_shield = bossShield();

  // 状态:点燃击杀(低血敌人被 burn tick 杀死)
  function burnKill(){ fresh(); const t=place('grape_archer','enemy',2,200,300); t.hp=5; t.alive=true; t.battleReady=true; t.protected=false; state.enemySoldiers=[t]; state.playerSoldiers=[]; state.enemyWallHp=state.enemyWallMax=1e6; state.playerWallHp=state.playerWallMax=1e6; applyStatus(t,{type:'lemon_assassin',level:3},'burning',3.0); for(let f=0;f<30;f++) updateCombat(); return t.alive; }
  R.status_burn_kill = burnKill();

  // 状态:冰冻封锁(受冻单位跳过 updateSoldier)
  function frozenBlock(){ fresh(); const p=place('banana_raider','player',3,200,300); const e=place('grape_archer','enemy',2,200,340); state.playerSoldiers=[p]; state.enemySoldiers=[e]; state.playerWallHp=state.playerWallMax=1e6; state.enemyWallHp=state.enemyWallMax=1e6; applyStatus(p,{type:'pear_frost',level:6},'frozen',3.0); const y0=p.y; for(let f=0;f<20;f++) updateCombat(); return { moved: Math.round(Math.abs(p.y-y0)), eHp: Math.round(e.hp) }; }
  R.status_frozen_block = frozenBlock();

  // 隐身:不可被锁定(canSeeTarget 返回 false)
  function invisTarget(){ fresh(); const e=place('olive_assassin','enemy',4,2,300); applyStatus(e,e,'invisible',3.0); const p=place('banana_raider','player',3,2,340); return canSeeTarget(p,e); }
  R.status_invis_target = invisTarget();

  // #6 跨路索敌:邻路侧向 70px(>旧上限50,<新上限120)的敌兵应能被锁定(旧代码看不见→径直撞墙)
  function crossLaneEngage(){ fresh(); const my=midY(); const p=place('grape_archer',3,'player',2,my); const e=place('banana_raider',3,'enemy',3,my); e.laneIndex=3; e.x=p.laneX+70; e.laneX=e.x; state.playerSoldiers=[p]; state.enemySoldiers=[e]; const tgt=findTarget(p,state.enemySoldiers); return { sideGap:70, targeted:!!tgt }; }
  R.cross_lane_engage_70px = crossLaneEngage();

  // #10 椰子首盾恢复原版数值:Lv3 应为 maxHp*(0.38+3*0.04)=50%(v17 削弱版是 0.30+3*0.035=40.5%→41%)
  function coconutShield(){ fresh(); const c=place('coconut_guard',3,'player',2,300); c.shield=0; c._firstShield=false; state.playerSoldiers=[c]; state.enemySoldiers=[]; state.enemyWallHp=state.enemyWallMax=1e6; updateCombat(); return { shieldPct: Math.round((c.shield/c.maxHp)*100) }; }
  R.coconut_first_shield_pct = coconutShield();

  globalThis.__BASELINE__ = R;
})();
`;

function run() {
  const code = FILES.map(f => `\n/* ==== ${f} ==== */\n` + fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  const sandbox = buildSandbox();
  vm.createContext(sandbox);
  vm.runInContext(code + DRIVER, sandbox, { filename: 'combat-baseline-bundle.js' });
  return sandbox.__BASELINE__;
}

const mode = process.argv[2];
const result = run();
const json = JSON.stringify(result, null, 2);

if (mode === '--save') {
  fs.writeFileSync(BASELINE, json + '\n');
  console.log('baseline saved to', path.relative(ROOT, BASELINE));
  console.log(json);
} else if (mode === '--check') {
  if (!fs.existsSync(BASELINE)) { console.error('no baseline; run with --save first'); process.exit(2); }
  // 忽略行尾差异(Windows CRLF vs LF / git autocrlf),只比内容
  const norm = s => String(s).replace(/\r\n/g, '\n').trim();
  const prev = norm(fs.readFileSync(BASELINE, 'utf8'));
  if (prev === norm(json)) { console.log('OK: combat outcomes match baseline'); }
  else {
    console.error('DRIFT: combat outcomes differ from baseline\n--- current ---\n' + json);
    process.exit(1);
  }
} else {
  console.log(json);
}
