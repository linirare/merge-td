/* ============================================================
   Art direction v4
   Generated production art plate + authored hero sprite atlas.
   Loaded last so the battle uses one cohesive visual language.
   ============================================================ */
(function installArtDirectionV4() {
  'use strict';

  const ART = window.BattleArtV4 = {
    battlefield: new Image(),
    heroes: new Image(),
    ready: false
  };

  function requestArtFrame() {
    ART.ready = ART.battlefield.complete && ART.battlefield.naturalWidth > 0 &&
      ART.heroes.complete && ART.heroes.naturalWidth > 0;
    if (typeof draw === 'function') requestAnimationFrame(() => {
      try { draw(); } catch (_) { /* the normal game loop will redraw */ }
    });
  }

  ART.battlefield.onload = requestArtFrame;
  ART.heroes.onload = requestArtFrame;
  ART.battlefield.src = 'art/generated/battlefield-arena-v4.png';
  ART.heroes.src = 'art/generated/fruit-units-v4.png';

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

  function fillRound(x, y, w, h, r, fill, stroke, lineWidth) {
    roundedPath(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth || 1;
      ctx.stroke();
    }
  }

  function drawCover(img, x, y, w, h) {
    if (!img.complete || !img.naturalWidth) return false;
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const sw = w / scale;
    const sh = h / scale;
    const sx = (img.naturalWidth - sw) / 2;
    const sy = (img.naturalHeight - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    return true;
  }

  drawBackground = function artBackgroundV4() {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (!drawCover(ART.battlefield, 0, 0, W, H)) {
      const fallback = ctx.createLinearGradient(0, 0, 0, H);
      fallback.addColorStop(0, '#74283a');
      fallback.addColorStop(.34, '#77a847');
      fallback.addColorStop(.76, '#72a64d');
      fallback.addColorStop(1, '#086b70');
      ctx.fillStyle = fallback;
      ctx.fillRect(0, 0, W, H);
    }

    // Quiet readability veils; the painting remains the visual foundation.
    const topShade = ctx.createLinearGradient(0, 0, 0, 118);
    topShade.addColorStop(0, 'rgba(27,14,21,.46)');
    topShade.addColorStop(1, 'rgba(27,14,21,0)');
    ctx.fillStyle = topShade;
    ctx.fillRect(0, 0, W, 120);
    const bottomShade = ctx.createLinearGradient(0, H - 180, 0, H);
    bottomShade.addColorStop(0, 'rgba(3,35,38,0)');
    bottomShade.addColorStop(1, 'rgba(3,28,31,.42)');
    ctx.fillStyle = bottomShade;
    ctx.fillRect(0, H - 180, W, 180);
    ctx.restore();
  };

  const HERO_RECTS = [
    { x: 30,   y: 174, w: 378, h: 520 },
    { x: 390,  y: 168, w: 385, h: 528 },
    { x: 730,  y: 190, w: 375, h: 506 },
    { x: 1040, y: 205, w: 405, h: 491 },
    { x: 1385, y: 180, w: 375, h: 516 }
  ];

  function heroIndex(type) {
    const role = (typeof TYPES !== 'undefined' && TYPES[type]?.role) || 'front';
    if (role === 'tank') return 0;
    if (role === 'back' || role === 'control' || role === 'support') return 2;
    if (role === 'siege') return 3;
    if (role === 'rush') return 4;
    return 1;
  }

  function drawHeroSprite(index, x, groundY, height, flip, alpha) {
    if (!ART.heroes.complete || !ART.heroes.naturalWidth) return false;
    const src = HERO_RECTS[index] || HERO_RECTS[1];
    const width = height * (src.w / src.h);
    ctx.save();
    ctx.globalAlpha *= alpha == null ? 1 : alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(x, 0);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(ART.heroes, src.x, src.y, src.w, src.h,
      -width / 2, groundY - height, width, height);
    ctx.restore();
    return true;
  }

  function teamStyle(isEnemy) {
    return isEnemy
      ? { ink:'#45142a', main:'#b83b4e', light:'#f19791' }
      : { ink:'#073c43', main:'#087e75', light:'#75d2bd' };
  }

  drawBoard = function artBoardV4(slots, isEnemy, dragHint) {
    const by = isEnemy ? LAYOUT.enemyBoardY : LAYOUT.playerBoardY;
    const team = teamStyle(isEnemy);

    ctx.save();
    // Sockets sit directly in the authored terrace; there is no floating panel.

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = BOARD_X + c * (CELL + GAP);
        const y = by + r * (CELL + GAP);
        const ball = slots?.[r]?.[c];
        const snap = !isEnemy && state.drag?.nearestSnap &&
          state.drag.nearestSnap.r === r && state.drag.nearestSnap.c === c;
        ctx.save();
        if (ball) {
          ctx.shadowColor = team.light;
          ctx.shadowBlur = 8;
        }
        fillRound(x + 5, y + 5, CELL - 10, CELL - 10, 15,
          snap ? 'rgba(255,221,119,.34)' :
            (ball ? 'rgba(255,241,194,.14)' : (isEnemy ? 'rgba(74,22,33,.17)' : 'rgba(3,73,68,.16)')),
          snap ? '#f7d675' : (ball ? 'rgba(255,235,183,.48)' : 'rgba(255,255,255,.16)'),
          ball ? 1.15 : .8);
        ctx.restore();

        if (ball) {
          drawBall(ball, x + CELL / 2, y + CELL / 2 + 1, CELL * .38, 0, isEnemy);
          if (typeof drawSlotLevelBadgeV48 === 'function') {
            drawSlotLevelBadgeV48(x, y, ball.level || 1, isEnemy);
          }
        }
      }
    }
    ctx.restore();
  };

  drawBall = function artBallV3(ball, cx, cy, radius, extraY, isEnemy) {
    const level = Math.max(1, Math.min(7, ball.level || 1));
    const y = cy + (extraY || 0) - (ball.bounce ? Math.sin(ball.bounce * Math.PI) * 6 : 0);
    const team = teamStyle(!!isEnemy);
    ctx.save();
    ctx.fillStyle = 'rgba(27,20,10,.25)';
    ctx.beginPath();
    ctx.ellipse(cx, y + radius * .76, radius * .68, radius * .18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = team.light;
    ctx.shadowBlur = level >= 4 ? 12 : 5;
    const ok = drawHeroSprite(heroIndex(ball.type), cx, y + radius * .88, radius * 2.22, !!isEnemy, 1);
    ctx.shadowBlur = 0;
    if (!ok && typeof drawCommercialFruitFaceV2 === 'function') {
      const t = TYPES[ball.type] || TYPES[DEFAULT_DECK[0]];
      drawCommercialFruitFaceV2(cx, y, radius * .68, ball.type, t.color, !!isEnemy);
    }

    if (state.phase === 'playing') {
      const cd = SPAWN_COOLDOWNS[level] || SPAWN_COOLDOWNS[1] || 5;
      const progress = ball.spawnTimer <= 0 ? 1 : Math.max(0, Math.min(1, 1 - (ball.spawnTimer || 0) / cd));
      ctx.strokeStyle = ball.spawnTimer <= 0 ? '#fff3a4' : team.light;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(cx, y, radius + 2.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();
    }
    ctx.restore();
  };

  drawField = function artFieldV4() {
    const fy = LAYOUT.fieldY;
    const fh = LAYOUT.fieldH;
    ctx.save();
    // The lane paint is deliberately subtle: the authored arena already carries the scene.
    for (let c = 0; c < COLS; c++) {
      const laneX = BOARD_X + c * (CELL + GAP) + CELL / 2;
      const lane = ctx.createLinearGradient(laneX - CELL * .32, 0, laneX + CELL * .32, 0);
      lane.addColorStop(0, 'rgba(255,255,255,0)');
      lane.addColorStop(.5, 'rgba(255,250,205,.08)');
      lane.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = lane;
      ctx.fillRect(laneX - CELL * .32, fy + 12, CELL * .64, fh - 24);
    }
    ctx.strokeStyle = 'rgba(255,244,190,.30)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([7, 8]);
    ctx.beginPath();
    ctx.moveTo(BOARD_X - 6, fy + fh / 2);
    ctx.lineTo(BOARD_X + BOARD_W + 6, fy + fh / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  };

  drawWall = function artWallV4(hp, maxHp, isEnemy) {
    const y = isEnemy ? LAYOUT.enemyWallY : LAYOUT.playerWallY;
    const ratio = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
    const team = teamStyle(isEnemy);
    const w = Math.min(246, BOARD_W - 38);
    const x = (W - w) / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(21,15,8,.22)';
    ctx.shadowBlur = 4;
    fillRound(x, y + 4, w, 14, 7, 'rgba(30,28,22,.72)', 'rgba(255,240,196,.66)', 1);
    ctx.shadowBlur = 0;
    const grad = ctx.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, team.main);
    grad.addColorStop(1, team.light);
    fillRound(x + 3, y + 7, Math.max(5, (w - 6) * ratio), 8, 4, grad);
    ctx.fillStyle = '#fff7df';
    ctx.font = '800 9px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.ceil(hp)} / ${Math.ceil(maxHp)}`, W / 2, y + 11);
    ctx.restore();
  };

  drawSlotLevelBadgeV48 = function artSlotLevelV4(x, y, level, isEnemy) {
    const lv = Math.max(1, Math.min(7, level || 1));
    const team = teamStyle(!!isEnemy);
    const bx = x + CELL - 19;
    const by = y + 6;
    ctx.save();
    ctx.shadowColor = 'rgba(24,16,8,.28)';
    ctx.shadowBlur = 3;
    fillRound(bx, by, 17, 14, 6, lv >= 4 ? '#e9bd52' : 'rgba(35,32,24,.82)',
      lv >= 4 ? '#fff0a7' : team.light, .9);
    ctx.shadowBlur = 0;
    ctx.fillStyle = lv >= 4 ? '#4a2d0b' : '#fff7df';
    ctx.font = '900 8px "Nunito","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(lv), bx + 8.5, by + 7.2);
    ctx.restore();
  };

  drawInfo = function artInfoV4() {
    if (state.phase !== 'playing' && state.phase !== 'paused') return;
    const x = 12;
    const y = LAYOUT.enemyInfoY || 6;
    const level = state.currentLevel || 1;
    const elapsed = Math.floor(state.time || 0);
    ctx.save();
    ctx.shadowColor = 'rgba(6,18,16,.28)';
    ctx.shadowBlur = 8;
    fillRound(x, y, 132, 40, 12, 'rgba(17,39,36,.90)', 'rgba(255,235,184,.58)', 1);
    ctx.shadowBlur = 0;
    fillRound(x + 6, y + 7, 4, 26, 2, '#e6b84d');
    ctx.fillStyle = '#fff8e8';
    ctx.font = '900 14px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.mode === 'pvp' ? 'PVP' : `\u7b2c ${level} \u5173`, x + 18, y + 14);
    ctx.fillStyle = '#a9d8c8';
    ctx.font = '700 9px "Microsoft YaHei",sans-serif';
    ctx.fillText(state.levelConfig?.isBoss ? 'BOSS \u653b\u575a' : '\u679c\u56ed\u524d\u7ebf', x + 18, y + 29);

    fillRound(W / 2 - 31, y + 2, 62, 36, 12, 'rgba(34,25,30,.88)', 'rgba(255,235,184,.62)', 1);
    ctx.fillStyle = '#fff5d9';
    ctx.font = '900 15px "Nunito",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${elapsed}s`, W / 2, y + 20);
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  };

  drawHUD = function artHudV4() {
    if (state.phase !== 'playing' && state.phase !== 'paused') return;
    const y = LAYOUT.operationY || (LAYOUT.playerWallY + LAYOUT.wallH + 16);
    const x = BOARD_X;
    const h = LAYOUT.operationH || 48;
    const w = BOARD_W;
    const cost = typeof nextActionCostV60 === 'function' ? nextActionCostV60() : 1;
    const juice = Number(state.sp || 0);
    const canAct = juice >= cost;
    const btn = typeof getJuiceSpawnButtonRectV60 === 'function'
      ? getJuiceSpawnButtonRectV60()
      : { x:x + 116, y:y + 4, w:w - 120, h:h - 8 };

    ctx.save();
    ctx.shadowColor = 'rgba(4,25,24,.36)';
    ctx.shadowBlur = 10;
    fillRound(x, y, w, h, 14, 'rgba(10,54,52,.94)', 'rgba(255,235,184,.70)', 1.1);
    ctx.shadowBlur = 0;

    fillRound(x + 6, y + 6, 108, h - 12, 10, 'rgba(5,39,39,.76)', 'rgba(133,213,190,.34)', .8);
    const orbX = x + 24;
    const orbY = y + h / 2;
    const orb = ctx.createRadialGradient(orbX - 3, orbY - 4, 1, orbX, orbY, 10);
    orb.addColorStop(0, '#f3e49a');
    orb.addColorStop(.42, '#9fd36e');
    orb.addColorStop(1, '#3c7f5e');
    ctx.fillStyle = orb;
    ctx.beginPath();
    ctx.arc(orbX, orbY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a8d8c9';
    ctx.font = '700 9px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u679c\u6c41', x + 40, y + 14);
    ctx.fillStyle = '#fff8e4';
    ctx.font = '900 19px "Nunito",sans-serif';
    ctx.fillText(String(juice), x + 40, y + 30);

    const action = ctx.createLinearGradient(0, btn.y, 0, btn.y + btn.h);
    if (canAct) {
      action.addColorStop(0, '#f4d574');
      action.addColorStop(1, '#c78e31');
    } else {
      action.addColorStop(0, '#66746f');
      action.addColorStop(1, '#44514e');
    }
    ctx.shadowColor = canAct ? 'rgba(227,181,73,.28)' : 'rgba(0,0,0,.16)';
    ctx.shadowBlur = canAct ? 7 : 2;
    fillRound(btn.x, btn.y, btn.w, btn.h, 11, action, canAct ? '#fff0a9' : '#89928e', 1);
    ctx.shadowBlur = 0;
    ctx.fillStyle = canAct ? '#49300d' : '#d4d8d5';
    ctx.font = '900 14px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('\u53ec\u5524\u519b\u56e2', btn.x + btn.w * .43, btn.y + btn.h / 2 + .5);
    fillRound(btn.x + btn.w - 44, btn.y + 5, 38, btn.h - 10, 8,
      canAct ? 'rgba(73,48,13,.80)' : 'rgba(37,43,41,.60)', 'rgba(255,255,255,.22)', .8);
    ctx.fillStyle = canAct ? '#fff0ad' : '#d4d8d5';
    ctx.font = '900 11px "Nunito",sans-serif';
    ctx.fillText(`-${cost}`, btn.x + btn.w - 25, btn.y + btn.h / 2 + .5);
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  };

  function drawArtSoldier(s) {
    if (!s || !s.alive) return;
    const enemy = s.side === 'enemy';
    const baseY = typeof battleVisualYV59 === 'function' ? battleVisualYV59(s) : s.y;
    const depth = .82 + .18 * ((baseY - LAYOUT.fieldY) / Math.max(1, LAYOUT.fieldH));
    const tier = typeof battleUnitTierKeyV59 === 'function' ? battleUnitTierKeyV59(s) : 'small';
    const tierScale = ({small:1,large:1.08,elite:1.16,advanced:1.24,legendary:1.34})[tier] || 1;
    const levelScale = 1 + Math.min(6, Math.max(0, (s.level || 1) - 1)) * .035;
    const h = 74 * depth * tierScale * levelScale * (s._boss ? 1.18 : 1);
    const vis = typeof battleVisualPosV59 === 'function' ? battleVisualPosV59(s, h * .30) : {x:s.x,y:baseY};
    const fight = s.mode === 'fight' || s.mode === 'siege' || s.mode === 'siege_support';
    const bob = window.REDUCE_MOTION ? 0 : Math.sin((state.time || 0) * 7 + vis.x * .05) * (fight ? 1.2 : .55);
    const seed = String(s.id || s.type || 'unit').split('').reduce((n, ch) => ((n * 33) ^ ch.charCodeAt(0)) >>> 0, 5381);
    const x = vis.x + ((seed % 5) - 2) * 3.5;
    const ground = vis.y + h * .25 + bob;
    const team = teamStyle(enemy);
    const hpRatio = Math.max(0, Math.min(1, (Number(s.hp) || 0) / Math.max(1, Number(s.maxHp) || 1)));

    ctx.save();
    if (typeof isInvisible === 'function' && isInvisible(s)) ctx.globalAlpha = .42;
    ctx.fillStyle = enemy ? 'rgba(205,45,79,.20)' : 'rgba(0,151,137,.20)';
    ctx.strokeStyle = team.light;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(x, ground - 2, h * .25, h * .085, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.shadowColor = (s.hitFlash || 0) > .02 ? '#fff9ca' : team.main;
    ctx.shadowBlur = (s.hitFlash || 0) > .02 ? 16 : (fight ? 7 : 2);
    drawHeroSprite(heroIndex(s.type), x, ground, h, enemy, 1);
    ctx.shadowBlur = 0;

    const barW = Math.max(28, h * .62);
    const barY = ground - h - 6;
    if (hpRatio < .985 || fight || (s.shield || 0) > 0) {
      fillRound(x - barW / 2, barY, barW, 5, 3, 'rgba(23,17,16,.72)', 'rgba(255,245,210,.48)', .8);
      fillRound(x - barW / 2 + 1, barY + 1, Math.max(3, (barW - 2) * hpRatio), 3, 2,
        hpRatio > .35 ? team.light : '#ff654f');
    }
    if ((s.level || 1) >= 2) {
      fillRound(x + h * .17, barY - 8, 23, 12, 6, '#f4c74e', '#fff1a9', 1);
      ctx.fillStyle = '#4f2c0b';
      ctx.font = '900 8px "Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Lv${s.level}`, x + h * .17 + 11.5, barY - 2);
    }
    if (s._boss && typeof drawBossBadgeV59 === 'function') {
      drawBossBadgeV59(s, x, barY - 22, Math.max(96, h * 1.45));
    }
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  }

  drawSoldier = function artSoldierV4(s) {
    if (window.RenderHooks?.beforeDrawSoldier) window.RenderHooks.beforeDrawSoldier.run(ctx, s);
    drawArtSoldier(s);
    if (window.RenderHooks?.afterDrawSoldier) window.RenderHooks.afterDrawSoldier.run(ctx, s);
  };
  drawSoldier._artDirectionV4 = true;
})();
