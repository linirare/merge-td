/* ============================================================
   水果突击 · Deck Unlock Fix
   延后合成辅助球，避免新手默认召唤空转。
   Loaded after deck_ui.js.
   ============================================================ */

(function installDeckUnlockFix() {
  const style = document.createElement('style');
  style.textContent = `.deck-card.locked{opacity:.48;filter:grayscale(.35);cursor:default}.deck-card .locktag{background:#9ab678;color:white}`;
  document.head.appendChild(style);

  roleText = function roleTextFixed(role) {
    return ({ tank:'前排', back:'输出', rush:'突击', front:'枪线', siege:'攻城', control:'控制', support:'辅助', merge:'合成辅助' })[role] || role;
  };

  renderDeckPanel = function renderDeckPanelFixed() {
    syncProgressUnlocks(meta);
    const unlocked = progressUnlocked(meta);
    meta.deck = normalizeDeck(meta.deck).filter(id => unlocked.includes(id));
    for (const id of DEFAULT_DECK) if (meta.deck.length < DECK_SIZE && unlocked.includes(id) && !meta.deck.includes(id)) meta.deck.push(id);

    const selected = document.getElementById('deckSelected');
    if (selected) {
      selected.innerHTML = '';
      for (let i = 0; i < DECK_SIZE; i++) {
        const id = meta.deck[i];
        const t = TYPES[id];
        const chip = document.createElement('div');
        chip.className = 'deck-chip' + (!t ? ' deck-empty' : '');
        chip.innerHTML = t ? `<b>${t.icon}</b>${t.name}` : `<b>+</b>空位`;
        selected.appendChild(chip);
      }
    }

    const list = document.getElementById('deckList');
    if (!list) return;
    list.innerHTML = '';
    for (const id of UNIT_POOL) {
      const t = TYPES[id];
      const on = meta.deck.includes(id);
      const locked = !unlocked.includes(id);
      const full = meta.deck.length >= DECK_SIZE && !on;
      const card = document.createElement('div');
      card.className = 'deck-card' + (on ? ' on' : '') + ((full || locked) ? ' disabled' : '') + (locked ? ' locked' : '');
      card.innerHTML = `
        ${on ? '<span class="tag">上阵</span>' : locked ? `<span class="tag locktag">第${unlockLevelFor(id)}关解锁</span>` : ''}
        <div class="icon">${t.icon}</div>
        <div class="name">${t.name}</div>
        <div class="role">${roleText(t.role)} · ${t.rarity}</div>
        <div class="desc">${t.desc}</div>`;
      card.addEventListener('click', () => {
        if (locked) return;
        if (on) meta.deck = meta.deck.filter(x => x !== id);
        else if (meta.deck.length < DECK_SIZE) meta.deck.push(id);
        else return;
        if (meta.deck.length === 0) meta.deck = DEFAULT_DECK.slice(0, 1);
        syncProgressUnlocks(meta);
        saveMeta();
        renderDeckPanel();
        refreshDeckPreview();
      });
      list.appendChild(card);
    }
  };

  refreshDeckPreview = function refreshDeckPreviewFixed() {
    syncProgressUnlocks(meta);
    const el = document.getElementById('menuDeck');
    if (el) el.innerHTML = meta.deck.map(id => `<span title="${TYPES[id].name}">${TYPES[id].icon}</span>`).join('');
    const stageEl = document.getElementById('menuStage');
    if (stageEl) stageEl.textContent = meta.highestLevel || 1;
  };

  const deckPanel = document.getElementById('deckPanel');
  const sub = deckPanel?.querySelector('.sub');
  if (sub) sub.textContent = '13个水果球逐步解锁，选择5个上阵。局内只会随机召唤这5种。';
  syncProgressUnlocks(meta);
  refreshDeckPreview();
})();