/* ============================================================
   合成塔防 · PvE —— Canvas 渲染
   ============================================================ */

/* ——— 工具 ——— */
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/* ——— 背景 ——— */
function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#1a1410');
  sky.addColorStop(0.5, '#2a2218');
  sky.addColorStop(1, '#1a1410');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
}

/* ——— 棋盘 ——— */
function drawBoard(slots, isEnemy, dragHint = null) {
  const by = isEnemy ? LAYOUT.enemyBoardY : LAYOUT.playerBoardY;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = BOARD_X + c * (CELL + GAP);
      const y = by + r * (CELL + GAP);
      const ball = slots[r][c];

      // 格子背景
      const isMergeHint = dragHint && ball && dragHint.type === ball.type && dragHint.level === ball.level;
      ctx.fillStyle = isMergeHint
        ? 'rgba(255,228,90,0.15)'
        : (r + c) % 2 === 0 ? 'rgba(255,235,180,0.05)' : 'rgba(255,235,180,0.09)';
      roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 8);
      ctx.fill();

      // 可合成高亮框
      if (isMergeHint) {
        ctx.strokeStyle = '#ffe45a';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#ffe45a';
        ctx.shadowBlur = 12;
        roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 8);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      if (ball) {
        ctx.save();
        if (isEnemy) ctx.globalAlpha = 0.7;
        drawBall(ball, x + CELL / 2, y + CELL / 2, CELL * 0.38);
        ctx.restore();
      }

      // pendingPlace 预览：空格显示虚线框
      if (state.pendingPlace && !ball && !isEnemy) {
        ctx.fillStyle = 'rgba(255,228,90,0.08)';
        roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,228,90,0.3)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 8);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 磁吸高亮
      const isSnap = state.drag?.nearestSnap && state.drag.nearestSnap.r === r && state.drag.nearestSnap.c === c;
      if (isSnap && !isEnemy) {
        ctx.shadowColor = '#ffe45a';
        ctx.shadowBlur = 18;
        ctx.strokeStyle = '#ffe45a';
        ctx.lineWidth = 2.5;
        roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 8);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
  }
}

/* ——— 球 ——— */
function drawBall(ball, cx, cy, radius, extraY = 0) {
  const t = TYPES[ball.type];
  const bounceOff = ball.bounce ? -Math.sin(ball.bounce * Math.PI) * 12 : 0;
  const lvScale = 1 + (ball.level - 1) * 0.12; // 每级+12%，Lv.7是Lv.1的1.72倍
  const r = radius * lvScale;
  const floatOff = Math.sin(state.time * 1.5 + cx * 0.1 + cy * 0.1) * 1.2;
  const drawY = cy - bounceOff + floatOff + extraY;

  // 等级光环
  if (ball.level >= 3) {
    ctx.save();
    ctx.globalAlpha = 0.2 + ball.level * 0.06;
    ctx.shadowColor = t.color;
    ctx.shadowBlur = 6 + ball.level * 4;
    ctx.strokeStyle = ball.level >= 5 ? '#ffe45a' : t.color;
    ctx.lineWidth = 1.5 + ball.level * 0.3;
    ctx.beginPath();
    ctx.arc(cx, drawY, r + 3 + ball.level, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 外发光
  ctx.shadowColor = t.color;
  ctx.shadowBlur = 8 + ball.level * 3;

  // 圆盘
  const luma = 0.6 + ball.level * 0.05; // 等级越高越亮
  ctx.fillStyle = t.color;
  ctx.beginPath();
  ctx.arc(cx, drawY, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // 高等级纹理：内圈光晕
  ctx.fillStyle = `rgba(255,255,255,${0.15 + ball.level * 0.03})`;
  ctx.beginPath();
  ctx.arc(cx - r * 0.2, drawY - r * 0.2, r * 0.4, 0, Math.PI * 2);
  ctx.fill();

  // 等级数字（左上角小标）
  const lvSize = Math.round(r * 0.45);
  ctx.font = `bold ${lvSize}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 2;
  ctx.strokeText(ball.level, cx - r * 0.7, drawY - r * 0.65);
  ctx.fillStyle = ball.level >= 5 ? '#ffe45a' : '#fff';
  ctx.fillText(ball.level, cx - r * 0.7, drawY - r * 0.65);

  // 品类图标（右下小角标）
  const iconSize = Math.round(r * (0.5 + ball.level * 0.02));
  ctx.font = `${iconSize}px sans-serif`;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  const iconR = r * 0.55;
  ctx.beginPath();
  ctx.arc(cx + r * 0.6, drawY + r * 0.6, iconR * 0.65, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `${iconSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(t.icon, cx + r * 0.6, drawY + r * 0.6);
  ctx.textBaseline = 'alphabetic';

  // 产兵倒计时环（每球独立）
  if (state.phase === 'playing') {
    const cd = SPAWN_COOLDOWNS[ball.level] || SPAWN_COOLDOWNS[1];
    const ready = ball.spawnTimer <= 0;
    const progress = ready ? 1 : (1 - ball.spawnTimer / cd);
    ctx.strokeStyle = ready ? 'rgba(255,228,90,0.6)' : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = ready ? 2.5 : 2;
    if (ready) { ctx.shadowColor = '#ffe45a'; ctx.shadowBlur = 6; }
    ctx.beginPath();
    ctx.arc(cx, drawY, r + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

/* ——— 城墙 ——— */
function drawWall(hp, maxHp, isEnemy) {
  const y = isEnemy ? LAYOUT.enemyWallY : LAYOUT.playerWallY;
  const w = W * 0.7;
  const h = LAYOUT.wallH;
  const x = (W - w) / 2;

  // 城墙基底
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#5a4832');
  g.addColorStop(1, '#3a2e1e');
  ctx.fillStyle = g;
  roundRect(x, y, w, h, 4);
  ctx.fill();

  // 垛口 — 按血量比例减少
  const healthRatio = hp / maxHp;
  const crenelCount = Math.max(2, Math.round(12 * healthRatio));
  ctx.fillStyle = healthRatio > 0.5 ? '#6a563c'
                : healthRatio > 0.25 ? '#5a4630'
                : '#3a2e1e';
  for (let i = 0; i < crenelCount; i++)
    ctx.fillRect(x + 4 + i * (w - 8) / 11, y - 6, (w - 8) / 12 - 2, 6);

  // 血量 < 30% 显示裂痕
  if (healthRatio < 0.3) {
    ctx.strokeStyle = 'rgba(255,100,60,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.3, y);
    ctx.lineTo(x + w * 0.4, y + h * 0.5);
    ctx.lineTo(x + w * 0.35, y + h);
    ctx.moveTo(x + w * 0.6, y);
    ctx.lineTo(x + w * 0.7, y + h * 0.3);
    ctx.lineTo(x + w * 0.65, y + h);
    ctx.stroke();
  }

  // HP 条
  const barW = w - 12, barH = 8;
  const barX = x + 6, barY = y + h - barH - 4;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundRect(barX, barY, barW, barH, 3);
  ctx.fill();
  const frac = hp / maxHp;
  ctx.fillStyle = frac > 0.5 ? '#7aff5a' : frac > 0.25 ? '#ffd24a' : '#ff5a3a';
  roundRect(barX + 1, barY + 1, (barW - 2) * frac, barH - 2, 2);
  ctx.fill();

  // HP 文字
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd8a0';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 2;
  const txt = `🏰 ${hp}/${maxHp}`;
  ctx.strokeText(txt, W / 2, y - 10);
  ctx.fillText(txt, W / 2, y - 10);
}

/* ——— 战场区域 ——— */
function drawField() {
  const fy = LAYOUT.fieldY;
  const fh = LAYOUT.fieldH;

  // 渐变底色（上暗下亮，模拟景深）
  const g = ctx.createLinearGradient(0, fy, 0, fy + fh);
  g.addColorStop(0, 'rgba(30,22,12,0.6)');
  g.addColorStop(0.5, 'rgba(50,36,20,0.35)');
  g.addColorStop(1, 'rgba(30,22,12,0.6)');
  ctx.fillStyle = g;
  roundRect(20, fy, W - 40, fh, 8);
  ctx.fill();

  // 透视网格
  ctx.strokeStyle = 'rgba(255,200,100,0.08)';
  ctx.lineWidth = 1;
  const vanishX = W / 2, vanishY = fy + fh * 0.3;
  for (let i = 0; i < 8; i++) {
    const spread = 30 + i * 35;
    ctx.beginPath();
    ctx.moveTo(vanishX, vanishY);
    ctx.lineTo(vanishX - spread, fy + fh);
    ctx.moveTo(vanishX, vanishY);
    ctx.lineTo(vanishX + spread, fy + fh);
    ctx.stroke();
  }

  // 中线
  ctx.strokeStyle = 'rgba(255,200,100,0.15)';
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(20, fy + fh / 2);
  ctx.lineTo(W - 20, fy + fh / 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

/* ——— 兵 ——— */
function drawSoldier(s) {
  const t = TYPES[s.type];
  const fy = LAYOUT.fieldY, fh = LAYOUT.fieldH;
  const depthFactor = 0.7 + 0.3 * ((s.y - fy) / fh);
  const r = (8 + s.level * 1.5) * depthFactor;

  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(s.x, s.y + r + 2, r * 0.7, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // 受击闪红
  if (s.hitFlash > 0) {
    ctx.fillStyle = '#ff2a1a';
    ctx.shadowColor = '#ff2a1a';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    // 敌我区分：敌方红边菱形，我方实心圆
    if (s.side === 'enemy') {
      ctx.fillStyle = t.color + '88';
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff3a2a';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ff3a2a';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r + 1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1.5;
    } else {
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#6fd44e';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#6fd44e';
      ctx.shadowBlur = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r + 1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  // 品类图标
  ctx.font = `${Math.round(r * 0.8)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t.icon, s.x, s.y + 1);

  // 分段血条
  if (s.hp < s.maxHp) {
    const bw = r * 2.2, bh = 3;
    const segments = 5;
    const segW = bw / segments;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(s.x - bw / 2, s.y - r - 6, bw, bh);
    for (let i = 0; i < segments; i++) {
      const segHp = (s.hp / s.maxHp) * segments;
      if (i >= segHp) break;
      const alpha = 1 - (i / segments) * 0.3;
      ctx.globalAlpha = Math.max(0.4, alpha);
      ctx.fillStyle = s.hp / s.maxHp > 0.5 ? '#7aff5a'
                    : s.hp / s.maxHp > 0.25 ? '#ffd24a'
                    : '#ff5a3a';
      ctx.fillRect(s.x - bw / 2 + i * segW + 1, s.y - r - 5, segW - 2, bh - 2);
    }
    ctx.globalAlpha = 1;
  }
  ctx.textBaseline = 'alphabetic';
}

/* ——— 合成环特效 ——— */
function drawRings() {
  for (const ring of state.rings) {
    const alpha = ring.life / ring.maxLife;
    ctx.globalAlpha = alpha * 0.6;
    ctx.strokeStyle = ring.color || '#ffe45a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/* ——— 箭矢渲染 ——— */
function drawProjectiles() {
  for (const p of state.projectiles) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(p.targetY - p.y, p.targetX - p.x));
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-4, -3);
    ctx.lineTo(-4, 3);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

/* ——— 攻击划痕 ——— */
function drawAttackFx() {
  for (const a of state.attackFx) {
    const alpha = a.life / a.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#ff4a3a';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(a.x1, a.y1);
    ctx.lineTo(a.x2, a.y2);
    ctx.stroke();
    // 闪光点在中点
    const mx = (a.x1 + a.x2) / 2, my = (a.y1 + a.y2) / 2;
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#ffdd4a';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(mx, my, 3 * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/* ——— 特效文字 ——— */
function drawFx() {
  for (const f of state.fx) {
    const alpha = f.life / f.maxLife;
    const scale = f.vx ? 1 : (1 + (1 - alpha) * 0.3);
    ctx.save();
    const baseY = f.vx ? f.y : (f.y - (1 - alpha) * 30);
    ctx.translate(f.x, baseY);
    if (scale !== 1) ctx.scale(scale, scale);
    ctx.globalAlpha = f.vx ? Math.min(alpha * 2, 1) : alpha;
    ctx.font = `bold ${f.size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, 0, 0);
    ctx.restore();
  }
}

/* ——— 暂停按钮 ——— */
const PAUSE_RECT = { x: W - 150, y: 4, w: 28, h: 26 };

function drawPauseBtn() {
  if (state.phase !== 'playing' && state.phase !== 'paused') return;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(PAUSE_RECT.x, PAUSE_RECT.y, PAUSE_RECT.w, PAUSE_RECT.h, 8);
  ctx.fill();
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c9b69a';
  ctx.fillText(state.phase === 'paused' ? '▶' : '⏸',
    PAUSE_RECT.x + PAUSE_RECT.w / 2, PAUSE_RECT.y + 19);
}

/* ——— 帮助按钮 ——— */
const HELP_RECT = { x: W - 116, y: 4, w: 28, h: 26 };

function drawHelpBtn() {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(HELP_RECT.x, HELP_RECT.y, HELP_RECT.w, HELP_RECT.h, 8);
  ctx.fill();
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c9b69a';
  ctx.fillText('?', HELP_RECT.x + HELP_RECT.w / 2, HELP_RECT.y + 19);
}

/* ——— 速度控制按钮 ——— */
const SPEED_RECT = { x: W - 80, y: 4, w: 72, h: 26 };

function drawSpeedBtn() {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(SPEED_RECT.x, SPEED_RECT.y, SPEED_RECT.w, SPEED_RECT.h, 8);
  ctx.fill();
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c9b69a';
  ctx.fillText(`⏩ ×${state.speed}`, SPEED_RECT.x + SPEED_RECT.w / 2, SPEED_RECT.y + 18);
}

/* ——— 溢出队列指示（可点击区域） ——— */
const OVERFLOW_RECT = { x: W / 2 - 56, y: LAYOUT.bottomY + 4, w: 112, h: 30 };

function drawOverflowIndicator() {
  if (state.overflowQueue.length === 0) return;
  const txt = `📦 ×${state.overflowQueue.length}`;
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(OVERFLOW_RECT.x, OVERFLOW_RECT.y, OVERFLOW_RECT.w, OVERFLOW_RECT.h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,228,90,0.3)';
  ctx.lineWidth = 1;
  roundRect(OVERFLOW_RECT.x, OVERFLOW_RECT.y, OVERFLOW_RECT.w, OVERFLOW_RECT.h, 10);
  ctx.stroke();
  ctx.fillStyle = '#ffe45a';
  ctx.fillText(txt, W / 2, OVERFLOW_RECT.y + 21);
}

/* ——— 信息 ——— */
function drawInfo() {
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#c9b69a';
  if (state.levelConfig) {
    ctx.fillText(`第 ${state.currentLevel} 关`, 12, LAYOUT.enemyInfoY + 13);
    ctx.fillStyle = '#a89a76';
    ctx.font = '11px sans-serif';
    ctx.fillText(state.levelConfig.desc, 12, LAYOUT.enemyInfoY + 28);
  } else {
    ctx.fillText('合成塔防', 12, LAYOUT.enemyInfoY + 13);
  }
}

/* ——— HUD / 对战状态 ——— */
function drawHUD() {
  if (state.phase !== 'playing' && state.phase !== 'paused') return;

  const pCount = state.playerSoldiers.filter(s => s.alive).length;
  const eCount = state.enemySoldiers.filter(s => s.alive).length;
  const total = pCount + eCount || 1;
  const elapsed = Math.floor(state.time);

  // 时间
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = THEME.textDim;
  ctx.fillText(`⏱ ${elapsed}s`, W - 12, LAYOUT.enemyInfoY + 13);
  // SP 显示
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = state.sp > 0 ? THEME.gold : '#5a4a3a';
  ctx.fillText(`⚡ ${state.sp}`, 12, LAYOUT.enemyInfoY + 13);

  // 兵数对比比例条
  const barW = 80, barH = 6;
  const bx = W / 2 - barW / 2, by = LAYOUT.fieldY + LAYOUT.fieldH - 14;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(bx, by, barW, barH, 3);
  ctx.fill();
  ctx.fillStyle = THEME.safe;
  roundRect(bx, by, barW * (pCount / total), barH, 3);
  ctx.fill();
  ctx.fillStyle = THEME.accent;
  roundRect(bx + barW * (pCount / total), by, barW * (eCount / total), barH, 3);
  ctx.fill();
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = THEME.safe;
  ctx.fillText(`⚔ ${pCount}`, bx, by - 3);
  ctx.textAlign = 'right';
  ctx.fillStyle = THEME.accent;
  ctx.fillText(`${eCount} ⚔`, bx + barW, by - 3);
  ctx.textAlign = 'center';
  ctx.font = '11px sans-serif';
  ctx.fillStyle = 'rgba(200,180,140,0.4)';
  ctx.fillText(`第 ${state.currentLevel} 关`, W / 2, LAYOUT.fieldY + LAYOUT.fieldH - 20);
}

/* ——— 主绘制 ——— */
function draw() {
  ctx.save();
  if (state.shake > 0.05) ctx.translate(
    (Math.random() - 0.5) * state.shake * 12,
    (Math.random() - 0.5) * state.shake * 12
  );

  drawBackground();
  drawInfo();

  // 敌方棋盘
  drawBoard(state.enemySlots, true);
  // 敌方城墙
  drawWall(state.enemyWallHp, state.enemyWallMax, true);

  // 战场
  drawField();

  // 尘埃
  if (state.dust) {
    for (const d of state.dust) {
      ctx.fillStyle = `rgba(255,220,180,${d.alpha})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 我方城墙
  drawWall(state.playerWallHp, state.playerWallMax, false);
  // 拖拽提示（可合成的目标）
  let dragHint = null;
  if (state.drag && state.drag.moved) {
    const du = state.drag.unit;
    dragHint = { type: du.type, level: du.level };
  }

  // 我方棋盘（拖拽中时高亮可合成目标）
  drawBoard(state.playerSlots, false, dragHint);

  // 拖拽取消提示（出棋盘时）
  if (state.drag && state.drag.moved) {
    const inBoard = slotAt(state.drag.x, state.drag.y, false) !== null;
    if (!inBoard) {
      ctx.fillStyle = 'rgba(255,80,60,0.12)';
      ctx.fillRect(0, LAYOUT.playerBoardY - 8, W, BOARD_H + 16);
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,80,60,0.7)';
      ctx.fillText('↩ 松手取消', W / 2, LAYOUT.playerBoardY + BOARD_H + 14);
    }
  }

  // 兵（画在棋盘之后，避免被格子遮盖）
  for (const s of state.playerSoldiers) drawSoldier(s);
  for (const s of state.enemySoldiers) drawSoldier(s);

  // 拖拽中的球
  if (state.drag) {
    const ball = state.drag.unit;
    const p = { x: state.drag.x, y: state.drag.y };
    ctx.save();
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 20;
    drawBall(ball, p.x, p.y, CELL * 0.42, 0);
    ctx.restore();
  }

  drawOverflowIndicator();
  drawHUD();
  drawProjectiles();
  drawAttackFx();
  drawRings();
  drawSpeedBtn();
  drawPauseBtn();
  drawHelpBtn();
  drawFx();

  // 暂停遮罩
  if (state.phase === 'paused') {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, W, H);
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = THEME.gold;
    ctx.fillText('⏸ 已暂停', W / 2, H / 2);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = THEME.textDim;
    ctx.fillText('点击 ▶ 继续', W / 2, H / 2 + 32);
  }
  ctx.restore();
}
