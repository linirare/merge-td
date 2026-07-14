const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'config.js'), 'utf8');
const sandbox = { console, window: {}, Math };
vm.createContext(sandbox);
vm.runInContext(`${code};globalThis.__pacing={stages:TUNING.stages,juice:TUNING.juice,pve:TUNING.pve,spMax:SP_MAX};`, sandbox);

const { stages, juice, pve, spMax } = sandbox.__pacing;
assert.strictEqual(stages.length, 20, 'pacing guard expects stages 1-20');
for (let i = 1; i < stages.length; i++) {
  const prev = stages[i - 1];
  const cur = stages[i];
  assert.ok(cur.enemyWallHp > prev.enemyWallHp, `stage ${cur.stageId} wall HP must increase`);
  assert.ok(cur.enemyLevel >= prev.enemyLevel, `stage ${cur.stageId} enemy level must not decrease`);
  assert.ok(cur.enemySpawnInterval <= prev.enemySpawnInterval, `stage ${cur.stageId} spawn interval must not get easier`);
  assert.ok(cur.enemyWallHp / prev.enemyWallHp <= 1.20, `stage ${cur.stageId} wall jump should stay <=20%`);
  assert.ok(prev.enemySpawnInterval / cur.enemySpawnInterval <= 1.08, `stage ${cur.stageId} spawn jump should stay <=8%`);
}

assert.strictEqual(spMax, 24, 'base juice cap should be 24');
assert.strictEqual(juice.passiveInterval, 5, 'passive juice cadence should be readable');
assert.strictEqual(juice.wallPityGain, 2, 'wall pity should help without flooding the economy');
assert.deepStrictEqual(Array.from(pve.normalTargetSeconds), [35, 75], 'normal target duration');
assert.deepStrictEqual(Array.from(pve.bossTargetSeconds), [40, 90], 'boss target duration');

console.log('OK: pacing curve is monotonic; juice cap 24; target match 35-90s');
