/* ============================================================
   水果突击 · Fruit Assault —— 主入口
   ============================================================ */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let scale = 1;
let _battleResizeRetry = 0;

function scheduleBattleResize() {
  _battleResizeRetry++;
  const ticket = _battleResizeRetry;
  const attempt = (n = 0) => requestAnimationFrame(() => {
    if (ticket !== _battleResizeRetry || typeof resize !== 'function') return;
    const host = document.getElementById('wrap');
    const rect = host?.getBoundingClientRect();
    if (rect && rect.width >= 100 && rect.height >= 100) {
      resize();
      // 壳层/底栏也可能在同一帧切换，再校正一帧防止拿到过渡尺寸。
      if (n === 0) attempt(1);
      return;
    }
    if (n < 8) setTimeout(() => attempt(n + 1), 24);
  });
  attempt();
}
window.scheduleBattleResize = scheduleBattleResize;

function syncBattleShellVisibility() {
  const active = !!(state && (state.phase === 'playing' || state.phase === 'paused'));
  const wasActive = document.body.classList.contains('battle-shell-active');
  document.body.classList.toggle('battle-shell-active', active);
  if (active !== wasActive) scheduleBattleResize();
  const hud = document.getElementById('battleShellHud');
  if (hud) {
    hud.classList.toggle('show', active);
    const pause = hud.querySelector('[data-battle-pause]');
    const speed = hud.querySelector('[data-battle-speed]');
    const title = hud.querySelector('[data-battle-title]');
    const status = hud.querySelector('[data-battle-status]');
    if (pause) pause.textContent = state.phase === 'paused' ? '继续' : '暂停';
    if (speed) speed.textContent = `×${state.speed || 1}`;
    if (title) title.textContent = state.mode === 'pvp' ? '竞技对战' : `第 ${state.currentLevel || 1} 关`;
    if (status) {
      const wallRatio = Number(state.playerWallHp || 0) / Math.max(1, Number(state.playerWallMax || 1));
      status.textContent = wallRatio < 0.35 ? '防线告急' : wallRatio < 0.75 ? '防线承压' : '战线稳定';
      status.classList.toggle('danger', wallRatio < 0.35);
    }
  }
}
window.syncBattleShellVisibility = syncBattleShellVisibility;

function ensureBattleShellHud() {
  if (document.getElementById('battleShellHud')) return;
  const hud = document.createElement('div');
  hud.id = 'battleShellHud';
  hud.className = 'battle-shell-hud hifi';
  hud.innerHTML = `
    <button type="button" class="battle-pill battle-back" data-battle-back><span aria-hidden="true">‹</span> 返回</button>
    <div class="battle-title"><b data-battle-title>第 1 关</b><span data-battle-status>战线稳定</span></div>
    <button type="button" class="battle-pill" data-battle-pause>暂停</button>
    <button type="button" class="battle-pill battle-speed" data-battle-speed>×1</button>
  `;
  document.body.appendChild(hud);
  hud.querySelector('[data-battle-back]')?.addEventListener('click', () => {
    const wasPvp = state.mode === 'pvp';
    if (wasPvp && window.pvpClient?.leaveRoom) window.pvpClient.leaveRoom();
    state.mode = 'pve';
    state.phase = 'menu';
    document.getElementById('resultPanel')?.classList.add('hide');
    window._skipNavSync = true;
    if (window.productShellShowTab) window.productShellShowTab(wasPvp ? 'arena' : 'home');
    else document.getElementById('menuPanel')?.classList.remove('hide');
    syncBattleShellVisibility();
  });
  hud.querySelector('[data-battle-pause]')?.addEventListener('click', () => {
    if (state.phase === 'playing') state.phase = 'paused';
    else if (state.phase === 'paused') state.phase = 'playing';
    syncBattleShellVisibility();
  });
  hud.querySelector('[data-battle-speed]')?.addEventListener('click', () => {
    state.speed = state.speed >= 3 ? 1 : state.speed + 1;
    syncBattleShellVisibility();
  });
}

// 无障碍:尊重系统"减弱动态效果"(审计 C)。各动画源用 window.REDUCE_MOTION 置零。
window.REDUCE_MOTION = false;
try {
  const _rmq = window.matchMedia('(prefers-reduced-motion: reduce)');
  window.REDUCE_MOTION = _rmq.matches;
  _rmq.addEventListener('change', e => { window.REDUCE_MOTION = e.matches; });
} catch (e) { /* 老浏览器无 matchMedia,保持 false */ }

function recalcPhoneFrame() {
  const root = document.documentElement;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (vw < 470) {
    // 手机:手机框填满视口
    root.style.setProperty('--phone-w', vw + 'px');
    root.style.setProperty('--phone-h', vh + 'px');
    root.style.setProperty('--phone-left', '0px');
    root.style.setProperty('--phone-top', '0px');
    root.style.setProperty('--phone-scale', (vw / W).toFixed(4));
    return;
  }
  // 宽屏:手机框按 480:920 比例居中,上限 550px 宽
  const maxW = 550;
  const idealByHeight = vh * (W / H);
  const phoneW = Math.min(maxW, idealByHeight, vw);
  const phoneH = phoneW * (H / W);
  root.style.setProperty('--phone-scale', (phoneW / W).toFixed(4));
  root.style.setProperty('--phone-w', phoneW.toFixed(1) + 'px');
  root.style.setProperty('--phone-h', phoneH.toFixed(1) + 'px');
  root.style.setProperty('--phone-left', ((vw - phoneW) / 2).toFixed(1) + 'px');
  root.style.setProperty('--phone-top', ((vh - phoneH) / 2).toFixed(1) + 'px');
}
window.recalcPhoneFrame = recalcPhoneFrame;

function resize() {
  recalcPhoneFrame();
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const host = document.getElementById('wrap') || document.body;
  const measured = host.getBoundingClientRect();
  // 菜单切战斗时 #wrap 可能短暂 display:none。此时直接使用已经计算好的手机框尺寸，
  // 不再等待 DOM 时序，也绝不允许 canvas 被压成 1px。
  const rootStyle = getComputedStyle(document.documentElement);
  const fallbackW = parseFloat(rootStyle.getPropertyValue('--phone-w')) || window.innerWidth || W;
  const fallbackH = parseFloat(rootStyle.getPropertyValue('--phone-h')) || window.innerHeight || H;
  const rect = measured.width >= 100 && measured.height >= 100
    ? measured
    : { width: Math.max(100, fallbackW), height: Math.max(100, fallbackH) };
  // 壳内框留 8px 边距对齐金框内沿
  const margin = 8;
  const availW = Math.max(1, rect.width - margin * 2);
  const availH = Math.max(1, rect.height - margin * 2);
  scale = Math.min(availW / W, availH / H);
  canvas.style.width = W * scale + 'px';
  canvas.style.height = H * scale + 'px';
  canvas.style.left = (rect.width - W * scale) / 2 + 'px';
  canvas.style.top = (rect.height - H * scale) / 2 + 'px';
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Canvas resize invalidates paint resources created by the previous backing
  // store. Rebuild cached gradients on the next frame instead of reusing them.
  if (typeof _bgGrad !== 'undefined') _bgGrad = null;
  if (typeof _fieldGrad !== 'undefined') _fieldGrad = null;
  if (typeof LAYOUT !== 'undefined' && typeof LAYOUT.recalc === 'function') LAYOUT.recalc(W, H);
}
window.addEventListener('resize', resize);
ensureBattleShellHud();
resize();
initInput(canvas);

/* ——— 出兵封装 ——— */
function spawnSoldierFromBall(ball, r, c, side, forced = false) {
  const group = side === 'player' ? state.playerSoldiers : state.enemySoldiers;
  const alive = group.filter(s => s.alive).length;
  if (alive >= MAX_SOLDIERS) return null;

  const center = slotCenter(r, c, side === 'enemy');
  const soldier = side === 'player'
    ? createSoldier(ball.type, ball.level, getAtkMul(meta, ball.type), getHpMul(meta, ball.type))
    : createSoldier(ball.type, ball.level);

  soldier.x = center.x + (Math.random() - 0.5) * 24;
  soldier.y = center.y + (Math.random() - 0.5) * 12 + (c % 2 === 0 ? 4 : -4);
  soldier.side = side;
  soldier.laneIndex = c;
  soldier.laneX = BOARD_X + c * (CELL + GAP) + CELL / 2 + (Math.random() - 0.5) * 10;
  soldier.mode = 'deploy';
  soldier.target = null;
  soldier.battleReady = false;
  soldier.protected = true;
  soldier._gateFx = false;

  group.push(soldier);

  if (side === 'player') {
    state.rings.push({ x: center.x, y: center.y, r: forced ? 8 : 5, life: 0.25, maxLife: 0.25, color: forced ? THEME.gold : TYPES[ball.type].color });
    if (forced || ball.level >= 3) addFx(center.x, center.y - 22, forced ? '急派兵' : `Lv.${ball.level} 派兵`, forced ? THEME.gold : '#fff2be', 11);
  }
  return soldier;
}

/* ——— 更新 ——— */
function update(dt) {
  dt_global = dt;

  if (state.phase === 'paused') {
    for (let i = state.rings.length - 1; i >= 0; i--) {
      state.rings[i].life -= dt * 0.3;
      state.rings[i].r += 10 * dt;
      if (state.rings[i].life <= 0) state.rings.splice(i, 1);
    }
    for (let i = state.fx.length - 1; i >= 0; i--) {
      state.fx[i].life -= dt * 0.3;
      if (state.fx[i].life <= 0) state.fx.splice(i, 1);
    }
    return;
  }

  if (state.phase !== 'playing') return;

  // 服务器权威 PvP:本地不驱动战斗,只把服务端快照插值渲染(见 pvp.js pvpClientUpdate)
  if (state.mode === 'pvp') {
    if (typeof pvpClientUpdate === 'function') pvpClientUpdate(dt);
    return;
  }

  state.time += dt;

  if (!state._spTimer) state._spTimer = 0;
  state._spTimer += dt;
  if (state._spTimer >= SP_PASSIVE && state.sp < getSpRecoverCap(meta)) {
    state._spTimer -= SP_PASSIVE;
    state.sp = Math.min(state.sp + 1, getSpMax(meta));
    addFx(42, LAYOUT.fieldY + LAYOUT.fieldH - 46, '+1果汁', THEME.gold, 11);
  }

  // 玩家不再自动补球：空格由玩家点击消耗果汁主动召唤。

  // 敌方不再用旧版 timer 自动补球:由 juice_economy.js 的 tryEnemyJuiceSummon 消耗敌方果汁召唤

  updateAI(dt);

  // 每个水果营按 CD 自动派兵。自动派兵免费；果汁只用于召唤和急派兵。
  const slotsArr = [
    { slots: state.playerSlots, side: 'player' },
    { slots: state.enemySlots, side: 'enemy' },
  ];
  for (const grp of slotsArr) {
    const soldiers = grp.side === 'player' ? state.playerSoldiers : state.enemySoldiers;
    const alive = soldiers.filter(s => s.alive).length;
    const remaining = MAX_SOLDIERS - alive;
    if (remaining <= 0) continue;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ball = grp.slots[r][c];
        if (!ball) continue;
        ball.spawnTimer -= dt;
        if (ball.spawnTimer <= 0) {
          const cd = SPAWN_COOLDOWNS[ball.level] || SPAWN_COOLDOWNS[1];
          ball.spawnTimer += cd;
          spawnSoldierFromBall(ball, r, c, grp.side);
        }
      }
    }
  }

  updateCombat();

  for (const slots of [state.playerSlots, state.enemySlots]) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const b = slots[r][c];
        if (b && b.bounce > 0) b.bounce = Math.max(0, b.bounce - dt * 3);
      }
    }
  }

  for (const s of state.playerSoldiers) if (s.hitFlash > 0) s.hitFlash = Math.max(0, s.hitFlash - dt * 1.2);
  for (const s of state.enemySoldiers) if (s.hitFlash > 0) s.hitFlash = Math.max(0, s.hitFlash - dt * 1.2);

  for (let i = state.rings.length - 1; i >= 0; i--) {
    const ring = state.rings[i];
    ring.life -= dt;
    ring.r += 64 * dt;
    if (ring.life <= 0) state.rings.splice(i, 1);
  }

  for (const f of state.fx) {
    if (f.vx) { f.x += f.vx * dt; f.y += f.vy * dt; }
  }
  for (let i = state.fx.length - 1; i >= 0; i--) {
    state.fx[i].life -= dt;
    if (state.fx[i].life <= 0) state.fx.splice(i, 1);
  }

  for (let i = state.attackFx.length - 1; i >= 0; i--) {
    state.attackFx[i].life -= dt;
    if (state.attackFx[i].life <= 0) state.attackFx.splice(i, 1);
  }

  if (state.dust) {
    for (const d of state.dust) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.y < LAYOUT.fieldY + 10) { d.y = LAYOUT.fieldY + LAYOUT.fieldH - 14; d.x = 36 + Math.random() * (W - 72); }
      if (d.x < 20 || d.x > W - 20) d.vx *= -1;
    }
  }

  if (window.GameHooks && window.GameHooks.update) window.GameHooks.update.run(dt);
}

let dt_global = 0;
let last = 0;

function reportHtml() {
  const report = state.lastBattleReport;
  if (!report || !report.tips || report.tips.length === 0) return '';
  return '<div class="res-report">' +
    '<div class="res-report-toggle" onclick="this.parentElement.classList.toggle(\'open\')">📋 战斗复盘</div>' +
    '<div class="res-report-body"><span class="res-report-title">📋 战斗复盘</span>' +
    report.tips.slice(0, 6).map(t => '· ' + t).join('<br>') +
    '</div></div>';
}

function onGameOver(win) {
  const panel = document.getElementById('resultPanel');
  const title = document.getElementById('resultTitle');
  const detail = document.getElementById('resultDetail');
  const nextBtn = document.getElementById('btnNext');

  panel.classList.remove('hide');
  if (win) {
    const wallRatio = state.playerWallHp / state.playerWallMax;
    const elapsed = Math.floor(state.time);
    let stars = 1;
    if (wallRatio > 0.8 && elapsed < 58) stars = 3;
    else if (wallRatio > 0.48) stars = 2;

    const prevStars = meta.stars[state.currentLevel] || 0;
    if (stars > prevStars) meta.stars[state.currentLevel] = stars;

    const bonus = Math.round(state.levelConfig.reward * (stars - 1) * 0.5);
    const totalReward = state.levelConfig.reward + bonus;
    meta.gold += totalReward;
    meta.totalWins++;

    const isBoss = state.levelConfig.isBoss;
    title.textContent = isBoss ? '🏆 深海巨兽已净化！' : '🎉 珊瑚堡垒守住了！';
    const starsHtml = '<span class="res-stars">' + '⭐'.repeat(stars) + '<span class="res-gray">' + '☆'.repeat(3 - stars) + '</span></span>';
    const bestType = state.maxSoldierType ? (TYPES[state.maxSoldierType]?.name || '') : '';
    detail.innerHTML = `
      <div class="res-hero">${starsHtml}</div>
      <div class="res-stat-row">
        <div class="res-stat"><span class="res-num">${elapsed}</span><span class="res-lbl">秒</span></div>
        <div class="res-stat"><span class="res-num">${Math.round(wallRatio * 100)}%</span><span class="res-lbl">护礁</span></div>
        <div class="res-stat"><span class="res-num">${state.kills}</span><span class="res-lbl">击破</span></div>
        <div class="res-stat"><span class="res-num">${state.merges}</span><span class="res-lbl">合成</span></div>
      </div>
      <div class="res-reward">🪙 <b>+${totalReward}</b>${bonus > 0 ? ' <small>含星级奖励 +' + bonus + '</small>' : ''}</div>
      ${bestType ? '<div class="res-mvp">🏅 王牌 <b>' + bestType + '</b> · ' + state.maxSoldierAtk + '攻</div>' : ''}
      ${reportHtml()}
    `;
    // 胜利加金辉
    document.querySelector('#resultPanel .result-card')?.classList.add('win-card');
    playSfx('win');
    if (state.currentLevel >= meta.highestLevel) meta.highestLevel = state.currentLevel + 1;
    nextBtn.classList.remove('hide');
  } else {
    title.textContent = '💠 护礁结界破碎';
    const elapsed = Math.floor(state.time);
    detail.innerHTML = `
      <div class="res-hero fail">🫧</div>
      <p class="res-fail-msg">敌方海潮突破了我方护礁</p>
      <div class="res-stat-row">
        <div class="res-stat"><span class="res-num">${state.kills}</span><span class="res-lbl">击破</span></div>
        <div class="res-stat"><span class="res-num">${state.merges}</span><span class="res-lbl">合成</span></div>
        <div class="res-stat"><span class="res-num">${elapsed}</span><span class="res-lbl">秒</span></div>
      </div>
      <div class="res-tip">💡 消耗潮汐能召唤海灵珠 · 双击急派伙伴守住护礁</div>
      ${reportHtml()}
    `;
    // 失败去金辉
    document.querySelector('#resultPanel .result-card')?.classList.remove('win-card');
    playSfx('lose');
    nextBtn.classList.add('hide');
  }
  saveMeta();
  refreshGold();
}

let _lastFrame = 0;
function loop(t) {
  requestAnimationFrame(loop);
  if (t - _lastFrame < 16) return; // 帧率上限 ~60fps
  _lastFrame = t;
  if (window.__freezeBattleFrame) return;
  const dt = Math.min((t - last) / 1000, 0.05);
  last = t;
  update(dt * state.speed);
  syncBattleShellVisibility();
  if (document.body.classList.contains('battle-shell-active')) {
    const liveRect = canvas.getBoundingClientRect();
    if (liveRect.width < 100 || liveRect.height < 100) resize();
  }
  draw();
}

loadMeta();
state.phase = 'menu';
requestAnimationFrame(loop);
