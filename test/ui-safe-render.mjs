process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only';
import { chromium } from 'playwright';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { server } = require('../server/index');
const TEST_TIMEOUT_MS = 20000;

async function listen() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

let browser;
let closed = false;

async function closeServer() {
  if (closed) return;
  closed = true;
  await new Promise(resolve => server.close(() => resolve()));
}

async function run() {
  const base = await listen();
  browser = await chromium.launch({ timeout: 10000 });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(5000);
  await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 8000 });
  await page.waitForFunction(() => typeof window.productShellShowTab === 'function', null, { timeout: 8000 });
  await page.evaluate(() => {
    window.__xss = 0;
    const payload = '<img src=x onerror="window.__xss=1">';
    window.account = {
      user: { nickname: payload },
      leaderboard: async () => [{ nickname: payload, score: 999 }, { nickname: '<script>window.__xss=2</script>', score: 1 }],
      getMail: async () => [{ id: payload, title: payload, body: '<svg onload="window.__xss=3"></svg>', is_read: 0 }],
      readMail: async () => ({ ok: true }),
      chatMessages: async () => [{ nickname: payload, text: '<img src=x onerror="window.__xss=4">' }],
      api: async () => ({ ok: true }),
    };
  });

  await page.evaluate(() => window.productShellShowTab('rank'));
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const btn = document.querySelector('[data-mail]');
    if (!btn) throw new Error('mail button not found');
    btn.click();
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const btn = document.querySelector('[data-chat]');
    if (!btn) throw new Error('chat button not found');
    btn.click();
  });
  await page.waitForTimeout(600);

  const xss = await page.evaluate(() => window.__xss);
  if (xss !== 0) throw new Error(`unsafe render executed injected code: ${xss}`);
  console.log('OK: user-controlled nickname/mail/chat/rank text is safely rendered');
}

try {
  await Promise.race([
    run(),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`ui-safe-render timed out after ${TEST_TIMEOUT_MS}ms`)), TEST_TIMEOUT_MS)),
  ]);
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  try { if (browser) await browser.close(); } catch (e) {}
  try { await closeServer(); } catch (e) {}
  process.exit(process.exitCode || 0);
}
