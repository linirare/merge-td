const assert = require('assert');
const http = require('http');
const { server } = require('../server/index');

function listen() {
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function request(port, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: pathname }, res => {
      res.resume();
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers }));
    });
    req.on('error', reject);
  });
}

(async () => {
  const port = await listen();
  try {
    for (const pathname of ['/', '/index.html', '/js/config.js', '/css/style.css', '/art/bg-clean_002.jpg']) {
      const res = await request(port, pathname);
      assert.strictEqual(res.status, 200, `${pathname} should be public`);
    }

    for (const pathname of ['/server/index.js', '/server/db.js', '/data/fruits.db', '/.git/config', '/package.json', '/node_modules/playwright/package.json']) {
      const res = await request(port, pathname);
      assert.notStrictEqual(res.status, 200, `${pathname} must not be publicly downloadable`);
    }

    console.log('OK: static server only exposes frontend assets');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
})().catch(err => {
  console.error(err);
  server.close(() => process.exit(1));
});
