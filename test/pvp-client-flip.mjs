/* 阶段3 验证:客户端"快照→本地state(含视角翻转)"映射。用 __pvpTest 钩子,不起真两人对局。 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const results = [];
const check = (name, cond, extra = '') => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);

const FAKE_SNAP = {
  t: 5, phase: 'playing', result: null,
  walls: { p: 500, pMax: 600, e: 400, eMax: 600 },
  sp: { p: 10, e: 8 },
  boards: { p: Array.from({ length: 3 }, () => Array(5).fill(null)), e: Array.from({ length: 3 }, () => Array(5).fill(null)) },
  soldiers: [
    { id: 'player-1', side: 0, type: 'grape_archer', level: 1, x: 100, y: 720, hp: 30, maxHp: 30, mode: 'march', shield: 0, hit: 0, face: -1 },
    { id: 'enemy-1', side: 1, type: 'banana_raider', level: 1, x: 120, y: 210, hp: 25, maxHp: 25, mode: 'march', shield: 0, hit: 0, face: 1 },
  ],
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

const hasHook = await page.evaluate(() => !!(window.__pvpTest && window.pvpClientUpdate));
check('__pvpTest / pvpClientUpdate 已挂载', hasHook);

// —— side1 视角:我方(side1)应翻到底部 + 我墙=服务端 e 墙 ——
const r1 = await page.evaluate((snap) => {
  state.mode = 'pvp'; state.phase = 'playing'; state.drag = null;
  window.__pvpTest.setSide(1);
  window.__pvpTest.applySnapshot(snap);
  const mirror = window.__pvpTest.fieldMirrorY;
  return {
    playerIds: state.playerSoldiers.map(s => s.id),
    enemyIds: state.enemySoldiers.map(s => s.id),
    myUnitY: state.playerSoldiers[0] && state.playerSoldiers[0].y,
    expectMyY: mirror(210),
    opUnitY: state.enemySoldiers[0] && state.enemySoldiers[0].y,
    expectOpY: mirror(720),
    pWall: state.playerWallHp, eWall: state.enemyWallHp,
    sp: state.sp, esp: state.enemySp,
  };
}, FAKE_SNAP);
check('side1: 我方=side1单位(enemy-1)', JSON.stringify(r1.playerIds) === JSON.stringify(['enemy-1']), 'player=' + r1.playerIds);
check('side1: 对方=side0单位(player-1)', JSON.stringify(r1.enemyIds) === JSON.stringify(['player-1']), 'enemy=' + r1.enemyIds);
check('side1: 我方 y 已翻转到底部', Math.abs(r1.myUnitY - r1.expectMyY) < 0.5 && r1.myUnitY > 210, `y=${r1.myUnitY} expect=${r1.expectMyY}`);
check('side1: 对方 y 已翻转', Math.abs(r1.opUnitY - r1.expectOpY) < 0.5, `y=${r1.opUnitY} expect=${r1.expectOpY}`);
check('side1: 我墙=服务端e墙(400)', r1.pWall === 400 && r1.eWall === 500, `p=${r1.pWall} e=${r1.eWall}`);
check('side1: 我果汁=服务端e(8)', r1.sp === 8 && r1.esp === 10, `sp=${r1.sp} esp=${r1.esp}`);

// —— side0 视角:不翻转 ——
const r0 = await page.evaluate((snap) => {
  state.playerSoldiers = []; state.enemySoldiers = [];
  window.__pvpTest.setSide(0);
  window.__pvpTest.applySnapshot(snap);
  return {
    playerIds: state.playerSoldiers.map(s => s.id),
    myUnitY: state.playerSoldiers[0] && state.playerSoldiers[0].y,
    pWall: state.playerWallHp, eWall: state.enemyWallHp,
  };
}, FAKE_SNAP);
check('side0: 我方=side0单位(player-1)', JSON.stringify(r0.playerIds) === JSON.stringify(['player-1']), 'player=' + r0.playerIds);
check('side0: 我方 y 不翻转(=720)', r0.myUnitY === 720, 'y=' + r0.myUnitY);
check('side0: 我墙=服务端p墙(500)', r0.pWall === 500 && r0.eWall === 400, `p=${r0.pWall} e=${r0.eWall}`);

console.log('\n===== 阶段3 客户端快照映射 + 视角翻转 验证 =====');
results.forEach(r => console.log('  ' + r));
console.log('  页面报错: ' + (errs.length ? errs.slice(0, 5).join(' | ') : 'none'));
await browser.close();
process.exit(results.some(r => r.startsWith('FAIL')) || errs.length ? 1 : 0);
