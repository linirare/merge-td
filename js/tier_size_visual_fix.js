/* ============================================================
   水果突击 · Tier Size Visual Fix
   强化小兵→将领的对战区视觉差异：体型、底座、光环、冠标。
   只改表现，不改血量/攻击/攻城/出兵数值。
   Loaded after side_identity_fix.js.
   ============================================================ */

(function installTierSizeVisualFix() {
  if (typeof drawSoldier !== 'function' || drawSoldier._tierSizeVisualFixPatched) return;
  const prevDrawSoldier = drawSoldier;

  drawSoldier = function drawSoldierTierSizeVisual(s) {
    if (!s || !s.squadMode) return prevDrawSoldier(s);

    const tier = visualTierKey(s);
    const oldScale = s.troopScale;
    s.troopScale = tierVisualScale(tier) * roleVisualScale(s.type);

    drawTierUnderlay(s, tier);
    prevDrawSoldier(s);
    drawTierOverlay(s, tier);

    s.troopScale = oldScale;
  };
  drawSoldier._tierSizeVisualFixPatched = true;
})();

function visualTierKey(s) {
  if (s.troopTier) return s.troopTier;
  const lv = s.level || 1;
  if (lv <= 2) return 'small';
  if (lv <= 4) return 'large';
  if (lv === 5) return 'elite';
  if (lv === 6) return 'advanced';
  return 'legendary';
}
function tierVisualScale(tier) {
  return ({
    small: 0.88,
    large: 1.08,
    elite: 1.32,
    advanced: 1.56,
    legendary: 1.86,
  })[tier] || 1.0;
}
function roleVisualScale(type) {
  const role = TYPES[type]?.role;
  if (role === 'tank') return 1.10;
  if (role === 'front') return 1.06;
  if (role === 'siege') return 1.08;
  if (role === 'rush') return 0.98;
  if (role === 'back') return 0.94;
  if (role === 'support' || role === 'control') return 0.92;
  return 1;
}
function tierVisualColor(tier) {
  return ({
    small: '#eaffc3',
    large: '#9be7ff',
    elite: '#ffc93c',
    advanced: '#ff9fbd',
    legendary: '#fff176',
  })[tier] || THEME.gold;
}
function tierVisualRadius(s) {
  const fy = LAYOUT.fieldY;
  const fh = LAYOUT.fieldH;
  const depth = 0.78 + 0.25 * ((s.y - fy) / fh);
  const scale = s.troopScale || 1;
  return (15 + (s.level || 1) * 1.45) * depth * scale;
}
function drawTierUnderlay(s, tier) {
  const r = tierVisualRadius(s);
  const color = tierVisualColor(tier);
  ctx.save();

  // 更明显的体型投影：大兵以上投影逐级变宽。
  const shadowMul = ({ small:0.72, large:0.92, elite:1.12, advanced:1.32, legendary:1.55 })[tier] || 1;
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(s.x, s.y + r + 8, r * shadowMul, 5 + r * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();

  // 精英以上加外圈，玩家一眼能识别“不是普通兵”。
  if (tier === 'elite' || tier === 'advanced' || tier === 'legendary') {
    ctx.globalAlpha = tier === 'legendary' ? 0.42 : 0.28;
    ctx.strokeStyle = color;
    ctx.lineWidth = tier === 'legendary' ? 5 : tier === 'advanced' ? 4 : 3;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + r * 0.18, r * 1.32, r * 0.74, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 将领加第二层王者光环。
  if (tier === 'legendary') {
    ctx.globalAlpha = 0.20;
    ctx.strokeStyle = '#fffbe0';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + r * 0.18, r * 1.58, r * 0.90, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}
function drawTierOverlay(s, tier) {
  const r = tierVisualRadius(s);
  const color = tierVisualColor(tier);
  if (tier === 'small' || tier === 'large') return;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 精英=星， 高级=双星， 将领=皇冠。
  const mark = tier === 'legendary' ? '♛' : tier === 'advanced' ? '✦✦' : '✦';
  const size = tier === 'legendary' ? 17 : tier === 'advanced' ? 13 : 12;
  const y = s.y - r - (tier === 'legendary' ? 48 : 43);

  ctx.font = `900 ${size}px sans-serif`;
  ctx.strokeStyle = 'rgba(0,0,0,0.72)';
  ctx.lineWidth = 4;
  ctx.strokeText(mark, s.x, y);
  ctx.fillStyle = color;
  ctx.fillText(mark, s.x, y);

  // 将领额外加“将”章，不再只靠名字判断。
  if (tier === 'legendary') {
    ctx.fillStyle = 'rgba(72,45,0,0.82)';
    roundRect(s.x - 13, s.y - r - 37, 26, 14, 7);
    ctx.fill();
    ctx.strokeStyle = '#fff176';
    ctx.lineWidth = 1.5;
    roundRect(s.x - 13, s.y - r - 37, 26, 14, 7);
    ctx.stroke();
    ctx.font = '900 9px sans-serif';
    ctx.fillStyle = '#fff8b0';
    ctx.fillText('将领', s.x, s.y - r - 30);
  }

  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}
