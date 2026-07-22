process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only';
const { spawn } = require('child_process');
const { server } = require('../server/index');

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: false, ...options });
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });
}

(async () => {
  console.log('\n[check:full] PVE real-combat simulation');
  await run(process.execPath, ['test/stage-real-sim.js', '--full', '--gate']);
  console.log('\n[check:full] Visual screenshots and console check');
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    await run(process.execPath, ['test/visual-check.mjs', '--no-vision', '--strict'], {
      env: { ...process.env, VISUAL_URL: `http://127.0.0.1:${port}` },
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
  console.log('\n[check:full] OK');
})().catch(err => {
  console.error(err);
  try { server.close(() => process.exit(1)); }
  catch (e) { process.exit(1); }
});
