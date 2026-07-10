/* ============================================================
   水果突击 · Fruit Assault —— Final Battle Skin v51
   职责：战场、城墙、战斗单位。使用五段式布局，不再让战场 HUD/城墙压单位。
   ============================================================ */

function drawField() {
  const fy = LAYOUT.fieldY;
  const fh = LAYOUT.fieldH;
  const x = 24;
  const w = W - 48;

  const g = ctx.createLinearGradient(0, fy, 0, fy + fh);
  g.addColorStop(0, 'rgba(248,234,195,0.94)');
  g.addColorStop(0.50, 'rgba(244,230,185,0.88)');
  g.addColorStop(1, 'rgba(237,222,174,0.90)');
  drawPanel(x, fy, w, fh, 18, g, 'rgba(221,200,147,0.72)');

  // 上下墙前留白，只表现为很弱的安全带，不放文字。
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  roundRect(x + 10, fy + 8, w - 20, 20, 10);
  ctx.fill();
  roundRect(x + 10, fy + fh - 28, w - 20, 20, 10);
  ctx.fill();
  ctx.restore();

  for (let c = 0; c < COLS; c++) {
    const lx = BOARD_X + c * (CELL + GAP) + CELL / 2;
    const st = state.laneStats?.[c];
    let laneColor = 'rgba(92,160,98,0.20)';
    if (st?.status === 'enemy_adv' || st?.status === 'wall_danger') laneColor = 'rgba(230,110,120,0.22)';
    else if (st?.status === 'player_adv' || st?.status === 'siege_ready') laneColor = 'rgba(90,190,100,0.24)';
    else if (st?.status === 'clash') laneColor = 'rgba(220,170,70,0.23)';

    if (st?.danger > 38) {
      ctx.save();
      ctx.fillStyle = 'rgba(230,110,120,0.07)';
      roundRect(lx - 25, fy + 34, 50, fh - 68, 12);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.strokeStyle = laneColor;
    ctx.lineWidth = c === 2 ? 1.65 : 1.1;
    ctx.beginPath();
    ctx.moveTo(lx, fy + 34);
    ctx.lineTo(lx, fy + fh - 34);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.strokeStyle = 'rgba(224,178,88,0.22)';
  ctx.setLineDash([7, 8]);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(x + 18, fy + fh / 2);
  ctx.lineTo(x + w - 18, fy + fh / 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawWall(hp, maxHp, isEnemy) {
  const ratio = clamp01(hp / Math.max(1, maxHp));
  const x = BOARD_X;
  const y = isEnemy ? LAYOUT.enemyWallY : LAYOUT.playerWallY;
  const w = BOARD_W;
  const h = LAYOUT.wallH;
  const cfg = isEnemy
    ? { body:'#C97984', dark:'#A95663', trim:'#F4D7DC', hp:'#F06B79', hpBg:'rgba(116,37,48,0.46)' }
    : { body:'#78C783', dark:'#4E9A59', trim:'#E7F8D9', hp:'#8AE78F', hpBg:'rgba(34,89,45,0.40)' };

  ctx.save();
  ctx.globalAlpha = 0.13;
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

  const segW = 18, gap = 6;
  const count = Math.floor((w - 18) / (segW + gap));
  for (let i = 0; i < count; i++) {
    const sx = x + 9 + i * (segW + gap);
    ctx.fillStyle = cfg.dark;
    roundRect(sx, y - 3, segW, 5, 3);
    ctx.fill();
    ctx.fillStyle = cfg.trim;
    roundRect(sx + 1.5, y - 2.2, segW - 3, 2.6, 2);
    ctx.fill();
  }

  const bx = x + 26, by = y + 8, bw = w - 52, bh = 7;
  ctx.fillStyle = 'rgba(255,255,255,0.24)';
  roundRect(bx - 2, by - 2, bw + 4, bh + 4, 5);
  ctx.fill();
  ctx.fillStyle = cfg.hpBg;
  roundRect(bx, by, bw, bh, 4);
  ctx.fill();
  ctx.fillStyle = cfg.hp;
  roundRect(bx + 1.5, by + 1.5, Math.max(4, (bw - 3) * ratio), bh - 3, 3);
  ctx.fill();

  if (ratio <= 0.60) drawWallDamageV51(x, y, w, h, ratio, isEnemy);
  ctx.restore();
}

function drawWallDamageV51(x, y, w, h, ratio, isEnemy) {
  ctx.save();
  ctx.strokeStyle = isEnemy ? 'rgba(112,48,58,0.55)' : 'rgba(48,108,55,0.50)';
  ctx.lineWidth = 1.2;
  drawCrackV51(x + w * 0.22, y + 5, 10);
  drawCrackV51(x + w * 0.72, y + 7, 8);
  if (ratio <= 0.30) {
    drawCrackV51(x + w * 0.42, y + 5, 12);
    drawCrackV51(x + w * 0.56, y + 8, 10);
  }
  ctx.restore();
}
function drawCrackV51(x, y, len) {
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
  const topSafe = LAYOUT.fieldY + 10;
  const bottomSafe = LAYOUT.fieldY + LAYOUT.fieldH - 10;
  return clamp(s.y, topSafe, bottomSafe);
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
