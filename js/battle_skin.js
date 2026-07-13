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
    _fieldGrad.addColorStop(0, 'rgba(246,231,188,0.98)');
    _fieldGrad.addColorStop(0.50, 'rgba(238,221,172,0.94)');
    _fieldGrad.addColorStop(1, 'rgba(232,207,143,0.96)');
    _fieldFY = fy; _fieldFH = fh;
  }
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#5b3618';
  roundRect(x + 3, fy + 5, w, fh, 16);
  ctx.fill();
  ctx.restore();
  drawPanel(x, fy, w, fh, 16, _fieldGrad, 'rgba(167,126,50,0.48)');
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.58)';
  ctx.lineWidth = 1.2;
  roundRect(x + 1, fy + 1, w - 2, fh - 2, 15);
  ctx.stroke();
  ctx.restore();

  // 上下墙前安全带，只做空间暗示，不放文字、不做大提示。
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  roundRect(x + 10, fy + 8, w - 20, 18, 10);
  ctx.fill();
  roundRect(x + 10, fy + fh - 26, w - 20, 18, 10);
  ctx.fill();
  ctx.restore();

  const laneTop = fy + 32;
  const laneBottom = fy + fh - 34;
  const laneH = laneBottom - laneTop;
  ctx.save();
  for (let c = 0; c < COLS; c++) {
    const lx = BOARD_X + c * (CELL + GAP) + CELL / 2;
    const lanePanelW = CELL * 0.72;
    ctx.fillStyle = c % 2 === 0 ? 'rgba(255,255,255,0.065)' : 'rgba(149,104,36,0.045)';
    roundRect(lx - lanePanelW / 2, laneTop, lanePanelW, laneH, 12);
    ctx.fill();
  }
  ctx.restore();

  for (let c = 0; c < COLS; c++) {
    const lx = BOARD_X + c * (CELL + GAP) + CELL / 2;
    const st = state.laneStats?.[c];
    let laneColor = 'rgba(136,91,26,0.18)';
    let laneW = c === 2 ? 1.45 : 1.05;

    if (st?.status === 'enemy_adv' || st?.status === 'wall_danger') {
      laneColor = 'rgba(212,65,85,0.26)';
      laneW = 1.8;
    } else if (st?.status === 'player_adv' || st?.status === 'siege_ready') {
      laneColor = 'rgba(39,159,95,0.23)';
      laneW = 1.7;
    } else if (st?.status === 'clash') {
      laneColor = 'rgba(206,139,42,0.26)';
      laneW = 1.65;
    }

    ctx.save();
    ctx.strokeStyle = laneColor;
    ctx.lineWidth = laneW;
    ctx.beginPath();
    ctx.moveTo(lx, laneTop);
    ctx.lineTo(lx, laneBottom);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  const midY = fy + fh / 2;
  const midGrad = ctx.createLinearGradient(x + 18, midY, x + w - 18, midY);
  midGrad.addColorStop(0, 'rgba(255,255,255,0.02)');
  midGrad.addColorStop(0.5, 'rgba(120,75,18,0.30)');
  midGrad.addColorStop(1, 'rgba(255,255,255,0.02)');
  ctx.strokeStyle = midGrad;
  ctx.setLineDash([7, 8]);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x + 18, midY);
  ctx.lineTo(x + w - 18, midY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(122,78,20,0.09)';
  roundRect(x + 34, midY - 19, w - 68, 38, 19);
  ctx.fill();
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
    : { body:'#E8C76A', dark:'#B58A2E', trim:'#FFF6DE', hp:'#FDE79A', hpBg:'rgba(90,55,15,0.46)' };

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

  // HP 数字 — 直接画在城墙表面
  const hpText = `${Math.round(hp)}/${Math.round(maxHp)}`;
  const cx = x + w / 2;
  ctx.font = 'bold 13px "Nunito","Segoe UI","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = 'rgba(0,0,0,0.65)';
  ctx.lineWidth = 3;
  ctx.strokeText(hpText, cx, y + h / 2);
  ctx.fillStyle = '#fff';
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
  if (role === 'tank') return 1.09;
  if (role === 'front') return 1.04;
  if (role === 'siege') return 1.05;
  if (role === 'rush') return 0.96;
  if (role === 'back') return 0.92;
  if (role === 'support' || role === 'control') return 0.90;
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
