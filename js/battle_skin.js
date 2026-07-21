/* ============================================================
   水果突击 · Fruit Assault —— Final Battle Skin v59
   职责：战场、城墙、战斗单位。v59 收口战斗可读性：
   1) 不再画大面积危险遮罩；2) 单位尺寸降噪；
   3) 敌我轮廓更稳定；4) 血条按需显示；5) 伤害飘字限流。
   ============================================================ */

(function installBattleFxTuningV59() {
  if (window.__battleFxTuningV59 || typeof addFx !== 'function') return;
  window.__battleFxTuningV59 = true;
  const oldAddFx = addFx;
  addFx = function tunedAddFxV59(x, y, text, color, size) {
    if (state && state.phase === 'playing') {
      const str = String(text || '');
      const isDamage = /^-\d+/.test(str) || str.includes('克制') || str.includes('破城');
      const isPassiveJuice = str.includes('+1果汁');

      if (isDamage) {
        const now = Number(state.time || 0);
        state._battleFxBucketV59 = state._battleFxBucketV59 || { t: -99, n: 0 };
        if (now - state._battleFxBucketV59.t > 0.22) {
          state._battleFxBucketV59.t = now;
          state._battleFxBucketV59.n = 0;
        }
        state._battleFxBucketV59.n++;
        if (state._battleFxBucketV59.n > 3 && !str.includes('克制') && !str.includes('破城')) return;
        size = Math.min(Number(size) || 14, str.includes('克制') ? 16 : 12);
      }

      if (isPassiveJuice && typeof LAYOUT !== 'undefined') {
        x = BOARD_X + 36;
        y = (LAYOUT.operationY || y) - 6;
        size = 10;
      }
    }
    return oldAddFx(x, y, text, color, size);
  };
})();

function battleClampV59(v, a, b) { return Math.max(a, Math.min(b, v)); }

let _fieldGrad = null, _fieldFY = -1, _fieldFH = -1;
function drawField() {
  const fy = LAYOUT.fieldY;
  const fh = LAYOUT.fieldH;
  const x = 24;
  const w = W - 48;

  if (!_fieldGrad || _fieldFY !== fy || _fieldFH !== fh) {
    _fieldGrad = ctx.createLinearGradient(0, fy, 0, fy + fh);
    _fieldGrad.addColorStop(0, '#252326');
    _fieldGrad.addColorStop(0.48, '#202324');
    _fieldGrad.addColorStop(0.52, '#1E2321');
    _fieldGrad.addColorStop(1, '#202521');
    _fieldFY = fy; _fieldFH = fh;
  }
  ctx.save();
  ctx.globalAlpha = 0.38;
  ctx.fillStyle = '#000';
  roundRect(x + 2, fy + 4, w, fh, 8);
  ctx.fill();
  ctx.restore();
  drawPanel(x, fy, w, fh, 8, _fieldGrad, 'rgba(151,126,86,0.50)');
  ctx.save();
  ctx.strokeStyle = 'rgba(219,200,163,0.10)';
  ctx.lineWidth = 1;
  roundRect(x + 4, fy + 4, w - 8, fh - 8, 5);
  ctx.stroke();
  ctx.restore();

  // 敌我两端只是漆面色温变化，不使用亮色发光带。
  ctx.save();
  ctx.fillStyle = 'rgba(126,62,70,0.09)';
  ctx.fillRect(x + 6, fy + 6, w - 12, 24);
  ctx.fillStyle = 'rgba(72,108,85,0.09)';
  ctx.fillRect(x + 6, fy + fh - 30, w - 12, 24);
  ctx.strokeStyle = 'rgba(189,162,107,0.20)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 14, fy + 30); ctx.lineTo(x + w - 14, fy + 30);
  ctx.moveTo(x + 14, fy + fh - 30); ctx.lineTo(x + w - 14, fy + fh - 30);
  ctx.stroke();
  ctx.restore();

  const laneTop = fy + 30;
  const laneBottom = fy + fh - 30;
  const midY = fy + fh / 2;
  for (let c = 0; c < COLS; c++) {
    const lx = BOARD_X + c * (CELL + GAP) + CELL / 2;
    const st = state.laneStats?.[c];
    const enemyPressure = st && ['enemy_adv','wall_danger','enemy_push'].includes(st.status);
    const playerPressure = st && ['player_adv','siege_ready','player_push'].includes(st.status);
    const clash = st?.status === 'clash';

    if (enemyPressure || playerPressure || clash) {
      ctx.save();
      ctx.fillStyle = enemyPressure
        ? 'rgba(126,62,70,0.16)'
        : playerPressure
          ? 'rgba(72,108,85,0.15)'
          : 'rgba(154,128,82,0.10)';
      ctx.fillRect(lx - CELL * 0.34, laneTop, CELL * 0.68, laneBottom - laneTop);
      ctx.restore();
    }

    ctx.save();
    ctx.strokeStyle = c === 2 ? 'rgba(189,162,107,0.30)' : 'rgba(213,199,171,0.11)';
    ctx.lineWidth = c === 2 ? 1.2 : 0.8;
    ctx.beginPath();
    ctx.moveTo(lx, laneTop + 8);
    ctx.lineTo(lx, laneBottom - 8);
    ctx.stroke();

    // 状态只用一枚克制的推进箭头，不再画整条霓虹线与圆点。
    if (enemyPressure || playerPressure) {
      const ay = enemyPressure ? laneBottom - 12 : laneTop + 12;
      const dir = enemyPressure ? 1 : -1;
      ctx.strokeStyle = enemyPressure ? '#98505A' : '#64846F';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(lx - 4, ay - dir * 3);
      ctx.lineTo(lx, ay + dir * 2);
      ctx.lineTo(lx + 4, ay - dir * 3);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 中线像战棋桌上的铜制分界条：双细线 + 单个菱形定位点。
  ctx.save();
  ctx.strokeStyle = 'rgba(189,162,107,0.34)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 18, midY - 2); ctx.lineTo(x + w - 18, midY - 2);
  ctx.moveTo(x + 18, midY + 2); ctx.lineTo(x + w - 18, midY + 2);
  ctx.stroke();
  ctx.fillStyle = '#9A835D';
  ctx.translate(W / 2, midY);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-4, -4, 8, 8);
  ctx.restore();
}

function drawWall(hp, maxHp, isEnemy) {
  const ratio = clamp01(hp / Math.max(1, maxHp));
  const x = BOARD_X;
  const y = isEnemy ? LAYOUT.enemyWallY : LAYOUT.playerWallY;
  const w = BOARD_W;
  const h = LAYOUT.wallH;
  const cfg = isEnemy
    ? { body:'#6F3B42', dark:'#2A2022', trim:'#A47473', hp:'#98505A', hpBg:'rgba(0,0,0,0.62)' }
    : { body:'#3D604C', dark:'#202923', trim:'#78917E', hp:'#64846F', hpBg:'rgba(0,0,0,0.62)' };

  ctx.save();
  ctx.globalAlpha = 0.13;
  ctx.fillStyle = '#000';
  roundRect(x + 2, y + 4, w, h, 4);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = cfg.dark;
  roundRect(x, y, w, h, 4);
  ctx.fill();
  ctx.fillStyle = cfg.body;
  roundRect(x + 2, y + 2, w - 4, h - 5, 3);
  ctx.fill();
  ctx.fillStyle = cfg.trim;
  ctx.fillRect(x + 5, y + 3, w - 10, 2);
  ctx.fill();

  const segW = 18, gap = 6;
  const count = Math.floor((w - 18) / (segW + gap));
  for (let i = 0; i < count; i++) {
    const sx = x + 9 + i * (segW + gap);
    ctx.fillStyle = cfg.dark;
    roundRect(sx, y - 3, segW, 5, 1.5);
    ctx.fill();
    ctx.fillStyle = cfg.trim;
    ctx.fillRect(sx + 1.5, y - 2.2, segW - 3, 2.2);
    ctx.fill();
  }

  const bx = x + 26, by = y + 8, bw = w - 52, bh = 7;
  ctx.fillStyle = cfg.hpBg;
  roundRect(bx, by, bw, bh, 2);
  ctx.fill();
  ctx.fillStyle = cfg.hp;
  roundRect(bx + 1, by + 1, Math.max(4, (bw - 2) * ratio), bh - 2, 1.5);
  ctx.fill();

  // HP 数字 — 直接画在城墙表面
  const hpText = `${Math.round(hp)}/${Math.round(maxHp)}`;
  const cx = x + w / 2;
  ctx.font = 'bold 13px "Nunito","Segoe UI","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#E6DDCA';
  ctx.fillText(hpText, cx, y + h / 2);
  ctx.textBaseline = 'alphabetic';

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

function battleUnitTierKeyV59(s) {
  const lv = s.level || 1;
  if (lv <= 2) return 'small';
  if (lv <= 4) return 'large';
  if (lv === 5) return 'elite';
  if (lv === 6) return 'advanced';
  return 'legendary';
}
function battleUnitTierScaleV59(tier) {
  return ({ small:0.82, large:0.96, elite:1.12, advanced:1.30, legendary:1.48 })[tier] || 1;
}
function battleUnitRoleScaleV59(type) {
  const role = TYPES[type]?.role;
  if (role === 'shell') return 1.09;
  if (role === 'spike') return 1.04;
  if (role === 'raider') return 0.96;
  if (role === 'shooter') return 0.92;
  if (role === 'wildcard') return 0.90;
  return 1;
}
function battleUnitStyleV59(side) {
  return side === 'enemy'
    ? { main:'#ff4f64', dark:'#8d1c2e', hp:'#ff506a', glow:'rgba(255,70,92,0.38)', outline:'rgba(255,235,238,0.92)' }
    : { main:'#D4A843', dark:'#5E3A12', hp:'#F5C242', glow:'rgba(245,194,66,0.30)', outline:'rgba(255,250,235,0.94)' };
}
function battleVisualYV59(s) {
  const sieging = s && (s.mode === 'siege' || s.mode === 'siege_queue' || s.mode === 'siege_support');
  const topSafe = LAYOUT.fieldY + (sieging ? 10 : 18);
  const bottomSafe = LAYOUT.fieldY + LAYOUT.fieldH - (sieging ? 10 : 42);
  return battleClampV59(s.y, topSafe, bottomSafe);
}
function battleHashV59(s) {
  const id = String(s.id || `${s.side}:${s.type}:${s.laneIndex}:${Math.round(s.x || 0)}:${Math.round(s.y || 0)}`);
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function battleVisualPosV59(s, r) {
  const baseY = battleVisualYV59(s);
  if (s.mode === 'siege' || s.mode === 'siege_queue') return { x: s.x, y: baseY };
  const h = battleHashV59(s);
  const ox = ((h % 5) - 2) * Math.min(8, Math.max(3, r * 0.18));
  const oy = ((Math.floor(h / 5) % 3) - 1) * Math.min(4.5, Math.max(1.5, r * 0.10));
  return {
    x: battleClampV59(s.x + ox, 26 + r, W - 26 - r),
    y: battleClampV59(baseY + oy, LAYOUT.fieldY + 18, LAYOUT.fieldY + LAYOUT.fieldH - 42),
  };
}

function drawSoldier(s) {
  if (!s || !s.alive) return;
  const t = TYPES[s.type] || TYPES[DEFAULT_DECK[0]];
  const tier = battleUnitTierKeyV59(s);
  const st = battleUnitStyleV59(s.side);
  const baseY = battleVisualYV59(s);
  const depth = 0.76 + 0.22 * ((baseY - LAYOUT.fieldY) / LAYOUT.fieldH);
  const r = (13 + (s.level || 1) * 1.18) * depth * battleUnitTierScaleV59(tier) * battleUnitRoleScaleV59(s.type);
  const vis = battleVisualPosV59(s, r);
  const isEnemy = s.side === 'enemy';

  ctx.save();

  // 敌我轮廓：稳定、轻量，不再靠大面积遮罩区分。
  ctx.shadowColor = st.glow;
  ctx.shadowBlur = tier === 'legendary' ? 11 : tier === 'advanced' ? 9 : tier === 'elite' ? 7 : 4;
  ctx.strokeStyle = st.main;
  ctx.lineWidth = tier === 'legendary' ? 3.7 : tier === 'advanced' ? 3.2 : 2.5;
  if (isEnemy) {
    ctx.beginPath();
    ctx.moveTo(vis.x, vis.y - r * 1.02);
    ctx.lineTo(vis.x + r * 1.18, vis.y + r * 0.12);
    ctx.lineTo(vis.x, vis.y + r * 1.04);
    ctx.lineTo(vis.x - r * 1.18, vis.y + r * 0.12);
    ctx.closePath();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.ellipse(vis.x, vis.y + r * 0.24, r * 1.12, r * 0.56, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(0,0,0,0.20)';
  ctx.beginPath();
  ctx.ellipse(vis.x, vis.y + r + 7, r * 0.88, 4.2 + r * 0.045, 0, 0, Math.PI * 2);
  ctx.fill();

  const bodyW = r * 1.04;
  const bodyH = r * 1.10;
  ctx.fillStyle = s.hitFlash > 0 ? '#ffffff' : st.main;
  ctx.strokeStyle = st.outline;
  ctx.lineWidth = Math.max(1.8, r * 0.09);
  roundRect(vis.x - bodyW / 2, vis.y - r * 0.02, bodyW, bodyH, Math.max(6, r * 0.22));
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = t.color || st.main;
  ctx.beginPath();
  ctx.arc(vis.x, vis.y - r * 0.38, r * 0.68, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = isEnemy ? '#ff425a' : '#20c85d';
  ctx.lineWidth = Math.max(2.0, r * 0.10);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(r * 0.78)}px sans-serif`;
  ctx.fillStyle = '#fff';
  ctx.fillText(t.icon, vis.x, vis.y - r * 0.38);

  if (s._boss) drawBossBadgeV59(s, vis.x, vis.y - r - 30, Math.max(86, r * 2.8));
  drawBattleUnitHpV59(s, vis.x, vis.y - r - 10, Math.max(24, r * 1.75));

  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

function drawBossBadgeV59(s, x, y, w) {
  const ratio = clamp01(s.hp / Math.max(1, s.maxHp));
  ctx.save();
  ctx.shadowColor = 'rgba(226,59,78,.42)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = 'rgba(70,16,24,.88)';
  ctx.strokeStyle = '#FFE9A8';
  ctx.lineWidth = 1.6;
  roundRect(x - w / 2, y, w, 18, 8);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#F06B79';
  roundRect(x - w / 2 + 4, y + 13, Math.max(4, (w - 8) * ratio), 3.2, 2);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 12px sans-serif';
  ctx.fillStyle = '#FFE9A8';
  ctx.fillText(s.name || 'BOSS', x, y + 8.5);
  ctx.restore();
}

function drawBattleUnitHpV59(s, x, y, w) {
  const ratio = clamp01(s.hp / Math.max(1, s.maxHp));
  const showHp = ratio < 0.985 || (s.hitFlash || 0) > 0.02 || (s.shield || 0) > 0;
  if (!showHp) return;
  const st = battleUnitStyleV59(s.side);
  ctx.save();
  ctx.globalAlpha = ratio < 0.985 ? 0.96 : 0.72;
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  roundRect(x - w / 2, y, w, 4.5, 3);
  ctx.fill();
  ctx.fillStyle = st.hp;
  roundRect(x - w / 2 + 1, y + 1, Math.max(2, (w - 2) * ratio), 2.5, 2);
  ctx.fill();
  if ((s.shield || 0) > 0) {
    const sr = clamp01(s.shield / Math.max(1, s.maxShield || s.maxHp * 0.45));
    ctx.fillStyle = '#72c4ff';
    roundRect(x - w / 2, y - 3.5, w * sr, 2.5, 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ---- Commercial orchard arena v2 -------------------------------------- */
function drawField() {
  const fy = LAYOUT.fieldY;
  const fh = LAYOUT.fieldH;
  const x = 18;
  const w = W - 36;
  const midY = fy + fh / 2;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.55)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  const stone = ctx.createLinearGradient(0, fy, 0, fy + fh);
  stone.addColorStop(0, '#FFE19A');
  stone.addColorStop(.035, '#B9773E');
  stone.addColorStop(.07, '#183A4A');
  stone.addColorStop(.94, '#102C38');
  stone.addColorStop(.975, '#8B5B35');
  stone.addColorStop(1, '#FFD37A');
  drawPanel(x, fy, w, fh, 18, stone, 'rgba(255,231,158,.76)');
  ctx.restore();

  const grass = ctx.createLinearGradient(0, fy + 10, 0, fy + fh - 10);
  grass.addColorStop(0, '#1E7A68');
  grass.addColorStop(.42, '#176658');
  grass.addColorStop(.58, '#155D55');
  grass.addColorStop(1, '#0F564D');
  drawPanel(x + 8, fy + 10, w - 16, fh - 20, 13, grass, 'rgba(173,255,220,.18)');

  const laneTop = fy + 28;
  const laneBottom = fy + fh - 28;
  for (let c = 0; c < COLS; c++) {
    const lx = BOARD_X + c * (CELL + GAP) + CELL / 2;
    const st = state.laneStats?.[c];
    const enemyPressure = st && ['enemy_adv','wall_danger','enemy_push'].includes(st.status);
    const playerPressure = st && ['player_adv','siege_ready','player_push'].includes(st.status);
    const active = enemyPressure || playerPressure || st?.status === 'clash';
    ctx.save();
    const lane = ctx.createLinearGradient(lx - CELL * .33, 0, lx + CELL * .33, 0);
    lane.addColorStop(0, 'rgba(255,255,255,0)');
    lane.addColorStop(.18, active ? (enemyPressure ? 'rgba(255,72,112,.20)' : 'rgba(64,239,197,.18)') : 'rgba(190,255,218,.08)');
    lane.addColorStop(.5, active ? (enemyPressure ? 'rgba(255,72,112,.28)' : 'rgba(64,239,197,.25)') : 'rgba(238,255,221,.13)');
    lane.addColorStop(.82, active ? (enemyPressure ? 'rgba(255,72,112,.20)' : 'rgba(64,239,197,.18)') : 'rgba(190,255,218,.08)');
    lane.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = lane;
    ctx.fillRect(lx - CELL * .34, laneTop, CELL * .68, laneBottom - laneTop);

    ctx.strokeStyle = active ? (enemyPressure ? '#FF6A8C' : '#57EBC4') : 'rgba(223,255,226,.18)';
    ctx.lineWidth = active ? 2 : 1;
    ctx.setLineDash(active ? [] : [3, 7]);
    ctx.beginPath(); ctx.moveTo(lx, laneTop + 8); ctx.lineTo(lx, laneBottom - 8); ctx.stroke();
    ctx.setLineDash([]);

    const dir = enemyPressure ? 1 : -1;
    const ay = enemyPressure ? laneBottom - 16 : laneTop + 16;
    ctx.fillStyle = enemyPressure ? '#FF6A8C' : '#79F0C9';
    ctx.beginPath();
    ctx.moveTo(lx, ay + dir * 6); ctx.lineTo(lx - 5, ay - dir * 2); ctx.lineTo(lx + 5, ay - dir * 2); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.strokeStyle = 'rgba(255,220,125,.78)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + 22, midY); ctx.lineTo(x + w - 22, midY); ctx.stroke();
  ctx.fillStyle = '#FFD66B';
  ctx.strokeStyle = '#7D4E24';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(W / 2, midY, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#245E55';
  ctx.beginPath();
  ctx.moveTo(W/2, midY-7); ctx.lineTo(W/2+7, midY); ctx.lineTo(W/2, midY+7); ctx.lineTo(W/2-7, midY); ctx.closePath(); ctx.fill();
  ctx.restore();

  // Clean foreground foliage silhouettes add world depth without noisy texture.
  ctx.save();
  ctx.fillStyle = 'rgba(8,54,45,.76)';
  for (const [bx, by, br] of [[27,fy+34,16],[W-25,fy+52,18],[24,fy+fh-38,18],[W-28,fy+fh-34,15]]) {
    ctx.beginPath(); ctx.arc(bx,by,br,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(bx+br*.65,by+3,br*.7,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

function drawWall(hp, maxHp, isEnemy) {
  const ratio = clamp01(hp / Math.max(1, maxHp));
  const x = BOARD_X;
  const y = isEnemy ? LAYOUT.enemyWallY : LAYOUT.playerWallY;
  const w = BOARD_W;
  const h = LAYOUT.wallH;
  const team = typeof commercialTeamV2 === 'function' ? commercialTeamV2(isEnemy) : (isEnemy
    ? {main:'#F04D72',deep:'#6E173D',trim:'#FFD37A'}
    : {main:'#2ED6B4',deep:'#075C68',trim:'#FFD37A'});

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.52)'; ctx.shadowBlur = 9; ctx.shadowOffsetY = 5;
  const body = ctx.createLinearGradient(0, y - 6, 0, y + h + 4);
  body.addColorStop(0, team.trim);
  body.addColorStop(.20, team.main);
  body.addColorStop(.55, team.deep);
  body.addColorStop(1, '#081923');
  ctx.fillStyle = body;
  roundRect(x, y - 2, w, h + 4, 7); ctx.fill();
  ctx.strokeStyle = '#FFE7A4'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.shadowBlur = 0;

  for (const tx of [x + 4, x + w - 26]) {
    ctx.fillStyle = team.deep;
    roundRect(tx, y - 8, 22, h + 10, 5); ctx.fill();
    ctx.strokeStyle = team.trim; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = team.main;
    for (let i = 0; i < 3; i++) ctx.fillRect(tx + 2 + i * 7, y - 12, 5, 6);
  }

  const bx = x + 34, by = y + 5, bw = w - 68, bh = 8;
  ctx.fillStyle = 'rgba(2,10,18,.72)'; roundRect(bx, by, bw, bh, 4); ctx.fill();
  const hpGrad = ctx.createLinearGradient(bx,0,bx+bw,0);
  hpGrad.addColorStop(0, ratio > .35 ? '#FFF07C' : '#FF704F');
  hpGrad.addColorStop(1, ratio > .35 ? team.glow || team.main : '#FF3E67');
  ctx.fillStyle = hpGrad; roundRect(bx + 1, by + 1, Math.max(5, (bw - 2) * ratio), bh - 2, 3); ctx.fill();
  ctx.fillStyle = '#FFF8DF'; ctx.font = '900 13px "Nunito",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(hp)}/${Math.round(maxHp)}`, W / 2, y + h / 2 + 1);
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}
