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

  function fruitIcon(id) {
    const t = typeof TYPES !== 'undefined' ? TYPES[id] : null;
    return t?.icon || '\uD83C\uDF4F';
  }

  function currentDeckIcons() {
    const deck = typeof activeDeck === 'function'
      ? activeDeck()
      : (meta?.deck || (typeof UNIT_POOL !== 'undefined' ? UNIT_POOL.slice(0, 5) : []));
    const pool = deck && deck.length ? deck : (typeof UNIT_POOL !== 'undefined' ? UNIT_POOL.slice(0, 5) : []);
    return pool.length ? pool : ['apple'];
  }

  function setPanelCopy() {
    const copy = {
      menuPanel: ['ORCHARD', '\u6c34\u679c\u7a81\u51fb', '\u679c\u6c41\u51fa\u7403\u3001\u68cb\u76d8\u5408\u6210\u3001\u7ebf\u6761\u5175\u63a8\u7ebf'],
      arenaPanel: ['ARENA', '\u679c\u56ed\u7ade\u6280', '\u623f\u95f4\u5bf9\u6218\u4e0e\u5929\u68af\u6311\u6218'],
      shellLabPanel: ['FORMATION', '\u6c34\u679c\u517b\u6210', '\u4e09\u884c\u4e94\u5217\u68cb\u76d8\u3001\u788e\u7247\u5347\u7ea7\u3001\u8f6f\u7cd6\u7ebf\u6761\u5175'],
      shopPanel: ['SUPPLY', '\u679c\u56ed\u8865\u7ed9', '\u788e\u7247\u3001\u679c\u6c41\u548c\u6bcf\u65e5\u8865\u7ed9'],
    };
    Object.entries(copy).forEach(([id, values]) => {
      const inner = document.querySelector(`#${id} .panel-inner`);
      const head = inner?.querySelector(':scope > .ui-page-head');
      if (!head) return;
      const [kicker, title, sub] = values;
      const kickerEl = head.querySelector('.ui-page-kicker');
      const titleEl = head.querySelector('.ui-page-title');
      const subEl = head.querySelector('.ui-page-sub');
      if (kickerEl) kickerEl.textContent = kicker;
      if (titleEl) titleEl.textContent = title;
      if (subEl) subEl.textContent = sub;
    });
  }

  function ensureOrchardPath() {
    const inner = document.querySelector('#menuPanel .menu-card');
    if (!inner || inner.querySelector('.ui-orchard-path')) return;
    const hero = inner.querySelector('.hero-preview');
    const path = document.createElement('div');
    path.className = 'ui-orchard-path';
    path.innerHTML = Array.from({ length: 7 }, (_, i) => {
      const lv = i + 1;
      const current = lv === Math.max(1, Number(meta?.highestLevel || 1));
      const locked = lv > Math.max(1, Number(meta?.highestLevel || 1));
      return `<span class="ui-path-node${current ? ' current' : ''}${locked ? ' locked' : ''}"><b>${lv}</b><i>${fruitIcon((typeof UNIT_POOL !== 'undefined' && UNIT_POOL[i % UNIT_POOL.length]) || '')}</i></span>`;
    }).join('');
    if (hero?.parentNode) hero.parentNode.insertBefore(path, hero.nextSibling);
  }

  function refreshOrchardPath() {
    const nodes = document.querySelectorAll('.ui-orchard-path .ui-path-node');
    const highest = Math.max(1, Number(meta?.highestLevel || 1));
    nodes.forEach((node, index) => {
      const lv = index + 1;
      node.classList.toggle('current', lv === highest);
      node.classList.toggle('locked', lv > highest);
    });
  }

  function ensureFormationPreview() {
    const inner = document.querySelector('#shellLabPanel .panel-inner');
    if (!inner || inner.querySelector('.ui-formation-preview')) return;
    const preview = document.createElement('div');
    preview.className = 'ui-formation-preview';
    preview.innerHTML = `
      <div class="ui-formation-board" aria-hidden="true"></div>
      <div class="ui-stick-preview" aria-hidden="true">
        <span class="ui-stick-head">\uD83C\uDF49</span>
        <span class="ui-stick-body"></span>
        <span class="ui-stick-arm a"></span>
        <span class="ui-stick-arm b"></span>
        <span class="ui-stick-leg a"></span>
        <span class="ui-stick-leg b"></span>
      </div>
    `;
    const anchor = inner.querySelector('.shell-currency') || inner.querySelector('#shellLabList');
    inner.insertBefore(preview, anchor || inner.firstChild);
  }

  function refreshFormationBoard() {
    const board = document.querySelector('.ui-formation-board');
    if (!board) return;
    const deck = currentDeckIcons();
    board.innerHTML = Array.from({ length: 15 }, (_, i) => {
      const id = deck[i % deck.length];
      return `<span class="ui-fruit-cell">${fruitIcon(id)}</span>`;
    }).join('');
  }

  function normalizeActionCopy() {
    text('btnStart', '\u9009\u62e9\u5173\u5361');
    text('btnUpgrade', '\u53bb\u517b\u6210\u8865\u5f3a');
    text('shopTabGacha', '\u788e\u7247\u8865\u5f3a');
    text('shopTabPack', '\u6bcf\u65e5\u8865\u7ed9');
    const chipRow = document.querySelector('#menuPanel .feature-chips');
    const chips = chipRow ? chipRow.querySelectorAll('span') : [];
    const labels = ['\u70b9\u51fa\u7403\u6309\u94ae', '\u62d6\u62fd\u5408\u6210', '\u53cc\u51fb\u6025\u6d3e'];
    chips.forEach((chip, i) => { if (labels[i]) chip.textContent = labels[i]; });
    const brief = document.getElementById('campaignBrief');
    const advice = brief?.querySelector('p:last-child');
    if (advice) advice.textContent = '\u6700\u8fd1\u5efa\u8bae\uff1a\u5148\u70b9\u51fa\u7403\u6309\u94ae\u94fa\u4f4d\uff0c\u518d\u62d6\u62fd\u5408\u6210\u4e3b\u529b\uff1b\u679c\u6c41\u591f\u65f6\u53cc\u51fb\u9ad8\u661f\u8425\u6025\u6d3e\u6551\u7ebf\u3002';
    const guideItems = document.querySelectorAll('#flowGuideSteps li');
    const guideLabels = ['\u70b9\u5e95\u90e8\u51fa\u7403\u6309\u94ae\u81ea\u52a8\u94fa\u4f4d', '\u62d6\u540c\u661f\u6c34\u679c\u5408\u6210\u5347\u7ea7', '\u53cc\u51fb\u6c34\u679c\u8425\u6025\u6d3e\u6551\u7ebf'];
    guideItems.forEach((item, i) => { if (guideLabels[i]) item.textContent = guideLabels[i]; });
  }

  function normalizeMenu() {
    const inner = document.querySelector('#menuPanel .menu-card');
    if (!inner) return;
    inner.classList.add('ui-campaign-page');
    ensureHead('menuPanel', 'FRUIT ASSAULT', '水果突击', '闯关、编队、补给。');

    const logo = inner.querySelector('.game-logo');
    if (logo) logo.style.display = '';
    const stats = inner.querySelector('.menu-stats');
    if (stats) stats.classList.add('ui-currency-row');
    const hero = inner.querySelector('.hero-preview');
    if (hero) hero.classList.add('ui-lobby-hero');
    const chips = Array.from(inner.querySelectorAll('.feature-chips'));
    chips.forEach((chip, index) => chip.classList.add(index === 0 ? 'ui-action-chips' : 'ui-deck-strip'));
    const start = document.getElementById('btnStart');
    if (start) start.textContent = '选择关卡';
    const up = document.getElementById('btnUpgrade');
    if (up) up.textContent = '去养成补强';
  }

  function normalizeArena() {
    ensureHead('arenaPanel', 'ARENA', '竞技场', '匹配、房间、天梯。');
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
    ensureHead('shellLabPanel', 'LAB', '水果图鉴', '碎片、升级、卡组。');
    const inner = document.querySelector('#shellLabPanel .panel-inner');
    if (!inner) return;
    inner.classList.add('ui-growth-page');
    const oldH2 = inner.querySelector(':scope > h2');
    const oldSub = inner.querySelector(':scope > .sub');
    if (oldH2) oldH2.style.display = 'none';
    if (oldSub) oldSub.style.display = 'none';
  }

  function normalizeShop() {
    ensureHead('shopPanel', 'SHOP', '补给站', '扭蛋、礼包、每日补给。');
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
    setPanelCopy();
    ensureOrchardPath();
    refreshOrchardPath();
    ensureFormationPreview();
    refreshFormationBoard();
    normalizeActionCopy();
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
