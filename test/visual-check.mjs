import { chromium } from 'playwright';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BASE = process.env.VISUAL_URL || 'http://localhost:3000';
const NO_VISION = process.argv.includes('--no-vision');
const STRICT = process.argv.includes('--strict');
const CROWD_STRESS = process.argv.includes('--crowd-stress');
const ONLY = (process.argv.find(arg => arg.startsWith('--only=')) || '').slice(7)
  .split(',').map(name => name.trim()).filter(Boolean);
const VISUAL_TIMEOUT_MS = Number(process.env.VISUAL_TIMEOUT_MS || 120000);

async function ensureLoggedIn(page) {
  // 如果登录门还在,注册一个视觉测试专用账号然后等门消失
  const gate = page.locator('#hifiLoginGate');
  if (await gate.count() === 0) return;
  await page.evaluate(() => {
    const btn = document.querySelector('#hifiLoginGate [data-g="register"]');
    if (btn) btn.click();
  });
  await page.waitForTimeout(200);
  if (await gate.count() === 0) return;
  const stamp = Date.now();
  await page.evaluate(({ email, pass }) => {
    const emailInput = document.querySelector('#gEmail');
    const passInput = document.querySelector('#gPass');
    if (emailInput) {
      emailInput.value = email;
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      emailInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (passInput) {
      passInput.value = pass;
      passInput.dispatchEvent(new Event('input', { bubbles: true }));
      passInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const btn = document.querySelector('#gGo');
    if (btn) btn.click();
  }, { email: `visual_${stamp}@test.com`, pass: 'test123456' });
  await page.waitForFunction(() => !document.getElementById('hifiLoginGate'), { timeout: 10000 }).catch(() => {});
}

function mmxDescribe(imgPath, prompt) {
  return new Promise(resolve => {
    const safePrompt = String(prompt).replace(/"/g, "'");
    const cmd = `mmx vision describe --image "${imgPath}" --prompt "${safePrompt}" --quiet --output json`;
    exec(cmd, { timeout: 120000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err) return resolve(null);
      try {
        const json = JSON.parse(stdout);
        resolve(json.content || json.reply || stdout);
      } catch (e) {
        resolve(String(stdout || '').trim() || null);
      }
    });
  });
}

async function reachable(page) {
  try {
    const response = await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 10000 });
    return response && response.ok();
  } catch (e) {
    return false;
  }
}

async function showTab(page, tab) {
  await page.evaluate(name => {
    if (typeof window.productShellShowTab === 'function') window.productShellShowTab(name);
  }, tab);
  await page.waitForTimeout(900);
}

async function startStage(page, level, waitMs = 3000) {
  await page.evaluate(lv => {
    if (typeof meta !== 'undefined') meta.highestLevel = Math.max(Number(meta.highestLevel || 1), lv);
    if (typeof state !== 'undefined') state.trainingMode = true;
    if (typeof window.productShellShowTab === 'function') window.productShellShowTab('battle');
  }, level);
  await page.waitForTimeout(700);
  const node = page.locator('.lvnode').nth(Math.max(0, level - 1));
  let started = false;
  if (await node.count()) {
    started = await node.click({ timeout: 5000 }).then(() => true).catch(() => false);
  }
  if (!started) {
    const startBtn = page.locator('#campaignStartBtn');
    if (await startBtn.count()) started = await startBtn.click({ timeout: 5000 }).then(() => true).catch(() => false);
  }
  if (!started) {
    await page.evaluate(lv => {
      if (typeof initLevel === 'function') initLevel(lv);
      if (typeof window.syncBattleShellVisibility === 'function') window.syncBattleShellVisibility();
    }, level);
  }
  await page.waitForFunction(() => typeof state !== 'undefined' && state.phase === 'playing', { timeout: 5000 }).catch(() => {});
  await page.evaluate(() => {
    if (typeof window.scheduleBattleResize === 'function') window.scheduleBattleResize();
    else if (typeof resize === 'function') resize();
  });
  await page.waitForFunction(() => {
    const canvas = document.getElementById('game');
    const rect = canvas?.getBoundingClientRect();
    return !!rect && rect.width >= 300 && rect.height >= 600;
  }, { timeout: 3000 });
  // 视觉验收必须覆盖真实交战，而不是只截一张空棋盘。
  await page.evaluate(() => {
    if (typeof summonFruitAt !== 'function' || typeof state === 'undefined') return;
    const cells = [[2, 0], [2, 2], [2, 4], [1, 1], [1, 3]];
    for (const [r, c] of cells) {
      if (state.sp > 0 && !state.playerSlots?.[r]?.[c]) summonFruitAt(r, c);
      const ball = state.playerSlots?.[r]?.[c];
      if (ball) ball.spawnTimer = Math.min(Number(ball.spawnTimer || 0), 0.25);
    }
    state.sp = Math.max(Number(state.sp || 0), 3);
  });
  await page.waitForTimeout(waitMs);
  const live = await page.evaluate(() => ({
    phase: typeof state !== 'undefined' ? state.phase : 'missing',
    level: typeof state !== 'undefined' ? state.currentLevel : null,
    shellActive: document.body.classList.contains('battle-shell-active'),
    canvas: (() => {
      const rect = document.getElementById('game')?.getBoundingClientRect();
      return rect ? { width: Math.round(rect.width), height: Math.round(rect.height) } : null;
    })(),
  }));
  if (live.phase !== 'playing' || !live.shellActive) {
    throw new Error(`stage ${level} left live battle before capture: ${JSON.stringify(live)}`);
  }
}

async function forceResult(page) {
  await page.evaluate(() => {
    if (typeof state !== 'undefined') {
      state.lastBattleReport = {
        tips: [
          '被突破路线：第2路',
          '阵容缺口：前排 / 攻城，可试西瓜卫士、橙子炮',
          '升级方向：先升前排血量和果堡，再补主力攻击。',
        ],
      };
    }
    if (typeof onGameOver === 'function') onGameOver(false);
  });
  await page.waitForTimeout(900);
}

async function createPvpRoom(page) {
  await showTab(page, 'arena');
  await page.evaluate(() => window.pvpClient && window.pvpClient.createRoom && window.pvpClient.createRoom());
  await page.waitForTimeout(1400);
}

async function assertVisiblePage(page, shotName) {
  const info = await page.evaluate(() => {
    const body = document.body;
    const rect = body.getBoundingClientRect();
    const text = (body.innerText || '').replace(/\s+/g, '');
    const visiblePanels = Array.from(document.querySelectorAll('.panel:not(.hide), canvas'))
      .filter(el => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return r.width > 20 && r.height > 20 && style.visibility !== 'hidden' && style.display !== 'none';
      }).length;
    return { width: rect.width, height: rect.height, textLength: text.length, visiblePanels };
  });
  if (info.width < 300 || info.height < 500 || info.visiblePanels < 1) {
    throw new Error(`${shotName} appears blank: ${JSON.stringify(info)}`);
  }
}

async function assertBattleGeometry(page) {
  const geometry = await page.evaluate(() => ({
    canvas: { w: W, h: H },
    enemy: { x: boardX(true), y: LAYOUT.enemyBoardY, w: BOARD_W, h: BOARD_H },
    player: { x: boardX(false), y: LAYOUT.playerBoardY, w: BOARD_W, h: BOARD_H },
    grid: { rows: ROWS, cols: COLS, cell: CELL, gap: GAP },
    walls: { enemyY: LAYOUT.enemyWallY, playerY: LAYOUT.playerWallY },
    wallBars: {
      enemy: typeof wallBarRectV5 === 'function' ? wallBarRectV5(true) : null,
      player: typeof wallBarRectV5 === 'function' ? wallBarRectV5(false) : null,
    },
    operationY: LAYOUT.operationY,
    guides: window.Battle2DGuidesV5 || null,
    commanders: {
      player: state.commander,
      enemy: state.enemyCommander,
      playerSkill: typeof commanderSkillRectV5 === 'function' ? commanderSkillRectV5(false) : null,
      enemySkill: typeof commanderSkillRectV5 === 'function' ? commanderSkillRectV5(true) : null,
      playerPortrait: typeof commanderPortraitRectV5 === 'function' ? commanderPortraitRectV5(false) : null,
      enemyPortrait: typeof commanderPortraitRectV5 === 'function' ? commanderPortraitRectV5(true) : null,
    },
  }));
  const { enemy, player, canvas, grid, walls, operationY } = geometry;
  if (grid.rows !== 3 || grid.cols !== 5) throw new Error(`battle grid must be 3x5: ${JSON.stringify(geometry)}`);
  if (enemy.w !== player.w || enemy.h !== player.h) throw new Error(`enemy/player boards differ: ${JSON.stringify(geometry)}`);
  if (enemy.x + player.x + enemy.w !== canvas.w) throw new Error(`boards are not horizontally mirrored: ${JSON.stringify(geometry)}`);
  if (!geometry.commanders.player || !geometry.commanders.enemy || !geometry.commanders.playerSkill || !geometry.commanders.enemySkill) {
    throw new Error(`commander system missing: ${JSON.stringify(geometry)}`);
  }
  const authoredFrames = { enemy:{ x:64, y:86 }, player:{ x:126, y:684 } };
  if (!geometry.guides || enemy.x !== authoredFrames.enemy.x || enemy.y !== authoredFrames.enemy.y ||
      player.x !== authoredFrames.player.x || player.y !== authoredFrames.player.y) {
    throw new Error(`boards do not match authored background frames: ${JSON.stringify(geometry)}`);
  }
  for (const key of ['playerPortrait', 'enemyPortrait']) {
    const rect = geometry.commanders[key];
    if (!rect || rect.x < 0 || rect.y < 0 || rect.x + rect.w > canvas.w || rect.y + rect.h > canvas.h) {
      throw new Error(`commander portrait is outside its authored frame: ${key} ${JSON.stringify(geometry)}`);
    }
  }
  if (enemy.y + enemy.h >= walls.enemyY || walls.playerY >= player.y || player.y + player.h >= operationY) {
    throw new Error(`battle regions overlap: ${JSON.stringify(geometry)}`);
  }
  if (!geometry.wallBars.enemy || geometry.wallBars.enemy.y < enemy.y + enemy.h + 10 ||
      !geometry.wallBars.player || geometry.wallBars.player.y + geometry.wallBars.player.h > player.y - 10) {
    throw new Error(`wall bars crowd the authored board frames: ${JSON.stringify(geometry)}`);
  }
}

async function assertSingleTroopRenderPath(page) {
  const result = await page.evaluate(() => {
    const soldier = [...(state.playerSoldiers || []), ...(state.enemySoldiers || [])].find(s => s && s.alive);
    if (!soldier) return { error: 'no live soldier available' };
    const before = window.RenderHooks?.beforeDrawSoldier;
    const after = window.RenderHooks?.afterDrawSoldier;
    const oldBeforeRun = before?.run;
    const oldAfterRun = after?.run;
    let beforeCalls = 0, afterCalls = 0;
    if (before) before.run = () => { beforeCalls++; };
    if (after) after.run = () => { afterCalls++; };
    try { drawSoldier(soldier); }
    finally {
      if (before) before.run = oldBeforeRun;
      if (after) after.run = oldAfterRun;
      draw();
    }
    return { beforeCalls, afterCalls, renderer: !!drawSoldier._battle2DV5 };
  });
  if (result.error || !result.renderer || result.beforeCalls !== 0 || result.afterCalls !== 0) {
    throw new Error(`soldier still uses legacy duplicate-render hooks: ${JSON.stringify(result)}`);
  }
}

async function freezeAtNaturalAttack(page) {
  await page.waitForFunction(() => {
    if (typeof state === 'undefined' || state.phase !== 'playing') return false;
    const alive = [...(state.playerSoldiers || []), ...(state.enemySoldiers || [])].filter(s => s && s.alive).length;
    return alive >= 5 && ((state.attackFx?.length || 0) > 0 || (state.projectiles?.length || 0) > 0);
  }, { timeout: 4500, polling: 'raf' });
  await page.evaluate(() => { window.__freezeBattleFrame = true; });
}

async function forceCrowdStress(page) {
  await page.evaluate(() => {
    const types = ['watermelon_guard','banana_raider','grape_archer','orange_cannon','pear_frost','cherry_bomber'];
    const makeSide = side => Array.from({ length:12 }, (_, i) => {
      const lane = 1 + (i % 3);
      const soldier = createSoldier(types[i % types.length], 2 + (i % 3));
      soldier.id = `visual-crowd-${side}-${i}`;
      soldier.side = side;
      soldier.laneIndex = lane;
      soldier.laneX = laneXByIndex(lane);
      soldier.x = soldier.laneX + ((i % 2) ? 3 : -3);
      soldier.y = side === 'player' ? 474 + Math.floor(i / 3) * 3 : 414 - Math.floor(i / 3) * 3;
      soldier.mode = i % 4 === 0 ? 'backline' : 'fight';
      soldier.battleReady = true;
      soldier.protected = false;
      soldier.atkTimer = soldier.speed;
      return soldier;
    });
    state.playerSoldiers = makeSide('player');
    state.enemySoldiers = makeSide('enemy');
    state.attackFx = types.map((type, i) => ({
      x1:105 + i * 48, y1:500 - (i % 2) * 26,
      x2:125 + i * 45, y2:405 + (i % 3) * 22,
      life:.32, maxLife:.32, attackerSide:i % 2 ? 'enemy' : 'player', ownerType:type,
    }));
    state.projectiles = ['grape_archer','orange_cannon','pear_frost'].map((type, i) => ({
      x:160 + i * 72, y:490 - i * 25, targetX:180 + i * 70, targetY:395 + i * 18,
      color:(TYPES[type] || {}).color, side:'player', ownerType:type,
    }));
    if (typeof draw === 'function') draw();
    window.__freezeBattleFrame = true;
  });
  for (let i = 0; i < 18; i++) {
    await page.waitForTimeout(20);
    await page.evaluate(() => { if (typeof draw === 'function') draw(); });
  }
  await page.waitForTimeout(120);
}

async function assertCrowdFormation(page) {
  const result = await page.evaluate(() => {
    if (typeof window.troopFormationTargetPosV6 !== 'function') return { error:'formation target renderer missing' };
    const units = [...state.playerSoldiers, ...state.enemySoldiers].filter(s => s && s.alive);
    const positions = units.map(s => ({ id:s.id, ...window.troopFormationTargetPosV6(s) }));
    let min = Infinity, pair = null;
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const d = Math.hypot(positions[i].x - positions[j].x, positions[i].y - positions[j].y);
        if (d < min) { min = d; pair = [positions[i], positions[j]]; }
      }
    }
    return { count:positions.length, minDistance:min, pair };
  });
  if (result.error || result.count < 20 || result.minDistance < 22) {
    throw new Error(`crowd formation still overlaps: ${JSON.stringify(result)}`);
  }
}

async function assertFormationBoundaryCases(page) {
  const result = await page.evaluate(() => {
    if (typeof window.troopFormationTargetPosV6 !== 'function') return { error:'formation target renderer missing' };
    const saved = { playerSoldiers:state.playerSoldiers, enemySoldiers:state.enemySoldiers };
    const make = (id, laneIndex, x, y) => ({
      id, type:'banana_raider', level:1, side:'player', laneIndex, laneX:x,
      x, y, hp:10, maxHp:10, alive:true, battleReady:true, protected:false,
      mode:'fight', speed:.8, atkTimer:0,
    });
    const check = units => {
      state.playerSoldiers = units;
      state.enemySoldiers = [];
      const positions = units.map(s => ({ id:s.id, ...window.troopFormationTargetPosV6(s) }));
      return { positions, distance:Math.hypot(positions[0].x - positions[1].x, positions[0].y - positions[1].y) };
    };
    let checks;
    try {
      checks = {
        depthBoundary:check([make('depth-a', 2, 230, 399), make('depth-b', 2, 230, 401)]),
        crossLane:check([make('lane-a', 1, 230, 430), make('lane-b', 2, 230, 430)]),
      };
    } finally {
      state.playerSoldiers = saved.playerSoldiers;
      state.enemySoldiers = saved.enemySoldiers;
      if (typeof draw === 'function') draw();
    }
    return checks;
  });
  if (result.error || result.depthBoundary.distance < 22 || result.crossLane.distance < 22) {
    throw new Error(`formation boundary collision returned: ${JSON.stringify(result)}`);
  }
}

async function assertFormationMotionIsSmooth(page) {
  const result = await page.evaluate(async () => {
    if (typeof window.troopFormationTargetPosV6 !== 'function' || typeof window.troopVisualFormationPosV6 !== 'function') {
      return { error:'formation motion hooks missing' };
    }
    const saved = { playerSoldiers:state.playerSoldiers, enemySoldiers:state.enemySoldiers };
    const make = id => ({
      id, type:'banana_raider', level:1, side:'player', laneIndex:2, laneX:230,
      x:230, y:430, hp:10, maxHp:10, alive:true, battleReady:true, protected:false,
      mode:'fight', speed:.8, atkTimer:0,
    });
    const units = [make('smooth-a'), make('smooth-b')];
    try {
      state.playerSoldiers = units;
      state.enemySoldiers = [];
      const first = units.map(s => window.troopVisualFormationPosV6(s));
      const target = units.map(s => window.troopFormationTargetPosV6(s));
      await new Promise(resolve => setTimeout(resolve, 70));
      const second = units.map(s => window.troopVisualFormationPosV6(s));
      const distance = pair => Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
      return { first:distance(first), second:distance(second), target:distance(target) };
    } finally {
      state.playerSoldiers = saved.playerSoldiers;
      state.enemySoldiers = saved.enemySoldiers;
      if (typeof draw === 'function') draw();
    }
  });
  if (result.error || result.first > 2 || result.second <= 6 || result.second >= result.target - 2 || result.target < 22) {
    throw new Error(`formation motion snapped instead of gliding: ${JSON.stringify(result)}`);
  }
}

async function assertAttackFxDensityCap(page) {
  const result = await page.evaluate(() => {
    const saved = state.attackFx;
    try {
      state.attackFx = Array.from({ length:24 }, (_, i) => ({
        x1:190 + (i % 4) * 5, y1:500 - (i % 3) * 4,
        x2:230, y2:430,
        life:.32, maxLife:.32, attackerSide:i % 2 ? 'enemy' : 'player', ownerType:'banana_raider',
      }));
      drawAttackFx();
      return window.BattleFxDensityStatsV6;
    } finally {
      state.attackFx = saved;
      if (typeof draw === 'function') draw();
    }
  });
  if (!result || result.total !== 24 || result.drawn > 3 || result.skipped < 20) {
    throw new Error(`attack FX density cap failed: ${JSON.stringify(result)}`);
  }
}

async function assertAttackFxContrast(page) {
  const result = await page.evaluate(() => {
    const box = { x: 70, y: LAYOUT.fieldY + 20, w: W - 140, h: LAYOUT.fieldH - 40 };
    const before = ctx.getImageData(box.x, box.y, box.w, box.h).data;
    const saved = { attackFx: state.attackFx, projectiles: state.projectiles, rings: state.rings };
    state.attackFx = Array.from({ length:6 }, (_, i) => ({
      x1:110 + i * 45, y1:540 - (i % 2) * 34, x2:145 + i * 38, y2:390 + (i % 3) * 28,
      life:.32, maxLife:.32, attackerSide:i % 2 ? 'enemy' : 'player',
    }));
    state.projectiles = Array.from({ length:4 }, (_, i) => ({
      x:150 + i * 64, y:500 - i * 18, targetX:190 + i * 52, targetY:400 + i * 12,
      color:i % 2 ? '#ff715f' : '#ffcf55', side:i % 2 ? 'enemy' : 'player',
    }));
    state.rings = Array.from({ length:4 }, (_, i) => ({
      x:190 + i * 52, y:400 + i * 12, r:13, life:.35, maxLife:.35, color:i % 2 ? '#ff715f' : '#62e7ff',
    }));
    drawProjectiles();
    drawAttackFx();
    drawRings();
    const after = ctx.getImageData(box.x, box.y, box.w, box.h).data;
    let changed = 0, strong = 0;
    for (let i = 0; i < before.length; i += 4) {
      const delta = Math.abs(after[i] - before[i]) + Math.abs(after[i + 1] - before[i + 1]) + Math.abs(after[i + 2] - before[i + 2]);
      if (delta > 18) changed++;
      if (delta > 75) strong++;
    }
    Object.assign(state, saved);
    draw();
    return { changed, strong };
  });
  if (result.changed < 900 || result.strong < 320 || result.changed > 18000) {
    throw new Error(`attack feedback lacks visible contrast: ${JSON.stringify(result)}`);
  }
}

async function assertPvpCommanderClientFlow(page) {
  const result = await page.evaluate(() => {
    if (!window.__pvpTest || !window.pvpClient?.localCommanderSkill) return { error: 'pvp commander hooks missing' };
    const savedSkill = window.pvpClient.localCommanderSkill;
    const saved = {
      mode: state.mode, phase: state.phase, commander: state.commander, enemyCommander: state.enemyCommander,
      playerSlots: state.playerSlots, enemySlots: state.enemySlots,
      playerSoldiers: state.playerSoldiers, enemySoldiers: state.enemySoldiers,
      attackFx: state.attackFx, projectiles: state.projectiles, rings: state.rings, fx: state.fx,
      playerWallHp: state.playerWallHp, playerWallMax: state.playerWallMax,
      enemyWallHp: state.enemyWallHp, enemyWallMax: state.enemyWallMax,
      sp: state.sp, enemySp: state.enemySp,
    };
    try {
      state.mode = 'pvp';
      state.phase = 'playing';
      window.__pvpTest.setSide(1);
      window.__pvpTest.applySnapshot({
        walls: { p: 700, pMax: 720, e: 680, eMax: 720 },
        sp: { p: 9, e: 13 },
        boards: { p: [[], [], []], e: [[], [], []] },
        commanders: {
          p: { id: 'juice_sage', level: 1, cd: 7, maxCd: 26, active: 0 },
          e: { id: 'berry_general', level: 1, cd: 0, maxCd: 27, active: 0 },
        },
        soldiers: [],
      });
      const mapped = { own: state.commander?.id, peer: state.enemyCommander?.id, ownSp: state.sp, peerSp: state.enemySp };
      let sent = 0;
      window.pvpClient.localCommanderSkill = () => { sent++; return true; };
      const activated = window.activateCommanderSkillV1();
      return { mapped, activated, sent, cooldown: state.commander?.cd };
    } finally {
      Object.assign(state, saved);
      window.pvpClient.localCommanderSkill = savedSkill;
      window.__pvpTest.setSide(0);
    }
  });
  if (result.error) throw new Error(result.error);
  if (result.mapped.own !== 'berry_general' || result.mapped.peer !== 'juice_sage' || result.mapped.ownSp !== 13 || result.mapped.peerSp !== 9) {
    throw new Error(`pvp commander snapshot mapping failed: ${JSON.stringify(result)}`);
  }
  if (!result.activated || result.sent !== 1 || result.cooldown <= 0) {
    throw new Error(`pvp commander activation failed: ${JSON.stringify(result)}`);
  }
}

async function assertCommanderFlow(page) {
  const before = await page.evaluate(() => ({
    id: window.shell?.commanderId || 'orchard_lord',
    berryLv: Number(window.shell?.commanderLv?.berry_general || 1),
    gold: Number(meta?.gold || 0),
  }));
  const select = page.locator('[data-commander-select="berry_general"]');
  const upgrade = page.locator('[data-commander-upgrade="berry_general"]');
  if (await select.count() !== 1 || await upgrade.count() !== 1) throw new Error('commander select/upgrade controls missing');
  await select.click();
  const selected = await page.evaluate(() => window.shell?.commanderId);
  if (selected !== 'berry_general') throw new Error(`commander select failed: ${selected}`);
  await page.evaluate(() => { meta.gold = 99999; });
  await upgrade.click();
  const upgraded = await page.evaluate(() => Number(window.shell?.commanderLv?.berry_general || 0));
  if (upgraded !== before.berryLv + 1) throw new Error(`commander upgrade failed: ${before.berryLv} -> ${upgraded}`);
  await page.evaluate(saved => {
    window.shell.commanderId = saved.id;
    window.shell.commanderLv.berry_general = saved.berryLv;
    meta.gold = saved.gold;
    if (typeof window.saveAll === 'function') window.saveAll();
    if (typeof window.productShellShowTab === 'function') window.productShellShowTab('upgrade');
  }, before);
  await page.waitForTimeout(250);
}

const SHOTS = [
  {
    name: 'home',
    file: 'shot_home.jpg',
    setup: async page => { await page.waitForTimeout(1200); },
    prompt: 'Mobile game home screen. Rate polish, readability, overlap, blank areas, and button hierarchy.',
  },
  {
    name: 'campaign',
    file: 'shot_campaign.jpg',
    setup: async page => showTab(page, 'battle'),
    prompt: 'Campaign stage selection screen. Check chapter information, stage nodes, tutorial hint readability, and button overlap.',
  },
  {
    name: 'squad',
    file: 'shot_squad.jpg',
    setup: async page => showTab(page, 'upgrade'),
    prompt: 'Squad and roster screen. Check role tags, card readability, scrolling density, and text overlap.',
  },
  {
    name: 'shop',
    file: 'shot_shop.jpg',
    setup: async page => showTab(page, 'shop'),
    prompt: 'Shop screen. Check simulated payment copy, pack cards, reward clarity, and no forced-pay impression.',
  },
  {
    name: 'battle',
    file: CROWD_STRESS ? 'shot_battle_crowd.png' : 'shot_battle.png',
    setup: async page => {
      await startStage(page, 1, 2200);
      await freezeAtNaturalAttack(page);
      if (CROWD_STRESS) await forceCrowdStress(page);
    },
    prompt: 'Live battle screen. Check player green/gold versus enemy red/purple readability, lane danger, damage noise, and crowded units.',
  },
  {
    name: 'boss',
    file: 'shot_boss.png',
    setup: async page => startStage(page, 5, 4200),
    prompt: 'Boss battle screen. Check boss outline, boss HP bar, entrance/readability, and whether it is distinct from normal enemies.',
  },
  {
    name: 'result',
    file: 'shot_result.jpg',
    setup: async page => { await startStage(page, 1, 1000); await forceResult(page); },
    prompt: 'Failure result screen. Check whether failure advice is visible, actionable, and not overlapping controls.',
  },
  {
    name: 'pvp_room',
    file: 'shot_pvp_room.jpg',
    setup: async page => createPvpRoom(page),
    prompt: 'PVP room screen. Check room code, ready button, leave button, connection status, and no overlap.',
  },
];

let browser;

async function run() {
  browser = await chromium.launch({ timeout: 30000, args: ['--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  if (process.env.VISUAL_DEBUG === '1') {
    await page.addInitScript(() => {
      const proto = CanvasRenderingContext2D.prototype;
      const save = proto.save;
      const restore = proto.restore;
      proto.save = function visualDebugSave() {
        this.__visualSaveDepth = (this.__visualSaveDepth || 0) + 1;
        this.__visualSaveMax = Math.max(this.__visualSaveMax || 0, this.__visualSaveDepth);
        return save.call(this);
      };
      proto.restore = function visualDebugRestore() {
        this.__visualSaveDepth = Math.max(0, (this.__visualSaveDepth || 0) - 1);
        return restore.call(this);
      };
    });
  }
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  if (!(await reachable(page))) {
    console.error(`Cannot reach ${BASE}. Start the game server first, or set VISUAL_URL.`);
    await browser.close();
    process.exit(2);
  }

  const results = [];
  const selectedShots = ONLY.length ? SHOTS.filter(shot => ONLY.includes(shot.name)) : SHOTS;
  for (const shot of selectedShots) {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(700);
    await ensureLoggedIn(page);
    await shot.setup(page);
    await assertVisiblePage(page, shot.name);
    if (shot.name === 'squad') await assertCommanderFlow(page);
    if (shot.name === 'battle' || shot.name === 'boss') await assertBattleGeometry(page);
    if (shot.name === 'battle') {
      await assertSingleTroopRenderPath(page);
      await assertPvpCommanderClientFlow(page);
      await assertAttackFxContrast(page);
      await assertFormationBoundaryCases(page);
      await assertFormationMotionIsSmooth(page);
      await assertAttackFxDensityCap(page);
      if (CROWD_STRESS) await assertCrowdFormation(page);
    }
    if (process.env.VISUAL_DEBUG === '1' && (shot.name === 'battle' || shot.name === 'boss')) {
      const debug = await page.evaluate(() => {
        const info = el => {
          const rect = el?.getBoundingClientRect();
          const style = el ? getComputedStyle(el) : null;
          return rect && style ? {
            className: el.className,
            display: style.display,
            zIndex: style.zIndex,
            rect: [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)],
          } : null;
        };
        return {
          phase: state?.phase,
          level: state?.currentLevel,
          body: document.body.className,
          wrap: info(document.getElementById('wrap')),
          canvas: info(document.getElementById('game')),
          hud: info(document.getElementById('battleShellHud')),
          back: info(document.querySelector('[data-battle-back]')),
          title: info(document.querySelector('.battle-title')),
          context: (() => {
            const context = document.getElementById('game')?.getContext('2d');
            const matrix = context?.getTransform();
            return context && matrix ? {
              alpha: context.globalAlpha,
              depth: context.__visualSaveDepth,
              maxDepth: context.__visualSaveMax,
              matrix: [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f],
            } : null;
          })(),
        };
      });
      console.log(`[visual-debug:${shot.name}] ${JSON.stringify(debug)}`);
    }
    const abs = path.join(ROOT, shot.file);
    const canvasShot = shot.name === 'battle' || shot.name === 'boss';
    if (canvasShot) {
      await page.evaluate(() => {
        // Cancel pending retry tickets, rebuild the backing store and let the
        // stable frame settle before reading its pixels.
        if (typeof _battleResizeRetry !== 'undefined') _battleResizeRetry++;
        window.__freezeBattleFrame = false;
        if (typeof resize === 'function') resize();
        if (typeof draw === 'function') {
          draw();
          draw();
        }
        window.__freezeBattleFrame = true;
      });
      await page.waitForTimeout(120);
      const dataUrl = await page.evaluate(() => document.getElementById('game').toDataURL('image/png'));
      fs.writeFileSync(abs, Buffer.from(dataUrl.split(',')[1], 'base64'));
    } else {
      await page.screenshot({ path: abs, type: 'jpeg', quality: 88, timeout: 20000 });
    }
    const vision = NO_VISION ? null : await mmxDescribe(abs, shot.prompt);
    results.push({ name: shot.name, file: shot.file, vision });
    console.log(`\n===== [${shot.name}] ${shot.file} =====`);
    console.log(vision || (NO_VISION ? '(vision skipped)' : '(vision unavailable; screenshot saved)'));
  }

  await browser.close();
  browser = null;
  const errorSummary = errors.length ? errors.slice(0, 8).join(' | ') : 'none';
  console.log(`\n--- done: ${results.map(r => r.file).join(', ')} | console errors: ${errorSummary} ---`);
  if (STRICT && errors.length) process.exit(3);
}

Promise.race([
  run(),
  new Promise((_, reject) => setTimeout(() => reject(new Error(`visual-check timed out after ${VISUAL_TIMEOUT_MS}ms`)), VISUAL_TIMEOUT_MS)),
]).catch(err => {
  console.error(err);
  process.exitCode = 1;
}).finally(async () => {
  try { if (browser) await browser.close(); } catch (e) {}
  process.exit(process.exitCode || 0);
});
