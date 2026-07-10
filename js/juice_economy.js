/* ============================================================
   水果突击 · Juice Economy v59
   果汁闭环：无上限 / 开局10点 / 每5秒+1 / 击杀返还等级 / 主动行动递增成本。
   v59：只做轻反馈，不再制造战场遮挡；果汁栏闪烁由 state._juicePulse 驱动。
   ============================================================ */
(function installJuiceEconomyV59() {
  if (window.__juiceEconomyV59Installed) return;
  window.__juiceEconomyV59Installed = true;

  const JUICE_PASSIVE_INTERVAL = 5.0;
  const ENEMY_ACTION_INTERVAL = 4.0;

  function actionCost() {
    if (!state) return 1;
    state.summonCostCounter = Math.max(1, Number(state.summonCostCounter || 1));
    return state.summonCostCounter;
  }

  function enemyActionCost() {
    if (!state) return 1;
    state.enemySummonCostCounter = Math.max(1, Number(state.enemySummonCostCounter || 1));
    return state.enemySummonCostCounter;
  }

  function pulseJuice(delta = 0, kind = 'info') {
    if (!state) return;
    state._juicePulse = 0.50;
    state._juiceDelta = delta;
    state._juicePulseKind = kind;
  }

  window.nextJuiceActionCost = actionCost;

  if (typeof getSpStart === 'function' && !getSpStart._juiceV59) {
    getSpStart = function getJuiceStartV59(m) {
      return 10 + Math.floor(((m && m.spLv) || 0) / 2);
    };
    getSpStart._juiceV59 = true;
  }

  if (typeof getSpMax === 'function' && !getSpMax._juiceV59) {
    getSpMax = function getJuiceMaxV59() { return Infinity; };
    getSpMax._juiceV59 = true;
  }

  if (typeof getSpRecoverCap === 'function' && !getSpRecoverCap._juiceV59) {
    getSpRecoverCap = function getJuiceRecoverCapV59() { return Infinity; };
    getSpRecoverCap._juiceV59 = true;
  }

  function resetJuiceEconomyForLevel() {
    state.sp = typeof getSpStart === 'function' ? getSpStart(meta) : 10;
    state.enemySp = 10;
    state.summonCostCounter = 1;
    state.enemySummonCostCounter = 1;
    state._juicePlayerTimer = 0;
    state._juiceEnemyTimer = 0;
    state.enemySpCheckTimer = 0;
    state._spTimer = 0;
    state.enemyBallTimer = 0;
    state._juicePulse = 0;
    state._juiceDelta = 0;
    state._juicePulseKind = 'info';
  }

  if (typeof initLevel === 'function' && !initLevel._juiceV59) {
    const oldInitLevel = initLevel;
    initLevel = function initLevelWithJuiceEconomyV59(k) {
      const result = oldInitLevel(k);
      resetJuiceEconomyForLevel();
      return result;
    };
    initLevel._juiceV59 = true;
  }

  if (typeof killSoldier === 'function' && !killSoldier._juiceV59) {
    const oldKillSoldier = killSoldier;
    killSoldier = function killSoldierWithJuiceRewardV59(target, killerSide, killerAtk, killerType) {
      const wasAlive = !!(target && target.alive);
      const reward = Math.max(1, Math.min(MAX_LEVEL || 7, Number(target && target.level) || 1));
      const oldPlayerSp = state.sp || 0;
      const oldEnemySp = state.enemySp || 0;
      const result = oldKillSoldier(target, killerSide, killerAtk, killerType);
      if (wasAlive && target && !target.alive) {
        if (killerSide === 'player') {
          state.sp = oldPlayerSp + reward;
          pulseJuice(reward, 'gain');
          addFx(target.x, target.y - 18, `+${reward}果汁`, THEME.gold, 10);
        } else if (killerSide === 'enemy') {
          state.enemySp = oldEnemySp + reward;
        }
      }
      return result;
    };
    killSoldier._juiceV59 = true;
  }

  function enemySpawnLevel() {
    const lv = state.levelConfig && state.levelConfig.enemyInitLevel ? state.levelConfig.enemyInitLevel : 1;
    const base = Math.max(1, Math.floor(lv));
    return Math.min(MAX_LEVEL, base + (Math.random() < (lv - base) ? 1 : 0));
  }

  function tryEnemyJuiceSummon() {
    if (state?.mode === 'pvp') return false;
    if (!state || state.phase !== 'playing' || !state.enemySlots) return false;
    const cost = enemyActionCost();
    if ((state.enemySp || 0) < cost) return false;
    const added = typeof autoSpawnBall === 'function' ? autoSpawnBall(state.enemySlots, enemySpawnLevel(), true) : null;
    if (!added) return false;
    state.enemySp -= cost;
    state.enemySummonCostCounter = cost + 1;
    return true;
  }

  function updateJuiceTimers(dt) {
    if (!state || state.phase !== 'playing') return;
    state._juicePulse = Math.max(0, Number(state._juicePulse || 0) - dt);

    state._juicePlayerTimer = (state._juicePlayerTimer || 0) + dt;
    while (state._juicePlayerTimer >= JUICE_PASSIVE_INTERVAL) {
      state._juicePlayerTimer -= JUICE_PASSIVE_INTERVAL;
      state.sp = (state.sp || 0) + 1;
      pulseJuice(1, 'gain');
      addFx(BOARD_X + 38, (LAYOUT.operationY || 570) - 6, '+1果汁', THEME.gold, 10);
    }

    if (state.mode !== 'pvp') {
      state._juiceEnemyTimer = (state._juiceEnemyTimer || 0) + dt;
      while (state._juiceEnemyTimer >= JUICE_PASSIVE_INTERVAL) {
        state._juiceEnemyTimer -= JUICE_PASSIVE_INTERVAL;
        state.enemySp = (state.enemySp || 0) + 1;
      }

      state.enemySpCheckTimer = (state.enemySpCheckTimer || 0) + dt;
      while (state.enemySpCheckTimer >= ENEMY_ACTION_INTERVAL) {
        state.enemySpCheckTimer -= ENEMY_ACTION_INTERVAL;
        tryEnemyJuiceSummon();
      }
    }
  }

  if (typeof update === 'function' && !update._juiceV59) {
    const oldUpdate = update;
    update = function updateWithJuiceEconomyV59(dt) {
      if (state && state.phase === 'playing') {
        const oldSpTimer = state._spTimer;
        const oldEnemyBallTimer = state.enemyBallTimer;
        // 关闭旧的3秒回蓝和免费敌方刷球；经济由本模块接管。
        state._spTimer = -9999;
        state.enemyBallTimer = -9999;
        oldUpdate(dt);
        state._spTimer = oldSpTimer || 0;
        state.enemyBallTimer = oldEnemyBallTimer || 0;
        updateJuiceTimers(dt);
      } else {
        oldUpdate(dt);
      }
    };
    update._juiceV59 = true;
  }

  function summonFruitAtV59(r, c) {
    if (!state || !state.playerSlots || state.playerSlots[r][c]) return false;
    const center = slotCenter(r, c, false);
    const cost = actionCost();
    if ((state.sp || 0) < cost) {
      pulseJuice(0, 'lack');
      addFx(center.x, center.y - 22, `果汁不足 · 需${cost}`, THEME.accent, 11);
      return false;
    }

    const type = randomType(activeDeck());
    state._shellCreatingPlayerBall = true;
    try {
      state.playerSlots[r][c] = createBall(type, 1);
    } finally {
      state._shellCreatingPlayerBall = false;
    }
    state.playerSlots[r][c].spawnTimer = Math.max(state.playerSlots[r][c].spawnTimer, 2.2);
    state.sp -= cost;
    state.summonCount = (state.summonCount || 0) + 1;
    state.summonCostCounter = cost + 1;
    pulseJuice(-cost, 'spend');

    const t = TYPES[type];
    state.rings.push({ x: center.x, y: center.y, r: 9, life: 0.36, maxLife: 0.36, color: t.color || THEME.gold });
    addFx(center.x, center.y - 24, `-${cost} 果汁`, THEME.gold, 11);
    playSfx('merge');
    if (window.pvpClient) window.pvpClient.localSummon(r, c, cost);
    return true;
  }

  summonFruitAt = summonFruitAtV59;

  let juiceLastTap = { time: 0, r: -1, c: -1 };

  function juiceOnDown(ev) {
    if (state.phase !== 'playing' && state.phase !== 'paused') return;
    ev.preventDefault();
    const p = eventPoint(ev);

    if (p.x >= PAUSE_RECT.x && p.x <= PAUSE_RECT.x + PAUSE_RECT.w && p.y >= PAUSE_RECT.y && p.y <= PAUSE_RECT.y + PAUSE_RECT.h) {
      state.phase = state.phase === 'paused' ? 'playing' : 'paused';
      return;
    }
    if (state.phase === 'paused') return;

    if (p.x >= HELP_RECT.x && p.x <= HELP_RECT.x + HELP_RECT.w && p.y >= HELP_RECT.y && p.y <= HELP_RECT.y + HELP_RECT.h) {
      document.getElementById('helpPanel').classList.remove('hide');
      return;
    }
    if (p.x >= SPEED_RECT.x && p.x <= SPEED_RECT.x + SPEED_RECT.w && p.y >= SPEED_RECT.y && p.y <= SPEED_RECT.y + SPEED_RECT.h) {
      state.speed = state.speed >= 3 ? 1 : state.speed + 1;
      addFx(SPEED_RECT.x + SPEED_RECT.w / 2, SPEED_RECT.y + 42, `速度 ×${state.speed}`, THEME.gold, 12);
      return;
    }
    if (state.overflowQueue.length > 0 && p.x >= OVERFLOW_RECT.x && p.x <= OVERFLOW_RECT.x + OVERFLOW_RECT.w && p.y >= OVERFLOW_RECT.y && p.y <= OVERFLOW_RECT.y + OVERFLOW_RECT.h) {
      showOverflowPopup();
      return;
    }
    if (state.pendingPlace) return;

    const s = slotAt(p.x, p.y, false);
    if (!s) { juiceLastTap.time = 0; return; }
    const [r, c] = s;
    const ball = state.playerSlots[r][c];

    if (!ball) {
      juiceLastTap.time = 0;
      summonFruitAtV59(r, c);
      return;
    }

    const now = performance.now();
    if (juiceLastTap.r === r && juiceLastTap.c === c && (now - juiceLastTap.time) < 350) {
      const alive = state.playerSoldiers.filter(s => s.alive).length;
      const center = slotCenter(r, c, false);
      const cost = actionCost();
      if ((state.sp || 0) < cost) {
        pulseJuice(0, 'lack');
        addFx(center.x, center.y - 24, `果汁不足 · 需${cost}`, THEME.accent, 11);
      } else if (alive >= MAX_SOLDIERS) {
        addFx(center.x, center.y - 24, '兵数已满', THEME.accent, 11);
      } else {
        const soldier = spawnSoldierFromBall(ball, r, c, 'player', true);
        if (soldier) {
          state.sp -= cost;
          state.summonCostCounter = cost + 1;
          ball.spawnTimer = Math.max(ball.spawnTimer || 0, 1.2);
          pulseJuice(-cost, 'spend');
          state.rings.push({ x: center.x, y: center.y, r: 8, life: 0.34, maxLife: 0.34, color: THEME.gold });
          addFx(center.x, center.y - 24, `-${cost} 果汁 · 急派`, THEME.gold, 11);
          if (window.pvpClient) window.pvpClient.localUrgent(r, c, cost);
        } else {
          addFx(center.x, center.y - 24, '无法派兵', THEME.accent, 11);
        }
      }
      juiceLastTap.time = 0;
      return;
    }
    juiceLastTap = { time: now, r, c };

    state.drag = {
      unit: ball,
      fromR: r,
      fromC: c,
      x: p.x,
      y: p.y,
      sx: p.x,
      sy: p.y,
      moved: false,
      nearestSnap: null,
      snapAction: '',
    };
  }

  function installInputHook() {
    try {
      if (typeof canvas !== 'undefined' && typeof onDown === 'function') {
        canvas.removeEventListener('mousedown', onDown);
        canvas.removeEventListener('touchstart', onDown);
        canvas.addEventListener('mousedown', juiceOnDown);
        canvas.addEventListener('touchstart', juiceOnDown, { passive: false });
      }
    } catch (e) {}
  }

  installInputHook();
  if (state && state.phase === 'playing') resetJuiceEconomyForLevel();
})();
