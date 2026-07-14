const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '..');
const files = ['js/config.js', 'js/layout_v56.js', 'js/state.js', 'js/hooks.js', 'js/board.js', 'js/combat.js'];
const code = files.map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
const sandbox = {
  console, Math, JSON,
  window: {},
  document: { getElementById: () => null },
  localStorage: { getItem: () => null, setItem: () => {} },
  addFx: () => {}, playSfx: () => {}, onGameOver: () => {},
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code + `
  globalThis.__reach = {
    top: fieldTop(), bottom: fieldBottom(),
    player: wallDataFor({side:'player'}).attackY,
    enemy: wallDataFor({side:'enemy'}).attackY,
  };
`, sandbox);

const r = sandbox.__reach;
assert.strictEqual(r.player, r.top, 'player melee wall line must be reachable at field top');
assert.strictEqual(r.enemy, r.bottom, 'enemy melee wall line must be reachable at field bottom');
assert.ok(r.player < r.enemy, 'battlefield must have positive traversal distance');
console.log(`OK: melee wall contact lines are reachable (${r.player}..${r.enemy})`);
