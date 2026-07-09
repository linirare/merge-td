/* ============================================================
   水果突击 · Art Resource Pack v31
   直接可用内置 SVG 美术包：背景 / 菜单 / 13水果营 / 13战场单位 / UI图标。
   不依赖外部 PNG，不需要二次切图；浏览器直接作为 Image 绘制到 Canvas。
   ============================================================ */

(function installArtResourcePackV31() {
  const BUILD = 'art-resource-pack-v31';
  const ids = typeof UNIT_POOL !== 'undefined' ? UNIT_POOL.slice() : Object.keys(TYPES || {});
  const c = (id, fallback) => (TYPES[id]?.color || fallback || '#69d66d');
  const roleOf = id => TYPES[id]?.role || 'front';
  const nameOf = id => TYPES[id]?.name || id;

  const META = {
    watermelon_guard:{kind:'watermelon', main:'#31bf61', main2:'#72e083', flesh:'#ff5d6c', leaf:'#2e9e4f', accent:'#111', role:'tank'},
    coconut_guard:{kind:'coconut', main:'#9f7a4c', main2:'#caa06d', flesh:'#f8f0d9', leaf:'#7fd66d', accent:'#5b3d1f', role:'tank'},
    grape_archer:{kind:'grape', main:'#8b53e6', main2:'#c091ff', flesh:'#a86bff', leaf:'#5cc85c', accent:'#4d2f99', role:'back'},
    blueberry_sniper:{kind:'berry', main:'#4774e8', main2:'#86a6ff', flesh:'#5b7cff', leaf:'#64d07a', accent:'#273d9a', role:'back'},
    banana_raider:{kind:'banana', main:'#ffd447', main2:'#fff176', flesh:'#ffe96d', leaf:'#83c75a', accent:'#8a5a08', role:'rush'},
    lemon_assassin:{kind:'lemon', main:'#ffe76a', main2:'#fff49b', flesh:'#ffdb48', leaf:'#73cf62', accent:'#957500', role:'rush'},
    pineapple_lancer:{kind:'pineapple', main:'#ffb337', main2:'#ffd46b', flesh:'#f49b26', leaf:'#46b45d', accent:'#9d6111', role:'front'},
    orange_cannon:{kind:'orange', main:'#ff9838', main2:'#ffc15b', flesh:'#ff822b', leaf:'#60c95b', accent:'#b94e14', role:'siege'},
    pumpkin_roller:{kind:'pumpkin', main:'#ff7d35', main2:'#ffb35e', flesh:'#f36a23', leaf:'#54b75b', accent:'#8c3c14', role:'siege'},
    pear_frost:{kind:'pear', main:'#9be7ff', main2:'#d7fbff', flesh:'#bff4ff', leaf:'#70cb78', accent:'#3196b9', role:'control'},
    peach_medic:{kind:'peach', main:'#ff9fbd', main2:'#ffc6d5', flesh:'#ff8ab2', leaf:'#64c96e', accent:'#c64b7a', role:'support'},
    kiwi_wildcard:{kind:'kiwi', main:'#8bd34e', main2:'#d9f58b', flesh:'#aee35d', leaf:'#52af4f', accent:'#4d3a22', role:'merge'},
    passion_copy:{kind:'passion', main:'#b85cff', main2:'#e0a2ff', flesh:'#f4d85e', leaf:'#77ce65', accent:'#5c2499', role:'merge'}
  };
  for (const id of ids) if (!META[id]) META[id] = {kind:'round', main:c(id), main2:'#ffffff', flesh:c(id), leaf:'#7ccd62', accent:'#37501f', role:roleOf(id)};

  function svgUrl(svg) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }
  function makeImg(svg) { const img = new Image(); img.decoding = 'async'; img.src = svgUrl(svg); return img; }
  function ready(img) { return img && img.complete && img.naturalWidth > 0; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function esc(s) { return String(s || '').replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }

  const ART = window.ART = window.ART || { bg:{}, camps:{}, units:{}, ui:{}, urls:{}, meta:{} };
  ART.build = BUILD;
  ART.meta = META;

  function defs() {
    return `<defs>
      <filter id="softShadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="9" stdDeviation="6" flood-color="#205024" flood-opacity=".18"/></filter>
      <linearGradient id="shine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".62"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    </defs>`;
  }
  function fruitCore(m, x=128, y=104, s=1, stroke='#fff') {
    const sw = 5 * s;
    if (m.kind === 'watermelon') return `
      <ellipse cx="${x}" cy="${y}" rx="${58*s}" ry="${52*s}" fill="${m.main}" stroke="${stroke}" stroke-width="${sw}"/>
      <path d="M${x-40*s} ${y-45*s} C${x-30*s} ${y-10*s} ${x-38*s} ${y+24*s} ${x-24*s} ${y+47*s}" fill="none" stroke="#167c3b" stroke-width="${4*s}" opacity=".55"/>
      <path d="M${x+40*s} ${y-45*s} C${x+30*s} ${y-8*s} ${x+38*s} ${y+25*s} ${x+24*s} ${y+47*s}" fill="none" stroke="#167c3b" stroke-width="${4*s}" opacity=".55"/>
      <path d="M${x-34*s} ${y+5*s} Q${x} ${y+36*s} ${x+34*s} ${y+5*s}" fill="${m.flesh}" opacity=".92"/>
      <circle cx="${x-16*s}" cy="${y+12*s}" r="${3*s}" fill="#202020"/><circle cx="${x+7*s}" cy="${y+18*s}" r="${3*s}" fill="#202020"/>
      <ellipse cx="${x-18*s}" cy="${y-23*s}" rx="${13*s}" ry="${8*s}" fill="url(#shine)"/>`;
    if (m.kind === 'grape') {
      let cs = ''; const pts = [[-22,-18],[0,-22],[22,-16],[-12,4],[12,3],[-25,22],[0,24],[26,21]];
      for (const [dx,dy] of pts) cs += `<circle cx="${x+dx*s}" cy="${y+dy*s}" r="${20*s}" fill="${dy>5?m.main:m.main2}" stroke="${stroke}" stroke-width="${3*s}"/>`;
      return `<path d="M${x-2*s} ${y-55*s} C${x+18*s} ${y-66*s} ${x+36*s} ${y-54*s} ${x+28*s} ${y-36*s} C${x+12*s} ${y-36*s} ${x+2*s} ${y-44*s} ${x-2*s} ${y-55*s}Z" fill="${m.leaf}"/>${cs}<ellipse cx="${x-16*s}" cy="${y-28*s}" rx="${10*s}" ry="${6*s}" fill="url(#shine)"/>`;
    }
    if (m.kind === 'banana') return `
      <path d="M${x-54*s} ${y-12*s} C${x-30*s} ${y-78*s} ${x+48*s} ${y-74*s} ${x+57*s} ${y-8*s} C${x+25*s} ${y+44*s} ${x-32*s} ${y+38*s} ${x-54*s} ${y-12*s}Z" fill="${m.main}" stroke="${stroke}" stroke-width="${sw}"/>
      <path d="M${x-24*s} ${y-20*s} C${x-1*s} ${y-48*s} ${x+32*s} ${y-43*s} ${x+37*s} ${y-5*s}" fill="none" stroke="#fff7a8" stroke-width="${5*s}" opacity=".75"/>
      <path d="M${x+48*s} ${y-25*s} L${x+62*s} ${y-36*s}" stroke="#7c5915" stroke-width="${7*s}" stroke-linecap="round"/>`;
    if (m.kind === 'pineapple') return `
      <path d="M${x-42*s} ${y-4*s} C${x-38*s} ${y-52*s} ${x+38*s} ${y-52*s} ${x+42*s} ${y-4*s} C${x+46*s} ${y+50*s} ${x-46*s} ${y+50*s} ${x-42*s} ${y-4*s}Z" fill="${m.main}" stroke="${stroke}" stroke-width="${sw}"/>
      <path d="M${x-28*s} ${y-55*s} L${x-45*s} ${y-92*s} L${x-10*s} ${y-66*s} L${x} ${y-100*s} L${x+10*s} ${y-66*s} L${x+46*s} ${y-92*s} L${x+28*s} ${y-55*s}" fill="${m.leaf}" stroke="${stroke}" stroke-width="${3*s}" stroke-linejoin="round"/>
      <path d="M${x-32*s} ${y-22*s} L${x+32*s} ${y+38*s} M${x+32*s} ${y-22*s} L${x-32*s} ${y+38*s}" stroke="#b66e16" stroke-width="${3*s}" opacity=".38"/>`;
    if (m.kind === 'pear') return `
      <path d="M${x} ${y-60*s} C${x+38*s} ${y-50*s} ${x+36*s} ${y-12*s} ${x+24*s} ${y+2*s} C${x+64*s} ${y+46*s} ${x+22*s} ${y+75*s} ${x} ${y+65*s} C${x-22*s} ${y+75*s} ${x-64*s} ${y+46*s} ${x-24*s} ${y+2*s} C${x-36*s} ${y-13*s} ${x-38*s} ${y-50*s} ${x} ${y-60*s}Z" fill="${m.main}" stroke="${stroke}" stroke-width="${sw}"/>
      <path d="M${x+4*s} ${y-61*s} C${x+18*s} ${y-83*s} ${x+42*s} ${y-75*s} ${x+35*s} ${y-55*s}" fill="${m.leaf}"/>`;
    if (m.kind === 'lemon') return `<path d="M${x-60*s} ${y} C${x-40*s} ${y-50*s} ${x+40*s} ${y-50*s} ${x+60*s} ${y} C${x+40*s} ${y+50*s} ${x-40*s} ${y+50*s} ${x-60*s} ${y}Z" fill="${m.main}" stroke="${stroke}" stroke-width="${sw}"/><ellipse cx="${x-18*s}" cy="${y-18*s}" rx="${18*s}" ry="${9*s}" fill="url(#shine)"/>`;
    if (m.kind === 'peach') return `<path d="M${x} ${y-54*s} C${x+54*s} ${y-56*s} ${x+68*s} ${y+12*s} ${x+28*s} ${y+58*s} C${x+8*s} ${y+80*s} ${x-8*s} ${y+80*s} ${x-28*s} ${y+58*s} C${x-68*s} ${y+12*s} ${x-54*s} ${y-56*s} ${x} ${y-54*s}Z" fill="${m.main}" stroke="${stroke}" stroke-width="${sw}"/><path d="M${x} ${y-50*s} C${x+5*s} ${y-6*s} ${x-8*s} ${y+38*s} ${x-20*s} ${y+60*s}" fill="none" stroke="${m.accent}" stroke-width="${3*s}" opacity=".45"/>`;
    if (m.kind === 'kiwi') return `<circle cx="${x}" cy="${y}" r="${58*s}" fill="${m.accent}" stroke="${stroke}" stroke-width="${sw}"/><circle cx="${x}" cy="${y}" r="${43*s}" fill="${m.flesh}"/><circle cx="${x}" cy="${y}" r="${18*s}" fill="#f8f5b0"/>${Array.from({length:14},(_,i)=>{const a=i/14*Math.PI*2;return `<circle cx="${x+Math.cos(a)*31*s}" cy="${y+Math.sin(a)*31*s}" r="${2.5*s}" fill="#222"/>`;}).join('')}`;
    if (m.kind === 'coconut') return `<circle cx="${x}" cy="${y}" r="${57*s}" fill="${m.main}" stroke="${stroke}" stroke-width="${sw}"/><circle cx="${x}" cy="${y}" r="${39*s}" fill="${m.flesh}" opacity=".92"/><circle cx="${x-14*s}" cy="${y-18*s}" r="${4*s}" fill="${m.accent}"/><circle cx="${x+10*s}" cy="${y-18*s}" r="${4*s}" fill="${m.accent}"/><circle cx="${x}" cy="${y+2*s}" r="${4*s}" fill="${m.accent}"/>`;
    if (m.kind === 'pumpkin') return `<ellipse cx="${x}" cy="${y}" rx="${62*s}" ry="${52*s}" fill="${m.main}" stroke="${stroke}" stroke-width="${sw}"/><path d="M${x-24*s} ${y-47*s} C${x-34*s} ${y-10*s} ${x-34*s} ${y+22*s} ${x-22*s} ${y+48*s} M${x+24*s} ${y-47*s} C${x+34*s} ${y-10*s} ${x+34*s} ${y+22*s} ${x+22*s} ${y+48*s}" fill="none" stroke="#c74e17" stroke-width="${4*s}" opacity=".45"/><path d="M${x} ${y-48*s} L${x+9*s} ${y-70*s}" stroke="#5a823a" stroke-width="${7*s}" stroke-linecap="round"/>`;
    if (m.kind === 'passion') return `<circle cx="${x}" cy="${y}" r="${58*s}" fill="${m.main}" stroke="${stroke}" stroke-width="${sw}"/><circle cx="${x}" cy="${y}" r="${36*s}" fill="${m.flesh}"/><circle cx="${x}" cy="${y}" r="${22*s}" fill="#7c3ad0" opacity=".72"/>${Array.from({length:10},(_,i)=>{const a=i/10*Math.PI*2;return `<circle cx="${x+Math.cos(a)*24*s}" cy="${y+Math.sin(a)*24*s}" r="${2.4*s}" fill="#2b173d"/>`;}).join('')}`;
    return `<circle cx="${x}" cy="${y}" r="${56*s}" fill="${m.main}" stroke="${stroke}" stroke-width="${sw}"/><ellipse cx="${x-17*s}" cy="${y-21*s}" rx="${16*s}" ry="${9*s}" fill="url(#shine)"/>`;
  }

  function campSvg(id) {
    const m = META[id];
    const color = m.main;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">${defs()}
      <ellipse cx="128" cy="204" rx="72" ry="18" fill="#23451f" opacity=".16"/>
      <path d="M55 190 Q128 220 201 190 L189 213 Q128 237 67 213Z" fill="#dcae66" stroke="#fff7d6" stroke-width="6" filter="url(#softShadow)"/>
      <path d="M72 186 Q128 207 184 186" fill="none" stroke="#9f7338" stroke-width="5" opacity=".36"/>
      <g filter="url(#softShadow)">${fruitCore(m,128,111,0.82)}</g>
      <circle cx="184" cy="65" r="21" fill="#fff7cb" stroke="${color}" stroke-width="5"/>
      <path d="${roleGlyphPath(m.role,184,65,12)}" fill="none" stroke="${m.accent}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }
  function roleGlyphPath(role,x,y,s) {
    if (role === 'tank') return `M${x-s} ${y-s} L${x+s} ${y-s} L${x+s*.7} ${y+s} L${x} ${y+s*1.35} L${x-s*.7} ${y+s} Z`;
    if (role === 'back') return `M${x-s*1.2} ${y+s*.8} Q${x} ${y-s*1.4} ${x+s*1.2} ${y+s*.8} M${x-s*.5} ${y} L${x+s*1.25} ${y-s*.9}`;
    if (role === 'rush') return `M${x-s} ${y+s} L${x} ${y-s*1.3} L${x+s} ${y+s*.1}`;
    if (role === 'front') return `M${x-s*1.2} ${y+s*1.1} L${x+s*1.2} ${y-s*1.1} M${x+s*.35} ${y-s*.85} L${x+s*1.2} ${y-s*1.1} L${x+s*.98} ${y-s*.25}`;
    if (role === 'siege') return `M${x-s} ${y-s*.2} H${x+s*.7} V${y+s*.45} H${x-s} Z M${x-s*.5} ${y+s} A1 1 0 1 0 ${x-s*.49} ${y+s}`;
    if (role === 'support') return `M${x} ${y-s*1.1} V${y+s*1.1} M${x-s*1.1} ${y} H${x+s*1.1}`;
    if (role === 'control') return `M${x} ${y-s*1.2} L${x+s} ${y-s*.2} L${x+s*.55} ${y+s*1.1} L${x-s*.55} ${y+s*1.1} L${x-s} ${y-s*.2} Z`;
    return `M${x-s} ${y} H${x+s} M${x} ${y-s} V${y+s}`;
  }

  function unitSvg(id) {
    const m = META[id];
    const role = m.role;
    const weapon = unitWeapon(role, m);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">${defs()}
      <ellipse cx="128" cy="214" rx="54" ry="13" fill="#14351f" opacity=".16"/>
      <g filter="url(#softShadow)">
        <path d="M91 177 Q128 146 165 177 L158 219 Q128 236 98 219Z" fill="${role === 'tank' ? '#5cc36d' : role === 'rush' ? '#ffd05b' : role === 'siege' ? '#f2a34c' : '#72c7ff'}" stroke="#fff" stroke-width="6"/>
        <path d="M104 174 Q128 191 152 174" fill="none" stroke="rgba(0,0,0,.22)" stroke-width="5"/>
        <g transform="translate(0,4)">${fruitCore(m,128,91,0.62)}</g>
        <circle cx="106" cy="94" r="5" fill="#26311f"/><circle cx="150" cy="94" r="5" fill="#26311f"/>
        <path d="M113 116 Q128 127 144 116" fill="none" stroke="#26311f" stroke-width="5" stroke-linecap="round" opacity=".74"/>
        <path d="M96 207 L81 229 M160 207 L176 229" stroke="#5a8d3d" stroke-width="9" stroke-linecap="round"/>
        ${weapon}
      </g>
    </svg>`;
  }
  function unitWeapon(role,m) {
    const a = m.accent, main = m.main;
    if (role === 'tank') return `<path d="M53 116 Q77 96 96 117 V174 Q74 190 53 173Z" fill="${main}" stroke="#fff" stroke-width="6"/><path d="M65 122 Q76 113 88 123 V166 Q76 173 65 166Z" fill="rgba(255,255,255,.22)"/>`;
    if (role === 'back') return `<path d="M186 75 Q224 128 186 181" fill="none" stroke="${a}" stroke-width="9" stroke-linecap="round"/><path d="M188 82 L188 175" stroke="#fff7c9" stroke-width="4"/><path d="M170 132 H224" stroke="${main}" stroke-width="6" stroke-linecap="round"/>`;
    if (role === 'rush') return `<path d="M76 132 L45 178" stroke="#fff7bd" stroke-width="9" stroke-linecap="round"/><path d="M42 182 L57 180 L48 168Z" fill="${a}"/><path d="M180 132 L214 176" stroke="#fff7bd" stroke-width="9" stroke-linecap="round"/><path d="M218 180 L203 178 L211 166Z" fill="${a}"/>`;
    if (role === 'front') return `<path d="M177 64 L72 201" stroke="#fff7bd" stroke-width="8" stroke-linecap="round"/><path d="M181 58 L191 84 L165 75Z" fill="${main}" stroke="#fff" stroke-width="4"/>`;
    if (role === 'siege') return `<path d="M176 127 H221 V154 H176Z" fill="${main}" stroke="#fff" stroke-width="5"/><circle cx="186" cy="168" r="11" fill="${a}"/><circle cx="214" cy="168" r="11" fill="${a}"/><path d="M221 137 L239 130" stroke="#fff7bd" stroke-width="7" stroke-linecap="round"/>`;
    if (role === 'support') return `<circle cx="194" cy="133" r="23" fill="#fff3c0" stroke="${main}" stroke-width="6"/><path d="M194 119 V147 M180 133 H208" stroke="${a}" stroke-width="7" stroke-linecap="round"/>`;
    if (role === 'control') return `<path d="M190 80 L190 180" stroke="#fff7bd" stroke-width="7" stroke-linecap="round"/><circle cx="190" cy="74" r="20" fill="${main}" stroke="#fff" stroke-width="5"/><path d="M177 74 H203 M190 61 V87" stroke="#fff" stroke-width="5" opacity=".72"/>`;
    return `<circle cx="194" cy="132" r="20" fill="${main}" stroke="#fff" stroke-width="5"/>`;
  }

  function battleBgSvg() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 854" width="960" height="1708">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff8c8"/><stop offset=".34" stop-color="#dcf8a9"/><stop offset="1" stop-color="#8ce0a1"/></linearGradient>
        <radialGradient id="soft" cx="50%" cy="42%" r="65%"><stop offset="0" stop-color="#ffffff" stop-opacity=".34"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="480" height="854" fill="url(#bg)"/>
      <rect width="480" height="854" fill="url(#soft)"/>
      <path d="M32 98 C150 62 322 66 448 104" fill="none" stroke="#ffffff" stroke-width="28" opacity=".10" stroke-linecap="round"/>
      <path d="M28 772 C130 804 336 804 452 768" fill="none" stroke="#316f35" stroke-width="42" opacity=".06" stroke-linecap="round"/>
      <g opacity=".16">
        <circle cx="44" cy="82" r="20" fill="#ff6f83"/><circle cx="70" cy="68" r="14" fill="#ffd24a"/><circle cx="414" cy="86" r="24" fill="#a45cff"/><circle cx="438" cy="112" r="16" fill="#53c96a"/>
        <circle cx="48" cy="756" r="24" fill="#ffd24a"/><circle cx="82" cy="780" r="17" fill="#ff8c36"/><circle cx="410" cy="754" r="20" fill="#ff9fbd"/>
      </g>
      <g opacity=".13" stroke="#fffde4" stroke-width="3" stroke-linecap="round">
        <path d="M86 150 C62 302 70 506 94 696"/><path d="M394 152 C420 314 414 510 386 700"/>
      </g>
      <g opacity=".11" fill="#2aa952">
        <path d="M18 240 q18 -22 36 0 q-18 10 -36 0Z"/><path d="M428 270 q18 -22 36 0 q-18 10 -36 0Z"/><path d="M22 620 q18 -22 36 0 q-18 10 -36 0Z"/><path d="M424 602 q18 -22 36 0 q-18 10 -36 0Z"/>
      </g>
    </svg>`;
  }
  function menuPreviewSvg() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 312" width="700" height="312">
      <defs><linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff7bf"/><stop offset="1" stop-color="#9be7a1"/></linearGradient></defs>
      <rect width="700" height="312" rx="34" fill="url(#m)"/>
      <path d="M74 72 C220 38 476 42 626 78" stroke="#fff" stroke-width="28" opacity=".20" fill="none" stroke-linecap="round"/>
      <g opacity=".28"><circle cx="104" cy="230" r="34" fill="#ff6d82"/><circle cx="158" cy="250" r="25" fill="#ffd447"/><circle cx="560" cy="226" r="34" fill="#9b5cff"/><circle cx="610" cy="252" r="26" fill="#53c96a"/></g>
      <path d="M120 158 H580" stroke="#fff6c4" stroke-width="10" opacity=".55" stroke-linecap="round"/>
      <path d="M180 128 H520" stroke="#63c974" stroke-width="8" opacity=".26" stroke-linecap="round"/>
    </svg>`;
  }
  function iconSvg(kind) {
    const meta = kind === 'juice' ? META.orange_cannon : kind === 'gold' ? META.lemon_assassin : META.watermelon_guard;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${defs()}<circle cx="64" cy="64" r="50" fill="#fff7c9" stroke="#fff" stroke-width="6" filter="url(#softShadow)"/>${fruitCore(meta,64,62,0.44)}${kind==='juice'?'<path d="M44 90 H84" stroke="#ff9838" stroke-width="7" stroke-linecap="round"/>':''}</svg>`;
  }

  ART.urls.battle = svgUrl(battleBgSvg());
  ART.urls.menu = svgUrl(menuPreviewSvg());
  ART.bg.battle = makeImg(battleBgSvg());
  ART.bg.menu = makeImg(menuPreviewSvg());
  ART.ui.juice = makeImg(iconSvg('juice'));
  ART.ui.gold = makeImg(iconSvg('gold'));
  ART.ui.box = makeImg(iconSvg('box'));
  for (const id of ids) {
    ART.camps[id] = makeImg(campSvg(id));
    ART.units[id] = makeImg(unitSvg(id));
  }

  function patchMenuPreview() {
    const style = document.createElement('style');
    style.textContent = `.hero-preview{background-image:url("${ART.urls.menu}")!important;background-size:cover!important;background-position:center!important}.hero-preview::before{display:none!important}`;
    document.head.appendChild(style);
  }
  function patchBackground() {
    if (typeof drawBackground !== 'function' || drawBackground._artV31) return;
    const old = drawBackground;
    drawBackground = function drawArtBackgroundV31() {
      if (ready(ART.bg.battle)) ctx.drawImage(ART.bg.battle, 0, 0, W, H);
      else old();
    };
    drawBackground._artV31 = true;
  }
  function patchBoardFruit() {
    if (typeof drawBall !== 'function' || drawBall._artV31) return;
    const old = drawBall;
    drawBall = function drawArtCampV31(ball, cx, cy, radius, extraY = 0, isEnemy = false) {
      if (!ball) return;
      const type = typeof normalizeTypeId === 'function' ? normalizeTypeId(ball.type) : ball.type;
      const img = ART.camps[type];
      if (!ready(img)) return old(ball, cx, cy, radius, extraY, isEnemy);
      const level = clamp(ball.level || 1, 1, 7);
      const lvScale = ({1:1,2:1.07,3:1.16,4:1.27,5:1.40,6:1.54,7:1.70})[level] || 1;
      const t = TYPES[type] || TYPES[DEFAULT_DECK[0]];
      const y = cy + extraY + Math.sin((state?.time || 0) * 1.4 + cx * .03) * 0.8;
      const size = radius * 2.55 * lvScale;
      ctx.save();
      ctx.globalAlpha = isEnemy ? 0.78 : 1;
      ctx.fillStyle = 'rgba(0,0,0,.14)';
      ctx.beginPath(); ctx.ellipse(cx, y + size * .34, size * .30, size * .075, 0, 0, Math.PI*2); ctx.fill();
      ctx.drawImage(img, cx - size/2, y - size/2, size, size);
      ctx.globalAlpha = isEnemy ? .55 : .70;
      ctx.strokeStyle = isEnemy ? '#ff6578' : (t.color || THEME.gold);
      ctx.lineWidth = level >= 6 ? 3.2 : level >= 4 ? 2.6 : 2;
      ctx.beginPath(); ctx.arc(cx, y, radius * (.98 + level*.08), 0, Math.PI*2); ctx.stroke();
      if (state.phase === 'playing') {
        const cd = SPAWN_COOLDOWNS[level] || SPAWN_COOLDOWNS[1];
        const p = 1 - clamp((ball.spawnTimer || 0) / cd, 0, 1);
        ctx.globalAlpha = .76;
        ctx.strokeStyle = p >= .98 ? '#fff176' : (t.color || THEME.gold);
        ctx.lineWidth = p >= .98 ? 3.1 : 2.2;
        ctx.beginPath(); ctx.arc(cx, y, radius * (.98 + level*.08) + 5, -Math.PI/2, -Math.PI/2 + Math.PI*2*p); ctx.stroke();
      }
      ctx.restore();
    };
    drawBall._artV31 = true;
  }
  function drawArtHp(s, x, y, w) {
    const ratio = clamp((s.hp || 1) / Math.max(1, s.maxHp || 1), 0, 1);
    ctx.fillStyle = 'rgba(25,46,20,.46)'; roundRect(x-w/2, y, w, 5, 3); ctx.fill();
    ctx.fillStyle = ratio > .55 ? THEME.safe : ratio > .25 ? '#ffd24a' : '#ff5a3a'; roundRect(x-w/2, y, w*ratio, 5, 3); ctx.fill();
  }
  function patchUnitDraw() {
    if (typeof drawSoldier !== 'function' || drawSoldier._artV31) return;
    const old = drawSoldier;
    drawSoldier = function drawArtSoldierV31(s) {
      if (!s || !s.alive) return old(s);
      const type = typeof normalizeTypeId === 'function' ? normalizeTypeId(s.type) : s.type;
      const img = ART.units[type];
      if (!ready(img)) return old(s);
      const t = TYPES[type] || TYPES[DEFAULT_DECK[0]];
      const fy = LAYOUT.fieldY, fh = LAYOUT.fieldH;
      const depth = .80 + .23 * clamp(((s.y || 0) - fy) / Math.max(1, fh), 0, 1);
      const level = clamp(s.level || 1, 1, 7);
      const size = (44 + level * 5.2) * depth * (s.troopScale || 1);
      const ring = s.side === 'player' ? 'rgba(83,201,106,.55)' : 'rgba(255,92,92,.52)';
      ctx.save();
      ctx.strokeStyle = s.mode === 'siege' ? 'rgba(255,201,60,.82)' : ring;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(s.x, s.y + size*.20, size*.43, size*.20, 0, 0, Math.PI*2); ctx.stroke();
      ctx.globalAlpha = s.side === 'enemy' ? .76 : 1;
      ctx.drawImage(img, s.x - size/2, s.y - size*.72, size, size);
      ctx.globalAlpha = 1;
      drawArtHp(s, s.x, s.y - size*.68 - 9, size*.74);
      const tier = typeof cleanTierLabel === 'function' ? cleanTierLabel(s) : (level >= 5 ? '精英' : '小兵');
      const role = typeof cleanRoleLabel === 'function' ? cleanRoleLabel(t.role) : t.role;
      ctx.font = '900 9px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(30,40,20,.46)'; ctx.fillStyle = s.side === 'player' ? '#fff8a6' : '#ffd0d0';
      ctx.strokeText(`${tier} · ${role}`, s.x, s.y - size*.72 - 15); ctx.fillText(`${tier} · ${role}`, s.x, s.y - size*.72 - 15);
      ctx.restore();
    };
    drawSoldier._artV31 = true;
  }
  function patchBuildBadge() {
    const el = document.getElementById('buildBadge');
    if (el) el.textContent = BUILD;
  }

  patchMenuPreview();
  patchBackground();
  patchBoardFruit();
  patchUnitDraw();
  patchBuildBadge();
})();
