# Fruit Assault Agent Execution Plan

This plan is based on the current prototype audit in `docs/prototype-audit.md`. Agents should not assume the prototype is blank.

## Global Rules For Every Agent

- Read `docs/prototype-audit.md` first.
- Read `index.html` script order before touching runtime behavior.
- Do not add a new `vXX_fix` script unless the task explicitly asks for a separate experiment.
- Prefer editing the current owner file:
  - economy: `js/juice_economy.js`
  - lane blocking: `js/lane_block_fix.js`
  - core combat: `js/combat.js`, but account for wrappers
  - skills: `js/skill_system_v17.js`
  - product shell/growth: `js/product_shell.js`
  - pvp: `js/pvp.js`, `server/pvp-server.js`
- Preserve current playable shell: campaign, arena, lab, shop, PVP room flow, ladder.
- After code changes run:
  - `Get-ChildItem -Path js,server -Filter *.js -Recurse | ForEach-Object { node --check $_.FullName }`
- Report:
  - files changed
  - design requirement addressed
  - existing prototype behavior preserved
  - tests run
  - known remaining gaps

## Agent 0: Audit And Regression Harness

Objective: make the current prototype measurable before larger feature work.

Inputs:
- `docs/prototype-audit.md`
- `index.html`
- all loaded `js/*.js`

Tasks:
- Add a `scripts/` or `test/` folder if absent.
- Create a lightweight VM harness that loads the same core gameplay files in a controlled order.
- Add regression checks for:
  - SP initial value and action cost.
  - wall pity thresholds.
  - same-lane combat engagement.
  - wall attack with and without blocker.
  - PVP deterministic spawn id/offset logic if feasible without browser.
- Document how to run the checks.

Do not:
- Change gameplay rules.
- Rewrite module architecture.

Acceptance:
- A command runs core regression checks without browser.
- The command exits nonzero on failed assertions.
- Existing syntax check still passes.

## Agent 1: SP Economy Consolidation

Objective: make `juice_economy.js` the single runtime owner of SP economy.

Current prototype state:
- `juice_economy.js` currently owns the late runtime economy.
- Older files still define `SP_MAX`, `SP_PASSIVE`, and kill reward behavior.
- Product shell and PVP call into SP state directly in places.

Tasks:
- Add explicit helpers in `js/juice_economy.js`:
  - `nextJuiceActionCost()`
  - `grantJuice(amount, reason, opts)`
  - `spendJuiceAction(reason, opts)`
  - `resetJuiceEconomyForLevel()`
- Convert manual summon and urgent dispatch to use those helpers.
- Keep PVP compatibility by allowing remote actions to pass already-paid costs.
- Confirm these rules:
  - initial SP = 8
  - SP no cap
  - passive +1 every 5s
  - kill reward = defeated unit level
  - summon and urgent dispatch share counter
  - merge is free and does not increment counter
  - wall pity +3 per 20% player wall loss, max 4

Files likely involved:
- `js/juice_economy.js`
- `js/pvp.js`
- maybe `js/input.js`, only if old handlers still bypass economy

Acceptance:
- Economy harness proves action counter behavior.
- PVP local summon/urgent still sends cost.
- Syntax check passes.

## Agent 2: Combat Lane Contract

Objective: formalize "five lanes, same lane clears first" without breaking current troop-tier mode.

Current prototype state:
- Base combat in `js/combat.js`.
- Role targeting in `js/balance_fix_v15.js`.
- Same-lane blocker in `js/lane_block_fix.js`.
- Full-squad wall attack in `js/combat_pacing_v19.js`.
- Skills can move/knockback units in `js/skill_system_v17.js`.

Tasks:
- Document the final effective call order for `updateSoldier`, `findTarget`, `attackTarget`, `attackWall`.
- Strengthen same-lane blocker tests.
- Ensure same-lane living enemy blocks wall attack before and at wall.
- Ensure backline units maintain spacing from front allies where possible.
- Ensure siege/support can still contribute to wall damage after lane is clear.
- Audit knockback/dash so they do not permanently break lane identity.

Files likely involved:
- `js/lane_block_fix.js`
- `js/combat.js`
- `js/balance_fix_v15.js`
- `js/combat_pacing_v19.js`
- `js/skill_system_v17.js`

Acceptance:
- Same-lane enemy cannot be ignored in normal cases.
- Wall damage only happens when lane is clear or enemy is unreachable by explicit rule.
- Backline does not routinely become frontmost wall attacker.
- Syntax and combat regression checks pass.

## Agent 3: Damage Formula And Role Matrix

Objective: migrate damage to final formula while preserving existing unit feel.

Current prototype state:
- `roleCounterMultiplier` is simplified, not 7x7 table.
- `applyFruitDamage` uses `100 / (100 + armor * 4)`.
- Some skill code applies extra damage directly.

Tasks:
- Add a role matrix in `js/config.js`, using roles:
  - tank
  - front
  - rush
  - back
  - siege
  - control
  - support
- Add a single damage helper:
  - `armorReduction(armor)`
  - `combatDamage(source, target, rawOrAtk, opts)`
- Preserve current source-specific identities through options:
  - orange weak to units, strong to wall.
  - banana/lemon first-hit behavior.
  - skill splash modifiers.
- Convert `applyFruitDamage` and skill damage to use the helper.

Files likely involved:
- `js/config.js`
- `js/fruit_mechanics.js`
- `js/skill_system_v17.js`
- `js/combat.js`

Acceptance:
- Armor formula is `armor / (armor + 50)`.
- Minimum damage is 1.
- Existing default 5 units still have recognizable roles.
- Regression covers tank vs assassin and cannon vs wall/units.

## Agent 4: Status Engine

Objective: unify ad hoc status fields without deleting compatibility too early.

Current prototype state:
- Existing fields include `slowTimer`, `slowMul`, `shield`, `_v17ArmorBreak`, `_v17ArmorBreakValue`, `skillState`.
- No unified `statusEffects` object exists.

Tasks:
- Add `statusEffects` to soldiers at creation.
- Add helpers:
  - `applyStatus(target, type, payload)`
  - `getStatus(target, type)`
  - `updateStatusEffectsForSoldier(s, dt)`
  - `canMove(s)`, `canAttack(s)`, `isTargetable(s, seeker)`
- Implement statuses:
  - frozen
  - slowed
  - burning
  - armorBreak
  - knockback
  - stunned
  - invisible
- Bridge old fields initially:
  - slow status updates `slowTimer/slowMul` or vice versa.
  - armorBreak status maps from `_v17ArmorBreak`.

Files likely involved:
- `js/state.js`
- `js/combat.js`
- `js/fruit_mechanics.js`
- `js/skill_system_v17.js`
- `js/battle_skin.js`

Acceptance:
- Existing pear slow and pineapple anti-rush still work.
- Armor break affects the single damage helper.
- Frozen/stunned prevent move and attack.
- Invisible cannot be normal-targeted.
- Visual layer has at least minimal indicators.

## Agent 5: Unit Roster Expansion From Prototype 13 To Final 20+5

Objective: extend the existing roster, not rewrite it.

Current prototype state:
- 13 units exist.
- Default 5 skills exist.
- Merge utility units exist: kiwi and passion.

Tasks:
- Create a mapping table from final design units to current ids.
- Decide which current units are kept, renamed, or become equivalents.
- Add missing combat units in `TYPES`.
- Add missing economic support balls.
- Economic support balls should affect SP economy more than direct DPS.
- Do not remove default 5 skill behavior.

Suggested batches:
- Batch 1: add economic support balls and wire only their basic economy effects.
- Batch 2: add missing combat units with basic stats, no complex skill.
- Batch 3: add skill details after status engine is stable.

Files likely involved:
- `js/config.js`
- `js/skill_system_v17.js`
- `js/fruit_mechanics.js`
- `js/product_shell.js`

Acceptance:
- New units appear in lab/shop/deck.
- Enemy pool excludes pure merge/economic units unless explicitly intended.
- Support effects do not stack if final design says same type takes highest.
- Default deck remains playable.

## Agent 6: Growth System Reconciliation

Objective: reconcile old tech tree, product-shell initial level, final fruit level, and final star system.

Current prototype state:
- `ui.js` old upgrades: per-unit atk/hp, wall, sp.
- `product_shell.js`: fragments and `fruitLv` up to 4.
- `meta.stars`: campaign clear stars, not fruit stars.

Tasks:
- Rename/introduce fruit stars separately, for example `shell.fruitStars`.
- Decide migration path:
  - keep current tech tree as "legacy tech" temporarily, or
  - hide it and use lab only.
- Implement final fragment level curve or stage it behind constants.
- Extend `fruitLv` beyond 4 only after UI can display it cleanly.
- Add star display and upgrade requirements.

Files likely involved:
- `js/product_shell.js`
- `js/ui.js`
- `js/state.js`
- `js/config.js`
- `css/ui_redesign.css`

Acceptance:
- Campaign stars and fruit stars are not confused.
- Existing saves do not crash.
- Lab shows fragments, level, star, deck status.
- Spawned player units receive correct meta multipliers.

## Agent 7: Shop And Gacha Alignment

Objective: align shop/gacha toward final economy without breaking current product shell.

Current prototype state:
- Four-tier gacha weights: 40/30/20/10.
- Gems are used for draws.
- Fragments are small values.
- Daily pack exists.

Tasks:
- Add configurable gacha table matching final design or a documented staged version.
- Add ten-pull pity behavior if required.
- Add daily free draw timer/state.
- Add boss-stage fragment reward hook.
- Add simulated IAA buttons only as local rewards.

Files likely involved:
- `js/product_shell.js`
- `css/ui_redesign.css`

Acceptance:
- Gacha rates are data-driven.
- Ten pull works and reports results.
- Daily free draw cannot be spammed.
- No real payment or ad SDK is added.

## Agent 8: PVP Hardening

Objective: preserve current room PVP while preparing for final PVP rules.

Current prototype state:
- Manual room-code PVP exists.
- WebSocket server exists.
- Actions are synchronized.
- Simulation is local on both clients.

Tasks:
- Add PVP regression scenario for create/join/ready/start if browser/server tooling is available.
- Add PVP-specific SP and star adjustments only after growth system is clear.
- Ensure every combat randomness source is seeded or disabled in PVP.
- Add a place for future matchmaking pools, but do not replace room-code flow yet.

Files likely involved:
- `js/pvp.js`
- `server/pvp-server.js`
- `js/product_shell.js`
- `js/skill_system_v17.js`

Acceptance:
- Room flow still works.
- Same action sequence remains deterministic.
- Disconnect result still works.
- No change to PVP protocol without versioning or compatibility note.

## Recommended Execution Order

1. Agent 0: regression harness.
2. Agent 1: economy consolidation.
3. Agent 2: combat lane contract.
4. Agent 3: damage formula and matrix.
5. Agent 4: status engine.
6. Agent 5: roster expansion.
7. Agent 6 and 7: growth/shop alignment, can run after Agent 1.
8. Agent 8: PVP hardening after Agents 1-4 stabilize rules.

## First Task To Assign

Assign Agent 0 first.

Reason: current prototype relies on many late wrappers. Without a harness and ownership map, other agents will keep changing files that are then overwritten by later scripts.

