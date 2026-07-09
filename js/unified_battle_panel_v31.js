/* ============================================================
   水果突击 · Unified Battle Panel v31
   目标：把棋盘、战场、城墙收成一个统一主战斗面板。
   - 统一大容器
   - 上：敌方布阵区
   - 中：战场区
   - 下：我方布阵区
   - 城墙改成贴边边界条，不再悬浮割裂
   Loaded last.
   ============================================================ */
(function installUnifiedBattlePanelV31() {
  neutralizeOldUnifiedLayerV31();
  patchUnifiedBackgroundV31();
  patchUnifiedBoardsV31();
  patchUnifiedFieldV31();
  patchUnifiedWallsV31();
  patchUnifiedFinalDrawV31();
})();

const UNIFIED_BATTLE_PANEL_BUILD = 'unified-battle-panel-v31';

function neutralizeOldUnifiedLayerV31() {
  if (typeof drawFinalWallBarsV30 === 'function') drawFinalWallBarsV30 = function noopWallV31() {};
  if (typeof drawPhasePillV30 === 'function') drawPhasePillV30 = function noopPhaseV31() {};
  if (typeof drawCompactWallHpBarsV27 === 'function') drawCompactWallHpBarsV27 = function noopWall27V31() {};
  if (typeof drawTinyPhaseHudV27 === 'function') drawTinyPhaseHudV27 = function noopPhase27V31() {};
}

function roundRectPanelV31(x, y, w, h, r, fill, stroke, shadow = null) {
  ctx.save();
  if (shadow) {
    ctx.shadowColor = shadow;
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 2;
  }
  ctx.fillStyle = fill;
  roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.35;
    roundRect(x + 0.5, y + 0.5, w - 1, h - 1, r);
    ctx.stroke();
  }
  ctx.restore();
}

function mainPanelRectV31() {
  const x = 22;
  const y = Math.max(88, LAYOUT.enemyBoardY - 30);
  const w = W - 44;
  const h = LAYOUT.playerBoardY + BOARD_H + 20 - y;
  return { x, y, w, h };
}

function patchUnifiedBackgroundV31() {
  const oldBackground = typeof drawBackground === 'function' ? drawBackground : null;
  drawBackground = function drawBackgroundUnifiedV31() {
    if (oldBackground) oldBackground();
    const rect = mainPanelRectV31();

    // 主战斗大容器：棋盘、战场、城墙都属于这一个整体。
    roundRectPanelV31(rect.x, rect.y, rect.w, rect.h, 26, 'rgba(247,243,231,0.86)', 'rgba(220,207,180,0.92)', 'rgba(70,60,30,0.06)');

    // 三个内部分区，色差收敛，避免像三块独立卡片硬拼。
    const enemyY = LAYOUT.enemyBoardY - 12;
    const enemyH = BOARD_H + 12;
    const fieldY = LAYOUT.fieldY + 4;
    const fieldH = LAYOUT.fieldH - 8;
    const playerY = LAYOUT.playerBoardY - 12;
    const playerH = BOARD_H + 12;

    roundRectPanelV31(30, enemyY, W - 60, enemyH, 18, 'rgba(251,244,239,0.72)', 'rgba(226,205,207,0.50)');
    roundRectPanelV31(30, fieldY, W - 60, fieldH, 18, 'rgba(244,232,200,0.72)', 'rgba(219,204,158,0.50)');
    roundRectPanelV31(30, playerY, W - 60, playerH, 18, 'rgba(243,250,236,0.74)', 'rgba(196,221,187,0.50)');
  };
}

function slotStyleV31(isEnemy, intent = '') {
  if (intent === 'merge') return { fill: 'rgba(255,247,214,0.90)', stroke: 'rgba(255,200,60,0.88)' };
  if (intent === 'move' || intent === 'swap') return { fill: 'rgba(245,255,248,0.88)', stroke: 'rgba(120,210,150,0.74)' };
  if (isEnemy) return { fill: 'rgba(255,248,245,0.72)', stroke: 'rgba(220,175,180,0.42)' };
  return { fill: 'rgba(250,255,247,0.78)', stroke: 'rgba(150,200,140,0.42)' };
}

function patchUnifiedBoardsV31() {
  drawBoard = function drawBoardUnifiedV31(slots, isEnemy, dragHint = null) {
    const by = isEnemy ? LAYOUT.enemyBoardY : LAYOUT.playerBoardY;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = BOARD_X + c * (CELL + GAP);
        const y = by + r * (CELL + GAP);
        const ball = slots?.[r]?.[c];
        const isSnap = !isEnemy && state.drag?.nearestSnap && state.drag.nearestSnap.r === r && state.drag.nearestSnap.c === c;
        const action = isSnap ? state.drag.snapAction : '';
        const canMerge = state.drag && ball && !isEnemy && state.drag.unit.type === ball.type && state.drag.unit.level === ball.level && ball.level < MAX_LEVEL;
        const isEmptyTarget = state.drag && !ball && !isEnemy;
        const intent = isSnap ? action : canMerge ? 'merge' : isEmptyTarget ? 'move' : '';
        const slot = slotStyleV31(isEnemy, intent);

        ctx.save();
        ctx.fillStyle = slot.fill;
        roundRect(x + 3, y + 3, CELL - 6, CELL - 6, 12);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        roundRect(x + 5, y + 5, CELL - 10, 8, 6);
        ctx.fill();
        ctx.strokeStyle = slot.stroke;
        ctx.lineWidth = 1.25;
        roundRect(x + 3.5, y + 3.5, CELL - 7, CELL - 7, 12);
        ctx.stroke();
        ctx.restore();

        if (canMerge) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255,200,60,0.90)';
          ctx.lineWidth = 2.1;
          ctx.setLineDash([4, 4]);
          ctx.shadowColor = 'rgba(255,210,80,0.24)';
          ctx.shadowBlur = 10;
          roundRect(x + 4, y + 4, CELL - 8, CELL - 8, 10);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.shadowBlur = 0;
          ctx.restore();
        }

        if (ball) {
          ctx.save();
          if (isEnemy) ctx.globalAlpha = 0.84;
          drawBall(ball, x + CELL / 2, y + CELL / 2, CELL * 0.39, 0, isEnemy);
          ctx.restore();
          if (typeof drawSlotLevelBadgeV30 === 'function') drawSlotLevelBadgeV30(x, y, ball.level || 1, isEnemy);
          else if (typeof drawSlotLevelBadgesV26 === 'function') drawMiniLevelFallbackV31(x, y, ball.level || 1, isEnemy);
        }

        if (state.pendingPlace && !ball && !isEnemy) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255,214,90,0.78)';
          ctx.lineWidth = 1.7;
          ctx.setLineDash([3, 3]);
          roundRect(x + 4, y + 4, CELL - 8, CELL - 8, 10);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }

        if (isSnap && !isEnemy) {
          const color = action === 'merge' ? '#FFC83C' : action === 'move' ? '#53C96A' : '#57B7FF';
          ctx.save();
          ctx.shadowColor = color;
          ctx.shadowBlur = 12;
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.4;
          roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 12);
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.restore();
        }
      }
    }

    ctx.save();
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = isEnemy ? '#c27078' : '#5d9f62';
    ctx.fillText(isEnemy ? '敌方水果营' : '我方水果营', W / 2, by - 10);
    ctx.restore();
  };
}

function drawMiniLevelFallbackV31(x, y, level, isEnemy) {
  const lv = Math.max(1, Math.min(7, level || 1));
  ctx.save();
  ctx.fillStyle = lv >= 5 ? '#ffe37a' : '#fff';
  ctx.strokeStyle = isEnemy ? '#ff9aaa' : '#93d98d';
  roundRect(x + 2, y + 2, 27, 17, 7);
  ctx.fill();
  ctx.stroke();
  ctx.font = '900 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#2c5d35';
  ctx.fillText(`Lv${lv}`, x + 15.5, y + 10.5);
  ctx.restore();
}

function patchUnifiedFieldV31() {
  drawField = function drawFieldUnifiedV31() {
    const fy = LAYOUT.fieldY;
    const fh = LAYOUT.fieldH;

    for (let c = 0; c < COLS; c++) {
      const lx = BOARD_X + c * (CELL + GAP) + CELL / 2;
      const st = state.laneStats?.[c];
      let laneColor = 'rgba(120,140,95,0.18)';
      if (st?.status === 'enemy_adv' || st?.status === 'wall_danger') laneColor = 'rgba(230,110,120,0.26)';
      else if (st?.status === 'player_adv' || st?.status === 'siege_ready') laneColor = 'rgba(110,200,120,0.22)';
      else if (st?.status === 'clash') laneColor = 'rgba(230,185,80,0.24)';

      if (st?.danger > 38) {
        ctx.save();
        ctx.fillStyle = 'rgba(230,110,120,0.10)';
        roundRect(lx - 25, fy + 12, 50, fh - 24, 12);
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.strokeStyle = laneColor;
      ctx.lineWidth = c === 2 ? 1.8 : 1.2;
      ctx.beginPath();
      ctx.moveTo(lx, fy + 16);
      ctx.lineTo(lx, fy + fh - 16);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.strokeStyle = 'rgba(230,190,95,0.24)';
    ctx.setLineDash([7, 8]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(42, fy + fh / 2);
    ctx.lineTo(W - 42, fy + fh / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    for (const alert of state.laneAlerts || []) {
      const lx = BOARD_X + alert.lane * (CELL + GAP) + CELL / 2;
      const a = Math.max(0, alert.life / alert.maxLife);
      ctx.save();
      ctx.globalAlpha = Math.min(0.72, a);
      ctx.fillStyle = 'rgba(230,110,120,0.78)';
      roundRect(lx - 30, LAYOUT.playerWallY - 34, 60, 18, 9);
      ctx.fill();
      ctx.font = '900 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fffde8';
      ctx.fillText(alert.text || '危险', lx, LAYOUT.playerWallY - 25);
      ctx.restore();
    }
  };
}

function wallRatioV31(v, m) {
  return clamp01((v || 0) / Math.max(1, m || 1));
}

function patchUnifiedWallsV31() {
  drawProminentWallHpBars = drawUnifiedWallBarsV31;
  drawWall = function drawWallUnifiedBaseV31(hp, maxHp, isEnemy) {
    const ratio = clamp01(hp / Math.max(1, maxHp));
    const y = isEnemy ? LAYOUT.fieldY - 10 : LAYOUT.fieldY + LAYOUT.fieldH - 2;
    const x = 84;
    const w = W - 168;
    const h = 8;
    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = isEnemy ? 'rgba(169,79,89,0.30)' : 'rgba(76,141,89,0.28)';
    roundRect(x, y + 2, w, h, 5);
    ctx.fill();
    ctx.fillStyle = isEnemy ? '#e86e78' : '#77d285';
    roundRect(x + 2, y + 4, Math.max(5, (w - 4) * ratio), 4, 3);
    ctx.fill();
    ctx.restore();
  };
}

function drawUnifiedWallBarsV31() {
  if (!state || state.phase !== 'playing') return;
  drawUnifiedWallBarV31(84, LAYOUT.fieldY - 10, W - 168, 12, wallRatioV31(state.enemyWallHp, state.enemyWallMax), true);
  drawUnifiedWallBarV31(84, LAYOUT.fieldY + LAYOUT.fieldH - 2, W - 168, 12, wallRatioV31(state.playerWallHp, state.playerWallMax), false);
}

function drawUnifiedWallBarV31(x, y, w, h, ratio, enemy) {
  const dark = enemy ? 'rgba(169,79,89,0.46)' : 'rgba(76,141,89,0.42)';
  const fill = enemy ? '#e86e78' : '#77d285';
  const label = enemy ? '敌方果堡' : '水果果堡';
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.34)';
  roundRect(x - 3, y - 2, w + 6, h + 4, 8);
  ctx.fill();
  ctx.fillStyle = dark;
  roundRect(x, y, w, h, 7);
  ctx.fill();
  ctx.fillStyle = fill;
  roundRect(x + 2, y + 2, Math.max(6, (w - 4) * ratio), h - 4, 5);
  ctx.fill();
  ctx.font = '900 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fffdf3';
  ctx.strokeStyle = 'rgba(0,0,0,0.30)';
  ctx.lineWidth = 2;
  const text = `${label}${Math.round(ratio * 100)}%`;
  ctx.strokeText(text, x + w / 2, y + h / 2 + 0.5);
  ctx.fillText(text, x + w / 2, y + h / 2 + 0.5);
  ctx.restore();
}

function patchUnifiedFinalDrawV31() {
  if (typeof draw !== 'function' || draw._unifiedBattlePanelV31) return;
  const oldDraw = draw;
  draw = function drawUnifiedBattlePanelFinalV31() {
    oldDraw();
    if (!state || state.phase !== 'playing') return;
    drawUnifiedWallBarsV31();
    drawPhasePillUnifiedV31();
  };
  draw._unifiedBattlePanelV31 = true;
}

function drawPhasePillUnifiedV31() {
  if (typeof battlePhaseV20 !== 'function') return;
  const ph = battlePhaseV20();
  const map = {
    prep: ['#4db6ff', '#e5f7ff'],
    fight: ['#d9a24a', '#fff1c2'],
    wall: ['#63c97a', '#e3ffd8'],
    danger: ['#e86e78', '#ffe0e5'],
  };
  const [main, bg] = map[ph.key] || ['#d9a24a', '#fff4c0'];
  const x = W / 2 - 54;
  const y = LAYOUT.fieldY + 5;
  const w = 108;
  const h = 17;
  ctx.save();
  ctx.globalAlpha = 0.78;
  ctx.fillStyle = bg;
  roundRect(x, y, w, h, 9);
  ctx.fill();
  ctx.strokeStyle = main;
  ctx.lineWidth = 1.2;
  roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 9);
  ctx.stroke();
  ctx.font = '900 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#255027';
  ctx.fillText(ph.label, x + w / 2, y + h / 2 + 0.5);
  ctx.restore();
}
