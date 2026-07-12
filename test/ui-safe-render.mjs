import { chromium } from 'playwright';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { server } = require('../server/index');

async function listen() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

try {
  const base = await listen();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(base + '/', { waitUntil: 'networkidle' });
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
  await page.evaluate(() => document.querySelector('[data-mail]')?.click());
  await page.waitForTimeout(600);
  await page.evaluate(() => document.querySelector('[data-chat]')?.click());
  await page.waitForTimeout(600);

  const xss = await page.evaluate(() => window.__xss);
  if (xss !== 0) throw new Error(`unsafe render executed injected code: ${xss}`);
  await browser.close();
  await new Promise(resolve => server.close(resolve));
  console.log('OK: user-controlled nickname/mail/chat/rank text is safely rendered');
} catch (err) {
  console.error(err);
  try { server.close(() => process.exit(1)); }
  catch (e) { process.exit(1); }
}
