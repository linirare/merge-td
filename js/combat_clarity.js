/* ============================================================
   Fruit Assault - Combat Clarity Layer
   Keeps squad rendering readable and reduces combat text noise.
   Loaded after troop_tier_mode.js.
   ============================================================ */

(function installCombatClarity() {
  patchCleanSoldierDraw();
  patchFxDensity();
})();

function cleanRoleLabel(role) {
  return ({
    tank: '\u524d\u6392',
    front: '\u67aa\u7ebf',
    rush: '\u7a81\u51fb',
    back: '\u8fdc\u7a0b',
    siege: '\u653b\u57ce',
    support: '\u652f\u63f4',
    control: '\u63a7\u5236',
    merge: '\u5f15\u64ce',
  })[role] || '\u5175';
}

function cleanTierLabel(s) {
  if (typeof TIER_LABEL !== 'undefined' && s.troopTier) return TIER_LABEL[s.troopTier] || '\u5175';
  if (s.level >= 7) return '\u5c06\u9886';
  if (s.level === 6) return '\u9ad8\u7ea7\u5175';
  if (s.level === 5) return '\u7cbe\u82f1\u5175';
  if (s.level >= 3) return '\u5927\u5175';
  return '\u5c0f\u5175';
}

function cleanTierColor(s) {
  if (typeof TIER_COLOR !== 'undefined' && s.troopTier) return TIER_COLOR[s.troopTier] || THEME.gold;
  if (s.level >= 7) return '#fff176';
  if (s.level === 6) return '#ff9fbd';
  if (s.level === 5) return '#ffc93c';
  if (s.level >= 3) return '#9be7ff';
  return '#eaffc3';
}

function clarityNearbyCount(s, radius) {
  if (!state || !s) return 0;
  const all = []
    .concat(Array.isArray(state.playerSoldiers) ? state.playerSoldiers : [])
    .concat(Array.isArray(state.enemySoldiers) ? state.enemySoldiers : []);
  const rr = radius * radius;
  let n = 0;
  for (const other of all) {
    if (!other || other === s || !other.alive) continue;
    const dx = other.x - s.x;
    const dy = other.y - s.y;
    if (dx * dx + dy * dy <= rr) n++;
  }
  return n;
}

function clarityShouldShowIdentity(s) {
  if (!s) return false;
  return false;
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
  const fy = LAYOUT.fieldY;
  const fh = LAYOUT.fieldH;
  const depth = 0.78 + 0.25 * ((s.y - fy) / fh);
  const scale = s.troopScale || (1 + Math.max(0, s.level - 1) * 0.07);
  const r = (14 + s.level * 1.45) * depth * scale;
  const color = cleanTierColor(s);
  const sideColor = s.side === 'player' ? '#53c96a' : '#ff6b5d';
  const name = s.troopName || t.name;
  const roleText = cleanRoleLabel(t.role);
  const tierText = cleanTierLabel(s);
  const showIdentity = clarityShouldShowIdentity(s);

  ctx.save();

  let ringColor = s.side === 'player' ? 'rgba(83,201,106,0.55)' : 'rgba(255,92,92,0.50)';
  if (s.mode === 'siege') ringColor = 'rgba(255,201,60,0.75)';
  else if (s.mode === 'backline') ringColor = 'rgba(77,182,255,0.62)';
  else if (s.slowTimer > 0) ringColor = 'rgba(155,231,255,0.7)';
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(s.x, s.y + r * 0.26, r * 1.02, r * 0.48, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(0,0,0,0.24)';
  ctx.beginPath();
  ctx.ellipse(s.x, s.y + r + 5, r * 0.92, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

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

  ctx.fillStyle = 'rgba(0,0,0,0.50)';
  ctx.beginPath();
  ctx.arc(s.x + r * 0.72, s.y + r * 0.16, r * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `900 ${Math.round(r * 0.44)}px sans-serif`;
  ctx.fillStyle = THEME.gold;
  ctx.fillText(s.level, s.x + r * 0.72, s.y + r * 0.17);

  drawCleanHpBar(s, s.x, s.y - r - 11, r * 2.0);

  if (showIdentity) {
    ctx.font = '900 11px sans-serif';
    ctx.strokeStyle = 'rgba(0,0,0,0.52)';
    ctx.lineWidth = 3;
    ctx.strokeText(`${tierText} · ${roleText}`, s.x, s.y - r - 21);
    ctx.fillStyle = color;
    ctx.fillText(`${tierText} · ${roleText}`, s.x, s.y - r - 21);

    const w = Math.min(98, Math.max(56, String(name).length * 10 + 14));
    ctx.fillStyle = 'rgba(0,0,0,0.58)';
    roundRect(s.x - w / 2, s.y + r + 9, w, 16, 8);
    ctx.fill();
    ctx.font = '900 10px sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(name, s.x, s.y + r + 21);
  }

  if ((s.reinforceStacks || 0) > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.arc(s.x + r * 0.78, s.y - r * 0.66, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '900 10px sans-serif';
    ctx.fillStyle = '#2c8d3f';
    ctx.fillText(`+${s.reinforceStacks}`, s.x + r * 0.78, s.y - r * 0.63);
  }

  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

function patchCleanSoldierDraw() {
  if (window.RenderHooks && window.RenderHooks.afterDrawSoldier && !window.RenderHooks._combatClaritySoldier) {
    window.RenderHooks.afterDrawSoldier.use((ctxArg, s) => {
      // Battle2DV5 already draws the authored troop sprite.  The clarity body is
      // the legacy procedural unit, so drawing it afterwards creates a second,
      // hand-drawn soldier on top of the atlas art.
      if (typeof drawSoldier === 'function' && (drawSoldier._stickmanV61 || drawSoldier._battle2DV5)) return;
      if (s && s.squadMode) drawCleanSoldierBody(s);
    }, 10);
    window.RenderHooks._combatClaritySoldier = true;
    return;
  }
  if (typeof drawSoldier !== 'function' || drawSoldier._combatClarityPatched) return;
  const prevDraw = drawSoldier;
  drawSoldier = function clarityDrawSoldier(s) {
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
  const highPriorityWords = ['BUILD', '\u8054\u52a8', '\u63a5\u901a', '\u6210\u578b'];
  const combatWords = ['\u514b\u5236', '\u4f18\u52bf', '\u53d7\u5236', '\u51fb\u7834', '\u7834\u57ce'];

  function activeFieldFxCount() {
    if (!state || !Array.isArray(state.fx) || typeof LAYOUT === 'undefined') return 0;
    const top = LAYOUT.fieldY - 30;
    const bottom = LAYOUT.fieldY + LAYOUT.fieldH + 30;
    return state.fx.filter(f => f && f.life > 0 && f.y >= top && f.y <= bottom).length;
  }

  function pushPriorityFx(x, y, text, color, size, fxLife, priority) {
    if (!state || !Array.isArray(state.fx)) return oldAddFx(x, y, text, color, size);
    const item = { x, y, text, color, size, life: fxLife, maxLife: fxLife, priority };
    state.fx.push(item);
    return item;
  }

  addFx = function clarityAddFx(x, y, text, color, size = 12, life = 0.85) {
    const now = state?.time || 0;
    const str = String(text || '');
    const isBuildFx = highPriorityWords.some(word => str.includes(word));
    if (isBuildFx) {
      const fixed = str.includes('BUILD') || str.includes('\u8054\u52a8') || str.includes('\u63a5\u901a');
      const fixedY = typeof LAYOUT !== 'undefined' ? LAYOUT.fieldY + 30 : y;
      return pushPriorityFx(
        fixed ? W / 2 : x,
        fixed ? fixedY : y,
        str,
        color,
        Math.max(Number(size) || 12, fixed ? 15 : 13),
        fixed ? 1.35 : 1.05,
        'build'
      );
    }

    state._combatClarityFxV2 = state._combatClarityFxV2 || {};
    const bucket = state._combatClarityFxV2;
    const isLowValueDamage = /^-\d+$/.test(str) && Number(str.slice(1)) < 12;
    const isRawDamage = /^-\d+$/.test(str);
    const rawDamageValue = isRawDamage ? Number(str.slice(1)) || 0 : 0;
    const isCombatKeyword = combatWords.some(word => str.includes(word));
    const crowded = activeFieldFxCount() > 16;

    if (isRawDamage && rawDamageValue < 8) return null;
    if (isLowValueDamage && now - (bucket.lastTiny || 0) < 0.20) return null;
    if (isRawDamage && crowded && rawDamageValue < 15) return null;
    if (isRawDamage && now - (bucket.lastRaw || 0) < 0.10) return null;
    if (isCombatKeyword && now - (bucket.lastKeyword || 0) < 0.20) return null;

    if (isLowValueDamage) bucket.lastTiny = now;
    if (isRawDamage) bucket.lastRaw = now;
    if (isCombatKeyword) bucket.lastKeyword = now;

    const nextSize = isRawDamage ? Math.min(size, 12) : Math.min(size, isCombatKeyword ? 14 : 13);
    const nextLife = isRawDamage ? 0.60 : Math.min(life, 0.85);
    return oldAddFx(x, y, text, color, nextSize, nextLife);
  };
  addFx._combatClarityPatched = true;
}
