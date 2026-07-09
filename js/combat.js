/* ============================================================
   合成塔防 · PvE —— 战斗系统
   ============================================================ */

/* ——— 常量 ——— */
const SOLDIER_SPEED = 95;      // 像素/秒
const ATTACK_RANGES = {
  bow: 120,    // 弓兵远程
  sword: 18,   // 刀兵近战
  spear: 22,   // 枪兵中距离
  shield: 16,  // 盾兵贴脸
};
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
  // 边界夹紧，不越墙
  const fy = LAYOUT.fieldY, fh = LAYOUT.fieldH;
  if (s.side === 'player') s.y = Math.max(s.y, fy + 4);
  else s.y = Math.min(s.y, fy + fh - 4);
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
          state.enemyWallHp = Math.max(0, state.enemyWallHp - s.level * 2);
          addFx(s.x, wallY - 8, '💥', '#ff8a5a', 14);
        } else {
          state.playerWallHp = Math.max(0, state.playerWallHp - s.level * 2);
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
  const atkRange = ATTACK_RANGES[s.type] || 18;

  if (dist > atkRange) {
    // 还没到攻击距离 → 走过去
    moveToTarget(s, target);
  } else {
    // 在攻击范围内 → 攻击
    s.atkTimer -= dt_global;
    if (s.atkTimer <= 0) {
      let dmg = s.atk;
      if (target.type === COUNTER[s.type]) dmg = Math.round(dmg * COUNTER_DMG);
      s.atkTimer = s.speed;

      if (s.type === 'bow') {
        // 弓兵：射出箭矢飞行物
        state.projectiles.push({
          x: s.x, y: s.y,
          targetX: target.x, targetY: target.y,
          targetId: target.id, dmg,
          speed: 200, color: TYPES[s.type]?.color || '#ff6b4a',
          life: 1.5,
        });
      } else {
        // 近战：直接扣血
        target.hp -= dmg;
        target.hitFlash = 0.3;
        // 攻击划痕
        state.attackFx.push({
          x1: s.x, y1: s.y, x2: target.x, y2: target.y,
          life: 0.25, maxLife: 0.25,
        });
        // 伤害数字
        const midX = (s.x + target.x) / 2;
        const midY = (s.y + target.y) / 2 - 8;
        addFx(midX, midY, `-${dmg}`, THEME.accent, 13);
        if (target.hp <= 0) {
          target.alive = false;
          state.rings.push({ x: target.x, y: target.y, r: 4, life: 0.25, maxLife: 0.25, color: '#ff4a3a' });
          addFx(target.x, target.y - 6, '💀', '#ff6a4a', 12);
        }
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

  // === 箭矢飞行物更新 ===
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    p.life -= dt_global;
    if (p.life <= 0) { state.projectiles.splice(i, 1); continue; }

    // 查找目标（玩家箭找敌人，敌人箭找玩家——但目前只有玩家有弓）
    const enemies = state.enemySoldiers;
    const tgt = enemies.find(e => e.id === p.targetId && e.alive);
    if (tgt) {
      p.targetX = tgt.x; p.targetY = tgt.y;
      const pdx = tgt.x - p.x, pdy = tgt.y - p.y;
      const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
      if (pdist < 10) {
        // 命中
        tgt.hp -= p.dmg;
        tgt.hitFlash = 0.3;
        if (tgt.hp <= 0) { tgt.alive = false; state.rings.push({ x: tgt.x, y: tgt.y, r: 4, life: 0.25, maxLife: 0.25, color: '#ff4a3a' }); addFx(tgt.x, tgt.y - 6, '💀', '#ff6a4a', 12); }
        // 命中粒子
        for (let j = 0; j < 4; j++) {
          state.fx.push({
            x: tgt.x, y: tgt.y, text: '·', color: p.color,
            size: 6, life: 0.3, maxLife: 0.3,
            vx: (Math.random() - 0.5) * 50, vy: (Math.random() - 0.5) * 50,
          });
        }
        const midX = (p.x + tgt.x) / 2, midY = (p.y + tgt.y) / 2 - 8;
        addFx(midX, midY, `-${p.dmg}`, THEME.accent, 13);
        state.projectiles.splice(i, 1);
        continue;
      }
      p.x += (pdx / pdist) * p.speed * dt_global;
      p.y += (pdy / pdist) * p.speed * dt_global;
    } else {
      // 目标已死，惯性飞
      const pdx = p.targetX - p.x, pdy = p.targetY - p.y;
      const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
      if (pdist < 5) { state.projectiles.splice(i, 1); continue; }
      p.x += (pdx / pdist) * p.speed * dt_global;
      p.y += (pdy / pdist) * p.speed * dt_global;
    }
  }

  // 判定胜负
  if (state.playerWallHp <= 0) {
    state.phase = 'lost';
    onGameOver(false);
  } else if (state.enemyWallHp <= 0) {
    state.phase = 'won';
    onGameOver(true);
  }
}
