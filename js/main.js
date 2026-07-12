/* ============================================================
   水果突击 · Fruit Assault —— 主入口
   ============================================================ */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let scale = 1;

function syncBattleShellVisibility() {
  const active = !!(state && (state.phase === 'playing' || state.phase === 'paused'));
  const wasActive = document.body.classList.contains('battle-shell-active');
  document.body.classList.toggle('battle-shell-active', active);
  if (active !== wasActive && typeof resize === 'function') requestAnimationFrame(resize);
  const hud = document.getElementById('battleShellHud');
  if (hud) {
    hud.classList.toggle('show', active);
    const pause = hud.querySelector('[data-battle-pause]');
    const speed = hud.querySelector('[data-battle-speed]');
    if (pause) pause.textContent = state.phase === 'paused' ? '继续' : '暂停';
    if (speed) speed.textContent = `×${state.speed || 1}`;
  }
}
window.syncBattleShellVisibility = syncBattleShellVisibility;

function ensureBattleShellHud() {
  if (document.getElementById('battleShellHud')) return;
  const hud = document.createElement('div');
  hud.id = 'battleShellHud';
  hud.className = 'battle-shell-hud hifi';
  hud.innerHTML = `
    <button type="button" class="battle-pill battle-back" data-battle-back>返回</button>
    <div class="battle-title"><b>水果突击</b><span>对战中</span></div>
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

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const host = document.getElementById('wrap') || document.body;
  const rect = host.getBoundingClientRect();
  const hostW = Math.max(1, rect.width || window.innerWidth);
  const hostH = Math.max(1, rect.height || window.innerHeight);
  // 高度优先:填满纵向空间,超宽部分由 #wrap overflow:hidden 居中裁切
  scale = hostH / H;
  if (W * scale > hostW * 1.12) scale = hostW * 1.12 / W; // 极端窄屏兜底,最多溢出12%
  canvas.style.width = W * scale + 'px';
  canvas.style.height = H * scale + 'px';
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

  soldier.x = center.x + (Math.random() - 0.5) * 8;
  soldier.y = center.y;
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

  // 敌方自动补充水果营：PVE 压力仍由关卡节奏控制。
  state.enemyBallTimer += dt;
  const enemyBallInterval = state.levelConfig?.enemySpawnInterval || BALL_SPAWN_INTERVAL;
  if (state.enemyBallTimer >= enemyBallInterval) {
    state.enemyBallTimer -= enemyBallInterval;
    const added = autoSpawnBall(state.enemySlots, 1, true);
    if (!added) state.enemyOverflow++;
    if (state.enemyOverflow > 0) {
      const empties = emptySlots(state.enemySlots);
      let placed = 0;
      while (state.enemyOverflow > 0 && placed < empties.length) {
        const [r, c] = empties[placed];
        state.enemySlots[r][c] = createBall(randomEnemyType(), 1);
        state.enemyOverflow--;
        placed++;
      }
    }
  }

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
    title.textContent = isBoss ? '🏆 腐坏果堡攻破！' : '🎉 水果突击胜利！';
    const starsHtml = '<span class="res-stars">' + '⭐'.repeat(stars) + '<span class="res-gray">' + '☆'.repeat(3 - stars) + '</span></span>';
    const bestType = state.maxSoldierType ? (TYPES[state.maxSoldierType]?.name || '') : '';
    detail.innerHTML = `
      <div class="res-hero">${starsHtml}</div>
      <div class="res-stat-row">
        <div class="res-stat"><span class="res-num">${elapsed}</span><span class="res-lbl">秒</span></div>
        <div class="res-stat"><span class="res-num">${Math.round(wallRatio * 100)}%</span><span class="res-lbl">果堡</span></div>
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
    title.textContent = '💀 果堡失守';
    const elapsed = Math.floor(state.time);
    detail.innerHTML = `
      <div class="res-hero fail">⚔️</div>
      <p class="res-fail-msg">腐坏水果突破了我方防线</p>
      <div class="res-stat-row">
        <div class="res-stat"><span class="res-num">${state.kills}</span><span class="res-lbl">击破</span></div>
        <div class="res-stat"><span class="res-num">${state.merges}</span><span class="res-lbl">合成</span></div>
        <div class="res-stat"><span class="res-num">${elapsed}</span><span class="res-lbl">秒</span></div>
      </div>
      <div class="res-tip">💡 空格消耗果汁召唤水果营 · 双击急派兵救线</div>
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

function loop(t) {
  const dt = Math.min((t - last) / 1000, 0.05);
  last = t;
  update(dt * state.speed);
  syncBattleShellVisibility();
  draw();
  requestAnimationFrame(loop);
}

loadMeta();
state.phase = 'menu';
requestAnimationFrame(loop);
