/* ============================================================
   水果突击 · Fruit Assault —— Final Battle Skin v48
   职责：战场、城墙、战斗单位。这里是最终视觉源，不再依赖 v27/v34/v37 覆盖。
   ============================================================ */

function drawField() {
  const fy = LAYOUT.fieldY;
  const fh = LAYOUT.fieldH;
  const x = 24;
  const w = W - 48;

  const g = ctx.createLinearGradient(0, fy, 0, fy + fh);
  g.addColorStop(0, 'rgba(247,232,190,0.92)');
  g.addColorStop(0.50, 'rgba(244,230,185,0.88)');
  g.addColorStop(1, 'rgba(237,222,174,0.90)');
  drawPanel(x, fy, w, fh, 18, g, 'rgba(221,200,147,0.76)');

  // 墙前安全区：让单位不会视觉上挤到城墙底下。
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  roundRect(x + 10, fy + 8, w - 20, 24, 12);
  ctx.fill();
  roundRect(x + 10, fy + fh - 32, w - 20, 24, 12);
  ctx.fill();
  ctx.restore();

  for (let c = 0; c < COLS; c++) {
    const lx = BOARD_X + c * (CELL + GAP) + CELL / 2;
    const st = state.laneStats?.[c];
    let laneColor = 'rgba(92,160,98,0.22)';
    if (st?.status === 'enemy_adv' || st?.status === 'wall_danger') laneColor = 'rgba(230,110,120,0.28)';
    else if (st?.status === 'player_adv' || st?.status === 'siege_ready') laneColor = 'rgba(90,190,100,0.26)';
    else if (st?.status === 'clash') laneColor = 'rgba(220,170,70,0.28)';

    if (st?.danger > 38) {
      ctx.save();
      ctx.fillStyle = 'rgba(230,110,120,0.10)';
      roundRect(lx - 25, fy + 34, 50, fh - 68, 12);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.strokeStyle = laneColor;
    ctx.lineWidth = c === 2 ? 1.8 : 1.2;
    ctx.beginPath();
    ctx.moveTo(lx, fy + 34);
    ctx.lineTo(lx, fy + fh - 34);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.strokeStyle = 'rgba(224,178,88,0.28)';
  ctx.setLineDash([7, 8]);
  ctx.lineWidth = 1.2;
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
    ctx.globalAlpha = Math.min(0.74, a);
    ctx.fillStyle = 'rgba(230,110,120,0.75)';
    roundRect(lx - 28, LAYOUT.playerWallY - 36, 56, 17, 9);
    ctx.fill();
    ctx.font = '900 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fffde8';
    ctx.fillText(alert.text || '危险', lx, LAYOUT.playerWallY - 27);
    ctx.restore();
  }
}

function drawWall(hp, maxHp, isEnemy) {
  const ratio = clamp01(hp / Math.max(1, maxHp));
  const x = 58;
  const y = isEnemy ? LAYOUT.enemyWallY - 4 : LAYOUT.playerWallY + 2;
  const w = W - 116;
  const h = 21;
  const cfg = isEnemy
    ? { body:'#C97984', dark:'#A95663', trim:'#F4D7DC', hp:'#F06B79', hpBg:'rgba(116,37,48,0.46)', text:'#fffdf1', label:'敌方果堡' }
    : { body:'#78C783', dark:'#4E9A59', trim:'#E7F8D9', hp:'#8AE78F', hpBg:'rgba(34,89,45,0.40)', text:'#fffdf1', label:'水果果堡' };

  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = '#000';
  roundRect(x + 2, y + 4, w, h, 8);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = cfg.dark;
  roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.fillStyle = cfg.body;
  roundRect(x + 2, y + 2, w - 4, h - 5, 7);
  ctx.fill();
  ctx.fillStyle = cfg.trim;
  roundRect(x + 5, y + 3, w - 10, 3.5, 3);
  ctx.fill();

  const segW = 20, gap = 6;
  const count = Math.floor((w - 18) / (segW + gap));
  for (let i = 0; i < count; i++) {
    const sx = x + 9 + i * (segW + gap);
    ctx.fillStyle = cfg.dark;
    roundRect(sx, y - 4, segW, 6, 3);
    ctx.fill();
    ctx.fillStyle = cfg.trim;
    roundRect(sx + 1.5, y - 3, segW - 3, 3, 2);
    ctx.fill();
  }

  // 内嵌血条，不再作为独立悬浮 UI。
  const bx = x + 28, by = y + 8, bw = w - 56, bh = 7;
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  roundRect(bx - 2, by - 2, bw + 4, bh + 4, 5);
  ctx.fill();
  ctx.fillStyle = cfg.hpBg;
  roundRect(bx, by, bw, bh, 4);
  ctx.fill();
  ctx.fillStyle = cfg.hp;
  roundRect(bx + 1.5, by + 1.5, Math.max(4, (bw - 3) * ratio), bh - 3, 3);
  ctx.fill();

  if (ratio <= 0.60) drawWallDamageV48(x, y, w, h, ratio, isEnemy);

  ctx.font = '900 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.fillStyle = cfg.text;
  const text = `${cfg.label} ${Math.round(ratio * 100)}%`;
  ctx.strokeText(text, x + w / 2, y + h / 2 + 0.5);
  ctx.fillText(text, x + w / 2, y + h / 2 + 0.5);
  ctx.restore();
}

function drawWallDamageV48(x, y, w, h, ratio, isEnemy) {
  ctx.save();
  ctx.strokeStyle = isEnemy ? 'rgba(112,48,58,0.58)' : 'rgba(48,108,55,0.52)';
  ctx.lineWidth = 1.25;
  drawCrackV48(x + w * 0.22, y + 5, 11);
  drawCrackV48(x + w * 0.72, y + 7, 9);
  if (ratio <= 0.30) {
    drawCrackV48(x + w * 0.42, y + 5, 13);
    drawCrackV48(x + w * 0.56, y + 8, 11);
  }
  ctx.restore();
}
function drawCrackV48(x, y, len) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + len * 0.25, y + 3);
  ctx.lineTo(x + len * 0.48, y + 1);
  ctx.lineTo(x + len * 0.72, y + 6);
  ctx.lineTo(x + len, y + 4);
  ctx.stroke();
}

function battleUnitTierKeyV48(s) {
  const lv = s.level || 1;
  if (lv <= 2) return 'small';
  if (lv <= 4) return 'large';
  if (lv === 5) return 'elite';
  if (lv === 6) return 'advanced';
  return 'legendary';
}
function battleUnitTierScaleV48(tier) {
  return ({ small:0.88, large:1.08, elite:1.32, advanced:1.56, legendary:1.86 })[tier] || 1;
}
function battleUnitRoleScaleV48(type) {
  const role = TYPES[type]?.role;
  if (role === 'tank') return 1.10;
  if (role === 'front') return 1.06;
  if (role === 'siege') return 1.08;
  if (role === 'rush') return 0.98;
  if (role === 'back') return 0.94;
  if (role === 'support' || role === 'control') return 0.92;
  return 1;
}
function battleUnitStyleV48(side) {
  return side === 'enemy'
    ? { main:'#ff4f64', dark:'#7c1529', hp:'#ff506a', glow:'rgba(255,70,92,0.52)' }
    : { main:'#35e66f', dark:'#116b35', hp:'#42f58a', glow:'rgba(83,255,130,0.48)' };
}
function battleVisualYV48(s) {
  const topSafe = LAYOUT.enemyWallY + LAYOUT.wallH + 16;
  const bottomSafe = LAYOUT.playerWallY - 18;
  if (s.side === 'enemy') return Math.max(s.y, topSafe);
  return Math.min(s.y, bottomSafe);
}
function drawSoldier(s) {
  if (!s || !s.alive) return;
  const t = TYPES[s.type] || TYPES[DEFAULT_DECK[0]];
  const tier = battleUnitTierKeyV48(s);
  const st = battleUnitStyleV48(s.side);
  const drawY = battleVisualYV48(s);
  const depth = 0.78 + 0.25 * ((drawY - LAYOUT.fieldY) / LAYOUT.fieldH);
  const r = (15 + (s.level || 1) * 1.45) * depth * battleUnitTierScaleV48(tier) * battleUnitRoleScaleV48(s.type);
  const isEnemy = s.side === 'enemy';

  ctx.save();

  // 阵营底座。
  ctx.shadowColor = st.glow;
  ctx.shadowBlur = tier === 'legendary' ? 14 : tier === 'advanced' ? 11 : tier === 'elite' ? 8 : 5;
  ctx.strokeStyle = st.main;
  ctx.lineWidth = tier === 'legendary' ? 4.2 : tier === 'advanced' ? 3.6 : 2.8;
  if (isEnemy) {
    ctx.beginPath();
    ctx.moveTo(s.x, drawY - r * 1.02);
    ctx.lineTo(s.x + r * 1.22, drawY + r * 0.12);
    ctx.lineTo(s.x, drawY + r * 1.08);
    ctx.lineTo(s.x - r * 1.22, drawY + r * 0.12);
    ctx.closePath();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.ellipse(s.x, drawY + r * 0.25, r * 1.16, r * 0.58, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(0,0,0,0.24)';
  ctx.beginPath();
  ctx.ellipse(s.x, drawY + r + 8, r * 0.96, 5 + r * 0.055, 0, 0, Math.PI * 2);
  ctx.fill();

  const bodyW = r * 1.10;
  const bodyH = r * 1.16;
  ctx.fillStyle = s.hitFlash > 0 ? '#ffffff' : st.main;
  ctx.strokeStyle = isEnemy ? '#fff0f2' : '#ecfff1';
  ctx.lineWidth = Math.max(2, r * 0.10);
  roundRect(s.x - bodyW / 2, drawY - r * 0.02, bodyW, bodyH, Math.max(6, r * 0.22));
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = t.color || st.main;
  ctx.beginPath();
  ctx.arc(s.x, drawY - r * 0.38, r * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = st.main;
  ctx.lineWidth = Math.max(2.5, r * 0.12);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(r * 0.82)}px sans-serif`;
  ctx.fillStyle = '#fff';
  ctx.fillText(t.icon, s.x, drawY - r * 0.38);

  drawBattleUnitHpV48(s, s.x, drawY - r - 12, Math.max(28, r * 1.95));

  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

function drawBattleUnitHpV48(s, x, y, w) {
  const st = battleUnitStyleV48(s.side);
  const ratio = clamp01(s.hp / Math.max(1, s.maxHp));
  ctx.fillStyle = 'rgba(0,0,0,0.56)';
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
