/* Merge TD UI Redesign v65 - compatibility layer only */
(function installUiRedesignV65() {
  if (window.__uiRedesignV65Installed) return;
  window.__uiRedesignV65Installed = true;

  function addBodyClass() {
    document.body.classList.add('ui-redesign', 'shell-v65');
  }

  function removeLegacyDecorations() {
    document.querySelectorAll('.ui-orchard-path, .ui-formation-preview, .ui-page-head').forEach(el => el.remove());
    document.querySelectorAll('.ui-action-chips, .ui-deck-strip').forEach(el => {
      el.classList.remove('ui-action-chips', 'ui-deck-strip');
    });
  }

  function normalizeResult() {
    const inner = document.querySelector('#resultPanel .panel-inner');
    if (inner) inner.classList.add('ui-result-page');
  }

  function normalizeAll() {
    addBodyClass();
    removeLegacyDecorations();
    normalizeResult();
  }

  function wrapShellTab() {
    if (typeof window.productShellShowTab !== 'function' || window.productShellShowTab._uiRedesignV65) return;
    const old = window.productShellShowTab;
    window.productShellShowTab = function showTabUiRedesign(tab) {
      const result = old(tab);
      requestAnimationFrame(normalizeAll);
      return result;
    };
    window.productShellShowTab._uiRedesignV65 = true;
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
    ['menuPanel', 'campaignPanel', 'arenaPanel', 'shellLabPanel', 'shopPanel', 'resultPanel'].forEach(id => {
      const el = document.getElementById(id);
      if (el) mo.observe(el, { childList: true, subtree: true });
    });
    document.addEventListener('click', event => {
      if (event.target?.closest?.('.bnav-tab, .shop-tabs button, #btnPvpCreate, #btnPvpJoin, #btnPvpReady, #btnPvpLeave')) {
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
