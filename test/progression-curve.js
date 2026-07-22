/* 球球英雄二 · 养成曲线结构守卫 */
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const config = fs.readFileSync(path.join(__dirname, '..', 'js', 'config.js'), 'utf8');
const sandbox = { console, Math, JSON };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(config + `
  ;globalThis.__CURVES__ = {
    merge: LEVEL_MUL.slice(),
    spawn: SPAWN_COOLDOWNS.slice(),
    hero: Array.from({length:HERO_MAX}, (_,i) => heroMul(i+1)),
    frag: Array.from({length:HERO_MAX-1}, (_,i) => heroFragCost(i+1)),
    gold: Array.from({length:HERO_MAX-1}, (_,i) => heroGoldCost(i+1)),
    recommended: Array.from({length:20}, (_,i) => recommendedHeroLevel(i+1)),
  };
`, sandbox, { filename: 'progression-curve.vm.js' });

const c = sandbox.__CURVES__;
assert.strictEqual(c.merge.length, 8, '局内合成必须覆盖 Lv1-7');
for (let i = 2; i < c.merge.length; i++) {
  assert.ok(c.merge[i] > c.merge[i - 1], `Lv${i}→Lv${i + 1} 必须正成长`);
  const ratio = c.merge[i] / c.merge[i - 1];
  assert.ok(ratio >= 1.15 && ratio <= 1.35, `局内倍率跳变过陡/过平: ${ratio.toFixed(3)}`);
}
for (let i = 2; i < c.spawn.length; i++) {
  assert.ok(c.spawn[i] < c.spawn[i - 1], '合成升级后出兵间隔必须下降');
  assert.ok(c.spawn[i - 1] / c.spawn[i] <= 1.30, '单级出兵频率跳变不得超过 30%');
  const previousOutput = c.merge[i - 1] / c.spawn[i - 1];
  const currentOutput = c.merge[i] / c.spawn[i];
  const productionGrowth = currentOutput / previousOutput;
  assert.ok(productionGrowth >= 1.35 && productionGrowth <= 1.60, `兵营总产能成长必须平滑: ${productionGrowth.toFixed(3)}`);
}
assert.ok(Math.abs(c.hero[0] - 1) < 1e-9, '局外 Lv1 必须为 1.0x');
assert.ok(c.hero.at(-1) <= 1.50, '局外 Lv20 不得用纯数值压过局内策略');
assert.strictEqual(c.recommended[0], 1, '第1关推荐英雄等级应为 Lv1');
assert.strictEqual(c.recommended[19], 13, '第20关推荐英雄等级应为 Lv13');
for (let i = 1; i < c.recommended.length; i++) assert.ok(c.recommended[i] >= c.recommended[i - 1], '推荐英雄等级必须单调');
for (const curve of [c.frag, c.gold]) {
  for (let i = 1; i < curve.length; i++) assert.ok(curve[i] >= curve[i - 1], '养成成本必须单调');
}
assert.ok(c.frag.at(-1) <= 120, '碎片成本不得指数爆炸');

console.log(`OK: smooth progression — merge x${c.merge[1]}→x${c.merge.at(-1)}, hero x${c.hero[0]}→x${c.hero.at(-1).toFixed(3)}, max frag ${c.frag.at(-1)}`);
