/* ============================================================
   合成攻城 · Merge Siege —— 爽感层 / Juice Layer
   目标：强化 build-up、攻击命中、攻城、连击、震屏和反馈密度。
   Loaded last. Wraps selected functions safely.
   ============================================================ */

(function installJuiceLayer() {
  patchJuiceState();
  patchTryMergeJuice();
  patchSpawnJuice();
  patchAttackJuice();
  patchWallJuice();
  patchUpdateDrawJuice();
})();

function patchJuiceState() {
  if (!state.juice) state.juice = createJuiceState();
}

function createJuiceState() {
  return {
    sparks: [],
    shockwaves: [],
    slashes: [],
    texts: [],
    beams: [],
    combo: 0,
    comboTimer: 0,
    hitStop: 0,
    punch: 0,
    lastPlayerWallHp: state.playerWallHp || 0,
    lastEnemyWallHp: state.enemyWallHp || 0,
  };
}

function ensureJuice() {
  if (!state.juice) state.juice = createJuiceState();
  return state.juice;
}

function juiceColorForType(type) {
  return TYPES[type]?.color || THEME.gold;
}

function addSparkBurst(x, y, color = THEME.gold, count = 10, power = 85, size = 4) {
  const j = ensureJuice();
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = power * (0.45 + Math.random() * 0.75);
    j.sparks.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      r: size * (0.55 + Math.random() * 0.85),
      life: 0.36 + Math.random() * 0.18,
      maxLife: 0.42,
      color,
      spin: (Math.random() - 0.5) * 8,
    });
  }
}

function addShockwave(x, y, color = THEME.gold, radius = 18, life = 0.38, thick = 3) {
  const j = ensureJuice();
  j.shockwaves.push({ x, y, r: 4, radius, color, life, maxLife: life, thick });
}

function addSlash(x1, y1, x2, y2, color = '#fff2be', life = 0.18, width = 5) {
  const j = ensureJuice();
  j.slashes.push({ x1, y1, x2, y2, color, life, maxLife: life, width });
}

function addJuiceText(x, y, text, color = THEME.gold, size = 16, life = 0.72) {
  const j = ensureJuice();
  j.texts.push({ x, y, text, color, size, life, maxLife: life, vy: -38 - Math.random() * 12 });
}

function addBeam(x1, y1, x2, y2, color = THEME.gold, life = 0.18) {
  const j = ensureJuice();
  j.beams.push({ x1, y1, x2, y2, color, life, maxLife: life });
}

function punch(power = 0.3, stop = 0.018) {
  const j = ensureJuice();
  state.shake = Math.max(state.shake || 0, power);
  j.punch = Math.max(j.punch, power);
  j.hitStop = Math.max(j.hitStop, stop);
}

function addCombo(x, y, label = 'COMBO') {
  const j = ensureJuice();
  j.combo++;
  j.comboTimer = 2.0;
  if (j.combo >= 3) addJuiceText(x, y - 18, `${label} x${j.combo}`, THEME.gold, Math.min(24, 14 + j.combo), 0.82);
}

function patchTryMergeJuice() {
  if (typeof tryMerge !== 'function' || tryMerge._juicePatched) return;
  const oldTryMerge = tryMerge;
  tryMerge = function juiceTryMerge(slots, fromR, fromC, toR, toC) {
    const before = slots[toR]?.[toC];
    const result = oldTryMerge(slots, fromR, fromC, toR, toC);
    if (result && result.merged) {
      const center = slotCenter(toR, toC, slots === state.enemySlots);
      const color = juiceColorForType(result.type);
      const level = result.newLevel || before?.level || 1;
      addShockwave(center.x, center.y, color, 34 + level * 7, 0.45, 4);
      addSparkBurst(center.x, center.y, color, 18 + level * 3, 95 + level * 12, 4 + level * 0.6);
      addJuiceText(center.x, center.y - 34, level >= 4 ? '高级合成!' : 'BUILD UP!', THEME.gold, level >= 4 ? 20 : 16, 0.85);
      punch(0.42 + level * 0.08, level >= 4 ? 0.045 : 0.026);
      if (level >= 5) {
        addShockwave(center.x, center.y, '#fff2be', 76, 0.62, 6);
        addJuiceText(center.x, center.y + 32, '质变进化', '#fff2be', 20, 1.0);
      }
    }
    return result;
  };
  tryMerge._juicePatched = true;
}

function patchSpawnJuice() {
  if (typeof spawnSoldierFromBall !== 'function' || spawnSoldierFromBall._juicePatched) return;
  const oldSpawn = spawnSoldierFromBall;
  spawnSoldierFromBall = function juiceSpawn(ball, r, c, side, forced = false) {
    const soldier = oldSpawn(ball, r, c, side, forced);
    if (soldier && side === 'player') {
      const center = slotCenter(r, c, false);
      const color = forced ? THEME.gold : juiceColorForType(ball.type);
      addBeam(center.x, center.y, soldier.laneX || center.x, LAYOUT.playerWallY - 5, color, forced ? 0.26 : 0.16);
      addSparkBurst(center.x, center.y, color, forced ? 12 : 7, forced ? 78 : 48, forced ? 4 : 2.6);
      if (forced) {
        addJuiceText(center.x, center.y - 36, '冲锋!', THEME.gold, 17, 0.68);
        punch(0.38, 0.018);
      }
    }
    return soldier;
  };
  spawnSoldierFromBall._juicePatched = true;
}

function patchAttackJuice() {
  if (typeof attackTarget !== 'function' || attackTarget._juicePatched) return;
  const oldAttack = attackTarget;
  attackTarget = function juiceAttack(s, target) {
    if (!s || !target) return oldAttack(s, target);
    const hpBefore = target.hp;
    const projBefore = state.projectiles.length;
    const fxBefore = state.attackFx.length;
    const ret = oldAttack(s, target);
    const hit = target.hp < hpBefore || state.projectiles.length > projBefore || state.attackFx.length > fxBefore;
    if (hit && s.side === 'player') {
      const color = juiceColorForType(s.type);
      const mx = (s.x + target.x) / 2;
      const my = (s.y + target.y) / 2;
      if (s.type === 'bow') {
        addBeam(s.x, s.y, target.x, target.y, color, 0.14);
        addSparkBurst(target.x, target.y, color, 5, 44, 2.2);
      } else {
        addSlash(s.x, s.y, target.x, target.y, color, 0.18, s.level >= 3 ? 7 : 5);
        addSparkBurst(mx, my, color, 7 + Math.min(8, s.level * 2), 62 + s.level * 8, 3);
      }
      if (target.type === COUNTER[s.type]) {
        addShockwave(target.x, target.y, THEME.gold, 22 + s.level * 3, 0.28, 3);
        addJuiceText(target.x, target.y - 28, '克制!', THEME.gold, 15 + s.level, 0.55);
        punch(0.32 + s.level * 0.04, 0.026);
      } else {
        punch(0.16 + s.level * 0.02, 0.012);
      }
      if (target.hp <= 0 && hpBefore > 0) {
        addCombo(target.x, target.y, '击破');
        addSparkBurst(target.x, target.y, '#ff7a5a', 16, 88, 4);
        addShockwave(target.x, target.y, '#ff7a5a', 26, 0.34, 3);
      }
    }
    return ret;
  };
  attackTarget._juicePatched = true;
}

function patchWallJuice() {
  if (typeof attackWall !== 'function' || attackWall._juicePatched) return;
  const oldWall = attackWall;
  attackWall = function juiceWall(s) {
    const enemyBefore = state.enemyWallHp;
    const playerBefore = state.playerWallHp;
    const ret = oldWall(s);
    const hitEnemyWall = s && s.side === 'player' && state.enemyWallHp < enemyBefore;
    const hitPlayerWall = s && s.side === 'enemy' && state.playerWallHp < playerBefore;
    if (hitEnemyWall) {
      const wall = wallDataFor(s);
      const color = s.level >= 3 ? THEME.gold : juiceColorForType(s.type);
      addSparkBurst(s.x, wall.wallY + wall.wallH + 4, color, 14 + s.level * 3, 105 + s.level * 13, 4);
      addShockwave(s.x, wall.wallY + wall.wallH + 4, color, 28 + s.level * 5, 0.36, 4);
      addJuiceText(s.x, wall.wallY + wall.wallH + 22, '破城!', THEME.gold, 15 + s.level, 0.58);
      punch(0.42 + s.level * 0.06, 0.026);
    } else if (hitPlayerWall) {
      const wall = wallDataFor(s);
      addSparkBurst(s.x, wall.wallY - 4, THEME.accent, 10, 76, 3.4);
      addShockwave(s.x, wall.wallY - 4, THEME.accent, 24, 0.32, 3);
      punch(0.35, 0.018);
    }
    return ret;
  };
  attackWall._juicePatched = true;
}

function patchUpdateDrawJuice() {
  if (typeof update !== 'function' || update._juicePatched) return;
  const oldUpdate = update;
  const oldDraw = draw;

  update = function juiceUpdate(dt) {
    const j = ensureJuice();
    if (j.hitStop > 0 && state.phase === 'playing') {
      j.hitStop = Math.max(0, j.hitStop - dt);
      updateJuiceOnly(dt * 0.35);
      return;
    }
    oldUpdate(dt);
    updateJuiceOnly(dt);
  };

  draw = function juiceDraw() {
    oldDraw();
    drawJuiceLayer();
  };

  update._juicePatched = true;
}

function updateJuiceOnly(dt) {
  const j = ensureJuice();
  j.comboTimer = Math.max(0, j.comboTimer - dt);
  if (j.comboTimer <= 0) j.combo = 0;
  j.punch = Math.max(0, j.punch - dt * 4.6);

  for (let i = j.sparks.length - 1; i >= 0; i--) {
    const p = j.sparks[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.pow(0.08, dt);
    p.vy *= Math.pow(0.08, dt);
    p.vy += 120 * dt;
    if (p.life <= 0) j.sparks.splice(i, 1);
  }
  for (let i = j.shockwaves.length - 1; i >= 0; i--) {
    const w = j.shockwaves[i];
    w.life -= dt;
    const t = 1 - w.life / w.maxLife;
    w.r = 4 + w.radius * t;
    if (w.life <= 0) j.shockwaves.splice(i, 1);
  }
  for (let i = j.slashes.length - 1; i >= 0; i--) {
    j.slashes[i].life -= dt;
    if (j.slashes[i].life <= 0) j.slashes.splice(i, 1);
  }
  for (let i = j.beams.length - 1; i >= 0; i--) {
    j.beams[i].life -= dt;
    if (j.beams[i].life <= 0) j.beams.splice(i, 1);
  }
  for (let i = j.texts.length - 1; i >= 0; i--) {
    const t = j.texts[i];
    t.life -= dt;
    t.y += t.vy * dt;
    t.vy *= Math.pow(0.12, dt);
    if (t.life <= 0) j.texts.splice(i, 1);
  }
}

function drawJuiceLayer() {
  const j = ensureJuice();
  ctx.save();

  for (const b of j.beams) {
    const a = Math.max(0, b.life / b.maxLife);
    ctx.globalAlpha = a;
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 7 * a + 1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();
    ctx.globalAlpha = Math.min(1, a * 0.85);
    ctx.strokeStyle = '#fff8d0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();
  }

  for (const s of j.slashes) {
    const a = Math.max(0, s.life / s.maxLife);
    ctx.globalAlpha = a;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width * a;
    ctx.lineCap = 'round';
    ctx.shadowColor = s.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  for (const p of j.sparks) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(1, p.r * a), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  for (const w of j.shockwaves) {
    const a = Math.max(0, w.life / w.maxLife);
    ctx.globalAlpha = a * 0.86;
    ctx.strokeStyle = w.color;
    ctx.lineWidth = w.thick * a;
    ctx.shadowColor = w.color;
    ctx.shadowBlur = 12 * a;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  for (const t of j.texts) {
    const a = Math.max(0, t.life / t.maxLife);
    ctx.globalAlpha = Math.min(1, a * 1.4);
    ctx.font = `900 ${Math.round(t.size)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.72)';
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.shadowColor = t.color;
    ctx.shadowBlur = 10;
    ctx.fillText(t.text, t.x, t.y);
    ctx.shadowBlur = 0;
  }

  if (j.combo >= 3 && j.comboTimer > 0) {
    const a = Math.min(1, j.comboTimer / 0.35);
    ctx.globalAlpha = a;
    ctx.font = '900 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = THEME.gold;
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth = 4;
    const txt = `击破连锁 x${j.combo}`;
    ctx.strokeText(txt, W / 2, LAYOUT.fieldY + 44);
    ctx.fillText(txt, W / 2, LAYOUT.fieldY + 44);
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}
