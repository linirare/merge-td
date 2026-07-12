/* 阶段1 单测:server/pvp-sim.js 权威战斗模拟 */
const assert = require('assert');
const { PvpBattle } = require('../server/pvp-sim');

const DECK_A = ['watermelon_guard', 'grape_archer', 'banana_raider', 'pineapple_lancer', 'orange_cannon'];
const DECK_B = ['pineapple_lancer', 'banana_raider', 'grape_archer', 'watermelon_guard', 'orange_cannon'];

// —— 被动局:只验模拟"活着"(结构/出兵/掉墙),不强求胜负(对称被动本就可能平) ——
function runPassive(seed) {
  const b = new PvpBattle(seed, DECK_A, DECK_B);
  const s0 = b.snapshot();
  assert.ok(s0.walls && s0.walls.p > 0 && s0.walls.e > 0, 'snapshot 应含双方城墙');
  assert.strictEqual(s0.walls.p, s0.walls.e, 'v1 双方等墙');
  assert.ok(s0.boards && s0.boards.p && s0.boards.e, 'snapshot 应含双方棋盘');
  assert.ok(Array.isArray(s0.soldiers), 'snapshot.soldiers 是数组');

  // 双方各召唤,验证 applyAction 命中不同 side
  const rp = b.applyAction(0, { type: 'summon_cell', payload: { r: 2, c: 0, type: 'orange_cannon', level: 1 } });
  const re = b.applyAction(1, { type: 'summon_cell', payload: { r: 2, c: 4, type: 'orange_cannon', level: 1 } });
  assert.ok(rp.ok, 'player 召唤应成功: ' + JSON.stringify(rp));
  assert.ok(re.ok, 'enemy 召唤应成功: ' + JSON.stringify(re));
  const sB = b.snapshot();
  assert.ok(sB.boards.p[2][0] && sB.boards.e[2][4], '双方棋盘应落球');
  const dup = b.applyAction(0, { type: 'summon_cell', payload: { r: 2, c: 0, type: 'grape_archer', level: 1 } });
  assert.ok(!dup.ok && dup.err === 'cell_occupied', '占位召唤应拒: ' + JSON.stringify(dup));

  let sawSoldiers = false, sawWallDmg = false, maxSoldiers = 0;
  for (let f = 0; f < 120 * 30; f++) { // 拉长至120s(MAX_SOLDIERS 14后需更久破墙)
    b.tick(1 / 30);
    if (f % 30 === 0) {
      const snap = b.snapshot();
      maxSoldiers = Math.max(maxSoldiers, snap.soldiers.length);
      if (snap.soldiers.length > 0) sawSoldiers = true;
      if (snap.walls.p < snap.walls.pMax || snap.walls.e < snap.walls.eMax) sawWallDmg = true;
    }
    if (b.result) break;
  }
  assert.ok(sawSoldiers, '战斗中应出现士兵(球自动出兵)');
  assert.ok(sawWallDmg, '战斗中城墙应掉血(进攻能推进)');
  return { maxSoldiers, snap: b.snapshot() };
}

// —— 胜负局:清空 side1 防守 + 敌墙压低,side0 开局攻势无阻力破墙 → winner 0 ——
function runWinner(seed) {
  const b = new PvpBattle(seed, DECK_A, DECK_B);
  b.sb.__pvp._test_clearSide(1);      // side1 无防守
  b.sb.__pvp._test_setWalls(null, 40); // 敌墙压到 40
  for (let f = 0; f < 90 * 30; f++) {
    b.tick(1 / 30);
    if (b.result) break;
  }
  assert.ok(b.result, '无防守+低墙时应分出胜负');
  assert.strictEqual(b.result.winner, 0, 'side0 攻势破敌墙 → winner 0: ' + JSON.stringify(b.result));
  const s = b.snapshot();
  assert.ok(s.walls.e <= 0, '结束时敌墙应破: ' + s.walls.e);
  assert.strictEqual(s.phase, 'ended', 'phase 应为 ended');
  return b.result;
}

(function main() {
  const p1 = runPassive(0xABCDEF01);
  assert.ok(p1.maxSoldiers > 0, '被动局也应出过兵');

  const w1 = runWinner(0x1111AAAA);
  const w2 = runWinner(0x1111AAAA);
  // 跨 vm realm 对象原型不同,deepStrictEqual 会误判;按 JSON 值比对(也是过 WS 的真实语义)
  assert.strictEqual(JSON.stringify(w1), JSON.stringify(w2), '同 seed 胜负局应确定性一致');

  console.log('OK: pvp-sim 权威模拟 — 结构/双side操作/出兵/破墙/胜负判定/确定性 全部通过'
    + ' (被动局峰值兵力=' + p1.maxSoldiers + ', 胜负局 winner=' + w1.winner + '/' + w1.duration + 's)');
})();
