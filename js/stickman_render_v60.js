/* ============================================================
   水果突击 · Stickman Renderer v60  (Phase 1B)
   ------------------------------------------------------------
   把"圆body + emoji"的兵替换为火柴人 + 水果头：
   - 4 关键帧走路循环(contact/passing) + lerp,由移动距离驱动相位
   - 16° 前倾、膝盖只向前弯(二次曲线)
   - 按职责换武器(弓/枪/剑/盾/法杖/炮)
   - 水果头保留原色 + emoji,便于一眼识别;侧身描边区分敌我
   移植自已验证原型 linirare/soldier-sketch (火柴人 · v10)。
   仅改渲染,不动任何数值/经济/战斗判定 —— combat baseline 必须不变。

   两段式:
   1) drawStickmanShape(ctx, o)  纯几何,无游戏全局依赖 -> 供预览页复用
   2) install wrapper           把 drawSoldier 换成火柴人,复用 battle_skin 的
                                depth/位置/血条工具,保持景深与 HP 一致
   ============================================================ */

/* ---------- 1) 纯几何(无游戏依赖) ---------- */

// contact 帧:前脚跟着地/后脚蹬地/手开/身最低;passing 帧:双脚交错/手近身/身最高
// 手臂与"对侧腿"同摆(右腿前↔左臂前),自然步态。
const STICK_KEYS = [
  { rf: 1,    lf: -0.9, ra: -0.8, la: 0.8,  body: -1 }, // contact R: 右腿前 + 左臂前
  { rf: 0,    lf: 0,    ra: 0,    la: 0,    body: 1 },  // passing
  { rf: -0.9, lf: 1,    ra: 0.8,  la: -0.8, body: -1 }, // contact L: 左腿前 + 右臂前
  { rf: 0,    lf: 0,    ra: 0,    la: 0,    body: 1 },  // passing
];

function stickLerpK(phase) {
  const p = ((phase % 1) + 1) % 1, i = Math.floor(p * 4) % 4, j = (i + 1) % 4, t = p * 4 - i;
  const a = STICK_KEYS[i], b = STICK_KEYS[j];
  const L = (x, y) => x + (y - x) * t;
  return { rf: L(a.rf, b.rf), lf: L(a.lf, b.lf), ra: L(a.ra, b.ra), la: L(a.la, b.la), body: L(a.body, b.body) };
}

function stickWeaponForRole(role) {
  switch (role) {
    case 'back': return 'bow';       // 葡萄/蓝莓 远程
    case 'siege': return 'cannon';   // 橙子/南瓜 攻城
    case 'front': return 'spear';    // 菠萝 枪线
    case 'tank': return 'shield';    // 西瓜/椰子 坦克
    case 'control': return 'staff';  // 冰梨 控制
    case 'support': return 'staff';  // 蜜桃 辅助
    case 'merge': return 'none';     // 奇异果/百香果 合成件
    default: return 'sword';         // rush 突击
  }
}

/* o = { cx, groundY, scale(s), phase, dir(±1), headColor, emoji, weapon,
        atk, atkT, ink, sideColor, hitFlash } */
function stickPaletteV60(o) {
  const enemy = o.sideColor === '#ff4a5f';
  const player = o.sideColor === '#22c55e';
  if (enemy) {
    return {
      ink: '#7f2635',
      soft: 'rgba(255,108,126,0.18)',
      rim: 'rgba(255,194,203,0.82)',
      headBase: 'rgba(255,246,232,0.74)',
    };
  }
  if (player) {
    return {
      ink: '#22663e',
      soft: 'rgba(74,211,114,0.18)',
      rim: 'rgba(218,255,225,0.86)',
      headBase: 'rgba(255,250,226,0.76)',
    };
  }
  return {
    ink: '#40513c',
    soft: 'rgba(132,173,107,0.17)',
    rim: 'rgba(255,250,226,0.78)',
    headBase: 'rgba(255,250,226,0.72)',
  };
}

function drawStickmanShape(ctx, o) {
  const s = o.scale;
  const cx = o.cx, GROUND = o.groundY, dir = o.dir >= 0 ? 1 : -1;
  const pal = stickPaletteV60(o);
  const baseInk = o.ink && o.ink !== '#1b1b1b' ? o.ink : pal.ink;
  const ink = o.hitFlash > 0 ? '#ffffff' : baseInk;
  const k = stickLerpK(o.phase || 0);
  const lean = 0.28 * dir;               // ~16° 前倾
  const stride = s * 5.5;                 // 沿行进方向的跨步幅度
  const bob = s * 3.6;                     // 踩步起伏(加大,削弱"平移感")
  const adv = o.advDir === 1 ? 1 : -1;     // 行进方向的屏幕 y 号(玩家上=-1/敌方下=+1,由 wrapper 传)

  const hipX = cx, hipY = GROUND - s * 12 - k.body * bob; // passing 帧身体抬高,contact 帧下沉
  const bodyLen = s * 7.6;                // 躯干缩短(更 Q 版)
  const lungeX = dir * (o.atkT || 0) * s * 2.4; // 出手时上半身前刺(腿不动)
  const shX = hipX + Math.sin(lean) * bodyLen + lungeX, shY = hipY - Math.cos(lean) * bodyLen;
  const neck = s * 4;
  const hx = shX + Math.sin(lean) * neck, hy = shY - Math.cos(lean) * neck - s * 2.6; // 头更贴肩

  // 腿:沿"行进方向(竖向为主)"前后跨步 —— fn=+1 前脚(朝目标)、-1 后脚,前摆脚抬起,
  // 使竖向移动读出"走"的感觉(而不是侧向摆腿+身体平移)。左右两腿分开、反相摆。
  function leg(fn, sideSign, alpha) {
    ctx.globalAlpha = alpha;
    const fx = hipX + sideSign * s * 1.8;         // 左右分开,避免两腿重合
    const reach = adv * fn * stride;              // 沿行进方向前后跨
    const lift = Math.max(0, fn) * s * 3.2;       // 前摆脚抬离地面
    const fy = GROUND + reach - lift;
    const kx = hipX + sideSign * s * 1.4;
    const ky = hipY + (GROUND - hipY) * 0.45 + reach * 0.35 - lift * 0.6;
    ctx.strokeStyle = ink; ctx.lineWidth = s * 1.75; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hipX, hipY);
    ctx.quadraticCurveTo(kx, ky, fx, fy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fx - s * 1.4, fy); ctx.lineTo(fx + s * 1.4, fy); ctx.stroke(); // 脚掌
  }
  leg(k.lf, -1, 0.6); leg(k.rf, 1, 1);
  ctx.globalAlpha = 1;

  // 躯干
  ctx.save();
  ctx.translate((hipX + shX) / 2, (hipY + shY) / 2);
  ctx.rotate(lean * 0.72);
  ctx.fillStyle = pal.soft;
  ctx.strokeStyle = pal.rim;
  ctx.lineWidth = Math.max(0.8, s * 0.34);
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 3.2, s * 5.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = ink; ctx.lineWidth = s * 2.05; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(shX, shY); ctx.stroke();

  // 手臂(交替摆)
  const arm = s * 9;
  const rAng = 0.4 + k.ra * 0.8 + lean, rx = shX + Math.cos(rAng) * arm, ry = shY + Math.sin(rAng) * arm;
  const lAng = -2.8 + k.la * 0.8 + lean, lx = shX + Math.cos(lAng) * arm, ly = shY + Math.sin(lAng) * arm;
  ctx.lineWidth = s * 1.55; ctx.strokeStyle = ink;
  ctx.beginPath(); ctx.moveTo(shX, shY); ctx.lineTo(rx, ry); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(shX, shY); ctx.lineTo(lx, ly); ctx.stroke();

  // 武器(传入肩点做连接、果色做点缀、ink 做描边、fighting 决定备战姿态)
  drawStickWeapon(ctx, o.weapon, s, dir, { rx, ry, lx, ly, shX, shY }, o.atkT || 0, o.fighting, o.sideColor || '#888', o.headColor || '#8a6b46', ink);

  // 水果头 = emoji 本体(放大,成为视觉主体);不叠彩色脸+眼睛
  const headR = s * 7.15;
  if (o.hitFlash > 0) {
    ctx.save(); ctx.globalAlpha = 0.8; ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(hx, hy, headR * 1.05, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  ctx.save();
  ctx.fillStyle = pal.headBase;
  ctx.strokeStyle = pal.rim;
  ctx.lineWidth = Math.max(1, s * 0.42);
  ctx.beginPath();
  ctx.arc(hx, hy, headR * 1.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  // 淡淡的果色光晕(仅托底,不喧宾夺主)
  ctx.save();
  ctx.globalAlpha = 0.22; ctx.fillStyle = o.headColor || '#34c96b';
  ctx.beginPath(); ctx.arc(hx, hy, headR * 0.98, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // 侧色细环(敌我识别)
  if (o.sideColor) {
    ctx.strokeStyle = o.sideColor; ctx.lineWidth = Math.max(1, s * 0.58);
    ctx.beginPath(); ctx.arc(hx, hy, headR * 1.02, 0, Math.PI * 2); ctx.stroke();
  }
  // emoji 头
  if (o.emoji) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(headR * 2.15)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
    ctx.fillText(o.emoji, hx, hy);
  } else {
    ctx.fillStyle = o.headColor || '#34c96b';
    ctx.beginPath(); ctx.arc(hx, hy, headR, 0, Math.PI * 2); ctx.fill();
  }
  ctx.textBaseline = 'alphabetic';
  return { hx, hy, headR, shX, shY };
}

function drawStickWeapon(ctx, weapon, s, dir, hands, strike, fighting, tint, accent, ink) {
  const { rx, ry, lx, ly, shX, shY } = hands;
  accent = accent || '#8a6b46';
  ink = ink || '#40513c';
  const metal = 'rgba(255,250,226,0.9)';
  const cord = 'rgba(90,74,48,0.6)';
  const k = strike || 0;              // 出手进度 1→0(1=刚打出那一下)
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // 块头填充助手:低透明填色(果色/银) + 粗 ink 描边 —— 粗线条 Q 版大武器
  function chunk(fill, lw) { ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = fill; ctx.fill(); ctx.restore(); ctx.strokeStyle = ink; ctx.lineWidth = lw; ctx.stroke(); }

  if (weapon === 'sword') {
    // 宽刃大刀:横向前劈(绝不举过头,避开放大的水果头)。k=1 后引 → k=0 前劈
    const ang = 0.15 + k * 2.2;
    ctx.save(); ctx.translate(rx, ry); ctx.scale(dir, 1); ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.5); ctx.lineTo(s * 9, -s * 0.8); ctx.lineTo(s * 11.5, 0); ctx.lineTo(s * 9, s * 0.8); ctx.lineTo(0, s * 1.5); ctx.closePath();
    chunk(metal, s * 1.9);
    ctx.strokeStyle = accent; ctx.lineWidth = s * 2.6; ctx.beginPath(); ctx.moveTo(-s * 0.7, -s * 2.4); ctx.lineTo(-s * 0.7, s * 2.4); ctx.stroke();
    if (k > 0.3) { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = s * 1.3; ctx.beginPath(); ctx.arc(0, 0, s * 11.5, -0.5, 1.1); ctx.stroke(); }
    ctx.restore();
  } else if (weapon === 'spear') {
    // 长杆 + 宽枪头,向前突刺
    const thrust = k * s * 7;
    ctx.save(); ctx.translate(rx, ry); ctx.rotate(0.1 * dir); ctx.scale(dir, 1); ctx.translate(thrust, 0);
    ctx.strokeStyle = accent; ctx.lineWidth = s * 2.1; ctx.beginPath(); ctx.moveTo(-s * 4, 0); ctx.lineTo(s * 9, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 8, -s * 2); ctx.lineTo(s * 13, 0); ctx.lineTo(s * 8, s * 2); ctx.closePath();
    chunk(metal, s * 1.7);
    ctx.restore();
  } else if (weapon === 'cannon') {
    // 胖炮管双手扛,后坐 + 大炮口冲击
    const recoil = k * s * 3;
    const mx = (rx + lx) / 2 - dir * recoil, my = (ry + ly) / 2 + s * 1.5;
    ctx.strokeStyle = ink; ctx.lineWidth = s * 1.6; ctx.beginPath(); ctx.moveTo(shX, shY); ctx.lineTo(mx, my); ctx.stroke();
    ctx.save(); ctx.translate(mx, my); ctx.scale(dir, 1); ctx.rotate(-0.08);
    ctx.beginPath(); ctx.moveTo(-s * 2, -s * 2.8); ctx.lineTo(s * 6, -s * 2.4); ctx.arc(s * 6, 0, s * 2.4, -Math.PI / 2, Math.PI / 2); ctx.lineTo(-s * 2, s * 2.8); ctx.closePath();
    chunk(accent, s * 2.0);
    if (k > 0.5) { ctx.strokeStyle = 'rgba(255,170,60,0.95)'; ctx.lineWidth = s * 1.3; ctx.beginPath(); ctx.arc(s * 9, 0, s * (2.2 + (1 - k) * 6), 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  } else if (weapon === 'shield') {
    // 大圆盾在身前(dir 侧,胸高);出手前顶(盾击/格挡)
    const bash = (fighting ? s * 1 : 0) + k * s * 3.6;
    ctx.save(); ctx.translate(shX + dir * (s * 3 + bash), shY + s * 4); ctx.scale(dir, 1);
    ctx.beginPath(); ctx.arc(0, 0, s * 5, 0, Math.PI * 2); chunk(accent, s * 2.2);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = s * 0.9; ctx.beginPath(); ctx.arc(0, 0, s * 2.9, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(0, 0, s * 1.0, 0, Math.PI * 2); ctx.fill();
    if (k > 0.4) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = s * 0.9; ctx.beginPath(); ctx.arc(s * 6.5, 0, s * (1.6 + (1 - k) * 4), -0.9, 0.9); ctx.stroke(); }
    ctx.restore();
  } else if (weapon === 'bow') {
    // 厚弓横持;满弦 → 松弦 + 箭飞出
    ctx.save(); ctx.translate(lx, ly); ctx.scale(dir, 1);
    const draw = fighting ? (k > 0.05 ? (1 - k) * s * 3 : s * 4) : s * 1;
    ctx.strokeStyle = accent; ctx.lineWidth = s * 2.1; ctx.beginPath(); ctx.arc(0, 0, s * 7, -1.15, 1.15); ctx.stroke();
    ctx.strokeStyle = cord; ctx.lineWidth = s * 0.7;
    ctx.beginPath(); ctx.moveTo(Math.cos(-1.15) * s * 7, Math.sin(-1.15) * s * 7); ctx.lineTo(-draw, 0); ctx.lineTo(Math.cos(1.15) * s * 7, Math.sin(1.15) * s * 7); ctx.stroke();
    if (k > 0.05) { const ax = s * 5 + (1 - k) * s * 20; ctx.strokeStyle = ink; ctx.lineWidth = s * 1.1; ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax + s * 5, 0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(ax + s * 5, 0); ctx.lineTo(ax + s * 3.3, -s * 1.4); ctx.moveTo(ax + s * 5, 0); ctx.lineTo(ax + s * 3.3, s * 1.4); ctx.stroke(); }
    ctx.restore();
  } else if (weapon === 'staff') {
    // 长杖前斜 + 大宝珠(果色);出手放大法术环。杖朝前下,珠不碰头
    ctx.save(); ctx.translate(rx, ry); ctx.scale(dir, 1); ctx.rotate(0.5 - k * 0.25);
    ctx.strokeStyle = ink; ctx.lineWidth = s * 1.5; ctx.beginPath(); ctx.moveTo(-s * 2, 0); ctx.lineTo(s * 8, 0); ctx.stroke();
    ctx.beginPath(); ctx.arc(s * 9, 0, s * 2.6, 0, Math.PI * 2); chunk(accent, s * 1.7);
    if (k > 0.3) { ctx.strokeStyle = accent; ctx.globalAlpha = k; ctx.lineWidth = s * 0.9; ctx.beginPath(); ctx.arc(s * 9, 0, s * (3.4 + (1 - k) * 6), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    ctx.restore();
  }
  // 'none' -> 空手
}

/* 状态特效层(纯几何):g = drawStickmanShape 的返回, se = s.statusEffects, time 用于动画 */
function drawStatusFX(ctx, g, se, s, time) {
  if (!se || !g) return;
  const t = time || 0;
  // 冰冻:淡蓝覆盖 + 冰晶
  if (se.frozen && se.frozen.timer > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(150,220,255,0.9)'; ctx.lineWidth = s * 0.6;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(g.hx + Math.cos(a) * g.headR * 1.4, g.hy + Math.sin(a) * g.headR * 1.4);
      ctx.lineTo(g.hx + Math.cos(a) * g.headR * 2.1, g.hy + Math.sin(a) * g.headR * 2.1); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(160,225,255,0.28)';
    ctx.beginPath(); ctx.arc(g.hx, (g.hy + g.shY) / 2, g.headR * 2.0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // 点燃:向上飘的火焰粒子
  if (se.burning && se.burning.timer > 0) {
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const ph = (t * 2 + i * 0.4) % 1;
      const fy = g.shY - ph * s * 12, fx = g.shX + Math.sin((t * 6) + i) * s * 2;
      const rad = s * (1.6 - ph);
      ctx.globalAlpha = (1 - ph) * 0.85;
      ctx.fillStyle = ph < 0.5 ? '#ff9b3a' : '#ff5a2a';
      ctx.beginPath(); ctx.arc(fx, fy, Math.max(0.5, rad), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  // 减速:脚下墨绿泥潭圈
  if (se.slowed && se.slowed.timer > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(90,150,70,0.8)'; ctx.lineWidth = s * 0.7;
    ctx.beginPath(); ctx.ellipse(g.hx, g.hy + s * 15.5, g.headR * 1.6, g.headR * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  // 眩晕:头顶旋转的星星
  if (se.stunned && se.stunned.timer > 0) {
    ctx.save();
    ctx.fillStyle = '#ffe04a';
    for (let i = 0; i < 3; i++) {
      const a = t * 6 + (i / 3) * Math.PI * 2;
      const sx = g.hx + Math.cos(a) * g.headR * 1.5, sy = g.hy - g.headR * 1.6 + Math.sin(a) * g.headR * 0.5;
      ctx.font = `${Math.round(s * 4)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('⭐', sx, sy);
    }
    ctx.restore();
  }
  // 破甲:身体白色闪烁碎片
  if (se.armorBreak && se.armorBreak.timer > 0) {
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(t * 12));
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = s * 0.5;
    ctx.beginPath(); ctx.moveTo(g.shX - s * 2, g.shY + s * 3); ctx.lineTo(g.shX + s * 2, g.shY + s * 6); ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.textBaseline = 'alphabetic';
}

/* ---------- 2) 游戏集成:替换 drawSoldier ---------- */
(function installStickmanRenderV60() {
  if (typeof drawSoldier !== 'function' || drawSoldier._stickmanV60) return;
  const prevDraw = drawSoldier;

  function walkPhase(s, moved) {
    if (moved > 0.15) s._walkPhase = (s._walkPhase || 0) + Math.min(0.07, moved * 0.03);
    return s._walkPhase || 0;
  }

  function faceDir(s) {
    const foes = s.side === 'player' ? state.enemySoldiers : state.playerSoldiers;
    let nearest = null, nd = Infinity;
    for (const e of (foes || [])) {
      if (!e || !e.alive) continue;
      const d = Math.abs(e.x - s.x) + Math.abs(e.y - s.y);
      if (d < nd) { nd = d; nearest = e; }
    }
    if (nearest && Math.abs(nearest.x - s.x) > 6) s._faceDir = nearest.x > s.x ? 1 : -1;
    if (s._faceDir === undefined) s._faceDir = s.side === 'player' ? 1 : -1;
    return s._faceDir;
  }

  drawSoldier = function stickmanDrawSoldier(s) {
    if (!s || !s.alive) return;
    if (typeof battleVisualPosV59 !== 'function' || typeof battleVisualYV59 !== 'function') return prevDraw(s);

    const t = TYPES[s.type] || TYPES[DEFAULT_DECK[0]];
    const tier = typeof battleUnitTierKeyV59 === 'function' ? battleUnitTierKeyV59(s) : 'normal';
    const st = battleUnitStyleV59(s.side);
    const baseY = battleVisualYV59(s);
    const depth = 0.76 + 0.22 * ((baseY - LAYOUT.fieldY) / LAYOUT.fieldH);
    const tierScale = typeof battleUnitTierScaleV59 === 'function' ? battleUnitTierScaleV59(tier) : 1;
    const roleScale = typeof battleUnitRoleScaleV59 === 'function' ? battleUnitRoleScaleV59(s.type) : 1;
    const r = (13 + (s.level || 1) * 1.18) * depth * tierScale * roleScale;
    const vis = battleVisualPosV59(s, r);

    const dyStep = s.y - (s._pyV60 ?? s.y);
    const moved = Math.hypot((s.x - (s._pxV60 ?? s.x)), dyStep);
    s._pxV60 = s.x; s._pyV60 = s.y;
    const phase = walkPhase(s, moved);
    const dir = faceDir(s);
    // 行进方向(屏幕 y 号):明显移动时按实际速度方向,否则按阵营推进方向(玩家上/敌方下)
    const advDir = Math.abs(dyStep) > 0.05 ? (dyStep > 0 ? 1 : -1) : (s.side === 'player' ? -1 : 1);
    const scale = r * 0.13;
    const groundY = vis.y + r * 0.72;
    const fighting = s.mode === 'fight' || s.mode === 'siege' || s.mode === 'siege_support';
    // 攻击动作:检测 atkTimer 复位(即刚打出一下),触发 1→0 衰减的出手进度
    const prevT = s._prevAtkTimerV60;
    if (prevT !== undefined && (s.atkTimer || 0) > prevT + 0.02) s._strikeV60 = 1;
    s._prevAtkTimerV60 = s.atkTimer || 0;
    if ((s._strikeV60 || 0) > 0) s._strikeV60 = Math.max(0, s._strikeV60 - (dt_global || 0.016) / 0.30); // ~0.3s 动作
    const strike = s._strikeV60 || 0;

    ctx.save();
    const invis = typeof isInvisible === 'function' && isInvisible(s);
    if (invis) ctx.globalAlpha = 0.4;
    // 地面阴影 + 敌我地纹
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(vis.x, groundY + 1, r * 0.7, 3.4 + r * 0.05, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = st.main; ctx.globalAlpha = invis ? 0.25 : 0.55; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(vis.x, groundY + 1, r * 0.72, 3.6 + r * 0.05, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = invis ? 0.4 : 1;

    const geom = drawStickmanShape(ctx, {
      cx: vis.x, groundY, scale, phase, dir, advDir,
      headColor: t.color || st.main, emoji: t.icon,
      weapon: stickWeaponForRole(t.role),
      atk: fighting, atkT: strike, fighting,
      sideColor: s.side === 'enemy' ? '#ff4a5f' : '#22c55e',
      hitFlash: s.hitFlash || 0,
    });
    ctx.globalAlpha = 1;

    // 状态特效层(冰冻/点燃/减速/眩晕/破甲);隐身已经用整体半透明表达
    if (s.statusEffects) drawStatusFX(ctx, geom, s.statusEffects, scale, state.time || 0);

    if (typeof drawBattleUnitHpV59 === 'function') {
      // 血条放到"头顶之上"(用 geom 返回的头位置,避免放大后的 emoji 头压住血条)
      const hpY = (geom ? geom.hy - geom.headR : groundY - scale * 29) - 7;
      drawBattleUnitHpV59(s, vis.x, hpY, Math.max(24, r * 1.7));
    }
    ctx.restore();
  };
  drawSoldier._stickmanV60 = true;
})();
