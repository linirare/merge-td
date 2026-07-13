/* ============================================================
   水果突击 · Premium Tabletop Skin v62
   哑光微缩战棋桌：低饱和漆面、旧金属细边、统一矢量水果徽记。
   ============================================================ */

function clampV48(v, a, b) { return Math.max(a, Math.min(b, v)); }

function drawPanel(x, y, w, h, r, fill = 'rgba(255,255,255,0.54)', stroke = 'rgba(72,174,70,0.16)') {
  ctx.save();
  ctx.fillStyle = fill;
  roundRect(x, y, w, h, r);
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.1;
    roundRect(x + 0.5, y + 0.5, w - 1, h - 1, r);
    ctx.stroke();
  }
  ctx.restore();
}

let _bgGrad = null, _bgWH = 0;
function drawBackground() {
  const wh = W * H;
  if (!_bgGrad || _bgWH !== wh) {
    _bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    _bgGrad.addColorStop(0, '#171619');
    _bgGrad.addColorStop(0.34, '#1D1B1D');
    _bgGrad.addColorStop(0.50, '#191C1C');
    _bgGrad.addColorStop(0.72, '#171D1A');
    _bgGrad.addColorStop(1, '#121513');
    _bgWH = wh;
  }
  ctx.fillStyle = _bgGrad;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  // 大面积低对比阵营漆面，避免游戏感过强的霓虹渐变。
  const enemyGlow = ctx.createRadialGradient(W / 2, LAYOUT.enemyBoardY + 80, 16, W / 2, LAYOUT.enemyBoardY + 80, 270);
  enemyGlow.addColorStop(0, 'rgba(111,55,62,0.13)');
  enemyGlow.addColorStop(1, 'rgba(111,55,62,0)');
  ctx.fillStyle = enemyGlow;
  ctx.fillRect(0, 0, W, H * 0.48);

  const playerGlow = ctx.createRadialGradient(W / 2, LAYOUT.playerBoardY + 96, 20, W / 2, LAYOUT.playerBoardY + 96, 290);
  playerGlow.addColorStop(0, 'rgba(61,103,79,0.13)');
  playerGlow.addColorStop(1, 'rgba(61,103,79,0)');
  ctx.fillStyle = playerGlow;
  ctx.fillRect(0, H * 0.48, W, H * 0.52);

  const vignette = ctx.createRadialGradient(W / 2, H * 0.49, 90, W / 2, H * 0.49, 520);
  vignette.addColorStop(0, 'rgba(210,188,142,0.035)');
  vignette.addColorStop(0.62, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.34)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function boardContainerStyleV48(isEnemy) {
  return isEnemy
    ? { fill:'rgba(38,29,31,0.94)', stroke:'rgba(151,119,92,0.48)', title:'#D8C7B1', slot:'rgba(255,255,255,0.018)', slotLine:'rgba(173,143,112,0.16)', accent:'#9D5158', label:'敌方阵地' }
    : { fill:'rgba(27,36,32,0.95)', stroke:'rgba(151,119,92,0.48)', title:'#D8C7B1', slot:'rgba(255,255,255,0.018)', slotLine:'rgba(173,143,112,0.16)', accent:'#567D67', label:'我方阵地' };
}

function drawBoard(slots, isEnemy, dragHint = null) {
  const by = isEnemy ? LAYOUT.enemyBoardY : LAYOUT.playerBoardY;
  const st = boardContainerStyleV48(isEnemy);

  drawPanel(BOARD_X - 10, by - 14, BOARD_W + 20, BOARD_H + 22, 8, st.fill, st.stroke);

  // 嵌入边框的微型阵营标识，不占用棋盘操作空间。
  ctx.save();
  ctx.fillStyle = st.fill;
  roundRect(BOARD_X + 8, by - 19, 82, 18, 3);
  ctx.fill();
  ctx.fillStyle = st.accent;
  ctx.beginPath();
  ctx.rect(BOARD_X + 17, by - 13, 6, 6);
  ctx.fill();
  ctx.fillStyle = st.title;
  ctx.font = '800 10px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(st.label, BOARD_X + 29, by - 9.5);
  ctx.restore();

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = BOARD_X + c * (CELL + GAP);
      const y = by + r * (CELL + GAP);
      const ball = slots?.[r]?.[c];
      const isSnap = !isEnemy && state.drag?.nearestSnap && state.drag.nearestSnap.r === r && state.drag.nearestSnap.c === c;
      const action = isSnap ? state.drag.snapAction : '';
      const canMerge = state.drag && ball && !isEnemy && state.drag.unit.type === ball.type && state.drag.unit.level === ball.level && ball.level < MAX_LEVEL;
      const isEmptyTarget = state.drag && !ball && !isEnemy;

      let fill = st.slot;
      let stroke = st.slotLine;
      if (canMerge || action === 'merge') { fill = 'rgba(255,247,214,0.88)'; stroke = 'rgba(255,200,60,0.82)'; }
      else if (isSnap || isEmptyTarget) { fill = 'rgba(252,248,238,0.58)'; stroke = 'rgba(181,117,10,0.36)'; }

      ctx.save();
      ctx.fillStyle = fill;
      roundRect(x + 3, y + 3, CELL - 6, CELL - 6, 5);
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = ball ? 1.2 : 0.9;
      roundRect(x + 3.5, y + 3.5, CELL - 7, CELL - 7, 5);
      ctx.stroke();
      ctx.restore();

      if (canMerge) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,200,60,0.90)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        roundRect(x + 4, y + 4, CELL - 8, CELL - 8, 4);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      if (ball) {
        ctx.save();
        if (isEnemy) ctx.globalAlpha = 0.88;
        drawBall(ball, x + CELL / 2, y + CELL / 2, CELL * 0.39, 0, isEnemy);
        ctx.restore();
        drawSlotLevelBadgeV48(x, y, ball.level || 1, isEnemy);
      } else if (!isEnemy && !state.drag && !state.pendingPlace) {
        ctx.save();
        ctx.strokeStyle = 'rgba(194,166,124,0.14)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + CELL / 2, y + CELL / 2 - 4);
        ctx.lineTo(x + CELL / 2 + 4, y + CELL / 2);
        ctx.lineTo(x + CELL / 2, y + CELL / 2 + 4);
        ctx.lineTo(x + CELL / 2 - 4, y + CELL / 2);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }

      if (state.pendingPlace && !ball && !isEnemy) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,201,60,0.58)';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([3, 3]);
        roundRect(x + 4, y + 4, CELL - 8, CELL - 8, 10);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      if (isSnap && !isEnemy) {
        const color = action === 'merge' ? THEME.gold : action === 'move' ? THEME.safe : THEME.info;
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.4;
        roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 12);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
      }
    }
  }
}

function fruitBoardLvScale(level) {
  return ({ 1:0.96, 2:1.02, 3:1.10, 4:1.19, 5:1.28, 6:1.38, 7:1.50 })[Math.max(1, Math.min(7, level || 1))] || 1;
}

function fruitBoardSkillColor(type) {
  return ({
    watermelon_guard:'#53e77b', grape_archer:'#b076ff', banana_raider:'#ffd24a', pineapple_lancer:'#ffb547', orange_cannon:'#ff9a35',
    coconut_guard:'#9be7ff', peach_medic:'#ff9fbd', pear_frost:'#8fe9ff', blueberry_sniper:'#829cff', lemon_assassin:'#ffe45a',
    pumpkin_roller:'#ff9a35', kiwi_wildcard:'#8dff91', passion_copy:'#d08cff'
  })[type] || '#ffd54f';
}

// 统一的矢量水果徽记。只用几何轮廓和有限色面，完全摆脱系统 Emoji 字体差异。
function drawFruitGlyphV62(c, x, y, size, type, color, ink = '#E8DEC9') {
  const id = String(type || '');
  const s = size;
  const fill = color || '#B99A62';
  c.save();
  c.translate(x, y);
  c.lineWidth = Math.max(1.1, s * 0.075);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.strokeStyle = ink;
  c.fillStyle = fill;

  const leaf = (lx, ly, rot = -0.5, scale = 1) => {
    c.save(); c.translate(lx, ly); c.rotate(rot); c.scale(scale, scale * 0.65);
    c.beginPath(); c.ellipse(0, 0, s * 0.28, s * 0.13, 0, 0, Math.PI * 2);
    c.fillStyle = '#6F8B68'; c.fill(); c.restore();
  };
  const berry = (bx, by, r) => { c.beginPath(); c.arc(bx, by, r, 0, Math.PI * 2); c.fill(); c.stroke(); };

  if (id.includes('grape')) {
    for (const [bx, by] of [[0,-.22],[-.22,0],[.22,0],[-.12,.25],[.12,.25],[0,.48]]) berry(bx*s, by*s, s*.22);
    leaf(-s*.05, -s*.48, -0.7, .9);
  } else if (id.includes('cherry')) {
    berry(-s*.24, s*.18, s*.28); berry(s*.24, s*.18, s*.28);
    c.beginPath(); c.moveTo(-s*.2,-s*.04); c.quadraticCurveTo(-s*.08,-s*.52,0,-s*.58); c.quadraticCurveTo(s*.1,-s*.48,s*.2,-s*.04); c.stroke();
    leaf(s*.06,-s*.52,-.25,.75);
  } else if (id.includes('banana')) {
    c.beginPath(); c.moveTo(-s*.52,-s*.2); c.bezierCurveTo(-s*.15,s*.48,s*.42,s*.45,s*.56,-s*.18); c.bezierCurveTo(s*.24,s*.14,-s*.1,s*.1,-s*.38,-s*.34); c.closePath(); c.fill(); c.stroke();
  } else if (id.includes('pineapple')) {
    c.beginPath(); c.ellipse(0,s*.12,s*.42,s*.55,0,0,Math.PI*2); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-s*.28,-s*.34); c.lineTo(-s*.42,-s*.72); c.lineTo(-s*.06,-s*.48); c.lineTo(0,-s*.8); c.lineTo(s*.12,-s*.48); c.lineTo(s*.44,-s*.68); c.lineTo(s*.27,-s*.3); c.strokeStyle='#78916D'; c.stroke();
    c.strokeStyle='rgba(72,55,36,.45)'; c.lineWidth=Math.max(.8,s*.04); for(let i=-1;i<=1;i++){c.beginPath();c.moveTo(-s*.32,i*s*.24);c.lineTo(s*.32,(i-1)*s*.24);c.stroke();}
  } else if (id.includes('watermelon')) {
    c.beginPath(); c.arc(0,0,s*.56,0,Math.PI); c.lineTo(-s*.56,0); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle='#7EA76F'; c.lineWidth=s*.12; c.beginPath(); c.arc(0,0,s*.48,0,Math.PI); c.stroke();
  } else if (id.includes('strawberry')) {
    c.beginPath(); c.moveTo(0,s*.6); c.bezierCurveTo(-s*.55,s*.15,-s*.52,-s*.35,0,-s*.46); c.bezierCurveTo(s*.52,-s*.35,s*.55,s*.15,0,s*.6); c.fill(); c.stroke();
    leaf(0,-s*.48,0,1.05);
  } else if (id.includes('dragonfruit')) {
    c.beginPath(); c.ellipse(0,0,s*.42,s*.56,0,0,Math.PI*2); c.fill(); c.stroke();
    c.strokeStyle='#6F8B68'; for(let i=-2;i<=2;i++){const yy=i*s*.18;c.beginPath();c.moveTo((i%2?-.34:.34)*s,yy);c.lineTo((i%2?-.62:.62)*s,yy-s*.12);c.stroke();}
  } else if (id.includes('avocado') || id.includes('pear')) {
    c.beginPath(); c.moveTo(0,-s*.6); c.bezierCurveTo(-s*.18,-s*.35,-s*.48,-s*.1,-s*.48,s*.25); c.bezierCurveTo(-s*.48,s*.66,s*.48,s*.66,s*.48,s*.25); c.bezierCurveTo(s*.48,-s*.1,s*.18,-s*.35,0,-s*.6); c.fill(); c.stroke();
    if (id.includes('avocado')) { c.fillStyle='#7B5B3D'; c.beginPath(); c.arc(0,s*.22,s*.2,0,Math.PI*2); c.fill(); }
    else leaf(s*.08,-s*.55,-.35,.7);
  } else if (id.includes('pumpkin') || id.includes('melon')) {
    c.beginPath(); c.ellipse(0,s*.05,s*.55,s*.45,0,0,Math.PI*2); c.fill(); c.stroke();
    c.strokeStyle='rgba(232,222,201,.55)'; for(const px of [-.22,0,.22]){c.beginPath();c.ellipse(px*s,s*.05,s*.22,s*.43,0,0,Math.PI*2);c.stroke();}
    leaf(s*.04,-s*.42,-.4,.7);
  } else if (id.includes('coconut')) {
    c.fillStyle='#80664B'; berry(0,0,s*.52); c.fillStyle='#E8DEC9'; for(const px of [-.18,0,.18]) berry(px*s,-s*.05,s*.055);
  } else if (id.includes('kiwi')) {
    c.fillStyle='#778D52'; berry(0,0,s*.52); c.fillStyle='#252A20'; for(let i=0;i<8;i++){const a=i*Math.PI/4;c.beginPath();c.ellipse(Math.cos(a)*s*.28,Math.sin(a)*s*.28,s*.035,s*.08,a,0,Math.PI*2);c.fill();}
  } else if (id.includes('olive')) {
    c.beginPath(); c.ellipse(0,s*.08,s*.38,s*.55,-.25,0,Math.PI*2); c.fill(); c.stroke(); leaf(s*.12,-s*.52,-.35,.9);
  } else if (id.includes('mango')) {
    c.beginPath(); c.moveTo(-s*.44,s*.32); c.bezierCurveTo(-s*.6,-s*.15,-s*.2,-s*.58,s*.2,-s*.52); c.bezierCurveTo(s*.62,-s*.42,s*.58,s*.28,s*.12,s*.5); c.bezierCurveTo(-s*.08,s*.6,-s*.3,s*.53,-s*.44,s*.32); c.fill(); c.stroke(); leaf(s*.12,-s*.52,-.2,.75);
  } else if (id.includes('passion')) {
    berry(0,0,s*.52); c.fillStyle='#D9B5E8'; berry(0,0,s*.25);
  } else if (id.includes('mint')) {
    for(const a of [-1.05,-.35,.35,1.05]) leaf(Math.cos(a)*s*.18,Math.sin(a)*s*.18,a,.95);
  } else if (id.includes('honey')) {
    c.beginPath(); for(let i=0;i<6;i++){const a=-Math.PI/2+i*Math.PI/3;const px=Math.cos(a)*s*.48,py=Math.sin(a)*s*.48;i?c.lineTo(px,py):c.moveTo(px,py);} c.closePath(); c.fill(); c.stroke();
  } else if (id.includes('chill')) {
    c.beginPath(); c.rect(-s*.42,-s*.42,s*.84,s*.84); c.fill(); c.stroke(); c.beginPath(); c.moveTo(-s*.42,-s*.42);c.lineTo(s*.42,s*.42);c.moveTo(s*.42,-s*.42);c.lineTo(-s*.42,s*.42);c.stroke();
  } else {
    c.beginPath(); c.ellipse(0,s*.04,s*.5,s*.48,0,0,Math.PI*2); c.fill(); c.stroke(); leaf(s*.12,-s*.43,-.45,.72);
  }
  c.restore();
}
window.drawFruitGlyphV62 = drawFruitGlyphV62;

function drawBall(ball, cx, cy, radius, extraY = 0, isEnemy = false) {
  const t = TYPES[ball.type] || TYPES[DEFAULT_DECK[0]];
  const level = Math.max(1, Math.min(7, ball.level || 1));
  const bounceOff = ball.bounce ? -Math.sin(ball.bounce * Math.PI) * 9 : 0;
  const floatOff = window.REDUCE_MOTION ? 0 : Math.sin((state.time || 0) * 1.45 + cx * 0.06 + cy * 0.06) * 0.7;
  const drawY = cy - bounceOff + floatOff + extraY;
  const lvScale = fruitBoardLvScale(level);
  const trayRx = radius * 0.64 * lvScale;
  const trayRy = radius * 0.20;
  const arcR = radius * (0.94 + (level - 1) * 0.055);
  const ringColor = isEnemy ? '#ff6578' : (t.color || '#53c96a');

  ctx.save();

  // 微缩棋子底座：哑光黑漆 + 旧金属细环。
  ctx.globalAlpha = 0.30;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(cx, drawY + radius * 0.86, trayRx, trayRy, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = isEnemy ? '#2D2325' : '#202824';
  ctx.beginPath();
  ctx.arc(cx, drawY, arcR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = level >= 5 ? '#BDA26B' : 'rgba(189,162,107,0.56)';
  ctx.lineWidth = level >= 5 ? 2.2 : 1.2;
  ctx.stroke();
  drawFruitGlyphV62(ctx, cx, drawY, radius * 0.58 * lvScale, ball.type, t.color, '#E8DEC9');

  // Lv4+ 技能小标。
  if (level >= 4) {
    const skillColor = fruitBoardSkillColor(ball.type);
    const markX = cx + arcR * 0.68;
    const markY = drawY - arcR * 0.68;
    const markR = Math.max(7, radius * 0.19);
    ctx.globalAlpha = isEnemy ? 0.72 : 0.96;
    ctx.fillStyle = '#181817';
    ctx.beginPath();
    ctx.arc(markX, markY, markR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#BDA26B';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(markX, markY, markR, 0, Math.PI * 2);
    ctx.stroke();
    drawFruitBoardSkillMarkV48(markX, markY, ball.type, Math.max(4.4, radius * 0.12), skillColor);
  }

  // 唯一圆弧：出兵 CD。
  if (state.phase === 'playing') {
    const cd = SPAWN_COOLDOWNS[level] || SPAWN_COOLDOWNS[1] || 5;
    const ready = ball.spawnTimer <= 0;
    const progress = ready ? 1 : clamp01(1 - (ball.spawnTimer || 0) / cd);
    ctx.globalAlpha = ready ? 0.92 : 0.48;
    ctx.strokeStyle = ready ? '#D8C08A' : ringColor;
    ctx.lineWidth = ready ? 2.1 : 1.4;
    ctx.beginPath();
    ctx.arc(cx, drawY, arcR + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.stroke();
  }

  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

function drawSlotLevelBadgeV48(x, y, level, isEnemy) {
  const lv = Math.max(1, Math.min(7, level || 1));
  const fill = '#171717';
  const stroke = lv >= 5 ? '#BDA26B' : 'rgba(189,162,107,0.62)';
  ctx.save();
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.4;
  roundRect(x + 2, y + 2, 24, 14, 3);
  ctx.fill();
  ctx.stroke();
  ctx.font = '700 10.5px "Nunito","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = lv >= 5 ? '#E7CF98' : '#D7CCB6';
  ctx.fillText(`L${lv}`, x + 14, y + 9);
  ctx.restore();
}

function drawFruitBoardSkillMarkV48(x, y, type, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.8, size * 0.16);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (type === 'watermelon_guard' || type === 'coconut_guard') {
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size * 0.72, y - size * 0.35);
    ctx.lineTo(x + size * 0.40, y + size * 0.78);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x - size * 0.40, y + size * 0.78);
    ctx.lineTo(x - size * 0.72, y - size * 0.35);
    ctx.closePath();
    ctx.stroke();
  } else if (type === 'grape_archer' || type === 'blueberry_sniper') {
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(x - size * 0.72, y + i * size * 0.34);
      ctx.lineTo(x + size * 0.72, y + i * size * 0.08);
      ctx.stroke();
    }
  } else if (type === 'banana_raider' || type === 'lemon_assassin') {
    ctx.beginPath();
    ctx.moveTo(x - size * 0.65, y + size * 0.48);
    ctx.lineTo(x + size * 0.06, y - size * 0.78);
    ctx.lineTo(x + size * 0.68, y - size * 0.05);
    ctx.stroke();
  } else if (type === 'pineapple_lancer') {
    ctx.beginPath();
    ctx.moveTo(x - size * 0.72, y + size * 0.62);
    ctx.lineTo(x + size * 0.75, y - size * 0.62);
    ctx.stroke();
  } else if (type === 'orange_cannon' || type === 'pumpkin_roller') {
    ctx.strokeRect(x - size * 0.62, y - size * 0.25, size * 1.05, size * 0.50);
  } else {
    ctx.beginPath();
    ctx.arc(x, y, size * 0.55, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/* ============================================================
   Commercial battlefield art direction v2
   Bright orchard arena, chunky deployment trays and hero portraits.
   ============================================================ */
function commercialTeamV2(isEnemy) {
  return isEnemy
    ? { main:'#F04D72', deep:'#6E173D', panel:'#35162B', glow:'#FF7895', trim:'#FFD37A', text:'#FFF3E8' }
    : { main:'#2ED6B4', deep:'#075C68', panel:'#092E3D', glow:'#65F6D2', trim:'#FFD37A', text:'#F2FFFB' };
}

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#17233F');
  g.addColorStop(0.28, '#203859');
  g.addColorStop(0.50, '#152D43');
  g.addColorStop(0.76, '#0D3440');
  g.addColorStop(1, '#071D2B');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  const sun = ctx.createRadialGradient(W * 0.82, 60, 12, W * 0.82, 60, 250);
  sun.addColorStop(0, 'rgba(255,218,132,.25)');
  sun.addColorStop(0.42, 'rgba(115,191,219,.10)');
  sun.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H * .55);

  ctx.fillStyle = 'rgba(7,23,39,.46)';
  for (let i = 0; i < 8; i++) {
    const x = -24 + i * 72;
    const y = LAYOUT.enemyBoardY - 6 + (i % 2) * 8;
    ctx.beginPath();
    ctx.arc(x, y, 32 + (i % 3) * 7, Math.PI, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCommercialFruitFaceV2(x, y, r, type, color, enemy = false) {
  if (typeof drawFruitGlyphV62 === 'function') {
    drawFruitGlyphV62(ctx, x, y, r, type, color, '#FFF4D6');
  }
  const eyeY = y - r * .05;
  const eyeDX = r * .22;
  ctx.save();
  ctx.fillStyle = '#FFFDF4';
  ctx.beginPath(); ctx.ellipse(x - eyeDX, eyeY, r * .105, r * .145, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + eyeDX, eyeY, r * .105, r * .145, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#19233A';
  const look = enemy ? -.025 : .025;
  ctx.beginPath(); ctx.arc(x - eyeDX + r * look, eyeY + r * .025, r * .055, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + eyeDX + r * look, eyeY + r * .025, r * .055, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#5C2A35';
  ctx.lineWidth = Math.max(1.2, r * .07);
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (enemy) {
    ctx.moveTo(x - eyeDX - r * .09, eyeY - r * .17); ctx.lineTo(x - eyeDX + r * .08, eyeY - r * .12);
    ctx.moveTo(x + eyeDX - r * .08, eyeY - r * .12); ctx.lineTo(x + eyeDX + r * .09, eyeY - r * .17);
  } else {
    ctx.arc(x, y + r * .17, r * .17, .12, Math.PI - .12);
  }
  ctx.stroke();
  ctx.restore();
}

function drawBoard(slots, isEnemy, dragHint = null) {
  const by = isEnemy ? LAYOUT.enemyBoardY : LAYOUT.playerBoardY;
  const team = commercialTeamV2(isEnemy);
  const ox = BOARD_X - 12, oy = by - 19, ow = BOARD_W + 24, oh = BOARD_H + 30;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.48)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 7;
  const outer = ctx.createLinearGradient(0, oy, 0, oy + oh);
  outer.addColorStop(0, team.trim);
  outer.addColorStop(.12, '#B8793D');
  outer.addColorStop(.18, team.deep);
  outer.addColorStop(1, '#071722');
  drawPanel(ox, oy, ow, oh, 16, outer, 'rgba(255,235,177,.82)');
  ctx.restore();

  const felt = ctx.createLinearGradient(0, by, 0, by + BOARD_H);
  felt.addColorStop(0, isEnemy ? '#4A1A35' : '#0A4250');
  felt.addColorStop(1, isEnemy ? '#251426' : '#082D37');
  drawPanel(BOARD_X - 4, by - 4, BOARD_W + 8, BOARD_H + 8, 11, felt, 'rgba(255,255,255,.10)');

  ctx.save();
  ctx.fillStyle = team.deep;
  roundRect(BOARD_X + 10, by - 28, 116, 24, 8);
  ctx.fill();
  ctx.strokeStyle = team.trim;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = team.main;
  ctx.beginPath(); ctx.arc(BOARD_X + 25, by - 16, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = team.text;
  ctx.font = '900 12px "Microsoft YaHei",sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(isEnemy ? '\u654c\u65b9\u5927\u672c\u8425' : '\u6211\u65b9\u6307\u6325\u90e8', BOARD_X + 37, by - 16);
  ctx.restore();

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = BOARD_X + c * (CELL + GAP);
      const y = by + r * (CELL + GAP);
      const ball = slots?.[r]?.[c];
      const isSnap = !isEnemy && state.drag?.nearestSnap && state.drag.nearestSnap.r === r && state.drag.nearestSnap.c === c;
      ctx.save();
      ctx.shadowColor = ball ? team.glow : 'rgba(0,0,0,.32)';
      ctx.shadowBlur = ball ? 10 : 0;
      ctx.shadowOffsetY = ball ? 0 : 3;
      const pad = ctx.createLinearGradient(0, y, 0, y + CELL);
      pad.addColorStop(0, ball ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.08)');
      pad.addColorStop(.18, ball ? team.panel : 'rgba(5,20,30,.38)');
      pad.addColorStop(1, 'rgba(3,12,21,.58)');
      ctx.fillStyle = isSnap ? 'rgba(255,215,94,.26)' : pad;
      roundRect(x + 3, y + 3, CELL - 6, CELL - 6, 10);
      ctx.fill();
      ctx.strokeStyle = isSnap ? '#FFD45F' : (ball ? team.trim : 'rgba(170,209,216,.20)');
      ctx.lineWidth = ball ? 1.8 : 1;
      ctx.stroke();
      ctx.restore();

      if (ball) {
        drawBall(ball, x + CELL / 2, y + CELL / 2 + 1, CELL * .35, 0, isEnemy);
        drawSlotLevelBadgeV48(x, y, ball.level || 1, isEnemy);
      } else if (!state.drag && !state.pendingPlace) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,.12)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x + CELL / 2, y + CELL / 2, 4, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }
  }
}

function drawBall(ball, cx, cy, radius, extraY = 0, isEnemy = false) {
  const t = TYPES[ball.type] || TYPES[DEFAULT_DECK[0]];
  const level = Math.max(1, Math.min(7, ball.level || 1));
  const team = commercialTeamV2(isEnemy);
  const drawY = cy + extraY - (ball.bounce ? Math.sin(ball.bounce * Math.PI) * 7 : 0);
  const rr = radius * (1 + (level - 1) * .035);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.38)';
  ctx.beginPath(); ctx.ellipse(cx, drawY + rr * .78, rr * .72, rr * .22, 0, 0, Math.PI * 2); ctx.fill();
  const medallion = ctx.createRadialGradient(cx - rr * .25, drawY - rr * .32, 2, cx, drawY, rr * 1.15);
  medallion.addColorStop(0, 'rgba(255,255,255,.24)');
  medallion.addColorStop(.22, team.panel);
  medallion.addColorStop(1, '#07151F');
  ctx.fillStyle = medallion;
  ctx.strokeStyle = level >= 4 ? '#FFE17F' : team.trim;
  ctx.lineWidth = level >= 4 ? 2.8 : 1.8;
  ctx.beginPath(); ctx.arc(cx, drawY, rr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  drawCommercialFruitFaceV2(cx, drawY - 1, rr * .62, ball.type, t.color, isEnemy);

  if (state.phase === 'playing') {
    const cd = SPAWN_COOLDOWNS[level] || SPAWN_COOLDOWNS[1] || 5;
    const progress = ball.spawnTimer <= 0 ? 1 : clamp01(1 - (ball.spawnTimer || 0) / cd);
    ctx.strokeStyle = ball.spawnTimer <= 0 ? '#FFF1A8' : team.glow;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(cx, drawY, rr + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSlotLevelBadgeV48(x, y, level, isEnemy) {
  const team = commercialTeamV2(isEnemy);
  const lv = Math.max(1, Math.min(7, level || 1));
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
  ctx.fillStyle = lv >= 4 ? '#FFD65A' : '#0A1D2C';
  ctx.strokeStyle = lv >= 4 ? '#FFF2A8' : team.trim;
  ctx.lineWidth = 1.5;
  roundRect(x + 1, y + 1, 29, 17, 6); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = lv >= 4 ? '#4A2A0A' : '#FFF7DF';
  ctx.font = '900 11px "Nunito",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`Lv${lv}`, x + 15.5, y + 9.5);
  ctx.restore();
}
