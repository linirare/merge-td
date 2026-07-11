# Fruit Assault Prototype Audit

Date: 2026-07-10
Scope: current `merge-td-new` prototype, checked against `fruit-assault-final.md`, `deepseek意见.txt`, and `codex会话.txt`.

## Current Load Chain

The runtime is a single HTML page with many global scripts loaded in order from `index.html`.

Core base:
- `js/config.js`
- `js/layout_v56.js`
- `js/version_guard.js`
- `js/state.js`
- `js/board.js`
- `js/combat.js`
- `js/ai.js`
- `js/render.js`
- `js/skin.js`
- `js/input.js`
- `js/ui.js`
- `js/main.js`

Major behavior patches loaded later:
- `js/tutorial_balance.js`
- `js/troop_tier_mode.js`
- `js/fruit_deck_runtime.js`
- `js/gameplay_assist.js`
- `js/fruit_mechanics.js`
- `js/juice.js`
- `js/combat_clarity.js`
- `js/balance_fix_v15.js`
- `js/economy_cd_fix.js`
- `js/opening_and_projectile_fix.js`
- `js/lane_block_fix.js`
- `js/juice_absorb_v16.js`
- `js/skill_system_v17.js`
- `js/deck_ui.js`
- `js/deck_unlock_fix.js`
- `js/combat_pacing_v19.js`
- `js/gameplay_readability_v20.js`
- `js/fruit_lab_unified_v21.js`
- `js/fruit_skin.js`
- `js/battle_skin.js`
- `js/hud_skin.js`
- `js/pvp.js`
- `js/product_shell.js`
- `js/juice_economy.js`
- `js/experience_flow.js`
- `js/ui_redesign.js`

Important implication: final behavior is defined by late wrappers. Audits must inspect load order, not only the base file with the obvious function name.

## What The Prototype Already Implements

### Game Shell And UI

- Mobile portrait H5 Canvas game, `480x854`, with menu, battle canvas, modal panels, result panel, help, and bottom navigation.
- Product shell with four tabs: campaign, arena, lab/growth, shop.
- Stage grid and stage selection for campaign.
- Arena screen with real-time PVP room controls and endless ladder entry.
- Shop screen with daily pack, gacha, and upgrade packs.
- Lab screen with fruit list, fragments, initial level upgrades, and deck editing.
- UI redesign layer exists and normalizes menu, arena, lab, shop, and result panels.

Key files:
- `index.html`
- `js/product_shell.js`
- `js/ui_redesign.js`
- `css/ui_redesign.css`
- `css/style.css`

### Unit Roster And Deck

`config.js` currently defines 13 fruit units:

- `watermelon_guard` 西瓜盾卫
- `coconut_guard` 椰子守卫
- `grape_archer` 葡萄射手
- `blueberry_sniper` 蓝莓狙手
- `banana_raider` 香蕉突击
- `lemon_assassin` 柠檬刺客
- `pineapple_lancer` 菠萝枪兵
- `orange_cannon` 橙子炮手
- `pumpkin_roller` 南瓜滚轮
- `pear_frost` 冰梨术士
- `peach_medic` 蜜桃医师
- `kiwi_wildcard` 奇异果万能
- `passion_copy` 百香果复制

Deck system:
- 5-slot active deck exists.
- Default deck: watermelon, grape, banana, pineapple, orange.
- Unlock progression exists by campaign level.
- Legacy id migration exists for old `bow/sword/spear/shield` ids.

Current mismatch:
- Final design asks for 20 combat heroes plus 5 economic support balls.
- Prototype has 11 combat-capable units plus 2 merge/support utility units.
- Some design units are not represented at all, and some prototype units do not map 1:1 to the final document.

### Board, Merge, And Deployment

Implemented:
- `3x5` player and enemy slots.
- Drag to move, swap, or merge.
- Same-type same-level merge.
- Kiwi wildcard and passion copy special merge behaviors.
- Automatic soldier dispatch from fruit camps.
- Manual summon into empty slots.
- Urgent dispatch by double tap/click.
- Overflow queue exists.

Key files:
- `js/board.js`
- `js/input.js`
- `js/main.js`
- `js/troop_tier_mode.js`
- `js/squad_mode.js`
- `js/juice_economy.js`

Important implementation note:
- `troop_tier_mode.js` is loaded, `squad_mode.js` exists but is not loaded by `index.html`.
- Current runtime uses the low-frequency troop tier mode, not the squad mode file.

### SP / Juice Economy

Implemented:
- Player SP/juice state.
- Passive income.
- Action cost counter for manual summon and urgent dispatch.
- Enemy SP and enemy action cost counter.
- Kill reward by defeated unit level.
- Infinite SP cap override in `juice_economy.js`.
- As of the current patch, initial SP is aligned to 8.
- As of the current patch, wall pity exists: every 20% player wall HP loss grants +3 SP, max 4 triggers.

Key files:
- `js/juice_economy.js`
- `js/balance_fix_v15.js`
- `js/main.js`
- `js/input.js`
- `js/pvp.js`

Current mismatch/risk:
- Earlier files still define older SP constants such as `SP_MAX`, `SP_PASSIVE`, and kill reward behavior. Late wrappers override most runtime behavior, but this is fragile.
- Need a repeatable economy simulation to confirm operation counts in 90s/120s windows.

### Combat And Lane Behavior

Implemented:
- Five lanes using board columns.
- Soldiers deploy out of protected castle zone, then become combatants.
- Targeting, movement, ranged projectiles, melee attacks, wall attack, siege slots.
- Backline positioning logic from `balance_fix_v15`.
- All-squad wall attack and support wall damage from `combat_pacing_v19`.
- Same-lane blocker fix exists in `lane_block_fix.js`.
- As of the current patch, same-lane enemies are considered even before wall contact, reducing "ignore enemy and hit wall" cases.

Key files:
- `js/combat.js`
- `js/balance_fix_v15.js`
- `js/lane_block_fix.js`
- `js/combat_pacing_v19.js`
- `js/fruit_mechanics.js`
- `js/skill_system_v17.js`

Current mismatch/risk:
- Targeting is distributed across several wrappers.
- Cross-lane emergency targeting exists, but final design wants lanes to feel independent.
- Need code-level regression scripts for lane contact, siege slots, backline follow distance, and PVP deterministic spawn offsets.

### Damage And Counters

Implemented:
- Role-based counter multiplier in `config.js`.
- Armor exists on units.
- `applyFruitDamage` exists and accounts for armor, shields, and some source-specific adjustments.
- Skill system adds temporary armor break for orange cannon.

Current mismatch:
- Final design uses a 7x7 counter matrix.
- Final design armor formula is `armor / (armor + 50)`.
- Prototype uses simplified role rules and `100 / (100 + armor * 4)` in the fruit damage path.
- Several functions can still compute damage independently.

### Skills And Status-Like Effects

Implemented:
- Default 5 fruit skills in `skill_system_v17.js`:
  - Watermelon shield wall.
  - Grape volley/extra arrows.
  - Banana dash/fury/backline pressure.
  - Pineapple anti-rush knockback/slow/reflect.
  - Orange cannon wall burst and splash.
- Coconut first shield retained.
- Peach healing retained.
- Pear slow exists through existing mechanics.
- Pumpkin death roll exists.
- Shields, slow timers, armor break timers, knockback, and temporary skill state exist.

Current mismatch:
- There is no unified `statusEffects` object for frozen, burning, slowed, stunned, armorBreak, invisible, etc.
- Many status-like effects are ad hoc fields: `slowTimer`, `slowMul`, `_v17ArmorBreak`, `_v17ArmorBreakValue`, `shield`, `skillState`.
- Final document's seven statuses are not fully present.

### Growth / Meta / Gacha

Implemented:
- Classic tech upgrades: per-unit attack/HP, wall, and SP pump in `ui.js`.
- Product shell growth layer:
  - `shell.fragments`
  - `shell.fruitLv`
  - initial level upgrades up to `INIT_MAX = 4`
  - deck editing from lab
- Shop/gacha:
  - single and ten pull.
  - four tiers: normal, rare, epic, legendary.
  - fragments from gacha.
  - daily pack.
  - upgrade packs.
- Campaign stars exist as `meta.stars`.

Current mismatch:
- Final design wants fruit upgrade level up to 20 with exponential fragment cost.
- Final design wants fruit star level `★1` to `★7`.
- Prototype `meta.stars` is campaign clear rating, not fruit star rating.
- Current gacha tiers and probabilities do not match final N/R/E table.
- Current fragment rewards are far smaller and use a different curve.

### PVP And Ladder

Implemented:
- WebSocket server in `server/pvp-server.js`.
- Static/express server wrapper in `server/index.js`.
- Client room creation, join, ready, match start.
- Deck snapshots sent to room.
- Local action forwarding for summon, move, merge/swap, urgent dispatch.
- Deterministic PVP spawn ids and offsets.
- AI disabled in PVP.
- Peer disconnect result.
- Endless ladder mode with wave progression and best wave.

Current mismatch:
- Final design asks for matchmaking pools by growth level; prototype uses manual room codes.
- PVP-specific numeric adjustments are partial or absent.
- No server-side authoritative simulation; both clients simulate locally from commands.
- Determinism needs regression tests before changing core combat/skill math.

## Major Conflicts To Respect

1. Do not treat missing final-design features as proof the prototype is empty.
2. Do not add more random `vXX_fix` files unless absolutely necessary.
3. Many base functions are wrapped later. If an agent changes `combat.js` only, it may still be overridden later.
4. Growth has two systems today: old tech tree and product-shell fragments. Refactors must decide whether to merge or preserve both temporarily.
5. Campaign stars and fruit stars must not share `meta.stars`.
6. PVP depends on deterministic local simulation. Any randomness in combat or spawn must be seeded or isolated from PVP.

## Already Changed In This Pass

- `js/lane_block_fix.js`: same-lane combatants now block before wall contact, not only when already at the wall.
- `js/juice_economy.js`: initial SP aligned to 8.
- `js/juice_economy.js`: wall pity SP added, +3 SP per 20% wall loss, max 4 triggers.

## Verification Performed

- Full JS syntax check:
  - `Get-ChildItem -Path js,server -Filter *.js -Recurse | ForEach-Object { node --check $_.FullName }`
- VM-level economy check:
  - Initial player/enemy SP is 8.
  - Action cost starts at 1.
  - Wall pity grants +3 at 80%, +3 at 60%, and catches multiple crossed thresholds.
  - Max wall pity triggers is 4.
- VM-level combat checks:
  - Same-lane combatants engage instead of continuing to wall.
  - Enemy at player wall with a same-lane player combatant moves into fight and does not damage wall.

