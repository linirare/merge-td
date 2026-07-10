/* ============================================================
   水果突击 · Fruit Fort Wall v34
   目标：城墙从“纯血条”升级为“实体果堡护墙”。
   - 敌方：腐坏果堡墙，粉红砖块/刺藤/裂纹
   - 我方：水果营护墙，绿色木桩/叶片/裂纹
   - 血条嵌入墙体内部，不再悬浮
   - 低血量显示破损阶段
   Loaded last.
   ============================================================ */

(function installFruitFortWallV34() {
  patchFruitFortWallV34();
  patchFinalWallDrawV34();
})();

const FRUIT_FORT_WALL_BUILD = 'fruit-fort-wall-v34';

function wallRatioV34(v, m) {
  return clamp01((v || 0) / Math.max(1, m || 1));
}

function patchFruitFortWallV34() {
  // 关闭旧墙条本体，避免“血条 + 城墙实体”重复。
  if (typeof drawWall === 'function') drawWall = function drawWallNoopV34() {};
  if (typeof drawProminentWallHpBars === 'function') drawProminentWallHpBars = function drawProminentWallHpBarsNoopV34() {};
  if (typeof drawCompactWallHpBarsV27 === 'function') drawCompactWallHpBarsV27 = function noopCompactWallV34() {};
  if (typeof drawFinalWallBarsV30 === 'function') drawFinalWallBarsV30 = function noopFinalWallV34() {};
}

function patchFinalWallDrawV34() {
  if (typeof draw !== 'function' || draw._fruitFortWallV34) return;
  const oldDraw = draw;

  draw = function drawFruitFortWallV34() {
    oldDraw();
    if (!state || state.phase !== 'playing') return;
    drawEnemyFortWallV34();
    drawPlayerFortWallV34();
  };

  draw._fruitFortWallV34 = true;
}

function drawEnemyFortWallV34() {
  const ratio = wallRatioV34(state.enemyWallHp, state.enemyWallMax);
  const x = 58;
  const y = LAYOUT.enemyWallY - 5;
  const w = W - 116;
  const h = 25;

  drawFortWallBaseV34({
    x, y, w, h,
    ratio,
    side: 'enemy',
    body: '#C97984',
    bodyDark: '#A95663',
    trim: '#F4D7DC',
    hpFill: '#F06B79',
    hpBg: 'rgba(116,37,48,0.52)',
    label: '敌方果堡'
  });
}

function drawPlayerFortWallV34() {
  const ratio = wallRatioV34(state.playerWallHp, state.playerWallMax);
  const x = 58;
  const y = LAYOUT.playerWallY - 6;
  const w = W - 116;
  const h = 25;

  drawFortWallBaseV34({
    x, y, w, h,
    ratio,
    side: 'player',
    body: '#78C783',
    bodyDark: '#4E9A59',
    trim: '#E7F8D9',
    hpFill: '#8AE78F',
    hpBg: 'rgba(34,89,45,0.44)',
    label: '水果果堡'
  });
}

function drawFortWallBaseV34(cfg) {
  const { x, y, w, h, ratio, side, body, bodyDark, trim, hpFill, hpBg, label } = cfg;
  const low = ratio <= 0.30;
  const pulse = low ? (0.84 + Math.sin(performance.now() / 92) * 0.14) : 1;

  ctx.save();

  // 墙体落地阴影，让它像战场边界实体。
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#000';
  roundRect(x + 2, y + 5, w, h, 9);
  ctx.fill();

  ctx.globalAlpha = 1;

  // 主墙体。
  ctx.fillStyle = bodyDark;
  roundRect(x, y, w, h, 9);
  ctx.fill();

  ctx.fillStyle = body;
  roundRect(x + 2, y + 2, w - 4, h - 6, 8);
  ctx.fill();

  // 顶部亮边。
  ctx.fillStyle = trim;
  roundRect(x + 5, y + 3, w - 10, 4, 3);
  ctx.fill();

  // 砖块 / 栅栏节奏。
  drawWallSegmentsV34(x, y, w, h, side, trim, bodyDark);

  // 阵营装饰。
  if (side === 'enemy') drawEnemyWallDecorV34(x, y, w, h);
  else drawPlayerWallDecorV34(x, y, w, h);

  // 内嵌血条。
  drawEmbeddedHpBarV34(x + 30, y + 9, w - 60, 8, ratio, hpBg, hpFill, pulse);

  // 文字嵌入墙体，不再独立悬浮。
  ctx.font = '900 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0,0,0,0.34)';
  ctx.fillStyle = '#FFFDF1';
  const text = `${label} ${Math.round(ratio * 100)}%`;
  ctx.strokeText(text, x + w / 2, y + h / 2 + 0.5);
  ctx.fillText(text, x + w / 2, y + h / 2 + 0.5);

  // 血量阶段破损。
  drawWallDamageV34(x, y, w, h, ratio, side);

  ctx.restore();
}

function drawWallSegmentsV34(x, y, w, h, side, trim, dark) {
  const segW = 22;
  const gap = 6;
  const count = Math.floor((w - 18) / (segW + gap));

  for (let i = 0; i < count; i++) {
    const sx = x + 9 + i * (segW + gap);
    const sy = y - 4;
    ctx.fillStyle = dark;
    roundRect(sx, sy, segW, 7, 3);
    ctx.fill();
    ctx.fillStyle = trim;
    roundRect(sx + 1.5, sy + 1.5, segW - 3, 3.5, 2);
    ctx.fill();
  }
}

function drawEnemyWallDecorV34(x, y, w, h) {
  ctx.save();
  // 腐坏刺藤，偏低透明，不做脏纹理。
  ctx.strokeStyle = 'rgba(105,43,54,0.42)';
  ctx.lineWidth = 1.35;
  for (let i = 0; i < 5; i++) {
    const sx = x + 24 + i * ((w - 48) / 4);
    ctx.beginPath();
    ctx.moveTo(sx, y + h - 2);
    ctx.lineTo(sx - 6, y + h + 6);
    ctx.lineTo(sx + 4, y + h + 10);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlayerWallDecorV34(x, y, w, h) {
  ctx.save();
  // 果园叶片/木桩感。
  ctx.fillStyle = 'rgba(230,248,215,0.96)';
  ctx.strokeStyle = 'rgba(70,145,70,0.40)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const sx = x + 24 + i * ((w - 48) / 4);
    ctx.beginPath();
    ctx.ellipse(sx - 4, y - 2, 4, 2.3, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(sx + 4, y - 2, 4, 2.3, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawEmbeddedHpBarV34(x, y, w, h, ratio, bg, fill, pulse) {
  ctx.save();

  ctx.fillStyle = 'rgba(255,255,255,0.27)';
  roundRect(x - 2, y - 2, w + 4, h + 4, 5);
  ctx.fill();

  ctx.fillStyle = bg;
  roundRect(x, y, w, h, 4);
  ctx.fill();

  ctx.globalAlpha = pulse;
  ctx.fillStyle = fill;
  roundRect(x + 1.5, y + 1.5, Math.max(4, (w - 3) * ratio), h - 3, 3);
  ctx.fill();

  ctx.restore();
}

function drawWallDamageV34(x, y, w, h, ratio, side) {
  if (ratio > 0.60) return;

  ctx.save();
  ctx.strokeStyle = side === 'enemy'
    ? 'rgba(112,48,58,0.58)'
    : 'rgba(48,108,55,0.52)';
  ctx.lineWidth = 1.35;

  drawCrackV34(x + w * 0.22, y + 6, 12);
  drawCrackV34(x + w * 0.72, y + 8, 10);

  if (ratio <= 0.30) {
    drawCrackV34(x + w * 0.42, y + 5, 15);
    drawCrackV34(x + w * 0.55, y + 9, 13);

    // 低血量轻微闪烁边框。
    ctx.globalAlpha = 0.22 + Math.sin(performance.now() / 85) * 0.08;
    ctx.strokeStyle = side === 'enemy' ? '#fff1f1' : '#f3ffe6';
    ctx.lineWidth = 2;
    roundRect(x + 1, y + 1, w - 2, h - 2, 9);
    ctx.stroke();
  }

  ctx.restore();
}

function drawCrackV34(x, y, len) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + len * 0.25, y + 3);
  ctx.lineTo(x + len * 0.48, y + 1);
  ctx.lineTo(x + len * 0.72, y + 6);
  ctx.lineTo(x + len, y + 4);
  ctx.stroke();
}
