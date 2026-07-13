import { chromium } from 'playwright';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BASE = process.env.VISUAL_URL || 'http://localhost:3000';
const NO_VISION = process.argv.includes('--no-vision');
const STRICT = process.argv.includes('--strict');
const ONLY = (process.argv.find(arg => arg.startsWith('--only=')) || '').slice(7)
  .split(',').map(name => name.trim()).filter(Boolean);
const VISUAL_TIMEOUT_MS = Number(process.env.VISUAL_TIMEOUT_MS || 120000);

async function ensureLoggedIn(page) {
  // 如果登录门还在,注册一个视觉测试专用账号然后等门消失
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
    const passInput = document.querySelector('#gPass');
    if (emailInput) {
      emailInput.value = email;
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      emailInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (passInput) {
      passInput.value = pass;
      passInput.dispatchEvent(new Event('input', { bubbles: true }));
      passInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const btn = document.querySelector('#gGo');
    if (btn) btn.click();
  }, { email: `visual_${stamp}@test.com`, pass: 'test123456' });
  await page.waitForFunction(() => !document.getElementById('hifiLoginGate'), { timeout: 10000 }).catch(() => {});
}

function mmxDescribe(imgPath, prompt) {
  return new Promise(resolve => {
    const safePrompt = String(prompt).replace(/"/g, "'");
    const cmd = `mmx vision describe --image "${imgPath}" --prompt "${safePrompt}" --quiet --output json`;
    exec(cmd, { timeout: 120000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err) return resolve(null);
      try {
        const json = JSON.parse(stdout);
        resolve(json.content || json.reply || stdout);
      } catch (e) {
        resolve(String(stdout || '').trim() || null);
      }
    });
  });
}

async function reachable(page) {
  try {
    const response = await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 10000 });
    return response && response.ok();
  } catch (e) {
    return false;
  }
}

async function showTab(page, tab) {
  await page.evaluate(name => {
    if (typeof window.productShellShowTab === 'function') window.productShellShowTab(name);
  }, tab);
  await page.waitForTimeout(900);
}

async function startStage(page, level, waitMs = 3000) {
  await page.evaluate(lv => {
    if (typeof meta !== 'undefined') meta.highestLevel = Math.max(Number(meta.highestLevel || 1), lv);
    if (typeof state !== 'undefined') state.trainingMode = true;
    if (typeof window.productShellShowTab === 'function') window.productShellShowTab('battle');
  }, level);
  await page.waitForTimeout(700);
  const node = page.locator('.lvnode').nth(Math.max(0, level - 1));
  let started = false;
  if (await node.count()) {
    started = await node.click({ timeout: 5000 }).then(() => true).catch(() => false);
  }
  if (!started) {
    const startBtn = page.locator('#campaignStartBtn');
    if (await startBtn.count()) started = await startBtn.click({ timeout: 5000 }).then(() => true).catch(() => false);
  }
  if (!started) {
    await page.evaluate(lv => {
      if (typeof initLevel === 'function') initLevel(lv);
      if (typeof window.syncBattleShellVisibility === 'function') window.syncBattleShellVisibility();
    }, level);
  }
  await page.waitForFunction(() => typeof state !== 'undefined' && state.phase === 'playing', { timeout: 5000 }).catch(() => {});
  await page.evaluate(() => {
    if (typeof window.scheduleBattleResize === 'function') window.scheduleBattleResize();
    else if (typeof resize === 'function') resize();
  });
  await page.waitForFunction(() => {
    const canvas = document.getElementById('game');
    const rect = canvas?.getBoundingClientRect();
    return !!rect && rect.width >= 300 && rect.height >= 600;
  }, { timeout: 3000 });
  // 视觉验收必须覆盖真实交战，而不是只截一张空棋盘。
  await page.evaluate(() => {
    if (typeof summonFruitAt !== 'function' || typeof state === 'undefined') return;
    const cells = [[2, 0], [2, 2], [2, 4], [1, 1], [1, 3]];
    for (const [r, c] of cells) {
      if (state.sp > 0 && !state.playerSlots?.[r]?.[c]) summonFruitAt(r, c);
      const ball = state.playerSlots?.[r]?.[c];
      if (ball) ball.spawnTimer = Math.min(Number(ball.spawnTimer || 0), 0.25);
    }
    state.sp = Math.max(Number(state.sp || 0), 3);
  });
  await page.waitForTimeout(waitMs);
  const live = await page.evaluate(() => ({
    phase: typeof state !== 'undefined' ? state.phase : 'missing',
    level: typeof state !== 'undefined' ? state.currentLevel : null,
    shellActive: document.body.classList.contains('battle-shell-active'),
    canvas: (() => {
      const rect = document.getElementById('game')?.getBoundingClientRect();
      return rect ? { width: Math.round(rect.width), height: Math.round(rect.height) } : null;
    })(),
  }));
  if (live.phase !== 'playing' || !live.shellActive) {
    throw new Error(`stage ${level} left live battle before capture: ${JSON.stringify(live)}`);
  }
}

async function forceResult(page) {
  await page.evaluate(() => {
    if (typeof state !== 'undefined') {
      state.lastBattleReport = {
        tips: [
          '被突破路线：第2路',
          '阵容缺口：前排 / 攻城，可试西瓜卫士、橙子炮',
          '升级方向：先升前排血量和果堡，再补主力攻击。',
        ],
      };
    }
    if (typeof onGameOver === 'function') onGameOver(false);
  });
  await page.waitForTimeout(900);
}

async function createPvpRoom(page) {
  await showTab(page, 'arena');
  await page.evaluate(() => window.pvpClient && window.pvpClient.createRoom && window.pvpClient.createRoom());
  await page.waitForTimeout(1400);
}

async function assertVisiblePage(page, shotName) {
  const info = await page.evaluate(() => {
    const body = document.body;
    const rect = body.getBoundingClientRect();
    const text = (body.innerText || '').replace(/\s+/g, '');
    const visiblePanels = Array.from(document.querySelectorAll('.panel:not(.hide), canvas'))
      .filter(el => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return r.width > 20 && r.height > 20 && style.visibility !== 'hidden' && style.display !== 'none';
      }).length;
    return { width: rect.width, height: rect.height, textLength: text.length, visiblePanels };
  });
  if (info.width < 300 || info.height < 500 || info.visiblePanels < 1) {
    throw new Error(`${shotName} appears blank: ${JSON.stringify(info)}`);
  }
}

const SHOTS = [
  {
    name: 'home',
    file: 'shot_home.jpg',
    setup: async page => { await page.waitForTimeout(1200); },
    prompt: 'Mobile game home screen. Rate polish, readability, overlap, blank areas, and button hierarchy.',
  },
  {
    name: 'campaign',
    file: 'shot_campaign.jpg',
    setup: async page => showTab(page, 'battle'),
    prompt: 'Campaign stage selection screen. Check chapter information, stage nodes, tutorial hint readability, and button overlap.',
  },
  {
    name: 'squad',
    file: 'shot_squad.jpg',
    setup: async page => showTab(page, 'upgrade'),
    prompt: 'Squad and roster screen. Check role tags, card readability, scrolling density, and text overlap.',
  },
  {
    name: 'shop',
    file: 'shot_shop.jpg',
    setup: async page => showTab(page, 'shop'),
    prompt: 'Shop screen. Check simulated payment copy, pack cards, reward clarity, and no forced-pay impression.',
  },
  {
    name: 'battle',
    file: 'shot_battle.png',
    setup: async page => startStage(page, 1, 3500),
    prompt: 'Live battle screen. Check player green/gold versus enemy red/purple readability, lane danger, damage noise, and crowded units.',
  },
  {
    name: 'boss',
    file: 'shot_boss.png',
    setup: async page => startStage(page, 5, 4200),
    prompt: 'Boss battle screen. Check boss outline, boss HP bar, entrance/readability, and whether it is distinct from normal enemies.',
  },
  {
    name: 'result',
    file: 'shot_result.jpg',
    setup: async page => { await startStage(page, 1, 1000); await forceResult(page); },
    prompt: 'Failure result screen. Check whether failure advice is visible, actionable, and not overlapping controls.',
  },
  {
    name: 'pvp_room',
    file: 'shot_pvp_room.jpg',
    setup: async page => createPvpRoom(page),
    prompt: 'PVP room screen. Check room code, ready button, leave button, connection status, and no overlap.',
  },
];

let browser;

async function run() {
  browser = await chromium.launch({ timeout: 30000, args: ['--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  if (process.env.VISUAL_DEBUG === '1') {
    await page.addInitScript(() => {
      const proto = CanvasRenderingContext2D.prototype;
      const save = proto.save;
      const restore = proto.restore;
      proto.save = function visualDebugSave() {
        this.__visualSaveDepth = (this.__visualSaveDepth || 0) + 1;
        this.__visualSaveMax = Math.max(this.__visualSaveMax || 0, this.__visualSaveDepth);
        return save.call(this);
      };
      proto.restore = function visualDebugRestore() {
        this.__visualSaveDepth = Math.max(0, (this.__visualSaveDepth || 0) - 1);
        return restore.call(this);
      };
    });
  }
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  if (!(await reachable(page))) {
    console.error(`Cannot reach ${BASE}. Start the game server first, or set VISUAL_URL.`);
    await browser.close();
    process.exit(2);
  }

  const results = [];
  const selectedShots = ONLY.length ? SHOTS.filter(shot => ONLY.includes(shot.name)) : SHOTS;
  for (const shot of selectedShots) {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(700);
    await ensureLoggedIn(page);
    await shot.setup(page);
    await assertVisiblePage(page, shot.name);
    if (process.env.VISUAL_DEBUG === '1' && (shot.name === 'battle' || shot.name === 'boss')) {
      const debug = await page.evaluate(() => {
        const info = el => {
          const rect = el?.getBoundingClientRect();
          const style = el ? getComputedStyle(el) : null;
          return rect && style ? {
            className: el.className,
            display: style.display,
            zIndex: style.zIndex,
            rect: [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)],
          } : null;
        };
        return {
          phase: state?.phase,
          level: state?.currentLevel,
          body: document.body.className,
          wrap: info(document.getElementById('wrap')),
          canvas: info(document.getElementById('game')),
          hud: info(document.getElementById('battleShellHud')),
          back: info(document.querySelector('[data-battle-back]')),
          title: info(document.querySelector('.battle-title')),
          context: (() => {
            const context = document.getElementById('game')?.getContext('2d');
            const matrix = context?.getTransform();
            return context && matrix ? {
              alpha: context.globalAlpha,
              depth: context.__visualSaveDepth,
              maxDepth: context.__visualSaveMax,
              matrix: [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f],
            } : null;
          })(),
        };
      });
      console.log(`[visual-debug:${shot.name}] ${JSON.stringify(debug)}`);
    }
    const abs = path.join(ROOT, shot.file);
    const canvasShot = shot.name === 'battle' || shot.name === 'boss';
    if (canvasShot) {
      await page.evaluate(() => {
        // Cancel pending retry tickets, rebuild the backing store and let the
        // stable frame settle before reading its pixels.
        if (typeof _battleResizeRetry !== 'undefined') _battleResizeRetry++;
        window.__freezeBattleFrame = false;
        if (typeof resize === 'function') resize();
        if (typeof draw === 'function') {
          draw();
          draw();
        }
        window.__freezeBattleFrame = true;
      });
      await page.waitForTimeout(120);
      const dataUrl = await page.evaluate(() => document.getElementById('game').toDataURL('image/png'));
      fs.writeFileSync(abs, Buffer.from(dataUrl.split(',')[1], 'base64'));
    } else {
      await page.screenshot({ path: abs, type: 'jpeg', quality: 88, timeout: 20000 });
    }
    const vision = NO_VISION ? null : await mmxDescribe(abs, shot.prompt);
    results.push({ name: shot.name, file: shot.file, vision });
    console.log(`\n===== [${shot.name}] ${shot.file} =====`);
    console.log(vision || (NO_VISION ? '(vision skipped)' : '(vision unavailable; screenshot saved)'));
  }

  await browser.close();
  browser = null;
  const errorSummary = errors.length ? errors.slice(0, 8).join(' | ') : 'none';
  console.log(`\n--- done: ${results.map(r => r.file).join(', ')} | console errors: ${errorSummary} ---`);
  if (STRICT && errors.length) process.exit(3);
}

Promise.race([
  run(),
  new Promise((_, reject) => setTimeout(() => reject(new Error(`visual-check timed out after ${VISUAL_TIMEOUT_MS}ms`)), VISUAL_TIMEOUT_MS)),
]).catch(err => {
  console.error(err);
  process.exitCode = 1;
}).finally(async () => {
  try { if (browser) await browser.close(); } catch (e) {}
  process.exit(process.exitCode || 0);
});
