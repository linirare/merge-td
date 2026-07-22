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
    bosses: new Image(),
  };

  ART.background.src = 'art/generated/water-world-battlefield-v4.png';
  ART.barracks.src = 'art/generated/water-world-orbs-v3.png';
  ART.troops.src = 'art/generated/water-world-units-v3.png';
  ART.commanders.src = 'art/generated/water-world-commanders-v3.png';
  ART.bosses.src = 'art/generated/water-world-bosses-v3.png';
  for (const img of Object.values(ART)) {
    img.onload = () => requestAnimationFrame(() => {
      try { if (typeof draw === 'function') draw(); } catch (_) {}
    });
  }

  const BARRACK_RECTS = Array.from({ length: 25 }, (_, i) => ({
    x: Math.round((i % 5) * 1254 / 5), y: Math.round(Math.floor(i / 5) * 1254 / 5), w: Math.ceil(1254 / 5), h: Math.ceil(1254 / 5),
  }));
  const TROOP_RECTS = BARRACK_RECTS.map(r => ({ ...r }));
  const COMMANDER_RECTS = Array.from({ length:3 }, (_, i) => ({ x:Math.round(i * 1654 / 3), y:0, w:Math.ceil(1654 / 3), h:951 }));
  const BOSS_RECTS = Array.from({ length:4 }, (_, i) => ({ x:Math.round(i * 2172 / 4), y:0, w:Math.ceil(2172 / 4), h:724 }));
  const COMMANDER_ART = {
    // The two original atlas cells are wide half-body illustrations.  Their
    // faces are offset inside the cells, so a centred crop cuts them off in
    // the narrow battlefield portrait wells.
    orchard_lord: { atlas:0, focus:.5 },
    berry_general: { atlas:1, focus:.5 },
    juice_sage: { atlas:2, focus:.5 },
  };
  const COMMANDER_FRAMES = {
    // Independent side cards prevent commander art, the grid and the skill
    // control from competing for the same lower-left / upper-right corner.
    enemy: { x:405, y:87, w:58, h:112 },
    player: { x:18, y:0, w:58, h:112 },
  };

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
    return Math.max(0, Math.min(24, Number(TYPES[type]?.artIndex) || 0));
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

  function drawPortraitCover(img, source, frame, focus = .5) {
    if (!imageReady(img)) return false;
    const src = source || { x:0, y:0, w:img.naturalWidth, h:img.naturalHeight };
    const targetRatio = frame.w / frame.h;
    let sw = src.w;
    let sh = src.h;
    if (sw / sh > targetRatio) {
      sw = sh * targetRatio;
    } else {
      sh = sw / targetRatio;
    }
    const sx = src.x + (src.w - sw) * Math.max(0, Math.min(1, focus));
    const sy = src.y + (src.h - sh) * .18;
    ctx.save();
    roundedPath(frame.x, frame.y, frame.w, frame.h, 8);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, frame.x, frame.y, frame.w, frame.h);
    ctx.restore();
    return true;
  }

  // The background illustration is authored in three safe zones.  Map those
  // zones to the live board/reef coordinates rather than forcing combat layout
  // to match incidental pixels in a painted image.
  function drawBattlefieldBackdrop(img) {
    if (!imageReady(img)) return false;
    const sourceW = img.naturalWidth;
    const sourceH = img.naturalHeight;
    const slices = [
      { sy:0, ey:510, dy:0, eyDest:276 },
      { sy:510, ey:1315, dy:276, eyDest:645 },
      { sy:1315, ey:sourceH, dy:645, eyDest:H },
    ];
    for (const slice of slices) {
      ctx.drawImage(img, 0, slice.sy, sourceW, slice.ey - slice.sy,
        0, slice.dy, W, slice.eyDest - slice.dy);
    }
    return true;
  }

  function sideColor(enemy) {
    return enemy
      ? {
          main:'#d66886', dark:'#593452', light:'#ffd6df', cell:'#a95872',
          boardTop:'rgba(92,57,102,.60)', boardBottom:'rgba(57,39,79,.68)',
          slot:'rgba(96,57,91,.48)', slotStroke:'rgba(255,197,216,.70)'
        }
      : {
          main:'#45b8c4', dark:'#15556c', light:'#d2fbf5', cell:'#338da4',
          boardTop:'rgba(30,113,132,.58)', boardBottom:'rgba(15,76,101,.68)',
          slot:'rgba(24,104,124,.48)', slotStroke:'rgba(184,247,240,.70)'
        };
  }

  // Keep combat coordinates stable while giving the 24px visual reef enough
  // breathing room above the player grid.
  function wallVisualY(enemy) {
    return (enemy ? LAYOUT.enemyWallY : LAYOUT.playerWallY) - (enemy ? 0 : 16);
  }
  window.battleWallVisualYV5 = wallVisualY;

  function ensureCommanderState() {
    if (typeof window.ensureCommanderStateV1 === 'function') return window.ensureCommanderStateV1();
    if (!state.commander) state.commander = { id:'orchard_lord', level:1, cd:0, maxCd:24, active:0 };
    if (!state.enemyCommander) state.enemyCommander = { id:'berry_general', level:1, cd:14, maxCd:27, active:0 };
    return state.commander;
  }

  function commanderSkillRect(enemy) {
    const by = enemy ? LAYOUT.enemyBoardY : LAYOUT.playerBoardY;
    return enemy
      ? { x: W - 55, y: by + BOARD_H - 50, w: 42, h: 42 }
      : { x: 24, y: by + BOARD_H - 50, w: 42, h: 42 };
  }
  window.commanderSkillRectV5 = commanderSkillRect;

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
    if (!drawBattlefieldBackdrop(ART.background)) {
      ctx.fillStyle = '#f0d39a'; ctx.fillRect(0, 0, W, 52);
      ctx.fillStyle = '#bd5550'; ctx.fillRect(0, 52, W, 214);
      ctx.fillStyle = '#99ad49'; ctx.fillRect(0, 266, W, 382);
      ctx.fillStyle = '#378ba5'; ctx.fillRect(0, 648, W, 212);
      ctx.fillStyle = '#f0d39a'; ctx.fillRect(0, 860, W, 60);
    }

    // The illustration already contains ornate castles.  Quiet the operational
    // zones so the interactive boards read as the primary layer, while leaving
    // the open-water battlefield bright and spacious.
    const enemyScrim = ctx.createLinearGradient(0, 48, 0, LAYOUT.fieldY);
    enemyScrim.addColorStop(0, 'rgba(47,19,59,.10)');
    enemyScrim.addColorStop(.48, 'rgba(47,19,59,.28)');
    enemyScrim.addColorStop(1, 'rgba(47,19,59,.06)');
    ctx.fillStyle = enemyScrim;
    ctx.fillRect(0, 48, W, Math.max(0, LAYOUT.fieldY - 48));

    const playerScrim = ctx.createLinearGradient(0, LAYOUT.playerWallY - 18, 0, LAYOUT.operationY);
    playerScrim.addColorStop(0, 'rgba(4,48,68,.06)');
    playerScrim.addColorStop(.48, 'rgba(4,48,68,.27)');
    playerScrim.addColorStop(1, 'rgba(4,48,68,.14)');
    ctx.fillStyle = playerScrim;
    ctx.fillRect(0, LAYOUT.playerWallY - 18, W, LAYOUT.operationY - LAYOUT.playerWallY + 18);
    ctx.restore();
  };

  drawBoard = function drawBoard2DV5(slots, isEnemy) {
    const bx = typeof boardX === 'function' ? boardX(isEnemy) : BOARD_X;
    const by = isEnemy ? LAYOUT.enemyBoardY : LAYOUT.playerBoardY;
    const color = sideColor(isEnemy);
    ctx.save();

    // One continuous plate makes the 3x5 grid legible as an interaction zone
    // instead of fifteen translucent cells floating over the background art.
    ctx.shadowColor = 'rgba(0,18,30,.25)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = isEnemy ? 2 : -2;
    const boardGlass = ctx.createLinearGradient(0, by - 9, 0, by + BOARD_H + 9);
    boardGlass.addColorStop(0, color.boardTop);
    boardGlass.addColorStop(1, color.boardBottom);
    panel(bx - 9, by - 9, BOARD_W + 18, BOARD_H + 18, 13,
      boardGlass, color.light, 2);
    ctx.shadowColor = 'transparent';
    panel(bx - 5, by - 5, BOARD_W + 10, BOARD_H + 10, 10,
      'rgba(211,250,247,.035)', 'rgba(255,255,255,.20)', .9);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = bx + c * (CELL + GAP);
        const y = by + r * (CELL + GAP);
        const ball = slots?.[r]?.[c];
        const snap = !isEnemy && state.drag?.nearestSnap &&
          state.drag.nearestSnap.r === r && state.drag.nearestSnap.c === c;
        panel(x + 2, y + 2, CELL - 4, CELL - 4, 11,
          snap ? '#f6d46b' : (ball ? 'rgba(255,247,218,.28)' : color.slot),
          snap ? '#fff2a9' : (ball ? color.light : color.slotStroke),
          snap || ball ? 2 : 1.35);

        // A restrained inner highlight separates adjacent cells without adding
        // texture or competing with the orb artwork.
        if (!ball && !snap) {
          panel(x + 6, y + 6, CELL - 12, CELL - 12, 8,
            'rgba(255,255,255,.025)', 'rgba(255,255,255,.08)', .7);
        }
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
    const role = TYPES[ball.type]?.role || '';
    const roleColor = ({
      shell:'#72e1c4', raider:'#ff9a8d', shooter:'#8fbfff', spike:'#ffd37b',
      wildcard:'#f29cc4'
    })[role] || '#8debf0';
    ctx.save();
    ctx.fillStyle = 'rgba(8,48,64,.28)';
    ctx.beginPath();
    ctx.ellipse(cx, y + radius * .78, radius * .68, radius * .20, 0, 0, Math.PI * 2);
    ctx.fill();

    // The pearl must read before its detail does: a tinted sea-glass shell
    // separates it from the grid, then the unique atlas art sits inside.
    const glow = ctx.createRadialGradient(cx - radius * .28, y - radius * .34, 2, cx, y, radius + 5);
    glow.addColorStop(0, 'rgba(255,255,255,.82)');
    glow.addColorStop(.32, `${roleColor}88`);
    glow.addColorStop(1, 'rgba(5,58,78,.78)');
    ctx.beginPath(); ctx.arc(cx, y, radius + 3, 0, Math.PI * 2);
    ctx.fillStyle = glow; ctx.fill();
    ctx.strokeStyle = '#eafffb'; ctx.lineWidth = 1.7; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, y, radius + .4, 0, Math.PI * 2);
    ctx.strokeStyle = roleColor; ctx.lineWidth = 2.3; ctx.stroke();

    const artRadius = radius * 1.12;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, y, radius * .98, 0, Math.PI * 2); ctx.clip();
    drawAtlas(ART.barracks, BARRACK_RECTS, idx, cx - artRadius, y - artRadius, artRadius * 2, artRadius * 2, 0, 1);
    ctx.restore();
    // 高等级海灵珠辉光(Lv4+)
    const ballLevel = ball.level || 1;
    if (ballLevel >= 4 && !isEnemy) {
      ctx.save();
      ctx.globalAlpha = 0.12 + (ballLevel - 4) * 0.04;
      ctx.fillStyle = '#ffd24a';
      ctx.shadowColor = '#ffd24a';
      ctx.shadowBlur = 20 + ballLevel * 5;
      ctx.beginPath();
      ctx.arc(cx, y, radius * 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(255,255,255,.72)';
    ctx.beginPath(); ctx.ellipse(cx - radius * .36, y - radius * .40, radius * .18, radius * .10, -.5, 0, Math.PI * 2); ctx.fill();
    if (state.phase === 'playing' && typeof state.roundPhase !== 'string') {
      const level = Math.max(1, Math.min(7, ball.level || 1));
      const cd = SPAWN_COOLDOWNS[level] || SPAWN_COOLDOWNS[1] || 5;
      const pct = ball.spawnTimer <= 0 ? 1 : Math.max(0, Math.min(1, 1 - (ball.spawnTimer || 0) / cd));
      ctx.strokeStyle = ball.spawnTimer <= 0 ? '#fff5bd' : (isEnemy ? '#ffb0c2' : '#b9fff6');
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(cx, y, radius + 5.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
      ctx.stroke();
    }
    ctx.restore();
  };

  drawSlotLevelBadgeV48 = function drawLevel2DV5(x, y, level, isEnemy) {
    const lv = Math.max(1, Math.min(7, level || 1));
    const color = sideColor(isEnemy);
    ctx.save();
    panel(x + CELL - 22, y + 3, 21, 16, 8, color.dark, '#effff9', 1.25);
    ctx.fillStyle = '#effff9';
    ctx.font = '900 8px "Nunito",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Lv${lv}`, x + CELL - 11.5, y + 11);
    ctx.restore();
  };

  drawField = function drawField2DV5() {
    // Open water: one subtle horizontal clash line, never vertical routes.
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

  drawWall = function drawWall2DV5(hp, maxHp, isEnemy) {
    const y = wallVisualY(isEnemy);
    const ratio = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
    const color = sideColor(isEnemy);
    const w = W - 110;
    const x = (W - w) / 2;
    const h = 24;
    ctx.save();

    // A broad reef barrier sits exactly on the board/field boundary.  The HP
    // track is embedded in it, so the painted castle and gameplay wall no
    // longer read as two unrelated structures.
    ctx.shadowColor = 'rgba(0,20,31,.5)';
    ctx.shadowBlur = 7;
    ctx.shadowOffsetY = isEnemy ? 3 : -3;
    const reefGradient = ctx.createLinearGradient(0, y, 0, y + h);
    if (isEnemy) {
      reefGradient.addColorStop(0, '#bc718d');
      reefGradient.addColorStop(.48, '#78506f');
      reefGradient.addColorStop(1, '#523b60');
    } else {
      reefGradient.addColorStop(0, '#55b5c1');
      reefGradient.addColorStop(.48, '#2f859a');
      reefGradient.addColorStop(1, '#23657f');
    }
    ctx.beginPath();
    ctx.moveTo(x + 8, y);
    ctx.lineTo(x + w - 8, y);
    ctx.lineTo(x + w, y + 7);
    ctx.lineTo(x + w - 5, y + h);
    ctx.lineTo(x + 5, y + h);
    ctx.lineTo(x, y + 7);
    ctx.closePath();
    ctx.fillStyle = reefGradient;
    ctx.fill();
    ctx.strokeStyle = color.light;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.shadowColor = 'transparent';

    // Sparse reef joints make the band architectural without heavy ornament.
    ctx.strokeStyle = isEnemy ? 'rgba(255,180,211,.22)' : 'rgba(180,250,246,.22)';
    ctx.lineWidth = 1;
    for (let jointX = x + 28; jointX < x + w - 20; jointX += 42) {
      ctx.beginPath();
      ctx.moveTo(jointX, y + 3);
      ctx.lineTo(jointX - 4, y + h - 3);
      ctx.stroke();
    }

    const trackX = x + 42;
    const trackW = w - 84;
    panel(trackX, y + 6, trackW, 12, 4, 'rgba(8,24,34,.58)', 'rgba(255,255,255,.30)', 1);
    panel(trackX + 2, y + 8, Math.max(4, (trackW - 4) * ratio), 8, 3, color.main, null);
    ctx.fillStyle = '#fff8e5';
    ctx.font = '900 9px "Nunito",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`护礁结界  ${Math.ceil(hp)} / ${Math.ceil(maxHp)}`, W / 2, y + h / 2);
    const shield = Number(isEnemy ? state.enemyReefShield : state.playerReefShield) || 0;
    if (shield > 0) {
      ctx.strokeStyle = '#82f5ff'; ctx.lineWidth = 3;
      roundedPath(x - 3, y - 3, w + 6, h + 6, 8); ctx.stroke();
      ctx.fillStyle = '#d8fbff'; ctx.font = '900 8px "Microsoft YaHei",sans-serif';
      ctx.textAlign = 'right'; ctx.fillText(`护礁盾 ${Math.ceil(shield)}`, x + w - 7, isEnemy ? y - 7 : y + h + 8);
    }
    ctx.restore();
  };

  function drawCommander(enemy) {
    ensureCommanderState();
    const by = enemy ? LAYOUT.enemyBoardY : LAYOUT.playerBoardY;
    const stateRef = enemy ? state.enemyCommander : state.commander;
    // Portraits are deliberately outside of the interactive grid.
    const frame = enemy
      ? { ...COMMANDER_FRAMES.enemy }
      : { ...COMMANDER_FRAMES.player, y:by + 5 };
    const art = COMMANDER_ART[stateRef.id] || COMMANDER_ART.orchard_lord;
    const cardColor = sideColor(enemy);
    ctx.save();
    panel(frame.x - 3, frame.y - 3, frame.w + 6, frame.h + 6, 10,
      enemy ? 'rgba(82,46,72,.72)' : 'rgba(18,91,108,.72)', cardColor.light, 1.5);
    ctx.restore();
    if (art.image) {
      drawPortraitCover(ART[art.image], null, frame, art.focus);
    } else {
      drawPortraitCover(ART.commanders, COMMANDER_RECTS[art.atlas], frame, art.focus);
    }

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
    ctx.fillText('潮汐能', x + 41, y + 17);
    ctx.fillStyle = '#fff8e2';
    ctx.font = '900 19px "Nunito",sans-serif';
    ctx.font = '900 16px "Nunito",sans-serif';
    ctx.fillText(`${Math.floor(juice)}/${juiceCap}`, x + 41, y + 34);
    panel(btn.x, btn.y, btn.w, btn.h, 10, canAct ? '#f2c94c' : '#71817e', canAct ? '#fff0a6' : '#aab3b0', 1.5);
    ctx.fillStyle = canAct ? '#573a12' : '#e1e5e3';
    ctx.font = '900 13px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('召唤海灵珠', btn.x + btn.w * .43, btn.y + btn.h / 2);
    panel(btn.x + btn.w - 42, btn.y + 5, 36, btn.h - 10, 8, '#4a3b25', null);
    ctx.fillStyle = '#fff1b0';
    ctx.font = '900 11px "Nunito",sans-serif';
    ctx.fillText(`-${cost}`, btn.x + btn.w - 24, btn.y + btn.h / 2);
    ctx.restore();
  };

  function drawTroopSprite(s) {
    if (!s?.alive) return;
    const enemy = s.side === 'enemy';
    const baseY = typeof battleVisualYV59 === 'function' ? battleVisualYV59(s) : s.y;
    const vis = typeof battleVisualPosV59 === 'function' ? battleVisualPosV59(s, 18) : { x:s.x, y:baseY };
    const tier = typeof battleUnitTierKeyV59 === 'function' ? battleUnitTierKeyV59(s) : 'small';
    const tierScale = ({small:1,large:1.08,elite:1.16,advanced:1.23,legendary:1.32})[tier] || 1;
    const height = 58 * tierScale * (s._boss ? 1.22 : 1);
    const width = height * .82;
    const seed = String(s.id || s.type).split('').reduce((n,ch) => ((n*31)+ch.charCodeAt(0))>>>0, 7);
    const x = vis.x + ((seed % 5) - 2) * 2.8;
    // Sprites are top-anchored inside their atlas cells.  At the edge lanes
    // their logical centre can be valid while the visible body still crosses a
    // wall, so clamp the rendered centre to the playable field before anchoring.
    const renderCenterY = Math.max(
      LAYOUT.fieldY + height * .72,
      Math.min(LAYOUT.fieldY + LAYOUT.fieldH - height * .36, vis.y)
    );
    const y = renderCenterY - height * .68;
    const hpRatio = Math.max(0, Math.min(1, (s.hp || 0) / Math.max(1, s.maxHp || 1)));
    const role = TYPES[s.type]?.role; // 品类,全局可用
    const color = sideColor(enemy);
    ctx.save();
    if (typeof isInvisible === 'function' && isInvisible(s)) ctx.globalAlpha = .42;
    ctx.fillStyle = enemy ? 'rgba(142,40,49,.25)' : 'rgba(24,115,133,.25)';
    ctx.beginPath();
    ctx.ellipse(x, renderCenterY + 2, width * .36, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (s._boss) drawAtlas(ART.bosses, BOSS_RECTS, s._bossArtIndex || 0, x - width * .72, y - height * .24, width * 1.44, height * 1.38, 0, 1);
    else drawAtlas(ART.troops, TROOP_RECTS, roleIndex(s.type), x - width / 2, y, width, height, 0, 1);

    // hitFlash 受击闪白/金:在精灵上方叠加光晕层
    if ((s.hitFlash || 0) > 0) {
      ctx.save();
      const flashIntensity = Math.min(1, (s.hitFlash || 0) * 4.0);
      ctx.globalAlpha = flashIntensity;
      const isCritFlash = s._critHit; // 暴击时金色闪
      if (role === 'shell') {
        // 甲壳兵:受击时金色盾形闪
        ctx.fillStyle = '#ffd24a';
        ctx.strokeStyle = '#fff2a9';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#ffd24a';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.ellipse(x - width * .12, renderCenterY - height * .22, width * .60, height * .55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (isCritFlash) {
        // 暴击:金色超大闪+辉光
        ctx.fillStyle = '#ffd24a';
        ctx.shadowColor = '#ffb347';
        ctx.shadowBlur = 30;
        ctx.beginPath();
        ctx.ellipse(x, renderCenterY - height * .22, width * .62, height * .58, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.ellipse(x, renderCenterY - height * .22, width * .54, height * .50, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // 扩散环:暴击时更大更金
      const ringR = height * (0.50 + (1 - flashIntensity) * 0.3);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = Math.min(isCritFlash ? 0.85 : 0.7, (s.hitFlash || 0) * (isCritFlash ? 3.5 : 2.5));
      ctx.strokeStyle = isCritFlash ? '#ffb347' : '#fff8e0';
      ctx.lineWidth = isCritFlash ? 4 : 3;
      ctx.beginPath();
      ctx.arc(x, renderCenterY - height * .22, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // 暴击标记用完即弃
    if (s._critHit && s.hitFlash < 0.05) s._critHit = false;

    if (hpRatio < 0.95) {
      const bw = Math.max(28, width * .9);
      panel(x - bw / 2, y - 6, bw, 5, 3, '#273338', '#fff0bd', .7);
      panel(x - bw / 2 + 1, y - 5, Math.max(3, (bw - 2) * hpRatio), 3, 2, hpRatio > .35 ? color.main : '#e94e45', null);
    }
    if (s._boss && typeof drawBossBadgeV59 === 'function') drawBossBadgeV59(s, x, y - 25, 104);

    // 品类特效:游骑兵移动拖尾
    if (TYPES[s.type]?.role === 'raider' && s.mode === 'fight') {
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = '#ffd24a';
      ctx.lineWidth = 1.5;
      for (let t = 0; t < 3; t++) {
        const ox = (t - 1) * 6 + (seed % 5) * 2;
        const oy = (t - 1) * 4;
        ctx.beginPath();
        ctx.moveTo(x + ox, renderCenterY + oy);
        ctx.lineTo(x + ox - 14, renderCenterY + oy + (s.side === 'player' ? 6 : -6)); // 修正方向:移动方向反了
        ctx.stroke();
      }
      ctx.restore();
    }

    // 品类特效:枪刺兵攻击突刺线
    if (TYPES[s.type]?.role === 'spike' && s.mode === 'fight' && (s.hitFlash || 0) > 0.15) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.5, (s.hitFlash || 0) * 1.5);
      ctx.strokeStyle = '#ffb547';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 6]);
      const dir = s.side === 'player' ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(x, renderCenterY);
      ctx.lineTo(x + dir * 18, renderCenterY + dir * 16);
      ctx.stroke();
      ctx.restore();
    }

    // 高等级辉光(Lv5+)已移除(视觉噪音>收益)
    // 射手射程指示已移除(看不见)
    // 受控标记已移除(状态图标❄️💫已有)
    // 品类标签:兵脚下小图标
    const roleIcons = { shell:'🛡️', spike:'🔱', shooter:'🎯', raider:'⚡', wildcard:'🌀' };
    const roleIcon = roleIcons[TYPES[s.type]?.role] || '';
    if (roleIcon) {
      ctx.save();
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(roleIcon, x, renderCenterY + 2); // 品类emoji(无底)
      ctx.restore();
    }

    // 状态图标:头顶 emoji 排成一行
    if (s.statusEffects) {
      const se = s.statusEffects;
      let icons = [];
      if (se.frozen?.timer > 0) icons.push('❄️');
      if (se.burning?.timer > 0) icons.push('🔥');
      if (se.stunned?.timer > 0) icons.push('💫');
      if (se.slowed?.timer > 0) icons.push('🐢');
      if (se.invisible?.timer > 0) icons.push('👻');
      if (se.provoke?.timer > 0) icons.push('😡');
      if (se.weakened?.timer > 0) icons.push('😵');
      if (icons.length > 0) {
        ctx.save();
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const iconW = 12;
        const startX = x - (icons.length - 1) * iconW / 2;
        for (let i = 0; i < icons.length; i++) {
          ctx.fillText(icons[i], startX + i * iconW, y - 14);
        }
        ctx.restore();
      }
    }

    ctx.restore();
  }

  drawSoldier = function drawSoldier2DV5(s) {
    if (window.RenderHooks?.beforeDrawSoldier) window.RenderHooks.beforeDrawSoldier.run(ctx, s);
    drawTroopSprite(s);
    if (window.RenderHooks?.afterDrawSoldier) window.RenderHooks.afterDrawSoldier.run(ctx, s);
  };
  drawSoldier._battle2DV5 = true;
})();
