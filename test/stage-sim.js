const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const files = ['js/config.js', 'js/state.js', 'js/balance_sim.js'];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seeded = mulberry32(0x46525549);
const sandbox = {
  console,
  JSON,
  Math: new Proxy(Math, { get: (target, prop) => (prop === 'random' ? seeded : target[prop]) }),
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  clamp01: value => Math.max(0, Math.min(1, value)),
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

const driver = `
;(function () {
  const rows = [];
  for (let k = 1; k <= 20; k++) rows.push(estimateStage(k, 40));
  globalThis.__STAGE_SIM__ = rows;
})();
`;

vm.createContext(sandbox);
vm.runInContext(files.map(file => fs.readFileSync(path.join(ROOT, file), 'utf8')).join('\n') + driver, sandbox, { filename: 'stage-sim-bundle.js' });

const rows = sandbox.__STAGE_SIM__;
assert.strictEqual(rows.length, 20, 'stage sim should cover stages 1-20');
for (const row of rows) {
  assert.ok(row.level >= 1 && row.level <= 20, 'level should be in range');
  assert.ok(row.winRate >= 0 && row.winRate <= 100, `stage ${row.level} winRate out of range`);
  assert.ok(row.avgTime > 0 && row.avgTime <= 180, `stage ${row.level} avgTime out of range`);
  assert.ok(row.avgWallLeft >= 0 && row.avgWallLeft <= 100, `stage ${row.level} wall left out of range`);
  assert.ok(row.reward > 0, `stage ${row.level} reward missing`);
  assert.ok(typeof row.fail === 'string' && row.fail, `stage ${row.level} fail reason missing`);
}

const bosses = rows.filter(row => row.boss);
assert.strictEqual(bosses.length, 0, 'boss stages are temporarily disabled');
console.log('OK: stage estimator runs stages 1-20 with structured output');
