/* ============================================================
   水果突击 · Stickman Renderer v61 (Phase 2)
   ------------------------------------------------------------
   基于 v60 的全面升级：
   - 等级驱动头部缩放：Lv1→Lv7 头直径增长 ~3.3×，身体仅 ~1.6×
   - Q 版比例：身体用 bodyS 驱动(缓涨1.6×)，头部用 headR 驱动(猛涨3.3×)，自动头大身小
   - 5 种特色兵器重设计：盾/枪/剑/弓/炮各具高辨识度
   - 每种兵独特走路/待机动画：ROLE_ANIM 参数表驱动
   - 全局导出 stickWeaponForRoleV61 供 combat/render/juice 使用

   仅改渲染，不动任何数值/经济/战斗判定 —— combat baseline 必须不变。
   ============================================================ */

/* ---------- 0) 等级缩放 & 角色动画参数表 ---------- */

// 等级驱动头部/身体缩放因子
const HEAD_SCALE_BY_LEVEL = [0, 0.58, 0.66, 0.76, 0.90, 1.05, 1.22, 1.40];
const BODY_SCALE_BY_LEVEL = [0, 0.085, 0.092, 0.100, 0.108, 0.116, 0.124, 0.132];

// 按职责的走路/待机动画参数
const ROLE_ANIM = {
  tank:    { strideMul: 0.55, bobMul: 0.70, leanAngle: 0.16, armSwingMul: 0.50, stepSpeed: 0.035 },
  front:   { strideMul: 0.75, bobMul: 0.85, leanAngle: 0.22, armSwingMul: 0.75, stepSpeed: 0.045 },
  rush:    { strideMul: 1.05, bobMul: 1.00, leanAngle: 0.32, armSwingMul: 1.10, stepSpeed: 0.065 },
  back:    { strideMul: 0.70, bobMul: 0.65, leanAngle: 0.18, armSwingMul: 0.60, stepSpeed: 0.038 },
  siege:   { strideMul: 0.45, bobMul: 1.15, leanAngle: 0.20, armSwingMul: 0.40, stepSpeed: 0.028 },
  control: { strideMul: 0.68, bobMul: 0.60, leanAngle: 0.15, armSwingMul: 0.55, stepSpeed: 0.036 },
  support: { strideMul: 0.65, bobMul: 0.55, leanAngle: 0.14, armSwingMul: 0.50, stepSpeed: 0.034 },
  merge:   { strideMul: 0.00, bobMul: 0.30, leanAngle: 0.00, armSwingMul: 0.20, stepSpeed: 0.000 },
};

/* ---------- 1) 全局导出：武器映射 ---------- */

function stickWeaponForRoleV61(role) {
  switch (role) {
    case 'tank':    return 'shield';
    case 'front':   return 'spear';
    case 'rush':    return 'sword';
    case 'back':    return 'bow';
    case 'siege':   return 'cannon';
    case 'control': return 'bow';
    case 'support': return 'bow';
    case 'merge':   return 'none';
    default:        return 'sword';
  }
}
// 暴露到全局，供 combat.js / render.js / juice.js 使用
window.stickWeaponForRoleV61 = stickWeaponForRoleV61;

/* ---------- 2) 走路关键帧(保持 v60 的 4 帧 cycle) ---------- */

const STICK_KEYS_V61 = [
  { rf: 1,    lf: -0.9, ra: -0.8, la: 0.8,  body: -1 }, // contact R
  { rf: 0,    lf: 0,    ra: 0,    la: 0,    body: 1 },  // passing
  { rf: -0.9, lf: 1,    ra: 0.8,  la: -0.8, body: -1 }, // contact L
  { rf: 0,    lf: 0,    ra: 0,    la: 0,    body: 1 },  // passing
];

function stickLerpKV61(phase) {
  const p = ((phase % 1) + 1) % 1, i = Math.floor(p * 4) % 4, j = (i + 1) % 4, t = p * 4 - i;
  const a = STICK_KEYS_V61[i], b = STICK_KEYS_V61[j];
  const L = (x, y) => x + (y - x) * t;
  return { rf: L(a.rf, b.rf), lf: L(a.lf, b.lf), ra: L(a.ra, b.ra), la: L(a.la, b.la), body: L(a.body, b.body) };
}

/* ---------- 3) 调色板 ---------- */

function hexToRgbaV61(hex, a) {
  if (typeof hex !== 'string' || hex[0] !== '#') return `rgba(140,140,140,${a})`;
  let h = hex.slice(1);
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function stickPaletteV61(o) {
  const enemy = o.sideColor === '#ff4a5f';
  const player = o.sideColor === '#22c55e';
  const outline = 'rgba(48,32,26,0.9)';
  if (enemy) {
    return {
      ink: '#8f2436',
      bodyHi: 'rgba(255,150,164,0.95)', body: 'rgba(232,74,94,0.95)', bodyLo: 'rgba(146,32,48,0.96)',
      rim: 'rgba(255,224,229,0.9)',
      outline,
      headBase: 'rgba(255,244,230,0.97)',
    };
  }
  if (player) {
    return {
      ink: '#1f6d3c',
      bodyHi: 'rgba(126,230,158,0.95)', body: 'rgba(52,176,100,0.95)', bodyLo: 'rgba(22,104,58,0.96)',
      rim: 'rgba(230,255,236,0.9)',
      outline,
      headBase: 'rgba(255,250,226,0.97)',
    };
  }
  return {
    ink: '#4a6a3e',
    bodyHi: 'rgba(170,200,150,0.95)', body: 'rgba(110,150,90,0.95)', bodyLo: 'rgba(70,100,58,0.96)',
    rim: 'rgba(255,250,226,0.82)',
    outline,
    headBase: 'rgba(255,250,226,0.97)',
  };
}

/* ---------- 4) 核心几何：drawStickmanShape (headR 基准 Q 版) ---------- */

/* o = { cx, groundY, headR, bodyS, phase, dir(±1), advDir,
        headColor, emoji, weapon, weaponRole, atkT, fighting,
        sideColor, hitFlash, idleTime, time } */
function drawStickmanShapeV61(ctx, o) {
  const headR = o.headR || 14;                // 头半径(主比例尺)
  const s = o.bodyS || headR * 0.13;           // 身体 scale(派生值)
  const cx = o.cx, GROUND = o.groundY, dir = o.dir >= 0 ? 1 : -1;
  const pal = stickPaletteV61(o);
  const baseInk = o.ink && o.ink !== '#1b1b1b' ? o.ink : pal.ink;
  const ink = o.hitFlash > 0 ? '#ffffff' : baseInk;

  // 角色动画参数
  const roleAnim = ROLE_ANIM[o.weaponRole] || ROLE_ANIM['front'];
  const k = stickLerpKV61(o.phase || 0);

  const lean = roleAnim.leanAngle * dir;
  const stride = s * 9.0 * roleAnim.strideMul;
  const bob = s * 3.4 * roleAnim.bobMul;
  const adv = o.advDir === 1 ? 1 : -1;

  // 待机微动(time-based idle sway)
  const idle = o.idleTime || 0;
  const idleBob = !o.fighting ? Math.sin(idle * 2.5) * s * 0.5 : 0;
  const idleSway = !o.fighting ? Math.sin(idle * 1.3) * s * 0.4 : 0;

  const hipX = cx + idleSway;
  const hipY = GROUND - s * 1.2 - k.body * bob - idleBob;
  const bodyLen = s * 7.4;
  const lungeX = dir * (o.atkT || 0) * s * 2.2;
  const shX = hipX + Math.sin(lean) * bodyLen + lungeX;
  const shY = hipY - Math.cos(lean) * bodyLen;
  const neck = s * 3.8;
  const hx = shX + Math.sin(lean) * neck;
  const hy = shY - Math.cos(lean) * neck - headR * 0.05;

  // 火柴人四肢 —— 纯单线
  const limbW = s * 1.3; // 线粗
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = ink; ctx.lineWidth = limbW;

  // 腿(二次曲线,带膝盖弯)
  function leg(fn, sideSign, alpha) {
    ctx.globalAlpha = alpha;
    const fx = hipX + sideSign * s * 2.8;
    const reach = adv * fn * stride;
    const lift = Math.max(0, fn) * s * 3.0;
    const fy = GROUND + reach - lift;
    const kx = hipX + sideSign * s * 2.2;
    const ky = hipY + (GROUND - hipY) * 0.45 + reach * 0.35 - lift * 0.6;
    ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.quadraticCurveTo(kx, ky, fx, fy); ctx.stroke();
  }
  leg(k.lf, -1, 0.55); leg(k.rf, 1, 1);
  ctx.globalAlpha = 1;

  // 脊柱(髋→肩)
  ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(shX, shY); ctx.stroke();

  // 手臂(肩→手)
  const armLen = s * 8.5;
  const armSwing = roleAnim.armSwingMul;
  const rAng = 0.4 + k.ra * 0.8 * armSwing + lean, rx = shX + Math.cos(rAng) * armLen, ry = shY + Math.sin(rAng) * armLen;
  const lAng = -2.8 + k.la * 0.8 * armSwing + lean, lx = shX + Math.cos(lAng) * armLen, ly = shY + Math.sin(lAng) * armLen;
  ctx.beginPath(); ctx.moveTo(shX, shY); ctx.lineTo(lx, ly); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(shX, shY); ctx.lineTo(rx, ry); ctx.stroke();

  // 武器
  drawStickWeaponV61(ctx, o.weapon, headR, dir, { rx, ry, lx, ly, shX, shY }, o.atkT || 0, o.fighting, o.headColor || '#8a6b46', ink, o.weaponRole);

  // 水果头 = emoji 直接长在脖子上(纯 emoji,无底圈)
  // 命中闪白
  if (o.hitFlash > 0) {
    ctx.save(); ctx.globalAlpha = 0.4; ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(hx, hy, headR * 1.05, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  if (o.emoji) {
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // emoji 各平台渲染大小不一,按果子类型修正
    const EMOJI_SCALE = { '🍇':1.35,'🫐':1.30,'🍋':1.22,'🍒':1.30,'🍓':1.20,'🌿':1.28,'⚡':1.25,'🍯':1.20,'🍷':1.20,'🧊':1.25,'🥝':1.15,'🫒':1.18,'🍌':1.10,'🍑':1.10,'🍉':0.88,'🍊':0.85,'🎃':0.82,'🥥':0.90,'🥑':0.92,'🐉':0.85 };
    const es = EMOJI_SCALE[o.emoji] || 1;
    ctx.translate(hx, hy); ctx.scale(es, es); ctx.translate(-hx, -hy);
    const fontSize = Math.round(headR * 2.2);
    ctx.font = `bold ${fontSize}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
    ctx.fillText(o.emoji, hx, hy);
    ctx.restore();
    // 淡队色描边环(干净区分敌我)
    ctx.beginPath(); ctx.arc(hx, hy, headR * 1.08, 0, Math.PI * 2);
    ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, headR * 0.06); ctx.globalAlpha = 0.35; ctx.stroke();
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = o.headColor || '#34c96b';
    ctx.beginPath(); ctx.arc(hx, hy, headR * 0.92, 0, Math.PI * 2); ctx.fill();
  }
  ctx.textBaseline = 'alphabetic';

  return { hx, hy, headR, shX, shY, hipX, hipY };
}

/* ---------- 5) 兵器绘制(5 种重设计) ---------- */

function drawStickWeaponV61(ctx, weapon, headR, dir, hands, strike, fighting, accent, ink, weaponRole) {
  const { rx, ry, lx, ly, shX, shY } = hands;
  accent = accent || "#8a6b46";
  ink = ink || "#40513c";
  const k = strike || 0;
  const ws = headR * 0.12;  // 极简武器scale
  ctx.lineCap = "round"; ctx.lineJoin = "round";

  // 攻击发光: 出手瞬间武器外溢白光
  if (k > 0.1) { ctx.shadowColor = 'rgba(255,255,220,0.85)'; ctx.shadowBlur = ws * 6; }

  // ── 盾: 实心圆 + 中心点 ──
  if (weapon === "shield") {
    const R = ws * 5;
    ctx.save(); ctx.translate(rx, ry);
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgbaV61(accent, 0.45); ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = ws * 2.5; ctx.stroke();
    ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(0, 0, ws * 1.2, 0, Math.PI * 2); ctx.fill();
    if (k > 0.3) {
      ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = ws * 1.5;
      ctx.beginPath(); ctx.arc(R * 0.6, 0, ws * (1.2 + (1 - k) * 6), -0.6, 0.6); ctx.stroke();
    }
    ctx.restore();
  }

  // ── 枪: 粗直线 + 三角头 ──
  else if (weapon === "spear") {
    ctx.save(); ctx.translate(rx, ry); ctx.scale(dir, 1);
    const thrust = k * ws * 8;
    ctx.translate(thrust, 0);
    ctx.strokeStyle = accent; ctx.lineWidth = ws * 2.5;
    ctx.beginPath(); ctx.moveTo(-ws * 5, 0); ctx.lineTo(ws * 10, 0); ctx.stroke();
    ctx.fillStyle = "#d8d8e0";
    ctx.beginPath(); ctx.moveTo(ws * 10, -ws * 2.5); ctx.lineTo(ws * 14, 0); ctx.lineTo(ws * 10, ws * 2.5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = ws * 1.2; ctx.stroke();
    if (k > 0.2) {
      ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = ws * 0.8;
      ctx.beginPath(); ctx.moveTo(ws * 10, 0); ctx.lineTo(ws * 17, 0); ctx.stroke();
    }
    ctx.restore();
  }

  // ── 剑: 弧刃 + 横挡 ──
  else if (weapon === "sword") {
    ctx.save(); ctx.translate(rx, ry); ctx.scale(dir, 1);
    const ang = 0.15 + k * 1.8;
    ctx.rotate(ang);
    ctx.strokeStyle = "#c8c8d8"; ctx.lineWidth = ws * 3.5;
    ctx.beginPath(); ctx.arc(0, 0, ws * 7, -0.3, 0.4); ctx.stroke();
    ctx.strokeStyle = ink; ctx.lineWidth = ws * 2;
    ctx.beginPath(); ctx.moveTo(-ws * 1.5, -ws * 3); ctx.lineTo(-ws * 1.5, ws * 3); ctx.stroke();
    if (k > 0.2) {
      ctx.globalAlpha = (1 - k) * 0.5;
      ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = ws * 2;
      ctx.beginPath(); ctx.arc(0, 0, ws * 8, -0.2, 0.6 + k * 0.8); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // ── 弓: 半弧 + 弦 ──
  else if (weapon === "bow") {
    ctx.save(); ctx.translate(lx, ly); ctx.scale(dir, 1);
    ctx.strokeStyle = accent; ctx.lineWidth = ws * 2.5;
    ctx.beginPath(); ctx.arc(0, 0, ws * 8, -1.1, 1.1); ctx.stroke();
    const draw = fighting ? (k > 0.03 ? (1 - k) * ws * 4 : ws * 5) : ws * 1.5;
    ctx.strokeStyle = "rgba(180,160,140,0.8)"; ctx.lineWidth = ws * 0.8;
    const tl = { x: Math.cos(-1.1) * ws * 8, y: Math.sin(-1.1) * ws * 8 };
    const tr = { x: Math.cos(1.1) * ws * 8, y: Math.sin(1.1) * ws * 8 };
    ctx.beginPath(); ctx.moveTo(tl.x, tl.y); ctx.lineTo(-draw, 0); ctx.lineTo(tr.x, tr.y); ctx.stroke();
    if (fighting && k > 0.03) {
      const ax = ws * 4 + (1 - k) * ws * 15;
      ctx.strokeStyle = ink; ctx.lineWidth = ws * 1.2;
      ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax + ws * 5, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ax + ws * 5, 0); ctx.lineTo(ax + ws * 3, -ws * 1.5);
      ctx.moveTo(ax + ws * 5, 0); ctx.lineTo(ax + ws * 3, ws * 1.5); ctx.stroke();
    }
    ctx.restore();
  }

  // ── 炮: 方块 + 圆口 ──
  else if (weapon === "cannon") {
    const recoil = k * ws * 4;
    const mx = (rx + lx) / 2, my = (ry + ly) / 2;
    ctx.save(); ctx.translate(mx, my); ctx.scale(dir, 1);
    ctx.strokeStyle = ink; ctx.lineWidth = ws * 1.8;
    ctx.beginPath(); ctx.moveTo(-ws * 3, -ws * 3); ctx.lineTo(ws * 6, -ws * 2.5);
    ctx.lineTo(ws * 6, ws * 2.5); ctx.lineTo(-ws * 3, ws * 3); ctx.closePath(); ctx.stroke();
    ctx.fillStyle = "rgba(70,55,45,0.8)"; ctx.fill();
    ctx.beginPath(); ctx.arc(ws * 6, 0, ws * 3, 0, Math.PI * 2); ctx.stroke();
    if (k > 0.4) {
      ctx.fillStyle = k > 0.6 ? "rgba(255,220,80," + k + ")" : "rgba(255,140,30," + k + ")";
      ctx.beginPath(); ctx.arc(ws * 7, 0, ws * (1.5 + (1 - k) * 6), 0, Math.PI * 2); ctx.fill();
    }
    // 肩到炮的连接线
    ctx.strokeStyle = ink; ctx.lineWidth = ws * 1.2;
    ctx.beginPath(); ctx.moveTo(-ws * 3, 0); ctx.lineTo(shX - mx, shY - my); ctx.stroke();
    ctx.restore();
  }

  // ── 空手 ──
  else if (weapon === "none" && fighting) {
    ctx.fillStyle = ink;
    ctx.beginPath(); ctx.arc(rx, ry, ws * 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(lx, ly, ws * 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.shadowBlur = 0;
}


function drawStatusFXV61(ctx, g, se, headR, time) {
  if (!se || !g) return;
  const t = time || 0;

  if (se.frozen && se.frozen.timer > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(150,220,255,0.9)'; ctx.lineWidth = headR * 0.03;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(g.hx + Math.cos(a) * g.headR * 1.4, g.hy + Math.sin(a) * g.headR * 1.4);
      ctx.lineTo(g.hx + Math.cos(a) * g.headR * 2.1, g.hy + Math.sin(a) * g.headR * 2.1); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(160,225,255,0.28)';
    ctx.beginPath(); ctx.arc(g.hx, (g.hy + g.shY) / 2, g.headR * 2.0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  if (se.burning && se.burning.timer > 0) {
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const ph = (t * 2 + i * 0.4) % 1;
      const fy = g.shY - ph * headR * 0.65;
      const fx = g.shX + Math.sin((t * 6) + i) * headR * 0.10;
      const rad = headR * (0.08 - ph * 0.03);
      ctx.globalAlpha = (1 - ph) * 0.85;
      ctx.fillStyle = ph < 0.5 ? '#ff9b3a' : '#ff5a2a';
      ctx.beginPath(); ctx.arc(fx, fy, Math.max(0.5, rad), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  if (se.slowed && se.slowed.timer > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(90,150,70,0.8)'; ctx.lineWidth = headR * 0.035;
    ctx.beginPath(); ctx.ellipse(g.hx, g.hy + headR * 0.80, g.headR * 1.6, g.headR * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  if (se.stunned && se.stunned.timer > 0) {
    ctx.save();
    ctx.fillStyle = '#ffe04a';
    for (let i = 0; i < 3; i++) {
      const a = t * 6 + (i / 3) * Math.PI * 2;
      const sx = g.hx + Math.cos(a) * g.headR * 1.5;
      const sy = g.hy - g.headR * 1.6 + Math.sin(a) * g.headR * 0.5;
      ctx.font = `${Math.round(headR * 0.22)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('⭐', sx, sy);
    }
    ctx.restore();
  }

  if (se.armorBreak && se.armorBreak.timer > 0) {
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(t * 12));
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = headR * 0.025;
    ctx.beginPath(); ctx.moveTo(g.shX - headR * 0.10, g.shY + headR * 0.15); ctx.lineTo(g.shX + headR * 0.10, g.shY + headR * 0.30); ctx.stroke();
    ctx.restore();
  }

  ctx.globalAlpha = 1;
  ctx.textBaseline = 'alphabetic';
}

/* ---------- 7) 游戏集成：替换 drawSoldier ---------- */

(function installStickmanRenderV61() {
  if (typeof drawSoldier !== 'function' || drawSoldier._stickmanV61) return;
  const prevDraw = drawSoldier;

  function walkPhaseV61(s, moved, stepSpeed) {
    if (!window.REDUCE_MOTION && moved > 0.10) {
      s._walkPhaseV61 = (s._walkPhaseV61 || 0) + Math.min(0.12, moved * stepSpeed);
    }
    return s._walkPhaseV61 || 0;
  }

  function faceDirV61(s) {
    const foes = s.side === 'player' ? state.enemySoldiers : state.playerSoldiers;
    let nearest = null, nd = Infinity;
    for (const e of (foes || [])) {
      if (!e || !e.alive) continue;
      const d = Math.abs(e.x - s.x) + Math.abs(e.y - s.y);
      if (d < nd) { nd = d; nearest = e; }
    }
    if (nearest && Math.abs(nearest.x - s.x) > 6) s._faceDirV61 = nearest.x > s.x ? 1 : -1;
    if (s._faceDirV61 === undefined) s._faceDirV61 = s.side === 'player' ? 1 : -1;
    return s._faceDirV61;
  }

  function roleColorV61(role) {
    return ({
      tank: '#758B78',
      front: '#81917A',
      rush: '#A98A58',
      back: '#718796',
      siege: '#A07251',
      control: '#80758E',
      support: '#6F8B7E',
      merge: '#89798D',
    })[role] || '#9A835D';
  }

  function drawRoleMarkV61(x, y, r, role, isEnemy) {
    const mark = role || 'front';
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = isEnemy ? 'rgba(255,238,232,0.94)' : 'rgba(244,255,235,0.96)';
    ctx.fillStyle = isEnemy ? 'rgba(255,238,232,0.18)' : 'rgba(244,255,235,0.18)';
    ctx.lineWidth = Math.max(2.2, r * 0.13);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (mark === 'tank' || mark === 'front') {
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.48);
      ctx.lineTo(r * 0.42, -r * 0.20);
      ctx.lineTo(r * 0.30, r * 0.34);
      ctx.lineTo(0, r * 0.55);
      ctx.lineTo(-r * 0.30, r * 0.34);
      ctx.lineTo(-r * 0.42, -r * 0.20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (mark === 'rush') {
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.42 + i * r * 0.16, r * 0.42);
        ctx.lineTo(r * 0.36 + i * r * 0.16, -r * 0.46);
        ctx.stroke();
      }
    } else if (mark === 'back') {
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.46, i * r * 0.22);
        ctx.lineTo(r * 0.46, i * r * 0.08);
        ctx.stroke();
      }
    } else if (mark === 'siege') {
      roundRect(-r * 0.42, -r * 0.25, r * 0.62, r * 0.50, r * 0.08);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(r * 0.18, 0);
      ctx.lineTo(r * 0.54, -r * 0.16);
      ctx.stroke();
    } else if (mark === 'support' || mark === 'merge') {
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.48);
      ctx.lineTo(0, r * 0.48);
      ctx.moveTo(-r * 0.48, 0);
      ctx.lineTo(r * 0.48, 0);
      ctx.stroke();
      if (mark === 'merge') {
        ctx.beginPath();
        ctx.rect(-r * 0.24, -r * 0.24, r * 0.48, r * 0.48);
        ctx.stroke();
      }
    } else if (mark === 'control') {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.44, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTacticalUnitV61(s, t, tier, st, vis, role, lv, depth) {
    const isEnemy = s.side === 'enemy';
    const tierScale = tier === 'legendary' ? 1.18 : tier === 'advanced' ? 1.10 : tier === 'elite' ? 1.05 : 1;
    const r = (19 + Math.min(4, Math.max(0, lv - 1)) * 1.45) * depth * tierScale;
    const side = isEnemy ? '#98505A' : '#557B66';
    const sideDark = isEnemy ? '#2C2022' : '#1E2924';
    const face = t.color || st.main || '#f5c242';
    const roleColor = roleColorV61(role);
    const hpRatio = Math.max(0, Math.min(1, (Number(s.hp) || 0) / Math.max(1, Number(s.maxHp) || 1)));
    const showHp = hpRatio < 0.985 || (s.hitFlash || 0) > 0.02 || (s.shield || 0) > 0;
    const fighting = s.mode === 'fight' || s.mode === 'siege' || s.mode === 'siege_support';

    ctx.save();
    if (typeof isInvisible === 'function' && isInvisible(s)) ctx.globalAlpha = 0.42;

    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(vis.x, vis.y + r * 0.68, r * 1.05, r * 0.30, 0, 0, Math.PI * 2);
    ctx.fill();

    // 单位是微缩棋子，不再使用霓虹战斗环。
    ctx.fillStyle = sideDark;
    ctx.strokeStyle = (s.hitFlash || 0) > 0.02 ? '#F1E8D5' : side;
    ctx.lineWidth = (s.hitFlash || 0) > 0.02 ? 2.6 : 1.7;
    ctx.beginPath();
    ctx.arc(vis.x, vis.y, r + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#252522';
    ctx.beginPath();
    ctx.arc(vis.x, vis.y, r - 2, 0, Math.PI * 2);
    ctx.fill();
    if (typeof window.drawFruitGlyphV62 === 'function') {
      window.drawFruitGlyphV62(ctx, vis.x, vis.y - r * 0.02, r * 0.70, s.type, face, '#E6DDCA');
    } else {
      drawRoleMarkV61(vis.x, vis.y, r * 0.72, role, isEnemy);
    }

    // 职责只保留为底座色签，避免覆盖水果身份。
    ctx.fillStyle = roleColor;
    roundRect(vis.x - r * 0.48, vis.y + r * 0.72, r * 0.96, 3.2, 1.4);
    ctx.fill();

    if (fighting) {
      ctx.fillStyle = isEnemy ? '#98505A' : '#557B66';
      ctx.beginPath();
      ctx.moveTo(vis.x - 4, vis.y + r + 4);
      ctx.lineTo(vis.x + 4, vis.y + r + 4);
      ctx.lineTo(vis.x, vis.y + r + 9);
      ctx.closePath();
      ctx.fill();
    }

    if (lv >= 2) {
      ctx.fillStyle = '#171717';
      ctx.strokeStyle = '#9A835D';
      ctx.lineWidth = 1;
      roundRect(vis.x + r * 0.22, vis.y - r * 0.96, r * 0.84, 13, 3);
      ctx.fill();
      ctx.stroke();
      ctx.font = '900 10px sans-serif';
      ctx.fillStyle = '#D8C7A4';
      ctx.fillText('L' + lv, vis.x + r * 0.64, vis.y - r * 0.96 + 6.5);
    }

    if (showHp) {
      const bw = Math.max(24, r * 1.78);
      const by = vis.y - r - 9;
      ctx.fillStyle = 'rgba(0,0,0,0.66)';
      roundRect(vis.x - bw / 2, by, bw, 3.6, 1.5);
      ctx.fill();
      ctx.fillStyle = hpRatio > 0.5 ? '#80947C' : hpRatio > 0.25 ? '#AA8B58' : '#98505A';
      roundRect(vis.x - bw / 2, by, Math.max(2, bw * hpRatio), 3.6, 1.5);
      ctx.fill();
      if ((s.shield || 0) > 0) {
        const sr = Math.max(0, Math.min(1, Number(s.shield || 0) / Math.max(1, Number(s.maxShield || s.maxHp * 0.45))));
        ctx.fillStyle = '#72c4ff';
        roundRect(vis.x - bw / 2, by - 3.4, bw * sr, 2.4, 2);
        ctx.fill();
      }
    }

    if (s.statusEffects) {
      const hasSlow = s.statusEffects.slow && s.statusEffects.slow.timer > 0;
      const hasBurn = s.statusEffects.burning && s.statusEffects.burning.timer > 0;
      if (hasSlow || hasBurn) {
        ctx.strokeStyle = hasBurn ? 'rgba(255,128,55,0.85)' : 'rgba(132,210,255,0.85)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(vis.x, vis.y, r + 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (s._boss && typeof drawBossBadgeV59 === 'function') {
      drawBossBadgeV59(s, vis.x, vis.y - r - 30, Math.max(86, r * 3.4));
    }
    ctx.restore();
  }

  drawSoldier = function stickmanDrawSoldierV61(s) {
    if (!s || !s.alive) return;
    if (window.RenderHooks && window.RenderHooks.beforeDrawSoldier) window.RenderHooks.beforeDrawSoldier.run(ctx, s);
    if (typeof battleVisualPosV59 !== 'function' || typeof battleVisualYV59 !== 'function') {
      prevDraw(s);
      if (window.RenderHooks && window.RenderHooks.afterDrawSoldier) window.RenderHooks.afterDrawSoldier.run(ctx, s);
      return;
    }

    const t = TYPES[s.type] || TYPES[DEFAULT_DECK[0]];
    const tier = typeof battleUnitTierKeyV59 === 'function' ? battleUnitTierKeyV59(s) : 'normal';
    const st = battleUnitStyleV59(s.side);
    const baseY = battleVisualYV59(s);
    const depth = 0.76 + 0.22 * ((baseY - LAYOUT.fieldY) / LAYOUT.fieldH);
    const tierScale = typeof battleUnitTierScaleV59 === 'function' ? battleUnitTierScaleV59(tier) : 1;
    const roleScale = typeof battleUnitRoleScaleV59 === 'function' ? battleUnitRoleScaleV59(s.type) : 1;
    const role = (t && t.role) || 'front';
    const roleAnim = ROLE_ANIM[role] || ROLE_ANIM['front'];

    // 等级驱动缩放
    const lv = Math.max(1, s.level || 1);
    const headMul = HEAD_SCALE_BY_LEVEL[Math.min(lv, 7)] || 1;
    const bodyMul = BODY_SCALE_BY_LEVEL[Math.min(lv, 7)] || 0.1;

    const headR = 22 * headMul * depth * tierScale * roleScale;
    const bodyS = 22 * bodyMul * depth * tierScale * roleScale;

    // 视觉位置
    const r = (13 + lv * 1.18) * depth * tierScale * roleScale;
    const vis = battleVisualPosV59(s, r);
    drawTacticalUnitV61(s, t, tier, st, vis, role, lv, depth);
    if (window.RenderHooks && window.RenderHooks.afterDrawSoldier) window.RenderHooks.afterDrawSoldier.run(ctx, s);
    return;

    // 走路相位
    const dyStep = s.y - (s._pyV61 ?? s.y);
    const moved = Math.hypot((s.x - (s._pxV61 ?? s.x)), dyStep);
    s._pxV61 = s.x; s._pyV61 = s.y;
    const phase = walkPhaseV61(s, moved, roleAnim.stepSpeed);
    const dir = faceDirV61(s);
    const advDir = Math.abs(dyStep) > 0.05 ? (dyStep > 0 ? 1 : -1) : (s.side === 'player' ? -1 : 1);

    // 战斗状态
    const fighting = s.mode === 'fight' || s.mode === 'siege' || s.mode === 'siege_support';

    // 攻击动作检测
    const prevT = s._prevAtkTimerV61;
    if (prevT !== undefined && (s.atkTimer || 0) > prevT + 0.02) s._strikeV61 = 1;
    s._prevAtkTimerV61 = s.atkTimer || 0;
    if ((s._strikeV61 || 0) > 0) s._strikeV61 = Math.max(0, s._strikeV61 - (dt_global || 0.016) / 0.30);
    const strike = s._strikeV61 || 0;

    // 待机时间累加
    if (!fighting && moved < 0.05) {
      s._idleTimeV61 = (s._idleTimeV61 || 0) + (dt_global || 0.016);
    } else {
      s._idleTimeV61 = 0;
    }

    const groundY = vis.y + headR * 0.75;

    ctx.save();
    const invis = typeof isInvisible === 'function' && isInvisible(s);
    if (invis) ctx.globalAlpha = 0.4;

    // 脚下光环(敌我区分)
    ctx.fillStyle = st.main;
    ctx.globalAlpha = invis ? 0.12 : 0.30;
    ctx.beginPath(); ctx.ellipse(vis.x, groundY + 1, headR * 1.15, headR * 0.25, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = invis ? 0.4 : 1;

    const geom = drawStickmanShapeV61(ctx, {
      cx: vis.x, groundY,
      headR, bodyS,
      phase, dir, advDir,
      headColor: t.color || st.main,
      emoji: t.icon,
      weapon: stickWeaponForRoleV61(role),
      weaponRole: role,
      atkT: strike,
      fighting,
      sideColor: s.side === 'enemy' ? '#ff4a5f' : '#22c55e',
      hitFlash: s.hitFlash || 0,
      idleTime: s._idleTimeV61 || 0,
      time: state.time || 0,
    });
    ctx.globalAlpha = 1;

    // 状态特效层
    if (s.statusEffects) drawStatusFXV61(ctx, geom, s.statusEffects, headR, state.time || 0);

    // 血条
    if (typeof drawBattleUnitHpV59 === 'function') {
      const hpY = (geom ? geom.hy - geom.headR : groundY - headR) - 7;
      drawBattleUnitHpV59(s, vis.x, hpY, Math.max(24, headR * 1.6));
    }
    ctx.restore();
    if (window.RenderHooks && window.RenderHooks.afterDrawSoldier) window.RenderHooks.afterDrawSoldier.run(ctx, s);
  };
  drawSoldier._stickmanV61 = true;
})();

/* ============================================================
   Commercial chibi fruit heroes v2
   Replaces abstract tactical tokens with readable characters.
   ============================================================ */
(function installCommercialFruitHeroesV2() {
  if (typeof drawSoldier !== 'function' || window.__commercialFruitHeroesV2) return;
  window.__commercialFruitHeroesV2 = true;

  function heroWeaponV2(x, y, r, role, enemy, dir) {
    const metal = '#FFF0A8';
    const wood = '#8E552D';
    const accent = enemy ? '#FF6687' : '#55E8C1';
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir || 1, 1);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    if (role === 'shell' || role === 'spike') {
      ctx.fillStyle = accent; ctx.strokeStyle = metal; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(r*.32,-r*.18); ctx.lineTo(r*.72,-r*.05); ctx.lineTo(r*.64,r*.48);
      ctx.lineTo(r*.32,r*.68); ctx.lineTo(r*.06,r*.48); ctx.lineTo(r*.02,-r*.05); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = metal; ctx.beginPath(); ctx.arc(r*.35,r*.22,r*.09,0,Math.PI*2); ctx.fill();
    } else if (role === 'raider') {
      ctx.strokeStyle = wood; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(r*.12,r*.54); ctx.lineTo(r*.75,-r*.55); ctx.stroke();
      ctx.fillStyle = metal;
      ctx.beginPath(); ctx.moveTo(r*.72,-r*.65); ctx.lineTo(r*.91,-r*.48); ctx.lineTo(r*.64,-r*.42); ctx.closePath(); ctx.fill();
    } else if (role === 'shooter') {
      ctx.strokeStyle = metal; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(r*.30,r*.06,r*.42,-Math.PI*.62,Math.PI*.62); ctx.stroke();
      ctx.strokeStyle = '#F8F4D7'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(r*.14,-r*.28); ctx.lineTo(r*.14,r*.40); ctx.stroke();
      ctx.strokeStyle = wood; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-r*.05,r*.15); ctx.lineTo(r*.68,-r*.16); ctx.stroke();
      ctx.fillStyle = metal; ctx.beginPath(); ctx.moveTo(r*.70,-r*.16); ctx.lineTo(r*.55,-r*.28); ctx.lineTo(r*.57,-r*.07); ctx.closePath(); ctx.fill();
    } else if (role === 'wildcard') {
      ctx.fillStyle = '#274B62'; ctx.strokeStyle = metal; ctx.lineWidth = 2;
      roundRect(r*.02,-r*.16,r*.74,r*.34,r*.12); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#111D2B'; ctx.beginPath(); ctx.arc(r*.12,r*.28,r*.14,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(r*.62,r*.28,r*.14,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(r*.77,0,r*.11,0,Math.PI*2); ctx.fill();
    } else {
      ctx.strokeStyle = wood; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(r*.06,r*.56); ctx.lineTo(r*.45,-r*.50); ctx.stroke();
      ctx.fillStyle = accent; ctx.strokeStyle = metal; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(r*.48,-r*.57,r*.18,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#FFF8C7'; ctx.beginPath(); ctx.arc(r*.43,-r*.62,r*.055,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  function drawCommercialHeroV2(s) {
    if (!s || !s.alive) return;
    const t = TYPES[s.type] || TYPES[DEFAULT_DECK[0]];
    const role = t.role || 'front';
    const tier = typeof battleUnitTierKeyV59 === 'function' ? battleUnitTierKeyV59(s) : 'small';
    const tierScale = ({small:1,large:1.08,elite:1.17,advanced:1.26,legendary:1.38})[tier] || 1;
    const baseY = typeof battleVisualYV59 === 'function' ? battleVisualYV59(s) : s.y;
    const depth = .80 + .20 * ((baseY - LAYOUT.fieldY) / Math.max(1, LAYOUT.fieldH));
    const r = (22.5 + Math.min(5, Math.max(0, (s.level || 1) - 1)) * 1.45) * depth * tierScale;
    const vis = typeof battleVisualPosV59 === 'function' ? battleVisualPosV59(s, r) : {x:s.x,y:baseY};
    const enemy = s.side === 'enemy';
    const team = typeof commercialTeamV2 === 'function' ? commercialTeamV2(enemy) : (enemy
      ? {main:'#F04D72',deep:'#6E173D',glow:'#FF7895',trim:'#FFD37A'}
      : {main:'#2ED6B4',deep:'#075C68',glow:'#65F6D2',trim:'#FFD37A'});
    const hpRatio = Math.max(0, Math.min(1, (Number(s.hp)||0) / Math.max(1, Number(s.maxHp)||1)));
    const fighting = s.mode === 'fight' || s.mode === 'siege' || s.mode === 'siege_support';
    const bob = window.REDUCE_MOTION ? 0 : Math.sin((state.time||0)*7 + vis.x*.04) * (fighting ? 1.5 : .7);
    const x = vis.x, y = vis.y + bob;
    const dir = s._faceDirV61 || (enemy ? -1 : 1);

    ctx.save();
    if (typeof isInvisible === 'function' && isInvisible(s)) ctx.globalAlpha = .44;

    ctx.fillStyle = 'rgba(0,0,0,.34)';
    ctx.beginPath(); ctx.ellipse(x, y + r*.92, r*.82, r*.24, 0, 0, Math.PI*2); ctx.fill();

    if (fighting || (s.hitFlash||0) > .02) {
      const aura = ctx.createRadialGradient(x,y+r*.36,2,x,y+r*.36,r*1.65);
      aura.addColorStop(0, enemy ? 'rgba(255,85,124,.30)' : 'rgba(66,244,202,.28)');
      aura.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(x,y+r*.30,r*1.65,0,Math.PI*2); ctx.fill();
    }

    // Boots and body create a character silhouette instead of a token.
    ctx.fillStyle = '#19283B';
    ctx.beginPath(); ctx.ellipse(x-r*.28,y+r*.78,r*.28,r*.16,-.15,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x+r*.28,y+r*.78,r*.28,r*.16,.15,0,Math.PI*2); ctx.fill();

    const body = ctx.createLinearGradient(0,y-r*.05,0,y+r*.76);
    body.addColorStop(0, (s.hitFlash||0)>.02 ? '#FFFBE4' : team.main);
    body.addColorStop(.58, team.deep);
    body.addColorStop(1, '#10243A');
    ctx.fillStyle = body; ctx.strokeStyle = team.trim; ctx.lineWidth = 1.8;
    roundRect(x-r*.53,y-r*.02,r*1.06,r*.88,r*.34); ctx.fill(); ctx.stroke();

    // Cape and shoulder badge make team ownership readable without a full ring.
    ctx.fillStyle = enemy ? '#962B59' : '#0D7180';
    ctx.beginPath();
    ctx.moveTo(x-r*.46,y+r*.14); ctx.lineTo(x-r*.66,y+r*.66); ctx.lineTo(x-r*.20,y+r*.55); ctx.closePath(); ctx.fill();
    ctx.fillStyle = team.trim; ctx.beginPath(); ctx.arc(x-r*.38,y+r*.13,r*.10,0,Math.PI*2); ctx.fill();

    ctx.fillStyle = team.main; ctx.strokeStyle = '#FFF0B2'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x-r*.58,y+r*.28,r*.19,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(x+r*.58,y+r*.28,r*.19,0,Math.PI*2); ctx.fill(); ctx.stroke();

    heroWeaponV2(x + r*.06, y + r*.18, r, role, enemy, dir);

    ctx.save();
    ctx.shadowColor = team.glow; ctx.shadowBlur = (s.hitFlash||0)>.02 ? 14 : 6;
    if (typeof drawCommercialFruitFaceV2 === 'function') {
      drawCommercialFruitFaceV2(x, y-r*.27, r*.78, s.type, t.color || team.main, enemy);
    } else if (typeof window.drawFruitGlyphV62 === 'function') {
      window.drawFruitGlyphV62(ctx,x,y-r*.27,r*.78,s.type,t.color, '#FFF4D6');
    }
    ctx.restore();

    const bw = Math.max(26,r*1.7), by = y-r*1.22;
    if (hpRatio < .985 || fighting || (s.shield||0)>0) {
      ctx.fillStyle = 'rgba(4,12,22,.78)'; roundRect(x-bw/2,by,bw,5,3); ctx.fill();
      const hp = ctx.createLinearGradient(x-bw/2,0,x+bw/2,0);
      hp.addColorStop(0, hpRatio>.35 ? '#FFF06B' : '#FF7558');
      hp.addColorStop(1, hpRatio>.35 ? team.glow : '#FF3C68');
      ctx.fillStyle = hp; roundRect(x-bw/2+1,by+1,Math.max(3,(bw-2)*hpRatio),3,2); ctx.fill();
    }

    if ((s.level||1) >= 2) {
      ctx.fillStyle = '#FFD75F'; ctx.strokeStyle = '#FFF2AB'; ctx.lineWidth = 1;
      roundRect(x+r*.30,y-r*.98,25,14,6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#4A2A0A'; ctx.font = '900 9px "Nunito",sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(`Lv${s.level}`,x+r*.30+12.5,y-r*.98+7);
    }

    if (s._boss && typeof drawBossBadgeV59 === 'function') drawBossBadgeV59(s,x,y-r-30,Math.max(96,r*3.5));
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  }

  drawSoldier = function commercialHeroDrawSoldierV2(s) {
    if (window.RenderHooks?.beforeDrawSoldier) window.RenderHooks.beforeDrawSoldier.run(ctx,s);
    drawCommercialHeroV2(s);
    if (window.RenderHooks?.afterDrawSoldier) window.RenderHooks.afterDrawSoldier.run(ctx,s);
  };
  drawSoldier._commercialFruitHeroV2 = true;
})();
