/* ============================================================
   水果突击 · Side Identity Fix
   强化敌我识别：半场底色、阵营标识、方向箭头、阵营血条、强描边。
   Loaded after combat_clarity/lane_block fixes.
   ============================================================ */

(function installSideIdentityFix() {
  patchSideField();
  patchSideSoldiers();
})();

const SIDE_STYLE = {
  player: {
    name: '我方',
    arrow: '▲',
    main: '#35e66f',
    dark: '#116b35',
    glow: 'rgba(83,255,130,0.55)',
    fill: 'rgba(47,214,99,0.13)',
    hp: '#42f58a',
    badgeText: '#eafff1',
  },
  enemy: {
    name: '敌方',
    arrow: '▼',
    main: '#ff4f64',
    dark: '#7c1529',
    glow: 'rgba(255,70,92,0.58)',
    fill: 'rgba(255,70,92,0.14)',
    hp: '#ff506a',
    badgeText: '#fff1f4',
  },
};

function sideStyle(side) { return side === 'enemy' ? SIDE_STYLE.enemy : SIDE_STYLE.player; }

function patchSideField() {
  if (typeof drawField !== 'function' || drawField._sideIdentityPatched) return;
  const oldDrawField = drawField;
  drawField = function drawFieldSideIdentity() {
    oldDrawField();
    const fy = LAYOUT.fieldY;
    const fh = LAYOUT.fieldH;
    const mid = fy + fh / 2;
    const x = 20;
    const w = W - 40;

    ctx.save();

    // 敌方半场 / 我方半场底色，弱透明，不污染美术。
    ctx.fillStyle = SIDE_STYLE.enemy.fill;
    roundRect(x, fy, w, fh / 2, 8);
    ctx.fill();
    ctx.fillStyle = SIDE_STYLE.player.fill;
    roundRect(x, mid, w, fh / 2, 8);
    ctx.fill();

    // 中线改成更明确的攻防分界。
    ctx.strokeStyle = 'rgba(255,255,255,0.38)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([10, 6]);
    ctx.beginPath();
    ctx.moveTo(x + 8, mid);
    ctx.lineTo(x + w - 8, mid);
    ctx.stroke();
    ctx.setLineDash([]);

    // 阵营边框：上红下绿。
    ctx.strokeStyle = 'rgba(255,75,96,0.48)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 8, fy + 6);
    ctx.lineTo(x + w - 8, fy + 6);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(70,240,126,0.50)';
    ctx.beginPath();
    ctx.moveTo(x + 8, fy + fh - 6);
    ctx.lineTo(x + w - 8, fy + fh - 6);
    ctx.stroke();

    drawSideFieldBadge(W - 86, fy + 12, SIDE_STYLE.enemy, '敌方推进');
    drawSideFieldBadge(86, fy + fh - 30, SIDE_STYLE.player, '我方推进');

    ctx.restore();
  };
  drawField._sideIdentityPatched = true;
}

function drawSideFieldBadge(cx, cy, style, text) {
  const bw = 78;
  const bh = 18;
  ctx.fillStyle = style.dark;
  ctx.globalAlpha = 0.88;
  roundRect(cx - bw / 2, cy - bh / 2, bw, bh, 9);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = style.main;
  ctx.lineWidth = 1.5;
  roundRect(cx - bw / 2, cy - bh / 2, bw, bh, 9);
  ctx.stroke();
  ctx.font = '900 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = style.badgeText;
  ctx.fillText(`${style.arrow} ${text}`, cx, cy + 0.5);
}

function patchSideSoldiers() {
  if (typeof drawSoldier !== 'function' || drawSoldier._sideIdentityPatched) return;
  const prevDrawSoldier = drawSoldier;
  drawSoldier = function drawSoldierSideIdentity(s) {
    if (s && s.squadMode) {
      drawSideReadableSoldier(s);
      return;
    }
    prevDrawSoldier(s);
    if (s && s.alive) drawSideHaloAndBadge(s, 12 + (s.level || 1));
  };
  drawSoldier._sideIdentityPatched = true;
}

function drawSideHpBar(s, x, y, w) {
  const style = sideStyle(s.side);
  const ratio = clamp01(s.hp / Math.max(1, s.maxHp));
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  roundRect(x - w / 2, y, w, 6, 3);
  ctx.fill();
  ctx.fillStyle = style.hp;
  roundRect(x - w / 2 + 1, y + 1, Math.max(2, (w - 2) * ratio), 4, 2);
  ctx.fill();

  // 血条左侧阵营短杠，快速扫一眼能区分敌我。
  ctx.fillStyle = style.main;
  roundRect(x - w / 2 - 6, y, 4, 6, 2);
  ctx.fill();

  if ((s.shield || 0) > 0) {
    const sr = clamp01(s.shield / Math.max(1, s.maxShield || s.maxHp * 0.45));
    ctx.fillStyle = '#72c4ff';
    roundRect(x - w / 2, y - 4, w * sr, 3, 2);
    ctx.fill();
  }
}

function drawSideReadableSoldier(s) {
  const t = TYPES[s.type] || TYPES[DEFAULT_DECK[0]];
  const style = sideStyle(s.side);
  const fy = LAYOUT.fieldY, fh = LAYOUT.fieldH;
  const depth = 0.78 + 0.25 * ((s.y - fy) / fh);
  const scale = s.troopScale || (1 + Math.max(0, s.level - 1) * 0.07);
  const r = (15 + s.level * 1.45) * depth * scale;
  const name = s.troopName || t.name;
  const roleText = typeof cleanRoleLabel === 'function' ? cleanRoleLabel(t.role) : (t.role || '兵');
  const tierText = typeof cleanTierLabel === 'function' ? cleanTierLabel(s) : `Lv.${s.level}`;
  const tierColor = typeof cleanTierColor === 'function' ? cleanTierColor(s) : THEME.gold;

  ctx.save();

  // 阵营底座：我方圆环，敌方尖角菱形环。
  ctx.shadowColor = style.glow;
  ctx.shadowBlur = 9;
  ctx.strokeStyle = style.main;
  ctx.lineWidth = 3.2;
  if (s.side === 'enemy') {
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - r * 0.95);
    ctx.lineTo(s.x + r * 1.18, s.y + r * 0.10);
    ctx.lineTo(s.x, s.y + r * 1.05);
    ctx.lineTo(s.x - r * 1.18, s.y + r * 0.10);
    ctx.closePath();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + r * 0.24, r * 1.12, r * 0.55, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,0.26)';
  ctx.beginPath();
  ctx.ellipse(s.x, s.y + r + 6, r * 0.98, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // 身体：阵营色优先，水果色只保留在头部。
  ctx.fillStyle = s.hitFlash > 0 ? '#ffffff' : style.main;
  ctx.strokeStyle = s.side === 'enemy' ? '#fff0f2' : '#ecfff1';
  ctx.lineWidth = 2.2;
  roundRect(s.x - r * 0.58, s.y - r * 0.02, r * 1.16, r * 1.18, 7);
  ctx.fill();
  ctx.stroke();

  // 胸口阵营符号，避免同色水果图标干扰判断。
  ctx.font = `900 ${Math.round(r * 0.48)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#132015';
  ctx.globalAlpha = 0.82;
  ctx.fillText(style.arrow, s.x, s.y + r * 0.50);
  ctx.globalAlpha = 1;

  // 水果头
  ctx.fillStyle = t.color || tierColor;
  ctx.beginPath();
  ctx.arc(s.x, s.y - r * 0.38, r * 0.73, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = style.main;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.font = `${Math.round(r * 0.80)}px sans-serif`;
  ctx.fillStyle = '#fff';
  ctx.fillText(t.icon, s.x, s.y - r * 0.38);

  // 星级章
  ctx.fillStyle = s.side === 'enemy' ? '#5b1020' : '#0f5a31';
  ctx.beginPath();
  ctx.arc(s.x + r * 0.72, s.y + r * 0.16, r * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `900 ${Math.round(r * 0.44)}px sans-serif`;
  ctx.fillStyle = '#fff2a8';
  ctx.fillText(s.level, s.x + r * 0.72, s.y + r * 0.17);

  drawSideHpBar(s, s.x, s.y - r - 12, r * 2.16);

  // 顶部阵营 Badge：固定“我方/敌方”，比兵阶更优先。
  const sideBadgeW = 42;
  ctx.fillStyle = style.dark;
  roundRect(s.x - sideBadgeW / 2, s.y - r - 35, sideBadgeW, 15, 7);
  ctx.fill();
  ctx.strokeStyle = style.main;
  ctx.lineWidth = 1.4;
  roundRect(s.x - sideBadgeW / 2, s.y - r - 35, sideBadgeW, 15, 7);
  ctx.stroke();
  ctx.font = '900 9px sans-serif';
  ctx.fillStyle = style.badgeText;
  ctx.fillText(`${style.arrow}${style.name}`, s.x, s.y - r - 27.5);

  // 兵阶职责标签
  ctx.font = '900 9px sans-serif';
  ctx.strokeStyle = 'rgba(0,0,0,0.62)';
  ctx.lineWidth = 3;
  ctx.strokeText(`${tierText} · ${roleText}`, s.x, s.y - r - 20);
  ctx.fillStyle = tierColor;
  ctx.fillText(`${tierText} · ${roleText}`, s.x, s.y - r - 20);

  // 主铭牌也加阵营色左条。
  const w = Math.min(104, Math.max(62, name.length * 10 + 18));
  ctx.fillStyle = 'rgba(0,0,0,0.66)';
  roundRect(s.x - w / 2, s.y + r + 10, w, 17, 8);
  ctx.fill();
  ctx.fillStyle = style.main;
  roundRect(s.x - w / 2 + 2, s.y + r + 12, 5, 13, 3);
  ctx.fill();
  ctx.font = '900 10px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(name, s.x + 3, s.y + r + 22);

  if ((s.reinforceStacks || 0) > 0) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(s.x + r * 0.82, s.y - r * 0.70, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '900 8px sans-serif';
    ctx.fillStyle = style.dark;
    ctx.fillText(`+${s.reinforceStacks}`, s.x + r * 0.82, s.y - r * 0.67);
  }

  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

function drawSideHaloAndBadge(s, approxR) {
  const style = sideStyle(s.side);
  ctx.save();
  ctx.strokeStyle = style.main;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.arc(s.x, s.y, approxR + 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.font = '900 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = style.badgeText;
  ctx.strokeStyle = 'rgba(0,0,0,0.78)';
  ctx.lineWidth = 3;
  ctx.strokeText(`${style.arrow}${style.name}`, s.x, s.y - approxR - 11);
  ctx.fillStyle = style.main;
  ctx.fillText(`${style.arrow}${style.name}`, s.x, s.y - approxR - 11);
  ctx.restore();
}
