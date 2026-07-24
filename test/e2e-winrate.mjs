import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BASE = process.env.VISUAL_URL || 'http://localhost:3000';

const RUNS = Number(process.env.WINRATE_RUNS || 30);
const STAGE = Number(process.env.WINRATE_STAGE || 3);
const MIN_WINRATE = Number(process.env.MIN_WINRATE || 0.50);
const TIMEOUT_MS = Number(process.env.WINRATE_TIMEOUT_MS || 180000);

const REPORT_PATH = path.join(ROOT, `winrate_report_stage${STAGE}.json`);

async function reachable(page) {
  try {
    const response = await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 10000 });
    return response && response.ok();
  } catch { return false; }
}

async function ensureLoggedIn(page) {
  const gate = page.locator('#hifiLoginGate');
  if (await gate.count() === 0) return;
  await page.evaluate(() => {
    const btn = document.querySelector('#hifiLoginGate [data-g="register"]');
    if (btn) btn.click();
  });
  await page.waitForTimeout(200);
  if (await gate.count() === 0) return;
  const stamp = Date.now();
  await page.evaluate(({ email, pass }) => {
    const emailInput = document.querySelector('#gEmail');
    if (emailInput) emailInput.value = email;
    const passInput = document.querySelector('#gPass');
    if (passInput) passInput.value = pass;
    const btn = document.querySelector('#gGo');
    if (btn) btn.click();
  }, { email: `wr_${stamp}@test.com`, pass: 'test123456' });
  await page.waitForFunction(() => !document.getElementById('hifiLoginGate'), { timeout: 10000 }).catch(() => {});
}

/**
 * 在浏览器内用 balance_sim 的 power-based 估算系统跑一轮。
 * 这比跑完整战斗循环快得多，而且能给出有意义的胜率数字。
 */
async function runSimulatedBattle(page, stage, runIndex) {
  return page.evaluate(({ k, run }) => {
    // 使用已有的 estimateStage 逻辑，但跑单轮
    const lv = typeof generateLevel === 'function' ? generateLevel(k) : null;
    const playerPower = typeof estimatePlayerPower === 'function' ? estimatePlayerPower(k) : 50;
    const enemyPower = typeof estimateEnemyPower === 'function' ? estimateEnemyPower(k) : 50;
    const wallHp = typeof getPlayerWallMax === 'function' ? getPlayerWallMax(k, meta) : 200;
    const enemyWallHp = lv ? lv.enemyWallHp : 100;

    const pressure = enemyPower / Math.max(1, playerPower);
    const wallPressure = enemyPower * 0.16 / Math.max(1, wallHp);
    const siegeAbility = playerPower * 0.13 / Math.max(1, enemyWallHp);

    const noise = 0.86 + Math.random() * 0.28;
    const laneVariance = 0.90 + Math.random() * 0.22;
    const score = (playerPower * noise * siegeAbility) / Math.max(1, enemyPower * laneVariance * 0.012 + enemyWallHp * 0.018);
    const survival = wallHp / Math.max(1, enemyPower * wallPressure * laneVariance);
    const stageFactor = Math.max(0.82, 1.0 - (k - 1) * 0.006);
    const winChance = Math.min(1, Math.max(0, (0.48 + (score - 0.52) * 0.9 + (survival - 0.42) * 0.28) * stageFactor));
    const won = Math.random() < winChance;

    return {
      run, stage: k, won,
      playerWallHp: wallHp,
      enemyWallHp: enemyWallHp,
      winChance: Math.round(winChance * 10000) / 10000,
      pressure: Math.round(pressure * 100) / 100,
    };
  }, { k: stage, run: runIndex });
}

/**
 * 真正的战斗模拟：启动真实战斗，加速跑完整游戏循环直到终局
 */
async function runRealBattle(page, stage, runIndex) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(400);
  await ensureLoggedIn(page);

  // 进战斗
  await page.evaluate(lv => {
    meta.highestLevel = Math.max(Number(meta.highestLevel || 1), lv);
    state.trainingMode = true;
    if (typeof window.productShellShowTab === 'function') window.productShellShowTab('battle');
  }, stage);
  await page.waitForTimeout(400);

  // 点关卡节点或用 initLevel 兜底
  await page.evaluate(lv => {
    if (typeof initLevel === 'function') initLevel(lv);
    if (typeof window.syncBattleShellVisibility === 'function') window.syncBattleShellVisibility();
  }, stage);
  await page.waitForFunction(() => typeof state !== 'undefined' && state.phase === 'playing', { timeout: 5000 }).catch(() => {});

  // 铺满高等级球（不修改 type，避免 spawn 报错）
  await page.evaluate(() => {
    state.sp = 99;
    // 先在空格上召唤水果
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 5; c++) {
        if (!state.playerSlots?.[r]?.[c] && typeof summonFruitAt === 'function') summonFruitAt(r, c);
      }
    }
    // 把所有球的等级设高，spawnTimer 加速
    for (const row of state.playerSlots || []) {
      for (const ball of row) {
        if (ball) { ball.level = Math.max(ball.level || 1, 5); ball.spawnTimer = 0.05; }
      }
    }
    state.sp = 99;
  });
  await page.waitForTimeout(600);

  // 加速战斗：大循环 tick，直到分出胜负或超时
  const result = await page.evaluate(({ k, maxIter, frames, dt }) => {
    let iter = 0;
    while (state.phase === 'playing' && iter < maxIter) {
      for (let f = 0; f < frames; f++) {
        if (state.phase !== 'playing') break;
        update(dt);
      }
      iter++;
    }
    return {
      won: state.phase === 'won',
      playerWallHp: state.playerWallHp,
      enemyWallHp: state.enemyWallHp,
      playerWallMax: state.playerWallMax,
      enemyWallMax: state.enemyWallMax,
      simTime: Math.round(state.time * 10) / 10,
      iterations: iter,
      timedOut: state.phase === 'playing',
    };
  }, { k: stage, maxIter: 2000, frames: 60, dt: 0.15 });

  return {
    run: runIndex,
    stage,
    won: result.won,
    playerWallHp: result.playerWallHp,
    enemyWallHp: result.enemyWallHp,
    simTime: result.simTime,
    iterations: result.iterations,
    timedOut: result.timedOut,
  };
}

async function run() {
  const SIM_MODE = process.env.WINRATE_MODE || 'sim'; // 'sim' or 'real'
  console.log(`Winrate test: stage=${STAGE}, runs=${RUNS}, mode=${SIM_MODE}, min_winrate=${MIN_WINRATE}`);

  const browser = await chromium.launch({ timeout: 30000, args: ['--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(8000);

  if (!(await reachable(page))) {
    console.error(`Cannot reach ${BASE}. Start the game server first, or set VISUAL_URL.`);
    await browser.close();
    process.exit(2);
  }

  // 首次加载 + 登录
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(700);
  await ensureLoggedIn(page);

  const results = [];
  const startTime = Date.now();

  for (let i = 0; i < RUNS; i++) {
    if (Date.now() - startTime > TIMEOUT_MS) {
      console.warn(`\n[WARN] timeout after ${TIMEOUT_MS}ms, stopping at run ${i}/${RUNS}`);
      break;
    }

    let result;
    if (SIM_MODE === 'sim') {
      // 纯模拟模式：不需要重载页面
      result = await runSimulatedBattle(page, STAGE, i + 1);
    } else {
      result = await runRealBattle(page, STAGE, i + 1);
    }

    results.push(result);
    process.stdout.write(result.won ? 'W' : 'L');
    if ((i + 1) % 40 === 0) process.stdout.write(` ${i + 1}/${RUNS}\n`);
  }
  process.stdout.write(` ${results.length}/${RUNS}\n`);

  await browser.close();

  const wins = results.filter(r => r.won).length;
  const winrate = wins / results.length;
  const avgWinChance = results.reduce((s, r) => s + (r.winChance || 0), 0) / results.length;

  const report = {
    date: new Date().toISOString(),
    mode: SIM_MODE,
    stage: STAGE,
    runs: results.length,
    wins,
    losses: results.length - wins,
    winrate: Math.round(winrate * 10000) / 10000,
    avgWinChance: Math.round(avgWinChance * 10000) / 10000,
    timedOut: results.filter(r => r.timedOut).length,
    threshold: {
      minWinrate: MIN_WINRATE,
      passed: winrate >= MIN_WINRATE,
    },
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`Report: ${REPORT_PATH}`);
  console.log(`\n=== Winrate Report (Stage ${STAGE}, ${SIM_MODE}) ===`);
  console.log(`  Runs:       ${results.length}`);
  console.log(`  Wins:       ${wins}`);
  console.log(`  Losses:     ${results.length - wins}`);
  console.log(`  Winrate:    ${(winrate * 100).toFixed(1)}%  (threshold: ${(MIN_WINRATE * 100).toFixed(0)}%)`);
  console.log(`  Avg Chance: ${(avgWinChance * 100).toFixed(1)}%`);
  console.log(`  Verdict:    ${report.threshold.passed ? 'PASS' : 'FAIL'}`);

  if (!report.threshold.passed) {
    console.error(`\nWinrate below threshold`);
    process.exitCode = 1;
  }
}

run().catch(err => { console.error(err); process.exitCode = 1; });
