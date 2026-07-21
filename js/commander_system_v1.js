/* ============================================================
   球球英雄二 · 主公系统 v1
   玩法逻辑与 2D 绘制分离，供浏览器对局和数值仿真共同调用。
   ============================================================ */
(function installCommanderSystemV1() {
  'use strict';

  const COMMANDERS = (window.WORLD_THEME && window.WORLD_THEME.commanders) || {
    orchard_lord: {
      id: 'orchard_lord', name: '果园领主', skill: '果园号令', maxCd: 24, duration: 6,
      desc: '6秒内兵营产兵与全军攻击加速。',
    },
    berry_general: {
      id: 'berry_general', name: '莓果将军', skill: '坚壁反攻', maxCd: 27, duration: 5,
      desc: '立即修复城墙，并进入5秒反攻状态。',
    },
    juice_sage: {
      id: 'juice_sage', name: '果汁贤者', skill: '丰收时刻', maxCd: 26, duration: 8,
      desc: '立即获得果汁，持续期间追加果汁补给。',
    },
  };

  function commanderLevel(id) {
    const value = Number(window.shell && window.shell.commanderLv && window.shell.commanderLv[id]);
    return Math.max(1, Math.min(20, Number.isFinite(value) ? value : 1));
  }

  function selectedCommanderId() {
    const id = window.shell && window.shell.commanderId;
    return COMMANDERS[id] ? id : 'orchard_lord';
  }

  function makeCommander(id, enemy) {
    const def = COMMANDERS[id] || COMMANDERS.orchard_lord;
    const level = enemy ? Math.max(1, Math.ceil(Number(state.currentLevel || 1) / 4)) : commanderLevel(def.id);
    const cdReduction = Math.min(5, (level - 1) * 0.25);
    return {
      id: def.id,
      level,
      cd: enemy ? 14 : 0,
      maxCd: Math.max(18, def.maxCd - cdReduction),
      active: 0,
      pulseTimer: 0,
    };
  }

  function ensureCommanderState() {
    if (!state.commander) state.commander = makeCommander(selectedCommanderId(), false);
    if (!state.enemyCommander) state.enemyCommander = makeCommander('berry_general', true);
    return state.commander;
  }

  function resetCommanderState() {
    state.commander = makeCommander(selectedCommanderId(), false);
    state.enemyCommander = makeCommander('berry_general', true);
  }

  function addPlayerJuice(amount) {
    const cap = typeof getSpMax === 'function' ? getSpMax(meta) : 24;
    const before = Number(state.sp || 0);
    state.sp = Math.min(cap, before + amount);
    return state.sp - before;
  }

  function activateCommanderSkill() {
    const commander = ensureCommanderState();
    if (state.phase !== 'playing' || commander.cd > 0) return false;
    if (state.mode === 'pvp') {
      const sent = !!(window.pvpClient && window.pvpClient.localCommanderSkill && window.pvpClient.localCommanderSkill());
      if (!sent) return false;
      // 防止网络往返期间重复点击；下一帧权威快照会覆盖真实值。
      commander.cd = commander.maxCd || 24;
      if (typeof playSfx === 'function') playSfx('merge');
      return true;
    }
    const def = COMMANDERS[commander.id] || COMMANDERS.orchard_lord;
    commander.cd = commander.maxCd;
    commander.active = def.duration;
    commander.pulseTimer = 0;

    if (commander.id === 'orchard_lord') {
      for (const ball of state.playerSlots.flat()) if (ball) ball.spawnTimer = Math.max(0, (ball.spawnTimer || 0) - 2);
      for (const soldier of state.playerSoldiers) if (soldier && soldier.alive) soldier.atkTimer = 0;
    } else if (commander.id === 'berry_general') {
      const heal = Math.round(Number(state.playerWallMax || 0) * (0.14 + commander.level * 0.003));
      state.playerWallHp = Math.min(state.playerWallMax, Number(state.playerWallHp || 0) + heal);
    } else if (commander.id === 'juice_sage') {
      addPlayerJuice(5 + Math.floor(commander.level / 5));
    }

    if (typeof addFx === 'function') addFx(82, LAYOUT.playerBoardY + 34, `主公技·${def.skill}`, '#ffe6a0', 12);
    if (typeof playSfx === 'function') playSfx('merge');
    return true;
  }

  function updateCommanderSystem(dt) {
    if (state.phase !== 'playing' || state.mode === 'pvp') return;
    ensureCommanderState();
    const own = state.commander;
    const enemy = state.enemyCommander;
    own.cd = Math.max(0, own.cd - dt);
    own.active = Math.max(0, own.active - dt);
    enemy.cd = Math.max(0, enemy.cd - dt);
    enemy.active = Math.max(0, enemy.active - dt);

    if (own.id === 'orchard_lord' && own.active > 0) {
      for (const ball of state.playerSlots.flat()) if (ball) ball.spawnTimer = Math.max(0, (ball.spawnTimer || 0) - dt * 0.55);
      for (const soldier of state.playerSoldiers) if (soldier && soldier.alive) soldier.atkTimer = Math.max(0, (soldier.atkTimer || 0) - dt * 0.42);
    } else if (own.id === 'berry_general' && own.active > 0) {
      for (const soldier of state.playerSoldiers) if (soldier && soldier.alive) soldier.atkTimer = Math.max(0, (soldier.atkTimer || 0) - dt * 0.18);
    } else if (own.id === 'juice_sage' && own.active > 0) {
      own.pulseTimer += dt;
      while (own.pulseTimer >= 2) {
        own.pulseTimer -= 2;
        addPlayerJuice(1);
      }
    }

    if (enemy.active > 0) {
      for (const soldier of state.enemySoldiers) if (soldier && soldier.alive) soldier.atkTimer = Math.max(0, (soldier.atkTimer || 0) - dt * 0.25);
    }
    if (enemy.cd <= 0) {
      enemy.cd = enemy.maxCd;
      enemy.active = 4;
      if (typeof addFx === 'function') addFx(W - 42, LAYOUT.enemyBoardY + 42, '敌将号令', '#ffd0c3', 11);
    }
  }

  window.COMMANDER_DEFS = COMMANDERS;
  window.ensureCommanderStateV1 = ensureCommanderState;
  window.resetCommanderStateV1 = resetCommanderState;
  window.activateCommanderSkillV1 = activateCommanderSkill;
  window.updateCommanderSystemV1 = updateCommanderSystem;

  if (typeof initLevel === 'function' && !initLevel._commanderV1) {
    const previousInitLevel = initLevel;
    initLevel = function initLevelWithCommanderV1(k) {
      const result = previousInitLevel(k);
      resetCommanderState();
      return result;
    };
    initLevel._commanderV1 = true;
  }

  if (typeof update === 'function' && !update._commanderV1) {
    const previousUpdate = update;
    update = function updateWithCommanderV1(dt) {
      previousUpdate(dt);
      updateCommanderSystem(dt);
    };
    update._commanderV1 = true;
  }
})();
