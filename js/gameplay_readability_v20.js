/* ============================================================
   水果突击 · Gameplay Readability v20
   1) 三段局内节奏提示；2) 出兵冷却前端感知；3) 编队下阵彻底修复；
   4) 编队卡显示T级、Lv1~7攻防成长、技能解锁/强化信息。
   Loaded after combat_pacing_v19.js.
   ============================================================ */

(function installGameplayReadabilityV20() {
  patchDeckCoreNoAutoFillV20();
  patchDeckPanelInfoV20();
  patchSpawnCooldownVisualV20();
  patchBattlePhaseHudV20();
})();

const GAMEPLAY_READABILITY_BUILD = 'gameplay-readability-v20';

/* ------------------------------------------------------------
   A. 彻底修复编队：允许少于5个上阵，不再被 normalize/sync 自动补满
   ------------------------------------------------------------ */
function unlockedListV20() {
  const highest = Math.max(1, meta?.highestLevel || 1);
  const list = BASIC_UNLOCKED.slice();
  for (const item of PROGRESS_UNLOCKS) {
    if (highest >= item.level) for (const id of item.ids) if (!list.includes(id)) list.push(id);
  }
  return list.filter(id => TYPES[id]);
}
function sanitizeDeckLooseV20(deck, allowEmpty = false) {
  const unlocked = unlockedListV20();
  const result = [];
  for (const raw of (deck || [])) {
    const id = normalizeTypeId(raw);
    if (TYPES[id] && unlocked.includes(id) && !result.includes(id)) result.push(id);
  }
  if (!allowEmpty && result.length === 0) result.push(DEFAULT_DECK[0]);
  return result.slice(0, DECK_SIZE);
}
function patchDeckCoreNoAutoFillV20() {
  normalizeDeck = function normalizeDeckLooseV20(deck) {
    return sanitizeDeckLooseV20(deck, false);
  };
  activeDeck = function activeDeckLooseV20() {
    return sanitizeDeckLooseV20(meta?.deck || DEFAULT_DECK, false);
  };
  syncProgressUnlocks = function syncProgressUnlocksLooseV20(m = null) {
    const list = unlockedListV20();
    if (!m) return list;
    m.unlocked = list.slice();
    m.deck = sanitizeDeckLooseV20(m.deck || DEFAULT_DECK, false);
    return list;
  };
}

/* ------------------------------------------------------------
   B. 编队信息重做：T级、Lv1~7攻防、技能信息直观
   ------------------------------------------------------------ */
const FRUIT_TIER_V20 = {
  watermelon_guard:'T1', grape_archer:'T1', banana_raider:'T1', pineapple_lancer:'T1', orange_cannon:'T1',
  coconut_guard:'T2', peach_medic:'T2', pear_frost:'T2', blueberry_sniper:'T2', lemon_assassin:'T2', pumpkin_roller:'T2',
  kiwi_wildcard:'T3', passion_copy:'T3'
};
const SKILL_INFO_V20 = {
  watermelon_guard: { name:'果盾壁垒', unlock:'Lv4护盾', grow:'Lv6克突击 / Lv7友方小盾' },
  grape_archer: { name:'葡萄连射', unlock:'Lv4连射', grow:'Lv6克突击 / Lv7散射' },
  banana_raider: { name:'香蕉突进', unlock:'Lv4突进', grow:'Lv6切后排 / Lv7击杀再突' },
  pineapple_lancer: { name:'拒马枪阵', unlock:'Lv4击退突击', grow:'Lv6反伤 / Lv7同路防冲锋' },
  orange_cannon: { name:'重炮破城', unlock:'Lv4爆破墙', grow:'Lv6破甲 / Lv7大重炮' },
  coconut_guard: { name:'椰壳堡垒', unlock:'Lv4厚护盾', grow:'抗爆发，后续接入' },
  peach_medic: { name:'蜜桃急救', unlock:'Lv4治疗', grow:'保前排，后续接入' },
  pear_frost: { name:'冰霜凝滞', unlock:'Lv4冰霜弹', grow:'克突击，后续接入' },
  blueberry_sniper: { name:'鹰眼狙击', unlock:'Lv4点杀', grow:'切后排，后续接入' },
  lemon_assassin: { name:'酸影背刺', unlock:'Lv4背刺', grow:'克辅助，后续接入' },
  pumpkin_roller: { name:'南瓜滚轰', unlock:'Lv4死亡滚轰', grow:'破阵攻城，后续接入' },
  kiwi_wildcard: { name:'万能嫁接', unlock:'合成辅助', grow:'帮助做出克制高星' },
  passion_copy: { name:'百香复制', unlock:'复制辅助', grow:'复制核心克制单位' },
};
function roleLabelV20(role) {
  return ({ tank:'前排', back:'远程', rush:'突击', front:'枪线', siege:'攻城', control:'控制', support:'辅助', merge:'合成' })[role] || role;
}
function skillStateLabelV20(id) {
  const implemented = ['watermelon_guard','grape_archer','banana_raider','pineapple_lancer','orange_cannon'].includes(id);
  return implemented ? '已实装' : '待接入';
}
function statPreviewV20(t) {
  const atk1 = Math.round(t.atk * LEVEL_MUL[1]);
  const hp1 = Math.round(t.hp * LEVEL_MUL[1]);
  const atk7 = Math.round(t.atk * LEVEL_MUL[7]);
  const hp7 = Math.round(t.hp * LEVEL_MUL[7]);
  return { atk1, hp1, atk7, hp7 };
}
function levelPathV20(id) {
  const implemented = ['watermelon_guard','grape_archer','banana_raider','pineapple_lancer','orange_cannon'].includes(id);
  const skill = SKILL_INFO_V20[id];
  return `
    <div class="lvpath-v20">
      <span>1 数值</span><span>2 数值</span><span>3 体型</span>
      <span class="skill ${implemented ? 'on' : ''}">4 ${skill?.name ? '技能' : '成长'}</span>
      <span>5 强化</span><span>6 克制</span><span>7 质变</span>
    </div>`;
}
function deckCardHtmlV20(id, on, locked, full) {
  const t = TYPES[id];
  const s = statPreviewV20(t);
  const skill = SKILL_INFO_V20[id] || { name:'基础成长', unlock:'Lv4成长', grow:'Lv5~7强化' };
  const tier = FRUIT_TIER_V20[id] || 'T1';
  const lockedText = locked ? `第${unlockLevelFor(id)}关解锁` : '';
  return `
    ${on ? '<span class="tag">已上阵</span>' : locked ? `<span class="tag locktag">${lockedText}</span>` : full ? '<span class="tag offtag">先下阵</span>' : ''}
    <div class="deck-head-v20">
      <div class="tier-v20">${tier}</div>
      <div class="icon">${t.icon}</div>
      <div class="deck-title-v20"><div class="name">${t.name}</div><div class="role">${roleLabelV20(t.role)} · ${t.rarity} · ${skillStateLabelV20(id)}</div></div>
    </div>
    <div class="statgrid-v20">
      <span>攻 ${s.atk1}→${s.atk7}</span><span>防 ${s.hp1}→${s.hp7}</span><span>冷却 ${(SPAWN_COOLDOWNS[1]).toFixed(1)}→${(SPAWN_COOLDOWNS[7]).toFixed(1)}s</span>
    </div>
    ${levelPathV20(id)}
    <div class="skillbox-v20"><b>${skill.name}</b><span>${skill.unlock}</span><em>${skill.grow}</em></div>
    <div class="desc">${t.desc}</div>`;
}
function patchDeckPanelInfoV20() {
  const style = document.createElement('style');
  style.textContent = `
  .deck-card{padding:9px!important}.deck-head-v20{display:flex;align-items:center;gap:8px}.tier-v20{min-width:28px;height:22px;border-radius:8px;background:#263b19;color:#fff7b0;font-weight:900;font-size:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 0 rgba(0,0,0,.16)}.deck-title-v20{flex:1;text-align:left}.statgrid-v20{display:grid;grid-template-columns:1fr 1fr 1.25fr;gap:4px;margin:6px 0;font-size:10px;color:#31551f}.statgrid-v20 span{background:rgba(255,255,255,.58);border:1px solid rgba(90,130,54,.18);border-radius:7px;padding:3px 4px}.lvpath-v20{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin:6px 0}.lvpath-v20 span{font-size:8px;background:#e8f6c2;color:#5a7831;border-radius:5px;padding:2px 1px;text-align:center}.lvpath-v20 .skill{background:#d6dfb6}.lvpath-v20 .skill.on{background:#ffe37a;color:#684200;font-weight:900}.skillbox-v20{display:flex;flex-direction:column;gap:2px;text-align:left;background:rgba(255,244,184,.72);border:1px solid rgba(255,192,58,.35);border-radius:9px;padding:5px 7px;margin:5px 0}.skillbox-v20 b{font-size:11px;color:#4b3b13}.skillbox-v20 span{font-size:10px;color:#74551c}.skillbox-v20 em{font-style:normal;font-size:9px;color:#8c6b24}.deck-chip.removeable{position:relative;cursor:pointer}.deck-chip.removeable:after{content:'×';position:absolute;right:4px;top:2px;background:#ff6078;color:white;width:15px;height:15px;border-radius:50%;font-size:11px;line-height:15px}.deck-empty{opacity:.68}.deck-card.fullhint{opacity:.70}.deck-card .offtag{background:#9ab678;color:#fff}`;
  document.head.appendChild(style);

  renderDeckPanel = function renderDeckPanelReadableV20() {
    const unlocked = unlockedListV20();
    meta.deck = sanitizeDeckLooseV20(meta.deck || DEFAULT_DECK, true);

    const selected = document.getElementById('deckSelected');
    if (selected) {
      selected.innerHTML = '';
      for (let i = 0; i < DECK_SIZE; i++) {
        const id = meta.deck[i];
        const t = TYPES[id];
        const chip = document.createElement('div');
        chip.className = 'deck-chip' + (!t ? ' deck-empty' : ' removeable');
        chip.innerHTML = t ? `<b>${t.icon}</b>${t.name}` : `<b>+</b>空位`;
        if (t) chip.addEventListener('click', () => {
          meta.deck = meta.deck.filter(x => x !== id);
          saveMeta();
          renderDeckPanel();
          refreshDeckPreview();
        });
        selected.appendChild(chip);
      }
    }

    const list = document.getElementById('deckList');
    if (!list) return;
    list.innerHTML = '';
    for (const id of UNIT_POOL) {
      const on = meta.deck.includes(id);
      const locked = !unlocked.includes(id);
      const full = meta.deck.length >= DECK_SIZE && !on;
      const card = document.createElement('div');
      card.className = 'deck-card' + (on ? ' on' : '') + (locked ? ' locked disabled' : '') + (full ? ' fullhint disabled' : '');
      card.innerHTML = deckCardHtmlV20(id, on, locked, full);
      card.addEventListener('click', () => {
        if (locked) return;
        if (on) meta.deck = meta.deck.filter(x => x !== id);
        else if (meta.deck.length < DECK_SIZE) meta.deck.push(id);
        else { addFx(W / 2, LAYOUT.playerBoardY - 18, '先点上方阵容下阵一个水果', THEME.gold, 13); return; }
        meta.deck = sanitizeDeckLooseV20(meta.deck, true);
        saveMeta();
        renderDeckPanel();
        refreshDeckPreview();
      });
      list.appendChild(card);
    }
  };

  refreshDeckPreview = function refreshDeckPreviewReadableV20() {
    meta.deck = sanitizeDeckLooseV20(meta.deck || DEFAULT_DECK, false);
    saveMeta();
    const el = document.getElementById('menuDeck');
    if (el) el.innerHTML = meta.deck.map(id => `<span title="${TYPES[id].name}">${TYPES[id].icon}</span>`).join('');
    const stageEl = document.getElementById('menuStage');
    if (stageEl) stageEl.textContent = meta.highestLevel || 1;
  };
}

/* ------------------------------------------------------------
   C. 出兵冷却前端感知：棋盘上每个水果营有进度弧、进度条、剩余秒数
   ------------------------------------------------------------ */
function ballSpawnProgressV20(ball) {
  if (!ball) return 0;
  const full = SPAWN_COOLDOWNS[ball.level || 1] || SPAWN_COOLDOWNS[1];
  return 1 - clamp01((ball.spawnTimer || 0) / full);
}
function drawOneCooldownV20(ball, r, c, isEnemy) {
  if (!ball) return;
  const rect = slotRect(r, c, isEnemy);
  const center = slotCenter(r, c, isEnemy);
  const progress = ballSpawnProgressV20(ball);
  const color = TYPES[ball.type]?.color || THEME.gold;
  const remain = Math.max(0, ball.spawnTimer || 0);

  ctx.save();
  ctx.globalAlpha = isEnemy ? 0.42 : 0.88;
  ctx.strokeStyle = color;
  ctx.lineWidth = isEnemy ? 2 : 3;
  ctx.beginPath();
  ctx.arc(center.x, center.y, CELL * 0.43, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
  ctx.stroke();

  ctx.globalAlpha = isEnemy ? 0.35 : 0.82;
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  roundRect(rect.x + 7, rect.y + CELL - 10, CELL - 14, 5, 3);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(rect.x + 7, rect.y + CELL - 10, Math.max(3, (CELL - 14) * progress), 5, 3);
  ctx.fill();

  if (!isEnemy && remain > 0.25) {
    ctx.font = '900 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,.62)';
    ctx.strokeText(`${remain.toFixed(1)}s`, center.x, rect.y + CELL - 17);
    ctx.fillStyle = '#fffde0';
    ctx.fillText(`${remain.toFixed(1)}s`, center.x, rect.y + CELL - 17);
  }
  if (!isEnemy && progress >= 0.96) {
    ctx.globalAlpha = 0.50 + Math.sin(performance.now() / 90) * 0.22;
    ctx.strokeStyle = '#fff176';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(center.x, center.y, CELL * 0.50, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
function patchSpawnCooldownVisualV20() {
  if (typeof draw !== 'function' || draw._cooldownV20) return;
  const oldDraw = draw;
  draw = function drawCooldownV20() {
    oldDraw();
    if (!state || state.phase !== 'playing') return;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) drawOneCooldownV20(state.enemySlots?.[r]?.[c], r, c, true);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) drawOneCooldownV20(state.playerSlots?.[r]?.[c], r, c, false);
  };
  draw._cooldownV20 = true;
}

/* ------------------------------------------------------------
   D. 三段局内节奏：合成期/交战期/破墙期/反扑期，给玩家明确看战场窗口
   ------------------------------------------------------------ */
function combatantsBySideV20(side) {
  const arr = side === 'enemy' ? state.enemySoldiers : state.playerSoldiers;
  return (arr || []).filter(s => s && s.alive && typeof isCombatant === 'function' && isCombatant(s));
}
function battlePhaseV20() {
  if ((state._enemyReinforcePause || 0) > 0 && combatantsBySideV20('enemy').length === 0) return { key:'wall', label:'破墙期', hint:'看战场，集中拆果堡' };
  const e = combatantsBySideV20('enemy').length;
  const p = combatantsBySideV20('player').length;
  if (e > 0 && p > 0) return { key:'fight', label:'交战期', hint:'观察克制和站位' };
  if (e > 0 && p === 0) return { key:'danger', label:'反扑期', hint:'补前排或急派救线' };
  return { key:'prep', label:'合成期', hint:'整理棋盘，等下一波' };
}
function phaseColorsV20(key) {
  return ({ prep:['#4db6ff','#dff4ff'], fight:['#ffb547','#fff1c2'], wall:['#53e77b','#e3ffd8'], danger:['#ff5d6c','#ffe0e5'] })[key] || ['#ffc93c','#fff4c0'];
}
function patchBattlePhaseHudV20() {
  if (typeof draw !== 'function' || draw._phaseV20) return;
  const oldDraw = draw;
  draw = function drawPhaseHudV20() {
    oldDraw();
    if (!state || state.phase !== 'playing') return;
    const ph = battlePhaseV20();
    const [main, bg] = phaseColorsV20(ph.key);
    const x = 156, y = LAYOUT.fieldY + 6, w = 168, h = 23;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = 'rgba(24,34,20,0.68)';
    roundRect(x - 5, y - 3, w + 10, h + 6, 13);
    ctx.fill();
    ctx.fillStyle = bg;
    roundRect(x, y, w, h, 11);
    ctx.fill();
    ctx.strokeStyle = main;
    ctx.lineWidth = 2;
    roundRect(x, y, w, h, 11);
    ctx.stroke();
    ctx.font = '900 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#23471f';
    ctx.fillText(`${ph.label} · ${ph.hint}`, x + w / 2, y + h / 2);
    ctx.restore();
  };
  draw._phaseV20 = true;
}
