/* ============================================================
   水果突击 · UI Consolidation v30
   目的：把 v23~v29 的多层覆盖收束成最后一层“局内视觉总控”。
   1) 背景弱化；2) 棋盘/战场/格子重新分层；3) 水果轻承托；
   4) Lv固定阶段色；5) 果堡血条再瘦身；6) 阶段提示收为小条。
   Loaded last.
   ============================================================ */

(function installUiConsolidationV30() {
  neutralizeOldFinalOverlaysV30();
  patchBackgroundV30();
  patchBoardV30();
  patchFieldV30();
  patchFruitV30();
  patchCooldownV30();
  patchWallBarsV30();
  patchFinalDrawV30();
})();

const UI_CONSOLIDATION_BUILD = 'ui-consolidation-v30';

function neutralizeOldFinalOverlaysV30() {
  // 旧 wrapper 里会在 draw() 后额外画血条/阶段条；这里把旧函数置轻，避免重复覆盖。
  if (typeof drawCompactWallHpBarsV27 === 'function') drawCompactWallHpBarsV27 = function noopWallBarsV30() {};
  if (typeof drawTinyPhaseHudV27 === 'function') drawTinyPhaseHudV27 = function noopPhaseHudV30() {};
}

function roundPanelV30(x, y, w, h, r, fill, stroke, shadow = 'rgba(0,0,0,0.04)') {
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
    ctx.lineWidth = 1.45;
    roundRect(x + 0.5, y + 0.5, w - 1, h - 1, r);
    ctx.stroke();
  }
  ctx.restore();
}

/* ------------------------------------------------------------
   A. 背景：继续清新，但压低装饰存在感
   ------------------------------------------------------------ */
function patchBackgroundV30() {
  drawBackground = function drawBackgroundConsolidatedV30() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#f8f6c8');
    sky.addColorStop(0.30, '#ddf6b2');
    sky.addColorStop(0.68, '#b7ed9a');
    sky.addColorStop(1, '#9ce08e');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // 远景果园树影，只做氛围，不能抢棋盘。
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = '#45a649';
    for (let i = 0; i < 8; i++) {
      const x = -20 + i * 68;
      ctx.beginPath();
      ctx.arc(x + 20, LAYOUT.enemyWallY - 64, 32, 0, Math.PI * 2);
      ctx.arc(x + 46, LAYOUT.enemyWallY - 72, 38, 0, Math.PI * 2);
      ctx.arc(x + 74, LAYOUT.enemyWallY - 62, 30, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const fruits = [
      ['rgba(255,93,108,0.07)', 52, 86, 18],
      ['rgba(155,92,255,0.06)', 400, 102, 22],
      ['rgba(255,201,60,0.07)', 420, 740, 28],
      ['rgba(83,201,106,0.06)', 58, 730, 24],
    ];
    for (const [color, x, y, r] of fruits) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const vignette = ctx.createRadialGradient(W / 2, H * 0.46, 80, W / 2, H * 0.52, 470);
    vignette.addColorStop(0, 'rgba(255,255,255,0.12)');
    vignette.addColorStop(0.66, 'rgba(255,255,255,0)');
    vignette.addColorStop(1, 'rgba(40,130,60,0.09)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  };
}

/* ------------------------------------------------------------
   B. 棋盘容器 + 格子：明确从背景里立起来
   ------------------------------------------------------------ */
function boardStyleV30(isEnemy) {
  if (isEnemy) {
    return {
      fill: 'rgba(255,247,241,0.94)',
      stroke: 'rgba(233,190,195,0.96)',
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
function slotStyleV30(isEnemy, intent = '') {
  if (intent === 'merge') return { fill: 'rgba(255,247,214,0.94)', stroke: 'rgba(255,200,60,0.92)' };
  if (intent === 'move' || intent === 'swap') return { fill: 'rgba(245,255,248,0.94)', stroke: 'rgba(120,210,150,0.80)' };
  if (isEnemy) return { fill: 'rgba(255,245,240,0.84)', stroke: 'rgba(225,155,165,0.44)' };
  return { fill: 'rgba(248,255,244,0.88)', stroke: 'rgba(132,194,122,0.46)' };
}
function patchBoardV30() {
  drawBoard = function drawBoardConsolidatedV30(slots, isEnemy, dragHint = null) {
    const by = isEnemy ? LAYOUT.enemyBoardY : LAYOUT.playerBoardY;
    const panel = boardStyleV30(isEnemy);
    const title = isEnemy ? '敌方水果营' : '我方水果营';

    roundPanelV30(BOARD_X - 10, by - 22, BOARD_W + 20, BOARD_H + 30, 18, panel.fill, panel.stroke, panel.shadow);

    ctx.save();
    ctx.strokeStyle = panel.inner;
    ctx.lineWidth = 1;
    roundRect(BOARD_X - 4, by - 16, BOARD_W + 8, BOARD_H + 18, 15);
    ctx.stroke();
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
        const slot = slotStyleV30(isEnemy, intent);

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
          drawSlotLevelBadgeV30(x, y, ball.level || 1, isEnemy);
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

/* ------------------------------------------------------------
   C. 水果主体：中间值大小 + 米白轻托底 + 技能小标
   ------------------------------------------------------------ */
const FRUIT_SCALE_V30 = {
  grape_archer: 0.91, pumpkin_roller: 0.93, coconut_guard: 0.95,
  watermelon_guard: 0.99, pineapple_lancer: 0.99, orange_cannon: 0.99,
  peach_medic: 1.01, pear_frost: 0.99, blueberry_sniper: 0.97,
  banana_raider: 1.03, lemon_assassin: 1.01, kiwi_wildcard: 0.99, passion_copy: 0.97,
};
function fruitScaleV30(type) { return FRUIT_SCALE_V30[type] ?? 0.99; }
function levelScaleV30(level) {
  return ({ 1:0.94, 2:1.00, 3:1.08, 4:1.17, 5:1.26, 6:1.37, 7:1.49 })[Math.max(1, Math.min(7, level || 1))] || 1;
}
function skillColorV30(type) {
  if (typeof boardSkillColorV25 === 'function') return boardSkillColorV25(type);
  return TYPES[type]?.color || '#ffd54f';
}
function patchFruitV30() {
  drawBall = function drawBallConsolidatedV30(ball, cx, cy, radius, extraY = 0, isEnemy = false) {
    if (!ball) return;
    const t = TYPES[ball.type] || TYPES[DEFAULT_DECK[0]];
    const level = Math.max(1, Math.min(7, ball.level || 1));
    const bounceOff = ball.bounce ? -Math.sin(ball.bounce * Math.PI) * 8 : 0;
    const floatOff = Math.sin((state?.time || 0) * 1.25 + cx * 0.05 + cy * 0.05) * 0.55;
    const drawY = cy - bounceOff + floatOff + extraY;
    const lvScale = levelScaleV30(level) * fruitScaleV30(ball.type);
    const emojiSize = Math.round(radius * 1.52 * lvScale);
    const ringR = radius * (0.83 + (level - 1) * 0.060) * fruitScaleV30(ball.type);
    const ringColor = isEnemy ? '#ff6578' : (t.color || '#53c96a');

    ctx.save();
    // 轻落地阴影。
    ctx.globalAlpha = isEnemy ? 0.12 : 0.16;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(cx, drawY + radius * 0.74, radius * 0.50 * lvScale, radius * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    // 中性米白托底，防止水果漂浮，但不恢复彩色底盘。
    ctx.globalAlpha = isEnemy ? 0.72 : 0.86;
    ctx.fillStyle = 'rgba(255,255,255,0.58)';
    ctx.beginPath();
    ctx.ellipse(cx, drawY + 1, radius * 0.88, radius * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isEnemy ? 'rgba(210,150,160,0.20)' : 'rgba(120,160,110,0.20)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, drawY + 1, radius * 0.88, radius * 0.78, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 细外圈。
    ctx.globalAlpha = isEnemy ? 0.42 : 0.52;
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = level >= 6 ? 2.5 : level >= 4 ? 2.1 : 1.7;
    ctx.beginPath();
    ctx.arc(cx, drawY, ringR, 0, Math.PI * 2);
    ctx.stroke();

    if (level >= 4) {
      ctx.globalAlpha = level >= 7 ? 0.25 : level >= 6 ? 0.19 : 0.13;
      ctx.shadowColor = ringColor;
      ctx.shadowBlur = level >= 7 ? 12 : level >= 6 ? 9 : 6;
      ctx.strokeStyle = level >= 7 ? '#fff176' : ringColor;
      ctx.lineWidth = level >= 7 ? 3 : 2.1;
      ctx.beginPath();
      ctx.arc(cx, drawY, ringR + 4 + level * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.globalAlpha = isEnemy ? 0.82 : 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${emojiSize}px sans-serif`;
    ctx.lineWidth = Math.max(2.0, emojiSize * 0.045);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.strokeText(t.icon, cx, drawY + 1);
    ctx.fillStyle = '#fff';
    ctx.fillText(t.icon, cx, drawY + 1);

    if (level >= 4) {
      const skillColor = skillColorV30(ball.type);
      const markX = cx + ringR * 0.72;
      const markY = drawY - ringR * 0.72;
      const markR = Math.max(5.8, radius * 0.155);
      ctx.globalAlpha = isEnemy ? 0.60 : 0.84;
      ctx.fillStyle = 'rgba(20,24,16,0.46)';
      ctx.beginPath();
      ctx.arc(markX, markY, markR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = skillColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(markX, markY, markR, 0, Math.PI * 2);
      ctx.stroke();
      if (typeof drawBoardSkillMarkV25 === 'function') drawBoardSkillMarkV25(markX, markY, ball.type, Math.max(3.9, radius * 0.098), skillColor);
    }

    if (state.phase === 'playing') {
      const cd = SPAWN_COOLDOWNS[level] || SPAWN_COOLDOWNS[1];
      const ready = ball.spawnTimer <= 0;
      const progress = ready ? 1 : clamp01(1 - ball.spawnTimer / cd);
      ctx.globalAlpha = ready ? 0.74 : 0.38;
      ctx.strokeStyle = ready ? '#fff176' : ringColor;
      ctx.lineWidth = ready ? 2.4 : 1.9;
      if (ready) { ctx.shadowColor = '#fff176'; ctx.shadowBlur = 6; }
      ctx.beginPath();
      ctx.arc(cx, drawY, ringR + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  };
}

function levelBadgeStyleV30(level, isEnemy) {
  if (level >= 7) return { fill:'#ff5f4f', stroke:'#fff176', text:'#fff8d8' };
  if (level >= 6) return { fill:'#ff9a35', stroke:'#ffe37a', text:'#fff8d8' };
  if (level >= 5) return { fill:'#ffe37a', stroke:'#f39200', text:'#6b3f00' };
  if (level >= 4) return { fill:'#fffef0', stroke:'#ffcc33', text:'#745000' };
  if (level >= 3) return { fill:'#dcfff0', stroke:'#39c9a0', text:'#186b51' };
  if (level >= 2) return { fill:'#eaffcf', stroke:'#73d98b', text:'#236b37' };
  return { fill:'rgba(255,255,255,0.96)', stroke:isEnemy ? '#ff9aaa' : '#93d98d', text:'#2c5d35' };
}
function drawSlotLevelBadgeV30(x, y, level, isEnemy) {
  const lv = Math.max(1, Math.min(7, level || 1));
  const s = levelBadgeStyleV30(lv, isEnemy);
  const bw = lv >= 4 ? 30 : 27;
  const bh = 17;
  const bx = x + 2;
  const by = y + 2;
  ctx.save();
  ctx.globalAlpha = isEnemy ? 0.88 : 1;
  ctx.shadowColor = 'rgba(0,0,0,0.20)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = s.fill;
  roundRect(bx, by, bw, bh, 7);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = s.stroke;
  ctx.lineWidth = 1.8;
  roundRect(bx + 0.5, by + 0.5, bw - 1, bh - 1, 7);
  ctx.stroke();
  ctx.font = '900 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = s.text;
  ctx.fillText(`Lv${lv}`, bx + bw / 2, by + bh / 2 + 0.5);
  ctx.restore();
}

/* ------------------------------------------------------------
   D. 战场：暖米黄独立面，去常驻文字
   ------------------------------------------------------------ */
function patchFieldV30() {
  drawField = function drawFieldConsolidatedV30() {
    const fy = LAYOUT.fieldY;
    const fh = LAYOUT.fieldH;
    const x = 24;
    const w = W - 48;

    roundPanelV30(x, fy, w, fh, 18, 'rgba(248,235,199,0.92)', 'rgba(221,200,147,0.95)', 'rgba(120,100,40,0.04)');
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
        ctx.fillStyle = 'rgba(255,93,108,0.12)';
        roundRect(lx - 25, fy + 12, 50, fh - 24, 12);
        ctx.fill();
      }
      ctx.strokeStyle = laneColor;
      ctx.lineWidth = c === 2 ? 2.0 : 1.4;
      ctx.beginPath();
      ctx.moveTo(lx, fy + 15);
      ctx.lineTo(lx, fy + fh - 15);
      ctx.stroke();
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

/* ------------------------------------------------------------
   E. 冷却与墙血条：弱化重复信息，保留关键读数
   ------------------------------------------------------------ */
function patchCooldownV30() {
  if (typeof drawOneCooldownV20 === 'function') {
    drawOneCooldownV20 = function drawOneCooldownConsolidatedV30(ball, r, c, isEnemy) {
      if (!ball) return;
      const rect = slotRect(r, c, isEnemy);
      const center = slotCenter(r, c, isEnemy);
      const full = SPAWN_COOLDOWNS[ball.level || 1] || SPAWN_COOLDOWNS[1];
      const progress = 1 - clamp01((ball.spawnTimer || 0) / full);
      const color = isEnemy ? '#ff6578' : (TYPES[ball.type]?.color || THEME.gold);
      ctx.save();
      ctx.globalAlpha = isEnemy ? 0.16 : 0.28;
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      roundRect(rect.x + 12, rect.y + CELL - 7, CELL - 24, 3.5, 2);
      ctx.fill();
      ctx.fillStyle = color;
      roundRect(rect.x + 12, rect.y + CELL - 7, Math.max(2, (CELL - 24) * progress), 3.5, 2);
      ctx.fill();
      if (!isEnemy && progress >= 0.96) {
        ctx.globalAlpha = 0.28 + Math.sin(performance.now() / 95) * 0.12;
        ctx.strokeStyle = '#fff176';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(center.x, center.y, CELL * 0.38, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    };
  }
}

function wallRatioV30(value, maxValue) { return clamp01((value || 0) / Math.max(1, maxValue || 1)); }
function patchWallBarsV30() {
  drawProminentWallHpBars = drawFinalWallBarsV30;
  drawWall = function drawWallMinimalV30(hp, maxHp, isEnemy) {
    const y = isEnemy ? LAYOUT.enemyWallY : LAYOUT.playerWallY;
    const ratio = clamp01(hp / Math.max(1, maxHp));
    const x = isEnemy ? 92 : 102;
    const w = isEnemy ? W - 184 : W - 204;
    const h = isEnemy ? 8 : 7;
    const color = isEnemy ? '#ff6b7a' : '#59c96a';
    const dark = isEnemy ? 'rgba(127,32,49,0.34)' : 'rgba(22,115,59,0.30)';
    ctx.save();
    ctx.globalAlpha = 0.54;
    ctx.fillStyle = dark;
    roundRect(x, y + 7, w, h, 5);
    ctx.fill();
    ctx.fillStyle = color;
    roundRect(x + 2, y + 9, Math.max(5, (w - 4) * ratio), Math.max(3, h - 4), 4);
    ctx.fill();
    ctx.restore();
  };
}
function drawFinalWallBarsV30() {
  if (!state || state.phase !== 'playing') return;
  drawOneFinalWallBarV30(98, LAYOUT.enemyWallY + 1, W - 196, 13, wallRatioV30(state.enemyWallHp, state.enemyWallMax), '敌方果堡', '#ff5d6c', '#7f2031', true);
  drawOneFinalWallBarV30(110, LAYOUT.playerWallY + 4, W - 220, 12, wallRatioV30(state.playerWallHp, state.playerWallMax), '水果果堡', '#4fd66b', '#16733b', false);
}
function drawOneFinalWallBarV30(x, y, w, h, ratio, label, fill, dark, enemy) {
  const low = ratio <= 0.28;
  const blink = low ? 0.74 + Math.sin(performance.now() / 95) * 0.22 : 1;
  ctx.save();
  ctx.globalAlpha = enemy ? 0.90 : 0.82;
  ctx.fillStyle = 'rgba(32,38,26,0.36)';
  roundRect(x - 4, y - 3, w + 8, h + 6, 9);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.38)';
  ctx.lineWidth = 1.2;
  roundRect(x - 4, y - 3, w + 8, h + 6, 9);
  ctx.stroke();
  ctx.fillStyle = dark;
  roundRect(x, y, w, h, 7);
  ctx.fill();
  ctx.globalAlpha = blink;
  ctx.fillStyle = fill;
  roundRect(x + 3, y + 3, Math.max(5, (w - 6) * ratio), h - 6, 5);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.font = '900 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = 'rgba(0,0,0,0.42)';
  const text = `${label} ${Math.round(ratio * 100)}%`;
  ctx.strokeText(text, x + w / 2, y + h / 2 + 0.5);
  ctx.fillStyle = '#fffde8';
  ctx.fillText(text, x + w / 2, y + h / 2 + 0.5);
  ctx.restore();
}

/* ------------------------------------------------------------
   F. 最终 draw 包装：统一补最终墙血条/阶段提示
   ------------------------------------------------------------ */
function patchFinalDrawV30() {
  if (typeof draw !== 'function' || draw._uiConsolidationV30) return;
  const oldDraw = draw;
  draw = function drawUiConsolidatedV30() {
    oldDraw();
    if (!state || state.phase !== 'playing') return;
    drawFinalWallBarsV30();
    drawPhasePillV30();
  };
  draw._uiConsolidationV30 = true;
}
function drawPhasePillV30() {
  if (typeof battlePhaseV20 !== 'function') return;
  const ph = battlePhaseV20();
  const map = {
    prep: ['#4db6ff', '#e5f7ff'],
    fight: ['#ffb547', '#fff1c2'],
    wall: ['#53e77b', '#e3ffd8'],
    danger: ['#ff5d6c', '#ffe0e5'],
  };
  const [main, bg] = map[ph.key] || ['#ffc93c', '#fff4c0'];
  const x = W / 2 - 58;
  const y = LAYOUT.fieldY + 4;
  const w = 116;
  const h = 17;
  ctx.save();
  ctx.globalAlpha = 0.82;
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
