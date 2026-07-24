const fs = require('fs');
const vm = require('vm');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'config.js'), 'utf8');
const sandbox = { console, window: {}, Math, global: {}, setTimeout, clearTimeout, Date };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

console.log('LEVEL_MUL:', JSON.stringify(sandbox.LEVEL_MUL));
console.log('SP_MAX:', sandbox.SP_MAX);
console.log('BASE_WALL_HP:', sandbox.BASE_WALL_HP);
console.log('WALL_PER_LV:', sandbox.WALL_PER_LV);

const st = sandbox.TUNING?.stages;
if (st) {
  st.forEach(s => console.log('Stage', s.stageId, 'enemyWall:', s.enemyWallHp, 'lv:', s.enemyLevel, 'boss:', s.isBoss));
}
