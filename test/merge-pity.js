const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'juice_economy.js'), 'utf8');
const sequence = ['b', 'c', 'd'];
const sandbox = {
  console,
  Math: Object.assign(Object.create(Math), { random: () => 0 }),
  window: {},
  state: {
    phase: 'menu', mode: 'pve',
    playerSlots: [[{ type:'a', level:1 }, null, null, null, null]],
    enemySlots: [[null, null, null, null]],
    levelConfig: { enemyPlan: { opening:['tank', 'rush'] } },
    sp: 8,
  },
  TUNING: { juice: { passiveInterval:5, enemyActionInterval:4, maxActionCost:12 } },
  SP_MAX: 24,
  MAX_LEVEL: 7,
  activeDeck: () => ['a', 'b', 'c', 'd'],
  randomType: () => sequence.shift() || 'd',
  TYPES: { tank:{}, rush:{} },
  ENEMY_POOL: ['tank', 'rush'],
  normalizeTypeId: id => id,
  emptySlots: slots => {
    const out = [];
    for (let r = 0; r < slots.length; r++) for (let c = 0; c < slots[r].length; c++) if (!slots[r][c]) out.push([r, c]);
    return out;
  },
  createBall: (type, level) => ({ type, level }),
  randomEnemyType: () => 'tank',
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'juice_economy.js' });

function place(type) {
  const row = sandbox.state.playerSlots[0];
  row[row.findIndex(v => !v)] = { type, level:1 };
  sandbox.noteSmoothSummonV1();
}

place(sandbox.pickSmoothSummonTypeV1(['a', 'b', 'c', 'd']));
assert.strictEqual(sandbox.state._summonsWithoutPair, 1, 'first miss tracked');
place(sandbox.pickSmoothSummonTypeV1(['a', 'b', 'c', 'd']));
assert.strictEqual(sandbox.state._summonsWithoutPair, 2, 'second miss tracked');
const pityType = sandbox.pickSmoothSummonTypeV1(['a', 'b', 'c', 'd']);
assert.ok(['a', 'b', 'c'].includes(pityType), 'third summon should copy an existing Lv1 type');
place(pityType);
assert.strictEqual(sandbox.state._summonsWithoutPair, 0, 'forming a pair resets pity');

sandbox.autoSpawnEnemyPlanBallV1(1);
sandbox.autoSpawnEnemyPlanBallV1(1);
const enemyTypes = sandbox.state.enemySlots.flat().filter(Boolean).map(ball => ball.type);
assert.deepStrictEqual(enemyTypes, ['tank', 'rush'], 'enemy reinforcements should rotate through the disclosed stage lineup');
assert.ok(sandbox.state.enemySlots.flat().filter(Boolean).every(ball => ball.level === 1), 'enemy reinforcements must start at Lv1');

console.log('OK: merge pity works; enemy reinforcements use the disclosed lineup and start at Lv1');
