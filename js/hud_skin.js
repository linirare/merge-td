/* ============================================================
   Fruit Assault - Clean HUD Skin v60
   Keeps existing hit areas and gameplay hooks; redraws the visual HUD only.
   ============================================================ */

function hudRoundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hudPanel(x, y, w, h, r, fill, stroke = 'rgba(122,78,8,.14)') {
  ctx.fillStyle = fill;
  hudRoundRect(x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  hudRoundRect(x + 0.5, y + 0.5, w - 1, h - 1, r);
  ctx.stroke();
}

function drawInfo() {
  if (state.phase !== 'playing' && state.phase !== 'paused') return;
  const mode = state.mode === 'pvp' ? 'PVP' : (state.endless ? `天梯 ${state.endlessWave || 1}` : `第 ${state.currentLevel || 1} 关`);
  const desc = state.mode === 'pvp'
    ? `房间 ${state.pvpRoomId || '----'}`
    : (state.levelConfig?.isBoss ? '深海 Boss' : '海域推进');
  const x = 18;
  const y = LAYOUT.enemyInfoY || 6;

  ctx.save();
  hudPanel(x, y, 148, 36, 4, 'rgba(19,19,20,.94)', 'rgba(151,126,86,.42)');
  ctx.fillStyle = '#D9CDB8';
  ctx.font = '800 13px "Microsoft YaHei",sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(mode, x + 11, y + 12);
  ctx.fillStyle = '#918474';
  ctx.font = '700 11px "Microsoft YaHei",sans-serif';
  ctx.fillText(desc, x + 11, y + 25);

  const elapsed = Math.floor(state.time || 0);
  hudPanel(W / 2 - 34, y, 68, 36, 4, 'rgba(19,19,20,.96)', 'rgba(151,126,86,.42)');
  ctx.fillStyle = '#D9CDB8';
  ctx.font = '800 13px "Nunito","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${elapsed}s`, W / 2, y + 18);
  ctx.restore();
}

function drawHUD() {
  if (state.phase !== 'playing' && state.phase !== 'paused') return;
  drawOperationResourceStripV61();
}

function nextActionCostV60() {
  if (typeof nextJuiceActionCost === 'function') return nextJuiceActionCost();
  return Math.max(1, Number(state.summonCostCounter || 1));
}

function drawOperationResourceStripV60() { return drawOperationResourceStripV61(); }
function getJuiceSpawnButtonRectV60() {
  const y = LAYOUT.operationY || (LAYOUT.playerWallY + LAYOUT.wallH + 16);
  const x = BOARD_X; const h = LAYOUT.operationH || 38; const w = BOARD_W;
  return { x: x + 132, y: y + 4, w: w - 133, h: h - 8 };
}
window.getJuiceSpawnButtonRectV60 = getJuiceSpawnButtonRectV60;
window.getJuiceSpawnButtonRectV60 = getJuiceSpawnButtonRectV60;

function drawOperationResourceStripV61() {
  const y = LAYOUT.operationY || (LAYOUT.playerWallY + LAYOUT.wallH + 16);
  const x = BOARD_X;
  const h = LAYOUT.operationH || 38;
  const w = BOARD_W;
  const cost = nextActionCostV60();
  const juice = Number(state.sp || 0);
  const canAct = juice >= cost;
  const pulse = Math.max(0, Math.min(1, Number(state._juicePulse || 0) / 0.50));
  const pulseKind = state._juicePulseKind || 'info';

  ctx.save();
  hudPanel(
    x,
    y,
    w,
    h,
    6,
    'rgba(18,20,19,.97)',
    pulseKind === 'lack' && pulse > 0 ? 'rgba(152,80,90,.82)' : 'rgba(151,126,86,.52)'
  );

  const juiceW = 112;
  const juiceFill = '#222320';
  ctx.fillStyle = juiceFill;
  hudRoundRect(x + 5, y + 5, juiceW, h - 10, 3);
  ctx.fill();
  if (pulse > 0) {
    ctx.globalAlpha = 0.20 * pulse;
    ctx.fillStyle = pulseKind === 'lack' ? '#98505A' : '#9A835D';
    hudRoundRect(x + 5, y + 5, juiceW, h - 10, 3);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '700 11px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = '#928675';
  ctx.fillText('潮汐能', x + 15, y + 14);
  ctx.font = '800 20px "Nunito","Microsoft YaHei",sans-serif';
  ctx.fillStyle = canAct ? '#E9DFC9' : '#9E9290';
  ctx.fillText(String(juice), x + 56, y + 21);

  const btn = getJuiceSpawnButtonRectV60();
  ctx.fillStyle = canAct ? '#B69557' : '#4A4640';
  hudRoundRect(btn.x, btn.y, btn.w, btn.h, 4);
  ctx.fill();
  ctx.strokeStyle = canAct ? '#D1B77F' : '#676159';
  ctx.lineWidth = 1;
  hudRoundRect(btn.x + 0.5, btn.y + 0.5, btn.w - 1, btn.h - 1, 4);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 15px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = canAct ? '#211D16' : '#A39B91';
  ctx.fillText('召唤海灵珠', btn.x + btn.w * 0.43, btn.y + btn.h / 2 + 1);

  const badgeW = 44;
  const badgeH = 22;
  const badgeX = btn.x + btn.w - badgeW - 8;
  const badgeY = btn.y + (btn.h - badgeH) / 2;
  ctx.fillStyle = canAct ? '#332A20' : '#302D2B';
  hudRoundRect(badgeX, badgeY, badgeW, badgeH, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(225,207,171,.25)';
  hudRoundRect(badgeX + 0.5, badgeY + 0.5, badgeW - 1, badgeH - 1, 3);
  ctx.stroke();
  ctx.font = '800 12px "Nunito","Microsoft YaHei",sans-serif';
  ctx.fillStyle = '#D9CDB8';
  ctx.fillText(`-${cost}`, badgeX + badgeW / 2, badgeY + badgeH / 2 + 0.5);

  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

function drawTopActionBarV60() {
  if (state.phase !== 'playing' && state.phase !== 'paused') return;
  const x = PAUSE_RECT.x - 8;
  const y = LAYOUT.topBarY || 6;
  const h = 34;
  const w = (SPEED_RECT.x + SPEED_RECT.w) - x;

  ctx.save();
  hudPanel(x, y, w, h, 10, 'rgba(255,255,255,.86)');

  function drawMiniButton(rect, label, strong = false) {
    const bx = rect.x;
    const by = y + 5;
    const bw = rect.w;
    const bh = h - 10;
    ctx.fillStyle = strong ? '#2C1B0E' : 'rgba(181,117,10,.12)';
    hudRoundRect(bx, by, bw, bh, 8);
    ctx.fill();
    ctx.fillStyle = strong ? '#FFE9A8' : '#B58A2E';
    ctx.font = '900 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + bw / 2, by + bh / 2 + 0.5);
  }

  drawMiniButton(PAUSE_RECT, state.phase === 'paused' ? '▶' : 'Ⅱ');
  drawMiniButton(HELP_RECT, '?');
  drawMiniButton(SPEED_RECT, `×${state.speed || 1}`, true);
  ctx.restore();
}

/* ---- Commercial HUD v2 ----------------------------------------------- */
function drawInfo() {
  if (state.phase !== 'playing' && state.phase !== 'paused') return;
  const x = 14, y = LAYOUT.enemyInfoY || 5;
  const level = state.currentLevel || 1;
  const elapsed = Math.floor(state.time || 0);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.42)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
  const plate = ctx.createLinearGradient(0,y,0,y+42);
  plate.addColorStop(0,'#284B72'); plate.addColorStop(1,'#102844');
  hudPanel(x,y,160,42,12,plate,'rgba(255,215,115,.78)');
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#FFD86F';
  ctx.beginPath(); ctx.arc(x+17,y+21,7,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#FFF7E5'; ctx.font = '900 15px "Microsoft YaHei",sans-serif';
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText(state.mode === 'pvp' ? 'PVP 竞技' : `第 ${level} 关`,x+31,y+14);
  ctx.fillStyle = '#93EBD9'; ctx.font = '800 10px "Microsoft YaHei",sans-serif';
  ctx.fillText(state.levelConfig?.isBoss ? 'BOSS 攻坚战' : '开放海域',x+31,y+30);

  const timer = ctx.createLinearGradient(0,y,0,y+42);
  timer.addColorStop(0,'#5B3A83'); timer.addColorStop(1,'#2A1E55');
  hudPanel(W/2-38,y,76,42,12,timer,'rgba(255,215,115,.78)');
  ctx.fillStyle='#FFF5D8'; ctx.font='900 16px "Nunito",sans-serif'; ctx.textAlign='center';
  ctx.fillText(`${elapsed}s`,W/2,y+21);
  ctx.restore();
  ctx.textBaseline='alphabetic';
}

function drawOperationResourceStripV61() {
  const y = LAYOUT.operationY || (LAYOUT.playerWallY + LAYOUT.wallH + 16);
  const x = BOARD_X, h = LAYOUT.operationH || 38, w = BOARD_W;
  const cost = nextActionCostV60();
  const juice = Number(state.sp || 0);
  const canAct = juice >= cost;
  const btn = getJuiceSpawnButtonRectV60();
  ctx.save();
  ctx.shadowColor='rgba(0,0,0,.52)'; ctx.shadowBlur=12; ctx.shadowOffsetY=5;
  const tray=ctx.createLinearGradient(0,y,0,y+h);
  tray.addColorStop(0,'#274F6A'); tray.addColorStop(1,'#0A2439');
  hudPanel(x,y,w,h,12,tray,'rgba(255,215,111,.76)');
  ctx.shadowBlur=0;

  const juiceGrad=ctx.createLinearGradient(0,y+4,0,y+h-4);
  juiceGrad.addColorStop(0,'#7C49C9'); juiceGrad.addColorStop(1,'#39206E');
  hudPanel(x+5,y+5,114,h-10,9,juiceGrad,'rgba(222,193,255,.50)');
  ctx.fillStyle='#E9D1FF'; ctx.beginPath(); ctx.arc(x+23,y+h/2,11,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#9B5EFF'; ctx.beginPath(); ctx.arc(x+23,y+h/2+2,7,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#FFF5FF'; ctx.beginPath(); ctx.arc(x+20,y+h/2-2,2.3,0,Math.PI*2); ctx.fill();
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillStyle='#EADFFF'; ctx.font='800 10px "Microsoft YaHei",sans-serif'; ctx.fillText('潮汐能',x+40,y+12);
  ctx.fillStyle='#FFFFFF'; ctx.font='900 20px "Nunito",sans-serif'; ctx.fillText(String(juice),x+72,y+26);

  const action=ctx.createLinearGradient(0,btn.y,0,btn.y+btn.h);
  if (canAct) { action.addColorStop(0,'#7AFADE'); action.addColorStop(.5,'#26DAB7'); action.addColorStop(1,'#0D9A91'); }
  else { action.addColorStop(0,'#6B7482'); action.addColorStop(1,'#3D4553'); }
  ctx.shadowColor=canAct?'rgba(46,237,194,.45)':'rgba(0,0,0,.25)'; ctx.shadowBlur=canAct?12:4;
  hudPanel(btn.x,btn.y,btn.w,btn.h,10,action,canAct?'#C6FFF0':'#87909A');
  ctx.shadowBlur=0;
  ctx.fillStyle=canAct?'#053F42':'#C0C5CB'; ctx.font='900 15px "Microsoft YaHei",sans-serif';
  ctx.textAlign='center'; ctx.fillText('召唤海灵伙伴',btn.x+btn.w*.43,btn.y+btn.h/2+1);

  const badgeX=btn.x+btn.w-49,badgeY=btn.y+5;
  hudPanel(badgeX,badgeY,42,btn.h-10,8,'rgba(6,30,43,.78)','rgba(255,255,255,.35)');
  ctx.fillStyle='#FFF2B0'; ctx.font='900 12px "Nunito",sans-serif';
  ctx.fillText(`-${cost}`,badgeX+21,badgeY+(btn.h-10)/2+1);
  ctx.restore();
  ctx.textBaseline='alphabetic';
}

// drawSpeedBtn/drawPauseBtn/drawHelpBtn → 已迁移至壳HUD(#battleShellHud)
