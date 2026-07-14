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
  assert.strictEqual(s0.walls.p, 720, 'PVP 应使用720城墙血量');
  assert.ok(s0.boards && s0.boards.p && s0.boards.e, 'snapshot 应含双方棋盘');
  assert.ok(s0.boards.p.flat().every(v => !v) && s0.boards.e.flat().every(v => !v), 'PVP 应从空棋盘开始');
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
  const summon = b.applyAction(0, { type: 'summon_cell', payload: { r: 2, c: 0, type: 'orange_cannon', level: 1 } });
  assert.ok(summon.ok, '胜负局应先合法召唤一个Lv1兵营');
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

function runAuthorityValidation(seed) {
  const b = new PvpBattle(seed, DECK_A, DECK_B);
  assert.strictEqual(b.snapshot().sp.p, 8, 'PVP 开局果汁应为8');
  assert.strictEqual(b.applyAction(0, { type:'summon_cell', payload:{ r:-1, c:0, type:'orange_cannon', level:1 } }).err, 'bad_cell');
  assert.strictEqual(b.applyAction(0, { type:'summon_cell', payload:{ r:0, c:0, type:'olive_assassin', level:1 } }).err, 'type_not_in_deck');
  assert.strictEqual(b.applyAction(0, { type:'summon_cell', payload:{ r:0, c:0, type:'orange_cannon', level:3 } }).err, 'level_must_be_one');
  const cells = [[0,0],[0,1],[0,2],[0,3]];
  for (const [r,c] of cells) assert.ok(b.applyAction(0, { type:'summon_cell', payload:{ r,c,type:'orange_cannon',level:1 } }).ok, '前四次合法召唤应有足够果汁');
  const denied = b.applyAction(0, { type:'summon_cell', payload:{ r:0,c:4,type:'orange_cannon',level:1 } });
  assert.strictEqual(denied.err, 'not_enough_juice', '服务端必须拒绝果汁不足的召唤');
  assert.strictEqual(b.snapshot().sp.p, 2, '费用曲线1/1/2/2后应剩2果汁');
}

function runCommanderValidation(seed) {
  const b = new PvpBattle(seed, DECK_A, DECK_B, 'juice_sage', 'berry_general');
  assert.strictEqual(b.snapshot().commanders.p.id, 'juice_sage', 'side0主公应进入权威快照');
  assert.strictEqual(b.snapshot().commanders.e.id, 'berry_general', 'side1主公应进入权威快照');
  assert.ok(b.applyAction(0, { type:'commander_skill', payload:{} }).ok, '果汁贤者技能应可释放');
  assert.strictEqual(b.snapshot().sp.p, 13, '果汁贤者应从8补到13果汁');
  assert.strictEqual(b.applyAction(0, { type:'commander_skill', payload:{} }).err, 'commander_cooldown', '冷却中不可重复释放');
  b.sb.__pvp._test_setWalls(null, 500);
  assert.ok(b.applyAction(1, { type:'commander_skill', payload:{} }).ok, '莓果将军技能应可释放');
  assert.ok(b.snapshot().walls.e > 500, '莓果将军应修复本方城墙');
}

function runActiveBreakthrough(seed) {
  const b = new PvpBattle(seed, DECK_A, DECK_A);
  function botAction(side, type) {
    const board = side === 1 ? b.snapshot().boards.e : b.snapshot().boards.p;
    const seen = {};
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
      const ball = board[r][c];
      if (!ball) continue;
      const key = ball.type + '#' + ball.level;
      if (seen[key] && ball.level < 7) {
        const [toR, toC] = seen[key];
        return b.applyAction(side, { type:'merge_or_swap_cell', payload:{ fromR:r, fromC:c, toR, toC } });
      }
      seen[key] = [r, c];
    }
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
      if (!board[r][c]) return b.applyAction(side, { type:'summon_cell', payload:{ r, c, type, level:1 } });
    }
    return { ok:false };
  }
  for (let frame = 0; frame < 180 * 30; frame++) {
    if (frame % 15 === 0) {
      botAction(0, 'orange_cannon');
      if (frame % 30 === 0) botAction(1, 'watermelon_guard');
    }
    b.tick(1 / 30);
    if (b.result) break;
  }
  assert.ok(b.result, '有操作差异的PVP必须在180秒内形成破墙结果');
  assert.ok(b.result.duration >= 60 && b.result.duration <= 120, 'PVP破墙节奏应落在60-120秒: ' + JSON.stringify(b.result));
  const walls = b.snapshot().walls;
  assert.ok(walls.p <= 0 || walls.e <= 0, 'PVP结果必须来自真实破墙');
  return b.result;
}

(function main() {
  const p1 = runPassive(0xABCDEF01);
  assert.ok(p1.maxSoldiers > 0, '被动局也应出过兵');
  assert.ok(p1.maxSoldiers <= 28, '双方各14兵，总快照不得超过28');
  runAuthorityValidation(0x12345678);
  runCommanderValidation(0x87654321);
  const active = runActiveBreakthrough(123);

  const w1 = runWinner(0x1111AAAA);
  const w2 = runWinner(0x1111AAAA);
  // 跨 vm realm 对象原型不同,deepStrictEqual 会误判;按 JSON 值比对(也是过 WS 的真实语义)
  assert.strictEqual(JSON.stringify(w1), JSON.stringify(w2), '同 seed 胜负局应确定性一致');

  console.log('OK: pvp-sim 权威模拟 — 结构/双side操作/出兵/破墙/胜负判定/确定性 全部通过'
    + ' (双方峰值总兵力=' + p1.maxSoldiers + '/28, 正常对抗=' + active.duration + 's, 低墙确定性局=' + w1.duration + 's)');
})();
