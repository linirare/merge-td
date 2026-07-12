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
    .deck-selected{width:100%;display:flex;gap:6px;justify-content:center;flex-wrap:wrap;padding:8px;border-radius:16px;background:rgba(0,0,0,.2);border:1px solid rgba(245,194,66,.18)}
    .deck-chip{min-width:54px;text-align:center;padding:8px 10px;border-radius:12px;background:rgba(255,255,255,.08);border:1.5px solid rgba(255,255,255,.12);font-size:11px;color:#C9B48A;font-weight:700}
    .deck-chip b{font-size:26px;display:block;line-height:1.2;margin-bottom:1px}.deck-empty{color:#8B7355;border-style:dashed}
    .deck-list{width:100%;max-height:430px;overflow-y:auto;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:2px}
    .deck-card{padding:10px;border-radius:14px;background:rgba(255,255,255,.06);border:1.5px solid rgba(255,255,255,.10);cursor:pointer;min-height:90px;position:relative;box-shadow:0 4px 10px rgba(0,0,0,.25);transition:transform .12s,border-color .12s}
    .deck-card:hover{transform:translateY(-2px)}
    .deck-card.on{border:2px solid #F5C242;box-shadow:0 0 12px rgba(245,194,66,.3)}.deck-card.disabled{opacity:.45;cursor:default;pointer-events:none}.deck-card .icon{font-size:36px;line-height:1.1;margin-bottom:2px}.deck-card .name{font-size:13px;font-weight:900;color:#F3E3C0}.deck-card .role{font-size:10px;color:#B99A6E;margin-top:2px}.deck-card .desc{font-size:9px;color:#8B7355;line-height:1.35;margin-top:4px}.deck-card .tag{position:absolute;right:7px;top:7px;font-size:9px;background:#F5C242;color:#3A1E08;border-radius:99px;padding:2px 7px;font-weight:900}
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
var RARITY_TIER = { normal:'common', rare:'rare', epic:'epic' };
var RARITY_BG = { common:'linear-gradient(160deg,rgba(180,220,180,.35),rgba(140,200,160,.22))', rare:'linear-gradient(160deg,rgba(140,180,240,.35),rgba(100,160,220,.22))', epic:'linear-gradient(160deg,rgba(200,160,240,.40),rgba(160,120,220,.25))' };
var RARITY_COLOR = { common:'#7db87d', rare:'#5b9fe0', epic:'#a05be0' };

function renderDeckPanel() {
  meta.deck = normalizeDeck(meta.deck);
  var selected = document.getElementById('deckSelected');
  selected.innerHTML = '';
  for (var i = 0; i < DECK_SIZE; i++) {
    var id = meta.deck[i];
    var t = TYPES[id];
    var chip = document.createElement('div');
    chip.className = 'deck-chip' + (!t ? ' deck-empty' : '');
    if (t) {
      var tier = RARITY_TIER[t.rarity] || 'common';
      chip.style.background = RARITY_BG[tier];
      chip.style.borderColor = RARITY_COLOR[tier];
      chip.innerHTML = '<b>' + t.icon + '</b>' + t.name;
    } else {
      chip.innerHTML = '<b>+</b>空位';
    }
    selected.appendChild(chip);
  }

  var list = document.getElementById('deckList');
  list.innerHTML = '';
  for (var j = 0; j < UNIT_POOL.length; j++) {
    var id2 = UNIT_POOL[j];
    var t2 = TYPES[id2];
    var on = meta.deck.includes(id2);
    var full = meta.deck.length >= DECK_SIZE && !on;
    var tier2 = RARITY_TIER[t2.rarity] || 'common';
    var card = document.createElement('div');
    card.className = 'deck-card' + (on ? ' on' : '') + (full ? ' disabled' : '');
    card.style.background = RARITY_BG[tier2];
    card.style.borderColor = on ? '#53c96a' : RARITY_COLOR[tier2];
    card.innerHTML =
      (on ? '<span class="tag">上阵</span>' : '') +
      '<div class="icon" style="font-size:36px;line-height:1.1;margin-bottom:2px">' + t2.icon + '</div>' +
      '<div class="name">' + t2.name + '</div>' +
      '<div class="role">' + roleText(t2.role) + ' · <span style="color:' + RARITY_COLOR[tier2] + ';font-weight:900">' + t2.rarity + '</span></div>' +
      '<div class="desc">' + t2.desc + '</div>';
    card.addEventListener('click', (function(id2, on) {
      return function() {
        if (on) meta.deck = meta.deck.filter(function(x) { return x !== id2; });
        else if (meta.deck.length < DECK_SIZE) meta.deck.push(id2);
        else return;
        if (meta.deck.length === 0) meta.deck = DEFAULT_DECK.slice(0, 1);
        saveMeta();
        renderDeckPanel();
        refreshDeckPreview();
      };
    })(id2, on));
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