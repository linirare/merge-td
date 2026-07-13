/* ============================================================
   水果突击 · 实时 PVP V1
   房间码对战 / 指令同步 / 本地战斗模拟。
   ============================================================ */
(function installPvpV1() {
  const loc = window.location;
  const PVP_SERVER_URL = `${loc.protocol === 'https:' ? 'wss:' : 'ws:'}//${loc.host}/pvp`;

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
    resultReported: false,
    _reconnectAttempts: 0,
    _reconnectTimer: null,
    _savedRoomId: '',
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

  function cancelReconnect() {
    if (pvp._reconnectTimer) { clearTimeout(pvp._reconnectTimer); pvp._reconnectTimer = null; }
    pvp._reconnectAttempts = 0;
    pvp._savedRoomId = '';
  }

  function startReconnect() {
    if (pvp._reconnectTimer) return;
    if (!pvp._savedRoomId) return;
    const delay = Math.min(1000 * Math.pow(2, pvp._reconnectAttempts), 10000);
    pvp._reconnectAttempts++;
    setStatus('重连中(' + pvp._reconnectAttempts + ')...');
    pvp._reconnectTimer = setTimeout(() => {
      pvp._reconnectTimer = null;
      const rid = pvp._savedRoomId;
      if (!rid) return;
      if (pvp.ws) { try { pvp.ws.onclose = null; pvp.ws.close(); } catch(e) {} pvp.ws = null; }
      const token = (window.account && window.account.token) || '';
      const url = PVP_SERVER_URL + (token ? '?token=' + encodeURIComponent(token) : '');
      const ws = new WebSocket(url);
      ws.addEventListener('open', () => {
        if (pvp._savedRoomId !== rid) { try { ws.close(); } catch(e) {} return; }
        pvp.ws = ws;
        setStatus('已连接');
        if (rid) send({ type: 'reconnect_room', roomId: rid });
        pvp._reconnectAttempts = 0;
      });
      ws.addEventListener('close', () => {
        if (pvp.ws === ws) { setStatus('连接已断开'); startReconnect(); }
      });
      ws.addEventListener('error', () => { if (pvp.ws === ws) setStatus('连接失败'); });
      ws.addEventListener('message', event => {
        let message;
        try { message = JSON.parse(event.data); }
        catch (err) { return setStatus('收到异常消息'); }
        handleServerMessage(message);
      });
    }, delay);
  }

  function connect() {
    cancelReconnect();
    if (pvp.ws && (pvp.ws.readyState === WebSocket.OPEN || pvp.ws.readyState === WebSocket.CONNECTING)) return;
    setStatus('连接中...');
    // 带上登录 token(若已登录):服务端据此认证身份、决定聊天昵称,杜绝冒充
    const token = (window.account && window.account.token) || '';
    const url = PVP_SERVER_URL + (token ? '?token=' + encodeURIComponent(token) : '');
    pvp.ws = new WebSocket(url);
    pvp.ws.addEventListener('open', () => setStatus('已连接'));
    pvp.ws.addEventListener('close', () => {
      setStatus('连接已断开');
      if (pvp.roomId) { pvp._savedRoomId = pvp.roomId; startReconnect(); }
    });
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
    cancelReconnect();
    send({ type: 'leave_room' });
    pvp.roomId = '';
    pvp.playerIndex = -1;
    pvp.ready = false;
    pvp.peerReady = false;
    pvp.players = [];
    notify();
  }

  function sendResult(win, reason) {
    if (!pvp.roomId || !pvp.seed) return false;
    const ok = send({
      type: 'result',
      result: {
        seed: pvp.seed,
        winner: win ? pvp.playerIndex : (pvp.playerIndex === 0 ? 1 : 0),
        duration: Math.floor(state.time || 0),
        wallLeft: Math.round(100 * Math.max(0, state.playerWallHp || 0) / Math.max(1, state.playerWallMax || 1)),
        actionCount: pvp.seq || 0,
        reason: reason || 'normal',
      },
    });
    if (ok) pvp.resultReported = true;
    return ok;
  }

  function handleServerMessage(message) {
    if (message.type === 'room_created' || message.type === 'room_joined') {
      pvp.roomId = message.roomId;
      pvp.playerIndex = message.playerIndex;
      pvp.players = message.players || [];
      pvp.ready = false;
      pvp.peerReady = false;
      setStatus(message.type === 'room_created' ? '房间已创建' : '已加入房间');
    } else if (message.type === 'reconnected') {
      pvp.roomId = message.roomId;
      pvp.playerIndex = message.playerIndex;
      pvp.players = message.players || [];
      pvp.ready = false;
      pvp.peerReady = false;
      setStatus('已重连');
      pvp._savedRoomId = '';
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
    } else if (message.type === 'snapshot') {
      applySnapshot(message.snap);
    } else if (message.type === 'peer_action') {
      applyRemoteAction(message.action); // 旧帧同步遗留;服务器权威下已不发,保留兜底无害
    } else if (message.type === 'peer_left') {
      handlePeerLeft();
    } else if (message.type === 'match_result') {
      pvp.resultReported = true;
      const win = !!(message.result && message.result.winner === pvp.playerIndex);
      setStatus(win ? 'PVP 结果:胜利' : 'PVP 结果:失败');
      if (state.mode === 'pvp' && state.phase === 'playing') { state.phase = win ? 'won' : 'lost'; showPvpResult(win); }
    } else if (message.type === 'chat') {
      // WS 实时聊天(审计C9):推入全局聊天数组
      if (message.message && typeof window.chatMessages !== 'undefined' && Array.isArray(window.chatMessages)) {
        window.chatMessages.push(message.message);
        if (window.chatMessages.length > 200) window.chatMessages.shift();
      }
    } else if (message.type === 'resource_grant') {
      if (typeof account !== 'undefined' && account.user && (message.uid === account.user.uid || message.all)) {
        const g = (message.gold || 0), d = (message.diamonds || 0);
        // 直接加到本地显示(不在登录态,只能用增量)
        if (typeof meta !== 'undefined' && g) meta.gold = (meta.gold || 0) + g;
        if (typeof shell !== 'undefined' && d) shell.gems = (shell.gems || 0) + d;
        if (typeof saveAll === 'function') try { saveAll(); } catch(e) {}
        if (typeof refreshResourceNumbers === 'function') refreshResourceNumbers();
        if (g || d) { const t = [g?'金币+'+g:'', d?'钻石+'+d:''].filter(Boolean).join(', '); if (t && typeof hifiToast === 'function') hifiToast('管理员发放: ' + t); }
        // 后台同步account.user
        account.api('GET', '/api/user/profile').then(prof => {
          if (prof && !prof.error && account.user) { account.user.diamonds = prof.diamonds; account.user.gold = prof.gold; }
        }).catch(() => {});
      }
    } else if (message.type === 'new_mail') {
      if (typeof account !== 'undefined' && account.getMail) { account.getMail().catch(() => {}); if (typeof hifiToast === 'function') hifiToast('您有新的系统邮件'); }
    } else if (message.type === 'new_announcement') {
      if (typeof hifiToast === 'function') hifiToast('有新公告');
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

  // PvP 专属数值表(设计档 §10.2):平衡性调整,降低爆发方差
  const PVP_TABLE = {
    critNerf: 0.8,        // 暴击倍率 ×0.8(×2.5→×2.0, ×2.0→×1.7)
    stealthNerf: 0.67,    // 隐身时间 ×0.67(3s→2s)
  };

  function applyPvpNumbers() {
    // 应用数值到状态引擎(通过全局标记)
    window.__pvpMode = true;
    state._pvpNumbers = true;
  }

  function clearForPvp() {
    state.playerSlots = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    state.enemySlots = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    state.overflowQueue = [];
    state.enemyOverflow = 0;
    state.playerWallHp = BASE_WALL_HP;
    state.playerWallMax = BASE_WALL_HP;
    state.enemyWallHp = BASE_WALL_HP;
    state.enemyWallMax = BASE_WALL_HP;
    state.playerSoldiers = [];
    state.enemySoldiers = [];
    state.laneStats = emptyLaneStats();
    applyPvpNumbers();
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
    pvp.resultReported = false;
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
    // 服务器权威:棋盘/士兵/城墙全部由服务端快照驱动,客户端不再本地布局或跑战斗
    state.phase = 'playing';
    document.body.classList.remove('hifi-menu');
    pvp._gotSnap = false;
    console.log('[PVP] match_start 服务器权威 build-3 · playerIndex=' + playerIndex + ' seed=' + pvp.seed + ' mode=' + state.mode);
    hidePvpPanels();
    setStatus('PVP 对战中');
    addFx(W / 2, LAYOUT.fieldY + 80, '实时对战开始', THEME.gold, 18);
  }

  // —— 阶段3:服务器权威——客户端只渲染快照,不跑本地战斗 ——
  function fieldMirrorY(y) {
    // side1 视角:绕战场中线镜像,让"我"永远在下面
    const mid = (LAYOUT.playerWallY + LAYOUT.enemyWallY) / 2;
    return 2 * mid - y;
  }
  function reconstructBoard(rows) {
    if (!Array.isArray(rows)) return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    return rows.map(row => (row || []).map(cell => {
      if (!cell) return null;
      const b = createBall(cell.type, cell.level || 1);
      if (cell.sp != null) b.spawnTimer = cell.sp;
      return b;
    }));
  }
  function applySnapshot(snap) {
    if (state.mode !== 'pvp' || !snap || !snap.walls) return;
    if (!pvp._gotSnap) { pvp._gotSnap = true; console.log('[PVP] 收到首个 snapshot → 服务端权威生效(兵=' + (snap.soldiers ? snap.soldiers.length : 0) + ')'); }
    const mySide = pvp.playerIndex === 1 ? 1 : 0;
    const flip = mySide === 1;

    // 城墙/果汁:我方永远在下(playerWall),对方在上(enemyWall)
    if (mySide === 0) {
      state.playerWallHp = snap.walls.p; state.playerWallMax = snap.walls.pMax;
      state.enemyWallHp = snap.walls.e; state.enemyWallMax = snap.walls.eMax;
      state.sp = snap.sp.p; state.enemySp = snap.sp.e;
    } else {
      state.playerWallHp = snap.walls.e; state.playerWallMax = snap.walls.eMax;
      state.enemyWallHp = snap.walls.p; state.enemyWallMax = snap.walls.pMax;
      state.sp = snap.sp.e; state.enemySp = snap.sp.p;
    }

    // 棋盘:我方=snapshot 里我这侧(拖拽中不重建,避免打断手感)
    if (!state.drag) {
      const myBoard = mySide === 0 ? snap.boards.p : snap.boards.e;
      const opBoard = mySide === 0 ? snap.boards.e : snap.boards.p;
      state.playerSlots = reconstructBoard(myBoard);
      state.enemySlots = reconstructBoard(opBoard);
    }

    // 保存上一帧士兵状态(用于生成特效)
    const oldState = {}, oldPos = {};
    for (const s of state.playerSoldiers) { oldState[s.id] = s.hp; oldPos[s.id] = { x: s.x, y: s.y }; }
    for (const s of state.enemySoldiers) { oldState[s.id] = s.hp; oldPos[s.id] = { x: s.x, y: s.y }; }
    const oldIds = new Set(Object.keys(oldState));

    // 士兵:按 side 映射 player/enemy;side1 翻 y;插值保留旧对象平滑移动
    const prev = {};
    for (const s of state.playerSoldiers) prev[s.id] = s;
    for (const s of state.enemySoldiers) prev[s.id] = s;
    const mine = [], theirs = [];
    const newIds = new Set();
    for (const su of (snap.soldiers || [])) {
      newIds.add(String(su.id));
      const isMine = su.side === mySide;
      const tx = su.x;
      const ty = flip ? fieldMirrorY(su.y) : su.y;
      const o = prev[su.id] || { id: su.id, x: tx, y: ty, hitFlash: 0 };
      o.type = su.type; o.level = su.level; o.hp = su.hp; o.maxHp = su.maxHp;
      o.mode = su.mode; o.shield = su.shield; o.alive = true;
      o.side = isMine ? 'player' : 'enemy';
      o.tx = tx; o.ty = ty;
      if (su.hit) o.hitFlash = 0.28;
      o._faceDir = flip ? -(su.face || 0) : (su.face || 0);
      (isMine ? mine : theirs).push(o);

      // --- 根据快照 diff 生成视觉特效 ---
      const oldHp = oldState[su.id];
      if (su.hit) {
        // 受击位置:扩散环
        state.rings.push({ x: tx, y: ty, r: 3, life: 0.45, maxLife: 0.45, color: isMine ? '#ff6b4a' : '#4aff6b' });
        // 从最近的敌人画一条攻击线
        const enemies = isMine ? state.enemySoldiers : state.playerSoldiers;
        let near = null, nearD = 9999;
        for (const e of enemies) { const d = Math.abs(e.x - tx) + Math.abs(e.y - ty); if (d < nearD) { nearD = d; near = e; } }
        if (near && nearD < 300) state.attackFx.push({ x1: near.x, y1: near.y, x2: tx, y2: ty, life: 0.22, maxLife: 0.22 });
      }
      // 扣血数字
      if (oldHp != null && su.hp < oldHp && su.hp > 0) {
        const dmg = Math.min(oldHp - su.hp, 9999);
        if (dmg > 0) state.fx.push({ x: tx, y: ty - 14, text: '-' + dmg, color: isMine ? '#ff6b4a' : '#4aff6b', size: 11, life: 0.85, maxLife: 0.85, vx: 0, vy: -24 });
      }
    }

    // 阵亡特效:上一帧有、本帧消失的士兵
    for (const id of oldIds) {
      if (!newIds.has(id)) {
        const pos = oldPos[id];
        if (pos) state.rings.push({ x: pos.x, y: pos.y, r: 2, life: 0.55, maxLife: 0.55, color: '#ff8866' });
      }
    }
    // 出兵特效:本帧新增的士兵
    for (const su of (snap.soldiers || [])) {
      if (!oldIds.has(String(su.id))) {
        const isMine = su.side === mySide;
        const ty2 = flip ? fieldMirrorY(su.y) : su.y;
        state.rings.push({ x: su.x, y: ty2, r: 1, life: 0.45, maxLife: 0.45, color: isMine ? '#ffd700' : '#ff8c00' });
      }
    }

    state.playerSoldiers = mine;
    state.enemySoldiers = theirs;
  }

  // PvP 客户端逐帧:不驱动战斗,只把士兵插值到快照目标 + 视觉衰减
  function pvpClientUpdate(dt) {
    state.time = (state.time || 0) + dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 4); // 修:PvP 下也要衰减震动,否则一直震
    const k = Math.min(1, dt * 14);
    const lerp = (s) => { if (s.tx != null) s.x += (s.tx - s.x) * k; if (s.ty != null) s.y += (s.ty - s.y) * k; if (s.hitFlash > 0) s.hitFlash = Math.max(0, s.hitFlash - dt * 1.2); };
    for (const s of state.playerSoldiers) lerp(s);
    for (const s of state.enemySoldiers) lerp(s);
    for (let i = state.rings.length - 1; i >= 0; i--) { const r = state.rings[i]; r.life -= dt; r.r += 64 * dt; if (r.life <= 0) state.rings.splice(i, 1); }
    for (let i = state.fx.length - 1; i >= 0; i--) { const f = state.fx[i]; if (f.vx) { f.x += f.vx * dt; f.y += f.vy * dt; } f.life -= dt; if (f.life <= 0) state.fx.splice(i, 1); }
    for (let i = state.attackFx.length - 1; i >= 0; i--) { state.attackFx[i].life -= dt; if (state.attackFx[i].life <= 0) state.attackFx.splice(i, 1); }
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
    // 服务器权威模式下已不再使用此路径,保留签名作为未来扩展点
    if (!action || state.mode !== 'pvp') return;
  }

  function sendLocalAction(type, payload) {
    if (state.mode !== 'pvp' || pvp.suppress) return;
    const action = {
      seq: ++pvp.seq,
      seed: pvp.seed,
      timestamp: Date.now(),
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
    detail.innerHTML = `房间 ${state.pvpRoomId || pvp.roomId || '-'}<br>对手断线，本局按胜利上报。<br>${pvp.resultReported ? '结果已提交服务器' : '结果等待上报'}`;
    if (retry) {
      const newBtn = document.createElement("button");
      newBtn.textContent = "返回竞技";
      newBtn.className = retry.className;
      newBtn.classList.remove("hide");
      newBtn.addEventListener("click", () => returnToArenaFromPvp(panel));
      retry.parentNode.replaceChild(newBtn, retry);
    }
    if (menu) {
      const newBtn = document.createElement("button");
      newBtn.textContent = "返回竞技";
      newBtn.className = menu.className;
      newBtn.addEventListener("click", () => returnToArenaFromPvp(panel));
      menu.parentNode.replaceChild(newBtn, menu);
    }
    panel.classList.remove('hide');
  }

  function handlePeerLeft() {
    sendResult(true, 'peer_left');
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
    sendResult(win, 'normal');
    const panel = document.getElementById('resultPanel');
    const title = document.getElementById('resultTitle');
    const detail = document.getElementById('resultDetail');
    const nextBtn = document.getElementById('btnNext');
    const retry = document.getElementById('btnRetry');
    const menu = document.getElementById('btnMenu');
    if (!panel || !title || !detail) return;
    nextBtn?.classList.add('hide');
    if (retry) {
      const newBtn2 = document.createElement("button");
      newBtn2.textContent = "再来一局";
      newBtn2.className = retry.className;
      newBtn2.classList.remove("hide");
      newBtn2.addEventListener("click", () => returnToArenaFromPvp(panel));
      retry.parentNode.replaceChild(newBtn2, retry);
    }
    title.textContent = win ? 'PVP 胜利' : 'PVP 失败';
    detail.innerHTML = `房间 ${state.pvpRoomId || pvp.roomId}<br>用时 ${Math.floor(state.time || 0)} 秒<br>击破 ${state.kills || 0}<br>${pvp.resultReported ? '结果已提交服务器' : '结果等待上报'}`;
    if (menu) {
      const newBtn3 = document.createElement("button");
      newBtn3.textContent = "返回竞技";
      newBtn3.className = menu.className;
      newBtn3.addEventListener("click", () => returnToArenaFromPvp(panel));
      menu.parentNode.replaceChild(newBtn3, menu);
    }
    panel.classList.remove('hide');
    document.querySelector('#resultPanel .result-card')?.classList.toggle('win-card', win);
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
  window.pvpClientUpdate = pvpClientUpdate;
  console.log('[PVP] pvp.js 服务器权威 build-3 已加载');
  // 测试钩子:让 headless 直接验证"快照→本地state(含视角翻转)"映射,不用起真两人对局
  window.__pvpTest = { applySnapshot, fieldMirrorY, setSide(i) { pvp.playerIndex = i; } };
})();
