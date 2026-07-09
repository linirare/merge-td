/* ============================================================
   水果突击 · Fruit Assault —— 输入处理
   ============================================================ */

const SUMMON_COST = 1;
const URGENT_DISPATCH_COST = 2;

function toGame(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
}

function eventPoint(ev) {
  const p = ev.touches?.[0] || ev.changedTouches?.[0] || ev;
  return toGame(p.clientX, p.clientY);
}

function summonFruitAt(r, c) {
  if (state.playerSlots[r][c]) return false;
  const center = slotCenter(r, c, false);
  if (state.sp < SUMMON_COST) {
    addFx(center.x, center.y - 22, '果汁不足', THEME.accent, 13);
    return false;
  }
  state.sp -= SUMMON_COST;
  state.summonCount = (state.summonCount || 0) + 1;
  const type = randomType(activeDeck());
  state.playerSlots[r][c] = createBall(type, 1);
  state.playerSlots[r][c].spawnTimer = Math.max(state.playerSlots[r][c].spawnTimer, 2.2);
  const t = TYPES[type];
  state.rings.push({ x: center.x, y: center.y, r: 9, life: 0.36, maxLife: 0.36, color: t.color || THEME.gold });
  addFx(center.x, center.y - 24, `果汁 -${SUMMON_COST} · 召唤${t.icon}`, THEME.gold, 13);
  playSfx('merge');
  return true;
}

/* ——— 双击急派兵 ——— */
let lastTap = { time: 0, r: -1, c: -1 };

function onDown(ev) {
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
  if (!s) { lastTap.time = 0; return; }
  const [r, c] = s;
  const ball = state.playerSlots[r][c];

  // 空格点击：消耗果汁主动召唤。拖拽规则全部免费，点击行动才花果汁。
  if (!ball) {
    lastTap.time = 0;
    summonFruitAt(r, c);
    return;
  }

  const now = performance.now();
  if (lastTap.r === r && lastTap.c === c && (now - lastTap.time) < 350) {
    const alive = state.playerSoldiers.filter(s => s.alive).length;
    const center = slotCenter(r, c, false);
    if (state.sp < URGENT_DISPATCH_COST) {
      addFx(center.x, center.y - 24, '果汁不足，无法急派', THEME.accent, 13);
    } else if (alive >= MAX_SOLDIERS) {
      addFx(center.x, center.y - 24, '兵数已满', THEME.accent, 13);
    } else {
      state.sp -= URGENT_DISPATCH_COST;
      const soldier = spawnSoldierFromBall(ball, r, c, 'player', true);
      ball.spawnTimer = Math.max(ball.spawnTimer || 0, 1.2);
      state.rings.push({ x: center.x, y: center.y, r: 8, life: 0.34, maxLife: 0.34, color: THEME.gold });
      addFx(center.x, center.y - 24, soldier ? `果汁 -${URGENT_DISPATCH_COST} · 急派兵!` : '无法派兵', soldier ? THEME.gold : THEME.accent, 13);
    }
    lastTap.time = 0;
    return;
  }
  lastTap = { time: now, r, c };

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

function snapActionFor(targetBall, dragUnit) {
  if (!targetBall) return 'move';
  if (targetBall.type === dragUnit.type && targetBall.level === dragUnit.level && targetBall.level < MAX_LEVEL) return 'merge';
  if (dragUnit.type === 'kiwi_wildcard' && targetBall.level === dragUnit.level && targetBall.level < MAX_LEVEL) return 'merge';
  if (dragUnit.type === 'passion_copy' && targetBall.level === dragUnit.level) return 'copy';
  return 'swap';
}

function onMove(ev) {
  if (!state.drag) return;
  ev.preventDefault();
  const p = eventPoint(ev);
  state.drag.x = p.x;
  state.drag.y = p.y;
  const dx = p.x - state.drag.sx;
  const dy = p.y - state.drag.sy;
  if (dx * dx + dy * dy > 12 * 12) state.drag.moved = true;

  let bestDist = 24;
  state.drag.nearestSnap = null;
  state.drag.snapAction = '';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (r === state.drag.fromR && c === state.drag.fromC) continue;
      const rc = slotCenter(r, c, false);
      const dist = Math.sqrt((p.x - rc.x) ** 2 + (p.y - rc.y) ** 2);
      if (dist < bestDist) {
        const tb = state.playerSlots[r][c];
        bestDist = dist;
        state.drag.nearestSnap = { r, c };
        state.drag.snapAction = snapActionFor(tb, state.drag.unit);
      }
    }
  }
}

function onUp(ev) {
  if (state.pendingPlace) {
    const p = eventPoint(ev);
    const s = slotAt(p.x, p.y, false);
    if (s) {
      const [toR, toC] = s;
      if (!state.playerSlots[toR][toC]) {
        const pp = state.pendingPlace;
        state.playerSlots[toR][toC] = createBall(pp.type, pp.level);
        state.overflowQueue.splice(pp.queueIndex, 1);
        const center = slotCenter(toR, toC, false);
        state.rings.push({ x: center.x, y: center.y, r: 8, life: 0.35, maxLife: 0.35, color: THEME.gold });
        addFx(center.x, center.y - 22, '部署水果营', THEME.gold, 13);
      }
    }
    state.pendingPlace = null;
    return;
  }

  if (!state.drag) return;
  const d = state.drag;
  state.drag = null;
  if (!d.moved) return;

  let s = slotAt(d.x, d.y, false);
  if (!s && d.nearestSnap) s = [d.nearestSnap.r, d.nearestSnap.c];
  if (!s) return;
  const [toR, toC] = s;
  if (toR === d.fromR && toC === d.fromC) return;

  const targetBall = state.playerSlots[toR][toC];
  if (!targetBall) {
    const moved = tryMove(state.playerSlots, d.fromR, d.fromC, toR, toC);
    if (moved) {
      const center = slotCenter(toR, toC, false);
      state.rings.push({ x: center.x, y: center.y, r: 6, life: 0.22, maxLife: 0.22, color: 'rgba(255,255,255,0.55)' });
      addFx(center.x, center.y - 22, '移动', THEME.safe, 11);
    }
  } else {
    const result = tryMerge(state.playerSlots, d.fromR, d.fromC, toR, toC);
    if (result && result.merged) {
      state.merges++;
      if (result.wildcard) state.specialMerges++;
      playSfx('merge');
      const ct = TYPES[result.type];
      const center = slotCenter(toR, toC, false);
      addFx(center.x, center.y - 24, `${ct.icon} ${ct.name} Lv.${result.newLevel}`, THEME.gold, 14);
      if (result.newLevel >= 3) addFx(center.x, center.y + 26, '下一波兵阶提升', '#fff2be', 11);
      state.rings.push({ x: center.x, y: center.y, r: 10, life: 0.55, maxLife: 0.55, color: THEME.gold });
      for (let i = 0; i < 10; i++) {
        const angle = (Math.PI * 2 / 10) * i;
        const speed = 48 + Math.random() * 70;
        state.fx.push({
          x: center.x, y: center.y, text: '✦', color: ct.color,
          size: 5 + Math.random() * 4, life: 0.55, maxLife: 0.55,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        });
      }
      state.shake = Math.min(0.35 + result.newLevel * 0.13, 1.7);
    } else if (result && result.copied) {
      state.specialMerges++;
      playSfx('merge');
      const ct = TYPES[result.type];
      const center = slotCenter(d.fromR, d.fromC, false);
      addFx(center.x, center.y - 24, `复制成 ${ct.icon}${ct.name}`, THEME.info, 13);
      state.rings.push({ x: center.x, y: center.y, r: 8, life: 0.36, maxLife: 0.36, color: THEME.info });
    } else if (result && result.swap) {
      const center = slotCenter(toR, toC, false);
      state.rings.push({ x: center.x, y: center.y, r: 6, life: 0.22, maxLife: 0.22, color: THEME.info });
      addFx(center.x, center.y - 22, '交换', THEME.info, 11);
    }
  }
}

/* ——— 视觉特效 ——— */
function addFx(x, y, text, color, size) {
  state.fx.push({ x, y, text, color, size, life: 1, maxLife: 1 });
}

function initInput(cvs) {
  cvs.addEventListener('mousedown', onDown);
  cvs.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  cvs.addEventListener('touchstart', onDown, { passive: false });
  cvs.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onUp);
}