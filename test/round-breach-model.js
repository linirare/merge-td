const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const files = [
  'js/world_theme.js', 'js/config.js', 'js/layout_v56.js', 'js/state.js',
  'js/hooks.js', 'js/board.js', 'js/combat.js', 'js/troop_tier_mode.js', 'js/free_battle_v2.js', 'js/four_class_combat_v1.js',
];
const sandbox = {
  console, Math, JSON,
  document:{ getElementById:()=>null, querySelector:()=>null, querySelectorAll:()=>[] },
  localStorage:{ getItem:()=>null, setItem:()=>{} },
  addFx:()=>{}, playSfx:()=>{}, onGameOver:()=>{}, dt_global:1/60,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(files.map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n') + `
  globalThis.__roundModel = {
    walls:Array.from({length:20}, (_,i) => generateLevel(i + 1).enemyWallHp),
    breach:Object.keys(TYPES).flatMap(type => [1,3,5].map(level => roundBreachDamage({type, level, hp:1, alive:true}))),
    maxSoldiers:tierGlobalLimit(),
    timeoutProbe() {
      state = createState(); state.phase = 'playing'; state.roundPhase = 'fight'; state._roundSpawned = true;
      state.roundIndex = 1; state.roundTimer = 30; state.time = 76;
      const p = createSoldier('peach_medic', 1); Object.assign(p,{id:'p',side:'player',x:200,y:500,hp:999,maxHp:999,battleReady:true,protected:false});
      const e = createSoldier('kiwi_wildcard', 1); Object.assign(e,{id:'e',side:'enemy',x:200,y:400,hp:999,maxHp:999,battleReady:true,protected:false});
      state.playerSoldiers=[p]; state.enemySoldiers=[e];
      updateCombat();
      return {phase:state.phase, roundPhase:state.roundPhase};
    },
    ultimateProbe() {
      state = createState(); state.phase = 'playing'; state.roundPhase = 'fight'; state._roundSpawned = true; state.roundIndex = 1;
      const p = createSoldier('banana_raider', 1); Object.assign(p,{id:'p',side:'player',x:200,y:470,hp:999,maxHp:999,battleReady:true,protected:false});
      const e = createSoldier('orange_cannon', 1); Object.assign(e,{id:'e',side:'enemy',x:200,y:390,hp:999,maxHp:999,battleReady:true,protected:false});
      state.playerSoldiers=[p]; state.enemySoldiers=[e];
      state.time = 1; updateCombat();
      state.time = 8; updateCombat();
      return {used:p._fourUltUsedRound, enemyHp:e.hp};
    }
  };
`, sandbox);

const result = sandbox.__roundModel;
assert.deepStrictEqual([...result.walls], Array.from({length:20}, (_,i) => 11 + i));
assert.ok(result.breach.every(value => value === 1), 'every surviving unit must deal exactly 1 wall damage');
assert.strictEqual(result.maxSoldiers, 8);
assert.deepStrictEqual(JSON.parse(JSON.stringify(result.timeoutProbe())), {phase:'playing', roundPhase:'fight'}, 'elapsed time must not adjudicate PvE');
const ultimate = result.ultimateProbe();
assert.strictEqual(ultimate.used, 1, 'four-class ultimate must execute during a natural round');
assert.ok(ultimate.enemyHp < 999, 'ultimate must affect combat state');
console.log('OK: natural round breach model and wall curve');
