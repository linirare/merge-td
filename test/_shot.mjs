import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = process.argv[2] || 'preview';
const out = process.argv[3] || 'shot_preview.png';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1400 }, deviceScaleFactor: 1 });

if (target === 'preview') {
  const fileUrl = 'file://' + path.join(__dirname, 'stickman_preview.html').replace(/\\/g, '/');
  await page.goto(fileUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  // 裁到水果网格区域(前 3 行 = 18 种,含全部角色/武器),避免超大图无法读取
  await page.screenshot({ path: path.join(__dirname, '..', out), type: 'jpeg', quality: 88, clip: { x: 20, y: 520, width: 1040, height: 780 } });
} else {
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(Number(process.argv[4] || 12000));
  await page.screenshot({ path: path.join(__dirname, '..', out) });
}

await browser.close();
console.log('WROTE', out);
