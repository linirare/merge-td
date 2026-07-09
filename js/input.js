/* ============================================================
   合成塔防 · PvE —— 输入处理
   ============================================================ */

function toGame(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / scale,
    y: (clientY - rect.top) / scale,
  };
}

function onDown(ev) {
  if (state.phase !== 'playing' && state.phase !== 'paused') return;
  ev.preventDefault();
  const p = toGame(ev.clientX || ev.touches[0].clientX, ev.clientY || ev.touches[0].clientY);

  // 暂停按钮
  if (p.x >= PAUSE_RECT.x && p.x <= PAUSE_RECT.x + PAUSE_RECT.w
    && p.y >= PAUSE_RECT.y && p.y <= PAUSE_RECT.y + PAUSE_RECT.h) {
    state.phase = state.phase === 'paused' ? 'playing' : 'paused';
    return;
  }

  if (state.phase === 'paused') return;

  // 检测帮助按钮
  if (p.x >= HELP_RECT.x && p.x <= HELP_RECT.x + HELP_RECT.w
    && p.y >= HELP_RECT.y && p.y <= HELP_RECT.y + HELP_RECT.h) {
    document.getElementById('helpPanel').classList.remove('hide');
    return;
  }

  // 检测速度按钮
  if (p.x >= SPEED_RECT.x && p.x <= SPEED_RECT.x + SPEED_RECT.w
    && p.y >= SPEED_RECT.y && p.y <= SPEED_RECT.y + SPEED_RECT.h) {
    state.speed = state.speed >= 3 ? 1 : state.speed + 1;
    return;
  }

  // 检测溢出队列按钮
  if (state.overflowQueue.length > 0
    && p.x >= OVERFLOW_RECT.x && p.x <= OVERFLOW_RECT.x + OVERFLOW_RECT.w
    && p.y >= OVERFLOW_RECT.y && p.y <= OVERFLOW_RECT.y + OVERFLOW_RECT.h) {
    showOverflowPopup();
    return;
  }

  // pendingPlace 模式：点空格放置
  if (state.pendingPlace) {
    return; // 由 onUp 处理
  }

  // 检测是否点中我方棋盘上的球
  const s = slotAt(p.x, p.y, false);
  if (!s) return;
  const [r, c] = s;
  const ball = state.playerSlots[r][c];
  if (!ball) return;

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
  };
}

function onMove(ev) {
  if (!state.drag) return;
  ev.preventDefault();
  const p = toGame(ev.clientX || ev.touches[0].clientX, ev.clientY || ev.touches[0].clientY);
  state.drag.x = p.x;
  state.drag.y = p.y;
  const dx = p.x - state.drag.sx;
  const dy = p.y - state.drag.sy;
  if (dx * dx + dy * dy > 12 * 12) state.drag.moved = true;

  // 磁吸辅助：检测最近的合法目标格
  let bestDist = 15;
  state.drag.nearestSnap = null;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const rc = slotCenter(r, c, false);
      const dist = Math.sqrt((p.x - rc.x) ** 2 + (p.y - rc.y) ** 2);
      if (dist < bestDist) {
        const tb = state.playerSlots[r][c];
        if (!tb || (tb.type === state.drag.unit.type && tb.level === state.drag.unit.level && tb.level < MAX_LEVEL)) {
          bestDist = dist;
          state.drag.nearestSnap = { r, c };
        }
      }
    }
  }
}

function onUp(ev) {
  // pendingPlace 处理
  if (state.pendingPlace) {
    const p = toGame(ev.clientX || ev.changedTouches[0].clientX, ev.clientY || ev.changedTouches[0].clientY);
    const s = slotAt(p.x, p.y, false);
    if (s) {
      const [toR, toC] = s;
      if (!state.playerSlots[toR][toC]) {
        const pp = state.pendingPlace;
        state.playerSlots[toR][toC] = createBall(pp.type, pp.level);
        state.overflowQueue.splice(pp.queueIndex, 1);
      }
    }
    state.pendingPlace = null;
    return;
  }

  if (!state.drag) return;
  const d = state.drag;
  state.drag = null;

  // 没移动 = 原地点击
  if (!d.moved) return;

  // 磁吸落点
  let s = slotAt(d.x, d.y, false);
  if (!s && d.nearestSnap) {
    // 不在任何格子上，用磁吸最近格
    s = [d.nearestSnap.r, d.nearestSnap.c];
  }
  if (!s) return;
  const [toR, toC] = s;

  // 拖到自己原来的格子
  if (toR === d.fromR && toC === d.fromC) return;

  // 尝试合成/交换
  const result = tryMerge(state.playerSlots, d.fromR, d.fromC, toR, toC);
  if (result && result.merged) {
    const ct = TYPES[result.type];
    const center = slotCenter(toR, toC, false);
    addFx(center.x, center.y - 20, `合成 ${ct.icon} Lv.${result.newLevel}`, '#ffe45a', 14);

    // 爆炸环
    state.rings.push({ x: center.x, y: center.y, r: 10, life: 0.5, maxLife: 0.5, color: '#ffe45a' });

    // 粒子爆炸
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 / 12) * i + Math.random() * 0.3;
      const speed = 60 + Math.random() * 80;
      state.fx.push({
        x: center.x, y: center.y,
        text: '●', color: ct.color,
        size: 4 + Math.random() * 4,
        life: 0.8, maxLife: 0.8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
      });
    }

    // 合成震动按等级增强
    const shakeIntensity = 0.3 + result.newLevel * 0.15;
    state.shake = Math.min(shakeIntensity, 2.0);

    drainOverflow(state.playerSlots, state.overflowQueue);
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
