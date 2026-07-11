import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || 'shot_battle.jpg';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
// 点“开始对战”进战斗
let clicked = 'none';
for (const t of ['开始对战', '开始闯关', '选关', '开始']) {
  const el = page.locator(`text=${t}`).first();
  if (await el.count() && await el.isVisible().catch(()=>false)) { await el.click().catch(()=>{}); clicked = t; break; }
}
await page.waitForTimeout(1500);
// 若进了选关屏,点第一关
const lvl = page.locator('.level, .stage, [data-stage], .hifi-level').first();
if (await lvl.count() && await lvl.isVisible().catch(()=>false)) await lvl.click().catch(()=>{});
await page.waitForTimeout(1500);
const phase = await page.evaluate(() => (window.state && window.state.phase) || 'unknown');
// 让战斗跑一会,出兵交战
await page.waitForTimeout(Number(process.argv[3] || 9000));
const phase2 = await page.evaluate(() => (window.state && window.state.phase) || 'unknown');
await page.screenshot({ path: path.join(__dirname, '..', out), type: 'jpeg', quality: 88 });
await browser.close();
console.log('WROTE', out, '| clicked:', clicked, '| phase:', phase, '->', phase2, '| errors:', errs.length ? errs.slice(0,4) : 'none');
