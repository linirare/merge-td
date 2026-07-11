/* ============================================================
   Fruit Assault - Core Flow Smoothness v1
   Entry clarity, first-run guides, battle feedback, and result actions.
   ============================================================ */
(function installExperienceFlowV1() {
  if (window.__experienceFlowV1Installed) return;
  window.__experienceFlowV1Installed = true;

  const STORE_KEY = 'merge_td_experience_flow_v1';
  const guideCopy = {
    campaign: {
      title: '闯关快速上手',
      steps: ['点空格召唤水果营', '拖同星水果合成升级', '双击水果营急派救线'],
      seenKey: 'seenCampaignGuide',
    },
    pvp: {
      title: '本地 PVP 验证方式',
      steps: ['第一个窗口创建房间', '第二个窗口输入房间码加入', '双方点准备后进入同一局'],
      seenKey: 'seenPvpGuide',
    },
  };

  function loadFlow() {
    try {
      return Object.assign({
        seenCampaignGuide: false,
        seenPvpGuide: false,
        lastCampaignAdvice: '优先补满空位，果汁够时双击高星营救线。',
      }, JSON.parse(localStorage.getItem(STORE_KEY) || '{}'));
    } catch (err) {
      return {
        seenCampaignGuide: false,
        seenPvpGuide: false,
        lastCampaignAdvice: '优先补满空位，果汁够时双击高星营救线。',
      };
    }
  }

  let flow = loadFlow();

  function saveFlow() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(flow)); }
    catch (err) {}
  }

  function injectStyle() {
    if (document.getElementById('experienceFlowStyle')) return;
    const style = document.createElement('style');
    style.id = 'experienceFlowStyle';
    style.textContent = `
      .flow-brief { margin: 12px 0; padding: 12px; border: 1px solid rgba(255,255,255,.16); border-radius: 8px; background: rgba(12,34,30,.58); text-align: left; }
      .flow-brief h3 { margin: 0 0 8px; font-size: 15px; color: #fff6bd; }
      .flow-brief p { margin: 4px 0; font-size: 12px; line-height: 1.45; color: rgba(255,255,255,.82); }
      .flow-brief .flow-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .flow-brief .flow-deck { font-size: 20px; white-space: nowrap; }
      .flow-brief .flow-guide-btn, .flow-guide-panel .flow-guide-btn { border: 0; border-radius: 8px; padding: 7px 10px; color: #173b25; background: #ffd45a; font-weight: 800; cursor: pointer; }
      .flow-guide-panel ol { margin: 14px 0 16px; padding-left: 22px; text-align: left; }
      .flow-guide-panel li { margin: 10px 0; color: rgba(255,255,255,.9); }
      .flow-arena-note { margin-top: 10px; padding: 10px; border-radius: 8px; background: rgba(255,212,90,.1); color: rgba(255,255,255,.86); font-size: 12px; line-height: 1.45; }
      .flow-result-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 10px; }
      .flow-result-actions button { min-width: 96px; }
    `;
    document.head.appendChild(style);
  }

  function ensureGuidePanel() {
    let panel = document.getElementById('flowGuidePanel');
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'flowGuidePanel';
    panel.className = 'panel hide';
    panel.innerHTML = `
      <div class="panel-inner flow-guide-panel">
        <h2 id="flowGuideTitle"></h2>
        <ol id="flowGuideSteps"></ol>
        <button id="btnFlowGuideOk" class="flow-guide-btn">知道了</button>
      </div>
    `;
    document.body.appendChild(panel);
    document.getElementById('btnFlowGuideOk')?.addEventListener('click', () => panel.classList.add('hide'));
    return panel;
  }

  function showGuide(kind, force = false) {
    const copy = guideCopy[kind];
    if (!copy) return;
    if (!force && flow[copy.seenKey]) return;
    const panel = ensureGuidePanel();
    document.getElementById('flowGuideTitle').textContent = copy.title;
    document.getElementById('flowGuideSteps').innerHTML = copy.steps.map(s => `<li>${s}</li>`).join('');
    panel.classList.remove('hide');
    flow[copy.seenKey] = true;
    saveFlow();
  }

  function fruitEmoji(typeId) {
    const table = typeof TYPES !== 'undefined' ? TYPES : {};
    return table[typeId]?.emoji || table[typeId]?.icon || '🍏';
  }

  function deckText() {
    const fallbackDeck = typeof DEFAULT_DECK !== 'undefined' ? DEFAULT_DECK : [];
    const deckSize = typeof DECK_SIZE !== 'undefined' ? DECK_SIZE : 5;
    const deck = typeof normalizeDeck === 'function'
      ? normalizeDeck(meta?.deck || fallbackDeck)
      : (meta?.deck || fallbackDeck || []);
    return deck.slice(0, deckSize).map(fruitEmoji).join('');
  }

  function renderCampaignBrief() {
    const menu = document.querySelector('#menuPanel .menu-card');
    if (!menu) return;
    let brief = document.getElementById('campaignBrief');
    if (!brief) {
      brief = document.createElement('div');
      brief.id = 'campaignBrief';
      brief.className = 'flow-brief';
      const deck = document.getElementById('menuDeck');
      if (deck && deck.parentNode) deck.parentNode.insertBefore(brief, deck);
      else menu.appendChild(brief);
      brief.addEventListener('click', event => {
        if (event.target && event.target.id === 'btnCampaignGuide') showGuide('campaign', true);
      });
    }
    const level = Math.max(1, meta?.highestLevel || 1);
    brief.innerHTML = `
      <div class="flow-row">
        <h3>推荐关卡：第 ${level} 关</h3>
        <button id="btnCampaignGuide" class="flow-guide-btn">玩法引导</button>
      </div>
      <p>上阵卡组 <span class="flow-deck">${deckText()}</span></p>
      <p>最近建议：${flow.lastCampaignAdvice || '先铺满空位，再用合成提高主力等级。'}</p>
    `;
  }

  function renderArenaClarity() {
    const arena = document.getElementById('arenaPanel');
    if (!arena) return;
    const title = arena.querySelector('h2');
    const subtitle = arena.querySelector('.sub');
    if (title) title.textContent = '竞技';
    if (subtitle) subtitle.textContent = '实时房间对战 / 无尽天梯';
    const status = document.getElementById('pvpStatus');
    if (status) {
      const s = window.pvpClient?.getStatus?.();
      const seat = s?.playerIndex >= 0 ? `P${s.playerIndex + 1}` : '未入座';
      status.textContent = `${s?.status || '未连接'} · ${seat}${s?.roomId ? ' · 房间 ' + s.roomId : ''}`;
    }
    let note = document.getElementById('flowPvpNote');
    const card = arena.querySelector('.arena-card');
    if (!note && card) {
      note = document.createElement('div');
      note.id = 'flowPvpNote';
      note.className = 'flow-arena-note';
      card.appendChild(note);
      note.addEventListener('click', event => {
        if (event.target && event.target.id === 'btnPvpGuide') showGuide('pvp', true);
      });
    }
    if (note) {
      note.innerHTML = `本地验证：开两个窗口，一个创建房间，另一个输入房间码加入。<br><button id="btnPvpGuide" class="flow-guide-btn" style="margin-top:8px;">查看步骤</button>`;
    }
    showGuide('pvp');
  }

  function renderShopAsSupply() {
    const shop = document.getElementById('shopPanel');
    if (!shop) return;
    const title = shop.querySelector('h2');
    const subtitle = shop.querySelector('.sub');
    if (title) title.textContent = '资源补给';
    if (subtitle) subtitle.textContent = '每日补给 / 碎片补强 / 成长资源';
    const gacha = document.getElementById('shopTabGacha');
    const pack = document.getElementById('shopTabPack');
    if (gacha) gacha.textContent = '碎片补强';
    if (pack) pack.textContent = '每日补给';
  }

  function cleanMenuMode(tab) {
    if (!state || state.phase !== 'menu') return;
    if (tab === 'battle') {
      state.mode = 'pve';
      state.endless = false;
      state.pvpRoomId = '';
    } else if (tab === 'arena' || tab === 'upgrade' || tab === 'shop') {
      if (state.mode === 'pvp') state.mode = 'pve';
      if (tab !== 'arena') state.endless = false;
    }
  }

  function wrapTabs() {
    if (typeof window.productShellShowTab !== 'function' || window.productShellShowTab._flowV1) return false;
    const oldShowTab = window.productShellShowTab;
    window.productShellShowTab = function flowShowTab(tab) {
      const nextTab = tab || 'battle';
      cleanMenuMode(nextTab);
      const result = oldShowTab(nextTab);
      renderCampaignBrief();
      if (nextTab === 'battle') showGuide('campaign');
      if (nextTab === 'arena') renderArenaClarity();
      if (nextTab === 'shop') renderShopAsSupply();
      return result;
    };
    window.productShellShowTab._flowV1 = true;
    return true;
  }

  function ensureGoLabButton(panel) {
    if (!panel || document.getElementById('btnResultGoLab')) return;
    const btn = document.createElement('button');
    btn.id = 'btnResultGoLab';
    btn.className = 'btn-secondary';
    btn.textContent = '去养成';
    btn.addEventListener('click', () => {
      panel.classList.add('hide');
      state.phase = 'menu';
      state.mode = 'pve';
      state.endless = false;
      window.productShellShowTab?.('upgrade');
    });
    document.getElementById('btnMenu')?.insertAdjacentElement('afterend', btn);
  }

  function enhancePveResult(win) {
    const panel = document.getElementById('resultPanel');
    const detail = document.getElementById('resultDetail');
    const retry = document.getElementById('btnRetry');
    const next = document.getElementById('btnNext');
    const menu = document.getElementById('btnMenu');
    if (!panel || !detail || !retry || !menu) return;
    ensureGoLabButton(panel);
    retry.textContent = win ? '重试本关' : '重试';
    menu.textContent = '回到闯关';
    if (next && win) next.textContent = '下一关';
    const breach = Number.isFinite(state.breachLane) && state.breachLane >= 0 ? `第 ${state.breachLane + 1} 路` : '压力最高路线';
    const advice = win
      ? `下一步：继续第 ${state.currentLevel + 1} 关，或去养成补强主力水果。`
      : `失败路线：${breach}。建议：补满空位，优先合成主力；果汁够时双击高星营急派。`;
    if (!detail.innerHTML.includes('下一步：') && !detail.innerHTML.includes('失败路线：')) {
      detail.innerHTML += `<br><br>${advice}`;
    }
    if (!win) {
      flow.lastCampaignAdvice = '上一局被突破后，先补满空位，再双击高星营急派救线。';
      saveFlow();
    }
  }

  function wrapGameOver() {
    if (typeof onGameOver !== 'function' || onGameOver._flowV1) return false;
    const oldGameOver = onGameOver;
    onGameOver = function flowGameOver(win) {
      const wasPvp = state?.mode === 'pvp';
      const wasEndless = !!state?.endless;
      const result = oldGameOver(win);
      if (!wasPvp && !wasEndless) enhancePveResult(win);
      return result;
    };
    onGameOver._flowV1 = true;
    return true;
  }

  function afterTabShown(tab) {
    renderCampaignBrief();
    if (tab === 'battle') showGuide('campaign');
    if (tab === 'arena') renderArenaClarity();
    if (tab === 'shop') renderShopAsSupply();
  }

  function installNavObserver() {
    if (document._flowNavObserver) return;
    document._flowNavObserver = true;
    document.addEventListener('click', event => {
      const btn = event.target?.closest?.('.bnav-tab');
      if (!btn) return;
      const tab = btn.dataset.tab || 'battle';
      cleanMenuMode(tab);
      setTimeout(() => afterTabShown(tab), 0);
    });
  }

  function actionLabel(action) {
    return ({ merge: '合成', swap: '交换', move: '移动', copy: '复制' })[action] || '';
  }

  function drawRoundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawPvpStatusStrip() {
    if (state?.mode !== 'pvp' || state.phase === 'menu') return;
    const s = window.pvpClient?.getStatus?.() || {};
    const seat = Number.isFinite(s.playerIndex) && s.playerIndex >= 0 ? `P${s.playerIndex + 1}` : 'P?';
    const offline = String(s.status || '').includes('离线') || state.phase === 'paused';
    const text = `房间 ${state.pvpRoomId || s.roomId || '-'} · ${seat} · ${offline ? '对手离线' : '同步正常'}`;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = offline ? 'rgba(94, 28, 34, .88)' : 'rgba(20, 48, 42, .88)';
    drawRoundRect(76, 78, W - 152, 28, 8);
    ctx.fill();
    ctx.fillStyle = offline ? '#ffd1d6' : '#dfffea';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, W / 2, 92);
    ctx.restore();
  }

  function drawSummonHints() {}

  function drawDragAction() {
    const d = state?.drag;
    if (!d || !d.moved) return;
    const label = actionLabel(d.snapAction);
    if (!label) return;
    ctx.save();
    ctx.font = 'bold 14px sans-serif';
    const w = ctx.measureText(label).width + 22;
    const x = Math.max(12, Math.min(W - w - 12, d.x + 14));
    const y = Math.max(54, d.y - 30);
    ctx.fillStyle = 'rgba(21, 38, 34, .92)';
    drawRoundRect(x, y, w, 26, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd45a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + 13);
    ctx.restore();
  }

  function drawJuiceLackHint() {
    if (!state || state._juicePulseKind !== 'lack' || !state._juicePulse) return;
    ctx.save();
    const alpha = Math.min(0.85, Math.max(0.18, state._juicePulse));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(255, 88, 97, .22)';
    drawRoundRect(18, (LAYOUT.operationY || 570) - 38, W - 36, 34, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd1d6';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('果汁不足', W / 2, (LAYOUT.operationY || 570) - 18);
    ctx.restore();
  }

  function wrapDraw() {
    if (typeof draw !== 'function' || draw._flowV1) return false;
    const oldDraw = draw;
    draw = function flowDraw() {
      oldDraw();
      drawSummonHints();
      drawDragAction();
      drawJuiceLackHint();
      drawPvpStatusStrip();
    };
    draw._flowV1 = true;
    return true;
  }

  function init() {
    injectStyle();
    ensureGuidePanel();
    wrapTabs();
    wrapGameOver();
    wrapDraw();
    installNavObserver();
    renderCampaignBrief();
    renderShopAsSupply();
    if (state?.phase === 'menu') showGuide('campaign');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
