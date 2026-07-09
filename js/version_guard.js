/* ============================================================
   水果突击 · 版本守卫
   作用：强制标记当前构建，清理旧 bow/sword/spear/shield 存档。
   ============================================================ */

const BUILD_VERSION = 'fruit-v12-squad-mode';

(function versionGuard() {
  try {
    const key = 'merge_td_build_version';
    const last = localStorage.getItem(key);
    const metaKey = 'merge_td_meta_v1';
    const raw = localStorage.getItem(metaKey);
    let saved = raw ? JSON.parse(raw) : null;
    const deck = saved?.deck || [];
    const hasOldDeck = deck.some(id => ['bow','sword','spear','shield'].includes(id)) || deck.join('|') === 'watermelon_guard|grape_archer|banana_raider|pineapple_lancer|orange_cannon';
    if (last !== BUILD_VERSION || hasOldDeck) {
      if (!saved) saved = {};
      saved.deck = ['watermelon_guard','grape_archer','orange_cannon','peach_medic','kiwi_wildcard'];
      saved.unlocked = Object.keys(TYPES || {});
      localStorage.setItem(metaKey, JSON.stringify(saved));
      localStorage.setItem(key, BUILD_VERSION);
    }
  } catch (e) {}
})();

function renderBuildBadge() {
  const el = document.getElementById('buildBadge');
  if (el) el.textContent = BUILD_VERSION;
}

document.addEventListener('DOMContentLoaded', renderBuildBadge);