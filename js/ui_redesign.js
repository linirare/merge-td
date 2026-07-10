/* Merge TD UI Redesign v1 - DOM structure helpers */
(function installUiRedesignV1() {
  if (window.__uiRedesignV1Installed) return;
  window.__uiRedesignV1Installed = true;

  function addBodyClass() {
    document.body.classList.add('ui-redesign');
  }

  function text(id, value) {
    const el = document.getElementById(id);
    if (el && el.textContent !== value) el.textContent = value;
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

  function normalizeMenu() {
    const inner = document.querySelector('#menuPanel .menu-card');
    if (!inner) return;
    inner.classList.add('ui-campaign-page');
    ensureHead('menuPanel', 'CAMPAIGN', '闯关', '选择关卡，上阵卡组，然后开局。');

    const logo = inner.querySelector('.game-logo');
    if (logo) logo.style.display = 'none';
    const stats = inner.querySelector('.menu-stats');
    if (stats) stats.classList.add('ui-currency-row');
    const start = document.getElementById('btnStart');
    if (start) start.textContent = '选择关卡';
    const up = document.getElementById('btnUpgrade');
    if (up) up.textContent = '去养成补强';
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

    const cards = inner.querySelectorAll('.arena-card');
    cards.forEach((card, index) => {
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
    const panel = document.getElementById('resultPanel');
    const inner = panel?.querySelector('.panel-inner');
    if (!inner) return;
    inner.classList.add('ui-result-page');
  }

  function normalizeAll() {
    addBodyClass();
    normalizeMenu();
    normalizeArena();
    normalizeLab();
    normalizeShop();
    normalizeResult();
  }

  function wrapShellTab() {
    if (typeof window.productShellShowTab !== 'function' || window.productShellShowTab._uiRedesignV1) return;
    const old = window.productShellShowTab;
    window.productShellShowTab = function showTabUiRedesign(tab) {
      const result = old(tab);
      setTimeout(normalizeAll, 0);
      return result;
    };
    window.productShellShowTab._uiRedesignV1 = true;
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
      if (event.target?.closest?.('.bnav-tab, #btnPvpCreate, #btnPvpJoin, #btnPvpReady, #btnPvpLeave, #shopTabGacha, #shopTabPack')) {
        setTimeout(schedule, 0);
      }
    });
  }

  function init() {
    normalizeAll();
    wrapShellTab();
    installObservers();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
