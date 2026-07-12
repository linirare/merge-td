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
        size = Math.min(Number(size) || 12, str.includes('克制') ? 12 : 10);
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

  // 上下墙前安全带，只做空间暗示，不放文字、不做大提示。
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  roundRect(x + 10, fy + 8, w - 20, 18, 10);
  ctx.fill();
  roundRect(x + 10, fy + fh - 26, w - 20, 18, 10);
  ctx.fill();
  ctx.restore();

  for (let c = 0; c < COLS; c++) {
    const lx = BOARD_X + c * (CELL + GAP) + CELL / 2;
    const st = state.laneStats?.[c];
    let laneColor = 'rgba(92,160,98,0.15)';
    let laneW = c === 2 ? 1.35 : 1.0;

    if (st?.status === 'enemy_adv' || st?.status === 'wall_danger') {
      laneColor = 'rgba(230,110,120,0.14)';
      laneW = 1.2;
    } else if (st?.status === 'player_adv' || st?.status === 'siege_ready') {
      laneColor = 'rgba(90,190,100,0.17)';
      laneW = 1.25;
    } else if (st?.status === 'clash') {
      laneColor = 'rgba(220,170,70,0.16)';
      laneW = 1.18;
    }

    ctx.save();
    ctx.strokeStyle = laneColor;
    ctx.lineWidth = laneW;
    ctx.beginPath();
    ctx.moveTo(lx, fy + 32);
    ctx.lineTo(lx, fy + fh - 32);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.strokeStyle = 'rgba(224,178,88,0.18)';
  ctx.setLineDash([7, 8]);
  ctx.lineWidth = 1.0;
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

  // HP 数字(审计#5:城墙血量应可见)
  ctx.fillStyle = isEnemy ? '#F4D7DC' : '#E7F8D9';
  ctx.font = 'bold 10px "Segoe UI","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(hp)}/${Math.round(maxHp)}`, x + w / 2, y + h + 14);

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
    : { main:'#35e66f', dark:'#116b35', hp:'#42f58a', glow:'rgba(83,255,130,0.34)', outline:'rgba(236,255,241,0.94)' };
}
function battleVisualYV59(s) {
  const topSafe = LAYOUT.fieldY + 10;
  const bottomSafe = LAYOUT.fieldY + LAYOUT.fieldH - 10;
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
    y: battleClampV59(baseY + oy, LAYOUT.fieldY + 10, LAYOUT.fieldY + LAYOUT.fieldH - 10),
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
  ctx.font = '700 10px sans-serif';
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
