/* ============================================================
   Fruit Assault - Mobile Game Product Shell v65
   Rebuilds the out-of-battle product shell without changing combat,
   economy numbers, gacha odds, stage rules, or PVP contracts.
   ============================================================ */
(function installProductShellV65() {
  const SHELL_KEY = 'merge_td_product_shell_v1';
  const DAILY_GOLD = 50;
  const DAILY_GEMS = 5;
  const GACHA_COST_1 = 5;
  const GACHA_COST_10 = 45;
  const INIT_MAX = 4;
  const INIT_COST = { 1: 3, 2: 10, 3: 25 };

  const tabs = [
    { id: 'home', icon: '🏡', label: '首页' },
    { id: 'battle', icon: '🚩', label: '闯关' },
    { id: 'upgrade', icon: '🍉', label: '阵容' },
    { id: 'shop', icon: '🛒', label: '商城' },
    { id: 'arena', icon: '🏆', label: '竞技' },
  ];

  let shell = loadShell();
  let activeTab = 'home';
  let prevPhase = '';
  let selectedFruit = '';
  let selectedShopTab = 'gacha';

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  function loadShell() {
    const base = { gems: 0, fragments: {}, fruitLv: {}, ladderBest: 0, lastDaily: '', pityR: 0, pityE: 0 };
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
    meta.shardsTotal = meta.shardsTotal || {};
    for (const id of UNIT_POOL) {
      if (!shell.fragments[id]) shell.fragments[id] = 0;
      if (!shell.fruitLv[id]) shell.fruitLv[id] = 1;
      if (!meta.shardsTotal[id]) meta.shardsTotal[id] = shell.fragments[id] || 0;
    }
    meta.unlocked = Array.isArray(meta.unlocked) ? meta.unlocked : UNIT_POOL.slice(0, 5);
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

  function fruit(id) {
    return TYPES[id] || { icon: '🍏', name: id || '水果', role: 'front', desc: '' };
  }

  function fruitIcon(id) {
    return fruit(id).icon || fruit(id).emoji || '🍏';
  }

  function fruitUnitSprite(id, fallback = '') {
    return fruitIcon(id); // 精灵层已废弃,直用 emoji
  }

  function fruitDisplay(id, fallback = '') {
    const key = normalizeTypeId(id);
    const mapped = ['watermelon_guard', 'banana_raider', 'grape_archer', 'strawberry_knight', 'orange_cannon'];
    if (mapped.includes(key) || fallback) return fruitUnitSprite(key, fallback);
    return `<span class="td-emoji-unit">${fruitIcon(key)}</span>`;
  }

  function fruitName(id) {
    return fruit(id).name || id || '水果';
  }

  function roleText(id) {
    const t = fruit(id);
    return typeof roleLabel === 'function' ? roleLabel(t.role) : (t.role || '单位');
  }

  function deck() {
    const fallback = UNIT_POOL.slice(0, Math.min(DECK_SIZE || 5, UNIT_POOL.length));
    const next = typeof normalizeDeck === 'function' ? normalizeDeck(meta.deck || fallback) : (meta.deck || fallback);
    meta.deck = next.slice();
    return next;
  }

  function highestLevel() {
    return Math.max(1, Number(meta.highestLevel || 1));
  }

  function currentStage() {
    return highestLevel();
  }

  function stageStars(lv) {
    return Math.max(0, Math.min(3, Number(meta.stars?.[lv] || 0)));
  }

  function starsText(lv) {
    const n = stageStars(lv);
    return '★'.repeat(n) + '☆'.repeat(3 - n);
  }

  function stageRewardText(lv) {
    const cfg = typeof generateLevel === 'function' ? generateLevel(lv) : null;
    const reward = cfg?.reward ?? (typeof stageReward === 'function' ? stageReward(lv) : 20 + lv * 2);
    return `${reward}🪙`;
  }

  function clearChildren(el) {
    if (el) el.innerHTML = '';
  }

  function panel(id, className = '') {
    let p = document.getElementById(id);
    if (!p) {
      p = document.createElement('div');
      p.id = id;
      p.className = 'panel hide';
      p.innerHTML = `<div class="panel-inner ${className}"></div>`;
      document.body.appendChild(p);
    }
    const inner = p.querySelector('.panel-inner');
    if (inner && className) inner.className = `panel-inner ${className}`;
    return p;
  }

  function shellPage(id, className = '') {
    const p = panel(id, `shell-page ${className}`);
    return p.querySelector('.panel-inner');
  }

  function resourceBarHtml() {
    return `
      <div class="shell-resource-bar">
        <span><i>🪙</i><b data-shell-gold>${meta.gold || 0}</b></span>
        <span><i>💎</i><b data-shell-gems>${shell.gems || 0}</b></span>
        <span><i>🚩</i><b>${highestLevel()}</b></span>
      </div>
    `;
  }

  function pageHeadHtml(kicker, title, sub = '') {
    return `
      <div class="shell-page-head">
        <div>
          <small>${kicker}</small>
          <h2>${title}</h2>
          ${sub ? `<p>${sub}</p>` : ''}
        </div>
      </div>
    `;
  }

  function makeButton(className, text, onClick, disabled = false) {
    const btn = document.createElement('button');
    btn.className = className;
    btn.textContent = text;
    btn.disabled = !!disabled;
    if (!disabled && onClick) btn.addEventListener('click', onClick);
    return btn;
  }

  function ensureStaticPanels() {
    const menu = document.getElementById('menuPanel');
    if (menu) {
      menu.className = 'panel hide';
      menu.innerHTML = '<div class="panel-inner shell-page shell-home-page"></div>';
    }
    shellPage('campaignPanel', 'shell-campaign-page');
    shellPage('shellLabPanel', 'shell-squad-page');
    shellPage('shopPanel', 'shell-shop-page');
    shellPage('arenaPanel', 'shell-arena-page');
  }

  function ensureBottomNav() {
    let nav = document.getElementById('bottomNav');
    if (!nav) {
      nav = document.createElement('div');
      nav.id = 'bottomNav';
      document.body.appendChild(nav);
    }
    nav.className = 'shell-hidden shell-v65-nav';
    nav.innerHTML = tabs.map(t => `
      <button class="bnav-tab" data-tab="${t.id}">
        <span class="bnav-icon">${t.icon}</span>
        <span>${t.label}</span>
      </button>
    `).join('');
    nav.querySelectorAll('.bnav-tab').forEach(btn => btn.addEventListener('click', () => showTab(btn.dataset.tab)));
  }

  function hidePanels() {
    [
      'menuPanel', 'campaignPanel', 'upgradePanel', 'shopPanel', 'arenaPanel',
      'ladderPanel', 'resultPanel', 'overflowPopup', 'helpPanel', 'simPanel',
      'fruitLabPanel', 'shellLabPanel', 'deckPanel', 'flowGuidePanel',
    ].forEach(id => document.getElementById(id)?.classList.add('hide'));
  }

  function updateNav() {
    document.querySelectorAll('.bnav-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === activeTab));
  }

  function refreshResourceNumbers() {
    if (typeof refreshGold === 'function') refreshGold();
    document.querySelectorAll('[data-shell-gold]').forEach(el => { el.textContent = meta.gold || 0; });
    document.querySelectorAll('[data-shell-gems]').forEach(el => { el.textContent = shell.gems || 0; });
  }

  function renderHome() {
    ensureShellData();
    const root = shellPage('menuPanel', 'shell-home-page');
    const lv = currentStage();
    const d = deck();
    const isBoss = lv % 5 === 0;
    const dailyReady = shell.lastDaily !== todayKey();
    const nextReward = stageRewardText(lv);
    const stars = starsText(lv);
    root.innerHTML = `
      <section class="td-home">
        <header class="td-topbar">
          <button class="td-avatar" data-go="upgrade">${fruitUnitSprite(d[0])}</button>
          <div class="td-resources">
            <span><i>🪙</i><b data-shell-gold>${meta.gold || 0}</b></span>
            <span><i>💎</i><b data-shell-gems>${shell.gems || 0}</b></span>
          </div>
          <button class="td-menu-btn" data-go="shop">☰</button>
        </header>

        <section class="td-battle-preview">
          <div class="td-sky"></div>
          <div class="td-hp-bar"><i style="width:${Math.max(24, Math.min(82, 40 + lv * 6))}%"></i></div>
          <div class="td-castle td-player-castle"><b>果堡</b></div>
          <div class="td-castle td-enemy-castle"><b>${isBoss ? 'Boss' : '敌堡'}</b></div>
          <div class="td-road"></div>
          <div class="td-army td-army-left">
            ${d.slice(0, 5).map((id, i) => `<span style="--i:${i}">${fruitUnitSprite(id)}</span>`).join('')}
          </div>
          <div class="td-army td-army-right">
            ${['strawberry_knight','strawberry_knight','grape_archer','strawberry_knight','strawberry_knight'].map((id, i) => `<span style="--i:${i}">${fruitUnitSprite(id, 'strawberry_knight')}</span>`).join('')}
          </div>
        </section>

        <section class="td-team-strip">
          ${d.slice(0, 5).map(id => `<button data-go="upgrade">${fruitUnitSprite(id)}<b>Lv.${initLv(id)}</b></button>`).join('')}
        </section>

        <section class="td-stage-panel">
          <div class="td-stage-grid">
            ${Array.from({ length: 10 }, (_, i) => {
              const n = i + 1;
              const open = n <= highestLevel();
              const current = n === lv;
              const boss = n % 5 === 0;
              return `<button class="td-stage-node${current ? ' current' : ''}${boss ? ' boss' : ''}${open ? '' : ' locked'}" data-stage="${n}" ${open ? '' : 'disabled'}><small>${starsText(n)}</small><b>${n}</b></button>`;
            }).join('')}
          </div>
          <div class="td-chest-row">
            <span>⭐</span>
            <div><i style="width:${Math.min(100, 20 + lv * 7)}%"></i></div>
            <button data-go="shop">🎁</button>
          </div>
          <button class="td-start-btn" id="homeStartBtn"><span>⚔️</span>开始挑战</button>
        </section>
      </section>
    `;
    root.querySelector('#homeStartBtn')?.addEventListener('click', () => startCampaign(lv));
    root.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => showTab(btn.dataset.go)));
    root.querySelectorAll('[data-stage]').forEach(btn => btn.addEventListener('click', () => startCampaign(Number(btn.dataset.stage || lv))));
    refreshResourceNumbers();
  }

  function renderCampaign() {
    const root = shellPage('campaignPanel', 'shell-campaign-page');
    const highest = highestLevel();
    const current = currentStage();
    const maxShow = Math.max(20, highest + 3);
    root.innerHTML = `
      ${resourceBarHtml()}
      ${pageHeadHtml('CAMPAIGN', '果园远征', '选择已解锁关卡，直接开战')}
      <section class="campaign-current-card">
        <div>
          <small>${current % 5 === 0 ? 'BOSS STAGE' : 'NEXT STAGE'}</small>
          <h3>第 ${current} 关</h3>
          <p>奖励 ${stageRewardText(current)} · ${starsText(current)}</p>
        </div>
        <button class="shell-primary-cta compact" id="campaignStartBtn">挑战</button>
      </section>
      <section class="campaign-map" id="campaignMap"></section>
    `;
    root.querySelector('#campaignStartBtn')?.addEventListener('click', () => startCampaign(current));
    const map = root.querySelector('#campaignMap');
    for (let lv = 1; lv <= maxShow; lv++) {
      const open = lv <= highest;
      const boss = lv % 5 === 0;
      const btn = document.createElement('button');
      btn.className = `map-node${lv === current ? ' current' : ''}${boss ? ' boss' : ''}${open ? '' : ' locked'}`;
      btn.disabled = !open;
      btn.innerHTML = `<b>${boss ? '🏰' : '🍓'} ${lv}</b><small>${open ? starsText(lv) : '未解锁'}</small>`;
      if (open) btn.addEventListener('click', () => startCampaign(lv));
      map.appendChild(btn);
    }
    refreshResourceNumbers();
  }

  function ensureSelectedFruit() {
    const d = deck();
    if (!selectedFruit || !UNIT_POOL.includes(selectedFruit)) selectedFruit = d[0] || UNIT_POOL[0];
    return selectedFruit;
  }

  function renderSquad() {
    ensureShellData();
    const root = shellPage('shellLabPanel', 'shell-squad-page');
    const d = deck();
    const selected = ensureSelectedFruit();
    const selectedInDeck = d.includes(selected);
    const t = fruit(selected);
    const lv = initLv(selected);
    const frags = shell.fragments[selected] || 0;
    const cost = initUpgradeCost(selected);
    const unlocked = isUnlocked(selected);
    const canUpgrade = unlocked && lv < INIT_MAX && frags >= cost;
    const canDeck = unlocked && (selectedInDeck || d.length < DECK_SIZE);

    root.innerHTML = `
      ${resourceBarHtml()}
      ${pageHeadHtml('SQUAD', '水果阵容', '编队、升级、查看水果职责')}
      <section class="deck-slots" id="deckSlots">
        ${Array.from({ length: DECK_SIZE }, (_, i) => {
          const id = d[i];
          return `<button class="deck-slot${id === selected ? ' selected' : ''}" data-fruit="${id || ''}">${id ? `${fruitDisplay(id)}<b>Lv.${initLv(id)}</b>` : '<span class="td-emoji-unit">+</span><b>空位</b>'}</button>`;
        }).join('')}
      </section>
      <section class="fruit-detail-card">
        <div class="fruit-portrait">
          ${fruitDisplay(selected)}
          <i>${roleText(selected)}</i>
        </div>
        <div class="fruit-detail-main">
          <small>${unlocked ? '已解锁' : `第 ${typeof unlockLevelFor === 'function' ? unlockLevelFor(selected) : '?'} 关解锁`}</small>
          <h3>${fruitName(selected)}</h3>
          <p>${t.desc || '水果单位'}</p>
          <div class="fruit-progress"><span>初始 Lv.${lv}</span><b>${lv >= INIT_MAX ? 'MAX' : `碎片 ${frags}/${cost}`}</b></div>
        </div>
        <div class="fruit-actions" id="fruitActions"></div>
      </section>
      <section class="fruit-codex" id="fruitCodex"></section>
    `;

    const actions = root.querySelector('#fruitActions');
    actions.appendChild(makeButton('shell-btn', lv >= INIT_MAX ? '已满级' : `${cost}碎片升级`, () => {
      if (!canUpgrade) return;
      shell.fragments[selected] -= cost;
      shell.fruitLv[selected] = Math.min(INIT_MAX, lv + 1);
      saveAll();
      renderSquad();
    }, !canUpgrade));
    actions.appendChild(makeButton('shell-btn secondary', selectedInDeck ? '下阵' : '上阵', () => {
      if (!canDeck) return;
      let next = d.slice();
      if (selectedInDeck) {
        if (next.length <= 1) return;
        next = next.filter(x => x !== selected);
      } else if (next.length < DECK_SIZE) {
        next.push(selected);
      }
      meta.deck = next;
      saveAll();
      renderSquad();
      renderHome();
    }, !canDeck || (selectedInDeck && d.length <= 1)));

    root.querySelectorAll('.deck-slot[data-fruit]').forEach(btn => {
      const id = btn.dataset.fruit;
      if (id) btn.addEventListener('click', () => { selectedFruit = id; renderSquad(); });
    });

    const codex = root.querySelector('#fruitCodex');
    for (const id of UNIT_POOL) {
      const open = isUnlocked(id);
      const btn = document.createElement('button');
      btn.className = `fruit-tile${id === selected ? ' selected' : ''}${open ? '' : ' locked'}${d.includes(id) ? ' in-deck' : ''}`;
      btn.dataset.fruit = id;
      btn.innerHTML = `${fruitDisplay(id)}<b>${fruitName(id)}</b><small>${open ? `Lv.${initLv(id)} · ${shell.fragments[id] || 0}片` : '未解锁'}</small>`;
      btn.addEventListener('click', () => { selectedFruit = id; renderSquad(); });
      codex.appendChild(btn);
    }
    refreshResourceNumbers();
  }

  function shopCard(title, desc, icon, price, enabled, onClick, extra = '') {
    const card = document.createElement('article');
    card.className = `shop-card${enabled ? '' : ' disabled'}`;
    card.innerHTML = `
      <div class="shop-card-icon">${icon}</div>
      <div class="shop-card-main">
        <h3>${title}</h3>
        <p>${desc}</p>
        ${extra ? `<small>${extra}</small>` : ''}
      </div>
    `;
    card.appendChild(makeButton('shell-btn', price, onClick, !enabled));
    return card;
  }

  function renderShop(tab = selectedShopTab) {
    selectedShopTab = tab || 'gacha';
    const root = shellPage('shopPanel', 'shell-shop-page');
    root.innerHTML = `
      ${resourceBarHtml()}
      ${pageHeadHtml('SHOP', '果园商城', '补强水果、领取资源')}
      <div class="shop-tabs">
        <button id="shopTabGacha" class="${selectedShopTab === 'gacha' ? 'active' : ''}">碎片补强</button>
        <button id="shopTabPack" class="${selectedShopTab === 'pack' ? 'active' : ''}">每日补给</button>
      </div>
      <section class="shop-feature" id="shopFeature"></section>
      <section class="shop-grid" id="shopList"></section>
    `;
    root.querySelector('#shopTabGacha')?.addEventListener('click', () => renderShop('gacha'));
    root.querySelector('#shopTabPack')?.addEventListener('click', () => renderShop('pack'));

    const feature = root.querySelector('#shopFeature');
    const list = root.querySelector('#shopList');
    if (selectedShopTab === 'gacha') {
      feature.innerHTML = `
        <div>
          <small>FRUIT POOL</small>
          <h3>水果补给池</h3>
          <p>重复水果转化为碎片，用于阵容页提升初始等级。</p>
        </div>
        <span>🎴</span>
      `;
      list.appendChild(shopCard('单抽', '随机获得水果碎片，可能解锁新水果。', '🎴', `${GACHA_COST_1}💎`, shell.gems >= GACHA_COST_1, () => doGacha(1), 'N/R/E 碎片池'));
      list.appendChild(shopCard('十连抽', '十次连续抽取，九折并带 R+ 保底。', '🌈', `${GACHA_COST_10}💎`, shell.gems >= GACHA_COST_10, () => doGacha(10), `R保底 ${Math.max(0, 10 - (shell.pityR || 0))} 抽`));
    } else {
      const claimed = shell.lastDaily === todayKey();
      feature.innerHTML = `
        <div>
          <small>DAILY SUPPLY</small>
          <h3>${claimed ? '今日补给已领取' : '今日补给待领取'}</h3>
          <p>补给和礼包都只消耗游戏内资源。</p>
        </div>
        <span>🎁</span>
      `;
      list.appendChild(shopCard('每日果汁补给', `领取 ${DAILY_GOLD}🪙 + ${DAILY_GEMS}💎`, '🎁', claimed ? '已领取' : '领取', !claimed, claimDaily, '每日刷新'));
      list.appendChild(shopCard('全体攻击强化', '全部水果攻击科技 +1 级。', '🍒', '180🪙', (meta.gold || 0) >= 180, () => buyUpgradePack('atk_all', 180), '全队成长'));
      list.appendChild(shopCard('果堡+果汁礼包', '果堡加固 +1，果汁泵 +1。', '🏰', '150🪙', (meta.gold || 0) >= 150, () => buyUpgradePack('fort_sp', 150), '防守补强'));
    }
    refreshResourceNumbers();
  }

  function renderArena() {
    const root = shellPage('arenaPanel', 'shell-arena-page');
    root.innerHTML = `
      ${resourceBarHtml()}
      ${pageHeadHtml('ARENA', '果园竞技', '房间对战与无尽天梯')}
      <section class="arena-mode-card pvp-mode">
        <div>
          <small>REALTIME</small>
          <h3>实时对战</h3>
          <p>创建房间或输入房间码，对手准备后同步开局。</p>
        </div>
        <div class="pvp-status" id="pvpStatus">未连接</div>
        <input id="pvpRoomInput" class="pvp-code" placeholder="输入房间码" maxlength="6">
        <div class="pvp-actions">
          <button class="shell-btn" id="btnPvpCreate">创建房间</button>
          <button class="shell-btn" id="btnPvpJoin">加入房间</button>
          <button class="shell-btn secondary" id="btnPvpReady">准备</button>
          <button class="shell-btn secondary" id="btnPvpLeave">离开</button>
        </div>
      </section>
      <section class="arena-mode-card ladder-mode">
        <div>
          <small>LADDER</small>
          <h3>无尽天梯</h3>
          <p>连续波次挑战，失败后按坚持波数结算。</p>
        </div>
        <div class="ladder-score"><span>历史最好</span><b id="ladderBest">${shell.ladderBest || 0}</b><small>波</small></div>
        <button id="btnLadderStart" class="shell-primary-cta compact">开始天梯</button>
      </section>
    `;
    root.querySelector('#btnPvpCreate')?.addEventListener('click', () => window.pvpClient?.createRoom());
    root.querySelector('#btnPvpJoin')?.addEventListener('click', () => window.pvpClient?.joinRoom(root.querySelector('#pvpRoomInput')?.value || ''));
    root.querySelector('#btnPvpReady')?.addEventListener('click', () => {
      const ready = !window.pvpClient?.getStatus().ready;
      window.pvpClient?.setReady(ready);
    });
    root.querySelector('#btnPvpLeave')?.addEventListener('click', () => window.pvpClient?.leaveRoom());
    root.querySelector('#btnLadderStart')?.addEventListener('click', startLadder);
    renderPvpStatus();
    refreshResourceNumbers();
  }

  function renderPvpStatus(status = null) {
    const s = status || window.pvpClient?.getStatus?.() || {};
    const el = document.getElementById('pvpStatus');
    const readyBtn = document.getElementById('btnPvpReady');
    const input = document.getElementById('pvpRoomInput');
    if (input && s.roomId) input.value = s.roomId;
    if (readyBtn) readyBtn.textContent = s.ready ? '取消准备' : '准备';
    if (!el) return;
    const seat = s.playerIndex >= 0 ? `P${s.playerIndex + 1}` : '未入座';
    const peer = s.peerJoined ? (s.peerReady ? '对手已准备' : '对手未准备') : '等待对手';
    el.innerHTML = `${s.status || '未连接'} · ${seat}<br>房间 ${s.roomId || '----'} · ${s.ready ? '我方已准备' : '我方未准备'} · ${peer}`;
  }

  function showTab(tab) {
    activeTab = tab || 'home';
    hidePanels();
    if (activeTab === 'home') {
      document.getElementById('menuPanel')?.classList.remove('hide');
      renderHome();
    } else if (activeTab === 'battle') {
      document.getElementById('campaignPanel')?.classList.remove('hide');
      renderCampaign();
    } else if (activeTab === 'upgrade') {
      document.getElementById('shellLabPanel')?.classList.remove('hide');
      renderSquad();
    } else if (activeTab === 'shop') {
      document.getElementById('shopPanel')?.classList.remove('hide');
      renderShop(selectedShopTab);
    } else if (activeTab === 'arena') {
      document.getElementById('arenaPanel')?.classList.remove('hide');
      renderArena();
    }
    const activePanel = document.querySelector('.panel:not(.hide) .panel-inner');
    if (activePanel) activePanel.scrollTop = 0;
    updateNav();
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

  function claimDaily() {
    if (shell.lastDaily === todayKey()) return;
    shell.lastDaily = todayKey();
    shell.gems = (shell.gems || 0) + DAILY_GEMS;
    meta.gold = (meta.gold || 0) + DAILY_GOLD;
    saveAll();
    renderShop('pack');
    renderHome();
  }

  function buyUpgradePack(kind, cost) {
    if ((meta.gold || 0) < cost) return;
    meta.gold -= cost;
    if (kind === 'atk_all') {
      for (const id of UNIT_POOL) {
        const key = typeof upgradeKey === 'function' ? upgradeKey(id, 'atk') : `${id}_atk`;
        meta.upgrades[key] = Math.min(UPGRADE_MAX, (meta.upgrades[key] || 0) + 1);
      }
    } else {
      meta.wallLv = Math.min(WALL_UPGRADE_MAX, (meta.wallLv || 0) + 1);
      meta.spLv = Math.min(SP_UPGRADE_MAX, (meta.spLv || 0) + 1);
    }
    saveAll();
    renderShop('pack');
  }

  const GACHA_TIERS = [
    { key: 'N', label: '普通', weight: 65, frag: 5, color: '#8aad6a', rarities: ['normal'] },
    { key: 'R', label: '稀有', weight: 25, frag: 10, color: '#4db6ff', rarities: ['rare'] },
    { key: 'E', label: '史诗', weight: 10, frag: 20, color: '#ffc93c', rarities: ['epic'] },
  ];

  function gachaPool(tier) {
    const ids = UNIT_POOL.filter(id => TYPES[id] && tier.rarities.includes(TYPES[id].rarity));
    return ids.length ? ids : UNIT_POOL;
  }

  function tierByKey(k) {
    return GACHA_TIERS.find(t => t.key === k);
  }

  function rollTier() {
    if ((shell.pityE || 0) >= 29) return tierByKey('E');
    if ((shell.pityR || 0) >= 9) return Math.random() < 0.15 ? tierByKey('E') : tierByKey('R');
    const total = GACHA_TIERS.reduce((s, t) => s + t.weight, 0);
    let r = Math.random() * total;
    for (const t of GACHA_TIERS) {
      r -= t.weight;
      if (r <= 0) return t;
    }
    return GACHA_TIERS[0];
  }

  function bumpPity(key) {
    if (key === 'E') {
      shell.pityE = 0;
      shell.pityR = 0;
    } else if (key === 'R') {
      shell.pityR = 0;
      shell.pityE = (shell.pityE || 0) + 1;
    } else {
      shell.pityR = (shell.pityR || 0) + 1;
      shell.pityE = (shell.pityE || 0) + 1;
    }
  }

  function doGacha(count) {
    const cost = count === 10 ? GACHA_COST_10 : GACHA_COST_1;
    if ((shell.gems || 0) < cost) return;
    shell.gems -= cost;
    const results = [];
    meta.unlocked = Array.isArray(meta.unlocked) ? meta.unlocked : [];
    let gotRplus = false;
    for (let i = 0; i < count; i++) {
      let tier = rollTier();
      if (count === 10 && i === 9 && !gotRplus && tier.key === 'N') tier = tierByKey('R');
      if (tier.key !== 'N') gotRplus = true;
      bumpPity(tier.key);
      const pool = gachaPool(tier);
      const id = pool[Math.floor(Math.random() * pool.length)] || UNIT_POOL[0];
      const t = fruit(id);
      const isNew = !meta.unlocked.includes(id);
      if (isNew) meta.unlocked.push(id);
      shell.fragments[id] = (shell.fragments[id] || 0) + tier.frag;
      meta.shardsTotal = meta.shardsTotal || {};
      meta.shardsTotal[id] = (meta.shardsTotal[id] || 0) + tier.frag;
      results.push({ id, icon: t.icon || '?', name: t.name || id, tier, isNew, total: shell.fragments[id] });
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
      item.style.border = `2px solid ${r.tier.color}`;
      item.innerHTML = `<span class="ico">${r.icon}</span><div><b>${r.name}</b><small style="color:${r.tier.color};display:block;font-weight:900;">${r.tier.label}${r.isNew ? ' · 新解锁' : ''}</small><small style="display:block;color:#7d9b5d;">累计 ${r.total} 碎片</small></div><span class="frag">+${r.tier.frag}</span>`;
      box.appendChild(item);
    }
    overlay.querySelector('#closeGacha').addEventListener('click', () => overlay.remove());
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
    if (cleared > best) {
      shell.ladderBest = cleared;
      saveShell();
    }
    const reward = cleared * 8;
    meta.gold = (meta.gold || 0) + reward;
    if (typeof saveMeta === 'function') saveMeta();

    const panelEl = document.getElementById('resultPanel');
    const title = document.getElementById('resultTitle');
    const detail = document.getElementById('resultDetail');
    let retry = document.getElementById('btnRetry');
    let next = document.getElementById('btnNext');
    let menu = document.getElementById('btnMenu');
    if (!panelEl || !title || !detail || !retry || !menu) return;
    next?.classList.add('hide');
    title.textContent = '🏆 天梯挑战结束';
    detail.innerHTML = `${cleared > best ? '🎉 新纪录！<br>' : ''}坚持 <b>${cleared}</b> 波<br>历史最好 ${Math.max(best, cleared)} 波<br>🪙 +${reward}<br>击破 ${state.kills || 0}`;

    const retryClone = retry.cloneNode(true);
    retry.parentNode.replaceChild(retryClone, retry);
    retry = retryClone;
    retry.textContent = '再来一次';
    retry.classList.remove('hide');
    retry.addEventListener('click', () => { panelEl.classList.add('hide'); startLadder(); });

    const menuClone = menu.cloneNode(true);
    menu.parentNode.replaceChild(menuClone, menu);
    menu = menuClone;
    menu.textContent = '返回竞技';
    menu.addEventListener('click', () => {
      panelEl.classList.add('hide');
      state.phase = 'menu';
      showTab('arena');
      syncNavVisibility();
    });
    panelEl.classList.remove('hide');
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

  function installSystemHooks() {
    if (typeof generateLevel === 'function' && !generateLevel._shellStagesV65) {
      const oldGenerate = generateLevel;
      generateLevel = function generateLevelV65(k) {
        if (k >= 1 && k <= 20) {
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
            desc: boss ? `第 ${k} 关 · 腐坏果堡 Boss` : `第 ${k} 关 · 腐坏水果 Lv${enemyLv.toFixed(1)}`,
          };
        }
        return oldGenerate(k);
      };
      generateLevel._shellStagesV65 = true;
    }

    if (typeof createBall === 'function' && !createBall._shellInitLvV65) {
      const oldCreateBall = createBall;
      createBall = function createBallWithInitialLevel(typeId, level = 1) {
        const finalLevel = state && state._shellCreatingPlayerBall ? applyInitLevel(typeId, level) : level;
        return oldCreateBall(typeId, finalLevel);
      };
      createBall._shellInitLvV65 = true;
    }

    if (typeof initPlayerOpening === 'function' && !initPlayerOpening._shellInitLvV65) {
      const oldInitPlayerOpening = initPlayerOpening;
      initPlayerOpening = function initPlayerOpeningV65(k) {
        state._shellCreatingPlayerBall = true;
        try { return oldInitPlayerOpening(k); }
        finally { state._shellCreatingPlayerBall = false; }
      };
      initPlayerOpening._shellInitLvV65 = true;
    }

    if (typeof summonFruitAt === 'function' && !summonFruitAt._shellInitLvV65) {
      const oldSummon = summonFruitAt;
      summonFruitAt = function summonFruitAtV65(r, c) {
        state._shellCreatingPlayerBall = true;
        try { return oldSummon(r, c); }
        finally { state._shellCreatingPlayerBall = false; }
      };
      summonFruitAt._shellInitLvV65 = true;
    }

    if (typeof autoSpawnBall === 'function' && !autoSpawnBall._shellInitLvV65) {
      const oldAutoSpawn = autoSpawnBall;
      autoSpawnBall = function autoSpawnBallV65(slots, level = 1, enemy = false) {
        if (!enemy && slots === state.playerSlots) {
          state._shellCreatingPlayerBall = true;
          try { return oldAutoSpawn(slots, level, enemy); }
          finally { state._shellCreatingPlayerBall = false; }
        }
        return oldAutoSpawn(slots, level, enemy);
      };
      autoSpawnBall._shellInitLvV65 = true;
    }
  }

  function syncNavVisibility() {
    const nav = document.getElementById('bottomNav');
    if (!nav) return;
    const show = state.phase === 'menu';
    nav.classList.toggle('shell-hidden', !show);
    if (show && prevPhase && prevPhase !== 'menu') showTab('home');
    prevPhase = state.phase;
  }

  function init() {
    ensureShellData();
    document.body.classList.add('shell-v65');
    installSystemHooks();
    ensureStaticPanels();
    ensureBottomNav();
    hookGameOver();
    window.productShellShowTab = showTab;
    window.pvpClient?.onStatus(renderPvpStatus);
    showTab('home');
    setInterval(syncNavVisibility, 180);
    syncNavVisibility();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
