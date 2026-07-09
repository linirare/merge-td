/* ============================================================
   合成攻城 · 战斗表现补丁
   五路推进 / 路线状态 / 攻城位 / 拖拽意图提示。
   ============================================================ */

function drawBoard(slots, isEnemy, dragHint = null) {
  const by = isEnemy ? LAYOUT.enemyBoardY : LAYOUT.playerBoardY;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = BOARD_X + c * (CELL + GAP);
      const y = by + r * (CELL + GAP);
      const ball = slots[r][c];
      const isSnap = !isEnemy && state.drag?.nearestSnap && state.drag.nearestSnap.r === r && state.drag.nearestSnap.c === c;
      const action = isSnap ? state.drag.snapAction : '';
      const canMerge = state.drag && ball && !isEnemy && state.drag.unit.type === ball.type && state.drag.unit.level === ball.level && ball.level < MAX_LEVEL;
      const isEmptyTarget = state.drag && !ball && !isEnemy;

      let bg = (r + c) % 2 === 0 ? 'rgba(255,235,180,0.05)' : 'rgba(255,235,180,0.09)';
      if (canMerge) bg = 'rgba(255,228,90,0.12)';
      if (isEmptyTarget) bg = 'rgba(105,236,118,0.07)';
      if (isSnap && action === 'swap') bg = 'rgba(91,185,255,0.11)';
      if (isSnap && action === 'merge') bg = 'rgba(255,228,90,0.20)';
      if (state.pendingPlace && !ball && !isEnemy) bg = 'rgba(255,228,90,0.08)';

      ctx.fillStyle = bg;
      roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 8);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,228,90,0.10)';
      ctx.lineWidth = 1;
      roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 8);
      ctx.stroke();

      if (canMerge) {
        ctx.strokeStyle = 'rgba(255,228,90,0.52)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        roundRect(x + 4, y + 4, CELL - 8, CELL - 8, 8);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (ball) {
        ctx.save();
        if (isEnemy) ctx.globalAlpha = 0.72;
        drawBall(ball, x + CELL / 2, y + CELL / 2, CELL * 0.38);
        ctx.restore();
      }

      if (state.pendingPlace && !ball && !isEnemy) {
        ctx.strokeStyle = 'rgba(255,228,90,0.42)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 8);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (isSnap && !isEnemy) {
        const color = action === 'merge' ? THEME.gold : action === 'move' ? THEME.safe : THEME.info;
        ctx.shadowColor = color;
        ctx.shadowBlur = 18;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 8);
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = color;
        const label = action === 'merge' ? '合成' : action === 'move' ? '移动' : '交换';
        ctx.fillText(label, x + CELL / 2, y + CELL - 6);
      }
    }
  }
}

function drawField() {
  const fy = LAYOUT.fieldY;
  const fh = LAYOUT.fieldH;
  const x = 22;
  const w = W - 44;
  const g = ctx.createLinearGradient(0, fy, 0, fy + fh);
  g.addColorStop(0, 'rgba(102,52,34,0.44)');
  g.addColorStop(0.48, 'rgba(54,40,28,0.38)');
  g.addColorStop(1, 'rgba(42,80,44,0.40)');
  drawPanel(x, fy, w, fh, 16, g, 'rgba(255,228,125,0.14)');

  for (let c = 0; c < COLS; c++) {
    const lx = BOARD_X + c * (CELL + GAP) + CELL / 2;
    const st = state.laneStats?.[c];
    let laneColor = 'rgba(255,225,150,0.16)';
    if (st?.status === 'enemy_adv' || st?.status === 'wall_danger') laneColor = 'rgba(255,94,70,0.42)';
    else if (st?.status === 'player_adv' || st?.status === 'siege_ready') laneColor = 'rgba(105,236,118,0.36)';
    else if (st?.status === 'clash') laneColor = 'rgba(255,228,90,0.30)';

    if (st?.danger > 38) {
      ctx.fillStyle = 'rgba(255,75,55,0.08)';
      roundRect(lx - 26, fy + 10, 52, fh - 20, 12);
      ctx.fill();
    }

    ctx.strokeStyle = laneColor;
    ctx.lineWidth = c === 2 ? 2.2 : 1.5;
    ctx.beginPath();
    ctx.moveTo(lx, fy + 14);
    ctx.lineTo(lx, fy + fh - 14);
    ctx.stroke();

    // 攻城位：每路最多 3 个同时打墙。
    const slotN = typeof SIEGE_SLOTS_PER_LANE === 'number' ? SIEGE_SLOTS_PER_LANE : 3;
    for (let i = 0; i < slotN; i++) {
      const off = (i - (slotN - 1) / 2) * 13;
      ctx.strokeStyle = 'rgba(255,228,90,0.20)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(lx + off, LAYOUT.enemyWallY + LAYOUT.wallH + 4, 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(lx + off, LAYOUT.playerWallY - 4, 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (st && st.pressureText) {
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = laneColor;
      ctx.fillText(st.pressureText, lx, fy + fh / 2 - 8);
    }
  }

  ctx.strokeStyle = 'rgba(255,228,90,0.32)';
  ctx.setLineDash([8, 7]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 18, fy + fh / 2);
  ctx.lineTo(x + w - 18, fy + fh / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,116,92,0.90)';
  ctx.fillText('敌军向下推进', W / 2, fy + 18);
  ctx.fillStyle = 'rgba(105,236,118,0.90)';
  ctx.fillText('我方向上攻城', W / 2, fy + fh - 8);

  for (const alert of state.laneAlerts || []) {
    const lx = BOARD_X + alert.lane * (CELL + GAP) + CELL / 2;
    const a = Math.max(0, alert.life / alert.maxLife);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(255,80,55,0.16)';
    roundRect(lx - 29, fy + 6, 58, fh - 12, 14);
    ctx.fill();
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff8a68';
    ctx.fillText(alert.text, lx, LAYOUT.playerWallY - 20);
    ctx.restore();
  }
}

function drawSoldier(s) {
  const t = TYPES[s.type];
  const fy = LAYOUT.fieldY, fh = LAYOUT.fieldH;
  const depthFactor = 0.78 + 0.25 * ((s.y - fy) / fh);
  const r = (9 + s.level * 1.6) * depthFactor;
  const body = s.side === 'enemy' ? '#a53c33' : '#2f9b55';
  const facing = s.side === 'player' ? -1 : 1;

  ctx.save();

  if (s.protected || s.mode === 'deploy') {
    ctx.strokeStyle = s.side === 'player' ? 'rgba(105,236,118,0.42)' : 'rgba(255,116,92,0.42)';
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(s.x, s.y + r * 0.10, r + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (s.mode === 'fight') {
    ctx.strokeStyle = s.side === 'player' ? 'rgba(105,236,118,0.65)' : 'rgba(255,116,92,0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.x, s.y + r * 0.12, r + 5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (s.mode === 'backline') {
    ctx.strokeStyle = 'rgba(91,185,255,0.58)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.x, s.y + r * 0.12, r + 5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (s.mode === 'siege') {
    ctx.strokeStyle = 'rgba(255,228,90,0.78)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.x, s.y + r * 0.12, r + 5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (s.mode === 'siege_queue') {
    ctx.strokeStyle = 'rgba(255,228,90,0.34)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(s.x, s.y + r * 0.12, r + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(s.x, s.y + r + 4, r * 0.9, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();

  if (s.hitFlash > 0) {
    ctx.fillStyle = '#ff2f1f';
    ctx.shadowColor = '#ff2f1f';
    ctx.shadowBlur = 8;
  } else {
    ctx.fillStyle = body;
  }
  roundRect(s.x - r * 0.62, s.y - r * 0.10, r * 1.24, r * 1.25, 6);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = t.color;
  ctx.beginPath();
  ctx.arc(s.x, s.y - r * 0.35, r * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = s.side === 'enemy' ? '#ff8a75' : '#98ff9f';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.font = `${Math.round(r * 0.86)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(t.icon, s.x, s.y - r * 0.36);

  ctx.fillStyle = s.side === 'player' ? 'rgba(130,255,140,0.85)' : 'rgba(255,140,112,0.85)';
  ctx.beginPath();
  ctx.moveTo(s.x, s.y + facing * r * 1.35);
  ctx.lineTo(s.x - 4, s.y + facing * r * 0.95);
  ctx.lineTo(s.x + 4, s.y + facing * r * 0.95);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(0,0,0,0.48)';
  ctx.beginPath();
  ctx.arc(s.x + r * 0.72, s.y + r * 0.20, r * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `bold ${Math.round(r * 0.48)}px sans-serif`;
  ctx.fillStyle = THEME.gold;
  ctx.fillText(s.level, s.x + r * 0.72, s.y + r * 0.21);

  if (s.hp < s.maxHp) {
    const bw = r * 2.25, bh = 4;
    const bx = s.x - bw / 2, by = s.y - r - 9;
    ctx.fillStyle = 'rgba(0,0,0,0.58)';
    roundRect(bx, by, bw, bh, 2);
    ctx.fill();
    ctx.fillStyle = s.hp / s.maxHp > 0.5 ? THEME.safe : s.hp / s.maxHp > 0.25 ? '#ffd24a' : '#ff5a3a';
    roundRect(bx, by, bw * clamp01(s.hp / s.maxHp), bh, 2);
    ctx.fill();
  }

  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}