/* ============================================================
   Fruit Assault - Non-invasive flow helpers v65
   Keeps battle/result helpers only. Product pages are owned by product_shell.js.
   ============================================================ */
(function installExperienceFlowV65() {
  if (window.__experienceFlowV65Installed) return;
  window.__experienceFlowV65Installed = true;

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

  function drawDragAction() {
    const drag = state?.drag;
    if (!drag || !drag.moved) return;
    const label = actionLabel(drag.snapAction);
    if (!label) return;
    ctx.save();
    ctx.font = 'bold 14px sans-serif';
    const width = ctx.measureText(label).width + 22;
    const x = Math.max(12, Math.min(W - width - 12, drag.x + 14));
    const y = Math.max(54, drag.y - 30);
    ctx.fillStyle = 'rgba(21, 38, 34, .92)';
    drawRoundRect(x, y, width, 26, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd45a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + width / 2, y + 13);
    ctx.restore();
  }

  function drawJuiceLackHint() {
    if (!state || state._juicePulseKind !== 'lack' || !state._juicePulse) return;
    const y = (LAYOUT.operationY || 570) - 38;
    ctx.save();
    ctx.globalAlpha = Math.min(0.85, Math.max(0.18, state._juicePulse));
    ctx.fillStyle = 'rgba(255, 88, 97, .22)';
    drawRoundRect(18, y, W - 36, 34, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd1d6';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('果汁不足', W / 2, y + 17);
    ctx.restore();
  }

  function drawPvpStatusStrip() {
    if (state?.mode !== 'pvp' || state.phase === 'menu') return;
    const status = window.pvpClient?.getStatus?.() || {};
    const seat = Number.isFinite(status.playerIndex) && status.playerIndex >= 0 ? `P${status.playerIndex + 1}` : 'P?';
    const offline = String(status.status || '').includes('离线') || state.phase === 'paused';
    const text = `房间 ${state.pvpRoomId || status.roomId || '-'} · ${seat} · ${offline ? '对手离线' : '同步正常'}`;
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

  function wrapDraw() {
    if (typeof draw !== 'function' || draw._flowV65) return false;
    const oldDraw = draw;
    draw = function flowDrawV65() {
      oldDraw();
      drawDragAction();
      drawJuiceLackHint();
      drawPvpStatusStrip();
    };
    draw._flowV65 = true;
    return true;
  }

  function init() {
    wrapDraw();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
