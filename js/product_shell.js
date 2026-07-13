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
  const GEM_RATE = 10; // 1 RMB = 10 钻石

  function purchaseGems(rmb) {
    shell.gems = (shell.gems || 0) + Math.floor(rmb * GEM_RATE);
    saveShell();
    if (renderShop) renderShop('gacha');
  }
  // 英雄等级 1-20 (消耗和加成定义在 config.js)

  const tabs = [
    { id: 'home', icon: '🏡', label: '首页' },
    { id: 'battle', icon: '🚩', label: '闯关' },
    { id: 'upgrade', icon: '🍉', label: '阵容' },
    { id: 'shop', icon: '🛒', label: '商城' },
    { id: 'arena', icon: '🏆', label: '竞技' },
  ];

  let shell = loadShell();
  window.shell = shell; // account_client 需要访问
  let activeTab = 'home';
  let prevPhase = '';
  let selectedFruit = '';
  let selectedShopTab = 'gacha';
  // M3 卡牌屏状态 + 常量
  let squadFilter = 'all';
  let detailId = '';
  let detailTab = 'attr';
  let rankTab = 'power';
  const RANK_TABS = [['power', '战力榜'], ['stage', '关卡榜'], ['ladder', '竞技榜']];
  const RAR_KEY = { epic: 'T0', rare: 'T1', normal: 'T2' };
  const RAR_COLOR = { epic: '#FF6B35', rare: '#5B9FE0', normal: '#8FE0A0' };
  const ROLE_ZH = { tank: '坦克', back: '远程', rush: '突击', front: '前排', siege: '攻城', control: '控制', support: '辅助', merge: '合成' };
  const LV_KEY = { 4: '解锁技能', 5: '强化·金徽', 6: '质变', 7: '满级质变' };
  const SKILL_ZH = { shield: '周期护盾', first_shield: '首战护盾', rapid: '连射', snipe: '狙击', dash: '突进', first_crit: '首击暴击', anti_rush: '反突击', siege: '攻城', death_roll: '死亡爆炸', slow: '减速/冰冻', heal: '治疗', wildcard: '万能合成', copy: '复制', charge: '冲锋', immune: '免伤', burn: '点燃', stealth: '隐身首击', aoe: '范围炸弹', weaken: '削弱', sp_regen: '回能提速', kill_sp: '击杀回能', sp_refund: '操作返能', sp_bank: '储蓄产能', sp_discount: '操作减费' };

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  function loadShell() {
    const base = { gems: 0, fragments: {}, fruitLv: {}, ladderBest: 0, lastDaily: '', pityR: 0, pityE: 0, pityR_t: 0, pityE_t: 0 };
    try {
      const raw = localStorage.getItem(SHELL_KEY);
      if (raw) return Object.assign(base, JSON.parse(raw));
    } catch (e) {}
    return base;
  }

  function saveShell() {
    try { localStorage.setItem(SHELL_KEY, JSON.stringify(shell)); } catch (e) {}
  }

  // 轻量占位提示(未接后端的入口按钮用)
  function hifiToast(msg) {
    let t = document.getElementById('hifiToast');
    if (!t) { t = document.createElement('div'); t.id = 'hifiToast'; t.className = 'hifi-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(hifiToast._t);
    hifiToast._t = setTimeout(() => t.classList.remove('show'), 1600);
  }

  // 共享烫金顶栏(首页/商店等 hifi 屏复用)。data-go / data-help 由各屏统一绑定。
  function hifiTopBarHtml() {
    return `
      <header class="top">
        <button class="ring avatar" data-account><span class="inner"><svg class="icon"><use href="#i-user"/></svg></span><span class="lvl">Lv.${highestLevel()}</span></button>
        <span class="cchip"><svg class="icon"><use href="#i-coin"/></svg><b data-shell-gold>${meta.gold || 0}</b><span class="plus"><svg class="icon"><use href="#i-plus"/></svg></span></span>
        <span class="cchip"><svg class="icon"><use href="#i-gem"/></svg><b data-shell-gems>${shell.gems || 0}</b><span class="plus"><svg class="icon"><use href="#i-plus"/></svg></span></span>
        <span class="sp"></span>
        <button class="ring" data-tut><span class="inner"><svg class="icon"><use href="#i-help"/></svg></span></button>
        <button class="ring" data-go="shop"><span class="inner"><svg class="icon"><use href="#i-bag"/></svg></span></button>
      </header>`;
  }

  function ensureShellData() {
    shell.gems = Number(shell.gems || 0);
    shell.fragments = shell.fragments || {};
    shell.fruitLv = shell.fruitLv || {};
    meta.shardsTotal = meta.shardsTotal || {};
    for (const id of UNIT_POOL) {
      if (!shell.fragments[id]) shell.fragments[id] = 0;
      if (!shell.fruitLv[id]) shell.fruitLv[id] = 1;
      meta.shardsTotal[id] = Math.max(meta.shardsTotal[id] || 0, shell.fragments[id] || 0);
    }
    meta.unlocked = Array.isArray(meta.unlocked) && meta.unlocked.length ? meta.unlocked : DEFAULT_DECK.slice();
    saveShell();
  }

  function saveAll() {
    saveShell();
    if (typeof saveMeta === 'function') saveMeta();
  }
  window.saveAll = saveAll; // account_client 云存档钩子需要

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[ch]);
  }

  function initLv(id) {
    id = normalizeTypeId(id);
    return Math.max(1, Math.min(typeof HERO_MAX !== 'undefined' ? HERO_MAX : 20, Number(shell.fruitLv?.[id] || 1)));
  }

  function initUpgradeCost(id) {
    const lv = initLv(id);
    return typeof heroFragCost === 'function' ? heroFragCost(lv) : Infinity;
  }

  function applyInitLevel(id, level) {
    return level || 1;
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

  function stageInfo(lv) {
    const cfg = typeof generateLevel === 'function' ? generateLevel(lv) : null;
    return cfg || { type: 'normal', tutorialHint: '', bossMechanic: '' };
  }

  function stageTypeText(type) {
    return ({ normal: '普通关', mechanic: '机制关', boss: 'Boss关', resource: '资源关', challenge: '挑战关' })[type] || '普通关';
  }

  function hintText(key) {
    return ({
      merge_pair: '合成同类水果营，优先做出 Lv2 主力。',
      hold_frontline: '前排要站住路线，别让敌人直接压到果堡。',
      urgent_dispatch: '危急路线双击高等级水果营，急派士兵救线。',
      lane_pressure: '观察哪一路压力最高，优先补前排或控制。',
      break_shield_with_siege: '护盾 Boss 怕攻城火力，带橙子炮压盾。',
      counter_rush: '突击敌人多时，用前排和控制拖住节奏。',
      bring_siege: '敌方果堡更厚，阵容里需要攻城单位。',
      farm_juice: '资源关要控果汁节奏，不要一次铺空。',
      protect_backline: '后排输出要有前排保护，别让刺客贴脸。',
      avoid_midline_stack: '炮击 Boss 会惩罚扎堆，分散三路推进。',
      control_counter: '控制单位能打断高压路线，适合防快攻。',
      burst_before_roll: '冲锋单位成型前，集中爆发先处理。',
      focus_support: '先打治疗和辅助，避免敌方越拖越强。',
      anti_assassin_front: '刺客多时，前排轮换比纯输出更重要。',
      split_lanes: '双生 Boss 会给两路压力，别只守一路。',
      frontline_rotation: '中后期要补第二前排，轮换承伤。',
      sustain_damage: '持续伤害关别急着爆发，保证墙血和续航。',
      win_siege_race: '攻城赛道要抢速度，输出和炮手一起推进。',
      protect_support: '辅助被切会崩盘，给后排留保护位。',
      control_summons_then_siege: '先控召唤物，再用攻城单位打 Boss 本体。',
    })[key] || '根据敌方职责补足前排、输出、攻城、控制或辅助。';
  }

  function bossMechanicText(key) {
    return ({
      shield: '护盾：先用攻城破盾',
      artillery: '炮击：分散站位避开中路堆叠',
      twin_pressure: '双生：同时防两路突破',
      summon_aura: '召唤光环：先清小怪再压 Boss',
    })[key] || '';
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
    shellPage('rankPanel', 'shell-rank-page');
  }

  function ensureBottomNav() {
    let nav = document.getElementById('bottomNav');
    if (!nav) {
      nav = document.createElement('div');
      nav.id = 'bottomNav';
      document.body.appendChild(nav);
    }
    nav.className = 'shell-hidden hifi';
    // 烫金风底栏:中间"对战"凸起,沿用里子既有 5 tab 与 showTab 路由
    const navItems = [
      { id: 'shop',    icon: 'i-bag',    label: '商城' },
      { id: 'upgrade', icon: 'i-cards',  label: '阵容' },
      { id: 'home',    icon: 'i-sword',  label: '对战', main: true },
      { id: 'arena',   icon: 'i-vs',     label: '竞技' },
      { id: 'rank',    icon: 'i-trophy', label: '排行' },
    ];
    nav.innerHTML = navItems.map(t => t.main
      ? `<button class="navtab navmain" data-tab="${t.id}"><svg class="micon"><use href="#${t.icon}"/></svg><span class="txt">${t.label}</span><span class="shine"></span></button>`
      : `<button class="navtab" data-tab="${t.id}"><span class="ic"><svg class="icon"><use href="#${t.icon}"/></svg></span>${t.label}</button>`
    ).join('');
    nav.querySelectorAll('.navtab').forEach(btn => btn.addEventListener('click', () => showTab(btn.dataset.tab)));
  }

  function hidePanels() {
    [
      'menuPanel', 'campaignPanel', 'upgradePanel', 'shopPanel', 'arenaPanel',
      'ladderPanel', 'resultPanel', 'overflowPopup', 'helpPanel', 'simPanel',
      'fruitLabPanel', 'shellLabPanel', 'deckPanel', 'flowGuidePanel', 'rankPanel',
    ].forEach(id => document.getElementById(id)?.classList.add('hide'));
  }

  function updateNav() {
    document.querySelectorAll('#bottomNav .navtab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === activeTab));
  }

  function refreshResourceNumbers() {
    if (typeof refreshGold === 'function') refreshGold();
    document.querySelectorAll('[data-shell-gold]').forEach(el => { el.textContent = meta.gold || 0; });
    document.querySelectorAll('[data-shell-gems]').forEach(el => { el.textContent = shell.gems || 0; });
  }

  function renderHome() {
    ensureShellData();
    document.getElementById('menuPanel')?.classList.add('hifi');
    const root = shellPage('menuPanel', 'shell-home-page');
    const lv = currentStage();
    const dailyReady = shell.lastDaily !== todayKey();
    root.innerHTML = `
      <div class="hifi-home">
        <div class="bg"></div><div class="scrim"></div>
        ${hifiTopBarHtml()}

        <div class="logo"><h1 class="display">水果突击</h1><div class="rib">灵果召唤 · 合成塔防</div></div>
        <div class="hero-spot"></div>

        <div class="side-l">
          <button class="ring daily-float" data-daily><span class="inner" style="background:radial-gradient(circle at 40% 34%,#F0A0B8,#C93366)"><svg class="icon"><use href="#i-gift"/></svg></span><span class="lbl">${dailyReady ? '🎁 补给' : '✅ 已领'}</span>${dailyReady ? '<span class="badge pulse">+' + DAILY_GOLD + '🪙 +' + DAILY_GEMS + '💎</span>' : ''}</button>
          <button class="ring" data-mail><span class="inner" style="background:radial-gradient(circle at 40% 34%,#7FBFE8,#2E6FB0)"><svg class="icon"><use href="#i-mail"/></svg></span><span class="lbl">邮件</span></button>
          <button class="ring" data-chat><span class="inner" style="background:radial-gradient(circle at 40% 34%,#8FE0A0,#2E9A56)"><svg class="icon"><use href="#i-chat"/></svg></span><span class="lbl">聊天</span></button>
        </div>
        <div class="side"></div>

        <button class="hifi-levelsel" id="hifiLevelSel">☰ 选关 · 第${lv}关</button>
        <div class="homecta">
          <button class="cta pve" id="hifiPve"><svg class="micon"><use href="#i-sword"/></svg><span class="txtcol"><span class="t">开始对战</span><span class="s">闯关 · 第${lv}关</span></span><span class="shine"></span></button>
          <button class="cta pvp" id="hifiPvp"><svg class="micon"><use href="#i-vs"/></svg><span class="txtcol"><span class="t">开始竞技</span><span class="s">PVP · 论剑</span></span><span class="shine"></span></button>
        </div>
      </div>
    `;
    root.querySelector('#hifiPve')?.addEventListener('click', () => startCampaign(lv));
    root.querySelector('#hifiPvp')?.addEventListener('click', () => showTab('arena'));
    root.querySelector('#hifiLevelSel')?.addEventListener('click', () => showTab('battle'));
    root.querySelector('[data-daily]')?.addEventListener('click', () => claimDaily());
    root.querySelectorAll('[data-help]').forEach(btn => btn.addEventListener('click', () => {
      hidePanels();
      document.getElementById('helpPanel')?.classList.remove('hide');
    }));
    root.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => showTab(btn.dataset.go)));
    root.querySelectorAll('[data-toast]').forEach(btn => btn.addEventListener('click', () => hifiToast(btn.dataset.toast)));
    refreshResourceNumbers();
  }

  function renderCampaign() {
    document.getElementById('campaignPanel')?.classList.add('hifi');
    const root = shellPage('campaignPanel', 'shell-campaign-page');
    const highest = highestLevel();
    const current = currentStage();
    const maxShow = Math.max(20, highest + 3);
    const boss = current % 5 === 0;
    const info = stageInfo(current);
    const mechanic = bossMechanicText(info.bossMechanic);
    root.innerHTML = `
      <div class="hifi-screen shop-bg">
        <div class="bg"></div><div class="scrim"></div>
        ${hifiTopBarHtml()}
        <div class="hifi-scroll">
          <div class="shead"><h2 class="display">果园远征</h2><span class="line"></span></div>
          <div class="gpanel" style="display:flex;align-items:center;gap:12px">
            <div style="flex:1;position:relative;z-index:1">
              <small style="font-size:11px;font-weight:800;color:#F5C242">${boss ? 'BOSS 关' : '下一关'}</small>
              <h3 style="font-family:'ZCOOL KuaiLe';font-size:22px;color:#FFE9A8;margin:2px 0">第 ${current} 关</h3>
              <p style="font-size:12px;color:#C9B48A;font-weight:700">奖励 ${stageRewardText(current)} · ${starsText(current)}</p>
              <p style="font-size:12px;color:#F3E3C0;font-weight:800;line-height:1.45;margin-top:6px">${stageTypeText(info.type)}${mechanic ? ' · ' + mechanic : ''}<br>${hintText(info.tutorialHint)}</p>
            </div>
            <button class="gbtn" id="campaignStartBtn" style="position:relative;z-index:1">挑战</button>
          </div>
          <button class="gbtn blk" id="campaignTrainBtn" style="margin-bottom:14px;background:linear-gradient(180deg,#8f897c,#6b665b);border-color:#4c483f;box-shadow:0 4px 0 #4c483f;color:#e8e4d8;text-shadow:none">🧪 训练模式(不耗资源 / 不结算)</button>
          <div class="shead" style="margin-top:4px"><h2 class="display" style="font-size:18px">关卡</h2><span class="line"></span></div>
          <div class="lvmap" id="campaignMap"></div>
        </div>
      </div>
    `;
    root.querySelector('#campaignStartBtn')?.addEventListener('click', () => startCampaign(current));
    root.querySelector('#campaignTrainBtn')?.addEventListener('click', () => { state.trainingMode = true; startCampaign(current); });
    const map = root.querySelector('#campaignMap');
    for (let lv = 1; lv <= maxShow; lv++) {
      const open = lv <= highest;
      const isBoss = lv % 5 === 0;
      const lvInfo = stageInfo(lv);
      const lvTag = isBoss ? (bossMechanicText(lvInfo.bossMechanic) || 'Boss') : stageTypeText(lvInfo.type);
      const btn = document.createElement('button');
      btn.className = `lvnode${lv === current ? ' current' : ''}${isBoss ? ' boss' : ''}${open ? '' : ' locked'}`;
      btn.disabled = !open;
      btn.innerHTML = `<b>${isBoss ? '🏰' : '🍓'} ${lv}</b><small>${open ? lvTag + ' · ' + starsText(lv) : '未解锁'}</small>`;
      if (open) btn.addEventListener('click', () => startCampaign(lv));
      map.appendChild(btn);
    }
    root.querySelectorAll('[data-help]').forEach(b => b.addEventListener('click', () => { hidePanels(); document.getElementById('helpPanel')?.classList.remove('hide'); }));
    root.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.go)));
    refreshResourceNumbers();
  }

  function ensureSelectedFruit() {
    const d = deck();
    if (!selectedFruit || !UNIT_POOL.includes(selectedFruit)) selectedFruit = d[0] || UNIT_POOL[0];
    return selectedFruit;
  }

  function hifiDisc(id, size) {
    const t = fruit(id);
    const col = t.color || '#F5C242';
    return `<span class="fdisc" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 1.15)}px">${t.icon || '🍏'}</span>`;
  }
  function roleZh(r) { return ROLE_ZH[r] || r || '单位'; }
  function skillZh(t) { return SKILL_ZH[t.skill] || '专属技能'; }

  function renderSquad() {
    ensureShellData();
    console.log('[renderSquad] meta.unlocked:', JSON.stringify(meta.unlocked));
    document.getElementById('shellLabPanel')?.classList.add('hifi');
    const root = shellPage('shellLabPanel', 'shell-squad-page');
    const d = deck();
    const unlockedCount = UNIT_POOL.filter(id => isUnlocked(id)).length;
    root.innerHTML = `
      <div class="hifi-screen shop-bg">
        <div class="bg"></div><div class="scrim"></div>
        ${hifiTopBarHtml()}
        <div class="hifi-scroll">
          <div class="shead"><h2 class="display">卡牌图鉴</h2><span class="line"></span><span class="r">上阵 ${d.length}/${DECK_SIZE}</span></div>
          <div class="team">
            ${Array.from({ length: DECK_SIZE }, (_, i) => {
              const id = d[i];
              if (id) {
                const st = fruit(id);
                const src = RAR_COLOR[st.rarity] || '#8FE0A0';
                return `<div class="slot f" data-detail="${id}" style="background:${src}33;border:2px solid ${src}">${hifiDisc(id, 40)}<span class="slot-rc" style="background:${src}">${RAR_KEY[st.rarity]||'T2'}</span></div>`;
              }
              return `<div class="slot"><svg class="icon plus2"><use href="#i-plus"/></svg></div>`;
            }).join('')}
          </div>
          <div class="gpanel" style="display:flex;align-items:center;justify-content:space-around;gap:10px;padding:16px 14px">
            <div style="text-align:center"><div style="font-family:Fredoka;font-weight:700;font-size:24px;color:#F5C242">${unlockedCount}/${UNIT_POOL.length}</div><small style="font-size:11px;color:#C9B48A;font-weight:800">图鉴收集</small></div>
            <div style="width:1px;height:34px;background:rgba(245,194,66,.3)"></div>
            <div style="text-align:center"><div style="font-family:Fredoka;font-weight:700;font-size:24px;color:#FFCB3D">${typeof computePower === 'function' ? computePower() : 0}</div><small style="font-size:11px;color:#C9B48A;font-weight:800">总战力</small></div>
            <div style="width:1px;height:34px;background:rgba(245,194,66,.3)"></div>
            <div style="text-align:center"><div style="font-family:Fredoka;font-weight:700;font-size:24px;color:#8FE0A0">Lv.${highestLevel()}</div><small style="font-size:11px;color:#C9B48A;font-weight:800">指挥官</small></div>
          </div>
          <div class="ctabs">
            ${[['all', '全部'], ['tank', '坦克'], ['back', '远程'], ['rush', '突击'], ['siege', '攻城']].map(([k, label]) => `<button class="ctab ${squadFilter === k ? 'on' : ''}" data-filter="${k}">${label}</button>`).join('')}
          </div>
          <div class="roster" id="hifiRoster"></div>
        </div>
      </div>
    `;
    const roster = root.querySelector('#hifiRoster');
    const RAR_RANK = { epic: 0, rare: 1, normal: 2 };
    const list = UNIT_POOL
      .filter(id => squadFilter === 'all' || (TYPES[id] && TYPES[id].role === squadFilter))
      .sort((a, b) => {
        const ua = isUnlocked(a) ? 0 : 1, ub = isUnlocked(b) ? 0 : 1;
        if (ua !== ub) return ua - ub;                                   // 已解锁排前,未解锁沉底
        const ra = RAR_RANK[TYPES[a] && TYPES[a].rarity] ?? 3, rb = RAR_RANK[TYPES[b] && TYPES[b].rarity] ?? 3;
        if (ra !== rb) return ra - rb;                                   // 稀有度高排前(T0> T1> T2)
        return String(TYPES[a] && TYPES[a].name || a).localeCompare(String(TYPES[b] && TYPES[b].name || b));
      });
    roster.innerHTML = list.map(id => {
      const t = fruit(id);
      const rc = RAR_COLOR[t.rarity] || '#8FE0A0';
      const rk = RAR_KEY[t.rarity] || 'T2';
      const unlocked = isUnlocked(id);
      if (!unlocked) {
        return `<button class="card lock" style="--rc:#444"><span class="rc" style="background:#555">?</span>${hifiDisc(id, 46)}<span class="nm" style="color:#666">???</span><span class="lk"><svg class="icon"><use href="#i-lock"/></svg><small>抽卡解锁</small></span></button>`;
      }
      const lv = initLv(id);
      return `<button class="card" data-detail="${id}" style="--rc:${rc}"><span class="rc">${rk}</span><span class="lv">Lv${lv}</span>${hifiDisc(id, 46)}<span class="nm">${t.name}</span></button>`;
    }).join('') || '<div style="grid-column:1/-1;text-align:center;color:#8a7a5a;font-weight:800;padding:24px">该职责暂无英雄</div>';

    root.querySelectorAll('[data-filter]').forEach(btn => btn.addEventListener('click', () => { squadFilter = btn.dataset.filter; renderSquad(); }));
    root.querySelectorAll('.card:not(.lock)[data-detail]').forEach(el => el.addEventListener('click', () => openCardDetail(el.dataset.detail)));
    root.querySelectorAll('[data-help]').forEach(btn => btn.addEventListener('click', () => { hidePanels(); document.getElementById('helpPanel')?.classList.remove('hide'); }));
    root.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => showTab(btn.dataset.go)));
    refreshResourceNumbers();
  }

  function openCardDetail(id) {
    id = normalizeTypeId(id);
    detailId = id;
    let ov = document.getElementById('hifiCardOv');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'hifiCardOv';
      ov.className = 'hifi-ov hifi';
      ov.innerHTML = `<div class="sheet cardsheet"><div class="sheet-h"><h2>英雄详情</h2><button class="x" data-close><svg class="icon"><use href="#i-x"/></svg></button></div><div class="sheet-b" id="hifiCardBody"></div></div>`;
      document.body.appendChild(ov);
      ov.addEventListener('click', (e) => { if (e.target === ov || (e.target.closest && e.target.closest('[data-close]'))) ov.classList.remove('active'); });
    }
    renderCardDetail(id);
    ov.classList.add('active');
  }

  function renderCardDetail(id) {
    detailId = id;
    const t = fruit(id);
    const lv = initLv(id);
    const body = document.getElementById('hifiCardBody');
    if (!body) return;
    body.innerHTML =
      `<div class="hero"><div class="big">${hifiDisc(id, 42)}</div><div style="flex:1"><h3>${t.name}</h3><div class="tags"><span class="rchip" style="background:${RAR_COLOR[t.rarity] || '#9AA6B2'}">${RAR_KEY[t.rarity] || 'N'}</span><span class="rchip" style="background:#5c4a2a;color:#F3E3C0">${roleZh(t.role)}</span><span style="font-weight:800;font-size:12px;color:#C9B48A">Lv.${lv}</span></div></div></div>`
      + `<div class="ctabs">${[['attr', '属性·技能'], ['grow', '等级成长']].map(([k, l]) => `<button class="ctab ${detailTab === k ? 'on' : ''}" data-ctab="${k}">${l}</button>`).join('')}</div>`
      + `<div id="hifiCardTabBody"></div>`
      + `<div id="hifiCardActions" style="display:flex;gap:10px;margin-top:14px"></div>`
      + `<div class="srcnote">英雄等级 Lv1-20,每级+40%攻血。同名水果局内合成升级(★1-7,×1~5倍)。</div>`;
    renderCardTab(detailTab);
    renderCardActions(id);
    body.querySelectorAll('.ctab[data-ctab]').forEach(b => b.addEventListener('click', () => { detailTab = b.dataset.ctab; renderCardDetail(id); }));
  }

  function renderCardTab(tab) {
    const id = detailId;
    const t = fruit(id);
    const lv = initLv(id);
    const atkMul = typeof getAtkMul === 'function' ? getAtkMul(meta, id) : 1;
    const hpMul = typeof getHpMul === 'function' ? getHpMul(meta, id) : 1;
    const heroPct = Math.round((heroMul(lv) - 1) * 100);
    const starTier = typeof heroStarTier === 'function' ? heroStarTier(lv) : 1;
    let h = '';
    if (tab === 'attr') {
      h = `<div class="sec"><h4><svg class="icon"><use href="#i-sword"/></svg>当前属性(英雄Lv${lv}·+${heroPct}%)</h4><div class="statrow">`
        + `<div class="s"><svg class="icon" style="color:#EF4444"><use href="#i-sword"/></svg>攻击<b>${Math.round(t.atk * atkMul)}</b></div>`
        + `<div class="s"><svg class="icon" style="color:#2FBF71"><use href="#i-heart"/></svg>血量<b>${Math.round(t.hp * hpMul)}</b></div>`
        + `<div class="s"><svg class="icon" style="color:#9AA6B2"><use href="#i-shield"/></svg>护甲<b>${t.armor || 0}</b></div>`
        + `<div class="s"><svg class="icon" style="color:#38C6E8"><use href="#i-refresh"/></svg>攻速<b>${t.speed}s</b></div>`
        + `<div class="s"><svg class="icon" style="color:#F5C242"><use href="#i-flame"/></svg>攻城<b>×${t.siege}</b></div>`
        + `<div class="s"><svg class="icon" style="color:#C77BE8"><use href="#i-vs"/></svg>职责<b style="font-size:13px">${roleZh(t.role)}</b></div></div>`
        + `<p class="srcnote" style="text-align:left;margin-top:6px">基础 攻${t.atk}/血${t.hp} × ${heroPct}% 英雄等级加成</p></div>`
        + `<div class="sec"><h4><svg class="icon"><use href="#i-flame"/></svg>专属技能 · ${skillZh(t)}</h4><div class="skillbox"><div class="nm">${skillZh(t)}</div><p>${t.desc || ''}</p></div></div>`;
    } else if (tab === 'grow') {
      const maxLv = typeof HERO_MAX !== 'undefined' ? HERO_MAX : 20;
      const lad = [1, 2, 3, 4, 5, 6, 7].map(l => `<div class="lv ${l === 1 ? 'cur' : ''} ${LV_KEY[l] ? 'key' : ''}"><b>Lv${l}</b><small>×${LEVEL_MUL[l]}${LV_KEY[l] ? '<br>' + LV_KEY[l] : ''}</small></div>`).join('');
      const heroPctNext = lv < maxLv ? Math.round((heroMul(lv + 1) - 1) * 100) : 0;
      const starEff = [['★3', '技能 CD -0.5s', starTier >= 3], ['★5', '技能强化', starTier >= 5], ['★6', '同职责光环 +3% ATK', starTier >= 6], ['★7', '开局 SP +2(PvP +1)', starTier >= 7]];
      const eh = starEff.map(e => `<div class="e ${e[2] ? 'on' : ''}"><span class="k">${e[0]}</span>${e[1]}</div>`).join('');
      h = `<div class="sec"><h4><svg class="icon"><use href="#i-cards"/></svg>局内合成 Lv1-7</h4><div class="ladder">${lad}</div><p class="srcnote" style="text-align:left;margin-top:8px">开局 Lv1 · 同名合成升级 · Lv4 技能 · Lv5 强化 · Lv6-7 质变</p></div>`
        + `<div class="sec"><h4><svg class="icon"><use href="#i-star"/></svg>英雄等级 Lv${lv}/${maxLv}</h4><div class="cbar"><span style="width:${(lv - 1) / (maxLv - 1) * 100}%"></span></div><div class="cnote"><span>攻血 +${heroPct}%</span><span>${lv < maxLv ? `升Lv${lv+1} → +${heroPctNext}%` : '已满级'}</span></div></div>`
        + `<div class="sec"><h4><svg class="icon"><use href="#i-flame"/></svg>星级特效</h4><div class="stareff">${eh}</div><p class="srcnote" style="text-align:left;margin-top:6px">英雄等级达到档位解锁对应星级的局内特效</p></div>`;
    }
    const el = document.getElementById('hifiCardTabBody');
    if (el) el.innerHTML = h;
  }

  function renderCardActions(id) {
    const actions = document.getElementById('hifiCardActions');
    if (!actions) return;
    const d = deck();
    const lv = initLv(id);
    const inDeck = d.includes(id);
    const unlocked = isUnlocked(id);
    const cost = initUpgradeCost(id);
    const frags = (shell.fragments && shell.fragments[id]) || 0;
    const maxLv = typeof HERO_MAX !== 'undefined' ? HERO_MAX : 20;
    const canUp = unlocked && lv < maxLv && frags >= cost;
    const canDeck = unlocked && (inDeck || d.length < DECK_SIZE);
    actions.innerHTML = '';
    const heroNextPct = lv < maxLv ? Math.round((heroMul(lv + 1) - 1) * 100) : 0;
    const heroCurPct = Math.round((heroMul(lv) - 1) * 100);
    const upBtn = makeButton('gbtn blk', lv >= maxLv ? `Lv${maxLv} (+${heroCurPct}%攻血) · 已满级` : `升Lv${lv+1} +${heroNextPct}% 消耗${cost}/${frags}`, () => {
      shell.fragments[id] -= cost;
      shell.fruitLv[id] = Math.min(maxLv, lv + 1);
      saveAll();
      renderCardDetail(id);
      renderSquad();
    }, !canUp);
    const deckBtn = makeButton('gbtn blk', inDeck ? '下阵' : '上阵', () => {
      let next = d.slice();
      if (inDeck) { if (next.length <= 1) return; next = next.filter(x => x !== id); }
      else if (next.length < DECK_SIZE) next.push(id);
      meta.deck = next;
      saveAll();
      renderCardDetail(id);
      renderSquad();
      renderHome();
    }, !canDeck || (inDeck && d.length <= 1));
    deckBtn.style.cssText = 'background:linear-gradient(180deg,#8FE0A0,#2E9A56);border-color:#1C6A38;box-shadow:0 5px 0 #1C6A38;color:#0d3a1e';
    actions.appendChild(upBtn);
    actions.appendChild(deckBtn);
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
    document.getElementById('shopPanel')?.classList.add('hifi');
    const root = shellPage('shopPanel', 'shell-shop-page');
    const pityE = Math.min(shell.pityE || 0, 29);
    const canG1 = (shell.gems || 0) >= GACHA_COST_1;
    const canG10 = (shell.gems || 0) >= GACHA_COST_10;
    const canT1 = (shell.gems || 0) >= T0T2_COST_1;
    const canT10 = (shell.gems || 0) >= T0T2_COST_10;
    const canAtk = (meta.gold || 0) >= 180;
    const canFort = (meta.gold || 0) >= 150;
    root.innerHTML = `
      <div class="hifi-screen shop-bg">
        <div class="bg"></div><div class="scrim"></div>
        ${hifiTopBarHtml()}
        <div class="hifi-scroll">
          <div class="shead"><h2 class="display">山货集市</h2><span class="line"></span></div>
          <div class="banner">
            <img src="art/banner-gacha_001.jpg" alt="卡池">
            <div class="cap"><h3>缤纷水果祭 · 基础卡池</h3><div class="rar">
              ${GACHA_TIERS.map(t => `<span class="rchip" style="background:${t.color}">${t.key} ${t.weight}%</span>`).join('')}
            </div></div>
          </div>
          <div class="draw2">
            <button class="gbtn ${canG1 ? '' : 'gray'}" id="hifiGacha1"><span class="display">单抽</span><small class="cost"><svg class="icon" style="width:16px;height:16px"><use href="#i-gem"/></svg>${GACHA_COST_1}</small></button>
            <button class="gbtn ${canG10 ? '' : 'gray'}" id="hifiGacha10"><span class="display">十连 ×10</span><small class="cost"><svg class="icon" style="width:16px;height:16px"><use href="#i-gem"/></svg>${GACHA_COST_10} · 稀保底</small></button>
          </div>
          <div class="shead" style="margin-top:20px"><h2 class="display" style="font-size:20px">🎯 精英卡池 T0-T2</h2><span class="line"></span></div>
          <div class="banner" style="background:linear-gradient(160deg,#2a1a2e,#1a1020)">
            <div style="width:100%;aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;font-size:64px;gap:12px;background:linear-gradient(160deg,#3a1a3e,#1a0820)">🫒<span style="font-size:40px">⚔️</span>🍒</div>
            <div class="cap"><h3 style="color:#FF6B35">传说英雄集结</h3><div class="rar">
              ${T0T2_TIERS.map(t => `<span class="rchip" style="background:${t.color}">${t.key} ${t.weight}%</span>`).join('')}
            </div></div>
          </div>
          <div class="draw2">
            <button class="gbtn ${canT1 ? '' : 'gray'}" id="hifiT0Gacha1"><span class="display">单抽</span><small class="cost"><svg class="icon" style="width:16px;height:16px"><use href="#i-gem"/></svg>${T0T2_COST_1}</small></button>
            <button class="gbtn ${canT10 ? '' : 'gray'}" id="hifiT0Gacha10"><span class="display">十连 ×10</span><small class="cost"><svg class="icon" style="width:16px;height:16px"><use href="#i-gem"/></svg>${T0T2_COST_10} · T1保底</small></button>
          </div>
          <div class="gpanel pack">
            <div class="pic"><svg class="icon"><use href="#i-flame"/></svg></div>
            <div class="info"><h4>全体攻击强化</h4><p>全部水果攻击科技 +1 级</p></div>
            <button class="gbtn ${canAtk ? '' : 'gray'}" id="hifiPackAtk" style="min-height:44px;padding:10px 14px">180🪙</button>
          </div>
          <div class="gpanel pack">
            <div class="pic" style="background:radial-gradient(circle at 40% 34%,#8ABF90,#2E7A44)"><svg class="icon" style="color:#0d3a1e"><use href="#i-shield"/></svg></div>
            <div class="info"><h4>果堡+果汁礼包</h4><p>果堡加固 +1 · 果汁泵 +1</p></div>
            <button class="gbtn ${canFort ? '' : 'gray'}" id="hifiPackFort" style="min-height:44px;padding:10px 14px">150🪙</button>
          </div>
        </div>
      </div>
    `;
    if (canG1) root.querySelector('#hifiGacha1')?.addEventListener('click', () => doGacha(1, GACHA_TIERS, GACHA_COST_1, GACHA_COST_10));
    if (canG10) root.querySelector('#hifiGacha10')?.addEventListener('click', () => doGacha(10, GACHA_TIERS, GACHA_COST_1, GACHA_COST_10));
    if (canT1) root.querySelector('#hifiT0Gacha1')?.addEventListener('click', () => doGacha(1, T0T2_TIERS, T0T2_COST_1, T0T2_COST_10));
    if (canT10) root.querySelector('#hifiT0Gacha10')?.addEventListener('click', () => doGacha(10, T0T2_TIERS, T0T2_COST_1, T0T2_COST_10));
    if (canAtk) root.querySelector('#hifiPackAtk')?.addEventListener('click', () => buyUpgradePack('atk_all', 180));
    if (canFort) root.querySelector('#hifiPackFort')?.addEventListener('click', () => buyUpgradePack('fort_sp', 150));
    root.querySelectorAll('[data-help]').forEach(btn => btn.addEventListener('click', () => {
      hidePanels();
      document.getElementById('helpPanel')?.classList.remove('hide');
    }));
    root.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => showTab(btn.dataset.go)));
    refreshResourceNumbers();
  }

  function arenaRankName(best) {
    if (best >= 40) return '王者';
    if (best >= 25) return '钻石';
    if (best >= 15) return '黄金';
    if (best >= 8) return '白银';
    if (best >= 3) return '青铜';
    return '新手';
  }

  function renderArena() {
    document.getElementById('arenaPanel')?.classList.add('hifi');
    const root = shellPage('arenaPanel', 'shell-arena-page');
    const best = shell.ladderBest || 0;
    const power = typeof computePower === 'function' ? computePower() : 0;
    root.innerHTML = `
      <div class="hifi-screen shop-bg">
        <div class="bg"></div><div class="scrim"></div>
        ${hifiTopBarHtml()}
        <div class="hifi-scroll">
          <div class="shead"><h2 class="display">论剑台</h2><span class="line"></span></div>
          <div class="gpanel">
            <div class="rankbadge">
              <div class="medal"><svg class="icon"><use href="#i-crown"/></svg></div>
              <div style="flex:1">
                <h3 class="display">${arenaRankName(best)}</h3>
                <div style="display:flex;align-items:center;gap:8px;margin-top:4px;font-weight:800;font-size:13px;color:#C9B48A">战力 <b style="color:#FFCB3D;font-family:Fredoka">${power}</b></div>
                <div style="display:flex;align-items:center;gap:8px;margin-top:4px;font-weight:800;font-size:13px;color:#C9B48A">天梯最好 <b style="color:#8FE0A0;font-family:Fredoka">${best}</b> 波</div>
              </div>
            </div>
          </div>

          <div class="shead" style="margin-top:16px"><h2 class="display" style="font-size:20px">实时对战</h2><span class="line"></span></div>
          <div class="gpanel">
            <p style="font-size:13px;color:#C9B48A;font-weight:700;margin:0 0 10px;position:relative;z-index:1">创建房间或输入房间码,对手准备后同步开局。</p>
            <div class="conn off" id="pvpStatus"><span class="dot"></span>未连接</div>
            <div class="field" style="margin-top:10px"><label>房间码</label><input id="pvpRoomInput" type="text" inputmode="numeric" maxlength="6" placeholder="输入 6 位房间码"></div>
            <div style="display:flex;gap:10px;margin-top:12px;position:relative;z-index:1">
              <button class="gbtn blk" id="btnPvpCreate">创建房间</button>
              <button class="gbtn blk" id="btnPvpJoin">加入房间</button>
            </div>
            <div style="display:flex;gap:10px;margin-top:10px;position:relative;z-index:1">
              <button class="gbtn blk" id="btnPvpReady" style="background:linear-gradient(180deg,#8FE0A0,#2E9A56);border-color:#1C6A38;box-shadow:0 5px 0 #1C6A38;color:#0d3a1e">准备</button>
              <button class="gbtn blk" id="btnPvpLeave" style="background:linear-gradient(180deg,#8f897c,#6b665b);border-color:#4c483f;box-shadow:0 5px 0 #4c483f;color:#e8e4d8;text-shadow:none">离开</button>
            </div>
          </div>

        </div>
      </div>
    `;
    root.querySelector('#btnPvpCreate')?.addEventListener('click', () => window.pvpClient?.createRoom());
    root.querySelector('#btnPvpJoin')?.addEventListener('click', () => window.pvpClient?.joinRoom(root.querySelector('#pvpRoomInput')?.value || ''));
    root.querySelector('#btnPvpReady')?.addEventListener('click', () => {
      const ready = !window.pvpClient?.getStatus().ready;
      window.pvpClient?.setReady(ready);
    });
    root.querySelector('#btnPvpLeave')?.addEventListener('click', () => window.pvpClient?.leaveRoom());
    root.querySelectorAll('[data-help]').forEach(btn => btn.addEventListener('click', () => { hidePanels(); document.getElementById('helpPanel')?.classList.remove('hide'); }));
    root.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => showTab(btn.dataset.go)));
    renderPvpStatus();
    refreshResourceNumbers();
  }

  function renderRank() {
    document.getElementById('rankPanel')?.classList.add('hifi');
    const root = shellPage('rankPanel', 'shell-rank-page');
    const power = typeof computePower === 'function' ? computePower() : 0;
    const myName = escapeHtml((window.account && account.user && account.user.nickname) || '果园园长');
    const myScore = rankTab === 'power' ? power : (rankTab === 'stage' ? highestLevel() : (shell.ladderBest || 0));
    root.innerHTML = `
      <div class="hifi-screen shop-bg">
        <div class="bg"></div><div class="scrim"></div>
        ${hifiTopBarHtml()}
        <div class="hifi-scroll">
          <div class="shead"><h2 class="display">无尽天梯</h2><span class="line"></span></div>
          <div class="gpanel">
            <p style="font-size:13px;color:#C9B48A;font-weight:700;margin:0 0 12px">连续波次挑战,失败后按坚持波数结算。</p>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><span style="font-weight:800;color:#C9B48A">历史最好</span><span><b style="font-family:Fredoka;font-size:26px;color:#F5C242">${shell.ladderBest || 0}</b> <small style="color:#C9B48A">波</small></span></div>
            <button class="gbtn blk" id="btnLadderStart"><svg class="icon"><use href="#i-vs"/></svg>开始天梯</button>
          </div>
          <div class="shead" style="margin-top:20px"><h2 class="display">排行榜</h2><span class="line"></span></div>
          <div class="rtabs">${RANK_TABS.map(([k, l]) => `<button class="rtab ${rankTab === k ? 'on' : ''}" data-rtab="${k}">${l}</button>`).join('')}</div>
          <div class="podium" id="hifiPodium"></div>
          <div id="hifiRlist"></div>
        </div>
        <div class="selfrank"><span class="tag">你的排名</span><span class="no">—</span><span class="av"><svg class="icon"><use href="#i-user"/></svg></span><span class="nm">${myName}</span><span class="pw"><svg class="icon"><use href="#i-flame"/></svg>${myScore}</span></div>
      </div>
    `;
    root.querySelector('#btnLadderStart')?.addEventListener('click', startLadder);
    root.querySelectorAll('[data-rtab]').forEach(b => b.addEventListener('click', () => { rankTab = b.dataset.rtab; renderRank(); }));
    root.querySelectorAll('[data-help]').forEach(btn => btn.addEventListener('click', () => { hidePanels(); document.getElementById('helpPanel')?.classList.remove('hide'); }));
    root.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => showTab(btn.dataset.go)));
    populateRank(root);
    refreshResourceNumbers();
  }

  function populateRank(root) {
    const podium = root.querySelector('#hifiPodium');
    const rlist = root.querySelector('#hifiRlist');
    if (!podium || !rlist) return;
    const scoreLabel = rankTab === 'stage' ? '关' : (rankTab === 'ladder' ? '波' : '');
    const self = root.querySelector('.selfrank');
    const empty = (msg) => {
      if (self) self.style.display = 'none';
      podium.innerHTML = '';
      rlist.innerHTML = `<div style="text-align:center;color:#8a7a5a;font-weight:800;padding:28px 12px;line-height:1.8">${msg || '暂无排行数据'}<br><small style="color:#7a6a4a">登录并联网后同步全服榜单</small></div>`;
    };
    const render = (list) => {
      if (!Array.isArray(list) || !list.length) { empty(); return; }
      if (self) self.style.display = 'flex';
      const top3 = list.slice(0, 3);
      podium.innerHTML = [1, 0, 2].filter(i => top3[i]).map(i => {
        const r = top3[i]; const rank = i + 1;
        const h = rank === 1 ? 86 : (rank === 2 ? 64 : 50);
        const avS = rank === 1 ? 64 : 52;
        return `<div class="pod">${rank === 1 ? '<svg class="icon" style="width:26px;height:26px;color:#F5C242;margin-bottom:-2px"><use href="#i-crown"/></svg>' : ''}<div class="av" style="width:${avS}px;height:${avS}px${rank === 1 ? ';border-color:#FFE9A8' : ''}"><svg class="icon" style="width:${Math.round(avS * 0.5)}px;height:${Math.round(avS * 0.5)}px"><use href="#i-user"/></svg></div><span class="nm">${escapeHtml(r.nickname || '玩家')}</span><div class="base" style="height:${h}px${rank === 1 ? ';background:linear-gradient(180deg,#FFE9A8,#E8A317)' : ''}"><svg class="icon"><use href="#i-star"/></svg>${rank}</div></div>`;
      }).join('');
      rlist.innerHTML = list.slice(3).map((r, idx) => `<div class="rrow"><span class="no">${idx + 4}</span><span class="av"><svg class="icon"><use href="#i-user"/></svg></span><span class="nm">${escapeHtml(r.nickname || '玩家')}</span><span class="pw"><svg class="icon"><use href="#i-flame"/></svg>${(r.score || 0).toLocaleString()}${scoreLabel}</span></div>`).join('');
    };
    if (!(window.account && typeof account.leaderboard === 'function')) { empty(); return; }
    empty('加载中…');
    account.leaderboard(rankTab).then(render).catch(() => empty());
  }

  // ===== M6 账号/社交弹层 =====
  let authMode = 'login';
  let tutStep = 0;
  const TUT_STEPS = [
    { ic: 'i-leaf', t: '出战召唤', p: '点底部「出战」消耗果汁 SP,在你的棋盘上召唤水果。' },
    { ic: 'i-cards', t: '拖拽合成', p: '把两个相同水果拖到一起合成升级(上限 Lv7),越高越强。' },
    { ic: 'i-vs', t: '职责克制', p: '坦克/远程/突击/攻城/控制 相互克制(7×7 矩阵),搭配阵容更稳。' },
    { ic: 'i-shield', t: '拆敌堡', p: '水果变士兵冲向 5 条兵线,打空敌方城墙即胜利!同时守住我堡别被破。' },
  ];

  function ensureSheet() {
    let ov = document.getElementById('hifiSheet');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'hifiSheet';
      ov.className = 'hifi-ov hifi';
      ov.innerHTML = `<div class="sheet"><div class="sheet-h"><h2></h2><button class="x" data-close><svg class="icon"><use href="#i-x"/></svg></button></div><div class="sheet-b"></div></div>`;
      document.body.appendChild(ov);
      ov.addEventListener('click', (e) => { if (e.target === ov || (e.target.closest && e.target.closest('[data-close]'))) ov.classList.remove('active'); });
    }
    return ov;
  }
  function openSheet(title, html) {
    const ov = ensureSheet();
    ov.querySelector('.sheet-h h2').textContent = title;
    const body = ov.querySelector('.sheet-b');
    body.innerHTML = html;
    ov.classList.add('active');
    return body;
  }
  function closeSheet() { document.getElementById('hifiSheet')?.classList.remove('active'); }
  function loggedIn() { return !!(window.account && account.token && account.user); }

  function openAccount() { if (loggedIn()) openProfileSheet(); else openAuthSheet(); }

  function openAuthSheet() {
    const isReg = authMode === 'register';
    const body = openSheet(isReg ? '注册' : '登录', `
      <div class="ltabs">
        <button class="ltab ${!isReg ? 'on' : ''}" data-auth="login">登录</button>
        <button class="ltab ${isReg ? 'on' : ''}" data-auth="register">注册</button>
      </div>
      <input class="linput" id="authEmail" type="text" autocomplete="username" aria-label="账号" placeholder="账号">
      <input class="linput" id="authPass" type="password" autocomplete="${isReg ? 'new-password' : 'current-password'}" aria-label="密码" placeholder="密码">
      ${isReg ? '<input class="linput" id="authNick" type="text" autocomplete="nickname" aria-label="昵称" placeholder="昵称(可留空)" maxlength="12">' : ''}
      <button class="gbtn blk" id="authGo" style="margin-top:4px">${isReg ? '注册并登录' : '登录'}</button>
      <button class="gbtn blk" id="authGuest" style="margin-top:10px;background:linear-gradient(180deg,#8f897c,#6b665b);border-color:#4c483f;box-shadow:0 4px 0 #4c483f;color:#e8e4d8;text-shadow:none">游客继续(本地存档)</button>
      <p style="text-align:center;font-size:11px;color:#8a7a5a;margin-top:12px;line-height:1.6">登录后云端存档 · 解锁邮件/排行/世界聊天<br>需连接后端服务器</p>
    `);
    body.querySelectorAll('[data-auth]').forEach(b => b.addEventListener('click', () => { authMode = b.dataset.auth; openAuthSheet(); }));
    body.querySelector('#authGuest')?.addEventListener('click', () => closeSheet());
    body.querySelector('#authGo')?.addEventListener('click', async () => {
      const btn = body.querySelector('#authGo');
      const email = (body.querySelector('#authEmail').value || '').trim();
      const pass = body.querySelector('#authPass').value || '';
      if (!email || !pass) { hifiToast('请填写账号和密码'); return; }
      if (!window.account || !account.register) { hifiToast('需要连接后端服务器'); return; }
      const label = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = isReg ? '注册中…' : '登录中…'; }  // 防重复提交(审计 D)
      try {
        const r = isReg
          ? await account.register(email, pass, (body.querySelector('#authNick')?.value || '').trim())
          : await account.login(email, pass);
        if (r && r.token) { hifiToast(isReg ? '注册成功,欢迎!' : '登录成功,欢迎回来'); closeSheet(); ensureShellData(); refreshResourceNumbers(); renderHome(); }
        else hifiToast(r && r.error ? r.error : '失败,请重试');
      } catch (e) { hifiToast('连接失败,请检查服务器'); }
      finally { if (btn) { btn.disabled = false; btn.textContent = label; } }
    });
  }

  function openProfileSheet() {
    const u = account.user || {};
    const body = openSheet('个人资料', `
      <div class="pf-top">
        <div class="pf-av"><svg class="icon"><use href="#i-user"/></svg></div>
        <div style="flex:1">
          <input class="linput" id="pfName" value="${escapeHtml(u.nickname || '果园园长')}" maxlength="12" style="margin-bottom:6px">
          <div class="uid">UID ${u.uid || '--------'}</div>
        </div>
      </div>
      <div class="statrow" style="margin:12px 0">
        <div class="s"><svg class="icon" style="color:#F5C242"><use href="#i-flame"/></svg>战力<b>${typeof computePower === 'function' ? computePower() : 0}</b></div>
        <div class="s"><svg class="icon" style="color:#38C6E8"><use href="#i-star"/></svg>等级<b>${u.level || 1}</b></div>
        <div class="s"><svg class="icon" style="color:#2FBF71"><use href="#i-trophy"/></svg>关卡<b>${highestLevel()}</b></div>
      </div>
      <button class="gbtn blk" id="pfSave">保存资料</button>
      <button class="gbtn blk" id="pfLogout" style="margin-top:10px;background:linear-gradient(180deg,#8f897c,#6b665b);border-color:#4c483f;box-shadow:0 4px 0 #4c483f;color:#e8e4d8;text-shadow:none">退出登录</button>
    `);
    body.querySelector('#pfSave')?.addEventListener('click', () => {
      const name = (body.querySelector('#pfName').value || '').trim();
      if (window.account && account.api) account.api('POST', '/api/user/profile', { nickname: name }).catch(() => {});
      if (account.user) account.user.nickname = name;
      hifiToast('资料已保存'); renderHome();
    });
    body.querySelector('#pfLogout')?.addEventListener('click', () => { if (window.account && account.logout) account.logout(); else { account.token = null; account.user = null; } hifiToast('已退出登录'); closeSheet(); showLoginGate(); });
  }

  function openMail() {
    const body = openSheet('邮件', '<div id="hifiMailList"><div style="text-align:center;color:#8a7a5a;padding:24px;font-weight:800">加载中…</div></div>');
    const list = body.querySelector('#hifiMailList');
    const showEmpty = (m) => { list.innerHTML = `<div style="text-align:center;color:#8a7a5a;padding:28px 12px;font-weight:800;line-height:1.8">${m || '暂无邮件'}<br><small style="color:#7a6a4a">登录联网后收取系统邮件</small></div>`; };
    if (!(loggedIn() && account.getMail)) { showEmpty('登录后查看邮件'); return; }
    account.getMail().then(mails => {
      if (!Array.isArray(mails) || !mails.length) { showEmpty(); return; }
      list.innerHTML = mails.map(m => `<div class="mail-item">${m.is_read ? '' : '<span class="dot"></span>'}<span class="mi"><svg class="icon"><use href="#i-gift"/></svg></span><div class="mc"><h4>${escapeHtml(m.title || '邮件')}</h4><p>${escapeHtml(m.body || '')}</p></div><button class="gbtn" data-mailid="${escapeHtml(m.id)}" style="min-height:40px;padding:8px 12px;font-size:14px">领取</button></div>`).join('');
      list.querySelectorAll('[data-mailid]').forEach(b => b.addEventListener('click', () => { if (account.readMail) account.readMail(b.dataset.mailid).catch(() => {}); b.textContent = '已领'; b.classList.add('gray'); }));
    }).catch(() => showEmpty('邮件加载失败'));
  }

  function openChat() {
    const body = openSheet('世界聊天', '<div class="chat-msgs" id="hifiChatMsgs"></div><div class="chat-in"><input id="hifiChatIn" placeholder="说点什么…" maxlength="60"><button class="gbtn" id="hifiChatSend" style="min-height:44px;padding:10px 16px">发送</button></div>');
    const msgs = body.querySelector('#hifiChatMsgs');
    const showEmpty = (m) => { msgs.innerHTML = `<div style="text-align:center;color:#8a7a5a;padding:24px;font-weight:800;line-height:1.8;margin:auto">${m || '暂无消息'}</div>`; };
    const myUid = (account.user && account.user.uid) || '';
    function renderMsgs(l) {
      if (!Array.isArray(l) || !l.length) { showEmpty('世界频道暂时安静…'); return; }
      msgs.innerHTML = l.map(c => `<div class="cmsg ${c.uid && c.uid === myUid ? 'me' : ''}"><span class="ca"><svg class="icon"><use href="#i-user"/></svg></span><div class="cb"><div class="nm">${escapeHtml(c.nickname || c.nick || c.n || '玩家')}</div><div class="tx">${escapeHtml(c.text || c.m || '')}</div></div></div>`).join('');
      msgs.scrollTop = msgs.scrollHeight;
    }
    function reload() { if (account.chatMessages) account.chatMessages().then(renderMsgs).catch(() => showEmpty('聊天加载失败')); }
    if (!(window.account && account.chatMessages)) { showEmpty('登录联网后进入世界频道'); }
    else reload();
    body.querySelector('#hifiChatSend')?.addEventListener('click', async () => {
      const inp = body.querySelector('#hifiChatIn');
      const text = (inp.value || '').trim();
      if (!text) return;
      if (!(loggedIn() && account.sendChat)) { hifiToast('请先登录后发言'); return; }
      inp.value = '';
      try { await account.sendChat(text); reload(); } catch (e) { hifiToast('发送失败,请重试'); }
    });
  }

  function openTutorial() { tutStep = 0; renderTut(); }
  function renderTut() {
    const s = TUT_STEPS[tutStep];
    const last = tutStep === TUT_STEPS.length - 1;
    const body = openSheet('新手引导', `
      <div style="text-align:center">
        <div style="width:64px;height:64px;margin:4px auto 10px;border-radius:20px;background:radial-gradient(circle at 40% 34%,#A7F3D0,#2FBF71);display:grid;place-items:center;box-shadow:0 5px 0 #178A4C"><svg class="icon" style="width:34px;height:34px;color:#fff"><use href="#${s.ic}"/></svg></div>
        <h3 style="font-family:'ZCOOL KuaiLe';font-size:22px;color:#FFE9A8;margin-bottom:6px">${s.t}</h3>
        <p style="font-size:14px;color:#F3E3C0;font-weight:700;line-height:1.6;margin-bottom:14px">${s.p}</p>
        <div style="display:flex;justify-content:center;gap:6px;margin-bottom:14px">${TUT_STEPS.map((_, i) => `<i style="width:${i === tutStep ? '20px' : '8px'};height:8px;border-radius:4px;background:${i === tutStep ? '#F5C242' : 'rgba(245,194,66,.3)'};display:inline-block"></i>`).join('')}</div>
        <button class="gbtn blk" id="hifiTutNext">${last ? '开始游戏' : '下一步'}</button>
      </div>
    `);
    body.querySelector('#hifiTutNext')?.addEventListener('click', () => { if (last) closeSheet(); else { tutStep++; renderTut(); } });
  }

  function renderPvpStatus(status = null) {
    const s = status || window.pvpClient?.getStatus?.() || {};
    const el = document.getElementById('pvpStatus');
    const readyBtn = document.getElementById('btnPvpReady');
    const input = document.getElementById('pvpRoomInput');
    if (input && s.roomId) input.value = String(s.roomId).slice(0, 6);
    if (readyBtn) readyBtn.textContent = s.ready ? '取消准备' : '准备';
    if (!el) return;
    const seat = s.playerIndex >= 0 ? `P${s.playerIndex + 1}` : '未入座';
    const peer = s.peerJoined ? (s.peerReady ? '对手已准备' : '对手未准备') : '等待对手';
    const room = s.roomId || '----';
    const ready = s.ready ? '我方已准备' : '我方未准备';
    el.innerHTML = `<b>${escapeHtml(s.status || '未连接')}</b> · ${escapeHtml(seat)}<br><span>房间 ${escapeHtml(room)} · ${escapeHtml(ready)} · ${escapeHtml(peer)}</span>`;
  }

  function showTab(tab) {
    if (typeof window.recalcPhoneFrame === 'function') window.recalcPhoneFrame();
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
    } else if (activeTab === 'rank') {
      document.getElementById('rankPanel')?.classList.remove('hide');
      renderRank();
    }
    const activePanel = document.querySelector('.panel:not(.hide) .panel-inner');
    if (activePanel) activePanel.scrollTop = 0;
    updateNav();
  }

  function startCampaign(level) {
    const raw = typeof normalizeDeckNoFill === 'function' ? normalizeDeckNoFill(meta.deck) : (meta.deck || []);
    if (raw.length < DECK_SIZE) {
      hifiToast(`需要上阵全部${DECK_SIZE}个水果（当前${raw.length}个）`);
      return;
    }
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
    { key: 'T2', label: 'T2·普通', weight: 65, frag: 20, color: '#8FE0A0', rarities: ['normal'] },
    { key: 'T1', label: 'T1·稀有', weight: 25, frag: 10, color: '#5B9FE0', rarities: ['rare'] },
    { key: 'T0', label: 'T0·史诗', weight: 10, frag: 5, color: '#FF6B35', rarities: ['epic'] },
  ];
  // T0-T2卡池:单抽100钻/十连1000钻
  const T0T2_COST_1 = 100;
  const T0T2_COST_10 = 1000;
  const T0T2_TIERS = [
    { key: 'T2', label: 'T2·普通', weight: 55, frag: 100, color: '#8FE0A0', rarities: ['normal'] },
    { key: 'T1', label: 'T1·稀有', weight: 30, frag: 50, color: '#5B9FE0', rarities: ['rare'] },
    { key: 'T0', label: 'T0·史诗', weight: 15, frag: 25, color: '#FF6B35', rarities: ['epic'] },
  ];

  function gachaPool(tier, tiers) {
    tiers = tiers || GACHA_TIERS;
    const ids = UNIT_POOL.filter(id => TYPES[id] && tier.rarities.includes(TYPES[id].rarity));
    return ids.length ? ids : UNIT_POOL;
  }

  function tierByKey(k) {
    return GACHA_TIERS.find(t => t.key === k);
  }

  function rollTier(tiers, poolKey) {
    tiers = tiers || GACHA_TIERS;
    const epic = tiers[2];
    const rare = tiers[1];
    const pe = poolKey === 't' ? 'pityE_t' : 'pityE';
    const pr = poolKey === 't' ? 'pityR_t' : 'pityR';
    if (epic && (shell[pe] || 0) >= 29) return epic;
    if (rare && epic && (shell[pr] || 0) >= 9) return Math.random() < 0.15 ? epic : rare;
    const total = tiers.reduce((s, t) => s + t.weight, 0);
    let r = Math.random() * total;
    for (const t of tiers) {
      r -= t.weight;
      if (r <= 0) return t;
    }
    return tiers[0];
  }

  function bumpPity(key, poolKey) {
    const pe = poolKey === 't' ? 'pityE_t' : 'pityE';
    const pr = poolKey === 't' ? 'pityR_t' : 'pityR';
    if (key === 'T0') {
      shell[pe] = 0; shell[pr] = 0;
    } else if (key === 'T1') {
      shell[pr] = 0; shell[pe] = (shell[pe] || 0) + 1;
    } else {
      shell[pr] = (shell[pr] || 0) + 1; shell[pe] = (shell[pe] || 0) + 1;
    }
  }

  function doGacha(count, tiers, cost1, cost10) {
    tiers = tiers || GACHA_TIERS;
    cost1 = cost1 || GACHA_COST_1;
    cost10 = cost10 || GACHA_COST_10;
    const cost = count === 10 ? cost10 : cost1;
    if ((shell.gems || 0) < cost) return;
    shell.gems -= cost;
    const results = [];
    meta.unlocked = Array.isArray(meta.unlocked) ? meta.unlocked : [];
    let gotRplus = false;
    const poolKey = tiers === T0T2_TIERS ? 't' : '';
    const lowestKey = tiers[0] ? tiers[0].key : 'T2';
    const midKey = tiers.length >= 2 ? tiers[1].key : 'T1';
    for (let i = 0; i < count; i++) {
      let tier = rollTier(tiers, poolKey);
      if (count === 10 && i === 9 && !gotRplus && tier.key === lowestKey) tier = tiers.find(t => t.key === midKey) || tier;
      if (tier.key !== lowestKey) gotRplus = true;
      bumpPity(tier.key, poolKey);
      const pool = gachaPool(tier, tiers);
      const id = pool[Math.floor(Math.random() * pool.length)] || UNIT_POOL[0];
      const t = fruit(id);
      const isNew = !meta.unlocked.includes(id);
      console.log('[gacha] pull', i, id, isNew ? 'NEW' : 'dup', 'pool len', meta.unlocked.length);
      if (isNew) {
        meta.unlocked.push(id);
        // 首次抽到=解锁角色,不给碎片
      } else {
        shell.fragments[id] = (shell.fragments[id] || 0) + tier.frag;
      }
      meta.shardsTotal = meta.shardsTotal || {};
      meta.shardsTotal[id] = (meta.shardsTotal[id] || 0) + (isNew ? 0 : tier.frag);
      results.push({ id, icon: t.icon || '?', name: t.name || id, tier, isNew, total: shell.fragments[id] || 0, fragGained: isNew ? 0 : tier.frag });
    }
    saveAll();
    renderShop('gacha');
    showGachaResults(results);
  }

  function showGachaResults(results) {
    const isMulti = results.length >= 10;
    const overlay = document.createElement('div');
    overlay.className = 'gacha-overlay hifi';
    const html = `<div class="gacha-box${isMulti ? ' multi' : ''}"><h2>🎉 抽卡结果</h2>${isMulti ? '<div class="gacha-summary"></div>' : ''}<div id="gachaResults"${isMulti ? ' class="gacha-grid"' : ''}></div><button class="btn-primary" id="closeGacha">确认</button></div>`;
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    if (isMulti) {
      const counts = {};
      for (const r of results) counts[r.tier.label] = (counts[r.tier.label] || 0) + 1;
      const tiers = results.reduce((acc, r) => { if (!acc.find(t => t.key === r.tier.key)) acc.push(r.tier); return acc; }, []);
      tiers.sort((a, b) => b.frag - a.frag);
      overlay.querySelector('.gacha-summary').innerHTML = tiers.map(t => `<span style="color:${t.color};font-weight:900;font-size:15px;">${t.label}×${counts[t.label]}</span>`).join(' &nbsp;');
    }
    const sorted = [...results].sort((a, b) => {
      if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
      return b.tier.frag - a.tier.frag || a.name.localeCompare(b.name);
    });
    const box = overlay.querySelector('#gachaResults');
    for (let i = 0; i < sorted.length; i++) {
      const r = sorted[i];
      const item = document.createElement('div');
      item.className = 'gacha-result' + (r.isNew && isMulti ? ' gacha-new' : '');
      item.style.border = `2px solid ${r.tier.color}`;
      if (isMulti) item.style.animationDelay = `${i * 0.06}s`;
      if (r.isNew) {
        item.innerHTML = `<span class="ico" style="font-size:40px">${r.icon}</span><div><b style="font-size:18px">${r.name}</b><small style="color:${r.tier.color};display:block;font-weight:900;">${r.tier.label} · ✨新解锁</small></div>`;
      } else {
        item.innerHTML = `<span class="ico">${r.icon}</span><div><b>${r.name}</b><small style="color:${r.tier.color};display:block;font-weight:900;">${r.tier.label}</small><small style="display:block;color:#7d9b5d;">${r.total}碎片</small></div><span class="frag">+${r.fragGained}</span>`;
      }
      box.appendChild(item);
    }
    overlay.querySelector('#closeGacha').addEventListener('click', () => { overlay.remove(); if (typeof saveMeta === 'function') saveMeta(); console.log('[gacha] meta.unlocked after saveMeta:', JSON.stringify(meta.unlocked)); renderSquad(); });
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
      // 训练模式:不消耗资源,不加经验,不给奖励
      if (state.trainingMode) { state.trainingMode = false; return old(win); }
      // 过关奖励金币(meta.gold,已有)+ 钻石(shell.gems,新增)
      if (win) {
        const k = state.currentLevel || 1;
        const boss = k % 5 === 0;
        shell.gems = (shell.gems || 0) + (boss ? 5 : 1); // 普通关 +1, Boss 关 +5
        saveShell();
      }
      return old(win);
    };
    onGameOver._productShellWrapped = true;
  }

  function installSystemHooks() {
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
    document.body.classList.toggle('hifi-menu', show);
    if (show && prevPhase && prevPhase !== 'menu') showTab('home');
    prevPhase = state.phase;
  }

  // —— 强制登录门 + 本地进度重置(修:游客进度串进新账号) ——
  function resetLocalProgress() {
    if (typeof createMeta === 'function') {
      const d = createMeta();
      Object.keys(meta).forEach(k => { delete meta[k]; });
      Object.assign(meta, d);
    }
    const fresh = { gems: 0, fragments: {}, fruitLv: {}, ladderBest: 0, lastDaily: '', pityR: 0, pityE: 0, pityR_t: 0, pityE_t: 0 };
    Object.keys(shell).forEach(k => { delete shell[k]; });
    Object.assign(shell, fresh);
  }
  function applyCloudSave(r) {
    if (r && r.meta_json && r.meta_json !== '{}') { try { Object.assign(meta, JSON.parse(r.meta_json)); } catch (e) {} }
    if (r && r.shell_json && r.shell_json !== '{}') { try { Object.assign(shell, JSON.parse(r.shell_json)); } catch (e) {} }
  }
  function hideLoginGate() { document.getElementById('hifiLoginGate')?.remove(); }
  function showLoginGate() {
    if (loggedIn()) return;
    let gate = document.getElementById('hifiLoginGate');
    if (!gate) {
      gate = document.createElement('div');
      gate.id = 'hifiLoginGate';
      gate.className = 'hifi';
      gate.style.cssText = 'position:fixed;inset:0;z-index:3000;background:radial-gradient(120% 90% at 50% 0%,#3a2a16,#1c140b);display:flex;align-items:center;justify-content:center;padding:24px';
      document.body.appendChild(gate);
    }
    renderLoginGate(gate);
  }
  function renderLoginGate(gate) {
    const isReg = authMode === 'register';
    gate.innerHTML = `
      <div style="width:100%;max-width:330px">
        <h1 style="font-family:'ZCOOL KuaiLe';font-size:32px;color:#FFE9A8;text-align:center;margin:0 0 2px;text-shadow:0 2px 0 #8a5a10">水果突击</h1>
        <p style="text-align:center;color:#c9b78a;font-weight:700;margin:0 0 18px;font-size:12.5px">登录后开始 · 云端存档 / 对战 / 排行</p>
        <div class="ltabs">
          <button class="ltab ${!isReg ? 'on' : ''}" data-g="login">登录</button>
          <button class="ltab ${isReg ? 'on' : ''}" data-g="register">注册</button>
        </div>
        <input class="linput" id="gEmail" type="text" placeholder="账号" autocomplete="off">
        <input class="linput" id="gPass" type="password" placeholder="密码">
        ${isReg ? '<input class="linput" id="gNick" type="text" placeholder="昵称(可留空)" maxlength="12">' : ''}
        <button class="gbtn blk" id="gGo" style="margin-top:8px">${isReg ? '注册并开始' : '登录并开始'}</button>
        <p id="gErr" style="text-align:center;color:#ff9a9a;font-weight:700;font-size:12px;min-height:16px;margin:8px 0 0"></p>
      </div>`;
    gate.querySelectorAll('[data-g]').forEach(b => b.addEventListener('click', () => { authMode = b.dataset.g; renderLoginGate(gate); }));
    const setErr = (m) => { const e = gate.querySelector('#gErr'); if (e) e.textContent = m || ''; };
    gate.querySelector('#gGo')?.addEventListener('click', async () => {
      const email = (gate.querySelector('#gEmail').value || '').trim();
      const pass = gate.querySelector('#gPass').value || '';
      if (!email || !pass) { setErr('请填写账号和密码'); return; }
      if (!(window.account && account.register)) { setErr('无法连接服务器'); return; }
      const btn = gate.querySelector('#gGo'); btn.disabled = true; setErr('');
      try {
        resetLocalProgress(); // 登录/注册都从干净本地态开始,防游客进度串档(注册→保持fresh;登录→云存档覆盖)
        const r = isReg
          ? await account.register(email, pass, (gate.querySelector('#gNick')?.value || '').trim())
          : await account.login(email, pass);
        if (r && r.token) {
          if (isReg) { ensureShellData(); saveAll(); } // 新账号:fresh 落地 localStorage + 推云
          hideLoginGate(); ensureShellData(); refreshResourceNumbers(); renderHome();
        } else { setErr((r && r.error) ? r.error : '失败,请重试'); btn.disabled = false; }
      } catch (e) { setErr('连接失败,请检查服务器'); btn.disabled = false; }
    });
  }
  async function bootAuth() {
    try {
      const s = (window.account && account.restoreSession) ? await account.restoreSession() : { ok: false };
      if (s && s.ok) {
        // 读本地最新数据(清空前保留,清空+云端覆盖后再恢复——本地同步写始终比异步云存档新)
        let localMeta, localShell;
        try { const r = localStorage.getItem('merge_td_meta_v1'); if (r) localMeta = JSON.parse(r); } catch(e) {}
        try { const r = localStorage.getItem(SHELL_KEY); if (r) localShell = JSON.parse(r); } catch(e) {}
        resetLocalProgress(); applyCloudSave(s);
        if (localMeta) Object.assign(meta, localMeta);
        if (localShell) Object.assign(shell, localShell);
        hideLoginGate(); ensureShellData();
        // 服务端增量同步钻石/金币(与管理后台/邮件发放一致)
        if (account.user) {
          const prevSrvGold = parseInt(localStorage.getItem('fa_srv_gold') || '0');
          const prevSrvGems = parseInt(localStorage.getItem('fa_srv_gems') || '0');
          if (account.user.gold !== undefined && account.user.gold > prevSrvGold) { meta.gold = (meta.gold || 0) + (account.user.gold - prevSrvGold); }
          if (account.user.diamonds !== undefined && account.user.diamonds > prevSrvGems) { shell.gems = (shell.gems || 0) + (account.user.diamonds - prevSrvGems); }
          try { localStorage.setItem('fa_srv_gold', String(account.user.gold || 0)); } catch (e) {}
          try { localStorage.setItem('fa_srv_gems', String(account.user.diamonds || 0)); } catch (e) {}
        }
        refreshResourceNumbers(); renderHome();
      } else { showLoginGate(); }
    } catch (e) { showLoginGate(); }
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
    if (!document._hifiAccountBound) {
      document.addEventListener('click', (e) => {
        const t = e.target.closest && e.target.closest('[data-account],[data-mail],[data-chat],[data-tut]');
        if (!t) return;
        if (t.hasAttribute('data-account')) openAccount();
        else if (t.hasAttribute('data-mail')) openMail();
        else if (t.hasAttribute('data-chat')) openChat();
        else if (t.hasAttribute('data-tut')) openTutorial();
      });
      document._hifiAccountBound = true;
    }
    ['resultPanel', 'helpPanel'].forEach(id => document.getElementById(id)?.classList.add('hifi'));
    // 公告/帮助的"知道了":关掉后回到当前 tab(原来只 hide,导致 hidePanels 后全空白)
    document.getElementById('btnHelpClose')?.addEventListener('click', () => {
      document.getElementById('helpPanel')?.classList.add('hide');
      showTab(activeTab || 'home');
    });
    showTab('home');
    setInterval(syncNavVisibility, 180);
    syncNavVisibility();
    // 强制登录:立即遮门(防闪现),再异步尝试恢复会话——能恢复就撤门进游戏
    showLoginGate();
    bootAuth();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
