const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const code = fs.readFileSync(path.join(ROOT, 'js/config.js'), 'utf8');

const driver = `
;(function () {
  const levels = [];
  for (let k = 1; k <= 20; k++) levels.push(generateLevel(k));
  globalThis.__STAGE_CHECK__ = {
    tuningStageCount: TUNING.stages.length,
    levels,
  };
})();
`;

const sandbox = { console, Math, JSON };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code + driver, sandbox, { filename: 'stage-config-bundle.js' });

const result = sandbox.__STAGE_CHECK__;
assert.ok(result.tuningStageCount >= 20, 'TUNING.stages should define at least the first 20 stages');

const ids = new Set();
for (const level of result.levels) {
  assert.ok(!ids.has(level.stageId), `duplicate stageId ${level.stageId}`);
  ids.add(level.stageId);
  assert.ok(level.chapter >= 1, `stage ${level.stageId} needs chapter`);
  assert.ok(['normal', 'mechanic', 'boss', 'resource', 'challenge'].includes(level.type), `stage ${level.stageId} has unknown type`);
  assert.ok(level.enemyWallHp > 0, `stage ${level.stageId} enemy wall hp must be positive`);
  assert.ok(level.enemyInitLevel >= 1, `stage ${level.stageId} enemy level must be positive`);
  assert.ok(level.enemyPlan && (Array.isArray(level.enemyPlan.opening) || Number.isFinite(Number(level.enemyPlan.count))), `stage ${level.stageId} needs enemyPlan`);
  assert.ok(level.reward > 0, `stage ${level.stageId} needs reward`);
  assert.ok(typeof level.tutorialHint === 'string', `stage ${level.stageId} needs tutorialHint`);
  assert.ok(Array.isArray(level.unlockRules), `stage ${level.stageId} needs unlockRules`);
  // 去Boss:5/10/15/20关不再是boss,不强制有bossMechanic(combat-fixes-plan §1)
}

console.log('OK: TUNING stage definitions cover stages 1-20');
