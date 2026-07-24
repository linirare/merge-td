import { chromium } from 'playwright';

const BASE = process.env.VISUAL_URL || 'http://localhost:3000';

async function debug() {
  const browser = await chromium.launch({ timeout: 30000, args: ['--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(8000);

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(700);

  // login
  const gate = page.locator('#hifiLoginGate');
  if (await gate.count() > 0) {
    await page.evaluate(() => {
      const btn = document.querySelector('#hifiLoginGate [data-g="register"]');
      if (btn) btn.click();
    });
    await page.waitForTimeout(200);
    if (await gate.count() > 0) {
      const stamp = Date.now();
      await page.evaluate(({ email, pass }) => {
        const emailInput = document.querySelector('#gEmail');
        if (emailInput) emailInput.value = email;
        const passInput = document.querySelector('#gPass');
        if (passInput) passInput.value = pass;
        const btn = document.querySelector('#gGo');
        if (btn) btn.click();
      }, { email: `debug3_${stamp}@test.com`, pass: 'test123456' });
      await page.waitForFunction(() => !document.getElementById('hifiLoginGate'), { timeout: 10000 }).catch(() => {});
    }
  }

  // 进入 stage 5 战斗
  await page.evaluate(() => {
    meta.highestLevel = 5;
    state.trainingMode = true;
    if (typeof window.productShellShowTab === 'function') window.productShellShowTab('battle');
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => { if (typeof initLevel === 'function') initLevel(5); });
  await page.waitForFunction(() => typeof state !== 'undefined' && state.phase === 'playing', { timeout: 5000 }).catch(() => {});

  // 部署高等级球（Lv.5）
  await page.evaluate(() => {
    state.sp = 99;
    const types = ['watermelon_guard', 'banana_raider', 'grape_archer', 'orange_cannon', 'pear_frost',
                   'cherry_bomber', 'peach_mage', 'olive_assassin'];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 5; c++) {
        const idx = (r * 5 + c) % types.length;
        if (!state.playerSlots?.[r]?.[c]) summonFruitAt(r, c);
        const ball = state.playerSlots?.[r]?.[c];
        if (ball) {
          ball.type = types[idx];
          ball.level = 5; // max level for testing
          ball.spawnTimer = 0.05;
        }
      }
    }
    state.sp = 99;
  });
  await page.waitForTimeout(1000);

  // 小步 tick 看战斗过程
  const snapshot = async label => page.evaluate(l => {
    const pSoldiers = (state.playerSoldiers || []).filter(s => s?.alive);
    const eSoldiers = (state.enemySoldiers || []).filter(s => s?.alive);
    // 检查战士的 hp/atk
    const pSample = pSoldiers.slice(0, 2).map(s => ({ type: s.type, lv: s.level, hp: Math.round(s.hp), atk: Math.round(s.atk), mode: s.mode, lane: s.laneIndex }));
    const eSample = eSoldiers.slice(0, 2).map(s => ({ type: s.type, lv: s.level, hp: Math.round(s.hp), atk: Math.round(s.atk), mode: s.mode, lane: s.laneIndex }));
    return {
      label: l,
      phase: state.phase, roundPhase: state.roundPhase, roundIndex: state.roundIndex,
      time: Math.round(state.time * 10) / 10,
      pWall: state.playerWallHp, eWall: state.enemyWallHp,
      roundTimer: Math.round((state.roundTimer || 0) * 10) / 10,
      pCount: pSoldiers.length, eCount: eSoldiers.length,
      pSlots: (state.playerSlots || []).flat().filter(Boolean).length,
      pSample, eSample,
    };
  }, label);

  console.log('INIT:', await snapshot('init'));

  // Tick 0.15 dt, 60 fpm, up to ~30s game time per batch
  for (let batch = 0; batch < 5; batch++) {
    await page.evaluate(({ frames, dt }) => {
      for (let i = 0; i < frames; i++) { if (state.phase === 'playing') update(dt); }
    }, { frames: 200, dt: 0.15 });
    console.log(`batch ${batch}:`, await snapshot(`b${batch}`));
    if ((await page.evaluate(() => state.phase)) !== 'playing') break;
  }

  await browser.close();
}

debug().catch(err => { console.error(err); process.exitCode = 1; });
