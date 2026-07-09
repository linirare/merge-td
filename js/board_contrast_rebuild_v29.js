/* ============================================================
   水果突击 · Board Contrast Rebuild v29
   目标：重建背景 / 敌方棋盘 / 战场 / 我方棋盘 四层分离。
   1) 棋盘容器重新变实；2) 格子边界回升；3) 战场独立暖米黄面；
   4) 水果补轻承托，不恢复厚重彩底；5) 继续保留 v27/v28 的减法方向。
   Loaded last.
   ============================================================ */

(function installBoardContrastRebuildV29() {
  patchBoardContrastV29();
  patchFieldContrastV29();
  patchFruitTrayV29();
})();

const BOARD_CONTRAST_REBUILD_BUILD = 'board-contrast-rebuild-v29';

function v29RoundPanel(x, y, w, h, r, fill, stroke, shadow = 'rgba(0,0,0,0.04)') {
  ctx.save();
  ctx.shadowColor = shadow;
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = fill;
  roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.4;
    roundRect(x + 0.5, y + 0.5, w - 1, h - 1, r);
    ctx.stroke();
  }
  ctx.restore();
}

function v29BoardContainerStyle(isEnemy) {
  if (isEnemy) {
    return {
      fill: 'rgba(255,247,241,0.94)',
      stroke: 'rgba(233,190,195,0.95)',
      inner: 'rgba(255,120,140,0.10)',
      title: '#c96d76',
      shadow: 'rgba(180,80,90,0.06)',
    };
  }
  return {
    fill: 'rgba(246,255,241,0.96)',
    stroke: 'rgba(185,222,175,0.96)',
    inner: 'rgba(90,180,90,0.10)',
    title: '#57a35f',
    shadow: 'rgba(70,150,70,0.06)',
  };
}

function v29SlotStyle(isEnemy, intent = '') {
  if (intent === 'merge') {
    return { fill: 'rgba(255,247,214,0.92)', stroke: 'rgba(255,200,60,0.90)' };
  }
  if (intent === 'move' || intent === 'swap') {
    return { fill: 'rgba(245,255,248,0.92)', stroke: 'rgba(120,210,150,0.78)' };
  }
  if (isEnemy) {
    return { fill: 'rgba(255,245,240,0.84)', stroke: 'rgba(225,155,165,0.42)' };
  }
  return { fill: 'rgba(248,255,244,0.88)', stroke: 'rgba(132,194,122,0.44)' };
}

function patchBoardContrastV29() {
  if (typeof drawBoard !== 'function') return;

  drawBoard = function drawBoardContrastV29(slots, isEnemy, dragHint = null) {
    const by = isEnemy ? LAYOUT.enemyBoardY : LAYOUT.playerBoardY;
    const title = isEnemy ? '敌方水果营' : '我方水果营';
    const panel = v29BoardContainerStyle(isEnemy);

    v29RoundPanel(BOARD_X - 10, by - 22, BOARD_W + 20, BOARD_H + 30, 18, panel.fill, panel.stroke, panel.shadow);

    ctx.save();
    ctx.strokeStyle = panel.inner;
    ctx.lineWidth = 1;
    roundRect(BOARD_X - 4, by - 16, BOARD_W + 8, BOARD_H + 18, 15);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = panel.title;
    ctx.fillText(title, W / 2, by - 8);
    ctx.restore();

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
        const slot = v29SlotStyle(isEnemy, intent);

        ctx.save();
        ctx.fillStyle = slot.fill;
        roundRect(x + 3, y + 3, CELL - 6, CELL - 6, 12);
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.26)';
        roundRect(x + 5, y + 5, CELL - 10, 8, 6);
        ctx.fill();

        ctx.strokeStyle = slot.stroke;
        ctx.lineWidth = 1.35;
        roundRect(x + 3.5, y + 3.5, CELL - 7, CELL - 7, 12);
        ctx.stroke();
        ctx.restore();

        if (canMerge) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255,200,60,0.92)';
          ctx.lineWidth = 2.2;
          ctx.setLineDash([4, 4]);
          ctx.shadowColor = 'rgba(255,210,80,0.28)';
          ctx.shadowBlur = 10;
          roundRect(x + 4, y + 4, CELL - 8, CELL - 8, 10);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.shadowBlur = 0;
          ctx.restore();
        }

        if (ball) {
          ctx.save();
          if (isEnemy) ctx.globalAlpha = 0.82;
          drawBall(ball, x + CELL / 2, y + CELL / 2, CELL * 0.39, 0, isEnemy);
          ctx.restore();
        }

        if (state.pendingPlace && !ball && !isEnemy) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255,214,90,0.82)';
          ctx.lineWidth = 1.8;
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
          ctx.shadowBlur = 14;
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.6;
          roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 12);
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.restore();
        }
      }
    }
  };
}

function patchFieldContrastV29() {
  if (typeof drawField !== 'function') return;

  drawField = function drawFieldContrastV29() {
    const fy = LAYOUT.fieldY;
    const fh = LAYOUT.fieldH;
    const x = 24;
    const w = W - 48;

    v29RoundPanel(x, fy, w, fh, 18, 'rgba(248,235,199,0.92)', 'rgba(221,200,147,0.95)', 'rgba(120,100,40,0.04)');

    ctx.save();
    ctx.fillStyle = 'rgba(243,225,175,0.35)';
    roundRect(x + 10, fy + 10, w - 20, fh - 20, 15);
    ctx.fill();
    ctx.restore();

    for (let c = 0; c < COLS; c++) {
      const lx = BOARD_X + c * (CELL + GAP) + CELL / 2;
      const st = state.laneStats?.[c];
      let laneColor = 'rgba(85,145,75,0.18)';
      if (st?.status === 'enemy_adv' || st?.status === 'wall_danger') laneColor = 'rgba(255,93,108,0.34)';
      else if (st?.status === 'player_adv' || st?.status === 'siege_ready') laneColor = 'rgba(83,201,106,0.28)';
      else if (st?.status === 'clash') laneColor = 'rgba(255,201,60,0.32)';

      if (st?.danger > 38) {
        ctx.save();
        ctx.fillStyle = 'rgba(255,93,108,0.12)';
        roundRect(lx - 25, fy + 12, 50, fh - 24, 12);
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.strokeStyle = laneColor;
      ctx.lineWidth = c === 2 ? 2.0 : 1.4;
      ctx.beginPath();
      ctx.moveTo(lx, fy + 15);
      ctx.lineTo(lx, fy + fh - 15);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.strokeStyle = 'rgba(255,201,60,0.30)';
    ctx.setLineDash([7, 8]);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(x + 18, fy + fh / 2);
    ctx.lineTo(x + w - 18, fy + fh / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    for (const alert of state.laneAlerts || []) {
      const lx = BOARD_X + alert.lane * (CELL + GAP) + CELL / 2;
      const a = Math.max(0, alert.life / alert.maxLife);
      ctx.save();
      ctx.globalAlpha = Math.min(0.78, a);
      ctx.fillStyle = 'rgba(255,93,108,0.82)';
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

function patchFruitTrayV29() {
  if (typeof drawBall !== 'function') return;
  const oldDrawBall = drawBall;

  drawBall = function drawBallWithTrayV29(ball, cx, cy, radius, extraY = 0, isEnemy = false) {
    if (!ball) return oldDrawBall(ball, cx, cy, radius, extraY, isEnemy);
    const bounceOff = ball.bounce ? -Math.sin(ball.bounce * Math.PI) * 8 : 0;
    const floatOff = Math.sin((state?.time || 0) * 1.25 + cx * 0.05 + cy * 0.05) * 0.55;
    const drawY = cy - bounceOff + floatOff + extraY;

    ctx.save();
    ctx.globalAlpha = isEnemy ? 0.74 : 0.88;
    ctx.fillStyle = 'rgba(255,255,255,0.58)';
    ctx.beginPath();
    ctx.ellipse(cx, drawY + 1, radius * 0.88, radius * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isEnemy ? 'rgba(210,150,160,0.20)' : 'rgba(120,160,110,0.20)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, drawY + 1, radius * 0.88, radius * 0.78, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    oldDrawBall(ball, cx, cy, radius, extraY, isEnemy);
  };
}
