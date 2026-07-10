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
const STICK_KEYS = [
  { rf: 1,    lf: -0.9, ra: 0.8,  la: -0.8, body: -1 },
  { rf: 0,    lf: 0,    ra: 0,    la: 0,    body: 1 },
  { rf: -0.9, lf: 1,    ra: -0.8, la: 0.8,  body: -1 },
  { rf: 0,    lf: 0,    ra: 0,    la: 0,    body: 1 },
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
function drawStickmanShape(ctx, o) {
  const s = o.scale;
  const cx = o.cx, GROUND = o.groundY, dir = o.dir >= 0 ? 1 : -1;
  const ink = o.hitFlash > 0 ? '#ffffff' : (o.ink || '#1b1b1b');
  const k = stickLerpK(o.phase || 0);
  const lean = 0.28 * dir;               // ~16° 前倾
  const stride = s * 9;
  const bob = s * 2.5;

  const hipX = cx, hipY = GROUND - s * 12 + k.body * bob;
  const bodyLen = s * 10;
  const shX = hipX + Math.sin(lean) * bodyLen, shY = hipY - Math.cos(lean) * bodyLen;
  const neck = s * 4;
  const hx = shX + Math.sin(lean) * neck, hy = shY - Math.cos(lean) * neck - s * 3.5;

  // 腿(远腿半透明模拟纵深)
  function leg(fn, alpha) {
    ctx.globalAlpha = alpha;
    const fx = hipX + dir * fn * stride, fy = GROUND;
    const lift = Math.abs(fn) > 0.3 ? Math.abs(fn) * s * 3 : 0;
    const kx = hipX + dir * fn * stride * 0.3 + dir * s * 2.5, ky = hipY + (fy - hipY) * 0.4 - lift;
    ctx.strokeStyle = ink; ctx.lineWidth = s * 1.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hipX, hipY);
    ctx.quadraticCurveTo(kx, ky, fx, fy - lift * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fx - s * 1.5, fy - lift * 0.6); ctx.lineTo(fx + s * 1.5, fy - lift * 0.6); ctx.stroke();
  }
  leg(k.lf, 0.5); leg(k.rf, 1);
  ctx.globalAlpha = 1;

  // 躯干
  ctx.strokeStyle = ink; ctx.lineWidth = s * 1.8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(shX, shY); ctx.stroke();

  // 手臂(交替摆)
  const arm = s * 9;
  const rAng = 0.4 + k.ra * 0.8 + lean, rx = shX + Math.cos(rAng) * arm, ry = shY + Math.sin(rAng) * arm;
  const lAng = -2.8 + k.la * 0.8 + lean, lx = shX + Math.cos(lAng) * arm, ly = shY + Math.sin(lAng) * arm;
  ctx.lineWidth = s * 1.3; ctx.strokeStyle = ink;
  ctx.beginPath(); ctx.moveTo(shX, shY); ctx.lineTo(rx, ry); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(shX, shY); ctx.lineTo(lx, ly); ctx.stroke();

  // 武器
  drawStickWeapon(ctx, o.weapon, s, dir, { rx, ry, lx, ly }, o.atk, o.atkT || 0, o.sideColor || '#888');

  // 水果头:原色圆盘 + 侧色描边 + 眼睛 + emoji
  const headR = s * 3.6;
  ctx.fillStyle = o.hitFlash > 0 ? '#ffffff' : (o.headColor || '#34c96b');
  ctx.beginPath(); ctx.arc(hx, hy, headR, 0, Math.PI * 2); ctx.fill();
  if (o.sideColor) { ctx.strokeStyle = o.sideColor; ctx.lineWidth = s * 0.7; ctx.stroke(); }
  // 眼睛(朝 dir)
  ctx.fillStyle = '#141414';
  ctx.beginPath(); ctx.arc(hx + dir * s * 0.4, hy - s * 0.2, s * 0.85, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(hx + dir * s * 1.9, hy - s * 0.2, s * 0.85, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(hx + dir * s * 0.5, hy - s * 0.5, s * 0.26, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(hx + dir * s * 2.1, hy - s * 0.5, s * 0.26, 0, Math.PI * 2); ctx.fill();
  if (o.emoji) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(headR * 1.35)}px sans-serif`;
    ctx.globalAlpha = 0.9;
    ctx.fillText(o.emoji, hx, hy - headR - s * 2.2);
    ctx.globalAlpha = 1;
  }
  ctx.textBaseline = 'alphabetic';
  return { hx, hy, headR, shX, shY };
}

function drawStickWeapon(ctx, weapon, s, dir, hands, atk, atkT, tint) {
  const { rx, ry, lx, ly } = hands;
  if (weapon === 'bow') {
    const bx = lx + dir * 2, by = ly - 2 * s, pull = (atk ? atkT : 0) * s * 8;
    ctx.strokeStyle = '#8a6b46'; ctx.lineWidth = s; ctx.beginPath(); ctx.arc(bx + pull * 0.2, by, s * 5, -1.1, 1.1); ctx.stroke();
    ctx.strokeStyle = '#6f5636'; ctx.lineWidth = s * 0.5;
    ctx.beginPath(); ctx.moveTo(bx + s * 4, by - s); ctx.lineTo(bx - pull, by + pull * 0.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx + s * 4, by + s); ctx.lineTo(bx - pull, by - pull * 0.1); ctx.stroke();
    if (atk && atkT > 0.5) { ctx.strokeStyle = '#fff'; ctx.lineWidth = s * 1.1; ctx.beginPath(); ctx.moveTo(bx + 2, by); ctx.lineTo(bx + dir * s * 6, by); ctx.stroke(); }
  } else if (weapon === 'spear') {
    ctx.save(); ctx.translate(rx, ry); ctx.rotate(0.15 * dir + (atk ? -0.25 * atkT : 0)); ctx.scale(dir, 1);
    ctx.strokeStyle = '#a08060'; ctx.lineWidth = s; ctx.beginPath(); ctx.moveTo(-s * 2, 0); ctx.lineTo(s * 9, 0); ctx.stroke();
    ctx.fillStyle = '#dfe3e8'; ctx.beginPath(); ctx.moveTo(s * 9, 0); ctx.lineTo(s * 5, -s * 1.8); ctx.lineTo(s * 6.5, 0); ctx.lineTo(s * 5, s * 1.8); ctx.fill();
    ctx.restore();
  } else if (weapon === 'cannon') {
    ctx.save(); ctx.translate(rx, ry); ctx.scale(dir, 1); ctx.rotate(-0.12);
    ctx.fillStyle = '#5a5f6b'; ctx.strokeStyle = '#33373f'; ctx.lineWidth = s * 0.6;
    ctx.beginPath(); ctx.moveTo(0, -s * 1.8); ctx.lineTo(s * 7, -s * 2.4); ctx.lineTo(s * 7, s * 2.4); ctx.lineTo(0, s * 1.8); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (atk && atkT > 0.6) { ctx.fillStyle = 'rgba(255,180,80,0.85)'; ctx.beginPath(); ctx.arc(s * 8, 0, s * 2.2, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  } else if (weapon === 'shield') {
    ctx.save(); ctx.translate(lx, ly); ctx.scale(dir, 1);
    ctx.fillStyle = tint; ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = s * 0.6;
    ctx.beginPath(); ctx.moveTo(0, -s * 4); ctx.lineTo(s * 3.2, -s * 2.4); ctx.lineTo(s * 3.2, s * 2.4); ctx.lineTo(0, s * 4); ctx.lineTo(-s * 1.2, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  } else if (weapon === 'staff') {
    ctx.save(); ctx.translate(rx, ry); ctx.scale(dir, 1); ctx.rotate(-0.05);
    ctx.strokeStyle = '#9a7b52'; ctx.lineWidth = s * 0.9; ctx.beginPath(); ctx.moveTo(0, s * 2); ctx.lineTo(0, -s * 7); ctx.stroke();
    ctx.fillStyle = tint; ctx.beginPath(); ctx.arc(0, -s * 7.5, s * 1.7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else if (weapon === 'sword') {
    ctx.save(); ctx.translate(rx, ry); ctx.scale(dir, 1); ctx.rotate(-0.1 + (atk ? -0.5 * atkT : 0));
    ctx.strokeStyle = '#c9ccd2'; ctx.lineWidth = s * 1.2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * 6.5, 0); ctx.stroke();
    ctx.strokeStyle = '#8a6b46'; ctx.lineWidth = s * 1.2; ctx.beginPath(); ctx.moveTo(-s * 0.4, -s); ctx.lineTo(-s * 0.4, s); ctx.stroke();
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

    const moved = Math.hypot((s.x - (s._pxV60 ?? s.x)), (s.y - (s._pyV60 ?? s.y)));
    s._pxV60 = s.x; s._pyV60 = s.y;
    const phase = walkPhase(s, moved);
    const dir = faceDir(s);
    const scale = r * 0.13;
    const groundY = vis.y + r * 0.72;
    const fighting = s.mode === 'fight' || s.mode === 'siege' || s.mode === 'siege_support';
    const atkT = fighting ? (((state.time || 0) * 1.7) % 1) : 0;

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
      cx: vis.x, groundY, scale, phase, dir,
      headColor: t.color || st.main, emoji: t.icon,
      weapon: stickWeaponForRole(t.role),
      atk: fighting, atkT,
      sideColor: s.side === 'enemy' ? '#ff4a5f' : '#22c55e',
      hitFlash: s.hitFlash || 0,
    });
    ctx.globalAlpha = 1;

    // 状态特效层(冰冻/点燃/减速/眩晕/破甲);隐身已经用整体半透明表达
    if (s.statusEffects) drawStatusFX(ctx, geom, s.statusEffects, scale, state.time || 0);

    if (typeof drawBattleUnitHpV59 === 'function') {
      drawBattleUnitHpV59(s, vis.x, groundY - scale * 29 - 8, Math.max(24, r * 1.7));
    }
    ctx.restore();
  };
  drawSoldier._stickmanV60 = true;
})();
