/* ============================================================
   水果突击 · Fruit Assault —— 玩法辅助与手感优化
   目标：让玩家知道该合成、该救哪一路、该什么时候双击出兵。
   Loaded after main.js and wraps update/draw safely.
   ============================================================ */

(function installGameplayAssist() {
  if (typeof update !== 'function' || typeof draw !== 'function') return;

  const oldUpdate = update;
  const oldDraw = draw;

  update = function patchedUpdate(dt) {
    oldUpdate(dt);
    if (state.phase === 'playing') updateGameplayAssist(dt);
  };

  draw = function patchedDraw() {
    oldDraw();
    if (state.phase === 'playing' || state.phase === 'paused') drawGameplayAssist();
  };
})();

function ensureAssistState() {
  if (!state.assist) {
    state.assist = {
      tip: '',
      sub: '',
      kind: 'info',
      lane: -1,
      type: '',
      cd: 0,
      life: 0,
      mercyCd: 0,
      pulse: 0,
      highlights: [],
    };
  }
  return state.assist;
}

function setAssistTip(tip, sub = '', kind = 'info', lane = -1, type = '') {
  const a = ensureAssistState();
  if (a.tip === tip && a.life > 0.4) return;
  a.tip = tip;
  a.sub = sub;
  a.kind = kind;
  a.lane = lane;
  a.type = type;
  a.life = 3.2;
  a.cd = 1.1;
}

function findBestMergeOption() {
  const seen = {};
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const b = state.playerSlots[r][c];
      if (!b || b.level >= MAX_LEVEL) continue;
      const key = b.type + '_' + b.level;
      if (!seen[key]) seen[key] = [];
      seen[key].push({ r, c, ball: b });
    }
  }
  let best = null;
  for (const list of Object.values(seen)) {
    if (list.length < 2) continue;
    const item = list[0];
    if (!best || item.ball.level > best.ball.level) best = item;
  }
  return best;
}

function findDangerLane() {
  let best = null;
  for (const st of state.laneStats || []) {
    if (!st) continue;
    if (st.danger > 34 && (!best || st.danger > best.danger)) best = st;
  }
  return best;
}

function enemyTypeOnLane(lane) {
  const count = {};
  for (const s of state.enemySoldiers || []) {
    if (!s.alive || !s.battleReady || s.protected || s.laneIndex !== lane) continue;
    count[s.type] = (count[s.type] || 0) + 1;
  }
  let best = '', n = 0;
  for (const [type, c] of Object.entries(count)) if (c > n) { best = type; n = c; }
  return best;
}

function counterTypeFor(enemyType) {
  for (const [type, target] of Object.entries(COUNTER)) if (target === enemyType) return type;
  return '';
}

function findBestCounterBall(type) {
  if (!type) return null;
  let best = null;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const b = state.playerSlots[r][c];
      if (!b || b.type !== type) continue;
      if (!best || b.level > best.ball.level) best = { r, c, ball: b };
    }
  }
  return best;
}

function updateAssistHighlights() {
  const a = ensureAssistState();
  a.highlights = [];

  if (a.lane >= 0) {
    a.highlights.push({ kind: 'lane', lane: a.lane });
  }

  if (a.type) {
    const best = findBestCounterBall(a.type);
    if (best) a.highlights.push({ kind: 'slot', r: best.r, c: best.c, label: '推荐' });
  }

  const merge = findBestMergeOption();
  if (merge && (!a.type || a.kind === 'merge')) {
    a.highlights.push({ kind: 'slot', r: merge.r, c: merge.c, label: '可合' });
  }
}

function updateMercyJuice(dt) {
  const a = ensureAssistState();
  a.mercyCd = Math.max(0, a.mercyCd - dt);
  if (state.currentLevel > 8) return;
  if (state.time < 18) return;
  if (a.mercyCd > 0) return;
  const wallRatio = state.playerWallHp / Math.max(1, state.playerWallMax);
  const danger = findDangerLane();
  if (wallRatio < 0.38 && state.sp < 2 && danger) {
    state.sp = Math.min(state.sp + 1, getSpMax(meta));
    a.mercyCd = 14;
    addFx(W / 2, LAYOUT.playerWallY - 26, '危急果汁 +1', THEME.gold, 13);
    setAssistTip('危急果汁已补充', '双击高等级水果营救线', 'danger', danger.lane, '');
  }
}

function updateGameplayAssist(dt) {
  const a = ensureAssistState();
  a.pulse += dt;
  a.life = Math.max(0, a.life - dt);
  a.cd = Math.max(0, a.cd - dt);
  updateMercyJuice(dt);
  updateAssistHighlights();
  if (a.cd > 0) return;

  const wallRatio = state.playerWallHp / Math.max(1, state.playerWallMax);
  const enemyWallRatio = state.enemyWallHp / Math.max(1, state.enemyWallMax);
  const danger = findDangerLane();

  if (state.pendingPlace) {
    setAssistTip('选择空格部署水果营', '把待部署水果营放到空格里', 'info');
    return;
  }

  if (state.overflowQueue.length > 0) {
    setAssistTip('有待部署水果营', '点击底部宝箱，补到空位', 'info');
    return;
  }

  if (danger) {
    const enemyType = enemyTypeOnLane(danger.lane);
    const counterType = counterTypeFor(enemyType);
    if (counterType) {
      setAssistTip(`第${danger.lane + 1}路危险`, `优先补 ${TYPES[counterType].name}，克制 ${TYPES[enemyType].name}`, 'danger', danger.lane, counterType);
    } else {
      setAssistTip(`第${danger.lane + 1}路危险`, '双击高等级水果营立即出兵', 'danger', danger.lane, '');
    }
    return;
  }

  const merge = findBestMergeOption();
  if (merge && (state.time < 28 || state.merges < 2)) {
    setAssistTip('可以合成升级', `拖拽两个 Lv.${merge.ball.level} ${TYPES[merge.ball.type].name} 合成`, 'merge', -1, merge.ball.type);
    return;
  }

  if (enemyWallRatio < 0.28 && state.sp > 0) {
    setAssistTip('敌方果堡快破了', '双击高等级水果营补一波攻城兵', 'attack');
    return;
  }

  if (state.sp >= getSpRecoverCap(meta) && wallRatio < 0.75) {
    setAssistTip('果汁能量已充足', '双击高等级水果营可以抢回节奏', 'info');
    return;
  }

  if (state.time > 45 && state.merges < 2) {
    setAssistTip('合成次数偏少', '高等级水果营产兵更快，战力更高', 'merge');
    return;
  }
}

function drawGameplayAssist() {
  const a = ensureAssistState();
  drawAssistHighlights(a);
  if (!a.tip || a.life <= 0) return;

  ctx.save();
  const alpha = Math.min(1, a.life / 0.35);
  ctx.globalAlpha = alpha;
  const y = LAYOUT.playerBoardY - 34;
  const w = Math.min(360, 190 + a.tip.length * 9);
  const x = W / 2 - w / 2;
  const color = a.kind === 'danger' ? THEME.accent : a.kind === 'merge' ? THEME.gold : THEME.info;

  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  roundRect(x, y, w, a.sub ? 36 : 26, 12);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  roundRect(x + 0.5, y + 0.5, w - 1, (a.sub ? 36 : 26) - 1, 12);
  ctx.stroke();

  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.fillText(a.tip, W / 2, y + 16);
  if (a.sub) {
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#5c7438';
    ctx.fillText(a.sub, W / 2, y + 29);
  }
  ctx.restore();
}

function drawAssistHighlights(a) {
  if (!a.highlights || a.highlights.length === 0) return;
  ctx.save();
  const pulse = 0.55 + Math.sin(a.pulse * 5.5) * 0.22;
  for (const h of a.highlights) {
    if (h.kind === 'lane') {
      const lx = laneXByIndex(h.lane);
      ctx.fillStyle = `rgba(255,90,65,${0.06 + pulse * 0.05})`;
      roundRect(lx - 28, LAYOUT.fieldY + 8, 56, LAYOUT.fieldH - 16, 14);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,110,80,${0.32 + pulse * 0.28})`;
      ctx.lineWidth = 2;
      roundRect(lx - 28, LAYOUT.fieldY + 8, 56, LAYOUT.fieldH - 16, 14);
      ctx.stroke();
    } else if (h.kind === 'slot') {
      const rct = slotRect(h.r, h.c, false);
      ctx.strokeStyle = `rgba(255,201,60,${0.35 + pulse * 0.42})`;
      ctx.lineWidth = 3;
      roundRect(rct.x + 3, rct.y + 3, rct.w - 6, rct.h - 6, 10);
      ctx.stroke();
      if (h.label) {
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = THEME.gold;
        ctx.fillText(h.label, rct.x + rct.w / 2, rct.y + 12);
      }
    }
  }
  ctx.restore();
}
