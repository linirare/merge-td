/* ============================================================
   端到端测试：主玩法循环 + 后台邮件 → 前端收发 (CommonJS)
   ============================================================ */
process.env.JWT_SECRET = 'test-e2e-secret';
process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASS = 'admin123';

const { app, server } = require('../server/index.js');

let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) { console.log('  ✅ ' + label + (detail ? ' — ' + detail : '')); pass++; }
  else { console.log('  ❌ ' + label + (detail ? ' — ' + detail : '')); fail++; }
}

async function api(method, path, token, body) {
  const opts = { method, headers: {} };
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch('http://127.0.0.1:3005' + path, opts);
  return res.json();
}

async function main() {
  await new Promise(r => server.listen(3005, '127.0.0.1', r));

  // ===== 1. 注册 =====
  console.log('\n━━━ 1. 玩家注册 ━━━');
  const reg = await api('POST', '/api/auth/register', null, {
    email: 'e2e@test.com', password: 'pass123', nickname: 'E2E测试员'
  });
  check('注册成功', !!reg.token);
  check('初始 gold=0', reg.gold === 0, `gold=${reg.gold}`);
  check('初始 diamonds=0', reg.diamonds === 0);
  const { uid, token } = reg;

  // ===== 2. 登录 =====
  console.log('\n━━━ 2. 登录 & 存档恢复 ━━━');
  const login = await api('POST', '/api/auth/login', null, { email: 'e2e@test.com', password: 'pass123' });
  check('登录成功', !!login.token);
  check('highest_stage=1', login.highest_stage === 1);

  // ===== 3. 管理后台发资源邮件 =====
  console.log('\n━━━ 3. 后台 → 发资源邮件(gold=8888, diamonds=666) ━━━');
  const adm = await api('POST', '/api/admin/login', null, { username: 'admin', password: 'admin123' });
  check('管理员登录', !!adm.ok);
  const atok = adm.token;

  const mailRes = await api('POST', '/api/admin/mail', atok, {
    uid, title: '🎁 测试资源邮件',
    body: '后台发出的测试邮件。',
    rewards_json: { gold: 8888, diamonds: 666 }
  });
  check('邮件发送成功', mailRes.ok);

  // ===== 4. 后台 → 直接发资源 =====
  console.log('\n━━━ 4. 后台 → 直接发资源(gold=5000, diamonds=300) ━━━');
  const resGrant = await api('POST', '/api/admin/resource', atok, {
    uid, gold: 5000, diamonds: 300
  });
  check('直接发资源成功', resGrant.ok);

  // ===== 5. 玩家收邮件 =====
  console.log('\n━━━ 5. 玩家收件箱 ━━━');
  const mails = await api('GET', '/api/mail', token);
  check('邮件列表非空', mails.length > 0, `共 ${mails.length} 封`);
  const mail = mails.find(m => m.title === '🎁 测试资源邮件');
  check('找到测试邮件', !!mail);
  if (mail) {
    check('邮件未读', mail.is_read === 0);
    const rew = JSON.parse(mail.rewards_json);
    check('附件gold=8888', rew.gold === 8888);
    check('附件diamonds=666', rew.diamonds === 666);
  }

  // ===== 6. 读邮件领奖励 =====
  console.log('\n━━━ 6. 读邮件领附件 ━━━');
  if (mail) {
    const readRes = await api('POST', '/api/mail/read', token, { id: mail.id });
    check('领取成功', readRes.ok);
    check('返回 gold=8888', readRes.granted?.gold === 8888, JSON.stringify(readRes.granted));
    check('返回 diamonds=666', readRes.granted?.diamonds === 666);
  }

  // ===== 7. 验证数值一致性 =====
  console.log('\n━━━ 7. 数据一致性验证 ━━━');
  const prof = await api('GET', '/api/user/profile', token);
  const expGold = 5000 + 8888;   // 直接发 + 邮件
  const expDia = 300 + 666;
  check('金币=' + expGold, prof.gold === expGold, `实际=${prof.gold}`);
  check('钻石=' + expDia, prof.diamonds === expDia, `实际=${prof.diamonds}`);

  // ===== 8. 重复领取防护 =====
  console.log('\n━━━ 8. 防重复领取 ━━━');
  if (mail) {
    const dup = await api('POST', '/api/mail/read', token, { id: mail.id });
    check('二次领取不发奖励', !dup.granted || (dup.granted.gold === 0 && dup.granted.diamonds === 0));
    const p2 = await api('GET', '/api/user/profile', token);
    check('金币不变', p2.gold === expGold);
    check('钻石不变', p2.diamonds === expDia);
  }

  // ===== 9. 全服邮件 =====
  console.log('\n━━━ 9. 全服邮件发放 ━━━');
  const allRes = await api('POST', '/api/admin/mail-all', atok, {
    title: '📢 全服补偿', body: '维护补偿。',
    rewards_json: JSON.stringify({ gold: 200, diamonds: 20 })
  });
  check('全服发送成功', allRes.ok);
  check('覆盖人数≥1', allRes.count >= 1, `共${allRes.count}人`);

  const mails2 = await api('GET', '/api/mail', token);
  const allMail = mails2.find(m => m.title === '📢 全服补偿');
  check('玩家收到全服邮件', !!allMail);
  if (allMail) {
    const ar = await api('POST', '/api/mail/read', token, { id: allMail.id });
    check('全服邮件 gold=200', ar.granted?.gold === 200);
    check('全服邮件 diamonds=20', ar.granted?.diamonds === 20);
  }

  // ===== 10. 存档保存/恢复 =====
  console.log('\n━━━ 10. 存档保存→登录→恢复 ━━━');
  const testMeta = JSON.stringify({ gold: 9999, highestLevel: 15, totalWins: 42 });
  const sv = await api('POST', '/api/save', token, {
    meta_json: testMeta, shell_json: '{}', power: 150, highest_stage: 15
  });
  check('保存成功', sv.ok);
  check('power=150 被接受', sv.accepted?.power === 150);
  check('stage=15 被接受', sv.accepted?.highest_stage === 15);

  const rl = await api('POST', '/api/auth/login', null, { email: 'e2e@test.com', password: 'pass123' });
  check('重登 meta 完整恢复', rl.meta_json === testMeta);
  check('重登 stage=15', rl.highest_stage === 15);

  // ===== 11. 反作弊 =====
  console.log('\n━━━ 11. 战力/关卡反作弊 ━━━');
  const cheat = await api('POST', '/api/save', token, {
    meta_json: testMeta, shell_json: '{}', power: 999999, highest_stage: 9999
  });
  check('power=999999→300', cheat.accepted?.power === 300, `实际=${cheat.accepted?.power}`);
  check('stage=9999→999', cheat.accepted?.highest_stage <= 999, `实际=${cheat.accepted?.highest_stage}`);

  // ===== 12. 越权防护 =====
  console.log('\n━━━ 12. 越权访问防护 ━━━');
  const noTok = await api('GET', '/api/mail');
  check('无token→401', noTok.error === 'Unauthorized');
  const fakeAdm = await api('POST', '/api/admin/mail', 'bad-token', { uid, title: 'x' });
  check('假admin token→403', fakeAdm.error === 'Admin only');
  const userAdm = await api('POST', '/api/admin/resource', token, { uid, gold: 1 });
  check('玩家token调admin→403', userAdm.error === 'Admin only');

  // ===== 13. 负数攻击 =====
  console.log('\n━━━ 13. 负数攻击测试 ━━━');
  await api('POST', '/api/admin/resource', atok, { uid, gold: -999999, diamonds: -99999 });
  const p3 = await api('GET', '/api/user/profile', token);
  const expectedFinalGold = expGold + 200;  // +全服邮件gold
  const expectedFinalDia = expDia + 20 + 20; // +全服邮件diamonds
  check('负数不扣金币', p3.gold >= expectedFinalGold, `实际=${p3.gold}, 期望≥${expectedFinalGold}`);
  check('负数不扣钻石', p3.diamonds >= expectedFinalDia, `实际=${p3.diamonds}, 期望≥${expectedFinalDia}`);

  // ===== 汇总 =====
  console.log('\n' + '═'.repeat(50));
  const pct = Math.round(pass / (pass + fail) * 100);
  console.log('  端到端测试: ✅ ' + pass + ' / ❌ ' + fail + '  (' + pct + '%)');
  console.log('═'.repeat(50) + '\n');

  server.close();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); server.close(); process.exit(1); });
