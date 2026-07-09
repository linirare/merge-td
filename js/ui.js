/* ============================================================
   合成塔防 · PvE —— DOM 界面管理
   ============================================================ */

/* ——— 升级项配置 ——— */
const UPGRADE_ITEMS = [
  { key: 'bow_atk',   label: '🏹 弓攻击',   type: 'bow',   stat: 'atk', maxLv: UPGRADE_MAX, wall: false },
  { key: 'bow_hp',    label: '🏹 弓血量',   type: 'bow',   stat: 'hp',  maxLv: UPGRADE_MAX, wall: false },
  { key: 'sword_atk', label: '🗡️ 刀攻击',  type: 'sword', stat: 'atk', maxLv: UPGRADE_MAX, wall: false },
  { key: 'sword_hp',  label: '🗡️ 刀血量',  type: 'sword', stat: 'hp',  maxLv: UPGRADE_MAX, wall: false },
  { key: 'spear_atk', label: '🔱 枪攻击',  type: 'spear', stat: 'atk', maxLv: UPGRADE_MAX, wall: false },
  { key: 'spear_hp',  label: '🔱 枪血量',  type: 'spear', stat: 'hp',  maxLv: UPGRADE_MAX, wall: false },
  { key: 'shield_atk',label: '🛡️ 盾攻击', type: 'shield',stat: 'atk', maxLv: UPGRADE_MAX, wall: false },
  { key: 'shield_hp', label: '🛡️ 盾血量', type: 'shield',stat: 'hp',  maxLv: UPGRADE_MAX, wall: false },
  { key: 'wall',       label: '🏰 城墙HP',   type: null,    stat: null, maxLv: WALL_UPGRADE_MAX, wall: true },
];

/* ——— 渲染升级列表 ——— */
function renderUpgrades() {
  const list = document.getElementById('upgradeList');
  const goldSpan = document.getElementById('upGold');
  goldSpan.textContent = meta.gold;

  list.innerHTML = '';
  for (const item of UPGRADE_ITEMS) {
    const el = document.createElement('div');
    el.className = 'upgrade-item';

    let lv, cost, maxed;
    if (item.wall) {
      lv = meta.wallLv;
      maxed = lv >= item.maxLv;
      cost = upgradeCost(lv + 1);
    } else {
      lv = getUpgradeLv(meta, item.type, item.stat);
      maxed = lv >= item.maxLv;
      cost = upgradeCost(lv + 1);
    }

    const canAfford = meta.gold >= cost && !maxed;
    el.className = 'upgrade-item' + (canAfford ? '' : ' disabled');
    el.innerHTML = `
      <span class="uilabel">${item.label} <span class="uilevel">Lv.${lv}</span></span>
      <span class="uicost ${maxed ? 'maxed' : canAfford ? 'can-afford' : ''}">${maxed ? 'MAX' : cost + '💰'}</span>
    `;

    if (canAfford) {
      el.addEventListener('click', () => {
        if (item.wall) {
          meta.wallLv++;
          meta.gold -= cost;
        } else {
          const key = upgradeKey(item.type, item.stat);
          meta.upgrades[key] = (meta.upgrades[key] || 0) + 1;
          meta.gold -= cost;
        }
        saveMeta();
        renderUpgrades();
        refreshGold();
      });
    }

    list.appendChild(el);
  }
}

/* ——— 溢出队列弹窗 ——— */
function showOverflowPopup() {
  const popup = document.getElementById('overflowPopup');
  const list = document.getElementById('overflowList');
  list.innerHTML = '';

  if (state.overflowQueue.length === 0) {
    list.innerHTML = '<p style="color:#8a7a5a;font-size:13px;">队列为空</p>';
  } else {
    for (let i = 0; i < state.overflowQueue.length; i++) {
      const item = state.overflowQueue[i];
      const t = TYPES[item.type];
      const el = document.createElement('div');
      el.style.cssText = `
        display:flex;align-items:center;gap:4px;padding:6px 10px;
        background:rgba(255,255,255,0.06);border-radius:8px;cursor:pointer;
        color:#e8dcc0;font-size:13px;
      `;
      el.innerHTML = `${t.icon} Lv.${item.level}`;
      el.title = '点击后选择棋盘空格放置';
      el.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        document.getElementById('overflowPopup').classList.add('hide');
        state.pendingPlace = { type: item.type, level: item.level, queueIndex: i };
      });
      el.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        document.getElementById('overflowPopup').classList.add('hide');
        state.pendingPlace = { type: item.type, level: item.level, queueIndex: i };
      });
      list.appendChild(el);
    }
  }
  popup.classList.remove('hide');
}

document.getElementById('btnOverflowClose').addEventListener('click', () => {
  document.getElementById('overflowPopup').classList.add('hide');
});

/* ——— 保存/读取 meta ——— */
const META_KEY = 'merge_td_meta_v1';

function saveMeta() {
  try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) {}
}

function loadMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      meta.gold = saved.gold || 0;
      meta.upgrades = saved.upgrades || {};
      meta.wallLv = saved.wallLv || 0;
      meta.highestLevel = Math.max(1, saved.highestLevel || 1);
      meta.totalWins = saved.totalWins || 0;
      meta.stars = saved.stars || {};
    }
  } catch (e) {}
  refreshGold();
}

/* ——— 刷新金币显示 ——— */
function refreshGold() {
  const g = meta.gold || 0;
  const menuEl = document.getElementById('menuGold');
  if (menuEl) menuEl.textContent = g;
  const upEl = document.getElementById('upGold');
  if (upEl) upEl.textContent = g;
}

/* ——— 按钮事件绑定 ——— */
document.addEventListener('DOMContentLoaded', () => {
  loadMeta();

  document.getElementById('btnStart').addEventListener('click', () => {
    document.getElementById('menuPanel').classList.add('hide');
    initLevel(meta.highestLevel || 1);
  });

  document.getElementById('btnUpgrade').addEventListener('click', () => {
    refreshGold();
    document.getElementById('upgradePanel').classList.remove('hide');
    renderUpgrades();
  });

  document.getElementById('btnUpClose').addEventListener('click', () => {
    document.getElementById('upgradePanel').classList.add('hide');
  });

  document.getElementById('btnHelpClose').addEventListener('click', () => {
    document.getElementById('helpPanel').classList.add('hide');
  });

  document.getElementById('btnRetry').addEventListener('click', () => {
    document.getElementById('resultPanel').classList.add('hide');
    initLevel(state.currentLevel);
  });

  document.getElementById('btnMenu').addEventListener('click', () => {
    document.getElementById('resultPanel').classList.add('hide');
    document.getElementById('menuPanel').classList.remove('hide');
    state.phase = 'menu';
  });

  document.getElementById('btnNext').addEventListener('click', () => {
    document.getElementById('resultPanel').classList.add('hide');
    initLevel(state.currentLevel + 1);
  });

  // 重置数据（长按确认）
  const resetBtn = document.getElementById('btnReset');
  let resetTimer = null;
  resetBtn.addEventListener('mousedown', () => {
    resetTimer = setTimeout(() => {
      localStorage.removeItem(META_KEY);
      location.reload();
    }, 1500);
    resetBtn.textContent = '松手取消...';
  });
  resetBtn.addEventListener('mouseup', () => {
    clearTimeout(resetTimer);
    resetBtn.textContent = '重置数据';
  });
  resetBtn.addEventListener('mouseleave', () => {
    clearTimeout(resetTimer);
    resetBtn.textContent = '重置数据';
  });
  resetBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    resetTimer = setTimeout(() => {
      localStorage.removeItem(META_KEY);
      location.reload();
    }, 1500);
    resetBtn.textContent = '松手取消...';
  });
  resetBtn.addEventListener('touchend', () => {
    clearTimeout(resetTimer);
    resetBtn.textContent = '重置数据';
  });
});
