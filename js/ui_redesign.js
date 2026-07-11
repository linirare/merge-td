/* Merge TD UI Redesign v2.1 - three-layer campaign header + page normalization */
(function installUiRedesignV21() {
  if (window.__uiRedesignV21Installed) return;
  window.__uiRedesignV21Installed = true;

  const SHELL_KEY = 'merge_td_product_shell_v1';

  function gameMeta() {
    try { return typeof meta !== 'undefined' ? meta : (window.meta || {}); }
    catch (err) { return window.meta || {}; }
  }

  function gameState() {
    try { return typeof state !== 'undefined' ? state : (window.state || null); }
    catch (err) { return window.state || null; }
  }

  function addBodyClass() {
    document.body.classList.add('ui-redesign');
  }

  function text(id, value) {
    const el = document.getElementById(id);
    const next = String(value ?? '');
    if (el && el.textContent !== next) el.textContent = next;
  }

  function ensureCampaignHeaderStyle() {
    if (document.getElementById('campaignHeaderStyleV2')) return;
    const style = document.createElement('style');
    style.id = 'campaignHeaderStyleV2';
    style.textContent = `
      body.ui-redesign #menuPanel .panel-inner.ui-campaign-page{
        overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none
      }
      body.ui-redesign #menuPanel .panel-inner.ui-campaign-page::-webkit-scrollbar{display:none}
      body.ui-redesign #menuPanel .game-logo,
      body.ui-redesign #menuPanel .menu-stats,
      body.ui-redesign #menuPanel .menu-card > .feature-chips,
      body.ui-redesign #menuPanel #btnDeck,
      body.ui-redesign #menuPanel #btnUpgrade{display:none!important}
      body.ui-redesign .campaign-top-stack{display:grid;gap:8px;flex:0 0 auto}
      body.ui-redesign .campaign-global-bar{
        display:flex;align-items:center;justify-content:space-between;gap:8px;
        min-height:50px;padding:8px 9px;border-radius:12px;
        border:1px solid var(--ui-line);background:rgba(255,255,255,.82)
      }
      body.ui-redesign .campaign-player-id{display:flex;align-items:center;gap:8px;min-width:0}
      body.ui-redesign .campaign-player-avatar{
        width:34px;height:34px;display:grid;place-items:center;flex:0 0 auto;
        border-radius:10px;background:linear-gradient(180deg,#fff0a1,#b9e987);
        border:1px solid rgba(56,126,66,.15);font-size:19px
      }
      body.ui-redesign .campaign-player-copy{min-width:0;line-height:1.15}
      body.ui-redesign .campaign-player-copy b{
        display:block;max-width:112px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        color:var(--ui-ink);font-size:13px
      }
      body.ui-redesign .campaign-player-copy small{
        display:block;margin-top:4px;color:var(--ui-muted);font-size:9px;white-space:nowrap
      }
      body.ui-redesign .campaign-resources{
        display:flex;align-items:center;justify-content:flex-end;gap:4px;min-width:0
      }
      body.ui-redesign .campaign-resource{
        display:flex;align-items:center;gap:3px;min-height:28px;padding:4px 6px;border-radius:9px;
        background:#203629;color:#fff8cf;font-size:10px;font-weight:900;white-space:nowrap
      }
      body.ui-redesign .campaign-resource i{font-style:normal;font-size:12px}
      body.ui-redesign .campaign-shortcuts{
        display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px
      }
      body.ui-redesign .campaign-shortcut{
        min-height:34px;border:1px solid var(--ui-line);border-radius:9px;
        background:rgba(255,255,255,.76);color:var(--ui-green-dark);
        font-size:11px;font-weight:900;cursor:pointer
      }
      body.ui-redesign .campaign-shortcut:active{transform:translateY(1px)}
      body.ui-redesign .campaign-stage-head{
        display:flex;align-items:center;justify-content:space-between;gap:10px;
        padding:10px 11px;border-radius:11px;
        background:linear-gradient(100deg,#203629,#2f6948);color:#fff
      }
      body.ui-redesign .campaign-stage-copy{min-width:0}
      body.ui-redesign .campaign-stage-label,
      body.ui-redesign .campaign-stage-record span{
        display:block;color:rgba(255,255,255,.62);font-size:9px;font-weight:800
      }
      body.ui-redesign .campaign-stage-title{
        display:block;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        color:#fff8cf;font-size:16px;font-weight:950
      }
      body.ui-redesign .campaign-stage-record{flex:0 0 auto;text-align:right}
      body.ui-redesign .campaign-stage-record b{
        display:block;margin-top:3px;color:#fff;font-size:12px
      }
      @media (max-width:380px){
        body.ui-redesign .campaign-player-copy small{display:none}
        body.ui-redesign .campaign-player-copy b{max-width:82px}
        body.ui-redesign .campaign-resource{padding:4px;font-size:9px}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureHead(panelId, kicker, title, sub) {
    const inner = document.querySelector(`#${panelId} .panel-inner`);
    if (!inner || inner.querySelector(':scope > .ui-page-head')) return;
    const head = document.createElement('div');
    head.className = 'ui-page-head';
    head.innerHTML = `
      <div>
        <div class="ui-page-kicker">${kicker}</div>
        <div class="ui-page-title">${title}</div>
        <div class="ui-page-sub">${sub}</div>
      </div>
    `;
    inner.insertBefore(head, inner.firstChild);
  }

  function readShellData() {
    try { return JSON.parse(localStorage.getItem(SHELL_KEY) || '{}') || {}; }
    catch (err) { return {}; }
  }

  function currentCampaignStage() {
    const metaData = gameMeta();
    const metaStage = Number(metaData.highestLevel || 0);
    const domStage = Number(document.getElementById('menuStage')?.textContent || 0);
    return Math.max(1, metaStage || domStage || 1);
  }

  function campaignStageName(level) {
    const chapter = Math.floor((level - 1) / 5) + 1;
    const node = ((level - 1) % 5) + 1;
    const names = ['农场危机', '果园突围', '腐坏森林', '果堡决战'];
    const name = names[Math.min(chapter - 1, names.length - 1)] || '无尽前线';
    return `${chapter}-${node} ${name}`;
  }

  function campaignStageRecord(level) {
    const stars = Number(gameMeta().stars?.[level] || 0);
    if (stars > 0) {
      return `最高记录：${'★'.repeat(Math.min(3, stars))}${'☆'.repeat(Math.max(0, 3 - stars))}`;
    }
    return '最高记录：未通关';
  }

  function openShellTab(tab) {
    if (typeof window.productShellShowTab === 'function') {
      window.productShellShowTab(tab);
      return;
    }
    document.querySelector(`.bnav-tab[data-tab="${tab}"]`)?.click();
  }

  function bindCampaignShortcuts(stack) {
    if (!stack || stack._campaignBoundV2) return;
    stack._campaignBoundV2 = true;
    stack.addEventListener('click', event => {
      const btn = event.target?.closest?.('[data-campaign-action]');
      if (!btn) return;
      const action = btn.dataset.campaignAction;
      if (action === 'tasks') {
        const grid = document.getElementById('stageGrid');
        if (!grid || grid.classList.contains('hide')) document.getElementById('btnStart')?.click();
        setTimeout(() => {
          document.getElementById('stageGrid')?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
        }, 0);
      } else if (action === 'guide') {
        document.getElementById('helpPanel')?.classList.remove('hide');
      } else if (action === 'events') {
        openShellTab('shop');
      }
    });
  }

  function ensureCampaignTop(inner) {
    let stack = inner.querySelector(':scope > .campaign-top-stack');
    if (!stack) {
      stack = document.createElement('section');
      stack.className = 'campaign-top-stack';
      stack.setAttribute('aria-label', '主界面顶部信息');
      stack.innerHTML = `
        <div class="campaign-global-bar">
          <div class="campaign-player-id">
            <span class="campaign-player-avatar">🍉</span>
            <div class="campaign-player-copy">
              <b id="campaignPlayerName">果园指挥官</b>
              <small id="campaignServerName">S1 · 新芽果园</small>
            </div>
          </div>
          <div class="campaign-resources" aria-label="货币和体力">
            <span class="campaign-resource"><i>💎</i><b id="campaignGemValue">0</b></span>
            <span class="campaign-resource"><i>🪙</i><b id="campaignGoldValue">0</b></span>
            <span class="campaign-resource"><i>⚡</i><b id="campaignEnergyValue">30/30</b></span>
          </div>
        </div>
        <nav class="campaign-shortcuts" aria-label="快捷入口">
          <button class="campaign-shortcut" data-campaign-action="tasks">📋 任务</button>
          <button class="campaign-shortcut" data-campaign-action="guide">📖 指南</button>
          <button class="campaign-shortcut" data-campaign-action="events">🎁 活动</button>
        </nav>
        <div class="campaign-stage-head">
          <div class="campaign-stage-copy">
            <span class="campaign-stage-label">当前章节</span>
            <b id="campaignStageTitle" class="campaign-stage-title">1-1 农场危机</b>
          </div>
          <div class="campaign-stage-record">
            <span>历史战绩</span>
            <b id="campaignStageRecord">最高记录：未通关</b>
          </div>
        </div>
      `;
      const hero = inner.querySelector(':scope > .hero-preview');
      inner.insertBefore(stack, hero || inner.firstChild);
    }
    bindCampaignShortcuts(stack);
    return stack;
  }

  function refreshCampaignTop() {
    const shell = readShellData();
    const metaData = gameMeta();
    const level = currentCampaignStage();
    const gold = Number(metaData.gold ?? document.getElementById('menuGold')?.textContent ?? 0) || 0;
    const gems = Number(shell.gems || 0);
    const energy = Math.max(0, Number(shell.energy ?? 30));
    const energyMax = Math.max(1, Number(shell.energyMax ?? 30));
    const playerName = metaData.playerName || localStorage.getItem('merge_td_player_name') || '果园指挥官';
    const serverName = metaData.serverName || localStorage.getItem('merge_td_server_name') || 'S1 · 新芽果园';

    text('campaignPlayerName', playerName);
    text('campaignServerName', serverName);
    text('campaignGemValue', gems.toLocaleString('zh-CN'));
    text('campaignGoldValue', gold.toLocaleString('zh-CN'));
    text('campaignEnergyValue', `${energy}/${energyMax}`);
    text('campaignStageTitle', campaignStageName(level));
    text('campaignStageRecord', campaignStageRecord(level));
  }

  function normalizeMenu() {
    const inner = document.querySelector('#menuPanel .menu-card');
    if (!inner) return;
    inner.classList.add('ui-campaign-page');
    inner.querySelector(':scope > .ui-page-head')?.remove();
    ensureCampaignTop(inner);
    refreshCampaignTop();

    const logo = inner.querySelector('.game-logo');
    if (logo) logo.style.display = 'none';
    const stats = inner.querySelector('.menu-stats');
    if (stats) stats.style.display = 'none';
    const start = document.getElementById('btnStart');
    if (start && start.textContent === '开始突击') start.textContent = '选择关卡';
  }

  function normalizeArena() {
    ensureHead('arenaPanel', 'ARENA', '竞技', '实时 PVP 与无尽天梯。');
    const inner = document.querySelector('#arenaPanel .panel-inner');
    if (!inner) return;
    inner.classList.add('ui-arena-page');
    const oldH2 = inner.querySelector(':scope > h2');
    const oldSub = inner.querySelector(':scope > .sub');
    if (oldH2) oldH2.style.display = 'none';
    if (oldSub) oldSub.style.display = 'none';
    inner.querySelectorAll('.arena-card').forEach((card, index) => {
      card.classList.add(index === 0 ? 'ui-pvp-card' : 'ui-ladder-card');
    });
  }

  function normalizeLab() {
    ensureHead('shellLabPanel', 'GROWTH', '养成', '管理上阵卡组，提升水果初始等级。');
    const inner = document.querySelector('#shellLabPanel .panel-inner');
    if (!inner) return;
    inner.classList.add('ui-growth-page');
    const oldH2 = inner.querySelector(':scope > h2');
    const oldSub = inner.querySelector(':scope > .sub');
    if (oldH2) oldH2.style.display = 'none';
    if (oldSub) oldSub.style.display = 'none';
  }

  function normalizeShop() {
    ensureHead('shopPanel', 'SUPPLY', '资源补给', '每日补给与碎片补强，不做付费强调。');
    const inner = document.querySelector('#shopPanel .panel-inner');
    if (!inner) return;
    inner.classList.add('ui-supply-page');
    const oldH2 = inner.querySelector(':scope > h2');
    const oldSub = inner.querySelector(':scope > .sub');
    if (oldH2) oldH2.style.display = 'none';
    if (oldSub) oldSub.style.display = 'none';
    text('shopTabGacha', '碎片补强');
    text('shopTabPack', '每日补给');
  }

  function normalizeResult() {
    const inner = document.querySelector('#resultPanel .panel-inner');
    if (inner) inner.classList.add('ui-result-page');
  }

  function normalizeAll() {
    addBodyClass();
    ensureCampaignHeaderStyle();
    normalizeMenu();
    normalizeArena();
    normalizeLab();
    normalizeShop();
    normalizeResult();
  }

  function wrapShellTab() {
    if (typeof window.productShellShowTab !== 'function' || window.productShellShowTab._uiRedesignV21) return;
    const old = window.productShellShowTab;
    window.productShellShowTab = function showTabUiRedesign(tab) {
      const result = old(tab);
      setTimeout(normalizeAll, 0);
      return result;
    };
    window.productShellShowTab._uiRedesignV21 = true;
  }

  function installObservers() {
    let queued = false;
    const schedule = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        normalizeAll();
      });
    };
    const mo = new MutationObserver(schedule);
    ['menuPanel', 'arenaPanel', 'shellLabPanel', 'shopPanel', 'resultPanel'].forEach(id => {
      const el = document.getElementById(id);
      if (el) mo.observe(el, { childList: true, subtree: true });
    });
    document.addEventListener('click', event => {
      if (event.target?.closest?.('.bnav-tab, #btnPvpCreate, #btnPvpJoin, #btnPvpReady, #btnPvpLeave, #shopTabGacha, #shopTabPack, #btnStart')) {
        setTimeout(schedule, 0);
      }
    });
    window.setInterval(() => {
      const currentState = gameState();
      if (!currentState || currentState.phase === 'menu') refreshCampaignTop();
    }, 1000);
  }

  function init() {
    normalizeAll();
    wrapShellTab();
    installObservers();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();