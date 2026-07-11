/* ============================================================
   水果突击 · 视觉验收自动化 (D)
   ------------------------------------------------------------
   进真游戏(真皮/真分辨率 390x844)截关键屏 → 可选喂 MiniMax 视觉
   转文字评估 → 结构化输出。用于每次改渲染后自检,替代"每次叫人肉眼看"。

     npm run visual                 # 截图 + MiniMax 视觉评估
     npm run visual -- --no-vision  # 只截图,不调 mmx
     VISUAL_URL=http://host:port npm run visual

   前提:游戏服务在 VISUAL_URL(默认 http://localhost:3000)已启动。
   本模型无法解码图片,靠 mmx CLI(key 在其 config.json);无 mmx 时自动跳过视觉。
   ============================================================ */
import { chromium } from 'playwright';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BASE = process.env.VISUAL_URL || 'http://localhost:3000';
const NO_VISION = process.argv.includes('--no-vision');

// 走 shell 调 mmx(Windows 上 .cmd 必须经 shell;路径/prompt 用双引号包住,里面的
// () ? 等 shell 特殊字符即被当字面量)。prompt 内不含双引号(由本文件控制),仍做防御性替换。
function mmxDescribe(imgPath, prompt) {
  return new Promise(resolve => {
    const p = String(prompt).replace(/"/g, "'");
    const cmd = `mmx vision describe --image "${imgPath}" --prompt "${p}" --quiet --output json`;
    exec(cmd, { timeout: 120000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err) return resolve(null);
      try { const j = JSON.parse(stdout); resolve(j.content || j.reply || stdout); }
      catch (e) { resolve(String(stdout || '').trim() || null); }
    });
  });
}

async function reachable(page) {
  try { const r = await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 8000 }); return r && r.ok(); }
  catch (e) { return false; }
}

const SHOTS = [
  {
    name: 'home', file: 'shot_home.jpg',
    async setup(page) { await page.waitForTimeout(2500); },
    prompt: '这是手游首页。中文简评:1)整体UI风格与精致度(1-10)?2)顶栏/底栏/主视觉分别是什么?3)有无明显视觉问题(错位/溢出/糊)?',
  },
  {
    name: 'battle', file: 'shot_battle.jpg',
    async setup(page) {
      for (const t of ['开始对战', '开始闯关', '选关', '开始']) {
        const el = page.locator(`text=${t}`).first();
        if (await el.count() && await el.isVisible().catch(() => false)) { await el.click().catch(() => {}); break; }
      }
      await page.waitForTimeout(1500);
      const lvl = page.locator('.level, .stage, [data-stage], .hifi-level, .lvnode').first();
      if (await lvl.count() && await lvl.isVisible().catch(() => false)) await lvl.click().catch(() => {});
      await page.waitForTimeout(9000);
    },
    prompt: '这是手游实时战斗画面。聚焦战场上的小兵渲染,中文简评:1)小兵辨识度/头身武器比例是否协调(1-10)?2)敌我是否分得清?3)小兵精致度是否配得上周围UI,有无违和?4)最该改的一点。',
  },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  if (!(await reachable(page))) {
    console.error(`✗ 无法访问 ${BASE} —— 请先启动游戏服务(npm start),再跑 npm run visual`);
    await browser.close();
    process.exit(2);
  }

  const results = [];
  for (const shot of SHOTS) {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await shot.setup(page);
    const abs = path.join(ROOT, shot.file);
    await page.screenshot({ path: abs, type: 'jpeg', quality: 88 });
    let vision = null;
    if (!NO_VISION) vision = await mmxDescribe(abs, shot.prompt);
    results.push({ name: shot.name, file: shot.file, vision });
    console.log(`\n===== [${shot.name}] ${shot.file} =====`);
    if (vision) console.log(vision);
    else console.log(NO_VISION ? '(已跳过视觉评估)' : '(mmx 视觉不可用,已跳过 —— 截图仍已保存)');
  }

  await browser.close();
  console.log(`\n--- 完成:截图 ${results.map(r => r.file).join(', ')} | console 错误 ${errors.length ? errors.slice(0, 4).join(' | ') : '无'} ---`);
})().catch(err => { console.error(err); process.exit(1); });
