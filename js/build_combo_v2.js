/* ============================================================
   Fruit Assault - Build Combo v2
   A small PvE-only layer for mid-game build payoff.
   ============================================================ */
(function installBuildComboV2() {
  if (window.BuildComboV2 && window.BuildComboV2.installed) return;

  const BUILD_COMPONENTS = {
    fire: ['back', 'rush', 'siege'],
    line: ['tank', 'front', 'control'],
    engine: ['support', 'merge'],
  };

  const TEXT = {
    lv2: 'Lv2 \u52a0\u901f',
    fire: '\u706b\u529b\u63a5\u901a',
    line: '\u9635\u7ebf\u63a5\u901a',
    engine: '\u5f15\u64ce\u63a5\u901a',
    break: '\u7834\u9635\u8054\u52a8',
    juice: '\u679c\u6c41\u8054\u52a8',
    hold: '\u7a33\u7ebf\u8054\u52a8',
    formed: 'BUILD \u6210\u578b',
  };

  function isPvpMode() {
    return !!(state && state.mode === 'pvp') || !!window.__pvpMode;
  }

  function componentOf(typeId) {
    const t = TYPES && TYPES[typeId];
    if (!t) return '';
    const tags = Array.isArray(t.tags) ? t.tags : [];
    if (tags.includes('econ')) return 'engine';
    const role = t.role || '';
    for (const key of Object.keys(BUILD_COMPONENTS)) {
      if (BUILD_COMPONENTS[key].includes(role)) return key;
    }
    return '';
  }

  function ensureState() {
    if (!state) return null;
    if (!state._buildComboV2) resetForLevel();
    return state._buildComboV2;
  }

  function now() {
    return Math.max(0, Number(state && state.time) || 0);
  }

  function metricsTemplate() {
    return {
      maxMergeLevel: 0,
      firstLv2Time: null,
      firstLv3Time: null,
      pairComboCount: 0,
      formedAt: null,
      summonCount: 0,
      mergeCount: 0,
    };
  }

  function resetForLevel() {
    if (!state) return null;
    state._buildComboV2 = {
      componentLevels: { fire: 0, line: 0, engine: 0 },
      online: { fire: false, line: false, engine: false },
      triggeredPairs: {},
      spawnBoostUntil: 0,
      formedReadyAt: null,
      formedUntil: 0,
      formed: false,
      metrics: metricsTemplate(),
    };
    return state._buildComboV2;
  }

  function colorFor(component) {
    if (component === 'fire') return '#ffb347';
    if (component === 'line') return '#53e77b';
    if (component === 'engine') return '#38c6e8';
    return (THEME && THEME.gold) || '#f5c242';
  }

  function fxAt(x, y, text, color, size, priority) {
    if (priority === 'build' && state && Array.isArray(state.fx)) {
      const life = text && String(text).includes('BUILD') ? 1.45 : 1.18;
      state.fx.push({
        x,
        y,
        text,
        color,
        size: size || 13,
        life,
        maxLife: life,
        priority: 'build',
      });
      return;
    }
    if (typeof addFx === 'function') addFx(x, y, text, color, size || 12);
  }

  function slotFx(r, c, text, color, size) {
    if (typeof slotCenter === 'function') {
      const p = slotCenter(r, c, false);
      fxAt(p.x, p.y - 26, text, color, size, 'build');
    } else {
      fxAt(W / 2, H / 2, text, color, size, 'build');
    }
  }

  function boardFx(text, color, size) {
    const y = typeof LAYOUT !== 'undefined' ? (LAYOUT.fieldY + 30) : H / 2;
    fxAt(W / 2, y, text, color, size || 14, 'build');
  }

  function grantJuice(amount, label) {
    if (!state || amount <= 0) return;
    state.sp = (Number(state.sp) || 0) + amount;
    if (typeof pulseJuice === 'function') pulseJuice(amount, 'gain');
    const y = typeof LAYOUT !== 'undefined' ? (LAYOUT.operationY || LAYOUT.playerBoardY || H / 2) - 6 : H / 2;
    fxAt(W / 2, y, '+' + amount + ' \u679c\u6c41' + (label ? ' ' + label : ''), (THEME && THEME.gold) || '#f5c242', 11, label ? 'build' : '');
  }

  function lowerSummonCost(amount) {
    if (!state || amount <= 0) return;
    state.summonActionCount = Math.max(0, (Number(state.summonActionCount) || 0) - amount);
    state.summonCostCounter = Math.max(1, (Number(state.summonCostCounter) || 1) - amount);
  }

  function shieldPlayerSoldiers() {
    if (!state || !Array.isArray(state.playerSoldiers)) return;
    for (const s of state.playerSoldiers) {
      if (!s || !s.alive) continue;
      const maxHp = Number(s.maxHp) || Number(s.hp) || 0;
      const shield = Math.round(8 + maxHp * 0.12);
      s.shield = Math.max(Number(s.shield) || 0, (Number(s.shield) || 0) + shield);
      s.maxShield = Math.max(Number(s.maxShield) || 0, Number(s.shield) || 0);
    }
  }

  function scanComponentLevels() {
    const b = ensureState();
    if (!b || !state || !state.playerSlots) return b;
    const levels = { fire: 0, line: 0, engine: 0 };
    for (const row of state.playerSlots) {
      for (const ball of row) {
        if (!ball) continue;
        const component = componentOf(ball.type);
        if (!component) continue;
        levels[component] = Math.max(levels[component], Number(ball.level) || 1);
      }
    }
    b.componentLevels = levels;
    for (const key of Object.keys(levels)) {
      if (levels[key] >= 3) b.online[key] = true;
    }
    return b;
  }

  function triggerPair(key, text, color, effect) {
    const b = ensureState();
    if (!b || b.triggeredPairs[key]) return;
    b.triggeredPairs[key] = true;
    b.metrics.pairComboCount++;
    boardFx(text, color, 15);
    effect(b);
  }

  function checkCombos() {
    const b = ensureState();
    if (!b || isPvpMode()) return;
    const lv = b.componentLevels;
    const currentLevel = Number(state.currentLevel) || 1;

    if ((lv.fire >= 2 && lv.line >= 1) || (lv.line >= 2 && lv.fire >= 1)) {
      triggerPair('fire_line', TEXT.break, '#ffb347', combo => {
        combo.spawnBoostUntil = Math.max(combo.spawnBoostUntil, now() + 8);
      });
    }
    if ((lv.fire >= 2 && lv.engine >= 1) || (lv.engine >= 2 && lv.fire >= 1)) {
      triggerPair('fire_engine', TEXT.juice, '#ffd86a', () => {
        grantJuice(3, TEXT.juice);
        lowerSummonCost(2);
      });
    }
    if ((lv.line >= 2 && lv.engine >= 1) || (lv.engine >= 2 && lv.line >= 1)) {
      triggerPair('line_engine', TEXT.hold, '#7ee0a0', () => {
        grantJuice(2, TEXT.hold);
        shieldPlayerSoldiers();
      });
    }

    const hasThreeComponentBase = lv.fire >= 1 && lv.line >= 1 && lv.engine >= 1;
    const hasAtLeastOneOnline = b.online.fire || b.online.line || b.online.engine;
    const hasMaturePair = currentLevel >= 6 && b.metrics.pairComboCount >= 1 && b.metrics.firstLv3Time != null;
    const canForm = currentLevel >= 6 && ((hasThreeComponentBase && hasAtLeastOneOnline) || hasMaturePair);
    if (!b.formed && canForm && b.formedReadyAt == null) {
      b.formedReadyAt = Math.max(currentLevel <= 10 ? 12 : 14, now());
    }
    if (!b.formed && b.formedReadyAt != null && now() >= b.formedReadyAt) {
      b.formed = true;
      b.formedUntil = Math.max(b.formedUntil, now() + 12);
      b.metrics.formedAt = now();
      grantJuice(5, TEXT.formed);
      lowerSummonCost(3);
      boardFx(TEXT.formed, (THEME && THEME.gold) || '#f5c242', 18);
    }
  }

  function onMerge(result, toR, toC) {
    if (!result || !result.merged || isPvpMode()) return;
    const b = ensureState();
    if (!b) return;
    const level = Number(result.newLevel) || 1;
    const component = componentOf(result.type);

    b.metrics.mergeCount++;
    b.metrics.maxMergeLevel = Math.max(b.metrics.maxMergeLevel, level);

    const ball = state.playerSlots && state.playerSlots[toR] && state.playerSlots[toR][toC];
    if (level >= 2) {
      if (b.metrics.firstLv2Time == null) b.metrics.firstLv2Time = now();
      if (ball) ball.spawnTimer = Math.min(Number(ball.spawnTimer) || 0, 0.75);
      slotFx(toR, toC, TEXT.lv2, (THEME && THEME.gold) || '#f5c242', 12);
    }

    if (!component) return;
    scanComponentLevels();

    if (level >= 3) {
      if (b.metrics.firstLv3Time == null) b.metrics.firstLv3Time = now();
      if (!b.online[component]) {
        b.online[component] = true;
        slotFx(toR, toC, TEXT[component], colorFor(component), 14);
      }
    }
    checkCombos();
  }

  function updateMetrics() {
    const b = ensureState();
    if (!b) return;
    b.metrics.summonCount = Number(state.summonCount) || b.metrics.summonCount || 0;
    b.metrics.mergeCount = Math.max(b.metrics.mergeCount || 0, Number(state.merges) || 0);
  }

  function boostPlayerBalls(dt) {
    if (!state || state.phase !== 'playing' || isPvpMode()) return;
    const b = ensureState();
    if (!b) return;
    scanComponentLevels();
    checkCombos();
    let extra = 0;
    if (now() < b.spawnBoostUntil) extra += 0.65;
    if (now() < b.formedUntil) extra += 0.75;
    if (extra <= 0 || !state.playerSlots) {
      updateMetrics();
      return;
    }
    for (const row of state.playerSlots) {
      for (const ball of row) {
        if (ball) ball.spawnTimer -= dt * extra;
      }
    }
    updateMetrics();
  }

  function weightedRandomType(oldRandomType, pool) {
    if (isPvpMode()) return oldRandomType(pool);
    const list = (pool && pool.length ? pool : (typeof activeDeck === 'function' ? activeDeck() : DEFAULT_DECK)).filter(id => TYPES && TYPES[id]);
    if (!list.length) return oldRandomType(pool);
    const b = ensureState();
    const counts = {};
    const levelsByType = {};
    if (state && state.playerSlots) {
      for (const row of state.playerSlots) {
        for (const ball of row) {
          if (!ball) continue;
          levelsByType[ball.type] = levelsByType[ball.type] || {};
          levelsByType[ball.type][ball.level] = (levelsByType[ball.type][ball.level] || 0) + 1;
          if (ball.level >= 3) continue;
          counts[ball.type] = (counts[ball.type] || 0) + 1;
        }
      }
    }
    const liveLevels = { fire: 0, line: 0, engine: 0 };
    for (const id of Object.keys(levelsByType)) {
      const comp = componentOf(id);
      if (!comp) continue;
      for (const level of Object.keys(levelsByType[id])) {
        liveLevels[comp] = Math.max(liveLevels[comp], Number(level) || 1);
      }
    }
    const liveComponentCount = Object.keys(liveLevels).filter(key => liveLevels[key] > 0).length;
    const weights = list.map(id => {
      let weight = 0.75;
      const byLevel = levelsByType[id] || {};
      const lv1 = byLevel[1] || 0;
      const lv2 = byLevel[2] || 0;
      const lv3Plus = Object.keys(byLevel).some(level => Number(level) >= 3);
      if (lv1 >= 1) weight += 2.4;
      if (lv1 >= 2) weight += 1.8;
      if (lv2 >= 1) weight += 5.4;
      if (lv2 >= 1 && lv1 >= 1) weight += 2.2;
      if (lv3Plus) weight *= 0.55;
      const comp = componentOf(id);
      if (b) {
        if (liveComponentCount === 1 && comp && liveLevels[comp] <= 0) weight += 12.0;
        if (!b.online.fire && comp === 'fire') weight += 1.2;
        if (liveLevels.fire >= 2 && liveLevels.line < 1 && comp === 'line') weight += 10.0;
        if (liveLevels.line >= 2 && liveLevels.fire < 1 && comp === 'fire') weight += 10.0;
        if (liveLevels.fire >= 2 && liveLevels.line < 2 && comp === 'line') weight += 5.4;
        if (liveLevels.line >= 2 && liveLevels.fire < 3 && comp === 'fire') weight += 4.6;
        if (b.online.fire && liveLevels.line < 2 && comp === 'line') weight += 7.0;
        if (liveLevels.fire >= 3 && liveLevels.line >= 2 && liveLevels.engine < 2 && comp === 'engine') weight += 5.6;
        if ((liveLevels.fire >= 2 || liveLevels.line >= 2) && liveLevels.engine < 1 && comp === 'engine') weight += 8.5;
        if ((Number(state.currentLevel) || 1) >= 6 && liveLevels.fire >= 1 && liveLevels.line >= 1 && liveLevels.engine < 1 && comp === 'engine') weight += 8.0;
        if (b.online.line && !b.online.engine && comp === 'engine') weight += 2.8;
        if (b.online.fire && b.online.line && !b.online.engine && comp === 'engine') weight += 4.8;
      }
      return weight;
    });
    let total = weights.reduce((sum, v) => sum + v, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < list.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return list[i];
    }
    return list[list.length - 1];
  }

  function installTryMergePatch() {
    if (typeof tryMerge !== 'function' || tryMerge._buildComboV2) return;
    const oldTryMerge = tryMerge;
    tryMerge = function buildComboTryMerge(slots, fromR, fromC, toR, toC) {
      const result = oldTryMerge(slots, fromR, fromC, toR, toC);
      if (result && result.merged && state && slots === state.playerSlots) {
        onMerge(result, toR, toC);
      }
      return result;
    };
    tryMerge._buildComboV2 = true;
  }

  function installRandomTypePatch() {
    if (typeof randomType !== 'function' || randomType._buildComboV2) return;
    const oldRandomType = randomType;
    randomType = function buildComboRandomType(pool) {
      return weightedRandomType(oldRandomType, pool);
    };
    randomType._buildComboV2 = true;
  }

  function installInitPatch() {
    if (typeof initLevel !== 'function' || initLevel._buildComboV2) return;
    const oldInitLevel = initLevel;
    initLevel = function initLevelBuildComboV2(k) {
      const result = oldInitLevel(k);
      resetForLevel();
      return result;
    };
    initLevel._buildComboV2 = true;
  }

  function installUpdateHook() {
    if (window.GameHooks && window.GameHooks.update && typeof window.GameHooks.update.use === 'function') {
      window.GameHooks.update.use(boostPlayerBalls, 0);
    } else if (window.GameHooks && window.GameHooks.update && typeof window.GameHooks.update.register === 'function') {
      window.GameHooks.update.register(boostPlayerBalls, 'build-combo-v2');
    } else if (typeof update === 'function' && !update._buildComboV2) {
      const oldUpdate = update;
      update = function updateBuildComboV2(dt) {
        oldUpdate(dt);
        boostPlayerBalls(dt);
      };
      update._buildComboV2 = true;
    }
  }

  window.BuildComboV2 = {
    installed: true,
    components: BUILD_COMPONENTS,
    componentOf,
    onMerge,
    resetForLevel,
    metrics() {
      const b = ensureState();
      return b ? Object.assign({}, b.metrics) : metricsTemplate();
    },
  };

  installInitPatch();
  installTryMergePatch();
  installRandomTypePatch();
  installUpdateHook();
  if (state) ensureState();
})();
