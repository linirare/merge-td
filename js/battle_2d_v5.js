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
  ART.commanders.src = 'art/generated/commanders-v5.png';
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
    { x: 250, y: 28, w: 650, h: 805 },
    { x: 1035, y: 28, w: 650, h: 805 },
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
    const by = enemy ? LAYOUT.enemyBoardY : LAYOUT.playerBoardY;
    return enemy
      ? { x: W - 55, y: by + BOARD_H - 50, w: 42, h: 42 }
      : { x: 13, y: by + BOARD_H - 50, w: 42, h: 42 };
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

  drawWall = function drawWall2DV5(hp, maxHp, isEnemy) {
    const y = isEnemy ? LAYOUT.enemyWallY : LAYOUT.playerWallY;
    const ratio = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
    const color = sideColor(isEnemy);
    const w = 250;
    const x = (W - w) / 2;
    ctx.save();
    panel(x, y + 3, w, 15, 8, '#26363a', '#fff0bc', 1.5);
    panel(x + 3, y + 6, Math.max(4, (w - 6) * ratio), 9, 5, color.main, null);
    ctx.fillStyle = '#fff8e5';
    ctx.font = '900 9px "Nunito",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.ceil(hp)} / ${Math.ceil(maxHp)}`, W / 2, y + 10.5);
    ctx.restore();
  };

  function drawCommander(enemy) {
    ensureCommanderState();
    const by = enemy ? LAYOUT.enemyBoardY : LAYOUT.playerBoardY;
    const stateRef = enemy ? state.enemyCommander : state.commander;
    const rect = enemy ? { x:390, y:by - 2, w:90, h:146 } : { x:0, y:by - 2, w:100, h:146 };
    const src = enemy ? 1 : 0;
    drawAtlas(ART.commanders, COMMANDER_RECTS, src, rect.x, rect.y, rect.w, rect.h, 0, 1);

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
    const y = vis.y - height * .68;
    const hpRatio = Math.max(0, Math.min(1, (s.hp || 0) / Math.max(1, s.maxHp || 1)));
    const color = sideColor(enemy);
    ctx.save();
    if (typeof isInvisible === 'function' && isInvisible(s)) ctx.globalAlpha = .42;
    ctx.fillStyle = enemy ? 'rgba(142,40,49,.25)' : 'rgba(24,115,133,.25)';
    ctx.beginPath();
    ctx.ellipse(x, vis.y + 2, width * .36, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    drawAtlas(ART.troops, TROOP_RECTS, roleIndex(s.type), x - width / 2, y, width, height, enemy ? Math.PI : 0, 1);
    if (hpRatio < .99 || ['fight','siege','backline'].includes(s.mode)) {
      const bw = Math.max(28, width * .9);
      panel(x - bw / 2, y - 6, bw, 5, 3, '#273338', '#fff0bd', .7);
      panel(x - bw / 2 + 1, y - 5, Math.max(3, (bw - 2) * hpRatio), 3, 2, hpRatio > .35 ? color.main : '#e94e45', null);
    }
    if (s._boss && typeof drawBossBadgeV59 === 'function') drawBossBadgeV59(s, x, y - 25, 104);
    ctx.restore();
  }

  drawSoldier = function drawSoldier2DV5(s) {
    if (window.RenderHooks?.beforeDrawSoldier) window.RenderHooks.beforeDrawSoldier.run(ctx, s);
    drawTroopSprite(s);
    if (window.RenderHooks?.afterDrawSoldier) window.RenderHooks.afterDrawSoldier.run(ctx, s);
  };
  drawSoldier._battle2DV5 = true;
})();
