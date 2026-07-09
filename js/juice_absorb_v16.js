/* ============================================================
   水果突击 · Juice Absorb v16
   吸收 qiuqiu2 的爽感层：合成冲击 / 攻城冲击 / 命中顿帧 / 连击反馈。
   只增强表现，不改 SP 经济、不改星级倍率、不改伤害数值。
   Loaded after side_identity_fix.js.
   ============================================================ */

(function installJuiceAbsorbV16() {
  ensureJuiceV16();
  patchMergeJuiceV16();
  patchSpawnJuiceV16();
  patchAttackJuiceV16();
  patchWallJuiceV16();
  patchUpdateDrawJuiceV16();
})();

function ensureJuiceV16() {
  if (!state.juiceV16) {
    state.juiceV16 = {
      sparks: [],
      shockwaves: [],
      slashes: [],
      beams: [],
      texts: [],
      combo: 0,
      comboTimer: 0,
      hitStop: 0,
      punch: 0,
    };
  }
  return state.juiceV16;
}
function juiceV16Color(type) { return TYPES[type]?.color || THEME.gold; }
function juiceV16LevelPower(level = 1) { return Math.max(1, Math.min(7, level || 1)); }
function addJuiceSparkV16(x, y, color = THEME.gold, count = 6, power = 48, size = 2.6) {
  const j = ensureJuiceV16();
  const max = 90;
  const room = Math.max(0, max - j.sparks.length);
  count = Math.min(count, room);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = power * (0.45 + Math.random() * 0.65);
    j.sparks.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      r: size * (0.55 + Math.random() * 0.75),
      life: 0.28 + Math.random() * 0.14,
      maxLife: 0.42,
      color,
    });
  }
}
function addJuiceShockV16(x, y, color = THEME.gold, radius = 22, life = 0.34, thick = 3) {
  const j = ensureJuiceV16();
  if (j.shockwaves.length > 18) j.shockwaves.shift();
  j.shockwaves.push({ x, y, r: 4, radius, color, life, maxLife: life, thick });
}
function addJuiceSlashV16(x1, y1, x2, y2, color = '#fff2be', life = 0.16, width = 4) {
  const j = ensureJuiceV16();
  if (j.slashes.length > 24) j.slashes.shift();
  j.slashes.push({ x1, y1, x2, y2, color, life, maxLife: life, width });
}
function addJuiceBeamV16(x1, y1, x2, y2, color = THEME.gold, life = 0.16, width = 4) {
  const j = ensureJuiceV16();
  if (j.beams.length > 22) j.beams.shift();
  j.beams.push({ x1, y1, x2, y2, color, life, maxLife: life, width });
}
function addJuiceTextV16(x, y, text, color = THEME.gold, size = 14, life = 0.62) {
  const j = ensureJuiceV16();
  if (j.texts.length > 22) j.texts.shift();
  j.texts.push({ x, y, text, color, size, life, maxLife: life, vy: -30 - Math.random() * 10 });
}
function punchV16(power = 0.22, stop = 0.012) {
  const j = ensureJuiceV16();
  state.shake = Math.max(state.shake || 0, power);
  j.punch = Math.max(j.punch || 0, power);
  j.hitStop = Math.max(j.hitStop || 0, stop);
}
function addComboV16(x, y, label = '击破') {
  const j = ensureJuiceV16();
  j.combo++;
  j.comboTimer = 1.8;
  if (j.combo >= 3) addJuiceTextV16(x, y - 18, `${label} x${j.combo}`, THEME.gold, Math.min(22, 13 + j.combo), 0.75);
}

function patchMergeJuiceV16() {
  if (typeof tryMerge !== 'function' || tryMerge._juiceAbsorbV16) return;
  const oldTryMerge = tryMerge;
  tryMerge = function tryMergeJuiceV16(slots, fromR, fromC, toR, toC) {
    const before = slots[toR]?.[toC];
    const result = oldTryMerge(slots, fromR, fromC, toR, toC);
    if (result && result.merged) {
      const enemyBoard = slots === state.enemySlots;
      const center = slotCenter(toR, toC, enemyBoard);
      const level = juiceV16LevelPower(result.newLevel || before?.level || 1);
      const color = juiceV16Color(result.type);
      addJuiceShockV16(center.x, center.y, color, 26 + level * 7, 0.34 + level * 0.025, 3.2);
      addJuiceSparkV16(center.x, center.y, color, 8 + level * 2, 62 + level * 8, 2.8 + level * 0.25);
      if (!enemyBoard) {
        addJuiceTextV16(center.x, center.y - 34, level >= 5 ? '质变进阶!' : level >= 3 ? '高级合成!' : 'BUILD UP!', THEME.gold, level >= 5 ? 18 : 15, 0.72);
        punchV16(0.24 + level * 0.045, level >= 5 ? 0.032 : 0.018);
        if (level >= 5) addJuiceShockV16(center.x, center.y, '#fff2be', 62, 0.48, 5);
      }
    }
    return result;
  };
  tryMerge._juiceAbsorbV16 = true;
}

function patchSpawnJuiceV16() {
  if (typeof spawnSoldierFromBall !== 'function' || spawnSoldierFromBall._juiceAbsorbV16) return;
  const oldSpawn = spawnSoldierFromBall;
  spawnSoldierFromBall = function spawnSoldierJuiceV16(ball, r, c, side, forced = false) {
    const soldier = oldSpawn(ball, r, c, side, forced);
    if (soldier && side === 'player') {
      const center = slotCenter(r, c, false);
      const color = forced ? THEME.gold : juiceV16Color(ball.type);
      const targetY = Math.min(LAYOUT.playerWallY - 5, soldier.y || center.y);
      addJuiceBeamV16(center.x, center.y, soldier.laneX || center.x, targetY, color, forced ? 0.22 : 0.13, forced ? 5 : 3);
      addJuiceSparkV16(center.x, center.y, color, forced ? 10 : 5, forced ? 66 : 38, forced ? 3.5 : 2.2);
      if (forced) {
        addJuiceTextV16(center.x, center.y - 36, '急派冲锋!', THEME.gold, 16, 0.58);
        punchV16(0.28, 0.014);
      }
    }
    return soldier;
  };
  spawnSoldierFromBall._juiceAbsorbV16 = true;
}

function patchAttackJuiceV16() {
  if (typeof attackTarget !== 'function' || attackTarget._juiceAbsorbV16) return;
  const oldAttack = attackTarget;
  attackTarget = function attackTargetJuiceV16(s, target) {
    if (!s || !target) return oldAttack(s, target);
    const hpBefore = target.hp;
    const shieldBefore = target.shield || 0;
    const projBefore = state.projectiles.length;
    const fxBefore = state.attackFx.length;
    const ret = oldAttack(s, target);
    if (s.side !== 'player') return ret;

    const damaged = target.hp < hpBefore || (target.shield || 0) < shieldBefore;
    const fired = state.projectiles.length > projBefore || state.attackFx.length > fxBefore;
    if (damaged || fired) {
      const color = juiceV16Color(s.type);
      const mx = (s.x + target.x) / 2;
      const my = (s.y + target.y) / 2;
      const role = TYPES[s.type]?.role;
      if (role === 'back' || role === 'control' || role === 'siege' || role === 'support') {
        addJuiceBeamV16(s.x, s.y, target.x, target.y, color, 0.12, s.level >= 5 ? 5 : 3);
        addJuiceSparkV16(target.x, target.y, color, 3 + Math.min(5, s.level || 1), 34 + (s.level || 1) * 4, 2.1);
      } else {
        addJuiceSlashV16(s.x, s.y, target.x, target.y, color, 0.15, s.level >= 5 ? 6 : 4);
        addJuiceSparkV16(mx, my, color, 4 + Math.min(6, (s.level || 1) * 1.3), 48 + (s.level || 1) * 5, 2.6);
      }

      const counterMul = typeof roleCounterMultiplier === 'function' ? roleCounterMultiplier(s.type, target.type) : 1;
      if (counterMul >= 1.25) {
        addJuiceShockV16(target.x, target.y, THEME.gold, 20 + (s.level || 1) * 2, 0.24, 2.5);
        if ((s.level || 1) >= 3) addJuiceTextV16(target.x, target.y - 30, '克制!', THEME.gold, 14, 0.48);
        punchV16(0.22 + (s.level || 1) * 0.025, 0.018);
      } else {
        punchV16(0.10 + (s.level || 1) * 0.012, 0.007);
      }
      if (target.hp <= 0 && hpBefore > 0) {
        addComboV16(target.x, target.y, '击破');
        addJuiceSparkV16(target.x, target.y, '#ff7a5a', 10, 68, 3.4);
        addJuiceShockV16(target.x, target.y, '#ff7a5a', 24, 0.30, 3);
      }
    }
    return ret;
  };
  attackTarget._juiceAbsorbV16 = true;
}

function patchWallJuiceV16() {
  if (typeof attackWall !== 'function' || attackWall._juiceAbsorbV16) return;
  const oldWall = attackWall;
  attackWall = function attackWallJuiceV16(s) {
    const enemyBefore = state.enemyWallHp;
    const playerBefore = state.playerWallHp;
    const ret = oldWall(s);
    const hitEnemyWall = s && s.side === 'player' && state.enemyWallHp < enemyBefore;
    const hitPlayerWall = s && s.side === 'enemy' && state.playerWallHp < playerBefore;
    if (hitEnemyWall) {
      const wall = wallDataFor(s);
      const color = s.type === 'orange_cannon' || s.type === 'pumpkin_roller' ? THEME.gold : juiceV16Color(s.type);
      addJuiceSparkV16(s.x, wall.wallY + wall.wallH + 4, color, 9 + (s.level || 1) * 2, 72 + (s.level || 1) * 8, 3.2);
      addJuiceShockV16(s.x, wall.wallY + wall.wallH + 4, color, 24 + (s.level || 1) * 5, 0.32, 3.5);
      addJuiceTextV16(s.x, wall.wallY + wall.wallH + 22, s.type === 'orange_cannon' ? '重炮破城!' : '破城!', THEME.gold, 14 + Math.min(5, s.level || 1), 0.54);
      punchV16(0.32 + (s.level || 1) * 0.035, 0.020);
    } else if (hitPlayerWall) {
      const wall = wallDataFor(s);
      addJuiceSparkV16(s.x, wall.wallY - 4, THEME.accent, 7, 52, 2.8);
      addJuiceShockV16(s.x, wall.wallY - 4, THEME.accent, 22, 0.28, 3);
      punchV16(0.24, 0.012);
    }
    return ret;
  };
  attackWall._juiceAbsorbV16 = true;
}

function patchUpdateDrawJuiceV16() {
  if (typeof update !== 'function' || update._juiceAbsorbV16) return;
  const oldUpdate = update;
  const oldDraw = draw;

  update = function updateJuiceAbsorbV16(dt) {
    const j = ensureJuiceV16();
    if (j.hitStop > 0 && state.phase === 'playing') {
      j.hitStop = Math.max(0, j.hitStop - dt);
      updateJuiceOnlyV16(dt * 0.35);
      return;
    }
    oldUpdate(dt);
    updateJuiceOnlyV16(dt);
  };

  draw = function drawJuiceAbsorbV16() {
    oldDraw();
    drawJuiceLayerV16();
  };
  update._juiceAbsorbV16 = true;
}

function updateJuiceOnlyV16(dt) {
  const j = ensureJuiceV16();
  if (j.comboTimer > 0) j.comboTimer = Math.max(0, j.comboTimer - dt);
  else j.combo = 0;
  j.punch = Math.max(0, (j.punch || 0) - dt * 2.8);

  for (const arrName of ['shockwaves','slashes','beams','texts','sparks']) {
    const arr = j[arrName];
    for (let i = arr.length - 1; i >= 0; i--) {
      const o = arr[i];
      o.life -= dt;
      if (arrName === 'sparks') { o.x += o.vx * dt; o.y += o.vy * dt; o.vy += 65 * dt; }
      if (arrName === 'texts') { o.y += o.vy * dt; o.vy += 18 * dt; }
      if (arrName === 'shockwaves') o.r += (o.radius - o.r) * Math.min(1, dt * 7.5);
      if (o.life <= 0) arr.splice(i, 1);
    }
  }
}

function drawJuiceLayerV16() {
  const j = ensureJuiceV16();
  ctx.save();

  // beams/slashes below text, above battlefield.
  for (const b of j.beams) {
    const a = clamp01(b.life / b.maxLife);
    ctx.globalAlpha = a * 0.74;
    ctx.strokeStyle = b.color;
    ctx.lineWidth = b.width || 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();
    ctx.globalAlpha = a * 0.32;
    ctx.lineWidth = (b.width || 3) + 5;
    ctx.stroke();
  }
  for (const s of j.slashes) {
    const a = clamp01(s.life / s.maxLife);
    ctx.globalAlpha = a * 0.82;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width || 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
  }
  for (const w of j.shockwaves) {
    const a = clamp01(w.life / w.maxLife);
    ctx.globalAlpha = a * 0.72;
    ctx.strokeStyle = w.color;
    ctx.lineWidth = (w.thick || 3) * a;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const p of j.sparks) {
    const a = clamp01(p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.8, p.r * a), 0, Math.PI * 2);
    ctx.fill();
  }
  for (const t of j.texts) {
    const a = clamp01(t.life / t.maxLife);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = `900 ${Math.round(t.size)}px sans-serif`;
    ctx.strokeStyle = 'rgba(0,0,0,0.62)';
    ctx.lineWidth = 4;
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}
