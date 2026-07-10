/* ============================================================
   水果突击 · Battle Depth & Wall Clearance v37
   目标：
   1) 修复单位腿/阴影被城墙压住的问题
   2) 给上下城墙留出视觉安全区，单位停在墙前
   3) 城墙后退到战场边界外，不再挤压战场中心
   Loaded last.
   ============================================================ */
(function installBattleDepthWallFixV37() {
  neutralizeForegroundWallsV37();
  patchSoldierWallClearanceV37();
  patchFinalWallsV37();
})();

const BATTLE_DEPTH_WALL_FIX_BUILD = 'battle-depth-wall-fix-v37';

function neutralizeForegroundWallsV37() {
  // v34 是最后盖在单位上的墙，先关掉，避免腿被墙体覆盖。
  if (typeof drawEnemyFortWallV34 === 'function') drawEnemyFortWallV34 = function noopEnemyWallV37() {};
  if (typeof drawPlayerFortWallV34 === 'function') drawPlayerFortWallV34 = function noopPlayerWallV37() {};
  if (typeof drawWall === 'function') drawWall = function noopWallV37() {};
  if (typeof drawProminentWallHpBars === 'function') drawProminentWallHpBars = function noopProminentWallV37() {};
}

function soldierVisualRadiusV37(s) {
  try {
    if (typeof minimalTierKey === 'function' && typeof minimalRadius === 'function') {
      return minimalRadius(s, minimalTierKey(s));
    }
  } catch (e) {}
  return 16 + (s?.level || 1) * 2.2;
}

function patchSoldierWallClearanceV37() {
  if (typeof drawSoldier !== 'function' || drawSoldier._battleDepthWallFixV37) return;
  const oldDrawSoldier = drawSoldier;

  drawSoldier = function drawSoldierWithWallClearanceV37(s) {
    if (!s || !s.alive || state.phase !== 'playing') return oldDrawSoldier(s);

    const oldY = s.y;
    const r = soldierVisualRadiusV37(s);

    // 单位视觉安全区：脚底/阴影不允许钻进墙体。
    if (s.side === 'player') {
      const visualWallTop = LAYOUT.playerWallY + 10;
      const maxY = visualWallTop - r - 8;
      if (s.y > maxY) s.y = maxY;
    } else {
      const visualWallBottom = LAYOUT.enemyWallY + LAYOUT.wallH + 18;
      const minY = visualWallBottom + r * 0.18;
      if (s.y < minY) s.y = minY;
    }

    oldDrawSoldier(s);
    s.y = oldY;
  };

  drawSoldier._battleDepthWallFixV37 = true;
}

function patchFinalWallsV37() {
  if (typeof draw !== 'function' || draw._battleDepthWallFixV37) return;
  const oldDraw = draw;

  draw = function drawBattleDepthWallFixFinalV37() {
    oldDraw();
    if (!state || state.phase !== 'playing') return;

    // 清掉旧墙附近的遮挡残影，再画后退版墙体。
    clearWallBandsV37();
    drawEnemyWallBacklineV37();
    drawPlayerWallBacklineV37();
  };

  draw._battleDepthWallFixV37 = true;
}

function clearWallBandsV37() {
  ctx.save();
  // 只清战场边界附近，不清单位区域。
  ctx.fillStyle = 'rgba(244,232,200,0.98)';
  roundRect(42, LAYOUT.enemyWallY + 12, W - 84, 16, 8);
  ctx.fill();
  roundRect(42, LAYOUT.playerWallY - 3, W - 84, 20, 9);
  ctx.fill();
  ctx.restore();
}

function wallRatioV37(v, m) {
  return clamp01((v || 0) / Math.max(1, m || 1));
}

function drawEnemyWallBacklineV37() {
  const ratio = wallRatioV37(state.enemyWallHp, state.enemyWallMax);
  drawWallBacklineBaseV37({
    x: 60,
    y: LAYOUT.enemyWallY - 4,
    w: W - 120,
    h: 20,
    ratio,
    side: 'enemy',
    body: '#C97984',
    dark: '#A95663',
    light: '#F6D8DC',
    hp: '#F06B79',
    hpBg: 'rgba(116,37,48,0.50)',
    label: '敌方果堡'
  });
}

function drawPlayerWallBacklineV37() {
  const ratio = wallRatioV37(state.playerWallHp, state.playerWallMax);
  // 往下退到战场边界外，避免挡住单位脚和攻击特效。
  drawWallBacklineBaseV37({
    x: 60,
    y: LAYOUT.playerWallY + 9,
    w: W - 120,
    h: 20,
    ratio,
    side: 'player',
    body: '#78C783',
    dark: '#4E9A59',
    light: '#E7F8D9',
    hp: '#8AE78F',
    hpBg: 'rgba(34,89,45,0.42)',
    label: '水果果堡'
  });
}

function drawWallBacklineBaseV37(cfg) {
  const { x, y, w, h, ratio, side, body, dark, light, hp, hpBg, label } = cfg;
  ctx.save();

  // 墙体下沉阴影，强调这是边界，不是压在兵身上的前景遮挡物。
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#000';
  roundRect(x + 2, y + 4, w, h, 8);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = dark;
  roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.fillStyle = body;
  roundRect(x + 2, y + 2, w - 4, h - 5, 7);
  ctx.fill();

  // 更小的垛口，减少对战场纵向空间的侵入。
  const segCount = Math.floor((w - 16) / 26);
  for (let i = 0; i < segCount; i++) {
    const sx = x + 8 + i * 26;
    ctx.fillStyle = dark;
    roundRect(sx, y - 3, 19, 5, 2);
    ctx.fill();
    ctx.fillStyle = light;
    roundRect(sx + 1, y - 2, 17, 2.5, 1.5);
    ctx.fill();
  }

  // 内嵌血条。
  const bx = x + 28;
  const by = y + 7;
  const bw = w - 56;
  const bh = 7;
  ctx.fillStyle = 'rgba(255,255,255,0.26)';
  roundRect(bx - 2, by - 2, bw + 4, bh + 4, 5);
  ctx.fill();
  ctx.fillStyle = hpBg;
  roundRect(bx, by, bw, bh, 4);
  ctx.fill();
  ctx.fillStyle = hp;
  roundRect(bx + 1.5, by + 1.5, Math.max(4, (bw - 3) * ratio), bh - 3, 3);
  ctx.fill();

  // 文本压小，只作为墙内信息，不再抢战场空间。
  ctx.font = '900 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = 'rgba(0,0,0,0.30)';
  ctx.lineWidth = 2;
  ctx.fillStyle = '#FFFDF1';
  const text = `${label} ${Math.round(ratio * 100)}%`;
  ctx.strokeText(text, x + w / 2, y + h / 2 + 0.5);
  ctx.fillText(text, x + w / 2, y + h / 2 + 0.5);

  if (ratio <= 0.6) drawTinyCracksV37(x, y, w, h, ratio, side);

  ctx.restore();
}

function drawTinyCracksV37(x, y, w, h, ratio, side) {
  ctx.save();
  ctx.strokeStyle = side === 'enemy' ? 'rgba(105,43,54,0.52)' : 'rgba(48,108,55,0.46)';
  ctx.lineWidth = 1;
  drawCrackTinyV37(x + w * 0.25, y + 5, 9);
  drawCrackTinyV37(x + w * 0.72, y + 6, 8);
  if (ratio <= 0.3) drawCrackTinyV37(x + w * 0.48, y + 5, 11);
  ctx.restore();
}

function drawCrackTinyV37(x, y, len) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + len * 0.35, y + 3);
  ctx.lineTo(x + len * 0.58, y + 1);
  ctx.lineTo(x + len, y + 4);
  ctx.stroke();
}
