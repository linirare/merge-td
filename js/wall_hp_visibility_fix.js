/* ============================================================
   水果突击 · Wall HP Visibility Fix
   强化敌我双方城墙血量条：黑底、强描边、百分比、低血警示。
   只改显示层，不改城墙血量/伤害数值。
   Loaded after unit_minimal_ui_fix.js.
   ============================================================ */

(function installWallHpVisibilityFix() {
  if (typeof drawField !== 'function' || drawField._wallHpVisibilityPatched) return;
  const oldDrawField = drawField;
  drawField = function drawFieldWallHpVisibility() {
    oldDrawField();
    drawProminentWallHpBars();
  };
  drawField._wallHpVisibilityPatched = true;
})();

function wallHpRatio(value, maxValue) {
  return clamp01((value || 0) / Math.max(1, maxValue || 1));
}
function wallHpBlink(ratio) {
  if (ratio > 0.28) return 1;
  return 0.74 + Math.sin(performance.now() / 95) * 0.26;
}
function drawProminentWallHpBars() {
  const fieldX = 44;
  const fieldW = W - fieldX * 2;
  const barW = fieldW;
  const barH = 24;
  const enemyY = LAYOUT.enemyWallY - 6;
  const playerY = LAYOUT.playerWallY - 1;

  drawOneWallHpBar({
    x: fieldX,
    y: enemyY,
    w: barW,
    h: barH,
    ratio: wallHpRatio(state.enemyWallHp, state.enemyWallMax),
    value: Math.max(0, Math.ceil(state.enemyWallHp || 0)),
    max: Math.max(1, Math.ceil(state.enemyWallMax || 1)),
    title: '敌方果堡',
    side: 'enemy',
    fill: '#ff4f64',
    fill2: '#ff9aaa',
    dark: '#5f1224',
    glow: 'rgba(255,68,90,0.48)',
    anchor: 'top',
  });

  drawOneWallHpBar({
    x: fieldX,
    y: playerY,
    w: barW,
    h: barH,
    ratio: wallHpRatio(state.playerWallHp, state.playerWallMax),
    value: Math.max(0, Math.ceil(state.playerWallHp || 0)),
    max: Math.max(1, Math.ceil(state.playerWallMax || 1)),
    title: '我方果堡',
    side: 'player',
    fill: '#35e66f',
    fill2: '#a8ffd0',
    dark: '#0f5a31',
    glow: 'rgba(83,255,130,0.42)',
    anchor: 'bottom',
  });
}
function drawOneWallHpBar(cfg) {
  const r = cfg.ratio;
  const blink = wallHpBlink(r);
  const fillW = Math.max(8, (cfg.w - 8) * r);
  const low = r <= 0.28;

  ctx.save();

  // 外发光/低血闪烁。
  ctx.shadowColor = low ? cfg.fill : cfg.glow;
  ctx.shadowBlur = low ? 18 * blink : 10;

  // 黑色外框底，保证浅色场景上能看清。
  ctx.fillStyle = 'rgba(24, 30, 23, 0.76)';
  roundRect(cfg.x - 5, cfg.y - 4, cfg.w + 10, cfg.h + 8, 13);
  ctx.fill();
  ctx.shadowBlur = 0;

  // 白色描边。
  ctx.strokeStyle = 'rgba(255,255,255,0.82)';
  ctx.lineWidth = 2.5;
  roundRect(cfg.x - 5, cfg.y - 4, cfg.w + 10, cfg.h + 8, 13);
  ctx.stroke();

  // 血槽底。
  ctx.fillStyle = cfg.dark;
  roundRect(cfg.x, cfg.y, cfg.w, cfg.h, 11);
  ctx.fill();

  // 血量主体。
  const grad = ctx.createLinearGradient(cfg.x, cfg.y, cfg.x, cfg.y + cfg.h);
  grad.addColorStop(0, cfg.fill2);
  grad.addColorStop(0.45, cfg.fill);
  grad.addColorStop(1, cfg.dark);
  ctx.globalAlpha = low ? blink : 1;
  ctx.fillStyle = grad;
  roundRect(cfg.x + 4, cfg.y + 4, fillW, cfg.h - 8, 8);
  ctx.fill();
  ctx.globalAlpha = 1;

  // 分段刻度，强化“这是主目标血量”。
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 1.2;
  for (let i = 1; i < 10; i++) {
    const sx = cfg.x + (cfg.w * i) / 10;
    ctx.beginPath();
    ctx.moveTo(sx, cfg.y + 5);
    ctx.lineTo(sx, cfg.y + cfg.h - 5);
    ctx.stroke();
  }

  // 标题和数值：大字 + 黑描边。
  const percent = Math.round(r * 100);
  const label = `${cfg.title}  ${cfg.value}/${cfg.max}  ${percent}%`;
  ctx.font = '900 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.72)';
  ctx.strokeText(label, cfg.x + cfg.w / 2, cfg.y + cfg.h / 2 + 0.5);
  ctx.fillStyle = '#fffef0';
  ctx.fillText(label, cfg.x + cfg.w / 2, cfg.y + cfg.h / 2 + 0.5);

  // 低血警示，不常驻干扰。
  if (low) {
    const warn = cfg.side === 'enemy' ? '可破城' : '危险';
    const tagW = 54;
    const tx = cfg.side === 'enemy' ? cfg.x + cfg.w - tagW - 8 : cfg.x + 8;
    ctx.globalAlpha = blink;
    ctx.fillStyle = '#fff0a6';
    roundRect(tx, cfg.y - 17, tagW, 16, 8);
    ctx.fill();
    ctx.font = '900 10px sans-serif';
    ctx.fillStyle = '#802000';
    ctx.textAlign = 'center';
    ctx.fillText(warn, tx + tagW / 2, cfg.y - 8.5);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}
