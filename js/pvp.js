/* ============================================================
   水果突击 · 实时 PVP V1
   房间码对战 / 指令同步 / 本地战斗模拟。
   ============================================================ */
(function installPvpV1() {
  const PVP_SERVER_URL = 'ws://127.0.0.1:8787';

  const pvp = {
    ws: null,
    status: '未连接',
    roomId: '',
    playerIndex: -1,
    ready: false,
    peerReady: false,
    players: [],
    seq: 0,
    expectedSeq: 1,
    suppress: false,
    seed: 1,
    rngState: 1,
    spawnCounters: { player: 0, enemy: 0 },
    onStatus: null,
  };

  function notify() {
    if (typeof pvp.onStatus === 'function') pvp.onStatus(getStatus());
  }

  function setStatus(text) {
    pvp.status = text;
    notify();
  }

  function send(message) {
    if (!pvp.ws || pvp.ws.readyState !== WebSocket.OPEN) {
      setStatus('未连接 PVP 服务');
      return false;
    }
    pvp.ws.send(JSON.stringify(message));
    return true;
  }

  function connect() {
    if (pvp.ws && (pvp.ws.readyState === WebSocket.OPEN || pvp.ws.readyState === WebSocket.CONNECTING)) return;
    setStatus('连接中...');
    pvp.ws = new WebSocket(PVP_SERVER_URL);
    pvp.ws.addEventListener('open', () => setStatus('已连接'));
    pvp.ws.addEventListener('close', () => setStatus('连接已断开'));
    pvp.ws.addEventListener('error', () => setStatus('连接失败，请确认 PVP 服务已启动'));
    pvp.ws.addEventListener('message', event => {
      let message;
      try { message = JSON.parse(event.data); }
      catch (err) { return setStatus('收到异常消息'); }
      handleServerMessage(message);
    });
  }

  function getDeckSnapshot() {
    return normalizeDeck(meta?.deck || DEFAULT_DECK).slice(0, DECK_SIZE);
  }

  function createRoom() {
    connect();
    const wait = setInterval(() => {
      if (!pvp.ws || pvp.ws.readyState === WebSocket.CLOSED) clearInterval(wait);
      if (pvp.ws && pvp.ws.readyState === WebSocket.OPEN) {
        clearInterval(wait);
        send({ type: 'create_room' });
      }
    }, 80);
  }

  function joinRoom(roomId) {
    connect();
    const clean = String(roomId || '').trim();
    const wait = setInterval(() => {
      if (!pvp.ws || pvp.ws.readyState === WebSocket.CLOSED) clearInterval(wait);
      if (pvp.ws && pvp.ws.readyState === WebSocket.OPEN) {
        clearInterval(wait);
        send({ type: 'join_room', roomId: clean });
      }
    }, 80);
  }

  function setReady(ready) {
    pvp.ready = !!ready;
    send({ type: 'ready', ready: pvp.ready, deck: getDeckSnapshot() });
    notify();
  }

  function leaveRoom() {
    send({ type: 'leave_room' });
    pvp.roomId = '';
    pvp.playerIndex = -1;
    pvp.ready = false;
    pvp.peerReady = false;
    pvp.players = [];
    notify();
  }

  function handleServerMessage(message) {
    if (message.type === 'room_created' || message.type === 'room_joined') {
      pvp.roomId = message.roomId;
      pvp.playerIndex = message.playerIndex;
      pvp.players = message.players || [];
      pvp.ready = false;
      pvp.peerReady = false;
      setStatus(message.type === 'room_created' ? '房间已创建' : '已加入房间');
    } else if (message.type === 'peer_joined' || message.type === 'ready_state') {
      pvp.players = message.players || [];
      const me = pvp.players[pvp.playerIndex];
      const peer = pvp.players[pvp.playerIndex === 0 ? 1 : 0];
      pvp.ready = !!me?.ready;
      pvp.peerReady = !!peer?.ready;
      setStatus(message.type === 'peer_joined' ? '对手已加入' : '准备状态已更新');
    } else if (message.type === 'match_start') {
      startPvpMatch({
        roomId: message.roomId,
        seed: message.seed,
        playerIndex: pvp.playerIndex,
        decks: message.decks || [],
      });
    } else if (message.type === 'peer_action') {
      applyRemoteAction(message.action);
    } else if (message.type === 'peer_left') {
      handlePeerLeft();
    } else if (message.type === 'error') {
      setStatus(message.message || 'PVP 错误');
    }
  }

  function getStatus() {
    const peer = pvp.players[pvp.playerIndex === 0 ? 1 : 0];
    return {
      status: pvp.status,
      roomId: pvp.roomId,
      playerIndex: pvp.playerIndex,
      ready: pvp.ready,
      peerReady: !!peer?.ready,
      peerJoined: !!peer,
      connected: !!(pvp.ws && pvp.ws.readyState === WebSocket.OPEN),
    };
  }

  function seeded(seed) {
    pvp.rngState = Math.max(1, Number(seed) || 1) >>> 0;
  }

  function pvpRandom() {
    pvp.rngState = (pvp.rngState * 1664525 + 1013904223) >>> 0;
    return pvp.rngState / 0x100000000;
  }

  function pvpPick(list) {
    const safe = (list || []).filter(id => TYPES[id]);
    return safe[Math.floor(pvpRandom() * safe.length)] || DEFAULT_DECK[0];
  }

  function pvpCreateBall(type, level = 1, spawnTimer = null) {
    const ball = createBall(type, level);
    ball.spawnTimer = spawnTimer === null ? 2.2 : Number(spawnTimer || 0);
    return ball;
  }

  function clearForPvp() {
    state.playerSlots = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    state.enemySlots = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    state.overflowQueue = [];
    state.enemyOverflow = 0;
    state.playerWallHp = BASE_WALL_HP + getWallBonus(meta);
    state.playerWallMax = state.playerWallHp;
    state.enemyWallHp = BASE_WALL_HP + getWallBonus(meta);
    state.enemyWallMax = state.enemyWallHp;
    state.playerSoldiers = [];
    state.enemySoldiers = [];
    state.laneStats = emptyLaneStats();
    state.laneAlerts = [];
    state.damageByType = {};
    state.wallDamageByLane = Array(COLS).fill(0);
    state.enemyWallDamageDealt = 0;
    state.playerWallDamageTaken = 0;
    state.breachLane = -1;
    state.lastBattleReport = null;
    state.drag = null;
    state.pendingPlace = null;
    state.fx = [];
    state.attackFx = [];
    state.projectiles = [];
    state.rings = [];
    state.rollings = [];
    state.kills = 0;
    state.merges = 0;
    state.specialMerges = 0;
    state.maxSoldierAtk = 0;
    state.maxSoldierType = '';
    state.time = 0;
    state.speed = 1;
    state.sp = getSpStart(meta);
    state.enemySp = getSpStart(meta);
    state.summonCostCounter = 1;
    state.enemySummonCostCounter = 1;
    state._spTimer = 0;
    state._juicePlayerTimer = 0;
    state._juiceEnemyTimer = 0;
    state.enemySpCheckTimer = 0;
    state.enemyBallTimer = -9999;
    state.shake = 0;
  }

  function hidePvpPanels() {
    [
      'menuPanel', 'arenaPanel', 'upgradePanel', 'shopPanel', 'shellLabPanel',
      'ladderPanel', 'resultPanel', 'overflowPopup', 'helpPanel', 'simPanel',
      'fruitLabPanel',
    ].forEach(id => document.getElementById(id)?.classList.add('hide'));
  }

  function pvpOpening(slots, deck, isPlayer) {
    const safe = normalizeDeck(deck || DEFAULT_DECK);
    const picks = [
      [0, 1, safe[3], 1], [0, 2, safe[0], 1], [0, 3, safe[4], 1],
      [1, 1, safe[1], 1], [1, 2, safe[0], 1], [1, 3, safe[2], 1],
    ];
    if (isPlayer) state._shellCreatingPlayerBall = true;
    try {
      for (const [r, c, type, level] of picks) slots[r][c] = pvpCreateBall(type, level, 2.2);
    } finally {
      if (isPlayer) state._shellCreatingPlayerBall = false;
    }
  }

  function startPvpMatch(config) {
    pvp.seed = Number(config.seed || 1);
    seeded(pvp.seed);
    pvp.seq = 0;
    pvp.expectedSeq = 1;
    pvp.spawnCounters = { player: 0, enemy: 0 };

    const playerIndex = Number(config.playerIndex || 0);
    const decks = config.decks || [];
    const myDeck = decks[playerIndex] || getDeckSnapshot();
    const peerDeck = decks[playerIndex === 0 ? 1 : 0] || DEFAULT_DECK;

    clearForPvp();
    state.mode = 'pvp';
    state.pvpSide = playerIndex;
    state.pvpRoomId = config.roomId || pvp.roomId;
    state.pvpSeq = 0;
    state.currentLevel = 1;
    state.levelConfig = { id: 1, isBoss: false, enemyInitLevel: 1, enemyWallHp: state.enemyWallMax, enemySpawnInterval: 9999, reward: 0, desc: '实时 PVP' };
    pvpOpening(state.playerSlots, myDeck, true);
    pvpOpening(state.enemySlots, peerDeck, false);
    state.phase = 'playing';
    hidePvpPanels();
    setStatus('PVP 对战中');
    addFx(W / 2, LAYOUT.fieldY + 80, '实时对战开始', THEME.gold, 18);
  }

  function actionCostFor(side) {
    const key = side === 'enemy' ? 'enemySummonCostCounter' : 'summonCostCounter';
    state[key] = Math.max(1, Number(state[key] || 1));
    return state[key];
  }

  function spendJuice(side, cost) {
    if (side === 'enemy') {
      state.enemySp = Math.max(0, Number(state.enemySp || 0) - cost);
      state.enemySummonCostCounter = cost + 1;
    } else {
      state.sp = Math.max(0, Number(state.sp || 0) - cost);
      state.summonCostCounter = cost + 1;
    }
  }

  function applyRemoteAction(action) {
    if (!action || state.mode !== 'pvp') return;
    if (Number(action.seq) !== pvp.expectedSeq) {
      return pvpSyncError('同步异常：操作顺序不一致');
    }
    pvp.expectedSeq++;
    pvp.suppress = true;
    try {
      const payload = action.payload || {};
      if (action.type === 'summon_cell') {
        const { r, c, type, level, spawnTimer, cost } = payload;
        if (!state.enemySlots[r] || state.enemySlots[r][c]) return pvpSyncError('同步异常：远端召唤位置非法');
        state.enemySlots[r][c] = pvpCreateBall(type, level || 1, spawnTimer);
        spendJuice('enemy', Number(cost || actionCostFor('enemy')));
      } else if (action.type === 'move_cell') {
        const result = tryMove(state.enemySlots, payload.fromR, payload.fromC, payload.toR, payload.toC);
        if (!result?.moved) return pvpSyncError('同步异常：远端移动失败');
      } else if (action.type === 'merge_or_swap_cell') {
        const result = tryMerge(state.enemySlots, payload.fromR, payload.fromC, payload.toR, payload.toC);
        if (!result) return pvpSyncError('同步异常：远端合成失败');
      } else if (action.type === 'urgent_dispatch') {
        const { r, c, cost } = payload;
        const ball = state.enemySlots[r]?.[c];
        if (!ball) return pvpSyncError('同步异常：远端急派位置为空');
        spendJuice('enemy', Number(cost || actionCostFor('enemy')));
        spawnSoldierFromBall(ball, r, c, 'enemy', true);
        ball.spawnTimer = Math.max(ball.spawnTimer || 0, 1.2);
      }
    } finally {
      pvp.suppress = false;
    }
  }

  function sendLocalAction(type, payload) {
    if (state.mode !== 'pvp' || pvp.suppress) return;
    const action = {
      seq: ++pvp.seq,
      matchTime: Number((state.time || 0).toFixed(3)),
      type,
      payload,
    };
    state.pvpSeq = pvp.seq;
    send({ type: 'action', action });
  }

  function pvpLocalSummon(r, c, cost) {
    if (state.mode !== 'pvp' || pvp.suppress) return;
    const ball = state.playerSlots[r]?.[c];
    if (!ball) return;
    sendLocalAction('summon_cell', { r, c, type: ball.type, level: ball.level, spawnTimer: ball.spawnTimer, cost });
  }

  function pvpLocalUrgent(r, c, cost) {
    if (state.mode !== 'pvp' || pvp.suppress) return;
    sendLocalAction('urgent_dispatch', { r, c, cost });
  }

  function pvpSyncError(message) {
    setStatus(message);
    state.phase = 'paused';
    const panel = document.getElementById('resultPanel');
    const title = document.getElementById('resultTitle');
    const detail = document.getElementById('resultDetail');
    if (panel && title && detail) {
      title.textContent = 'PVP 同步异常';
      detail.textContent = message;
      document.getElementById('btnNext')?.classList.add('hide');
      panel.classList.remove('hide');
    }
  }

  function returnToArenaFromPvp(panel) {
    if (panel) panel.classList.add('hide');
    state.mode = 'pve';
    state.phase = 'menu';
    state.endless = false;
    if (window.productShellShowTab) window.productShellShowTab('arena');
  }

  function showPvpDisconnectResult() {
    const panel = document.getElementById('resultPanel');
    const title = document.getElementById('resultTitle');
    const detail = document.getElementById('resultDetail');
    const nextBtn = document.getElementById('btnNext');
    const retry = document.getElementById('btnRetry');
    const menu = document.getElementById('btnMenu');
    if (!panel || !title || !detail) return;
    nextBtn?.classList.add('hide');
    title.textContent = '对手离线';
    detail.innerHTML = `房间 ${state.pvpRoomId || pvp.roomId || '-'}<br>本局已暂停，V1 暂不做断线重连。`;
    if (retry) {
      const clone = retry.cloneNode(true);
      retry.parentNode.replaceChild(clone, retry);
      clone.textContent = '返回竞技';
      clone.classList.remove('hide');
      clone.addEventListener('click', () => returnToArenaFromPvp(panel));
    }
    if (menu) {
      const clone = menu.cloneNode(true);
      menu.parentNode.replaceChild(clone, menu);
      clone.textContent = '返回竞技';
      clone.addEventListener('click', () => returnToArenaFromPvp(panel));
    }
    panel.classList.remove('hide');
  }

  function handlePeerLeft() {
    setStatus('对手离线');
    if (state.mode === 'pvp' && state.phase === 'playing') {
      state.phase = 'paused';
      addFx(W / 2, LAYOUT.fieldY + 90, '对手离线', THEME.accent, 18);
      showPvpDisconnectResult();
    }
  }

  function installBattleHooks() {
    if (typeof updateAI === 'function' && !updateAI._pvpV1) {
      const oldUpdateAI = updateAI;
      updateAI = function updateAIPvpGuard(dt) {
        if (state.mode === 'pvp') return;
        return oldUpdateAI(dt);
      };
      updateAI._pvpV1 = true;
    }

    if (typeof randomType === 'function' && !randomType._pvpV1) {
      const oldRandomType = randomType;
      randomType = function randomTypePvp(pool = null) {
        if (state.mode === 'pvp') return pvpPick(pool || activeDeck());
        return oldRandomType(pool);
      };
      randomType._pvpV1 = true;
    }

    if (typeof spawnSoldierFromBall === 'function' && !spawnSoldierFromBall._pvpV1) {
      const oldSpawn = spawnSoldierFromBall;
      spawnSoldierFromBall = function spawnSoldierPvpStable(ball, r, c, side, forced = false) {
        const soldier = oldSpawn(ball, r, c, side, forced);
        if (soldier && state.mode === 'pvp') {
          const n = ++pvp.spawnCounters[side];
          const center = slotCenter(r, c, side === 'enemy');
          const offsetPattern = [-6, 0, 6, -3, 3];
          const offset = offsetPattern[(n - 1) % offsetPattern.length];
          soldier.id = `${side}-${n}`;
          soldier.x = center.x + offset;
          soldier.laneX = BOARD_X + c * (CELL + GAP) + CELL / 2 + offset * 0.45;
        }
        return soldier;
      };
      spawnSoldierFromBall._pvpV1 = true;
    }

    if (typeof tryMove === 'function' && !tryMove._pvpV1) {
      const oldTryMove = tryMove;
      tryMove = function tryMovePvp(slots, fromR, fromC, toR, toC) {
        const result = oldTryMove(slots, fromR, fromC, toR, toC);
        if (result?.moved && state.mode === 'pvp' && slots === state.playerSlots && !pvp.suppress) {
          sendLocalAction('move_cell', { fromR, fromC, toR, toC });
        }
        return result;
      };
      tryMove._pvpV1 = true;
    }

    if (typeof tryMerge === 'function' && !tryMerge._pvpV1) {
      const oldTryMerge = tryMerge;
      tryMerge = function tryMergePvp(slots, fromR, fromC, toR, toC) {
        const result = oldTryMerge(slots, fromR, fromC, toR, toC);
        if (result && state.mode === 'pvp' && slots === state.playerSlots && !pvp.suppress) {
          sendLocalAction('merge_or_swap_cell', { fromR, fromC, toR, toC });
        }
        return result;
      };
      tryMerge._pvpV1 = true;
    }

    if (typeof onGameOver === 'function' && !onGameOver._pvpV1) {
      const oldGameOver = onGameOver;
      onGameOver = function onGameOverPvp(win) {
        if (state.mode === 'pvp') return showPvpResult(win);
        return oldGameOver(win);
      };
      onGameOver._pvpV1 = true;
    }
  }

  function showPvpResult(win) {
    const panel = document.getElementById('resultPanel');
    const title = document.getElementById('resultTitle');
    const detail = document.getElementById('resultDetail');
    const nextBtn = document.getElementById('btnNext');
    const retry = document.getElementById('btnRetry');
    const menu = document.getElementById('btnMenu');
    if (!panel || !title || !detail) return;
    nextBtn?.classList.add('hide');
    if (retry) {
      const retryClone = retry.cloneNode(true);
      retry.parentNode.replaceChild(retryClone, retry);
      retryClone.textContent = '再来一局';
      retryClone.classList.remove('hide');
      retryClone.addEventListener('click', () => returnToArenaFromPvp(panel));
    }
    title.textContent = win ? 'PVP 胜利' : 'PVP 失败';
    detail.innerHTML = `房间 ${state.pvpRoomId || pvp.roomId}<br>用时 ${Math.floor(state.time || 0)} 秒<br>击破 ${state.kills || 0}`;
    if (menu) {
      const clone = menu.cloneNode(true);
      menu.parentNode.replaceChild(clone, menu);
      clone.textContent = '返回竞技';
      clone.addEventListener('click', () => returnToArenaFromPvp(panel));
    }
    panel.classList.remove('hide');
  }

  installBattleHooks();

  window.pvpClient = {
    connect,
    createRoom,
    joinRoom,
    setReady,
    leaveRoom,
    getStatus,
    onStatus(fn) { pvp.onStatus = fn; notify(); },
    sendLocalAction,
    localSummon: pvpLocalSummon,
    localUrgent: pvpLocalUrgent,
  };
  window.startPvpMatch = startPvpMatch;
})();
