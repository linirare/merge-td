# 水果突击 / Fruit Assault — Combat & Battle Design Review

**Reviewer role:** Systems / combat designer (review only, no code changed)
**Scope:** merge + tower-defense + auto-battler core; 5 lanes, two 3×5 boards; win = destroy enemy 果堡 (wall) HP.
**Evidence base:** source read of `js/config.js`, `js/combat.js`, `js/boss_v63.js`, `js/ai.js`, `js/juice_economy.js`, `js/board.js`, `js/state.js`, `js/fruit_mechanics.js`, `js/combat_pacing_v19.js`, `js/status_engine_v61.js`, `js/dynamic_difficulty_v64.js`, `js/economy_balls_v62.js`, plus a full run of the real-combat harness `test/stage-real-sim.js`.

---

## 0. Executive summary

The single most important result in this review is empirical. Running the project's own real-combat simulator (`node test/stage-real-sim.js`, 20 stages × 3 bot skill levels, 65 s cap) produces this:

| Stage band | no_action bot | light bot | standard bot |
|---|---|---|---|
| 1–4 | timeout (except S1 win) | 100% win, 13–35 s | 100% win (S3 timeout) |
| 5 (boss) | **timeout** | **timeout** | **timeout** |
| 6–8 | timeout | mostly win | mostly win |
| 9–20 | **timeout** | **timeout (all)** | **timeout (all)** |
| 5/10/15/20 boss | **timeout** | **timeout** | **timeout** |

From stage 9 onward **every** strategy times out, and **all four boss stages are 0% win for all three bots**. The reported `avgMaxUnits` sits at **24** (the `MAX_SOLDIERS` cap, `config.js:286`) in nearly every stalled stage, and `no_action`'s `avgPeakJuice` piles up to ~20. This is a textbook auto-battler **stalemate**: both walls survive, the field saturates at the unit cap, the frontline pins at midfield, and — critically — **there is no timer or tie-break in the real game**, so a stalemate is an *infinite, unwinnable, unloseable* match. The known "passive bot times out" issue is not a tuning wrinkle; it is the dominant failure mode of the whole mid/late game.

The siege math itself is fine. Walls fall quickly *when units reach them*. The problem is that units almost never reach them. So the fixes cluster around **(a) guaranteeing match resolution** and **(b) breaking the equal-reinforcement frontline gridlock**, not around "siege too weak / walls too tanky" in isolation.

---

## 1. Severity-ranked findings

| # | Sev | Finding | Core evidence |
|---|-----|---------|---------------|
| F1 | **P0** | No match timer / tie-break — stalemate = infinite game | `combat.js:788-789` only ends on wall HP ≤ 0; grep found zero timeout/draw logic in game code |
| F2 | **P0** | Frontline gridlock: equal reinforcement + saturation at 24 units means units never reach walls | sim `avgMaxUnits=24`; `MAX_SOLDIERS=24` (`config.js:286`); `SCAN_RANGE=168` > midfield gap ~127 (`combat.js:12`) |
| F3 | **P0** | Bosses are double-gated (600–900 HP blocker + 140–650 wall) and unkillable by normal play | `boss_v63.js:18-22`; walls `dynamic_difficulty_v64.js:41`; sim boss win rate 0% all bots |
| F4 | **P1** | Anti-stalemate "reinforce pause" window only triggers on a *full* lane wipe (0 enemies) — never fires when saturated | `combat_pacing_v19.js:82-87` |
| F5 | **P1** | Counter multiplier is applied *before* armor, so ±20–50% is diluted vs tanks; also collides with level scaling | `combat.js:472` (`atk*counterMul` then armor in `fruit_mechanics.js:37`); `LEVEL_MUL` to 5× (`config.js:218`) |
| F6 | **P1** | Melon King shields *all* enemies +25 every 10 s — makes the entire enemy line un-clearable in a stall | `boss_v63.js:71-78` |
| F7 | **P2** | SP economy is not a real constraint once combat flows (kill-SP + Infinity cap floods it) | kill reward = enemy level 1–7 (`juice_economy.js:116-127`); `getSpMax=Infinity` (`juice_economy.js:74-76`) |
| F8 | **P2** | Cultivation Lv11–20 is a diminishing-returns cliff on an exponential shard cost | `config.js:223,228` (cost ×2/level; L11–20 only +54%→+85%) |
| F9 | **P2** | `mango_arbalest` (rare) is a stat outlier: highest sustained ranged DPS in the game | `config.js:66` atk8 / speed 0.55 → 14.5 DPS |
| F10 | **P2** | Dead/duplicated constants create ambiguity for future tuners | `ROLE_COUNTER_DMG=1.35` etc. unused (`config.js:157-159`); `SP_PASSIVE=3.0` overridden by `passiveInterval=5.0` |

---

## 2. P0 findings (the stalemate)

### F1 — There is no match resolution other than a wall reaching 0

`updateCombat()` ends the match only here:

- `combat.js:788` — `if (state.playerWallHp <= 0) … phase='lost'`
- `combat.js:789` — `else if (state.enemyWallHp <= 0) … phase='won'`

A grep across all game JS for `timeLimit|timeout|state.time >|maxTime|draw|平局|超时` returns matches **only** in `test/` and the PvP server idle-socket — never in the PvE game loop. The only place a 90 s cap exists is inside the sim harness (`stage-real-sim.js:94`), which is why the sim reports "timeout" while the shipped game would simply keep running.

**Why it's a problem:** In the auto-battler steady state both walls are protected behind a self-replenishing frontline. If neither wall falls, the game never ends. The player's only exit is to quit — which reads as a hard bug. This turns every mid/late stage (F2/F3) from "hard" into "impossible + unquittable."

**Recommendation (target numbers):**
- Add a hard match clock: **normal 75 s, boss 110 s** (aligns with the existing design targets `TUNING.pve.normalTargetSeconds=[35,55]`, `bossTargetSeconds=[55,85]` at `config.js:302-303`, leaving headroom).
- On expiry, resolve by **wall HP % remaining** (attacker with the lower enemy-wall-%-remaining wins); tie-break by **total wall damage dealt** (`state.enemyWallDamageDealt` vs `state.playerWallDamageTaken` already tracked at `combat.js:382-386`). If still tied, defender (player) loses to force offense.
- Surface a visible countdown + "leading wall" indicator so the timer is a *decision pressure*, not a surprise.

This alone converts F2/F3 from "unwinnable" to "race you can lose," which is the correct design contract for a siege game.

### F2 — Frontline gridlock: equal reinforcement + always-a-target = nobody reaches the wall

Three facts combine into the gridlock:

1. **Both sides reinforce continuously and symmetrically.** Board fruits auto-spawn soldiers on `SPAWN_COOLDOWNS` (5.6 s @L1 → 2.35 s @L7, `config.js:284`), capped at `MAX_SOLDIERS=24` per side (`config.js:286`). The sim shows both sides sitting at 24.
2. **A soldier at midfield can always see an enemy.** Field height `FIELD_H=254` (`config.js:31`); wall-to-wall gap ≈ 254 px, so lines meet ~127 px from each wall. `SCAN_RANGE=168` and `CROSS_LANE_EMERGENCY_RANGE=120` (`combat.js:12,16`) both exceed that gap, so `findTarget` (`combat.js:199`) essentially always returns a target and `advanceTowardWall` (`combat.js:277`) is rarely reached. Units fight forever instead of pushing.
3. **The comeback lever makes the defender un-killable.** Wall-pity grants the *player* +3 SP per 25% wall lost (`juice_economy.js:177-194`), so a pressured player just makes more defenders. Good anti-frustration, bad for breaking a stall.

With both sides refilling to 24 and every unit finding a fight, neither line gains the local superiority needed to expose a wall. Result: perpetual midfield clash → F1 makes it infinite.

**Recommendation (target numbers):**
- **Lower `MAX_SOLDIERS` 24 → 14** (≈2.8/lane). Saturation is what removes the "gaps" that let a winning lane break through; a lower cap lets local wins actually open a lane.
- **Add a commit-to-wall rule:** once a soldier is within ~70 px of the enemy wall *and* no enemy is within ~90 px forward of it in-lane, force `advanceTowardWall`/`attackWall` and ignore lateral (cross-lane) targets. Today cross-lane emergency targeting (`combat.js:196`) actively pulls near-wall attackers back into fights.
- **Asymmetric reinforcement on lane dominance** (see F4): the side losing a lane badly should throttle reinforcement into that lane so the winner can convert.

### F3 — Bosses are double-gated and unkillable by intended play

Each boss is a single very-high-HP body **plus** a very-high wall behind it:

- Boss 5 melon_king: **600 HP**, +6 armor → armor 22 → mitigation 22/72 = 30.6% → **~865 effective HP** (`boss_v63.js:18,46-48`), wall **140** (`dynamic_difficulty_v64.js:41`).
- Boss 10 durian_cannon: 520 HP, wall **280**.
- Boss 15 twin (520 + 360 HP two bodies), wall **450**.
- Boss 20 fruit_king: **900 HP** + slow aura + summons 3 raiders / 15 s, wall **650**.

For scale, a Lv5 `grape_archer` does ~27 dmg/hit into that armor; killing an 865-eHP melon_king solo takes ~30 s of uninterrupted fire that the frontline never allows. Behind it, even if reached, wall 140 is trivial (see §5 siege throughput ~90 DPS for a full siege lane) — but it is never reached. The sim confirms **0% boss win across all three bots**.

**Recommendation (target numbers):**
- Cap boss body eHP so 2–3 leveled units clear it inside the match clock: **melon_king 600→360**, **fruit_king 900→560**, **durian_cannon 520→360**, **twin 520/360→360/240**.
- Keep the boss to a *single* lane and drop its slow-aura radius (`boss_v63.js:100`, 95 px) so the remaining 4 lanes are a real siege path around it.
- With F1's timer + wall-%-tie-break, bosses become "out-damage the boss wall in 110 s" — a legible, winnable objective.

---

## 3. P1 findings

### F4 — The intended anti-stalemate window can't fire under saturation

`combat_pacing_v19.js:82-87` pauses enemy reinforcement for 4.1–5.0 s **only when** `beforeEnemy>0 && afterEnemy===0` — i.e. the player must fully wipe the enemy's live combatants in a frame. Under the 24-unit saturation of F2 the live count never reaches 0, so the window never opens. The mechanism that was supposed to prevent stalls is gated on a condition the stall itself prevents.

**Recommendation:** Trigger on *lane dominance*, not annihilation. Using the already-computed `state.laneStats` (`combat.js:647-686`, has `playerPower`/`enemyPower` per lane): when one side's lane power < **40%** of the other's for **>2 s**, pause the losing side's reinforcement into that lane for **4 s** and let the winner push. This fires continuously in a saturated field, which is exactly when you need it.

### F5 — Counters are diluted by armor and out-scaled by level

Counter damage is computed as `dmg = round(s.atk * counterMul)` **before** armor mitigation (`combat.js:472`), and mitigation is applied afterward in `applyFruitDamage` (`fruit_mechanics.js:37`, `1 - armor/(armor+50)`).

- The matrix (`config.js:178-187`) swings 0.7–1.5. The strongest counter, rush→back ×1.5 (`config.js:182`), lands almost fully because backline armor is 1–2 (≈2–4% mitigation) — good, meaningful.
- But front→tank ×1.2 (`config.js:181`) hits a 16-armor tank at 24% mitigation, so the *net* swing over neutral is only ~×1.2 on a heavily reduced number — the counter you most want the player to feel (anti-tank) is the most muted.
- Against `LEVEL_MUL` (`config.js:218`) where one level ≈ ×1.3–1.4 atk and the ceiling is ×5, a 2-level edge (×1.9) simply dominates any ×1.5 counter. Within the same level the counter matters; across levels it's noise.

Net verdict: the "石头剪刀布" core is **real but secondary** — it steers targeting and matters in even-level skirmishes, but level and armor decide most exchanges. It reads more as soft flavor than a decisive lever, and because matches don't resolve (F1) counters rarely decide anything.

**Recommendation:** Apply the counter multiplier to the **post-armor** damage (multiply the final number, not raw atk) so the ±20–50% is always felt, including vs tanks. Optionally widen anti-tank counters (front→tank 1.2→1.35, siege→tank 1.3→1.45 at `config.js:181,184`) so a correct read visibly cracks the frontline — directly helping F2.

### F6 — Melon King's team-wide shield makes the whole enemy line un-clearable

`boss_v63.js:71-78`: every 10 s, melon_king adds **+25 shield to every living enemy** (`e.shield += 25`), capped only by re-application. In a stall this tops up the entire enemy frontline faster than a stuck player line can chew through it — a direct multiplier on F2's gridlock.

**Recommendation:** Scope the shield to a radius (nearest ~3 allies) and reduce to **+12**, telegraphed 1 s ahead so "burst before the pulse" is real counterplay (matches the tutorial hint `break_shield_with_siege`, `config.js:329`). A global, untelegraphed team heal is anti-counterplay.

---

## 4. P2 findings

### F7 — SP is not a meaningful constraint once combat flows
Start 8 (`config.js:291`), +1 every 5 s (`juice_economy.js:19`, note `SP_PASSIVE=3.0` at `config.js:288` is dead — overridden), **+enemy-level (1–7) per kill** (`juice_economy.js:116-127`), +3 per 25% wall lost (pity), and **no cap** (`getSpMax=Infinity`, `juice_economy.js:74-76`). In a saturated fight kill-income alone outruns the escalating action cost (1→12, `juice_economy.js:22-26`); the sim's `no_action` peaks at ~20 unspent SP. Early stages (1–3) feel a real budget; from mid-game SP is effectively free.
**Recommendation:** Cap kill-SP contribution (flat **+1** per kill, or keep the existing every-4th-kill path at `combat.js:443` and remove the per-kill bonus at `juice_economy.js:120`) and restore a soft ceiling (**24**) so hoarding is bounded and the escalating cost stays relevant. Lower priority than F1–F3.

### F8 — Cultivation Lv11–20 is a returns cliff on exponential cost
`cultivateBonusAt` (`config.js:225-229`): Lv1–10 gives a clean +5%/level (→+50%); Lv11–20 crawls +54%→+85% (only +31% over ten levels) while `cultivateShardCost` doubles each level (`config.js:223`), so the L11–20 band costs ~1000× the shards for a third of the payoff. Combined with star ★7 (+38% atk / +26% hp, `config.js:241-242`) the *multiplicative* ceiling is ×2.55 atk / ×2.33 hp — a large maxed-vs-fresh gap, but `dynamic_difficulty_v64.js:21` scales enemies +3%/avg-cultivate-level, so it's largely a treadmill.
**Recommendation:** Either flatten cost growth to **×1.6/level** or lift the L11–20 curve to a smoother +5→+3%/level so the top band is an aspirational grind, not a dead zone. Verify the treadmill (enemy +3%) doesn't make investment feel *pointless* — consider capping enemy scaling at +12% so cultivation buys a real, felt edge.

### F9 — `mango_arbalest` ranged-DPS outlier
`config.js:66`: atk 8, attack interval 0.55 s → **14.5 sustained DPS at long range** with armor-irrelevant projectile damage — higher sustained ranged DPS than the rare sniper (`blueberry_sniper` 7.4) and only nominally "rare." It over-performs its slot.
**Recommendation:** Raise interval **0.55→0.72 s** (→11.1 DPS) or drop atk 8→6, to sit it below burst backliners while keeping its "fastest fire" identity.

### F10 — Dead / duplicated constants
`ROLE_COUNTER_DMG=1.35 / SOFT=1.22 / WEAK=0.85` and the `COUNTER{}` map (`config.js:157-175`) are legacy; the live system uses `ROLE_COUNTER_MATRIX` (`config.js:178`). `SP_PASSIVE=3.0` (`config.js:288`) is shadowed by `TUNING.juice.passiveInterval=5.0`. These invite mis-tuning.
**Recommendation:** Delete the dead constants or add `// UNUSED` markers pointing at the live source, so a future balance pass edits the right numbers.

---

## 5. Dimension-by-dimension detail

### Dimension 1 — Unit & role balance
Base stats (Lv1) computed from `config.js:47-68`. `DPS = atk / speed` (speed = attack interval); `eHP = hp / (1 − armor/(armor+50))`; wall siege from `combat.js:377` `round((lvl*1.45 + atk*0.105) * siege)` per 1.05 s.

| Unit | rarity/role | atk | hp | atk-int | DPS | armor | mitig | eHP | move | siege | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| watermelon_guard | N/tank | 7 | 80 | 1.50 | 4.7 | 16 | 24% | ~105 | 76 | 0.75 | +shield skill L3 → ~150 eHP |
| coconut_guard | N/tank | 6 | 88 | 1.62 | 3.7 | 14 | 22% | ~113 | 72 | 0.65 | first-fight shield |
| avocado_brawler | R/tank | 5 | 96 | 1.65 | 3.0 | 18 | 26% | ~131 | 68 | 0.70 | +30% dodge → ~187 eff |
| grape_archer | N/back | 10 | 32 | 1.00 | 10.0 | 2 | 4% | ~33 | 86 | 0.90 | ramping same-target dmg |
| blueberry_sniper | R/back | 13 | 28 | 1.75 | 7.4 | 1 | 2% | ~29 | 72 | 1.05 | armor-pierce |
| mango_arbalest | R/back | 8 | 30 | 0.55 | **14.5** | 1 | 2% | ~31 | 68 | 0.92 | **F9 outlier** |
| cherry_bomber | R/back | 14 | 26 | 1.55 | 9.0 | 1 | — | ~27 | 74 | 0.88 | AoE every 5th |
| banana_raider | N/rush | 15 | 30 | 0.82 | 18.3 | 2 | 4% | ~31 | 118 | 0.95 | +45% first-hit vs backline |
| lemon_assassin | R/rush | 17 | 26 | 0.92 | 18.5 | 2 | — | ~27 | 126 | 0.80 | first crit ~×1.88 |
| olive_assassin | E/rush | 19 | 22 | 0.96 | **19.8** | 0 | 0% | 22 | 125 | 0.78 | stealth + crit ×2.5 |
| pineapple_lancer | N/front | 11 | 48 | 1.10 | 10.0 | 7 | 12% | ~55 | 90 | 0.95 | anti-rush |
| orange_cannon | R/siege | 10 | 40 | 1.65 | 6.1 (×0.72→4.4 vs units) | 4 | 7% | ~43 | 64 | **2.45** | siege specialist |
| pumpkin_roller | R/siege | 8 | 36 | 1.20 | 6.7 | 4 | 7% | ~39 | 96 | 1.55 | death explosion + stun |

Takeaways:
- **Rush is the top DPS tier** (banana 18.3 / lemon 18.5+crit / olive 19.8) as glass cannons (~22–31 eHP). Balanced by role and by `pineapple_lancer`'s anti-rush counter — fine.
- **Tanks are correctly sticky** (105–187 eff eHP with skills). That stickiness is *desired* for a frontline but is a co-author of the F2 gridlock; it's a system-interaction problem, not a per-unit overpower.
- **`orange_cannon` is a clean specialist**: deliberately bad at clearing (×0.72, `fruit_mechanics.js:34`) and great at siege (2.45). Good design. It is also the *only* siege unit in the DEFAULT_DECK, so merge RNG that starves oranges directly stalls the win condition — worth noting given F2.
- **`mango_arbalest`** is the one clear outlier (F9).
- **Rare/Epic vs Normal gap** is modest in raw stats (rush atk 15→17→19) — the real gap is *skill quality* (stealth, ×2.5 crit, armor-pierce), which is a healthy way to gate power.

**DEFAULT_DECK verdict** (`config.js:80` — watermelon_guard, grape_archer, banana_raider, pineapple_lancer, orange_cannon): well-rounded, covers 5 of 7 roles (tank/back/rush/front/siege), missing only control/support — an appropriate, legible starter. One structural risk: a single siege source for the actual win condition.

### Dimension 2 — Is the counter system meaningful?
See **F5**. Verdict: **real but secondary.** The matrix (`config.js:178-187`) genuinely swings even-level skirmishes and steers `findTarget` scoring (`combat.js:239-245` give counters −86/−40 score) and `sameLaneBlocker` (`combat.js:69`), so it shapes *who fights whom*. But applied pre-armor (`combat.js:472`) and dwarfed by `LEVEL_MUL` up to ×5, it rarely *decides* an exchange, and never decides a *match* because matches don't resolve. Moving it post-armor and widening anti-tank counters would make the core feel decisive.

### Dimension 3 — Economy & progression
See **F7/F8**. SP starts 8, +1/5 s, +1–7/kill, +3/25%-wall-lost, uncapped → not a real mid-game constraint. Merges are **free** and give ×1.3–1.4 power per level to a ×5 ceiling, so aggressive merging snowballs hard within a match — the *intra-match* curve is steep and satisfying. The *meta* curve (cultivation ×1.85 + star ×1.38, multiplicative, `config.js:225-242`) is steep on paper but flattened by the enemy +3%/level treadmill (`dynamic_difficulty_v64.js:21`). Econ support balls (`economy_balls_v62.js`) are implemented and coherent (kill_sp/refund/bank/discount/regen) but are moot while SP is already abundant; they'd matter more after F7 tightens SP.

### Dimension 4 — Boss design
Mechanics are thematically distinct and telegraphed with floating hints (`boss_v63.js:31-37`, `bossHintFor`): shield / artillery (mid-lane AoE, `boss_v63.js:79-95`) / twin_pressure / summon_aura. That's good design intent. The failures are (a) **F3** double-gating (body + wall) makes them unkillable, and (b) **F6** melon_king's global shield is anti-counterplay. Difficulty spikes at 5/10/15/20 are dramatic on the wall axis (140/280/450/650, `config.js:329,334,339,344`) but since walls aren't reached, the spike currently reads as a wall, not a fight. Fix F1+F3+F6 and the boss mechanics become the legible skill-checks they were designed to be.

### Dimension 5 — Stalemate root cause (quantified)
Chain of causation, all measured:
1. **No resolution** other than wall→0 (`combat.js:788-789`, **F1**).
2. **Saturation** at 24 units/side (`config.js:286`) with continuous symmetric reinforcement (`SPAWN_COOLDOWNS`, `config.js:284`) — sim `avgMaxUnits=24`.
3. **Always-a-target geometry**: `SCAN_RANGE=168` > midfield gap ~127 (`combat.js:12`, `FIELD_H=254`), so `advanceTowardWall` rarely runs → walls not reached (**F2**).
4. **Comeback lever reinforces the stall**: wall-pity feeds the *defender* SP (`juice_economy.js:177-194`).
5. **Anti-stall window can't fire** (needs 0 live enemies, `combat_pacing_v19.js:82`, **F4**).
6. **Bosses** add an unkillable blocker on top (**F3/F6**).

Siege is *not* the culprit: a full siege lane throughput is ~90 wall DPS (3 Lv5 orange_cannons ≈ 3×26/1.05 + up to +24% assist, `combat.js:404`), which would break a 140 boss wall in ~1.5 s **if reached**. The bottleneck is entirely "reach the wall," i.e. F1+F2. **Fixing F1 (timer + wall-% tie-break) is the highest-leverage single change** — it makes every currently-infinite stage resolvable overnight — with F2 (lower cap + commit-to-wall) as the follow-up that makes the resolution feel earned rather than clock-driven.

---

## 6. What's working well

- **Real-combat sim harness** (`test/stage-real-sim.js`) that drives the *actual* combat/economy/AI headlessly is rare and valuable infrastructure — it made this diagnosis quantitative rather than hand-wavy. Keep and extend it (add the F1 timer + a "timeout=stalemate" explicit column).
- **Siege specialization is clean:** the `siege` stat spread (0.05–2.45) and orange_cannon's ×0.72 clear penalty (`fruit_mechanics.js:34`) give a genuinely distinct role that reads correctly ("great at walls, bad at bodies").
- **Armor curve** `armor/(armor+50)` (`fruit_mechanics.js:37`) is a sound diminishing-returns model — 16 armor = 24% reduction, asymptotic, never immunity. Good bones.
- **Merge = free leveling** is a readable, satisfying core loop; `LEVEL_MUL` (`config.js:218`) is a smooth, legible curve.
- **DEFAULT_DECK** is thoughtfully role-complete for a starter (5/7 roles).
- **Counter UX** is strong: color-coded floating 克制/优势/受制 text with rings (`combat.js:492-501`, `roleFxColor` `config.js:203`) teaches the system without a lookup table.
- **Boss mechanics are thematically distinct and telegraphed** with hint text — the *design* is right even though the *numbers* currently gate them out of reach.
- **Comeback/anti-frustration scaffolding exists** (wall-pity SP, dynamic-difficulty treadmill) — the levers are present; they just need re-pointing so they resolve stalls instead of feeding them.

---

## 7. Priority action list (do in this order)

1. **F1** — Ship a match clock (normal 75 s / boss 110 s) with wall-%-remaining resolution + damage tie-break. Highest leverage; unblocks the entire mid/late game.
2. **F2** — `MAX_SOLDIERS` 24→14 and add the commit-to-wall rule (≤70 px to wall & no forward enemy within 90 px → siege, ignore cross-lane).
3. **F3 + F6** — Cut boss body eHP (~40%) and scope/telegraph melon_king's shield (+25 global → +12 nearest-3, 1 s tell).
4. **F4** — Re-trigger the reinforce-pause on lane-power dominance (<40% for >2 s), not annihilation.
5. **F5** — Move the counter multiplier post-armor; widen anti-tank counters.
6. **F7–F10** — Tighten SP (cap 24, flat kill-SP), smooth cultivation L11–20, nerf `mango_arbalest`, delete dead constants.

*All numbers above are hypotheses to validate in the existing sim harness after each change; re-run `node test/stage-real-sim.js` and expect boss/late-stage win rates to move off 0% and `avgMaxUnits` to drop below the cap once F1+F2 land.*
