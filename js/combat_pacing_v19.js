/* ============================================================
   水果突击 · Combat Pacing v19
   修复：没时间看战场、清完兵没窗口打墙、城墙过厚、技能觉醒不明显、兵种站位不够职业化、编队无法下阵。
   只做节奏/显示/编队交互修正，不恢复合成扣费，不恢复自动出兵扣果汁。
   Loaded after deck_unlock_fix.js.
   ============================================================ */

(function installCombatPacingV19() {
  patchLevelPacingV19();
  patchEnemyReinforceWindowV19();
  patchSkillAwakenBoardVisualV19();
  patchRoleStanceV19();
  patchDeckEditV19();
})();

const COMBAT_PACING_BUILD = 'combat-pacing-v19';

/* ------------------------------------------------------------
   1) 城墙血量与敌方节奏：给玩家清兵后打墙窗口
   ------------------------------------------------------------ */
function patchLevelPacingV19() {
  if (typeof initLevel !== 'function' || initLevel._pacingV19) return;
  const oldInitLevel = initLevel;
  initLevel = function initLevelPacingV19(k) {
    oldInitLevel(k);

    // 城墙太厚会导致“清完兵还没拆墙下一波就来”。先压敌方果堡，玩家果堡只轻微压，避免节奏拖沓。
    const enemyMul = state.levelConfig?.isBoss ? 0.78 : 0.68;
    const playerMul = 0.92;
    state.enemyWallMax = Math.max(24, Math.round(state.enemyWallMax * enemyMul));
    state.enemyWallHp = Math.min(state.enemyWallHp, state.enemyWallMax);
    state.playerWallMax = Math.max(32, Math.round(state.playerWallMax * playerMul));
    state.playerWallHp = Math.min(state.playerWallHp, state.playerWallMax);

    // 敌方补球和合成节奏稍慢，给玩家观察战场的时间。
    if (state.levelConfig) {
      state.levelConfig.enemySpawnInterval = Math.max(4.8, (state.levelConfig.enemySpawnInterval || BALL_SPAWN_INTERVAL) * 1.34);
    }
    state.enemyBallTimer = Math.min(state.enemyBallTimer || 0, -1.2);
    state._enemyReinforcePause = 1.4;
    state._lastEnemyCombatantsV19 = 0;
    state._wallWindowTipCd = 0;
  };
  initLevel._pacingV19 = true;
}

function enemyCombatantsV19() {
  return (state.enemySoldiers || []).filter(s => s && s.alive && typeof isCombatant === 'function' && isCombatant(s)).length;
}
function playerCombatantsV19() {
  return (state.playerSoldiers || []).filter(s => s && s.alive && typeof isCombatant === 'function' && isCombatant(s)).length;
}
function hasPlayerPressureV19() {
  return (state.playerSoldiers || []).some(s => s && s.alive && s.battleReady && s.y < LAYOUT.playerWallY - 30);
}

function patchEnemyReinforceWindowV19() {
  if (typeof spawnSoldierFromBall === 'function' && !spawnSoldierFromBall._pacingV19) {
    const oldSpawn = spawnSoldierFromBall;
    spawnSoldierFromBall = function spawnSoldierFromBallPacingV19(ball, r, c, side, forced = false) {
      if (side === 'enemy' && (state._enemyReinforcePause || 0) > 0) return null;
      return oldSpawn(ball, r, c, side, forced);
    };
    spawnSoldierFromBall._pacingV19 = true;
  }

  if (typeof updateAI === 'function' && !updateAI._pacingV19) {
    const oldAI = updateAI;
    updateAI = function updateAIPacingV19(dt) {
      if ((state._enemyReinforcePause || 0) > 0) return;
      oldAI(dt * 0.78); // AI合成略慢，减少下方棋盘压力。
    };
    updateAI._pacingV19 = true;
  }

  if (typeof update === 'function' && !update._pacingV19) {
    const oldUpdate = update;
    update = function updatePacingV19(dt) {
      const beforeEnemy = enemyCombatantsV19();
      oldUpdate(dt);

      if (state.phase !== 'playing') return;
      if (state._enemyReinforcePause > 0) {
        state._enemyReinforcePause = Math.max(0, state._enemyReinforcePause - dt);
        state.enemyBallTimer = Math.min(state.enemyBallTimer || 0, -state._enemyReinforcePause);
      }
      if (state._wallWindowTipCd > 0) state._wallWindowTipCd = Math.max(0, state._wallWindowTipCd - dt);

      const afterEnemy = enemyCombatantsV19();
      // 敌方场面刚被清空，给4秒左右破墙窗口。
      if (beforeEnemy > 0 && afterEnemy === 0 && playerCombatantsV19() > 0 && hasPlayerPressureV19()) {
        const windowSec = state.currentLevel <= 3 ? 5.0 : 4.1;
        state._enemyReinforcePause = Math.max(state._enemyReinforcePause || 0, windowSec);
        state.enemyBallTimer = Math.min(state.enemyBallTimer || 0, -windowSec);
        if ((state._wallWindowTipCd || 0) <= 0) {
          addFx(W / 2, LAYOUT.fieldY + 58, '清线完成 · 破墙窗口', THEME.gold, 15);
          state._wallWindowTipCd = 5.0;
        }
      }
    };
    update._pacingV19 = true;
  }
}

/* ------------------------------------------------------------
   2) Lv4技能前端表现：棋盘觉醒 + 战斗技能符号更明显
   ------------------------------------------------------------ */
function skillVisualColorV19(type) {
  return ({
    watermelon_guard: '#53e77b', grape_archer: '#b076ff', banana_raider: '#ffd24a',
    pineapple_lancer: '#ffb547', orange_cannon: '#ff9a35'
  })[type] || TYPES[type]?.color || THEME.gold;
}
function isSkillTypeV19(type) {
  return ['watermelon_guard','grape_archer','banana_raider','pineapple_lancer','orange_cannon'].includes(type);
}
function drawMiniSkillGlyphV19(x, y, type, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.16);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (type === 'watermelon_guard') {
    ctx.beginPath(); ctx.moveTo(x, y-size); ctx.lineTo(x+size*.75,y-size*.3); ctx.lineTo(x+size*.42,y+size*.8); ctx.lineTo(x,y+size); ctx.lineTo(x-size*.42,y+size*.8); ctx.lineTo(x-size*.75,y-size*.3); ctx.closePath(); ctx.stroke();
  } else if (type === 'grape_archer') {
    for (let i=-1;i<=1;i++){ ctx.beginPath(); ctx.moveTo(x-size*.7,y+i*size*.36); ctx.lineTo(x+size*.7,y+i*size*.10); ctx.stroke(); }
  } else if (type === 'banana_raider') {
    ctx.beginPath(); ctx.moveTo(x-size*.65,y+size*.48); ctx.lineTo(x+size*.05,y-size*.78); ctx.lineTo(x+size*.66,y-size*.04); ctx.stroke();
  } else if (type === 'pineapple_lancer') {
    ctx.beginPath(); ctx.moveTo(x-size*.7,y+size*.62); ctx.lineTo(x+size*.75,y-size*.62); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x+size*.75,y-size*.62); ctx.lineTo(x+size*.25,y-size*.55); ctx.lineTo(x+size*.62,y-size*.15); ctx.stroke();
  } else if (type === 'orange_cannon') {
    ctx.strokeRect(x-size*.65,y-size*.25,size*1.05,size*.5); ctx.beginPath(); ctx.arc(x-size*.35,y+size*.5,size*.22,0,Math.PI*2); ctx.arc(x+size*.38,y+size*.5,size*.22,0,Math.PI*2); ctx.stroke();
  }
  ctx.restore();
}
function patchSkillAwakenBoardVisualV19() {
  if (typeof tryMerge === 'function' && !tryMerge._skillAwakenV19) {
    const oldTryMerge = tryMerge;
    tryMerge = function tryMergeSkillAwakenV19(slots, fromR, fromC, toR, toC) {
      const result = oldTryMerge(slots, fromR, fromC, toR, toC);
      if (result && result.merged && result.newLevel === 4 && isSkillTypeV19(result.type) && slots === state.playerSlots) {
        const center = slotCenter(toR, toC, false);
        const color = skillVisualColorV19(result.type);
        addFx(center.x, center.y - 38, '技能觉醒', color, 18);
        state.shake = Math.max(state.shake || 0, 0.55);
        if (typeof addJuiceShockV16 === 'function') addJuiceShockV16(center.x, center.y, color, 70, 0.55, 6);
        if (typeof addJuiceSparkV16 === 'function') addJuiceSparkV16(center.x, center.y, color, 22, 96, 4.4);
      }
      return result;
    };
    tryMerge._skillAwakenV19 = true;
  }

  if (typeof draw === 'function' && !draw._skillBoardV19) {
    const oldDraw = draw;
    draw = function drawSkillBoardV19() {
      oldDraw();
      drawBoardSkillHintsV19();
    };
    draw._skillBoardV19 = true;
  }
}
function drawBoardSkillHintsV19() {
  if (!state || state.phase !== 'playing') return;
  const t = performance.now() / 260;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const b = state.playerSlots?.[r]?.[c];
      if (!b || b.level < 4 || !isSkillTypeV19(b.type)) continue;
      const center = slotCenter(r, c, false);
      const color = skillVisualColorV19(b.type);
      const pulse = 0.75 + Math.sin(t + r + c) * 0.18;
      ctx.save();
      ctx.globalAlpha = 0.32 + 0.18 * pulse;
      ctx.strokeStyle = color;
      ctx.lineWidth = b.level >= 7 ? 5 : b.level >= 5 ? 4 : 3;
      ctx.beginPath();
      ctx.arc(center.x, center.y, CELL * (0.49 + b.level * 0.015), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.88;
      drawMiniSkillGlyphV19(center.x + CELL * 0.32, center.y - CELL * 0.32, b.type, 6 + b.level, color);
      ctx.restore();
    }
  }
}

/* ------------------------------------------------------------
   3) 兵种站位：近战贴前，远程/辅助/攻城站后
   ------------------------------------------------------------ */
function roleOfPacingV19(type) { return TYPES[type]?.role || ''; }
function isMeleeRoleV19(type) { return ['tank','front','rush'].includes(roleOfPacingV19(type)); }
function isBackRoleV19(type) { return ['back','support','control','siege'].includes(roleOfPacingV19(type)); }
function patchRoleStanceV19() {
  if (typeof attackTarget === 'function' && !attackTarget._stanceV19) {
    const oldAttackTarget = attackTarget;
    attackTarget = function attackTargetStanceV19(s, target) {
      if (s && target && isMeleeRoleV19(s.type)) {
        const d = Math.hypot(s.x - target.x, s.y - target.y);
        // 近战必须贴脸才能打，不能隔空输出。
        if (d > 30) {
          moveTowardEnemy(s, target);
          return;
        }
      }
      return oldAttackTarget(s, target);
    };
    attackTarget._stanceV19 = true;
  }

  if (typeof advanceTowardWall === 'function' && !advanceTowardWall._stanceV19) {
    const oldAdvance = advanceTowardWall;
    advanceTowardWall = function advanceTowardWallStanceV19(s) {
      if (!s || !isCombatant(s)) return oldAdvance(s);
      const group = s.side === 'player' ? state.playerSoldiers : state.enemySoldiers;
      if (isBackRoleV19(s.type)) {
        // 后排跟随本路最靠前的近战，保持距离，不再傻冲城墙。
        const fronts = group.filter(a => a.id !== s.id && isCombatant(a) && a.laneIndex === s.laneIndex && isMeleeRoleV19(a.type));
        if (fronts.length) {
          const lead = fronts.sort((a,b) => s.side === 'player' ? a.y - b.y : b.y - a.y)[0];
          const desiredY = lead.y + (s.side === 'player' ? 64 : -64);
          if ((s.side === 'player' && s.y < desiredY) || (s.side === 'enemy' && s.y > desiredY)) {
            s.y += (desiredY - s.y) * Math.min(1, dt_global * 3.5);
            s.x += (s.laneX - s.x) * Math.min(1, dt_global * 4);
            s.mode = 'backline';
            return;
          }
        }
      }
      return oldAdvance(s);
    };
    advanceTowardWall._stanceV19 = true;
  }
}

/* ------------------------------------------------------------
   4) 编队修复：允许先下阵，再换上；不再自动补满默认卡组
   ------------------------------------------------------------ */
function deckUnlockedV19() {
  if (typeof syncProgressUnlocks === 'function') syncProgressUnlocks(meta);
  return typeof progressUnlocked === 'function' ? progressUnlocked(meta) : UNIT_POOL.slice();
}
function sanitizeDeckForPlayV19(deck) {
  const unlocked = deckUnlockedV19();
  const result = [];
  for (const id of (deck || [])) {
    const nid = normalizeTypeId(id);
    if (TYPES[nid] && unlocked.includes(nid) && !result.includes(nid)) result.push(nid);
  }
  if (result.length === 0) result.push(DEFAULT_DECK[0]);
  return result.slice(0, DECK_SIZE);
}
function patchDeckEditV19() {
  const style = document.createElement('style');
  style.textContent = `.deck-chip{position:relative}.deck-chip.removeable{cursor:pointer}.deck-chip.removeable:after{content:'×';position:absolute;right:4px;top:2px;background:#ff6078;color:#fff;width:14px;height:14px;border-radius:50%;font-size:10px;line-height:14px}.deck-card .tag.offtag{background:#9ab678;color:#fff}.deck-card.fullhint{opacity:.62}`;
  document.head.appendChild(style);

  renderDeckPanel = function renderDeckPanelV19() {
    const unlocked = deckUnlockedV19();
    meta.deck = (meta.deck || []).map(normalizeTypeId).filter((id, idx, arr) => TYPES[id] && unlocked.includes(id) && arr.indexOf(id) === idx).slice(0, DECK_SIZE);

    const selected = document.getElementById('deckSelected');
    if (selected) {
      selected.innerHTML = '';
      for (let i = 0; i < DECK_SIZE; i++) {
        const id = meta.deck[i];
        const t = TYPES[id];
        const chip = document.createElement('div');
        chip.className = 'deck-chip' + (!t ? ' deck-empty' : ' removeable');
        chip.innerHTML = t ? `<b>${t.icon}</b>${t.name}` : `<b>+</b>空位`;
        if (t) chip.addEventListener('click', () => { meta.deck = meta.deck.filter(x => x !== id); saveMeta(); renderDeckPanel(); refreshDeckPreview(); });
        selected.appendChild(chip);
      }
    }

    const list = document.getElementById('deckList');
    if (!list) return;
    list.innerHTML = '';
    for (const id of UNIT_POOL) {
      const t = TYPES[id];
      const on = meta.deck.includes(id);
      const locked = !unlocked.includes(id);
      const full = meta.deck.length >= DECK_SIZE && !on;
      const card = document.createElement('div');
      card.className = 'deck-card' + (on ? ' on' : '') + ((locked || full) ? ' disabled' : '') + (locked ? ' locked' : '') + (full ? ' fullhint' : '');
      card.innerHTML = `
        ${on ? '<span class="tag">已上阵</span>' : locked ? `<span class="tag locktag">第${unlockLevelFor(id)}关解锁</span>` : full ? '<span class="tag offtag">先下阵</span>' : ''}
        <div class="icon">${t.icon}</div>
        <div class="name">${t.name}</div>
        <div class="role">${roleText(t.role)} · ${t.rarity}</div>
        <div class="desc">${t.desc}</div>`;
      card.addEventListener('click', () => {
        if (locked) return;
        if (on) meta.deck = meta.deck.filter(x => x !== id);
        else if (meta.deck.length < DECK_SIZE) meta.deck.push(id);
        else { addFx(W / 2, LAYOUT.playerBoardY - 18, '先点上方阵容下阵一个水果', THEME.gold, 13); return; }
        saveMeta(); renderDeckPanel(); refreshDeckPreview();
      });
      list.appendChild(card);
    }
  };

  const oldRefresh = refreshDeckPreview;
  refreshDeckPreview = function refreshDeckPreviewV19() {
    meta.deck = sanitizeDeckForPlayV19(meta.deck);
    saveMeta();
    if (typeof oldRefresh === 'function') oldRefresh();
    const el = document.getElementById('menuDeck');
    if (el) el.innerHTML = meta.deck.map(id => `<span title="${TYPES[id].name}">${TYPES[id].icon}</span>`).join('');
  };

  const closeBtn = document.getElementById('btnDeckClose');
  if (closeBtn) {
    closeBtn.onclick = () => {
      meta.deck = sanitizeDeckForPlayV19(meta.deck);
      saveMeta();
      refreshDeckPreview();
      document.getElementById('deckPanel').classList.add('hide');
    };
  }
}
