const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILES = [
  'js/world_theme.js',
  'js/config.js',
  'js/layout_v56.js',
  'js/state.js',
  'js/board.js',
  'js/combat.js',
  'js/free_battle_v2.js',
];

function sandbox() {
  const s = {
    console, JSON, Math, Date,
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
    addFx: () => {}, playSfx: () => {}, onGameOver: () => {},
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    setTimeout: () => 0, clearTimeout: () => {},
    dt_global: 1 / 60,
  };
  s.window = s;
  s.globalThis = s;
  return s;
}

const code = FILES.map(file => fs.readFileSync(path.join(ROOT, file), 'utf8')).join('\n');
const s = sandbox();
vm.createContext(s);
vm.runInContext(code + `
  globalThis.__waterWorldTest = {
    theme: WORLD_THEME,
    typeCount: Object.keys(TYPES).length,
    metaVersion: createMeta().themeVersion,
    names: Object.fromEntries(Object.entries(TYPES).map(([id, value]) => [id, value.name])),
    spawnA: freeSpawnX('lemon_assassin', 7, 'player', 0),
    spawnB: freeSpawnX('lemon_assassin', 7, 'player', 4),
    target() {
      state = createState(); state.phase = 'playing';
      const rush = createSoldier('lemon_assassin', 3); Object.assign(rush, { id:'rush', side:'player', x:35, y:520, battleReady:true, protected:false, mode:'march' });
      const tank = createSoldier('watermelon_guard', 3); Object.assign(tank, { id:'tank', side:'enemy', x:100, y:430, battleReady:true, protected:false, mode:'march' });
      const back = createSoldier('blueberry_sniper', 3); Object.assign(back, { id:'back', side:'enemy', x:440, y:425, battleReady:true, protected:false, mode:'march' });
      state.playerSoldiers = [rush]; state.enemySoldiers = [tank, back];
      return findTarget(rush, state.enemySoldiers)?.id;
    },
    tideCalm: worldTideState(3),
    tideSurge: worldTideState(15),
    shield() {
      state = createState(); state.phase = 'playing';
      state.enemyWallMax = 1000; state.enemyWallHp = 310;
      const first = damageReefBarrier('enemy', 20, null);
      const shieldAfterFirst = state.enemyReefShield;
      const second = damageReefBarrier('enemy', 1, null);
      return { first, second, shieldAfterFirst, used: state.enemyReefShieldUsed };
    },
    migrate: migrateWorldThemeSave({ gems:37, fragments:{orange_cannon:9}, fruitLv:{orange_cannon:6}, commanderId:'juice_sage' })
  };
`, s, { filename: 'water-world-test-bundle.js' });

const r = s.__waterWorldTest;
assert.strictEqual(r.theme.productName, '梦幻水世界');
assert.strictEqual(Object.keys(r.theme.units).length, 25);
assert.strictEqual(r.typeCount, 25);
assert.strictEqual(r.metaVersion, 2);
assert.strictEqual(r.names.olive_assassin, '章鱼刺客');
assert.strictEqual(r.names.chill_juice, '冰蛤减耗');
assert.strictEqual(r.spawnA, r.spawnB, '棋盘列不得影响战场出生横坐标');
assert.strictEqual(r.target(), 'back', '游骑兵优先切后排(射手)');
assert.strictEqual(r.tideCalm.phase, 'calm');
assert.strictEqual(r.tideCalm.multiplier, 1);
assert.strictEqual(r.tideSurge.phase, 'surge');
assert.strictEqual(r.tideSurge.multiplier, 1.08);
const shield = r.shield();
assert.strictEqual(shield.shieldAfterFirst, 100);
assert.strictEqual(shield.used, true);
assert.strictEqual(shield.second.absorbed, 1);
assert.deepStrictEqual(JSON.parse(JSON.stringify(r.migrate)), { themeVersion:2, gems:37, fragments:{orange_cannon:9}, fruitLv:{orange_cannon:6}, commanderId:'juice_sage' });
console.log('OK: 梦幻水世界自由战场行为验收通过');
