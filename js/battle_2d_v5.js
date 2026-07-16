/* ============================================================
   球球英雄二 · 纯 2D 战场 v5
   镜像棋盘 + 球形兵营 + 出兵战场 + 主公技能
   ============================================================ */
(function installBattle2DV5() {
  'use strict';

  const ART = window.Battle2DArtV5 = {
    background: new Image(),
    barracks: new Image(),
    troops: new Image(),
    commanders: new Image(),
  };

  ART.background.src = 'art/generated/battlefield-flat-2d-v5.png';
  ART.barracks.src = 'art/generated/orb-barracks-v5.png';
  ART.troops.src = 'art/generated/fruit-troops-v5.png';
  ART.commanders.src = 'art/generated/commanders-portraits-v6.png';
  for (const img of Object.values(ART)) {
    img.onload = () => requestAnimationFrame(() => {
      try { if (typeof draw === 'function') draw(); } catch (_) {}
    });
  }

  const BARRACK_RECTS = Array.from({ length: 5 }, (_, i) => ({
    x: Math.round(i * 2146 / 5), y: 74, w: Math.ceil(2146 / 5), h: 536,
  }));
  const TROOP_RECTS = Array.from({ length: 5 }, (_, i) => ({
    x: Math.round(i * 1821 / 5), y: 150, w: Math.ceil(1821 / 5), h: 548,
  }));
  const COMMANDER_RECTS = [
    { x: 0, y: 280, w: 512, h: 960 },
    { x: 512, y: 305, w: 512, h: 960 },
  ];

  function roundedPath(x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function panel(x, y, w, h, r, fill, stroke, lineWidth = 1) {
    roundedPath(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }

  function imageReady(img) {
    return img && img.complete && img.naturalWidth > 0;
  }

  function drawCover(img) {
    if (!imageReady(img)) return false;
    const scaleV = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const sw = W / scaleV;
    const sh = H / scaleV;
    const sx = (img.naturalWidth - sw) / 2;
    const sy = (img.naturalHeight - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
    return true;
  }

  function roleIndex(type) {
    if (type === 'watermelon_guard' || TYPES[type]?.role === 'tank') return 0;
    if (type === 'grape_archer' || ['back','control','support'].includes(TYPES[type]?.role)) return 1;
    if (type === 'banana_raider' || TYPES[type]?.role === 'rush') return 2;
    if (type === 'pineapple_lancer') return 3;
    if (type === 'orange_cannon' || TYPES[type]?.role === 'siege') return 4;
    return 3;
  }

  function drawAtlas(img, rects, index, x, y, w, h, rotate = 0, alpha = 1) {
    if (!imageReady(img)) return false;
    const src = rects[index] || rects[0];
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(x + w / 2, y + h / 2);
    if (rotate) ctx.rotate(rotate);
    ctx.drawImage(img, src.x, src.y, src.w, src.h, -w / 2, -h / 2, w, h);
    ctx.restore();
    return true;
  }

  function drawAtlasCover(img, rects, index, x, y, w, h, flipX = false, alpha = 1) {
    if (!imageReady(img)) return false;
    const src = rects[index] || rects[0];
    let sx = src.x, sy = src.y, sw = src.w, sh = src.h;
    const srcRatio = sw / sh;
    const dstRatio = w / h;
    if (srcRatio > dstRatio) {
      const cropW = sh * dstRatio;
      sx += (sw - cropW) / 2;
      sw = cropW;
    } else {
      const cropH = sw / dstRatio;
      sy += (sh - cropH) / 2;
      sh = cropH;
    }
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(x + w / 2, y + h / 2);
    if (flipX) ctx.scale(-1, 1);
    ctx.drawImage(img, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
    ctx.restore();
    return true;
  }

  function drawAtlasContain(img, rects, index, x, y, w, h, flipX = false, alpha = 1) {
    if (!imageReady(img)) return false;
    const src = rects[index] || rects[0];
    const scale = Math.min(w / src.w, h / src.h);
    const dw = src.w * scale;
    const dh = src.h * scale;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(x + w / 2, y + h / 2);
    if (flipX) ctx.scale(-1, 1);
    ctx.drawImage(img, src.x, src.y, src.w, src.h, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
    return true;
  }

  function sideColor(enemy) {
    return enemy
      ? { main:'#c84e55', dark:'#6c2932', light:'#ffd1bd', cell:'#a83f48' }
      : { main:'#2589a3', dark:'#124d63', light:'#c9f5ef', cell:'#247f98' };
  }

  function ensureCommanderState() {
    if (typeof window.ensureCommanderStateV1 === 'function') return window.ensureCommanderStateV1();
    if (!state.commander) state.commander = { id:'orchard_lord', level:1, cd:0, maxCd:24, active:0 };
    if (!state.enemyCommander) state.enemyCommander = { id:'berry_general', level:1, cd:14, maxCd:27, active:0 };
    return state.commander;
  }

  function commanderSkillRect(enemy) {
    return enemy
      ? { x: 393, y: 216, w: 42, h: 42 }
      : { x: 56, y: 812, w: 42, h: 42 };
  }
  window.commanderSkillRectV5 = commanderSkillRect;

  function commanderPortraitRect(enemy) {
    return enemy
      ? { x: 382, y: 92, w: 66, h: 174 }
      : { x: 44, y: 700, w: 66, h: 156 };
  }
  window.commanderPortraitRectV5 = commanderPortraitRect;
  window.Battle2DGuidesV5 = {
    enemyBoard: { x:64, y:86, w:BOARD_W, h:BOARD_H },
    playerBoard: { x:126, y:684, w:BOARD_W, h:BOARD_H },
    enemyPortrait: commanderPortraitRect(true),
    playerPortrait: commanderPortraitRect(false),
  };

  function activateCommanderSkill() {
    const activated = typeof window.activateCommanderSkillV1 === 'function'
      ? window.activateCommanderSkillV1()
      : false;
    if (activated) state.rings.push({ x:42, y:LAYOUT.playerBoardY + BOARD_H / 2, r:12, life:.65, maxLife:.65, color:'#f5c44e' });
    return activated;
  }
  window.activateCommanderSkillV5 = activateCommanderSkill;

  function commanderPointer(ev) {
    if (state.phase !== 'playing') return;
    const p = typeof eventPoint === 'function' ? eventPoint(ev) : null;
    if (!p) return;
    const r = commanderSkillRect(false);
    if (p.x >= r.x - 5 && p.x <= r.x + r.w + 5 && p.y >= r.y - 5 && p.y <= r.y + r.h + 5) {
      ev.preventDefault();
      ev.stopPropagation();
      activateCommanderSkill();
    }
  }
  canvas.addEventListener('mousedown', commanderPointer);
  canvas.addEventListener('touchstart', commanderPointer, { passive:false });

  drawBackground = function drawBackground2DV5() {
    ctx.save();
    if (!drawCover(ART.background)) {
      ctx.fillStyle = '#f0d39a'; ctx.fillRect(0, 0, W, 52);
      ctx.fillStyle = '#bd5550'; ctx.fillRect(0, 52, W, 214);
      ctx.fillStyle = '#99ad49'; ctx.fillRect(0, 266, W, 382);
      ctx.fillStyle = '#378ba5'; ctx.fillRect(0, 648, W, 212);
      ctx.fillStyle = '#f0d39a'; ctx.fillRect(0, 860, W, 60);
    }
    ctx.restore();
  };

  drawBoard = function drawBoard2DV5(slots, isEnemy) {
    const bx = typeof boardX === 'function' ? boardX(isEnemy) : BOARD_X;
    const by = isEnemy ? LAYOUT.enemyBoardY : LAYOUT.playerBoardY;
    const color = sideColor(isEnemy);
    ctx.save();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = bx + c * (CELL + GAP);
        const y = by + r * (CELL + GAP);
        const ball = slots?.[r]?.[c];
        const snap = !isEnemy && state.drag?.nearestSnap &&
          state.drag.nearestSnap.r === r && state.drag.nearestSnap.c === c;
        panel(x + 2, y + 2, CELL - 4, CELL - 4, 11,
          snap ? '#f6d46b' : (ball ? 'rgba(255,247,205,.32)' : 'rgba(49,47,50,.12)'),
          snap ? '#fff2a9' : (ball ? color.light : 'rgba(255,255,255,.24)'),
          snap || ball ? 2 : 1);
        if (ball) {
          drawBall(ball, x + CELL / 2, y + CELL / 2, CELL * .43, 0, isEnemy);
          drawSlotLevelBadgeV48(x, y, ball.level || 1, isEnemy);
        }
      }
    }
    ctx.restore();
  };

  drawBall = function drawBall2DV5(ball, cx, cy, radius, extraY, isEnemy) {
    const y = cy + (extraY || 0) - (ball.bounce ? Math.sin(ball.bounce * Math.PI) * 4 : 0);
    const idx = roleIndex(ball.type);
    ctx.save();
    ctx.fillStyle = 'rgba(25,35,35,.20)';
    ctx.beginPath();
    ctx.ellipse(cx, y + radius * .72, radius * .65, radius * .18, 0, 0, Math.PI * 2);
    ctx.fill();
    drawAtlas(ART.barracks, BARRACK_RECTS, idx, cx - radius, y - radius, radius * 2, radius * 2, 0, 1);
    if (state.phase === 'playing') {
      const level = Math.max(1, Math.min(7, ball.level || 1));
      const cd = SPAWN_COOLDOWNS[level] || SPAWN_COOLDOWNS[1] || 5;
      const pct = ball.spawnTimer <= 0 ? 1 : Math.max(0, Math.min(1, 1 - (ball.spawnTimer || 0) / cd));
      ctx.strokeStyle = ball.spawnTimer <= 0 ? '#fff2a1' : (isEnemy ? '#ffaaa0' : '#a7eff1');
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, y, radius + 1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
      ctx.stroke();
    }
    ctx.restore();
  };

  drawSlotLevelBadgeV48 = function drawLevel2DV5(x, y, level, isEnemy) {
    const lv = Math.max(1, Math.min(7, level || 1));
    const color = sideColor(isEnemy);
    ctx.save();
    panel(x + CELL - 17, y + 3, 16, 14, 7, color.dark, color.light, 1);
    ctx.fillStyle = '#fff8dc';
    ctx.font = '900 8px "Nunito",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(lv), x + CELL - 9, y + 10.2);
    ctx.restore();
  };

  drawField = function drawField2DV5() {
    // Five lanes are authored into the flat background; only the center clash line is drawn.
    ctx.save();
    ctx.strokeStyle = 'rgba(255,250,190,.38)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(54, LAYOUT.fieldY + LAYOUT.fieldH / 2);
    ctx.lineTo(W - 54, LAYOUT.fieldY + LAYOUT.fieldH / 2);
    ctx.stroke();
    ctx.restore();
  };

  function paintWallBar(hp, maxHp, isEnemy) {
    const ratio = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
    const color = sideColor(isEnemy);
    const bar = wallBarRect(isEnemy);
    ctx.save();
    panel(bar.x, bar.y, bar.w, bar.h, 8, '#26363a', '#fff0bc', 1.5);
    panel(bar.x + 3, bar.y + 3, Math.max(4, (bar.w - 6) * ratio), bar.h - 6, 5, color.main, null);
    ctx.fillStyle = '#fff8e5';
    ctx.font = '900 9px "Nunito",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.ceil(hp)} / ${Math.ceil(maxHp)}`, W / 2, bar.y + bar.h / 2 + .5);
    ctx.restore();
  }

  drawWall = function drawWall2DV5(hp, maxHp, isEnemy) {
    // render.js 在小兵前调用 drawWall；这里只记录，真正血条在 drawHUD 阶段置顶绘制。
    state._wallBarsV5 = state._wallBarsV5 || {};
    state._wallBarsV5[isEnemy ? 'enemy' : 'player'] = { hp, maxHp };
  };

  function wallBarRect(enemy) {
    const w = 250;
    return { x:(W - w) / 2, y:enemy ? 276 : 651, w, h:15 };
  }
  window.wallBarRectV5 = wallBarRect;

  function drawCommander(enemy) {
    ensureCommanderState();
    const stateRef = enemy ? state.enemyCommander : state.commander;
    const rect = commanderPortraitRect(enemy);
    const src = stateRef.id === 'berry_general' ? 1 : 0;
    const naturalFacesLeft = src === 1;
    const desiredFacesLeft = enemy;
    const artH = enemy ? 118 : 106;
    const artRect = { x:rect.x, y:rect.y, w:rect.w, h:artH };
    ctx.save();
    roundedPath(rect.x, rect.y, rect.w, rect.h, 10);
    ctx.clip();
    drawAtlasContain(ART.commanders, COMMANDER_RECTS, src, artRect.x, artRect.y, artRect.w, artRect.h,
      naturalFacesLeft !== desiredFacesLeft, 1);
    ctx.restore();

    const skill = commanderSkillRect(enemy);
    const ready = stateRef.cd <= 0;
    const active = stateRef.active > 0;
    ctx.save();
    panel(skill.x, skill.y, skill.w, skill.h, 21,
      active ? '#f3c94f' : (ready ? '#2bbd91' : '#33494e'),
      '#fff1b6', 2);
    ctx.fillStyle = ready || active ? '#173f37' : '#d4dedb';
    ctx.font = '900 17px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(enemy ? '\u6218' : '\u4ee4', skill.x + skill.w / 2, skill.y + skill.h / 2 - 1);
    if (!ready && !active) {
      ctx.fillStyle = '#fff7df';
      ctx.font = '900 9px "Nunito",sans-serif';
      ctx.fillText(String(Math.ceil(stateRef.cd)), skill.x + skill.w / 2, skill.y + skill.h - 7);
    }
    ctx.fillStyle = '#fff7df';
    ctx.font = '900 8px "Nunito",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Lv.${stateRef.level || 1}`, skill.x + skill.w / 2, skill.y - 7);
    ctx.restore();
  }

  drawInfo = function drawInfo2DV5() {
    if (state.phase !== 'playing' && state.phase !== 'paused') return;
    ctx.save();
    panel(10, 5, 126, 40, 10, '#244b48', '#ffe5a5', 1.5);
    ctx.fillStyle = '#fff7dd';
    ctx.font = '900 14px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.mode === 'pvp' ? 'PVP' : `\u7b2c ${state.currentLevel || 1} \u5173`, 23, 17);
    ctx.fillStyle = '#aee0d3';
    ctx.font = '700 9px "Microsoft YaHei",sans-serif';
    ctx.fillText('\u7834\u5899\u83b7\u80dc', 23, 32);
    const limit = state.mode === 'pvp' ? 180 : (typeof battleTimeLimit === 'function' ? battleTimeLimit() : 120);
    const remaining = Math.max(0, Math.ceil(limit - Number(state.time || 0)));
    const clock = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
    panel(W / 2 - 32, 7, 64, 36, 10, remaining <= 20 ? '#9d3c43' : '#5e3440', '#ffe5a5', 1.5);
    ctx.fillStyle = '#fff7dd';
    ctx.font = '900 15px "Nunito",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(clock, W / 2, 25);
    ctx.restore();
    drawCommander(true);
    drawCommander(false);
  };

  drawHUD = function drawHud2DV5() {
    if (state.phase !== 'playing' && state.phase !== 'paused') return;
    const walls = state._wallBarsV5 || {};
    if (walls.enemy) paintWallBar(walls.enemy.hp, walls.enemy.maxHp, true);
    if (walls.player) paintWallBar(walls.player.hp, walls.player.maxHp, false);
    const y = LAYOUT.operationY;
    const x = 70;
    const w = W - 140;
    const h = LAYOUT.operationH;
    const cost = typeof nextActionCostV60 === 'function' ? nextActionCostV60() : 1;
    const juice = Number(state.sp || 0);
    const juiceCap = typeof getSpMax === 'function' ? getSpMax(meta) : 24;
    const canAct = juice >= cost;
    const btn = typeof getJuiceSpawnButtonRectV60 === 'function'
      ? getJuiceSpawnButtonRectV60()
      : { x:x + 108, y:y + 6, w:w - 114, h:h - 12 };
    ctx.save();
    panel(x, y, w, h, 12, '#205d68', '#ffe4a0', 2);
    panel(x + 7, y + 7, 98, h - 14, 9, '#173f49', '#83d8da', 1);
    ctx.fillStyle = '#9fe477';
    ctx.beginPath(); ctx.arc(x + 25, y + h / 2, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d4f3e9';
    ctx.font = '700 9px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('\u679c\u6c41', x + 41, y + 17);
    ctx.fillStyle = '#fff8e2';
    ctx.font = '900 19px "Nunito",sans-serif';
    ctx.font = '900 16px "Nunito",sans-serif';
    ctx.fillText(`${Math.floor(juice)}/${juiceCap}`, x + 41, y + 34);
    panel(btn.x, btn.y, btn.w, btn.h, 10, canAct ? '#f2c94c' : '#71817e', canAct ? '#fff0a6' : '#aab3b0', 1.5);
    ctx.fillStyle = canAct ? '#573a12' : '#e1e5e3';
    ctx.font = '900 13px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('\u53ec\u5524\u7403\u7403', btn.x + btn.w * .43, btn.y + btn.h / 2);
    panel(btn.x + btn.w - 42, btn.y + 5, 36, btn.h - 10, 8, '#4a3b25', null);
    ctx.fillStyle = '#fff1b0';
    ctx.font = '900 11px "Nunito",sans-serif';
    ctx.fillText(`-${cost}`, btn.x + btn.w - 24, btn.y + btn.h / 2);
    ctx.restore();
  };

  function troopPairAngle(a, b) {
    const ids = [String(a.id || ''), String(b.id || '')].sort();
    const key = `${ids[0]}|${ids[1]}`;
    let hash = 2166136261;
    for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
    return ((hash >>> 0) % 6283) / 1000;
  }

  function troopFormationTargetPos(s) {
    const nodes = [...(state.playerSoldiers || []), ...(state.enemySoldiers || [])]
      .filter(u => u && u.alive)
      .map(u => {
        const y = Number(typeof battleVisualYV59 === 'function' ? battleVisualYV59(u) : u.y || 0);
        return { unit:u, baseX:Number(u.x || 0), baseY:y, x:Number(u.x || 0), y };
      });
    const rootIndex = nodes.findIndex(node => node.unit === s);
    if (rootIndex < 0) {
      return { x:Number(s.x || 0), y:Number(typeof battleVisualYV59 === 'function' ? battleVisualYV59(s) : s.y || 0) };
    }

    // Organic visual avoidance: nearby units repel each other a little. There
    // are no rows, columns or lane buckets, so the crowd keeps a battle-like silhouette.
    const desiredDistance = 31;
    const maxOffset = 34;
    for (let pass = 0; pass < 7; pass++) {
      const deltas = nodes.map(() => ({ x:0, y:0 }));
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          let dx = nodes[i].x - nodes[j].x;
          let dy = nodes[i].y - nodes[j].y;
          let dist = Math.hypot(dx, dy);
          if (dist >= desiredDistance) continue;
          if (dist < .01) {
            const angle = troopPairAngle(nodes[i].unit, nodes[j].unit);
            const sign = String(nodes[i].unit.id) <= String(nodes[j].unit.id) ? 1 : -1;
            dx = Math.cos(angle) * sign;
            dy = Math.sin(angle) * sign;
            dist = 1;
          }
          const push = (desiredDistance - dist) * .5;
          const ux = dx / dist, uy = dy / dist;
          deltas[i].x += ux * push; deltas[i].y += uy * push;
          deltas[j].x -= ux * push; deltas[j].y -= uy * push;
        }
      }
      for (let i = 0; i < nodes.length; i++) {
        nodes[i].x += deltas[i].x;
        nodes[i].y += deltas[i].y;
        const ox = nodes[i].x - nodes[i].baseX;
        const oy = nodes[i].y - nodes[i].baseY;
        const offset = Math.hypot(ox, oy);
        if (offset > maxOffset) {
          nodes[i].x = nodes[i].baseX + ox / offset * maxOffset;
          nodes[i].y = nodes[i].baseY + oy / offset * maxOffset;
        }
      }
    }

    const target = nodes[rootIndex];
    return {
      x:Math.max(26, Math.min(W - 26, target.x)),
      y:Math.max(LAYOUT.fieldY + 18, Math.min(LAYOUT.fieldY + LAYOUT.fieldH - 32, target.y)),
    };
  }
  function troopVisualFormationPos(s) {
    const target = troopFormationTargetPos(s);
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!Number.isFinite(s._visualFormationX) || !Number.isFinite(s._visualFormationY)) {
      s._visualFormationX = Number(s.x || target.x);
      s._visualFormationY = Number(typeof battleVisualYV59 === 'function' ? battleVisualYV59(s) : s.y || target.y);
      s._visualFormationAt = now;
      return { x:s._visualFormationX, y:s._visualFormationY };
    }
    const dt = Math.max(0, Math.min(.05, (now - Number(s._visualFormationAt || now)) / 1000));
    s._visualFormationAt = now;
    const dx = target.x - s._visualFormationX;
    const dy = target.y - s._visualFormationY;
    const dist = Math.hypot(dx, dy);
    if (dist <= .25) {
      s._visualFormationX = target.x;
      s._visualFormationY = target.y;
    } else if (dt > 0) {
      const maxStep = 150 * dt;
      const step = Math.min(dist, maxStep);
      s._visualFormationX += dx / dist * step;
      s._visualFormationY += dy / dist * step;
    }
    return { x:s._visualFormationX, y:s._visualFormationY };
  }
  window.troopFormationTargetPosV6 = troopFormationTargetPos;
  window.troopVisualFormationPosV6 = troopVisualFormationPos;

  function troopAttackKind(type) {
    const role = (TYPES[type] || {}).role || '';
    if (type === 'orange_cannon' || type === 'cherry_bomber' || role === 'siege') return 'cannon';
    if (type === 'pear_frost' || role === 'control') return 'frost';
    if (role === 'tank') return 'shield';
    if (role === 'rush') return 'rush';
    if (role === 'back' || role === 'support') return 'arrow';
    return 'slash';
  }

  function drawTroopSprite(s) {
    if (!s?.alive) return;
    const enemy = s.side === 'enemy';
    const vis = troopVisualFormationPos(s);
    const tier = typeof battleUnitTierKeyV59 === 'function' ? battleUnitTierKeyV59(s) : 'small';
    const tierScale = ({small:.94,large:1.02,elite:1.10,advanced:1.18,legendary:1.26})[tier] || 1;
    const height = 48 * tierScale * (s._boss ? 1.28 : 1);
    const width = height * .68;
    const x = vis.x;
    const y = vis.y - height * .68;
    const hpRatio = Math.max(0, Math.min(1, (s.hp || 0) / Math.max(1, s.maxHp || 1)));
    const color = sideColor(enemy);
    ctx.save();
    if (typeof isInvisible === 'function' && isInvisible(s)) ctx.globalAlpha = .42;
    ctx.fillStyle = enemy ? 'rgba(142,40,49,.25)' : 'rgba(24,115,133,.25)';
    ctx.beginPath();
    ctx.ellipse(x, vis.y + 2, width * .36, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    const attackWindow = Math.min(.18, Math.max(.08, Number(s.speed || .8) * .24));
    const attackPulse = ['fight','siege','backline'].includes(s.mode) && Number(s.atkTimer || 0) > Number(s.speed || 0) - attackWindow
      ? Math.max(0, Math.min(1, (Number(s.atkTimer || 0) - (Number(s.speed || 0) - attackWindow)) / attackWindow))
      : 0;
    const lean = (enemy ? -1 : 1) * attackPulse * .055;
    drawAtlas(ART.troops, TROOP_RECTS, roleIndex(s.type), x - width / 2, y, width, height, lean, 1);
    if ((s.hitFlash || 0) > 0.02) {
      ctx.save();
      ctx.filter = 'brightness(2.1) saturate(.35)';
      drawAtlas(ART.troops, TROOP_RECTS, roleIndex(s.type), x - width / 2, y, width, height, lean,
        Math.min(.78, .28 + s.hitFlash * 1.6));
      ctx.restore();
    }
    if (hpRatio < .985 || s._boss || (s.shield || 0) > 0) {
      const bw = Math.max(28, width * .9);
      panel(x - bw / 2, y - 6, bw, 5, 3, '#273338', '#fff0bd', .7);
      panel(x - bw / 2 + 1, y - 5, Math.max(3, (bw - 2) * hpRatio), 3, 2, hpRatio > .35 ? color.main : '#e94e45', null);
    }
    if (s._boss && typeof drawBossBadgeV59 === 'function') drawBossBadgeV59(s, x, y - 25, 104);
    if ((s.reinforceStacks || 0) > 0) {
      panel(x + width * .18, y - 3, 17, 14, 7, '#fff8df', color.dark, 1);
      ctx.fillStyle = color.dark;
      ctx.font = '900 8px "Nunito",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`+${s.reinforceStacks}`, x + width * .18 + 8.5, y + 4);
    }
    ctx.restore();
  }

  drawSoldier = function drawSoldier2DV5(s) {
    // v5 是完整替换渲染。旧 Hook 会再次绘制程序小人，造成贴图与旧角色重叠。
    drawTroopSprite(s);
  };
  drawSoldier._battle2DV5 = true;

  drawProjectiles = function drawProjectiles2DV5() {
    for (const p of state.projectiles || []) {
      const angle = Math.atan2(p.targetY - p.y, p.targetX - p.x);
      const ux = Math.cos(angle), uy = Math.sin(angle);
      const color = p.color || (p.side === 'player' ? '#7de8ff' : '#ff786b');
      const kind = troopAttackKind(p.ownerType);
      ctx.save();
      ctx.globalAlpha = .96;
      ctx.lineCap = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = kind === 'cannon' ? 10 : 5;
      ctx.strokeStyle = color;
      ctx.lineWidth = kind === 'cannon' ? 7 : kind === 'frost' ? 4 : 3.5;
      ctx.beginPath();
      ctx.moveTo(p.x - ux * (kind === 'cannon' ? 18 : 24), p.y - uy * (kind === 'cannon' ? 18 : 24));
      ctx.lineTo(p.x + ux * 5, p.y + uy * 5);
      ctx.stroke();
      ctx.shadowBlur = 0;
      if (kind === 'cannon') {
        ctx.fillStyle = '#462b20';
        ctx.strokeStyle = '#ffd26a';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, 6.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff1a1';
        ctx.beginPath(); ctx.arc(p.x - 2, p.y - 2, 2, 0, Math.PI * 2); ctx.fill();
      } else if (kind === 'frost') {
        ctx.translate(p.x, p.y); ctx.rotate(angle + Math.PI / 4);
        ctx.fillStyle = '#d9fbff'; ctx.strokeStyle = '#65cfff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.rect(-4.5, -4.5, 9, 9); ctx.fill(); ctx.stroke();
      } else {
        ctx.strokeStyle = '#fff7d6';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(p.x - ux * 13, p.y - uy * 13);
        ctx.lineTo(p.x + ux * 9, p.y + uy * 9);
        ctx.stroke();
        ctx.translate(p.x + ux * 8, p.y + uy * 8); ctx.rotate(angle);
        ctx.fillStyle = '#fff7d6';
        ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-4, -3.5); ctx.lineTo(-2, 0); ctx.lineTo(-4, 3.5); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  };

  function troopVisualPointForId(id, fallbackX, fallbackY) {
    if (!id) return { x:fallbackX, y:fallbackY };
    const unit = [...(state.playerSoldiers || []), ...(state.enemySoldiers || [])]
      .find(s => s && s.alive && s.id === id);
    if (!unit || !Number.isFinite(unit._visualFormationX) || !Number.isFinite(unit._visualFormationY)) {
      return { x:fallbackX, y:fallbackY };
    }
    return { x:unit._visualFormationX, y:unit._visualFormationY };
  }

  drawAttackFx = function drawAttackFx2DV5() {
    const effects = [...(state.attackFx || [])].sort((a, b) => {
      const score = fx => {
        const kind = fx.kind || troopAttackKind(fx.ownerType);
        const lifeRatio = Number(fx.life || 0) / Math.max(.001, Number(fx.maxLife || fx.life || 1));
        return (fx.crit ? 6 : 0) + (kind === 'cannon' ? 3 : 0) + (fx.projectileImpact ? 1 : 0) + lifeRatio;
      };
      return score(b) - score(a);
    });
    const density = new Map();
    let drawn = 0, skipped = 0;
    for (const a of effects) {
      const t = Math.max(0, Math.min(1, a.life / Math.max(.001, a.maxLife || a.life || 1)));
      if (t <= .03) continue;
      const start = a.projectileImpact
        ? { x:a.x1, y:a.y1 }
        : troopVisualPointForId(a.ownerId, a.x1, a.y1);
      const end = troopVisualPointForId(a.targetId, a.x2, a.y2);
      const x1 = start.x, y1 = start.y, x2 = end.x, y2 = end.y;
      const playerAttack = a.attackerSide === 'player' || (a.attackerSide == null && y2 <= y1);
      const kind = a.kind || troopAttackKind(a.ownerType);
      const regionKey = `${Math.floor(Number(x2 || 0) / 100)}:${Math.floor(Number(y2 || 0) / 84)}`;
      const regionCount = density.get(regionKey) || 0;
      const regionalLimit = a.crit || kind === 'cannon' ? 3 : 2;
      if ((regionCount >= regionalLimit || drawn >= 10) && !a.crit) {
        skipped++;
        continue;
      }
      density.set(regionKey, regionCount + 1);
      drawn++;
      const densityAlpha = regionCount === 0 ? 1 : regionCount === 1 ? .72 : .52;
      const color = a.crit ? '#ffe36a' : (kind === 'frost' ? '#87e9ff' : (playerAttack ? '#62e7ff' : '#ff715f'));
      const dx = x2 - x1, dy = y2 - y1;
      const d = Math.max(1, Math.hypot(dx, dy));
      const nx = -dy / d, ny = dx / d;
      const facing = Math.atan2(dy, dx);
      ctx.save();
      ctx.globalAlpha = (.34 + t * .66) * densityAlpha;
      ctx.lineCap = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = 7;
      ctx.strokeStyle = color;
      ctx.lineWidth = a.crit ? 5.5 : 3.6;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo((x1 + x2) / 2 + nx * 8, (y1 + y2) / 2 + ny * 8, x2, y2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#fff9df';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x1 + dx * .24, y1 + dy * .24);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      if (kind === 'rush') {
        ctx.strokeStyle = '#ffe9a6';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(x1 + nx * 7, y1 + ny * 7);
        ctx.quadraticCurveTo((x1 + x2) / 2 - nx * 7, (y1 + y2) / 2 - ny * 7, x2 + nx * 7, y2 + ny * 7);
        ctx.stroke();
      }
      // 近战距离很短，单靠连线不明显；在攻击者一侧增加明确的挥击弧。
      ctx.strokeStyle = color;
      ctx.lineWidth = a.crit ? 5 : 3.2;
      ctx.globalAlpha = (.42 + t * .58) * densityAlpha;
      ctx.beginPath();
      ctx.arc(x1, y1, 13 + Math.min(9, d * .12), facing - .9, facing + .42);
      ctx.stroke();
      ctx.translate(x2, y2);
      ctx.rotate(facing);
      ctx.strokeStyle = kind === 'frost' ? '#dffcff' : '#fff5b5';
      ctx.lineWidth = kind === 'cannon' ? 3 : 2.2;
      const rays = kind === 'cannon' ? 10 : kind === 'shield' ? 5 : kind === 'frost' ? 8 : 6;
      for (let i = 0; i < rays; i++) {
        const angle = i * Math.PI * 2 / rays;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 3, Math.sin(angle) * 3);
        ctx.lineTo(Math.cos(angle) * ((kind === 'cannon' ? 12 : 8) + 7 * t), Math.sin(angle) * ((kind === 'cannon' ? 12 : 8) + 7 * t));
        ctx.stroke();
      }
      if (kind === 'shield') {
        ctx.strokeStyle = playerAttack ? '#bcecff' : '#ffc0ad';
        ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.arc(0, 0, 14 + 5 * t, -1.15, 1.15); ctx.stroke();
      } else if (kind === 'cannon') {
        ctx.fillStyle = 'rgba(255,190,72,.28)';
        ctx.beginPath(); ctx.arc(0, 0, 10 + 7 * (1 - t), 0, Math.PI * 2); ctx.fill();
      } else if (kind === 'frost') {
        ctx.rotate(Math.PI / 4);
        ctx.strokeStyle = '#dffcff'; ctx.lineWidth = 1.6;
        ctx.strokeRect(-7, -7, 14, 14);
      }
      ctx.restore();
    }
    window.BattleFxDensityStatsV6 = { total:effects.length, drawn, skipped, regions:density.size };
  };

  drawRings = function drawRings2DV5() {
    for (const ring of state.rings || []) {
      const t = Math.max(0, Math.min(1, ring.life / Math.max(.001, ring.maxLife || ring.life || 1)));
      const color = ring.color || '#ffe45a';
      const shortImpact = (ring.maxLife || 0) <= .4;
      ctx.save();
      ctx.globalAlpha = .18 + t * .68;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 + t * 1.2;
      if (shortImpact) {
        // 短命中只画四向火花，避免每个小兵脚下出现像残留 UI 一样的红色圆圈。
        ctx.lineWidth = 1.8;
        for (let i = 0; i < 4; i++) {
          const angle = Math.PI / 4 + i * Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(ring.x + Math.cos(angle) * ring.r * .35, ring.y + Math.sin(angle) * ring.r * .35);
          ctx.lineTo(ring.x + Math.cos(angle) * ring.r * .9, ring.y + Math.sin(angle) * ring.r * .9);
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  drawFx = function drawFx2DV5() {
    for (const f of state.fx || []) {
      const t = Math.max(0, Math.min(1, f.life / Math.max(.001, f.maxLife || f.life || 1)));
      const particle = Number.isFinite(f.vx) || Number.isFinite(f.vy);
      const y = particle ? f.y : f.y - (1 - t) * 24;
      ctx.save();
      ctx.globalAlpha = Math.min(1, .2 + t * .95);
      if (particle) {
        ctx.fillStyle = f.color || '#fff4b0';
        ctx.beginPath();
        ctx.arc(f.x, y, Math.max(1.5, (Number(f.size) || 6) * .34), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      }
      const text = String(f.text || '');
      const damage = /-\s*\d+/.test(text);
      const size = Math.max(damage ? 13 : 10, Math.min(damage ? 18 : 15, Number(f.size) || 12));
      ctx.font = `900 ${size}px "Microsoft YaHei",sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (f.priority === 'build') {
        const tw = ctx.measureText(text).width;
        panel(f.x - tw / 2 - 9, y - size, tw + 18, size + 10, 8, 'rgba(34,45,43,.82)', '#ffe39a', 1);
      }
      ctx.lineWidth = damage ? 4 : 3;
      ctx.strokeStyle = 'rgba(37,25,20,.86)';
      ctx.strokeText(text, f.x, y);
      ctx.fillStyle = damage ? '#fff3a5' : (f.color || '#ffffff');
      ctx.fillText(text, f.x, y);
      ctx.restore();
    }
  };
})();
