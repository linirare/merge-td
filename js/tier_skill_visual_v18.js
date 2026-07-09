/* ============================================================
   水果突击 · Tier & Skill Visual v18
   1) 进一步拉大兵等级体型差异；2) 增加技能前端识别层。
   不显示技能名/兵种名/兵阶文字；只用体型、光环、图形符号、特效读信息。
   Loaded after skill_system_v17.js.
   ============================================================ */

(function installTierSkillVisualV18() {
  patchTierScaleV18();
  patchSkillVisualDrawV18();
})();

function patchTierScaleV18() {
  // unit_minimal_ui_fix.js 会在每次绘制时动态调用 tierVisualScale，覆盖这里即可放大体型差。
  tierVisualScale = function tierVisualScaleV18(tier) {
    return ({
      small: 0.74,
      large: 1.08,
      elite: 1.48,
      advanced: 1.88,
      legendary: 2.36,
    })[tier] || 1.0;
  };

  tierVisualColor = function tierVisualColorV18(tier) {
    return ({
      small: '#dfffad',
      large: '#8ee5ff',
      elite: '#ffd84a',
      advanced: '#ff8fb8',
      legendary: '#fff176',
    })[tier] || THEME.gold;
  };
}

const SKILL_VISUAL_V18 = {
  watermelon_guard: { color:'#53e77b', icon:'shield' },
  grape_archer: { color:'#b076ff', icon:'volley' },
  banana_raider: { color:'#ffd24a', icon:'dash' },
  pineapple_lancer: { color:'#ffb547', icon:'lance' },
  orange_cannon: { color:'#ff9a35', icon:'cannon' },
};

function patchSkillVisualDrawV18() {
  if (typeof draw !== 'function' || draw._tierSkillVisualV18) return;
  const oldDraw = draw;
  draw = function drawTierSkillVisualV18() {
    oldDraw();
    drawSkillVisualLayerV18();
  };
  draw._tierSkillVisualV18 = true;
}

function skillRankForVisualV18(s) {
  if (typeof skillRankV17 === 'function') return skillRankV17(s.level || 1);
  const lv = s.level || 1;
  if (lv < 4) return 0;
  if (lv === 4) return 1;
  if (lv === 5) return 2;
  if (lv === 6) return 3;
  return 4;
}
function visualTierKeyV18(s) {
  if (typeof minimalTierKey === 'function') return minimalTierKey(s);
  const lv = s.level || 1;
  if (lv <= 2) return 'small';
  if (lv <= 4) return 'large';
  if (lv === 5) return 'elite';
  if (lv === 6) return 'advanced';
  return 'legendary';
}
function visualDepthV18(s) {
  return 0.78 + 0.25 * ((s.y - LAYOUT.fieldY) / LAYOUT.fieldH);
}
function visualRoleScaleV18(type) {
  if (typeof roleVisualScale === 'function') return roleVisualScale(type);
  return 1;
}
function visualRadiusV18(s) {
  const tier = visualTierKeyV18(s);
  const scale = tierVisualScale(tier) * visualRoleScaleV18(s.type);
  return (15 + (s.level || 1) * 1.45) * visualDepthV18(s) * scale;
}
function skillReadyRatioV18(s) {
  const rank = skillRankForVisualV18(s);
  if (rank <= 0) return 0;
  if (s.type === 'watermelon_guard') {
    const full = [0,6.0,5.7,5.4,5.0][rank] || 6.0;
    return 1 - clamp01((s.skillTimer || 0) / full);
  }
  if (s.type === 'banana_raider') {
    const full = Math.max(4.8, 8.0 - rank * 0.45);
    return 1 - clamp01((s.skillCd || 0) / full);
  }
  if (s.type === 'pineapple_lancer') {
    const full = Math.max(4.0, 7.0 - rank * 0.5);
    return 1 - clamp01((s.skillCd || 0) / full);
  }
  if (s.type === 'orange_cannon') {
    const threshold = rank >= 3 ? 2 : 3;
    return clamp01((s.skillState?.orangeHits || 0) / threshold);
  }
  if (s.type === 'grape_archer') {
    const threshold = rank >= 3 ? 3 : 4;
    return clamp01((s.skillState?.grapeShots || 0) / threshold);
  }
  return 0;
}
function drawSkillVisualLayerV18() {
  if (!state || state.phase !== 'playing') return;
  const all = [...(state.playerSoldiers || []), ...(state.enemySoldiers || [])];
  for (const s of all) {
    if (!s || !s.alive || !s.squadMode || !isCombatant(s)) continue;
    const cfg = SKILL_VISUAL_V18[s.type];
    const rank = skillRankForVisualV18(s);
    if (!cfg || rank <= 0) continue;
    drawUnitSkillAuraV18(s, cfg, rank);
    drawUnitSkillIconV18(s, cfg, rank);
    drawSpecificSkillStateV18(s, cfg, rank);
  }
}
function drawUnitSkillAuraV18(s, cfg, rank) {
  const r = visualRadiusV18(s);
  const ready = skillReadyRatioV18(s);
  const pulse = 0.76 + Math.sin(performance.now() / 170 + s.id.length) * 0.18;
  const alpha = 0.14 + 0.20 * ready + (rank >= 4 ? 0.12 * pulse : 0);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = cfg.color;
  ctx.lineWidth = rank >= 4 ? 4.5 : rank >= 3 ? 3.5 : 2.5;
  ctx.beginPath();
  ctx.ellipse(s.x, s.y + r * 0.18, r * (1.42 + ready * 0.10), r * (0.78 + ready * 0.07), 0, 0, Math.PI * 2);
  ctx.stroke();

  // 技能蓄力弧：不是文字，玩家能看出“技能快好了”。
  if (ready > 0.05) {
    ctx.globalAlpha = 0.55 + ready * 0.35;
    ctx.lineWidth = rank >= 4 ? 4 : 3;
    ctx.beginPath();
    ctx.arc(s.x, s.y - r * 0.38, r * 0.96, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ready);
    ctx.stroke();
  }
  ctx.restore();
}
function drawUnitSkillIconV18(s, cfg, rank) {
  const r = visualRadiusV18(s);
  const size = Math.max(6, Math.min(14, r * 0.26));
  const x = s.x - r * 0.72;
  const y = s.y - r * 0.86;

  ctx.save();
  ctx.globalAlpha = rank >= 4 ? 0.95 : 0.78;
  ctx.fillStyle = 'rgba(0,0,0,0.48)';
  ctx.beginPath();
  ctx.arc(x, y, size + 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = cfg.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, size + 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = cfg.color;
  ctx.fillStyle = cfg.color;
  ctx.lineWidth = 2.3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (cfg.icon === 'shield') {
    ctx.beginPath();
    ctx.moveTo(x, y - size * 0.9);
    ctx.lineTo(x + size * 0.72, y - size * 0.35);
    ctx.lineTo(x + size * 0.42, y + size * 0.75);
    ctx.lineTo(x, y + size * 1.0);
    ctx.lineTo(x - size * 0.42, y + size * 0.75);
    ctx.lineTo(x - size * 0.72, y - size * 0.35);
    ctx.closePath();
    ctx.stroke();
  } else if (cfg.icon === 'volley') {
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(x - size * 0.65, y + i * size * 0.35);
      ctx.lineTo(x + size * 0.65, y + i * size * 0.10);
      ctx.stroke();
    }
  } else if (cfg.icon === 'dash') {
    ctx.beginPath();
    ctx.moveTo(x - size * 0.65, y + size * 0.45);
    ctx.lineTo(x + size * 0.10, y - size * 0.75);
    ctx.lineTo(x + size * 0.62, y - size * 0.08);
    ctx.stroke();
  } else if (cfg.icon === 'lance') {
    ctx.beginPath();
    ctx.moveTo(x - size * 0.65, y + size * 0.55);
    ctx.lineTo(x + size * 0.70, y - size * 0.60);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + size * 0.70, y - size * 0.60);
    ctx.lineTo(x + size * 0.24, y - size * 0.54);
    ctx.lineTo(x + size * 0.60, y - size * 0.15);
    ctx.stroke();
  } else if (cfg.icon === 'cannon') {
    ctx.beginPath();
    ctx.rect(x - size * 0.62, y - size * 0.22, size * 1.05, size * 0.48);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - size * 0.35, y + size * 0.45, size * 0.22, 0, Math.PI * 2);
    ctx.arc(x + size * 0.38, y + size * 0.45, size * 0.22, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
function drawSpecificSkillStateV18(s, cfg, rank) {
  const r = visualRadiusV18(s);
  ctx.save();

  if (s.type === 'watermelon_guard' && (s.shield || 0) > 0) {
    ctx.globalAlpha = 0.18 + Math.min(0.22, (s.shield || 0) / Math.max(1, s.maxHp));
    ctx.fillStyle = cfg.color;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + r * 0.04, r * 1.16, r * 1.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (s.type === 'grape_archer') {
    const threshold = rank >= 3 ? 3 : 4;
    const shots = Math.min(threshold, s.skillState?.grapeShots || 0);
    ctx.fillStyle = cfg.color;
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < threshold; i++) {
      const a = -Math.PI / 2 + (i / threshold) * Math.PI * 2;
      const rr = r * 0.95;
      ctx.globalAlpha = i < shots ? 0.92 : 0.20;
      ctx.beginPath();
      ctx.arc(s.x + Math.cos(a) * rr, s.y - r * 0.38 + Math.sin(a) * rr, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (s.type === 'banana_raider' && s.skillState?.bananaFury > 0) {
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = cfg.color;
    ctx.lineWidth = 5;
    const dir = s.side === 'player' ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y + dir * r * 0.78);
    ctx.lineTo(s.x, s.y + dir * r * 1.58);
    ctx.stroke();
  }

  if (s.type === 'pineapple_lancer') {
    ctx.globalAlpha = s.skillState?.antiRush > 0 ? 0.50 : 0.24;
    ctx.strokeStyle = cfg.color;
    ctx.lineWidth = s.skillState?.antiRush > 0 ? 5 : 3;
    const dir = s.side === 'player' ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(s.x - r * 0.58, s.y + dir * r * 0.10);
    ctx.lineTo(s.x, s.y + dir * r * 1.08);
    ctx.lineTo(s.x + r * 0.58, s.y + dir * r * 0.10);
    ctx.stroke();
  }

  if (s.type === 'orange_cannon') {
    const charge = Math.min(3, s.skillState?.orangeHits || 0);
    ctx.globalAlpha = 0.20 + charge * 0.10;
    ctx.strokeStyle = cfg.color;
    ctx.lineWidth = 4 + charge;
    ctx.beginPath();
    ctx.arc(s.x, s.y - r * 0.38, r * (0.88 + charge * 0.07), 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}
