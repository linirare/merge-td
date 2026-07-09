/* ============================================================
   合成塔防 · PvE —— 音效系统 (Web Audio API)
   ============================================================ */

let audioCtx = null;

function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

/* ——— 工具函数 ——— */
function gain(ctx, val) {
  const g = ctx.createGain();
  g.gain.value = val;
  return g;
}

/* ——— 合成音效：上升和弦 ——— */
function sfxMerge() {
  const ctx = ensureAudio();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.linearRampToValueAtTime(600, now + 0.12);
  const g = gain(ctx, 0.15);
  g.gain.linearRampToValueAtTime(0, now + 0.2);
  osc.connect(g).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.2);
}

/* ——— 攻击命中：短促敲击 ——— */
function sfxHit() {
  const ctx = ensureAudio();
  const now = ctx.currentTime;
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = gain(ctx, 0.08);
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 800;
  src.connect(filter).connect(g).connect(ctx.destination);
  src.start(now);
}

/* ——— 弓兵射箭：拉弦 ——— */
function sfxArrow() {
  const ctx = ensureAudio();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.linearRampToValueAtTime(200, now + 0.08);
  const g = gain(ctx, 0.06);
  g.gain.linearRampToValueAtTime(0, now + 0.1);
  osc.connect(g).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.12);
}

/* ——— 城墙倒塌：低频轰鸣 ——— */
function sfxWallBreak() {
  const ctx = ensureAudio();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(80, now);
  osc.frequency.linearRampToValueAtTime(50, now + 0.4);
  const g = gain(ctx, 0.1);
  g.gain.linearRampToValueAtTime(0, now + 0.5);
  osc.connect(g).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.5);
}

/* ——— 胜利号角 ——— */
function sfxWin() {
  const ctx = ensureAudio();
  const now = ctx.currentTime;
  const notes = [523, 659, 784]; // C5 E5 G5
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const g = gain(ctx, 0.12);
    g.gain.setValueAtTime(0, now + i * 0.15);
    g.gain.linearRampToValueAtTime(0.12, now + i * 0.15 + 0.05);
    g.gain.linearRampToValueAtTime(0, now + i * 0.15 + 0.3);
    osc.connect(g).connect(ctx.destination);
    osc.start(now + i * 0.15);
    osc.stop(now + i * 0.15 + 0.35);
  });
}

/* ——— 战败：低沉嗡 ——— */
function sfxLose() {
  const ctx = ensureAudio();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.linearRampToValueAtTime(60, now + 0.8);
  const g = gain(ctx, 0.1);
  g.gain.linearRampToValueAtTime(0, now + 1.0);
  osc.connect(g).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 1.0);
}

/* ——— 统一触发：监听 state 变化 ——— */
function playSfx(name) {
  switch (name) {
    case 'merge': sfxMerge(); break;
    case 'hit': sfxHit(); break;
    case 'arrow': sfxArrow(); break;
    case 'wall': sfxWallBreak(); break;
    case 'win': sfxWin(); break;
    case 'lose': sfxLose(); break;
  }
}
