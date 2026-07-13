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
    smokePuffs: [],
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

function addSmokePuff(x, y) {
  const j = ensureJuice();
  j.smokePuffs.push({ x, y, r: 3 + Math.random() * 4, life: 0.55 + Math.random() * 0.25, maxLife: 0.65, vy: -18 - Math.random() * 14, vx: (Math.random() - 0.5) * 16 });
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
  if (typeof attackTarget !== "function" || attackTarget._juicePatched) return;
  const oldAttack = attackTarget;
  attackTarget = function juiceAttack(s, target) {
    if (!s || !target) return oldAttack(s, target);
    const hpBefore = target.hp;
    const projBefore = state.projectiles.length;
    const fxBefore = state.attackFx.length;
    const ret = oldAttack(s, target);
    const hit = target.hp < hpBefore || state.projectiles.length > projBefore || state.attackFx.length > fxBefore;
    if (hit) {
      const isEnemy = s.side === "enemy";
      const color = isEnemy ? "#ff5544" : juiceColorForType(s.type);
      const weaponType = (typeof stickWeaponForRoleV61 === "function") ? stickWeaponForRoleV61((TYPES[s.type]||{}).role) : "sword";
      const lv = s.level || 1;
      const mul = isEnemy ? 0.7 : 1;
      switch (weaponType) {
        case "bow":
          addBeam(s.x, s.y, target.x, target.y, color, 0.12);
          addSlash(s.x, s.y, target.x, target.y, "#ffffff", 0.08, 2 * mul);
          break;
        case "cannon":
          addSparkBurst(target.x, target.y, "#ff5500", Math.round(22 * mul), 120 * mul, 5.5 * mul);
          addShockwave(target.x, target.y, "#ff8800", (35 + lv * 5) * mul, 0.42, 5 * mul);
          for (let i = 0; i < Math.round(5 * mul); i++) addSmokePuff(target.x + (Math.random()-0.5)*30, target.y + (Math.random()-0.5)*18);
          if (!isEnemy) punch(0.40 + lv * 0.06, 0.028);
          break;
        case "sword":
          addSlash(s.x, s.y, target.x, target.y, isEnemy ? "#ff9988" : "#ffffff", 0.20, 8 * mul);
          for (let g = 0; g < 2; g++) { const a = (g-0.5)*0.5; addSlash(s.x,s.y, target.x+Math.cos(a)*18, target.y+Math.sin(a)*18, "#ffeebb", 0.14, 5 * mul); }
          if (!isEnemy) punch(0.18 + lv * 0.03, 0.014);
          break;
        case "spear":
          addSlash(s.x, s.y, target.x+(target.x-s.x)*0.3, target.y+(target.y-s.y)*0.3, isEnemy ? "#ffaaaa" : "#ffffff", 0.16, 4 * mul);
          addSparkBurst(target.x, target.y, "#ffffff", Math.round(3 * mul), 40 * mul, 2.5 * mul);
          break;
        case "shield":
          addShockwave(s.x, s.y, isEnemy ? "#cc9988" : "#8899cc", (26 + lv * 4) * mul, 0.30, 4 * mul);
          if (!isEnemy) punch(0.12 + lv * 0.02, 0.010);
          break;
        default:
          addSlash(s.x, s.y, target.x, target.y, color, 0.18, 6 * mul);
      }
      if (target.hp <= 0 && hpBefore > 0) {
        addCombo(target.x, target.y, "击破");
        addSparkBurst(target.x, target.y, "#ff7a5a", 16, 88, 4);
        addShockwave(target.x, target.y, "#ff7a5a", 26, 0.34, 3);
        const fragColor = isEnemy ? "#ff6655" : "#55aa55";
        const jj = ensureJuice();
        for (let f = 0; f < 8; f++) {
          const fa = Math.random() * Math.PI * 2;
          const fd = 30 + Math.random() * 50;
          jj.sparks.push({ x: target.x, y: target.y, vx: Math.cos(fa) * fd, vy: Math.sin(fa) * fd - 15, r: 2.5 + Math.random() * 3, life: 0.45 + Math.random() * 0.2, maxLife: 0.55, color: fragColor, spin: (Math.random() - 0.5) * 10 });
        }
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
  for (let i = j.smokePuffs.length - 1; i >= 0; i--) {
    const sm = j.smokePuffs[i];
    sm.life -= dt;
    sm.x += sm.vx * dt;
    sm.y += sm.vy * dt;
    sm.r += 5 * dt;
    sm.vy *= Math.pow(0.08, dt);
    if (sm.life <= 0) j.smokePuffs.splice(i, 1);
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
    const dx = b.x2 - b.x1;
    const dy = b.y2 - b.y1;
    const sx = b.x1 + dx * 0.42;
    const sy = b.y1 + dy * 0.42;
    const ex = b.x1 + dx * 0.72;
    const ey = b.y1 + dy * 0.72;
    ctx.globalAlpha = Math.min(0.42, a * 0.58);
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 4 * a + 1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.globalAlpha = Math.min(0.38, a * 0.50);
    ctx.strokeStyle = '#fff8d0';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }

  for (const s of j.slashes) {
    const a = Math.max(0, s.life / s.maxLife);
    const dx = s.x2 - s.x1;
    const dy = s.y2 - s.y1;
    const sx = s.x1 + dx * 0.34;
    const sy = s.y1 + dy * 0.34;
    const ex = s.x1 + dx * 0.72;
    const ey = s.y1 + dy * 0.72;
    ctx.globalAlpha = Math.min(0.54, a * 0.72);
    ctx.strokeStyle = s.color;
    ctx.lineWidth = Math.min(4.5, s.width) * a;
    ctx.lineCap = 'round';
    ctx.shadowColor = s.color;
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
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

  for (const sm of j.smokePuffs) {
    const a = Math.max(0, sm.life / sm.maxLife);
    ctx.globalAlpha = a * 0.55;
    ctx.fillStyle = 'rgba(180,160,140,0.7)';
    ctx.beginPath();
    ctx.arc(sm.x, sm.y, Math.max(1, sm.r), 0, Math.PI * 2);
    ctx.fill();
  }

  for (const t of j.texts) {
    const a = Math.max(0, t.life / t.maxLife);
    ctx.globalAlpha = Math.min(1, a * 1.4);
    const callout = /破城|克制|优势|受制/.test(String(t.text || ''));
    const textSize = callout ? Math.min(12, Math.round(t.size)) : Math.min(15, Math.round(t.size));
    ctx.font = `${callout ? 700 : 800} ${textSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.58)';
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = callout ? '#C6B58F' : t.color;
    ctx.fillText(t.text, t.x, t.y);
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
