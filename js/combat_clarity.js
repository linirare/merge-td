/* ============================================================
   水果突击 · Combat Clarity Layer
   目标：减少战斗表现层噪音。兵阶单位只保留一个主铭牌、一个兵阶标签、一个血条。
   Loaded after troop_tier_mode.js.
   ============================================================ */

(function installCombatClarity() {
  patchCleanSoldierDraw();
  patchFxDensity();
})();

function cleanRoleLabel(role) {
  return ({ tank:'前排', front:'枪线', rush:'突击', back:'远程', siege:'攻城', support:'支援', control:'控制', merge:'引擎' })[role] || '兵';
}
function cleanTierLabel(s) {
  if (typeof TIER_LABEL !== 'undefined' && s.troopTier) return TIER_LABEL[s.troopTier] || '兵';
  if (s.level >= 7) return '将领';
  if (s.level === 6) return '高级兵';
  if (s.level === 5) return '精英兵';
  if (s.level >= 3) return '大兵';
  return '小兵';
}
function cleanTierColor(s) {
  if (typeof TIER_COLOR !== 'undefined' && s.troopTier) return TIER_COLOR[s.troopTier] || THEME.gold;
  if (s.level >= 7) return '#fff176';
  if (s.level === 6) return '#ff9fbd';
  if (s.level === 5) return '#ffc93c';
  if (s.level >= 3) return '#9be7ff';
  return '#eaffc3';
}
function drawCleanHpBar(s, x, y, w) {
  const ratio = clamp01(s.hp / Math.max(1, s.maxHp));
  ctx.fillStyle = 'rgba(0,0,0,0.48)';
  roundRect(x - w / 2, y, w, 5, 3);
  ctx.fill();
  ctx.fillStyle = ratio > 0.55 ? THEME.safe : ratio > 0.25 ? '#ffd24a' : '#ff5a3a';
  roundRect(x - w / 2, y, w * ratio, 5, 3);
  ctx.fill();
  if ((s.shield || 0) > 0) {
    const sr = clamp01(s.shield / Math.max(1, s.maxShield || s.maxHp * 0.45));
    ctx.fillStyle = '#72c4ff';
    roundRect(x - w / 2, y - 4, w * sr, 3, 2);
    ctx.fill();
  }
}
function drawCleanSoldierBody(s) {
  const t = TYPES[s.type] || TYPES[DEFAULT_DECK[0]];
  const fy = LAYOUT.fieldY, fh = LAYOUT.fieldH;
  const depth = 0.78 + 0.25 * ((s.y - fy) / fh);
  const scale = s.troopScale || (1 + Math.max(0, s.level - 1) * 0.07);
  const r = (14 + s.level * 1.45) * depth * scale;
  const color = cleanTierColor(s);
  const sideColor = s.side === 'player' ? '#53c96a' : '#ff6b5d';
  const name = s.troopName || t.name;
  const roleText = cleanRoleLabel(t.role);
  const tierText = cleanTierLabel(s);

  ctx.save();

  // 当前状态圈，只保留一种主状态，不叠多个圈。
  let ringColor = s.side === 'player' ? 'rgba(83,201,106,0.55)' : 'rgba(255,92,92,0.50)';
  if (s.mode === 'siege') ringColor = 'rgba(255,201,60,0.75)';
  else if (s.mode === 'backline') ringColor = 'rgba(77,182,255,0.62)';
  else if (s.slowTimer > 0) ringColor = 'rgba(155,231,255,0.7)';
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(s.x, s.y + r * 0.26, r * 1.02, r * 0.48, 0, 0, Math.PI * 2);
  ctx.stroke();

  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,0.24)';
  ctx.beginPath();
  ctx.ellipse(s.x, s.y + r + 5, r * 0.92, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // 身体和头部：比旧小兵更大、更像单个可读单位。
  ctx.fillStyle = s.hitFlash > 0 ? '#ff3a28' : sideColor;
  roundRect(s.x - r * 0.55, s.y - r * 0.03, r * 1.10, r * 1.16, 7);
  ctx.fill();

  ctx.fillStyle = t.color || color;
  ctx.beginPath();
  ctx.arc(s.x, s.y - r * 0.36, r * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = `${Math.round(r * 0.80)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(t.icon, s.x, s.y - r * 0.36);

  // 星级小章
  ctx.fillStyle = 'rgba(0,0,0,0.50)';
  ctx.beginPath();
  ctx.arc(s.x + r * 0.72, s.y + r * 0.16, r * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `900 ${Math.round(r * 0.44)}px sans-serif`;
  ctx.fillStyle = THEME.gold;
  ctx.fillText(s.level, s.x + r * 0.72, s.y + r * 0.17);

  drawCleanHpBar(s, s.x, s.y - r - 11, r * 2.0);

  // 只显示一个上方定位标签。
  ctx.font = '900 9px sans-serif';
  ctx.strokeStyle = 'rgba(0,0,0,0.52)';
  ctx.lineWidth = 3;
  ctx.strokeText(`${tierText} · ${roleText}`, s.x, s.y - r - 21);
  ctx.fillStyle = color;
  ctx.fillText(`${tierText} · ${roleText}`, s.x, s.y - r - 21);

  // 只显示一个下方主铭牌。
  const w = Math.min(98, Math.max(56, name.length * 10 + 14));
  ctx.fillStyle = 'rgba(0,0,0,0.58)';
  roundRect(s.x - w / 2, s.y + r + 9, w, 16, 8);
  ctx.fill();
  ctx.font = '900 10px sans-serif';
  ctx.fillStyle = color;
  ctx.fillText(name, s.x, s.y + r + 21);

  if ((s.reinforceStacks || 0) > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.arc(s.x + r * 0.78, s.y - r * 0.66, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '900 8px sans-serif';
    ctx.fillStyle = '#2c8d3f';
    ctx.fillText(`+${s.reinforceStacks}`, s.x + r * 0.78, s.y - r * 0.63);
  }

  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}
function patchCleanSoldierDraw() {
  if (typeof drawSoldier !== 'function' || drawSoldier._combatClarityPatched) return;
  const prevDraw = drawSoldier;
  drawSoldier = function clarityDrawSoldier(s) {
    // 兵阶/兵团单位不用旧绘制链，避免旧小兵、兵团xN、兵阶铭牌三层叠加。
    if (s && s.squadMode) {
      drawCleanSoldierBody(s);
      return;
    }
    prevDraw(s);
  };
  drawSoldier._combatClarityPatched = true;
}
function patchFxDensity() {
  if (typeof addFx !== 'function' || addFx._combatClarityPatched) return;
  const oldAddFx = addFx;
  let lastTinyFxTime = 0;
  addFx = function clarityAddFx(x, y, text, color, size = 12, life = 0.85) {
    const now = state?.time || 0;
    const str = String(text || '');
    const isLowValueDamage = /^-\d+$/.test(str) && Number(str.slice(1)) < 12;
    if (isLowValueDamage && now - lastTinyFxTime < 0.18) return null;
    if (isLowValueDamage) lastTinyFxTime = now;
    return oldAddFx(x, y, text, color, Math.min(size, 13), Math.min(life, 0.78));
  };
  addFx._combatClarityPatched = true;
}