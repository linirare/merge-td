/* 两玩家端到端:Playwright 开 2 个隔离上下文当 2 个玩家,跑真 PvP,抓 console + 校验快照/翻转/结算 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const PW = 'pw123456';
const stamp = Date.now();
const emailA = `e2e_a_${stamp}@x.com`;
const emailB = `e2e_b_${stamp}@x.com`;

const logs = { A: [], B: [] };
function hook(page, tag) {
  page.on('console', m => { const t = m.text(); if (/\[PVP\]|error|Error/i.test(t)) logs[tag].push(t); });
  page.on('pageerror', e => logs[tag].push('PAGEERROR: ' + e.message));
}

async function register(page, email, nick) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.waitForSelector('#hifiLoginGate', { timeout: 6000 });
  await page.click('#hifiLoginGate [data-g="register"]');
  await page.waitForTimeout(200);
  await page.fill('#gEmail', email);
  await page.fill('#gPass', PW);
  if (await page.locator('#gNick').count()) await page.fill('#gNick', nick);
  await page.click('#gGo');
  await page.waitForFunction(() => !document.getElementById('hifiLoginGate'), { timeout: 6000 });
}

async function snapState(page) {
  return page.evaluate(() => {
    const st = (typeof state !== 'undefined') ? state : {};
    const avgY = arr => (arr && arr.length ? Math.round(arr.reduce((s, x) => s + x.y, 0) / arr.length) : null);
    return {
      mode: st.mode, phase: st.phase,
      idx: (window.pvpClient && window.pvpClient.getStatus().playerIndex),
      pSold: (st.playerSoldiers || []).length, eSold: (st.enemySoldiers || []).length,
      pWall: st.playerWallHp, eWall: st.enemyWallHp,
      pAvgY: avgY(st.playerSoldiers), eAvgY: avgY(st.enemySoldiers),
      shake: Math.round((st.shake || 0) * 100) / 100,
      resultPanel: !document.getElementById('resultPanel')?.classList.contains('hide'),
      resultTitle: document.getElementById('resultTitle')?.textContent || '',
    };
  });
}

const browser = await chromium.launch();
const ctxA = await browser.newContext({ viewport: { width: 390, height: 844 } });
const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 } });
const pageA = await ctxA.newPage(); hook(pageA, 'A');
const pageB = await ctxB.newPage(); hook(pageB, 'B');

const out = [];
try {
  await register(pageA, emailA, '玩家A');
  await register(pageB, emailB, '玩家B');
  out.push('注册完成 A/B(隔离上下文)');

  // A 建房
  const roomId = await pageA.evaluate(() => new Promise(res => {
    window.pvpClient.createRoom();
    let n = 0; const t = setInterval(() => { const s = window.pvpClient.getStatus(); if (s.roomId) { clearInterval(t); res(s.roomId); } if (++n > 60) { clearInterval(t); res(''); } }, 100);
  }));
  out.push('A 建房 roomId=' + roomId);
  if (!roomId) throw new Error('建房失败');

  // B 加入
  await pageB.evaluate(rid => window.pvpClient.joinRoom(rid), roomId);
  await pageA.waitForTimeout(800);

  // 双方准备
  await pageA.evaluate(() => window.pvpClient.setReady(true));
  await pageB.evaluate(() => window.pvpClient.setReady(true));

  // 等 match_start + 快照流入
  await pageA.waitForTimeout(2500);
  const s1A = await snapState(pageA), s1B = await snapState(pageB);
  out.push('对战中 A: ' + JSON.stringify(s1A));
  out.push('对战中 B: ' + JSON.stringify(s1B));

  // 各召唤一发,观察是否落到本方
  await pageA.evaluate(() => window.pvpClient.localSummon && window.pvpClient.localSummon(2, 0, 1));
  await pageB.evaluate(() => window.pvpClient.localSummon && window.pvpClient.localSummon(2, 4, 1));
  await pageA.waitForTimeout(3000);
  const s2A = await snapState(pageA), s2B = await snapState(pageB);
  out.push('召唤后 A: ' + JSON.stringify(s2A));
  out.push('召唤后 B: ' + JSON.stringify(s2B));

  // 让 B 掉线,验证服务端判 A 胜 + 广播 match_result
  await ctxB.close();
  await pageA.waitForTimeout(2500);
  const s3A = await snapState(pageA);
  out.push('B掉线后 A: ' + JSON.stringify(s3A));
} catch (e) {
  out.push('EXCEPTION: ' + e.message);
} finally {
  out.push('\n--- A console(仅 PVP/error)---\n  ' + (logs.A.join('\n  ') || '(空)'));
  out.push('--- B console(仅 PVP/error)---\n  ' + (logs.B.join('\n  ') || '(空)'));
  await browser.close();
}
console.log('\n===== PvP 两玩家 e2e =====');
out.forEach(l => console.log(l));
