# Ship Fight v0.2.0 — handoff to the Arcade chat

Demo only. Nothing has been pushed to GitHub.

## New in v0.2.0
- **Home:** Battle and Campaign are two square buttons. Battle opens a sheet where you choose the rules (modifiers), then tap a difficulty to go straight to fleet placement.
- **Modifiers** (`SHAPES`, `FLEETS` and `makeRules()` in `engine.js`). Every combination is tested: random fleets are legal, and the AI never fires at land, cleared water or a used cell.
  - **Sea shapes:** Classic 10×10, Strait 8×8, Narrows 12×8, Open Ocean 12×12, Atoll (ring round an island), Cross (12×12, no corners), Archipelago (10×10, 4–5 random islands, saved with the game).
  - **Fleet size:** Light (3 ships: 4, 3, 2), Standard (5), Armada (7: adds a Frigate 3 and a Patrol Boat 2).
  - **Touching:** allowed, or not allowed (not even diagonally). With no touching, the water around a sunk ship is marked clear for both sides and can't be fired at; it doesn't count as shots.
  - Battle XP scales with fleet size (Light ×0.5, Armada ×1.3). The hit-rate star target scales with how crowded the sea is. "Best" (fewest shots) is only recorded under classic rules.
- **Campaigns** (`CAMPS` in `core.js`): Coastal Waters (Easy AI), Open Seas (Normal) and Deep Waters (Hard), with 10 levels each.
  - Each level has its own modifiers as twists. Levels 9–10 bring in the next AI to prepare for the next campaign.
  - Levels unlock in order, and a campaign unlocks when the previous one is finished.
  - Stars are the usual three. Each new star pays 5/8/12 XP, the first time only, plus 50/100/150 XP for finishing a campaign.
  - New achievements: Ensign, Captain and Commodore for finishing each campaign (they unlock the Anchor hit marker, the Storm sea and the Salute win effect), and Perfect Voyage for 3 stars on every level of a campaign.
- **Daily Hunt** is unchanged and stays on classic rules. The two pinned fingerprints still match, so every device still gets the same fleet as v0.1.0.
- **Save:** new `defSave()` fields `mods`, `camp` and `campTab`. A battle saved by v0.1.0 resumes as classic rules (tested).
- The kickoff's "later" list included shaped seas and the no-touching rule; both are now in. Salvo, hex, wraparound, challenge codes and pass-and-play are still later.

Built 2026-11-23 from the kickoff doc (`ship-fight-kickoff.md` in the Arcade Game Lab project) and a read-only copy of Sweep v1.2.1 (`github.com/Allasdair/sweep`, `main`).

## Files

```
ship-fight/
  src/app.html          UI, shell, screens, drawing, audio, particles (adapted from Sweep's app.html)
  src/engine.js         rules, placement, Sea, AI (easy/normal/hard), Match, seeded RNG, Daily Hunt
  src/core.js           save (defSave/loadSave), XP/levels, achievements, cosmetics, Arcade contract (summary, applyArcade)
  src/i18n_0_ui.js      translation tables, Sweep's format: [en, es, fr, de, pt]
  src/i18n_1_game.js
  src/i18n_2_progress.js
  src/i18n_3_modes.js   Battle menu, modifiers, campaigns (campaign and level names stay English, like cosmetic names)
  tests/run.js          node tests/run.js   (Node only, no dependencies; QUICK=1 runs 1,000-game sims)
  tests/engine.test.js  placement, rules, Clean Sink, AI fairness, 10,000-game sims, Daily Hunt determinism and par
  tests/mods.test.js    all 42 modifier combinations, no-touch clearing, rules saved with a match, campaigns and their XP
  tests/core.test.js    defSave on old saves, resume mid-game, arcade.v1 settings, summary record, XP/stars/achievements
  tests/layout.js       node tests/layout.js (needs Playwright + Chrome): no sideways scroll at 360/390 px in en/de,
                        drag-and-drop placement, Arcade build contract checks
  build.py              python3 build.py → dist/
  dist/shipfight/index.html   Arcade build: window.__ARCADE__=1, links ../fonts.css, strict CSP
  dist/standalone.html        single file, fonts inlined (read from ../sweep/web/fonts if present), strict CSP
  dist/demo.html              standalone without the CSP meta, for the claude.ai artifact preview
```

One change from the kickoff's file list: the save/progression/Arcade-contract code lives in `src/core.js` (no DOM) instead of inside `app.html`, so the tests can check it directly. `build.py` inlines `engine.js`, then `core.js`, then the i18n tables at the `/*ENGINE*/` placeholder, as Sweep does.

## What the Arcade chat does

1. Copy `ship-fight/` next to `sweep/` in the Arcade workspace.
2. Replace the placeholder registry entry `{id:'battleship', name:'Battleship', soon:true}` with:
   `{id:'shipfight', name:'Ship Fight', desc:'Naval battle vs AI', path:'shipfight/index.html', prefix:'shipfight.', art:'ship'}`
3. Extend Arcade's `build.py` to build Ship Fight into `dist/shipfight/index.html` the same way it builds Sweep. The simplest route is to run `python3 ship-fight/build.py` and copy `ship-fight/dist/shipfight/index.html`. It already sets `window.__ARCADE__=1` and links `../fonts.css`.
4. **Check the two navigation targets** at the top of the second `<script>` in `src/app.html`:
   `const ARCADE_HOME='../index.html', ARCADE_PREFS='../index.html#prefs';`
   These are used by "‹ Arcade", the Android back button on the home screen, and the "Arcade settings" row. Change them if Arcade's home or settings page lives elsewhere.
5. Check that the combined backup includes the `shipfight.` prefix, and that the Achievements screen shows a Ship Fight section from `arcade.summary.shipfight`.
6. Run Arcade's flow tests, plus `node tests/run.js` for both games (and `node tests/layout.js` for Ship Fight if Playwright is installed).
7. Republish the Arcade demo. Still no GitHub push.

## Arcade contract, as implemented

- **Storage:** Ship Fight writes `shipfight.v1` and, in Arcade mode only, `arcade.summary.shipfight`. It reads `arcade.v1` and never writes it. (A one-off `shipfight.probe` key is written and removed at start-up to check that storage works.)
- **Arcade mode:** `const ARCADE=!!window.__ARCADE__`. After loading the save, the shared settings `appearance, motion, sfx, music, haptics, fullscreen, cb, lefty, lang` are copied from `arcade.v1.set`, and the name from `arcade.v1.name`. They're re-read on a back/forward-cache return (`pageshow`).
- **Standalone copies are kept:** while running in Arcade, `shipfight.v1` keeps Ship Fight's own standalone values of the shared settings. Arcade's values are used in memory only.
- **Summary:** written 300 ms after each save, immediately when leaving for Arcade, and when the page is hidden:
  `{v:1, game:'shipfight', ver:'0.2.0', level, maxLevel:10, xp, xpLevel, xpNext, ach:[[name,desc,done]×12], hi:[['Wins',…],['Best Daily Hunt','47 shots' or '—'],['Hard wins',…]], last}`
- **Navigation:** "‹ Arcade" at the top of home (hidden when standalone). Leaving saves; battles and the Daily Hunt resume where they were. The Android back button closes an open sheet, then returns to home, then (on home, in Arcade) goes to Arcade.
- **Settings inside Arcade:** AI shot speed, Show the AI's last shot, Tap twice to fire, How to play, What's new, Ship Fight backup, and an "Arcade settings" row. Shared settings are not shown.
- **Backup:** `SHIPFIGHT1Z.` (gzip + base64) or `SHIPFIGHT1.`. It covers `shipfight.v1` only, including a battle in progress.
- **CSP:** `default-src 'self'`, inline scripts and styles, `data:` fonts and images, no outside requests. No page hashes are used.

## Decisions taken (kickoff section 12, all easy to change)

1. The 4-long ship is the **Dreadnought** (`FLEET` in `engine.js`). "Battleship" appears nowhere in the game.
2. **Max level 10**, using Sweep's first 10 steps (`LV` in `core.js`).
3. **Ships may touch** (classic).
4. **One shot per turn**, hit or miss.
5. **Portrait:** enemy sea large, your fleet as a mini-map below that takes the leftover height (42–62% of the enemy sea). Landscape puts the two side by side.

## AI tuning (10,000 simulated games per level)

| Level | Average shots to win | Kickoff target |
|---|---|---|
| Easy | 89.4 | about 90+ |
| Normal | 54.9 | 55–65 |
| Hard | 44.5 | 42–50 |

- **Easy:** random shots; with an unsunk hit it tries a neighbour 10% of the time. At the kickoff's "half the time" it averaged 66 shots, far stronger than intended.
- **Normal:** parity hunt spaced by the smallest ship afloat, then neighbours, then the line. It forgets leftover hits after each sink ("back to hunting after a sink"), which is what brings it up from 51 to 55.
- **Hard:** a probability map over every legal placement of every remaining ship. Placements covering unsunk hits are weighted 40× per hit.
- **Fairness:** the AI holds only its own view of your sea. Tests show that two different fleets giving the same shot results get identical AI choices.

## Daily Hunt par check (120 daily fleets × 20 runs)

| Play style | Average | ★ | ★★ | ★★★ |
|---|---|---|---|---|
| Like the Normal AI | 54.5 shots | 93% | 58% | 20% |
| Like the Hard AI | 43.7 shots | 100% | 88% | 60% |

The placeholder par (70 / 55 / 45) holds up: three stars needs near-optimal play. The fleet is seeded from the date (`SFDH1|YYYY-MM-DD`, cyrb128 → sfc32 as in Sweep's League). It's identical across runs for 120 days, and two dates are pinned by fingerprint in the tests.

## Open items for playtesting

- Levels 4 and 6–10 have no reward (the kickoff's cosmetics list is small). Show them as "—" for now, or add items.
- The 60%-accuracy Sharpshooter and the match accuracy stars are first estimates.
- Translations are machine-assisted and need a native-speaker pass. In particular, ship names in es/fr/pt use the local word for a battleship-type ship ("Acorazado", "Cuirassé", "Encouraçado"); German keeps "Dreadnought".
- Not yet tried on a real phone (tested in headless Chrome at 360, 390 and 1280 px, touch and mouse).
- "Ship Fight" name: the quick search found no registered mark. Run a proper check before any public release (not legal advice).
