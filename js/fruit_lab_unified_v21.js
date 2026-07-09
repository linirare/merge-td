/* ============================================================
   水果突击 · Fruit Lab Unified v21
   合并“水果编队”和“水果科技树”：一个入口完成上阵/下阵、T级查看、Lv1~7成长、技能信息、攻击/耐久科技升级。
   Loaded after gameplay_readability_v20.js.
   ============================================================ */

(function installFruitLabUnifiedV21() {
  ensureFruitLabPanelV21();
  bindFruitLabEntryV21();
})();

const FRUIT_LAB_BUILD = 'fruit-lab-unified-v21';

function labUnlockedV21() {
  if (typeof unlockedListV20 === 'function') return unlockedListV20();
  if (typeof progressUnlocked === 'function') return progressUnlocked(meta);
  return UNIT_POOL.slice();
}
function labSanitizeDeckV21(deck, allowEmpty = false) {
  if (typeof sanitizeDeckLooseV20 === 'function') return sanitizeDeckLooseV20(deck, allowEmpty);
  const unlocked = labUnlockedV21();
  const result = [];
  for (const raw of (deck || [])) {
    const id = normalizeTypeId(raw);
    if (TYPES[id] && unlocked.includes(id) && !result.includes(id)) result.push(id);
  }
  if (!allowEmpty && result.length === 0) result.push(DEFAULT_DECK[0]);
  return result.slice(0, DECK_SIZE);
}
function labTierV21(id) {
  const map = (typeof FRUIT_TIER_V20 !== 'undefined') ? FRUIT_TIER_V20 : null;
  return map?.[id] || (TYPES[id]?.rarity === 'epic' ? 'T3' : TYPES[id]?.rarity === 'rare' ? 'T2' : 'T1');
}
function labSkillV21(id) {
  const map = (typeof SKILL_INFO_V20 !== 'undefined') ? SKILL_INFO_V20 : null;
  return map?.[id] || { name:'基础成长', unlock:'Lv4成长', grow:'Lv5~7强化' };
}
function labRoleLabelV21(role) {
  if (typeof roleLabelV20 === 'function') return roleLabelV20(role);
  return ({ tank:'前排', back:'远程', rush:'突击', front:'枪线', siege:'攻城', control:'控制', support:'辅助', merge:'合成' })[role] || role;
}
function labSkillStateV21(id) {
  return ['watermelon_guard','grape_archer','banana_raider','pineapple_lancer','orange_cannon'].includes(id) ? '技能已实装' : '技能待接入';
}
function labStatPreviewV21(t) {
  const atk1 = Math.round(t.atk * LEVEL_MUL[1]);
  const hp1 = Math.round(t.hp * LEVEL_MUL[1]);
  const atk7 = Math.round(t.atk * LEVEL_MUL[7]);
  const hp7 = Math.round(t.hp * LEVEL_MUL[7]);
  return { atk1, hp1, atk7, hp7 };
}
function labTechLvV21(id, stat) {
  return typeof getUpgradeLv === 'function' ? getUpgradeLv(meta, id, stat) : (meta.upgrades?.[`${id}_${stat}`] || 0);
}
function labUpgradeKeyV21(id, stat) {
  return typeof upgradeKey === 'function' ? upgradeKey(id, stat) : `${id}_${stat}`;
}
function labCanUpgradeV21(lv) {
  const cost = upgradeCost(lv + 1);
  return meta.gold >= cost && lv < UPGRADE_MAX;
}
function labDoUpgradeV21(id, stat) {
  const lv = labTechLvV21(id, stat);
  if (lv >= UPGRADE_MAX) return;
  const cost = upgradeCost(lv + 1);
  if (meta.gold < cost) return;
  const key = labUpgradeKeyV21(id, stat);
  meta.upgrades[key] = (meta.upgrades[key] || 0) + 1;
  meta.gold -= cost;
  saveMeta();
  refreshGold();
  renderFruitLabV21();
}
function labDoGlobalUpgradeV21(kind) {
  const lv = kind === 'wall' ? (meta.wallLv || 0) : (meta.spLv || 0);
  const max = kind === 'wall' ? WALL_UPGRADE_MAX : SP_UPGRADE_MAX;
  if (lv >= max) return;
  const cost = upgradeCost(lv + 1);
  if (meta.gold < cost) return;
  if (kind === 'wall') meta.wallLv = lv + 1;
  else meta.spLv = lv + 1;
  meta.gold -= cost;
  saveMeta();
  refreshGold();
  renderFruitLabV21();
}
function labToggleDeckV21(id) {
  const unlocked = labUnlockedV21();
  if (!unlocked.includes(id)) return;
  meta.deck = labSanitizeDeckV21(meta.deck || DEFAULT_DECK, true);
  if (meta.deck.includes(id)) {
    meta.deck = meta.deck.filter(x => x !== id);
  } else {
    if (meta.deck.length >= DECK_SIZE) return;
    meta.deck.push(id);
  }
  saveMeta();
  refreshGold();
  renderFruitLabV21();
}
function labLevelPathHtmlV21(id) {
  const implemented = labSkillStateV21(id).includes('已实装');
  return `<div class="lab-lvpath-v21"><span>1 数值</span><span>2 数值</span><span>3 体型</span><span class="skill ${implemented ? 'on' : ''}">4 技能</span><span>5 强化</span><span>6 克制</span><span>7 质变</span></div>`;
}
function ensureFruitLabPanelV21() {
  if (document.getElementById('fruitLabPanel')) return;
  const panel = document.createElement('div');
  panel.id = 'fruitLabPanel';
  panel.className = 'panel hide';
  panel.innerHTML = `
    <div class="panel-inner wide tech-panel fruit-lab-inner-v21">
      <div class="fruit-lab-head-v21">
        <div><h2>🍉 水果养成</h2><p class="sub">编队、T级、成长、技能、科技统一管理</p></div>
        <div class="fruit-lab-gold-v21">🍋 <b id="fruitLabGold">0</b></div>
      </div>
      <div class="fruit-lab-selected-v21"><div class="lab-mini-title-v21">当前上阵</div><div id="fruitLabSelected" class="deck-selected"></div></div>
      <div id="fruitLabGlobalTech" class="fruit-lab-global-v21"></div>
      <div id="fruitLabList" class="fruit-lab-list-v21"></div>
      <button id="btnFruitLabClose" class="btn-secondary">保存并返回</button>
    </div>`;
  document.body.appendChild(panel);

  const style = document.createElement('style');
  style.textContent = `
    .fruit-lab-inner-v21{max-height:92vh;overflow:hidden}.fruit-lab-head-v21{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px}.fruit-lab-head-v21 h2{margin-bottom:2px}.fruit-lab-gold-v21{font-size:13px;font-weight:900;color:#36551e;background:rgba(255,255,255,.64);border:1px solid rgba(83,201,106,.18);border-radius:999px;padding:7px 10px;white-space:nowrap}.fruit-lab-selected-v21{width:100%;margin-top:6px}.lab-mini-title-v21{font-size:11px;font-weight:900;color:#5c7a35;margin:0 0 4px 4px;text-align:left}.fruit-lab-global-v21{width:100%;display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:8px 0}.global-tech-card-v21{background:rgba(255,255,255,.60);border:1px solid rgba(83,201,106,.16);border-radius:14px;padding:8px;display:flex;align-items:center;justify-content:space-between;gap:7px}.global-tech-card-v21 b{font-size:12px;color:#244b21}.global-tech-card-v21 small{display:block;font-size:9px;color:#73904e;margin-top:2px}.fruit-lab-list-v21{width:100%;max-height:475px;overflow-y:auto;display:grid;grid-template-columns:1fr;gap:8px;padding:2px}.fruit-lab-card-v21{position:relative;background:rgba(255,255,255,.64);border:1px solid rgba(83,201,106,.15);border-radius:16px;padding:9px;box-shadow:0 5px 12px rgba(45,126,66,.08)}.fruit-lab-card-v21.on{border:2px solid #53c96a;background:rgba(232,255,205,.88)}.fruit-lab-card-v21.locked{opacity:.55}.lab-card-top-v21{display:grid;grid-template-columns:30px 36px 1fr auto;gap:8px;align-items:center}.lab-tier-v21{height:24px;border-radius:8px;background:#263b19;color:#fff7b0;font-weight:900;font-size:12px;display:flex;align-items:center;justify-content:center}.lab-icon-v21{font-size:28px;line-height:1}.lab-name-v21{font-size:13px;font-weight:900;color:#244b21}.lab-role-v21{font-size:10px;color:#2c8d3f;margin-top:2px}.lab-status-v21{font-size:9px;border-radius:999px;background:#ffc93c;color:#795000;font-weight:900;padding:3px 6px;white-space:nowrap}.lab-info-grid-v21{display:grid;grid-template-columns:1fr 1fr 1.25fr;gap:4px;margin:7px 0}.lab-info-grid-v21 span{font-size:10px;color:#31551f;background:rgba(255,255,255,.62);border:1px solid rgba(90,130,54,.16);border-radius:7px;padding:4px;text-align:center}.lab-lvpath-v21{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin:6px 0}.lab-lvpath-v21 span{font-size:8px;background:#e8f6c2;color:#5a7831;border-radius:5px;padding:2px 1px;text-align:center}.lab-lvpath-v21 .skill{background:#d6dfb6}.lab-lvpath-v21 .skill.on{background:#ffe37a;color:#684200;font-weight:900}.lab-skill-v21{background:rgba(255,244,184,.72);border:1px solid rgba(255,192,58,.35);border-radius:10px;padding:6px 8px;margin:6px 0;text-align:left}.lab-skill-v21 b{font-size:11px;color:#4b3b13}.lab-skill-v21 span{display:block;font-size:10px;color:#74551c;margin-top:2px}.lab-skill-v21 em{display:block;font-style:normal;font-size:9px;color:#8c6b24;margin-top:2px}.lab-actions-v21{display:grid;grid-template-columns:82px 1fr 1fr;gap:6px;align-items:stretch}.lab-btn-v21{border:0;border-radius:10px;font-size:11px;font-weight:900;padding:7px 5px;background:#53c96a;color:white;box-shadow:0 3px 0 rgba(35,95,41,.20)}.lab-btn-v21.off{background:#ff6078}.lab-btn-v21.lock{background:#9ab678}.lab-tech-v21{border-radius:10px;background:rgba(255,255,255,.60);border:1px solid rgba(83,201,106,.14);padding:6px;text-align:left}.lab-tech-v21 b{font-size:10px;color:#31551f}.lab-tech-v21 small{font-size:9px;color:#6f9251;display:block}.lab-tech-v21 button,.global-tech-card-v21 button{margin-top:4px;border:0;border-radius:8px;background:#ffc93c;color:#795000;font-weight:900;font-size:10px;padding:4px 7px}.lab-tech-v21 button:disabled,.global-tech-card-v21 button:disabled{opacity:.55;background:#c6d5ad;color:#657a4a}.deck-chip.removeable{position:relative;cursor:pointer}.deck-chip.removeable:after{content:'×';position:absolute;right:4px;top:2px;background:#ff6078;color:white;width:15px;height:15px;border-radius:50%;font-size:11px;line-height:15px}`;
  document.head.appendChild(style);

  document.getElementById('btnFruitLabClose').addEventListener('click', () => {
    meta.deck = labSanitizeDeckV21(meta.deck || DEFAULT_DECK, false);
    saveMeta();
    refreshGold();
    document.getElementById('fruitLabPanel').classList.add('hide');
  });
}
function renderFruitLabSelectedV21() {
  const selected = document.getElementById('fruitLabSelected');
  selected.innerHTML = '';
  meta.deck = labSanitizeDeckV21(meta.deck || DEFAULT_DECK, true);
  for (let i = 0; i < DECK_SIZE; i++) {
    const id = meta.deck[i];
    const t = TYPES[id];
    const chip = document.createElement('div');
    chip.className = 'deck-chip' + (!t ? ' deck-empty' : ' removeable');
    chip.innerHTML = t ? `<b>${t.icon}</b>${t.name}` : `<b>+</b>空位`;
    if (t) chip.addEventListener('click', () => labToggleDeckV21(id));
    selected.appendChild(chip);
  }
}
function renderFruitLabGlobalV21() {
  const wrap = document.getElementById('fruitLabGlobalTech');
  const wallLv = meta.wallLv || 0;
  const spLv = meta.spLv || 0;
  const wallCost = upgradeCost(wallLv + 1);
  const spCost = upgradeCost(spLv + 1);
  wrap.innerHTML = `
    <div class="global-tech-card-v21"><div><b>🏰 果堡加固 Lv.${wallLv}</b><small>每级 +${WALL_PER_LV} 我方果堡耐久</small></div><button ${wallLv >= WALL_UPGRADE_MAX || meta.gold < wallCost ? 'disabled' : ''} data-global="wall">${wallLv >= WALL_UPGRADE_MAX ? 'MAX' : wallCost + '🍋'}</button></div>
    <div class="global-tech-card-v21"><div><b>🍹 果汁泵 Lv.${spLv}</b><small>提升开局果汁与上限容错</small></div><button ${spLv >= SP_UPGRADE_MAX || meta.gold < spCost ? 'disabled' : ''} data-global="sp">${spLv >= SP_UPGRADE_MAX ? 'MAX' : spCost + '🍋'}</button></div>`;
  wrap.querySelectorAll('button[data-global]').forEach(btn => btn.addEventListener('click', () => labDoGlobalUpgradeV21(btn.dataset.global)));
}
function renderFruitLabCardV21(id, unlocked) {
  const t = TYPES[id];
  const on = meta.deck.includes(id);
  const locked = !unlocked.includes(id);
  const full = meta.deck.length >= DECK_SIZE && !on;
  const s = labStatPreviewV21(t);
  const skill = labSkillV21(id);
  const atkLv = labTechLvV21(id, 'atk');
  const hpLv = labTechLvV21(id, 'hp');
  const atkCost = upgradeCost(atkLv + 1);
  const hpCost = upgradeCost(hpLv + 1);
  const el = document.createElement('div');
  el.className = 'fruit-lab-card-v21' + (on ? ' on' : '') + (locked ? ' locked' : '');
  el.innerHTML = `
    <div class="lab-card-top-v21">
      <div class="lab-tier-v21">${labTierV21(id)}</div>
      <div class="lab-icon-v21">${t.icon}</div>
      <div><div class="lab-name-v21">${t.name}</div><div class="lab-role-v21">${labRoleLabelV21(t.role)} · ${t.rarity} · ${labSkillStateV21(id)}</div></div>
      <div class="lab-status-v21">${locked ? `第${unlockLevelFor(id)}关` : on ? '上阵中' : full ? '需下阵' : '可上阵'}</div>
    </div>
    <div class="lab-info-grid-v21"><span>攻 ${s.atk1}→${s.atk7}</span><span>防 ${s.hp1}→${s.hp7}</span><span>出兵 ${(SPAWN_COOLDOWNS[1]).toFixed(1)}→${(SPAWN_COOLDOWNS[7]).toFixed(1)}s</span></div>
    ${labLevelPathHtmlV21(id)}
    <div class="lab-skill-v21"><b>${skill.name}</b><span>${skill.unlock}</span><em>${skill.grow}</em></div>
    <div class="lab-actions-v21">
      <button class="lab-btn-v21 ${on ? 'off' : locked || full ? 'lock' : ''}" data-action="deck">${locked ? '未解锁' : on ? '下阵' : full ? '先下阵' : '上阵'}</button>
      <div class="lab-tech-v21"><b>攻击科技 Lv.${atkLv}</b><small>每级 +${Math.round(UPGRADE_PER_LV * 100)}% 攻击</small><button data-action="atk" ${atkLv >= UPGRADE_MAX || meta.gold < atkCost ? 'disabled' : ''}>${atkLv >= UPGRADE_MAX ? 'MAX' : atkCost + '🍋'}</button></div>
      <div class="lab-tech-v21"><b>耐久科技 Lv.${hpLv}</b><small>每级 +${Math.round(UPGRADE_PER_LV * 100)}% 生命</small><button data-action="hp" ${hpLv >= UPGRADE_MAX || meta.gold < hpCost ? 'disabled' : ''}>${hpLv >= UPGRADE_MAX ? 'MAX' : hpCost + '🍋'}</button></div>
    </div>`;
  el.querySelector('[data-action="deck"]').addEventListener('click', () => labToggleDeckV21(id));
  el.querySelector('[data-action="atk"]').addEventListener('click', () => labDoUpgradeV21(id, 'atk'));
  el.querySelector('[data-action="hp"]').addEventListener('click', () => labDoUpgradeV21(id, 'hp'));
  return el;
}
function renderFruitLabV21() {
  const unlocked = labUnlockedV21();
  meta.deck = labSanitizeDeckV21(meta.deck || DEFAULT_DECK, true);
  const gold = document.getElementById('fruitLabGold');
  if (gold) gold.textContent = meta.gold || 0;
  renderFruitLabSelectedV21();
  renderFruitLabGlobalV21();
  const list = document.getElementById('fruitLabList');
  list.innerHTML = '';
  const sorted = UNIT_POOL.slice().sort((a, b) => {
    const ao = meta.deck.includes(a) ? -1 : 0;
    const bo = meta.deck.includes(b) ? -1 : 0;
    if (ao !== bo) return ao - bo;
    const al = unlocked.includes(a) ? 0 : 1;
    const bl = unlocked.includes(b) ? 0 : 1;
    if (al !== bl) return al - bl;
    return (labTierV21(a)).localeCompare(labTierV21(b));
  });
  for (const id of sorted) list.appendChild(renderFruitLabCardV21(id, unlocked));
}
function openFruitLabV21() {
  document.getElementById('deckPanel')?.classList.add('hide');
  document.getElementById('upgradePanel')?.classList.add('hide');
  document.getElementById('fruitLabPanel').classList.remove('hide');
  renderFruitLabV21();
}
function bindFruitLabEntryV21() {
  const deckBtn = document.getElementById('btnDeck');
  const upBtn = document.getElementById('btnUpgrade');
  if (deckBtn) {
    deckBtn.textContent = '水果养成 · 编队/科技';
    deckBtn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopImmediatePropagation(); openFruitLabV21();
    }, true);
  }
  if (upBtn) {
    upBtn.style.display = 'none';
    upBtn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopImmediatePropagation(); openFruitLabV21();
    }, true);
  }
}
