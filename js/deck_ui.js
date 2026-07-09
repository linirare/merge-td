/* ============================================================
   水果突击 · Fruit Assault —— 局外5选编队 UI
   ============================================================ */

(function installDeckUI() {
  migrateDeckFromStorage();
  ensureDeckPanelDom();
  bindDeckButtons();
  refreshDeckPreview();
})();

function migrateDeckFromStorage() {
  try {
    const raw = localStorage.getItem('merge_td_meta_v1');
    if (raw) {
      const saved = JSON.parse(raw);
      meta.deck = normalizeDeck(saved.deck || meta.deck || DEFAULT_DECK);
      meta.unlocked = Array.isArray(saved.unlocked) && saved.unlocked.length ? saved.unlocked.map(normalizeTypeId).filter(id => TYPES[id]) : UNIT_POOL.slice();
    } else {
      meta.deck = normalizeDeck(meta.deck || DEFAULT_DECK);
      meta.unlocked = UNIT_POOL.slice();
    }
  } catch (e) {
    meta.deck = normalizeDeck(meta.deck || DEFAULT_DECK);
    meta.unlocked = UNIT_POOL.slice();
  }
  saveMeta();
}

function ensureDeckPanelDom() {
  if (document.getElementById('deckPanel')) return;
  const panel = document.createElement('div');
  panel.id = 'deckPanel';
  panel.className = 'panel hide';
  panel.innerHTML = `
    <div class="panel-inner wide tech-panel">
      <h2>🍉 水果编队</h2>
      <p class="sub">从12个水果球里选择5个上阵。局内只会刷这5种。</p>
      <div id="deckSelected" class="deck-selected"></div>
      <div id="deckList" class="deck-list"></div>
      <button id="btnDeckClose" class="btn-secondary">保存并返回</button>
    </div>`;
  document.body.appendChild(panel);

  const style = document.createElement('style');
  style.textContent = `
    .deck-selected{width:100%;display:flex;gap:6px;justify-content:center;flex-wrap:wrap;padding:8px;border-radius:16px;background:rgba(255,255,255,.46);border:1px solid rgba(83,201,106,.18)}
    .deck-chip{min-width:50px;text-align:center;padding:7px 8px;border-radius:14px;background:rgba(255,255,255,.72);border:1px solid rgba(83,201,106,.18);font-size:11px;color:#315326;box-shadow:0 4px 10px rgba(55,140,68,.08)}
    .deck-chip b{font-size:20px;display:block;line-height:1.1}.deck-empty{color:#9ab678;border-style:dashed}
    .deck-list{width:100%;max-height:430px;overflow-y:auto;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:2px}
    .deck-card{padding:9px;border-radius:16px;background:rgba(255,255,255,.58);border:1px solid rgba(83,201,106,.14);cursor:pointer;min-height:92px;position:relative;box-shadow:0 5px 12px rgba(45,126,66,.08)}
    .deck-card.on{border:2px solid #53c96a;background:rgba(232,255,205,.88)}.deck-card.disabled{opacity:.55;cursor:default}.deck-card .icon{font-size:25px}.deck-card .name{font-size:12px;font-weight:900;color:#244b21}.deck-card .role{font-size:10px;color:#2c8d3f;margin-top:2px}.deck-card .desc{font-size:9px;color:#6f9251;line-height:1.35;margin-top:4px}.deck-card .tag{position:absolute;right:7px;top:7px;font-size:9px;background:#ffc93c;color:#795000;border-radius:99px;padding:2px 6px;font-weight:900}
  `;
  document.head.appendChild(style);
}

function bindDeckButtons() {
  const deckBtn = document.getElementById('btnDeck');
  if (deckBtn && !deckBtn._bound) {
    deckBtn.addEventListener('click', () => {
      document.getElementById('deckPanel').classList.remove('hide');
      renderDeckPanel();
    });
    deckBtn._bound = true;
  }
  const closeBtn = document.getElementById('btnDeckClose');
  if (closeBtn && !closeBtn._bound) {
    closeBtn.addEventListener('click', () => {
      meta.deck = normalizeDeck(meta.deck);
      saveMeta();
      refreshDeckPreview();
      document.getElementById('deckPanel').classList.add('hide');
    });
    closeBtn._bound = true;
  }
}

function roleText(role) {
  return ({ tank:'前排', back:'输出', rush:'突击', front:'枪线', siege:'攻城', control:'控制', support:'辅助', merge:'合成引擎' })[role] || role;
}
function renderDeckPanel() {
  meta.deck = normalizeDeck(meta.deck);
  const selected = document.getElementById('deckSelected');
  selected.innerHTML = '';
  for (let i = 0; i < DECK_SIZE; i++) {
    const id = meta.deck[i];
    const t = TYPES[id];
    const chip = document.createElement('div');
    chip.className = 'deck-chip' + (!t ? ' deck-empty' : '');
    chip.innerHTML = t ? `<b>${t.icon}</b>${t.name}` : `<b>+</b>空位`;
    selected.appendChild(chip);
  }

  const list = document.getElementById('deckList');
  list.innerHTML = '';
  for (const id of UNIT_POOL) {
    const t = TYPES[id];
    const on = meta.deck.includes(id);
    const full = meta.deck.length >= DECK_SIZE && !on;
    const card = document.createElement('div');
    card.className = 'deck-card' + (on ? ' on' : '') + (full ? ' disabled' : '');
    card.innerHTML = `
      ${on ? '<span class="tag">上阵</span>' : ''}
      <div class="icon">${t.icon}</div>
      <div class="name">${t.name}</div>
      <div class="role">${roleText(t.role)} · ${t.rarity}</div>
      <div class="desc">${t.desc}</div>`;
    card.addEventListener('click', () => {
      if (on) meta.deck = meta.deck.filter(x => x !== id);
      else if (meta.deck.length < DECK_SIZE) meta.deck.push(id);
      else return;
      if (meta.deck.length === 0) meta.deck = DEFAULT_DECK.slice(0, 1);
      saveMeta();
      renderDeckPanel();
      refreshDeckPreview();
    });
    list.appendChild(card);
  }
}

function refreshDeckPreview() {
  meta.deck = normalizeDeck(meta.deck);
  const el = document.getElementById('menuDeck');
  if (el) el.innerHTML = meta.deck.map(id => `<span title="${TYPES[id].name}">${TYPES[id].icon}</span>`).join('');
  const stageEl = document.getElementById('menuStage');
  if (stageEl) stageEl.textContent = meta.highestLevel || 1;
}