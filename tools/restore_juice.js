const fs = require('fs');

// Idempotency: skip if addSmokePuff already present (patch already applied)
if (fs.readFileSync('js/juice.js', 'utf8').includes('function addSmokePuff')) {
  console.log('juice.js already patched, skipping');
  process.exit(0);
}

let j = fs.readFileSync('js/juice.js', 'utf8');

// 1. smokePuffs in state
j = j.replace('beams: [],\n    combo: 0,', 'beams: [],\n    smokePuffs: [],\n    combo: 0,');

// 2. addSmokePuff
j = j.replace(
  'function addBeam(x1, y1, x2, y2, color = THEME.gold, life = 0.18) {\n  const j = ensureJuice();\n  j.beams.push({ x1, y1, x2, y2, color, life, maxLife: life });\n}',
  'function addBeam(x1, y1, x2, y2, color = THEME.gold, life = 0.18) {\n  const j = ensureJuice();\n  j.beams.push({ x1, y1, x2, y2, color, life, maxLife: life });\n}\n\nfunction addSmokePuff(x, y) {\n  const j = ensureJuice();\n  j.smokePuffs.push({ x, y, r: 3 + Math.random() * 4, life: 0.55 + Math.random() * 0.25, maxLife: 0.65, vy: -18 - Math.random() * 14, vx: (Math.random() - 0.5) * 16 });\n}'
);

// 3. patchAttackJuice
const lines = j.split('\n');
let start = -1, end = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('function patchAttackJuice()')) start = i;
  if (start > 0 && end < 0 && i > start + 20 && lines[i].includes('attackTarget._juicePatched = true;')) end = i;
}
console.log('patchAttackJuice: lines', start+1, 'to', end+1);

const newPatch = [
'function patchAttackJuice() {',
'  if (typeof attackTarget !== "function" || attackTarget._juicePatched) return;',
'  const oldAttack = attackTarget;',
'  attackTarget = function juiceAttack(s, target) {',
'    if (!s || !target) return oldAttack(s, target);',
'    const hpBefore = target.hp;',
'    const projBefore = state.projectiles.length;',
'    const fxBefore = state.attackFx.length;',
'    const ret = oldAttack(s, target);',
'    const hit = target.hp < hpBefore || state.projectiles.length > projBefore || state.attackFx.length > fxBefore;',
'    if (hit) {',
'      const isEnemy = s.side === "enemy";',
'      const color = isEnemy ? "#ff5544" : juiceColorForType(s.type);',
'      const weaponType = (typeof stickWeaponForRoleV61 === "function") ? stickWeaponForRoleV61((TYPES[s.type]||{}).role) : "sword";',
'      const lv = s.level || 1;',
'      const mul = isEnemy ? 0.7 : 1;',
'      switch (weaponType) {',
'        case "bow":',
'          addBeam(s.x, s.y, target.x, target.y, color, 0.12);',
'          addSlash(s.x, s.y, target.x, target.y, "#ffffff", 0.08, 2 * mul);',
'          break;',
'        case "cannon":',
'          addSparkBurst(target.x, target.y, "#ff5500", Math.round(22 * mul), 120 * mul, 5.5 * mul);',
'          addShockwave(target.x, target.y, "#ff8800", (35 + lv * 5) * mul, 0.42, 5 * mul);',
'          for (let i = 0; i < Math.round(5 * mul); i++) addSmokePuff(target.x + (Math.random()-0.5)*30, target.y + (Math.random()-0.5)*18);',
'          if (!isEnemy) punch(0.40 + lv * 0.06, 0.028);',
'          break;',
'        case "sword":',
'          addSlash(s.x, s.y, target.x, target.y, isEnemy ? "#ff9988" : "#ffffff", 0.20, 8 * mul);',
'          for (let g = 0; g < 2; g++) { const a = (g-0.5)*0.5; addSlash(s.x,s.y, target.x+Math.cos(a)*18, target.y+Math.sin(a)*18, "#ffeebb", 0.14, 5 * mul); }',
'          if (!isEnemy) punch(0.18 + lv * 0.03, 0.014);',
'          break;',
'        case "spear":',
'          addSlash(s.x, s.y, target.x+(target.x-s.x)*0.3, target.y+(target.y-s.y)*0.3, isEnemy ? "#ffaaaa" : "#ffffff", 0.16, 4 * mul);',
'          addSparkBurst(target.x, target.y, "#ffffff", Math.round(3 * mul), 40 * mul, 2.5 * mul);',
'          break;',
'        case "shield":',
'          addShockwave(s.x, s.y, isEnemy ? "#cc9988" : "#8899cc", (26 + lv * 4) * mul, 0.30, 4 * mul);',
'          if (!isEnemy) punch(0.12 + lv * 0.02, 0.010);',
'          break;',
'        default:',
'          addSlash(s.x, s.y, target.x, target.y, color, 0.18, 6 * mul);',
'      }',
'      if (target.hp <= 0 && hpBefore > 0) {',
'        addCombo(target.x, target.y, "击破");',
'        addSparkBurst(target.x, target.y, "#ff7a5a", 16, 88, 4);',
'        addShockwave(target.x, target.y, "#ff7a5a", 26, 0.34, 3);',
'        const fragColor = isEnemy ? "#ff6655" : "#55aa55";',
'        const jj = ensureJuice();',
'        for (let f = 0; f < 8; f++) {',
'          const fa = Math.random() * Math.PI * 2;',
'          const fd = 30 + Math.random() * 50;',
'          jj.sparks.push({ x: target.x, y: target.y, vx: Math.cos(fa) * fd, vy: Math.sin(fa) * fd - 15, r: 2.5 + Math.random() * 3, life: 0.45 + Math.random() * 0.2, maxLife: 0.55, color: fragColor, spin: (Math.random() - 0.5) * 10 });',
'        }',
'      }',
'    }',
'    return ret;',
'  };',
'  attackTarget._juicePatched = true;',
'}',
];

lines.splice(start, end - start + 1, ...newPatch);

// 4. smoke update after beams
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('j.beams[i].life -= dt') && lines[i+1] && lines[i+1].includes('j.beams.splice')) {
    const smokeUpdate = [
      '  for (let i = j.smokePuffs.length - 1; i >= 0; i--) {',
      '    const sm = j.smokePuffs[i];',
      '    sm.life -= dt;',
      '    sm.x += sm.vx * dt;',
      '    sm.y += sm.vy * dt;',
      '    sm.r += 5 * dt;',
      '    sm.vy *= Math.pow(0.08, dt);',
      '    if (sm.life <= 0) j.smokePuffs.splice(i, 1);',
      '  }',
    ];
    lines.splice(i + 2, 0, ...smokeUpdate);
    break;
  }
}

// 5. smoke draw before texts
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === 'for (const t of j.texts) {') {
    const smokeDraw = [
      '  for (const sm of j.smokePuffs) {',
      '    const a = Math.max(0, sm.life / sm.maxLife);',
      '    ctx.globalAlpha = a * 0.55;',
      "    ctx.fillStyle = 'rgba(180,160,140,0.7)';",
      '    ctx.beginPath();',
      '    ctx.arc(sm.x, sm.y, Math.max(1, sm.r), 0, Math.PI * 2);',
      '    ctx.fill();',
      '  }',
      '',
    ];
    lines.splice(i, 0, ...smokeDraw);
    break;
  }
}

fs.writeFileSync('js/juice.js', lines.join('\n'));
console.log('juice.js restored');
