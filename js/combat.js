/* ============================================================
   合成塔防 · PvE —— 战斗系统
   ============================================================ */

/* ——— 常量 ——— */
const SOLDIER_SPEED = 70;      // 像素/秒
const ATTACK_RANGE = 18;       // 攻击距离
const WALL_ATTACK_INTERVAL = 1.0; // 砍墙间隔 (秒)

/* ——— 兵移动至战场 ——— */
// 给新兵分配战场目标 Y（分散在战场区域）
function assignFieldTarget(s) {
  if (!s.targetY) {
    const margin = 24;
    if (s.side === 'player') {
      s.targetY = LAYOUT.fieldY + margin + Math.random() * (LAYOUT.fieldH * 0.4);
      s.targetX = 40 + Math.random() * (W - 80);
      s.x = s.x || (s.targetX + (Math.random() - 0.5) * 60);
    } else {
      s.targetY = LAYOUT.fieldY + LAYOUT.fieldH * 0.5 + margin + Math.random() * (LAYOUT.fieldH * 0.35);
      s.targetX = 40 + Math.random() * (W - 80);
      s.x = s.x || (s.targetX + (Math.random() - 0.5) * 60);
    }
  }
}

function moveSoldierToField(s) {
  assignFieldTarget(s);

  // 向目标 X 移动（扩散开）
  const dx = s.targetX - s.x;
  if (Math.abs(dx) > 5) {
    s.x += Math.sign(dx) * SOLDIER_SPEED * 0.6 * dt_global;
  }

  if (s.side === 'player') {
    // 玩家兵从下方（高Y）走向战场，需要向上移动（减小Y）
    if (s.y > s.targetY) {
      s.y -= SOLDIER_SPEED * dt_global;
      if (s.y < s.targetY) s.y = s.targetY;
      return true;
    }
  } else {
    // 敌方兵从上方（低Y）走向战场，需要向下移动（增大Y）
    if (s.y < s.targetY) {
      s.y += SOLDIER_SPEED * dt_global;
      if (s.y > s.targetY) s.y = s.targetY;
      return true;
    }
  }
  return false;
}

/* ——— 寻敌（单轮遍历：克制优先 → 最近） ——— */
function findTarget(s, enemies) {
  const counterType = COUNTER[s.type];
  let best = null, bestDist = Infinity;
  let bestCounter = null, bestCounterDist = Infinity;

  for (const e of enemies) {
    if (!e.alive) continue;
    const dx = s.x - e.x, dy = s.y - e.y;
    const dist = dx * dx + dy * dy;

    if (e.type === counterType) {
      if (dist < bestCounterDist) {
        bestCounter = e;
        bestCounterDist = dist;
      }
    }
    if (dist < bestDist) {
      best = e;
      bestDist = dist;
    }
  }

  return bestCounter || best;
}

/* ——— 移动至目标 ——— */
function moveToTarget(s, target) {
  const dx = target.x - s.x;
  const dy = target.y - s.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 2) return;
  const step = SOLDIER_SPEED * dt_global;
  s.x += (dx / dist) * Math.min(step, dist);
  s.y += (dy / dist) * Math.min(step, dist);
}

/* ——— 战斗 ——— */
function soldierCombat(s, enemies) {
  if (!s.alive) return;

  // 找目标：优先克制品类，其次最近
  const target = findTarget(s, enemies);

  if (!target) {
    // 没有敌人 → 走向/攻击敌方城墙
    const wallY = s.side === 'player' ? LAYOUT.enemyWallY : LAYOUT.playerWallY;
    const wallH = LAYOUT.wallH;
    const atWall = s.side === 'player'
      ? s.y <= wallY + wallH
      : s.y >= wallY;

    if (atWall) {
      // 已在城墙前 → 砍墙
      s.atkTimer -= dt_global;
      if (s.atkTimer <= 0) {
        if (s.side === 'player') {
          state.enemyWallHp = Math.max(0, state.enemyWallHp - s.level);
          addFx(s.x, wallY - 8, '💥', '#ff8a5a', 14);
        } else {
          state.playerWallHp = Math.max(0, state.playerWallHp - s.level);
          addFx(s.x, wallY + wallH + 8, '💥', '#ff5a3a', 14);
        }
        s.atkTimer = WALL_ATTACK_INTERVAL;
        state.shake = 0.3;
      }
      s.y = s.side === 'player' ? wallY + wallH : wallY;
      return;
    }

    // 走向城墙
    const targetY = s.side === 'player'
      ? wallY + wallH
      : wallY;
    moveToTarget(s, { x: s.x, y: targetY });
    return;
  }

  // 有目标 → 战斗
  const dx = s.x - target.x, dy = s.y - target.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > ATTACK_RANGE) {
    // 还没到攻击距离 → 走过去
    moveToTarget(s, target);
  } else {
    // 在攻击范围内 → 攻击
    s.atkTimer -= dt_global;
    if (s.atkTimer <= 0) {
      let dmg = s.atk;
      // 克制加成
      if (target.type === COUNTER[s.type]) {
        dmg = Math.round(dmg * COUNTER_DMG);
      }
      target.hp -= dmg;
      s.atkTimer = s.speed;

      // 攻击划痕
      state.attackFx.push({
        x1: s.x, y1: s.y, x2: target.x, y2: target.y,
        life: 0.25, maxLife: 0.25,
      });

      // 伤害数字
      const midX = (s.x + target.x) / 2;
      const midY = (s.y + target.y) / 2 - 8;
      addFx(midX, midY, `-${dmg}`, '#ff4a3a', 13);

      // 受击闪红（延长到0.3s更明显）
      target.hitFlash = 0.3;

      // 死亡
      if (target.hp <= 0) {
        target.alive = false;
        addFx(target.x, target.y - 6, '💀', '#ff6a4a', 12);
      }
    }
  }
}

/* ——— 更新所有兵 ——— */
function updateCombat() {
  if (state.phase !== 'playing') return;

  // 更新士兵
  for (const s of state.playerSoldiers) {
    if (!s.alive) continue;
    // 先走到战场
    const moving = moveSoldierToField(s);
    if (!moving) {
      // 已在战场 → 战斗
      soldierCombat(s, state.enemySoldiers);
    }
  }

  for (const s of state.enemySoldiers) {
    if (!s.alive) continue;
    const moving = moveSoldierToField(s);
    if (!moving) {
      soldierCombat(s, state.playerSoldiers);
    }
  }

  // 清理死兵
  state.playerSoldiers = state.playerSoldiers.filter(s => s.alive);
  state.enemySoldiers = state.enemySoldiers.filter(s => s.alive);

  // 城墙受击震动衰减
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt_global * 4);

  // 判定胜负
  if (state.playerWallHp <= 0) {
    state.phase = 'lost';
    onGameOver(false);
  } else if (state.enemyWallHp <= 0) {
    state.phase = 'won';
    onGameOver(true);
  }
}
