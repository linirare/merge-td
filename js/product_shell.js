/* ============================================================
   水果突击 · Product Shell v53
   产品闭环：关卡选择 / 底部导航 / 商城抽卡 / 碎片初始等级 / 天梯。
   只做 DOM 产品层和成长系统，不覆盖 Canvas 战场视觉。
   ============================================================ */
(function installProductShellV53() {
  const SHELL_KEY = 'merge_td_product_shell_v1';
  const DAILY_GOLD = 50;
  const DAILY_GEMS = 5;
  const GACHA_COST_1 = 5;
  const GACHA_COST_10 = 45;
  const INIT_MAX = 4;
  const INIT_COST = { 1: 3, 2: 10, 3: 25 };

  const tabs = [
    { id: 'battle', icon: '⚔️', label: '战斗' },
    { id: 'upgrade', icon: '🍉', label: '养成' },
    { id: 'shop', icon: '🛒', label: '商城' },
    { id: 'ladder', icon: '🏆', label: '天梯' },
  ];

  let shell = loadShell();
  let activeTab = 'battle';
  let prevPhase = '';

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function loadShell() {
    const base = { gems: 0, fragments: {}, fruitLv: {}, ladderBest: 0, lastDaily: '' };
    try {
      const raw = localStorage.getItem(SHELL_KEY);
      if (raw) return Object.assign(base, JSON.parse(raw));
    } catch (e) {}
    return base;
  }

  function saveShell() {
    try { localStorage.setItem(SHELL_KEY, JSON.stringify(shell)); } catch (e) {}
  }

  function ensureShellData() {
    shell.gems = Number(shell.gems || 0);
    shell.fragments = shell.fragments || {};
    shell.fruitLv = shell.fruitLv || {};
    for (const id of UNIT_POOL) {
      if (!shell.fragments[id]) shell.fragments[id] = 0;
      if (!shell.fruitLv[id]) shell.fruitLv[id] = 1;
    }
    saveShell();
  }

  function saveAll() {
    saveShell();
    if (typeof saveMeta === 'function') saveMeta();
  }

  function initLv(id) {
    id = normalizeTypeId(id);
    return Math.max(1, Math.min(INIT_MAX, Number(shell.fruitLv?.[id] || 1)));
  }

  function initUpgradeCost(id) {
    const lv = initLv(id);
    return lv >= INIT_MAX ? Infinity : INIT_COST[lv] || Infinity;
  }

  function applyInitLevel(id, level) {
    return Math.max(level || 1, initLv(id));
  }

  function isUnlocked(id) {
    return Array.isArray(meta.unlocked) && meta.unlocked.includes(id);
  }

  function injectStyle() {
    if (document.getElementById('productShellStyle')) return;
    const st = document.createElement('style');
    st.id = 'productShellStyle';
    st.textContent = `
      #bottomNav{position:fixed;left:50%;bottom:max(10px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(440px,calc(100vw - 22px));height:58px;z-index:40;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:6px;border-radius:18px;background:rgba(255,255,255,.82);backdrop-filter:blur(8px);box-shadow:0 10px 28px rgba(50,120,40,.22);border:1px solid rgba(111,207,112,.30)}
      #bottomNav.shell-hidden{display:none}
      .bnav-tab{border:0;border-radius:14px;background:rgba(236,255,222,.68);color:#5b7c37;font-weight:900;font-size:11px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;cursor:pointer;box-shadow:inset 0 -2px 0 rgba(69,160,74,.10)}
      .bnav-tab.active{background:linear-gradient(180deg,#fff3a8,#9bea8d);color:#315c25;box-shadow:0 4px 12px rgba(90,190,80,.24),inset 0 -2px 0 rgba(47,143,55,.22)}
      .bnav-icon{font-size:18px;line-height:18px}
      .stage-grid{width:100%;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0 8px;max-height:236px;overflow:auto;padding:2px 2px 4px}
      .stage-card{border:1px solid rgba(92,180,82,.22);background:rgba(255,255,255,.56);border-radius:14px;min-height:58px;color:#416329;font-weight:900;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;box-shadow:inset 0 -2px 0 rgba(87,166,72,.12)}
      .stage-card small{font-size:10px;color:#83a061;font-weight:800}.stage-card.current{border-color:#ffcf52;background:linear-gradient(180deg,#fff6be,#e9ffc7)}.stage-card.locked{opacity:.42;filter:grayscale(.35);cursor:not-allowed}.stage-card.boss{border-color:rgba(255,92,108,.42)}
      .shell-row{display:flex;align-items:center;justify-content:space-between;gap:8px;background:rgba(255,255,255,.52);border:1px solid rgba(92,180,82,.18);border-radius:14px;padding:10px 12px;margin:8px 0;color:#416329}.shell-row b{color:#2f5f26}.shell-row small{display:block;color:#82a060;font-size:11px;margin-top:2px}.shell-btn{border:0;border-radius:12px;background:#53c96a;color:#fff;font-weight:900;padding:8px 12px;cursor:pointer;white-space:nowrap}.shell-btn:disabled,.shell-row.disabled{opacity:.46;cursor:not-allowed}.shop-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0}.shop-tabs button{border:0;border-radius:12px;padding:9px 0;font-weight:900;background:rgba(255,255,255,.62);color:#6e8c4e}.shop-tabs button.active{background:linear-gradient(180deg,#fff0a3,#96e98b);color:#315c25}.shell-currency{display:flex;gap:8px;justify-content:center;margin:6px 0 8px}.shell-chip{border-radius:999px;background:rgba(255,255,255,.62);padding:5px 10px;color:#416329;font-weight:900}.ladder-hero{text-align:center;background:linear-gradient(180deg,rgba(255,246,190,.82),rgba(224,255,194,.78));border:1px solid rgba(92,180,82,.22);border-radius:18px;padding:14px 12px;margin:10px 0;color:#416329}.ladder-hero b{font-size:28px;color:#e89518}.gacha-overlay{position:fixed;inset:0;background:rgba(38,62,25,.58);z-index:120;display:flex;align-items:center;justify-content:center}.gacha-box{width:min(390px,90vw);max-height:78vh;overflow:auto;background:linear-gradient(180deg,#fffbe4,#eaffc3);border-radius:22px;padding:18px;box-shadow:0 18px 45px rgba(32,70,25,.28);text-align:center}.gacha-result{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.68);border-radius:14px;padding:9px 10px;margin:7px 0;text-align:left}.gacha-result .ico{font-size:28px}.gacha-result .frag{margin-left:auto;font-weight:900}.lab-list{max-height:58vh;overflow:auto;padding-right:2px}.lab-row{align-items:flex-start}.lab-main{display:flex;gap:8px;align-items:flex-start}.lab-icon{font-size:30px;line-height:32px}.lab-actions{display:flex;flex-direction:column;gap:6px;align-items:flex-end}.deck-badge{font-size:10px;border-radius:999px;padding:2px 6px;background:rgba(255,207,82,.36);color:#8a5a09;font-weight:900}.locked-note{color:#a08060!important}`;
    document.head.appendChild(st);
  }

  function fixedStage(k) {
    const boss = k % 5 === 0;
    const enemyLv = Number((1 + (k - 1) * 0.18 + (boss ? 0.20 : 0)).toFixed(2));
    const wallBase = boss ? 96 : 58;
    const wallGrow = boss ? 1.125 : 1.088;
    return {
      id: k,
      isBoss: boss,
      enemyInitLevel: enemyLv,
      enemyWallHp: Math.round(wallBase * Math.pow(wallGrow, k - 1)),
      enemySpawnInterval: Math.max(4.15, 6.05 - k * 0.12),
      reward: stageReward(k) + (boss ? 28 : 0),
      desc: boss ? `第 ${k} 关 · 腐坏果堡Boss · 星级奖励更高` : `第 ${k} 关 · 腐坏水果 Lv${enemyLv.toFixed(1)} · 推倒果堡`,
    };
  }

  function installSystemHooks() {
    if (typeof generateLevel === 'function' && !generateLevel._shellStagesV53) {
      const oldGenerate = generateLevel;
      generateLevel = function generateLevelV53(k) {
        if (k >= 1 && k <= 20) return fixedStage(k);
        return oldGenerate(k);
      };
      generateLevel._shellStagesV53 = true;
    }

    if (typeof createBall === 'function' && !createBall._shellInitLvV53) {
      const oldCreateBall = createBall;
      createBall = function createBallWithInitialLevel(typeId, level = 1) {
        const finalLevel = state && state._shellCreatingPlayerBall ? applyInitLevel(typeId, level) : level;
        return oldCreateBall(typeId, finalLevel);
      };
      createBall._shellInitLvV53 = true;
    }

    if (typeof initPlayerOpening === 'function' && !initPlayerOpening._shellInitLvV53) {
      const oldInitPlayerOpening = initPlayerOpening;
      initPlayerOpening = function initPlayerOpeningV53(k) {
        state._shellCreatingPlayerBall = true;
        try { return oldInitPlayerOpening(k); }
        finally { state._shellCreatingPlayerBall = false; }
      };
      initPlayerOpening._shellInitLvV53 = true;
    }

    if (typeof summonFruitAt === 'function' && !summonFruitAt._shellInitLvV53) {
      const oldSummon = summonFruitAt;
      summonFruitAt = function summonFruitAtV53(r, c) {
        state._shellCreatingPlayerBall = true;
        try { return oldSummon(r, c); }
        finally { state._shellCreatingPlayerBall = false; }
      };
      summonFruitAt._shellInitLvV53 = true;
    }

    if (typeof autoSpawnBall === 'function' && !autoSpawnBall._shellInitLvV53) {
      const oldAutoSpawn = autoSpawnBall;
      autoSpawnBall = function autoSpawnBallV53(slots, level = 1, enemy = false) {
        if (!enemy && slots === state.playerSlots) {
          state._shellCreatingPlayerBall = true;
          try { return oldAutoSpawn(slots, level, enemy); }
          finally { state._shellCreatingPlayerBall = false; }
        }
        return oldAutoSpawn(slots, level, enemy);
      };
      autoSpawnBall._shellInitLvV53 = true;
    }
  }

  function ensureStageGrid() {
    if (document.getElementById('stageGrid')) return document.getElementById('stageGrid');
    const start = document.getElementById('btnStart');
    const grid = document.createElement('div');
    grid.id = 'stageGrid';
    grid.className = 'stage-grid hide';
    if (start && start.parentNode) start.parentNode.insertBefore(grid, start.nextSibling);
    return grid;
  }

  function ensureBottomNav() {
    if (document.getElementById('bottomNav')) return;
    const nav = document.createElement('div');
    nav.id = 'bottomNav';
    nav.className = 'shell-hidden';
    nav.innerHTML = tabs.map(t => `<button class="bnav-tab" data-tab="${t.id}"><span class="bnav-icon">${t.icon}</span><span>${t.label}</span></button>`).join('');
    document.body.appendChild(nav);
    nav.querySelectorAll('.bnav-tab').forEach(btn => btn.addEventListener('click', () => showTab(btn.dataset.tab)));
  }

  function panelHtml(id, innerClass, html) {
    if (document.getElementById(id)) return;
    const p = document.createElement('div');
    p.id = id;
    p.className = 'panel hide';
    p.innerHTML = `<div class="panel-inner ${innerClass || ''}">${html}</div>`;
    document.body.appendChild(p);
  }

  function ensureShopPanel() {
    panelHtml('shopPanel', 'wide', `
      <h2>🛒 果园商城</h2>
      <p class="sub">每日补给 · 碎片抽卡 · 成长礼包</p>
      <div class="shell-currency"><span class="shell-chip">💎 <b id="shellGems">0</b></span><span class="shell-chip">🍋 <b id="shellGold">0</b></span></div>
      <div class="shop-tabs"><button id="shopTabGacha" class="active">🎴 抽卡</button><button id="shopTabPack">🎁 礼包</button></div>
      <div id="shopList"></div>
    `);
    document.getElementById('shopTabGacha')?.addEventListener('click', () => renderShop('gacha'));
    document.getElementById('shopTabPack')?.addEventListener('click', () => renderShop('pack'));
  }

  function ensureLabPanel() {
    panelHtml('shellLabPanel', 'wide', `
      <h2>🍉 水果实验室</h2>
      <p class="sub">抽卡碎片提升初始等级；召唤时直接以更高等级入场。</p>
      <div class="shell-currency"><span class="shell-chip">上阵 <b id="labDeckCount">0/5</b></span><span class="shell-chip">💎 <b id="labGems">0</b></span></div>
      <div id="shellLabList" class="lab-list"></div>
    `);
  }

  function ensureLadderPanel() {
    panelHtml('ladderPanel', '', `
      <h2>🏆 无尽天梯</h2>
      <p class="sub">连续波次挑战 · 失败后按坚持波数结算</p>
      <div class="ladder-hero"><span>历史最佳</span><br><b id="ladderBest">0</b><br><small>波</small></div>
      <div class="shell-row"><div><b>规则</b><small>每通过一波，下一波敌方等级和果堡耐久提升。</small></div></div>
      <button id="btnLadderStart" class="btn-primary">开始天梯挑战</button>
    `);
    document.getElementById('btnLadderStart')?.addEventListener('click', startLadder);
  }

  function hidePanels() {
    ['menuPanel', 'upgradePanel', 'shopPanel', 'ladderPanel', 'resultPanel', 'overflowPopup', 'helpPanel', 'simPanel', 'fruitLabPanel', 'shellLabPanel'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hide');
    });
  }

  function updateNav() {
    document.querySelectorAll('.bnav-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === activeTab));
  }

  function showTab(tab) {
    activeTab = tab || 'battle';
    hidePanels();
    if (activeTab === 'battle') {
      document.getElementById('menuPanel')?.classList.remove('hide');
      renderStages(false);
      refreshAllShellNumbers();
    } else if (activeTab === 'upgrade') {
      document.getElementById('shellLabPanel')?.classList.remove('hide');
      renderLab();
    } else if (activeTab === 'shop') {
      document.getElementById('shopPanel')?.classList.remove('hide');
      renderShop('gacha');
    } else if (activeTab === 'ladder') {
      document.getElementById('ladderPanel')?.classList.remove('hide');
      renderLadder();
    }
    updateNav();
  }

  function syncNavVisibility() {
    const nav = document.getElementById('bottomNav');
    if (!nav) return;
    const show = state.phase === 'menu';
    nav.classList.toggle('shell-hidden', !show);
    if (show && prevPhase && prevPhase !== 'menu') showTab('battle');
    prevPhase = state.phase;
  }

  function replaceStartButton() {
    const old = document.getElementById('btnStart');
    if (!old || old._shellReplaced) return;
    const btn = old.cloneNode(true);
    btn.id = 'btnStart';
    btn.textContent = '选择关卡';
    btn._shellReplaced = true;
    old.parentNode.replaceChild(btn, old);
    btn.addEventListener('click', () => {
      const grid = ensureStageGrid();
      const isHidden = grid.classList.contains('hide');
      renderStages(isHidden);
      btn.textContent = isHidden ? '收起关卡' : '选择关卡';
    });
  }

  function renderStages(expand) {
    const grid = ensureStageGrid();
    if (!grid) return;
    if (!expand) { grid.classList.add('hide'); return; }
    grid.classList.remove('hide');
    const highest = Math.max(1, meta.highestLevel || 1);
    const maxShow = Math.max(20, highest + 3);
    grid.innerHTML = '';
    for (let lv = 1; lv <= maxShow; lv++) {
      const open = lv <= highest;
      const boss = lv % 5 === 0;
      const stars = meta.stars?.[lv] || 0;
      const card = document.createElement('button');
      card.className = 'stage-card' + (lv === highest ? ' current' : '') + (boss ? ' boss' : '') + (open ? '' : ' locked');
      card.innerHTML = `<span>${boss ? '🏰' : '🍓'} 第${lv}关</span><small>${open ? ('⭐'.repeat(stars) + '☆'.repeat(3 - stars)) : '未解锁'}</small>`;
      if (open) card.addEventListener('click', () => startCampaign(lv));
      grid.appendChild(card);
    }
  }

  function startCampaign(level) {
    meta.deck = typeof normalizeDeck === 'function' ? normalizeDeck(meta.deck) : meta.deck;
    if (typeof saveMeta === 'function') saveMeta();
    hidePanels();
    state.endless = false;
    state.endlessWave = 0;
    if (typeof initLevel === 'function') initLevel(level);
    syncNavVisibility();
  }

  function refreshAllShellNumbers() {
    if (typeof refreshGold === 'function') refreshGold();
    const gold = meta.gold || 0;
    const gems = shell.gems || 0;
    ['shellGold'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = gold; });
    ['shellGems','labGems'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = gems; });
  }

  function shopRow(name, desc, action, enabled, onClick) {
    const row = document.createElement('div');
    row.className = 'shell-row' + (enabled ? '' : ' disabled');
    row.innerHTML = `<div><b>${name}</b><small>${desc}</small></div><button class="shell-btn" ${enabled ? '' : 'disabled'}>${action}</button>`;
    if (enabled && onClick) row.querySelector('button').addEventListener('click', onClick);
    return row;
  }

  function renderShop(tab) {
    tab = tab || 'gacha';
    const list = document.getElementById('shopList');
    if (!list) return;
    document.getElementById('shopTabGacha')?.classList.toggle('active', tab === 'gacha');
    document.getElementById('shopTabPack')?.classList.toggle('active', tab === 'pack');
    refreshAllShellNumbers();
    list.innerHTML = '';
    if (tab === 'gacha') {
      list.appendChild(shopRow('🎴 单抽', '随机获得水果碎片，概率解锁新水果。', GACHA_COST_1 + '💎', shell.gems >= GACHA_COST_1, () => doGacha(1)));
      list.appendChild(shopRow('🌈 十连抽', '十次连续抽取，九折。', GACHA_COST_10 + '💎', shell.gems >= GACHA_COST_10, () => doGacha(10)));
      const hint = document.createElement('div');
      hint.className = 'shell-row';
      hint.innerHTML = '<div><b>碎片用途</b><small>抽到重复水果会获得碎片；碎片在“养成”页提升初始等级。</small></div>';
      list.appendChild(hint);
    } else {
      const claimed = shell.lastDaily === todayKey();
      list.appendChild(shopRow('🎁 每日果汁补给', `领取 ${DAILY_GOLD}🍋 + ${DAILY_GEMS}💎`, claimed ? '已领取' : '领取', !claimed, claimDaily));
      list.appendChild(shopRow('🍒 全体攻击强化', '全部水果攻击科技 +1 级。', '180🍋', (meta.gold || 0) >= 180, () => buyUpgradePack('atk_all', 180)));
      list.appendChild(shopRow('🏰 果堡+果汁礼包', '果堡加固 +1，果汁泵 +1。', '150🍋', (meta.gold || 0) >= 150, () => buyUpgradePack('fort_sp', 150)));
    }
  }

  function claimDaily() {
    if (shell.lastDaily === todayKey()) return;
    shell.lastDaily = todayKey();
    shell.gems = (shell.gems || 0) + DAILY_GEMS;
    meta.gold = (meta.gold || 0) + DAILY_GOLD;
    saveAll();
    renderShop('pack');
  }

  function buyUpgradePack(kind, cost) {
    if ((meta.gold || 0) < cost) return;
    meta.gold -= cost;
    if (kind === 'atk_all') {
      for (const id of UNIT_POOL) {
        const key = typeof upgradeKey === 'function' ? upgradeKey(id, 'atk') : id + '_atk';
        meta.upgrades[key] = Math.min(UPGRADE_MAX, (meta.upgrades[key] || 0) + 1);
      }
    } else {
      meta.wallLv = Math.min(WALL_UPGRADE_MAX, (meta.wallLv || 0) + 1);
      meta.spLv = Math.min(SP_UPGRADE_MAX, (meta.spLv || 0) + 1);
    }
    saveAll();
    renderShop('pack');
  }

  const tiers = [
    { label:'普通', weight:40, frag:1, color:'#8aad6a', ids:['watermelon_guard','grape_archer','banana_raider','pineapple_lancer'] },
    { label:'稀有', weight:30, frag:2, color:'#4db6ff', ids:['coconut_guard','orange_cannon','pear_frost','peach_medic'] },
    { label:'史诗', weight:20, frag:3, color:'#b85cff', ids:['blueberry_sniper','lemon_assassin','pumpkin_roller'] },
    { label:'传说', weight:10, frag:5, color:'#ffc93c', ids:['kiwi_wildcard','passion_copy'] },
  ];

  function pickTier() {
    let total = tiers.reduce((s, t) => s + t.weight, 0);
    let r = Math.random() * total;
    for (const t of tiers) { r -= t.weight; if (r <= 0) return t; }
    return tiers[tiers.length - 1];
  }

  function doGacha(count) {
    const cost = count === 10 ? GACHA_COST_10 : GACHA_COST_1;
    if ((shell.gems || 0) < cost) return;
    shell.gems -= cost;
    const results = [];
    meta.unlocked = Array.isArray(meta.unlocked) ? meta.unlocked : [];
    for (let i = 0; i < count; i++) {
      const tier = pickTier();
      const pool = tier.ids.filter(id => TYPES[id]) || UNIT_POOL;
      const id = pool[Math.floor(Math.random() * pool.length)] || UNIT_POOL[0];
      const t = TYPES[id] || {};
      const isNew = !meta.unlocked.includes(id);
      if (isNew) meta.unlocked.push(id);
      shell.fragments[id] = (shell.fragments[id] || 0) + tier.frag;
      results.push({ id, icon:t.icon || '?', name:t.name || id, tier, isNew, total:shell.fragments[id] });
    }
    saveAll();
    renderShop('gacha');
    showGachaResults(results);
  }

  function showGachaResults(results) {
    const overlay = document.createElement('div');
    overlay.className = 'gacha-overlay';
    overlay.innerHTML = `<div class="gacha-box"><h2>🎉 抽卡结果</h2><div id="gachaResults"></div><button class="btn-primary" id="closeGacha">确认</button></div>`;
    document.body.appendChild(overlay);
    const box = overlay.querySelector('#gachaResults');
    for (const r of results) {
      const item = document.createElement('div');
      item.className = 'gacha-result';
      item.style.border = '2px solid ' + r.tier.color;
      item.innerHTML = `<span class="ico">${r.icon}</span><div><b>${r.name}</b><small style="color:${r.tier.color};display:block;font-weight:900;">${r.tier.label}${r.isNew ? ' · 新解锁' : ''}</small><small style="display:block;color:#7d9b5d;">累计 ${r.total} 碎片</small></div><span class="frag">+${r.tier.frag}</span>`;
      box.appendChild(item);
    }
    overlay.querySelector('#closeGacha').addEventListener('click', () => overlay.remove());
  }

  function renderLab() {
    ensureShellData();
    refreshAllShellNumbers();
    const list = document.getElementById('shellLabList');
    const count = document.getElementById('labDeckCount');
    if (!list) return;
    const deck = typeof normalizeDeck === 'function' ? normalizeDeck(meta.deck) : (meta.deck || []);
    if (count) count.textContent = deck.length + '/5';
    list.innerHTML = '';
    for (const id of UNIT_POOL) {
      const t = TYPES[id];
      const unlocked = isUnlocked(id);
      const lv = initLv(id);
      const frags = shell.fragments[id] || 0;
      const cost = initUpgradeCost(id);
      const inDeck = deck.includes(id);
      const row = document.createElement('div');
      row.className = 'shell-row lab-row' + (unlocked ? '' : ' disabled');
      const canUpgrade = unlocked && lv < INIT_MAX && frags >= cost;
      const canDeck = unlocked && (inDeck || deck.length < DECK_SIZE);
      row.innerHTML = `
        <div class="lab-main"><span class="lab-icon">${t.icon}</span><div><b>${t.name} <span class="deck-badge">初始Lv.${lv}</span>${inDeck ? ' <span class="deck-badge">上阵</span>' : ''}</b><small>${roleLabel(t.role)} · ${t.desc}</small><small class="${unlocked ? '' : 'locked-note'}">${unlocked ? `碎片 ${frags}/${lv < INIT_MAX ? cost : 'MAX'} · 召唤直接 Lv.${lv}` : `第${unlockLevelFor(id)}关或抽卡解锁`}</small></div></div>
        <div class="lab-actions"><button class="shell-btn lab-up" ${canUpgrade ? '' : 'disabled'}>${lv >= INIT_MAX ? 'MAX' : cost + '碎片升级'}</button><button class="shell-btn lab-deck" ${canDeck ? '' : 'disabled'}>${inDeck ? '下阵' : '上阵'}</button></div>`;
      row.querySelector('.lab-up').addEventListener('click', () => {
        if (!canUpgrade) return;
        shell.fragments[id] -= cost;
        shell.fruitLv[id] = Math.min(INIT_MAX, lv + 1);
        saveAll();
        renderLab();
      });
      row.querySelector('.lab-deck').addEventListener('click', () => {
        if (!canDeck) return;
        let next = deck.slice();
        if (inDeck) {
          if (next.length <= 1) return;
          next = next.filter(x => x !== id);
        } else if (next.length < DECK_SIZE) next.push(id);
        meta.deck = next;
        saveAll();
        renderLab();
        refreshAllShellNumbers();
      });
      list.appendChild(row);
    }
  }

  function renderLadder() {
    const el = document.getElementById('ladderBest');
    if (el) el.textContent = shell.ladderBest || 0;
  }

  function startLadder() {
    hidePanels();
    state.endless = true;
    state.endlessWave = 1;
    if (typeof initLevel === 'function') initLevel(1);
    state.endless = true;
    state.endlessWave = 1;
  }

  function advanceLadderWave() {
    const nextWave = (state.endlessWave || 1) + 1;
    const level = Math.min(80, 20 + nextWave * 2);
    state.endless = true;
    state.endlessWave = nextWave;
    if (typeof initLevel === 'function') initLevel(level);
    state.endless = true;
    state.endlessWave = nextWave;
    if (typeof addFx === 'function') addFx(W / 2, LAYOUT.fieldY + 88, `第 ${nextWave} 波`, THEME.accent, 18);
  }

  function showLadderResult() {
    const cleared = Math.max(0, (state.endlessWave || 1) - 1);
    const best = shell.ladderBest || 0;
    if (cleared > best) { shell.ladderBest = cleared; saveShell(); }
    const reward = cleared * 8;
    meta.gold = (meta.gold || 0) + reward;
    if (typeof saveMeta === 'function') saveMeta();

    const panel = document.getElementById('resultPanel');
    const title = document.getElementById('resultTitle');
    const detail = document.getElementById('resultDetail');
    let retry = document.getElementById('btnRetry');
    let next = document.getElementById('btnNext');
    let menu = document.getElementById('btnMenu');
    if (!panel || !title || !detail || !retry || !menu) return;
    next?.classList.add('hide');
    title.textContent = '🏁 天梯挑战结束';
    detail.innerHTML = `${cleared > best ? '🎉 新纪录！<br>' : ''}坚持 <b>${cleared}</b> 波<br>历史最佳 ${Math.max(best, cleared)} 波<br>🍋 +${reward}<br>⚔ 击破 ${state.kills || 0}`;

    const retryClone = retry.cloneNode(true);
    retry.parentNode.replaceChild(retryClone, retry);
    retry = retryClone;
    retry.textContent = '再来一次';
    retry.classList.remove('hide');
    retry.addEventListener('click', () => { panel.classList.add('hide'); startLadder(); });

    const menuClone = menu.cloneNode(true);
    menu.parentNode.replaceChild(menuClone, menu);
    menu = menuClone;
    menu.textContent = '返回天梯';
    menu.addEventListener('click', () => {
      panel.classList.add('hide');
      state.phase = 'menu';
      showTab('ladder');
      syncNavVisibility();
    });
    panel.classList.remove('hide');
  }

  function hookGameOver() {
    if (typeof onGameOver !== 'function' || onGameOver._productShellWrapped) return;
    const old = onGameOver;
    onGameOver = function productShellGameOver(win) {
      if (state.endless) {
        if (win) return advanceLadderWave();
        return showLadderResult();
      }
      return old(win);
    };
    onGameOver._productShellWrapped = true;
  }

  function init() {
    ensureShellData();
    installSystemHooks();
    injectStyle();
    ensureStageGrid();
    ensureBottomNav();
    ensureShopPanel();
    ensureLabPanel();
    ensureLadderPanel();
    replaceStartButton();
    hookGameOver();
    const deckBtn = document.getElementById('btnDeck');
    if (deckBtn) deckBtn.style.display = 'none';
    showTab('battle');
    setInterval(syncNavVisibility, 180);
    syncNavVisibility();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();