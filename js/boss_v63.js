/* ============================================================
   水果突击 · Named Bosses v63 (Phase 7)
   ------------------------------------------------------------
   第 5/10/15/20 关的命名 Boss + 专属机制(设计档 §9.1):
   - 5  腐坏西瓜王 : 每 10s 全体敌方 +25 护盾
   - 10 腐坏榴莲炮 : 每 ~3.5s 对中路玩家群体 AOE(攻城系,伤害 ×1.4)
   - 15 腐坏双生果 : 两只 Boss(硬壳坦 + 高攻刃)
   - 20 腐坏果王   : 减速光环(近身玩家兵)+ 每 15s 召唤 3 小怪

   作为独立附加层:hook initLevel(Boss 关生成 Boss 敌兵)+ hook updateCombat
   (每帧 tick 机制)。Boss 用高 level 让既有渲染自动放大,不改 stickman。
   纯 PVE 内容,不动 combat baseline(基线 harness 不加载本文件)。
   ============================================================ */
(function installBossV63() {
  return; // 去Boss:禁用整个命名Boss层(不再刷Boss大怪/护盾/炮击/双生/召唤;代码保留可回退)
  const BOSS_LEVEL_UNIT = 8; // 仅用于渲染放大;数值单独覆盖

  const BOSS_DEFS = {
    5:  [{ kind: 'melon_king',   base: 'watermelon_guard', name: '腐坏西瓜王', hp: 600, atk: 16 }],
    10: [{ kind: 'durian_cannon', base: 'orange_cannon',   name: '腐坏榴莲炮', hp: 520, atk: 22 }],
    15: [{ kind: 'twin_shell',   base: 'coconut_guard',    name: '腐坏双生·壳', hp: 520, atk: 14, lane: 1 },
         { kind: 'twin_blade',   base: 'lemon_assassin',   name: '腐坏双生·刃', hp: 360, atk: 30, lane: 3 }],
    20: [{ kind: 'fruit_king',   base: 'pumpkin_roller',   name: '腐坏果王',   hp: 900, atk: 26 }],
  };

  function bossDefsFor(k) {
    if (BOSS_DEFS[k]) return BOSS_DEFS[k];
    // 无尽/更高 Boss 关:沿用果王,按关数增强
    return BOSS_DEFS[20];
  }

  function bossHintFor(k) {
    if (k === 5) return 'Boss机制：护盾，带攻城破盾';
    if (k === 10) return 'Boss机制：炮击，分散站位';
    if (k === 15) return 'Boss机制：双路压力，保留救线';
    if (k === 20) return 'Boss机制：召唤光环，先清小怪';
    return 'Boss机制：稳住前排再攻城';
  }

  function spawnBoss(cfg, k) {
    const s = createSoldier(cfg.base, BOSS_LEVEL_UNIT);
    const scale = 1 + Math.max(0, k - 5) * 0.05;
    s.side = 'enemy';
    s.name = cfg.name;
    s._boss = true;
    s._bossKind = cfg.kind;
    s.hp = s.maxHp = Math.round(cfg.hp * scale);
    s.atk = Math.round(cfg.atk * scale);
    s.armor = (s.armor || 0) + 6;
    s.siege = Math.max(s.siege || 1, 1.3);
    const lane = typeof cfg.lane === 'number' ? cfg.lane : 2;
    s.laneIndex = lane;
    s.laneX = laneXByIndex(lane);
    s.x = s.laneX;
    s.y = LAYOUT.enemyWallY + LAYOUT.wallH + 10;
    s.alive = true;
    s.battleReady = true;
    s.protected = false;
    s.mode = 'march';
    s._bossTimer = 0;
    state.enemySoldiers.push(s);
    return s;
  }

  function bossTick(dt) {
    if (!state || state.phase !== 'playing') return;
    const list = state.enemySoldiers || [];
    for (const b of list) {
      if (!b || !b.alive || !b._boss) continue;
      b._bossTimer = (b._bossTimer || 0) + dt;

      if (b._bossKind === 'melon_king') {
        if (b._bossTimer >= 10) {
          b._bossTimer = 0;
          for (const e of state.enemySoldiers) {
            if (e && e.alive) { e.shield = (e.shield || 0) + 25; e.maxShield = Math.max(e.maxShield || 0, e.shield); }
          }
          if (typeof addFx === 'function') addFx(b.x, b.y - 34, '全体护盾+25', '#53c96a', 13);
        }
      } else if (b._bossKind === 'durian_cannon') {
        if (b._bossTimer >= 3.5) {
          b._bossTimer = 0;
          const dmg = Math.round(b.atk * 1.5);
          let hit = 0;
          for (const p of state.playerSoldiers) {
            if (hit >= 4) break;
            if (p && p.alive && Math.abs((p.laneIndex ?? 2) - 2) <= 1) {
              if (typeof applyFruitDamage === 'function') applyFruitDamage(p, dmg, { type: 'orange_cannon', firstHit: false });
              else p.hp -= dmg;
              if (p.hp <= 0 && typeof killSoldier === 'function') killSoldier(p, 'enemy', dmg, 'orange_cannon');
              hit++;
            }
          }
          if (typeof addFx === 'function') addFx(b.x, b.y - 34, '榴莲炮 AOE', '#b06a2e', 13);
          state.shake = Math.max(state.shake || 0, 0.5);
        }
      } else if (b._bossKind === 'fruit_king') {
        // 减速光环:近身玩家兵持续减速
        if (typeof applyStatus === 'function') {
          for (const p of state.playerSoldiers) {
            if (p && p.alive && Math.hypot(p.x - b.x, p.y - b.y) < 95) applyStatus(p, b, 'slowed', 0.6);
          }
        }
        if (b._bossTimer >= 15) {
          b._bossTimer = 0;
          const lanes = [1, 2, 3];
          for (let i = 0; i < 3; i++) {
            const ball = createBall('banana_raider', 3);
            const spawned = typeof spawnSoldierFromBall === 'function' ? spawnSoldierFromBall(ball, 0, lanes[i], 'enemy', true) : null;
            if (!spawned) {
              // 降级:超过 MAX_SOLDIERS 或 spawnSoldierFromBall 不可用时直接造
              const m = createSoldier('banana_raider', 3);
              m.side = 'enemy'; m.laneIndex = lanes[i]; m.laneX = laneXByIndex(lanes[i]);
              m.x = m.laneX; m.y = b.y + 12; m.alive = true; m.battleReady = true; m.protected = false; m.mode = 'march';
              state.enemySoldiers.push(m);
            }
          }
          if (typeof addFx === 'function') addFx(b.x, b.y - 34, '果王召唤!', '#c0392b', 14);
        }
      }
      // twin_shell / twin_blade:无周期机制,靠高数值本身
    }
  }

  // hook initLevel:Boss 关生成 Boss
  if (typeof initLevel === 'function' && !initLevel._bossV63) {
    const oldInit = initLevel;
    initLevel = function initLevelBossV63(k) {
      oldInit(k);
      if (state.levelConfig && state.levelConfig.isBoss) {
        const defs = bossDefsFor(k);
        for (const cfg of defs) spawnBoss(cfg, k);
        if (typeof addFx === 'function') addFx(W / 2, LAYOUT.fieldY + 28, bossHintFor(k), '#FFE9A8', 15);
      }
    };
    initLevel._bossV63 = true;
  }

})();
