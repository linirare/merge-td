/* ============================================================
   水果突击 · Battle Readability Cleanup v27
   目标：减法优化截图里的信息拥挤问题。
   1) 水果营按品类缩小；2) Lv牌固定且分阶段颜色；
   3) 战场去除常驻说明文字；4) 果堡血条缩小；5) 阶段/危险提示轻量化。
   Loaded last.
   ============================================================ */

(function installBattleReadabilityCleanupV27() {
  patchFruitSizeAndLevelBadgesV27();
  patchCleanBattleFieldV27();
  patchCompactWallBarsV27();
  patchLightPhaseHudV27();
})();

const BATTLE_READABILITY_CLEANUP_BUILD = 'battle-readability-cleanup-v27';

/* ------------------------------------------------------------
   A. 水果营大小和等级：水果缩小，等级变成阶段色固定牌
   ------------------------------------------------------------ */
const FRUIT_VISUAL_SCALE_V27 = {
  grape_archer: 0.84,
  pumpkin_roller: 0.86,
  coconut_guard: 0.88,
  watermelon_guard: 0.92,
  pineapple_lancer: 0.92,
  orange_cannon: 0.92,
  peach_medic: 0.94,
  pear_frost: 0.92,
  blueberry_sniper: 0.90,
  banana_raider: 0.96,
  lemon_assassin: 0.94,
  kiwi_wildcard: 0.92,
  passion_copy: 0.90,
};
function fruitVisualScaleV27(type) {
  return FRUIT_VISUAL_SCALE_V27[type] ?? 0.92;
}
function boardLvScaleV27(level) {
  return ({ 1:0.90, 2:0.96, 3:1.03, 4:1.11, 5:1.19, 6:1.29, 7:1.40 })[Math.max(1, Math.min(7, level || 1))] || 1;
}
function levelBadgeStyleV27(level, isEnemy) {
  if (level >= 7) return { fill:'#ff5f4f', stroke:'#fff176', text:'#fff8d8' };
  if (level >= 6) return { fill:'#ff9a35', stroke:'#ffe37a', text:'#fff8d8' };
  if (level >= 5) return { fill:'#ffe37a', stroke:'#f39200', text:'#6b3f00' };
  if (level >= 4) return { fill:'#fffef0', stroke:'#ffcc33', text:'#745000' };
  if (level >= 3) return { fill:'#dcfff0', stroke:'#39c9a0', text:'#186b51' };
  if (level >= 2) return { fill:'#eaffcf', stroke:'#73d98b', text:'#236b37' };
  return { fill:'rgba(255,255,255,0.96)', stroke:isEnemy ? '#ff9aaa' : '#93d98d', text:'#2c5d35' };
}
function drawSlotLevelBadgeV27(x, y, level, isEnemy) {
  const s = levelBadgeStyleV27(level, isEnemy);
  const text = `Lv${level}`;
  const bw = level >= 4 ? 30 : 27;
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
  ctx.fillText(text, bx + bw / 2, by + bh / 2 + 0.5);
  ctx.restore();
}
function patchFruitSizeAndLevelBadgesV27() {
  drawBall = function drawBallCleanFruitV27(ball, cx, cy, radius, extraY = 0, isEnemy = false) {
    if (!ball) return;
    const t = TYPES[ball.type] || TYPES[DEFAULT_DECK[0]];
    const level = Math.max(1, Math.min(7, ball.level || 1));
    const bounceOff = ball.bounce ? -Math.sin(ball.bounce * Math.PI) * 8 : 0;
    const floatOff = Math.sin((state?.time || 0) * 1.25 + cx * 0.05 + cy * 0.05) * 0.55;
    const drawY = cy - bounceOff + floatOff + extraY;
    const lvScale = boardLvScaleV27(level) * fruitVisualScaleV27(ball.type);
    const emojiSize = Math.round(radius * 1.48 * lvScale);
    const ringR = radius * (0.80 + (level - 1) * 0.058) * fruitVisualScaleV27(ball.type);
    const ringColor = isEnemy ? '#ff6578' : (t.color || '#53c96a');

    ctx.save();
    ctx.globalAlpha = isEnemy ? 0.12 : 0.16;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(cx, drawY + radius * 0.72, radius * 0.48 * lvScale, radius * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = isEnemy ? 0.42 : 0.50;
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = level >= 6 ? 2.4 : level >= 4 ? 2.0 : 1.6;
    ctx.beginPath();
    ctx.arc(cx, drawY, ringR, 0, Math.PI * 2);
    ctx.stroke();

    if (level >= 4) {
      ctx.globalAlpha = level >= 7 ? 0.24 : level >= 6 ? 0.18 : 0.12;
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
      const skillColor = typeof boardSkillColorV25 === 'function' ? boardSkillColorV25(ball.type) : (t.color || '#ffd54f');
      const markX = cx + ringR * 0.72;
      const markY = drawY - ringR * 0.72;
      const markR = Math.max(5.6, radius * 0.15);
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
      if (typeof drawBoardSkillMarkV25 === 'function') {
        drawBoardSkillMarkV25(markX, markY, ball.type, Math.max(3.8, radius * 0.095), skillColor);
      }
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

  // 覆盖 v26 固定等级牌，做更强阶段色。
  if (typeof drawSlotLevelBadgesV26 === 'function') {
    drawSlotLevelBadgesV26 = function drawSlotLevelBadgesCleanV27(slots, isEnemy) {
      const by = isEnemy ? LAYOUT.enemyBoardY : LAYOUT.playerBoardY;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const ball = slots?.[r]?.[c];
          if (!ball) continue;
          const level = Math.max(1, Math.min(7, ball.level || 1));
          const x = BOARD_X + c * (CELL + GAP);
          const y = by + r * (CELL + GAP);
          drawSlotLevelBadgeV27(x, y, level, isEnemy);
        }
      }
    };
  }

  // 冷却底条更弱，别和等级牌争信息。
  if (typeof drawOneCooldownV20 === 'function') {
    drawOneCooldownV20 = function drawOneCooldownMinimalCleanV27(ball, r, c, isEnemy) {
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

/* ------------------------------------------------------------
   B. 战场减法：去常驻说明文字，降低大色块覆盖
   ------------------------------------------------------------ */
function patchCleanBattleFieldV27() {
  drawField = function drawFieldCleanV27() {
    const fy = LAYOUT.fieldY;
    const fh = LAYOUT.fieldH;
    const x = 24;
    const w = W - 48;
    const g = ctx.createLinearGradient(0, fy, 0, fy + fh);
    g.addColorStop(0, 'rgba(255,246,210,0.68)');
    g.addColorStop(0.50, 'rgba(236,255,184,0.58)');
    g.addColorStop(1, 'rgba(142,231,168,0.58)');
    drawPanel(x, fy, w, fh, 18, g, 'rgba(255,255,255,0.34)');

    // 清晰但轻的车道，不再写“敌方压线/接战中”等文字。
    for (let c = 0; c < COLS; c++) {
      const lx = BOARD_X + c * (CELL + GAP) + CELL / 2;
      const st = state.laneStats?.[c];
      let laneColor = 'rgba(72,160,68,0.18)';
      let laneAlpha = 1;
      if (st?.status === 'enemy_adv' || st?.status === 'wall_danger') { laneColor = 'rgba(255,93,108,0.34)'; laneAlpha = 1; }
      else if (st?.status === 'player_adv' || st?.status === 'siege_ready') { laneColor = 'rgba(83,201,106,0.30)'; laneAlpha = 1; }
      else if (st?.status === 'clash') { laneColor = 'rgba(255,201,60,0.34)'; laneAlpha = 1; }

      if (st?.danger > 38) {
        ctx.save();
        ctx.globalAlpha = 0.30;
        ctx.fillStyle = 'rgba(255,93,108,0.16)';
        roundRect(lx - 26, fy + 12, 52, fh - 24, 13);
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.globalAlpha = laneAlpha;
      ctx.strokeStyle = laneColor;
      ctx.lineWidth = c === 2 ? 2.1 : 1.4;
      ctx.beginPath();
      ctx.moveTo(lx, fy + 16);
      ctx.lineTo(lx, fy + fh - 16);
      ctx.stroke();
      ctx.restore();
    }

    // 中线只保留细虚线。
    ctx.strokeStyle = 'rgba(255,201,60,0.32)';
    ctx.setLineDash([7, 8]);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x + 18, fy + fh / 2);
    ctx.lineTo(x + w - 18, fy + fh / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Lane alert 改小，不再挡住中央。
    for (const alert of state.laneAlerts || []) {
      const lx = BOARD_X + alert.lane * (CELL + GAP) + CELL / 2;
      const a = Math.max(0, alert.life / alert.maxLife);
      ctx.save();
      ctx.globalAlpha = Math.min(0.75, a);
      ctx.fillStyle = 'rgba(255,93,108,0.72)';
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
   C. 果堡血条收敛：减少黑框和高度
   ------------------------------------------------------------ */
function wallRatioV27(value, maxValue) {
  return clamp01((value || 0) / Math.max(1, maxValue || 1));
}
function drawCompactWallHpBarsV27() {
  if (!state || state.phase !== 'playing') return;
  const fieldX = 88;
  const barW = W - fieldX * 2;
  drawOneCompactWallHpV27(fieldX, LAYOUT.enemyWallY + 2, barW, 15, wallRatioV27(state.enemyWallHp, state.enemyWallMax), '敌方果堡', '#ff4f64', '#7f2031', true);
  drawOneCompactWallHpV27(fieldX, LAYOUT.playerWallY + 4, barW, 14, wallRatioV27(state.playerWallHp, state.playerWallMax), '水果果堡', '#35d96f', '#16733b', false);
}
function drawOneCompactWallHpV27(x, y, w, h, ratio, label, fill, dark, enemy) {
  const low = ratio <= 0.28;
  const blink = low ? 0.74 + Math.sin(performance.now() / 95) * 0.22 : 1;
  ctx.save();
  ctx.globalAlpha = enemy ? 0.92 : 0.86;
  ctx.fillStyle = 'rgba(32,38,26,0.44)';
  roundRect(x - 4, y - 3, w + 8, h + 6, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.46)';
  ctx.lineWidth = 1.4;
  roundRect(x - 4, y - 3, w + 8, h + 6, 10);
  ctx.stroke();
  ctx.fillStyle = dark;
  roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.globalAlpha = blink;
  ctx.fillStyle = fill;
  roundRect(x + 3, y + 3, Math.max(6, (w - 6) * ratio), h - 6, 6);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.font = '900 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  const percent = Math.round(ratio * 100);
  const text = `${label} ${percent}%`;
  ctx.strokeText(text, x + w / 2, y + h / 2 + 0.5);
  ctx.fillStyle = '#fffde8';
  ctx.fillText(text, x + w / 2, y + h / 2 + 0.5);
  ctx.restore();
}
function patchCompactWallBarsV27() {
  // 覆盖原来的超重墙血条函数；如果旧 wrapper 调用它，也会变轻。
  drawProminentWallHpBars = drawCompactWallHpBarsV27;
  drawWall = function drawWallCompactBaseV27(hp, maxHp, isEnemy) {
    const y = isEnemy ? LAYOUT.enemyWallY : LAYOUT.playerWallY;
    const ratio = clamp01(hp / Math.max(1, maxHp));
    const x = 78;
    const w = W - 156;
    const h = 10;
    const color = isEnemy ? '#ff6b7a' : '#59c96a';
    const dark = isEnemy ? 'rgba(127,32,49,0.42)' : 'rgba(22,115,59,0.40)';
    ctx.save();
    ctx.globalAlpha = 0.70;
    ctx.fillStyle = dark;
    roundRect(x, y + 6, w, h, 6);
    ctx.fill();
    ctx.fillStyle = color;
    roundRect(x + 2, y + 8, Math.max(5, (w - 4) * ratio), h - 4, 5);
    ctx.fill();
    ctx.restore();
  };
}

/* ------------------------------------------------------------
   D. 阶段提示轻量化：小条，不挡交战中心
   ------------------------------------------------------------ */
function patchLightPhaseHudV27() {
  // 如果 v20/v25 已经包装 draw，继续最后包装一次，把阶段条放到顶部边缘。
  if (typeof draw !== 'function' || draw._cleanupV27) return;
  const oldDraw = draw;
  draw = function drawCleanV27() {
    oldDraw();
    if (!state || state.phase !== 'playing') return;
    drawCompactWallHpBarsV27();
    drawTinyPhaseHudV27();
  };
  draw._cleanupV27 = true;
}
function drawTinyPhaseHudV27() {
  if (typeof battlePhaseV20 !== 'function') return;
  const ph = battlePhaseV20();
  const colorMap = {
    prep: ['#4db6ff', '#e5f7ff'],
    fight: ['#ffb547', '#fff1c2'],
    wall: ['#53e77b', '#e3ffd8'],
    danger: ['#ff5d6c', '#ffe0e5'],
  };
  const [main, bg] = colorMap[ph.key] || ['#ffc93c', '#fff4c0'];
  const x = W / 2 - 74;
  const y = LAYOUT.fieldY + 4;
  const w = 148;
  const h = 18;
  ctx.save();
  ctx.globalAlpha = 0.86;
  ctx.fillStyle = bg;
  roundRect(x, y, w, h, 9);
  ctx.fill();
  ctx.strokeStyle = main;
  ctx.lineWidth = 1.4;
  roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 9);
  ctx.stroke();
  ctx.font = '900 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#255027';
  ctx.fillText(ph.label, x + w / 2, y + h / 2 + 0.5);
  ctx.restore();
}
