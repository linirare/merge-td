/* ============================================================
   水果突击 · Unit Minimal UI Fix
   战斗单位极简显示：保留大小/颜色/水果图标/血条；移除兵种名、兵阶文字、职责文字、阵营文字和等级数字。
   只改前端显示层，不改任何战斗数值。
   Loaded after tier_size_visual_fix.js.
   ============================================================ */

(function installUnitMinimalUiFix() {
  if (typeof drawSoldier !== 'function' || drawSoldier._unitMinimalUiPatched) return;
  const prevDrawSoldier = drawSoldier;
  drawSoldier = function drawSoldierMinimalUi(s) {
    if (!s || !s.squadMode) return prevDrawSoldier(s);
    drawMinimalBattleUnit(s);
  };
  drawSoldier._unitMinimalUiPatched = true;
})();

function minimalTierKey(s) {
  if (typeof visualTierKey === 'function') return visualTierKey(s);
  const lv = s.level || 1;
  if (lv <= 2) return 'small';
  if (lv <= 4) return 'large';
  if (lv === 5) return 'elite';
  if (lv === 6) return 'advanced';
  return 'legendary';
}
function minimalTierScale(tier) {
  if (typeof tierVisualScale === 'function') return tierVisualScale(tier);
  return ({ small:0.88, large:1.08, elite:1.32, advanced:1.56, legendary:1.86 })[tier] || 1;
}
function minimalRoleScale(type) {
  if (typeof roleVisualScale === 'function') return roleVisualScale(type);
  const role = TYPES[type]?.role;
  if (role === 'tank') return 1.10;
  if (role === 'front') return 1.06;
  if (role === 'siege') return 1.08;
  if (role === 'rush') return 0.98;
  if (role === 'back') return 0.94;
  if (role === 'support' || role === 'control') return 0.92;
  return 1;
}
function minimalTierColor(tier) {
  if (typeof tierVisualColor === 'function') return tierVisualColor(tier);
  return ({ small:'#eaffc3', large:'#9be7ff', elite:'#ffc93c', advanced:'#ff9fbd', legendary:'#fff176' })[tier] || THEME.gold;
}
function minimalSideStyle(side) {
  if (typeof sideStyle === 'function') return sideStyle(side);
  return side === 'enemy'
    ? { main:'#ff4f64', dark:'#7c1529', hp:'#ff506a', glow:'rgba(255,70,92,0.58)' }
    : { main:'#35e66f', dark:'#116b35', hp:'#42f58a', glow:'rgba(83,255,130,0.55)' };
}
function minimalDepth(s) {
  return 0.78 + 0.25 * ((s.y - LAYOUT.fieldY) / LAYOUT.fieldH);
}
function minimalRadius(s, tier) {
  const visualScale = minimalTierScale(tier) * minimalRoleScale(s.type);
  return (15 + (s.level || 1) * 1.45) * minimalDepth(s) * visualScale;
}
function drawMinimalHp(s, x, y, w) {
  const st = minimalSideStyle(s.side);
  const ratio = clamp01(s.hp / Math.max(1, s.maxHp));
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  roundRect(x - w / 2, y, w, 5, 3);
  ctx.fill();
  ctx.fillStyle = st.hp;
  roundRect(x - w / 2 + 1, y + 1, Math.max(2, (w - 2) * ratio), 3, 2);
  ctx.fill();
  if ((s.shield || 0) > 0) {
    const sr = clamp01(s.shield / Math.max(1, s.maxShield || s.maxHp * 0.45));
    ctx.fillStyle = '#72c4ff';
    roundRect(x - w / 2, y - 4, w * sr, 3, 2);
    ctx.fill();
  }
}
function drawMinimalBattleUnit(s) {
  const t = TYPES[s.type] || TYPES[DEFAULT_DECK[0]];
  const tier = minimalTierKey(s);
  const tierColor = minimalTierColor(tier);
  const st = minimalSideStyle(s.side);
  const r = minimalRadius(s, tier);
  const isEnemy = s.side === 'enemy';
  const boost = s._tierBoost || 0;

  ctx.save();

  // 阵营底座：我方圆形，敌方菱形。无文字，靠形状和颜色识别。
  ctx.shadowColor = st.glow;
  ctx.shadowBlur = tier === 'legendary' ? 14 : tier === 'advanced' ? 11 : tier === 'elite' ? 8 : 5;
  ctx.strokeStyle = st.main;
  ctx.lineWidth = tier === 'legendary' ? 4.2 : tier === 'advanced' ? 3.6 : 2.8;
  if (isEnemy) {
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - r * 1.02);
    ctx.lineTo(s.x + r * 1.22, s.y + r * 0.12);
    ctx.lineTo(s.x, s.y + r * 1.08);
    ctx.lineTo(s.x - r * 1.22, s.y + r * 0.12);
    ctx.closePath();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + r * 0.25, r * 1.16, r * 0.58, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // 大单位额外光环。无“精英/将领”文字。
  if (tier === 'elite' || tier === 'advanced' || tier === 'legendary') {
    const auraAlpha = tier === 'legendary' ? 0.42 : tier === 'advanced' ? 0.30 : 0.22;
    ctx.globalAlpha = auraAlpha;
    ctx.strokeStyle = tierColor;
    ctx.lineWidth = tier === 'legendary' ? 5 : tier === 'advanced' ? 4 : 3;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + r * 0.18, r * (tier === 'legendary' ? 1.55 : tier === 'advanced' ? 1.38 : 1.25), r * (tier === 'legendary' ? 0.88 : 0.74), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // 阴影：大小差异更直观。
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(s.x, s.y + r + 8, r * 0.96, 5 + r * 0.055, 0, 0, Math.PI * 2);
  ctx.fill();

  // 身体：阵营色优先，水果信息放头部。
  const bodyPulse = boost > 0 ? 1 + Math.sin(performance.now() / 60) * 0.04 * boost : 1;
  const bodyW = r * 1.10 * bodyPulse;
  const bodyH = r * 1.16 * bodyPulse;
  ctx.fillStyle = s.hitFlash > 0 ? '#ffffff' : st.main;
  ctx.strokeStyle = isEnemy ? '#fff0f2' : '#ecfff1';
  ctx.lineWidth = Math.max(2, r * 0.10);
  roundRect(s.x - bodyW / 2, s.y - r * 0.02, bodyW, bodyH, Math.max(6, r * 0.22));
  ctx.fill();
  ctx.stroke();

  // 敌我无文字符号：胸口只画简单几何纹章。
  ctx.fillStyle = isEnemy ? '#ffdde3' : '#eafff1';
  ctx.globalAlpha = 0.86;
  if (isEnemy) {
    ctx.beginPath();
    ctx.moveTo(s.x, s.y + r * 0.26);
    ctx.lineTo(s.x + r * 0.22, s.y + r * 0.58);
    ctx.lineTo(s.x - r * 0.22, s.y + r * 0.58);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(s.x, s.y + r * 0.43, r * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 水果头 + 图标。
  ctx.fillStyle = t.color || tierColor;
  ctx.beginPath();
  ctx.arc(s.x, s.y - r * 0.38, r * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = st.main;
  ctx.lineWidth = Math.max(2.5, r * 0.12);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(r * 0.82)}px sans-serif`;
  ctx.fillStyle = '#fff';
  ctx.fillText(t.icon, s.x, s.y - r * 0.38);

  // 补强层数不显示 +1/+2，改成小点。
  const stacks = Math.min(2, s.reinforceStacks || 0);
  if (stacks > 0) {
    for (let i = 0; i < stacks; i++) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x + r * 0.62 + i * 7, s.y - r * 0.82, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = st.dark;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  // 血条只保留比例，不显示数值。
  drawMinimalHp(s, s.x, s.y - r - 12, Math.max(28, r * 1.95));

  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}
