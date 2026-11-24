# Drift v0.1.0 — handoff to the Arcade chat

Demo only. Nothing has been pushed to GitHub.

Built 2026-11-24 from the kickoff doc (`claude/drift-kickoff.md` in the Arcade Game Lab project), using Linefall v0.1.0's ZIP as the template (console UI, multi-touch zone, fixed-timestep loop, i18n watcher, Web Audio synth, `core.js` / `build.py` / test setup). The Arcade contract follows `claude/arcade-integration.md`.

**Private playable demo:** https://claude.ai/artifact/52CotGSfgoQt1pJuXDRELx (`dist/demo.html`)

**For the Arcade build:** game id `drift`, Arcade build file `dist/drift/index.html`, "‹ Arcade" button `#arcadeBtn`, settings button **`#settingsBtn`**.

## What's in v0.1.0
- **Normal mode:** Easy / Normal / Hard, then 11 modifiers (wrap, density, rock speed, rock types, power-ups, hunter drones, drag, gravity well, ricochet, lives, fog). Choices are remembered, the score multiplier and par time are shown, and a Defaults button resets the modifiers. Win stars: clear, no lives lost, under par. Records: best score and best time per difficulty × wrap, with a separate best for modified runs.
- **Campaign:** three campaigns × 15 levels (135 stars), linear unlocks (clear a level → next; clear level 15 → next campaign). Each level is a recipe with a fixed seed, following the kickoff's mix: 1–3 basics, 4 wrap, 5 and 9 new rock types, 7 and 14 twists, 8 drone swarm (Easy 8 introduces Shield), 12 storm, 15 boss. Bosses: **Titan** (30 hits, sheds 2 Larges at 2/3 and 1/3, breaks into 3 Larges), **Bastion** (armoured shell; only 3 rotating glowing cracks take damage; sheds Mediums every 6 damage; calls a drone at half health), **Leviathan** (volatile core shielded by a ring of 8 orbiting rocks; pulls the ship in, pulses shockwaves every 4 s, 2 escort drones that respawn).
- **Endless:** waves of incoming rocks, 3 s break between waves, wave-clear bonus 100 × wave. Rock types from wave 3, drones from wave 6, faster drones from wave 12, speed capped at Hard's. Wrap and gravity well are choosable. Milestones every 5 waves (25 XP rising by 5, max 50 each, 200 a run), paid as they're reached. 4 expeditions. "Continue run" on home; starting a new run past wave 5 (or restarting from pause) needs a second tap.
- **Progression:** XP per the kickoff, levels on Sweep's first 10 steps with a reward at every level 2–10, 22 achievements, 4 expeditions, 35 cosmetics (7 ships, 6 rock styles, 6 colour themes, 4 trails, 3 bullet styles, 3 win effects, 4 soundtracks, 2 sound packs). The Style screen draws each item in its card.
- **Console UI:** Linefall's (57% screen, control zone the only in-game touch area; wide console in landscape). Layouts: **D-pad + A/B** (A fire, B dash), **D-pad only** (fire is automatic while a rock is in range), **Thumbstick** (left half drag to steer and thrust, right half hold to fire, double-tap to dash). Select = power-up, Start = pause. Steering: **Direct** (default; 8 directions) or **Classic**. Auto-fire: On / Hold A / Off. Left-handed swap, Normal/Large buttons, haptics.
- **Keyboard:** arrows (or WASD) steer, Space fire, Shift or X dash, C power-up, P or Esc pause.
- **Look and feel:** seeded irregular rocks with a crack per hit, white hit flash and knock-back, debris and shake, thruster flame and trail, muzzle flash, protection blink, shield bubble, dash streak, combo multiplier, score popups, entry warnings at the field edge, edge arrows to off-screen rocks heading your way, a radar (hidden on Easy, where the whole field is visible), soft-wall glow, danger pulse, a last-kill slow-motion moment, fog. Reduce motion / Animations off: no shake or slow motion, fewer particles, short trails. Colourblind-safe: every object type differs by shape (ship, hexagonal drones, diamond drone shots, rounded power-up badges with symbols; rock types marked by rivets, a glowing core, frost lines, field arcs or sparkles), plus an Okabe-Ito palette option.
- **Sound:** all synthesized live. Effects for fire, hit, clank (armour), break (lower for bigger rocks), explosion, dash, pickup/swap/use, shield up/break, shockwave, drone in/shot, entry ping, life lost, extra life, combo, boss entry/stage/pulse, wave, level clear, countdown, plus a thruster hum that rises with speed. Soundtracks: **Orbit** (new, 110 BPM, E minor; default), **Afterburn** (new, 128 BPM, D minor; level 7), Sweep's **Daylight** and Linefall's **Signal** (both available from the start). A darker boss variant of Orbit plays on level 15; music layers in as more rocks are on screen.
- **Saving:** a run saves on pause, Save & quit, backgrounding and page hide, and resumes with a 3-2-1 countdown.
- **Languages:** Sweep's i18n watcher. `src/i18n_0_ui.js` holds 111 rows shared with Linefall; `src/i18n_1_drift.js` holds Drift's own 250 rows. Machine-assisted es/fr/de/pt-BR. Level, boss, cosmetic and achievement names stay English.

## Files
```
drift/
  src/app.html         UI, console layout, canvas drawing, camera, radar, input zone, audio, particles
  src/engine.js        world, wrap, ship physics, bullets, rocks and splitting, rock types, power-ups, drones,
                       bosses, spawning and queue, collisions (spatial hash), Endless waves, bots
  src/core.js          save, XP/levels, stars, records, expeditions, achievements, cosmetics, backup, Arcade contract (no DOM)
  src/levels.js        the 45 recipes, par times, level tips, the Endless wave table
  src/i18n_0_ui.js     translation rows shared with Linefall
  src/i18n_1_drift.js  Drift's own translation rows
  fonts/               Inter, JetBrains Mono (SIL OFL, licences included), inlined into the standalone builds
  tests/run.js         node tests/run.js   (Node only; QUICK=1 for short sims; ~7 s)
  tests/layout.js      node tests/layout.js (Playwright + Chrome; run python3 build.py first; ~70 s)
  tests/sim.js         node tests/sim.js levels|normal|endless [N]  (long bot sims for tuning)
  build.py             python3 build.py → dist/
  dist/drift/index.html   Arcade build: window.__ARCADE__=1, links ../fonts.css, strict CSP
  dist/standalone.html    single file, fonts inlined, strict CSP
  dist/demo.html          standalone without the CSP meta, for the claude.ai artifact preview
```

## What the Arcade chat does
1. Unzip into `games/drift/`.
2. Add a registry entry: `{id:'drift', name:'Drift', desc:'Thrust, shoot, clear the field', path:'drift/index.html', prefix:'drift.', art:'drift'}` and add `drift` card art.
3. Add the build step: id `drift`, folder `games/drift`, Arcade build file `dist/drift/index.html`, settings button **`#settingsBtn`**. Add a cache part in the service worker and rows in `tests/games_flow.py` (name "Drift", "‹ Arcade" button `#arcadeBtn`, settings button `#settingsBtn`, settings screen `#set`) and `tests/offline_test.py`.
4. Run the import check (it should print `ok, nothing to fix`: the source leaves with `location.replace` through `leaveTo(url)` and handles `#game-settings`), Arcade's flow and offline tests, and `node tests/run.js` for every game.
5. Republish the Arcade demo. Still no GitHub push.

## Arcade contract, as implemented
- **Storage:** writes `drift.v1` and, in Arcade mode only, `arcade.summary.drift`. Reads `arcade.v1`, never writes it. A one-off `drift.probe` is written and removed at start-up.
- **Arcade mode:** `const ARCADE=!!window.__ARCADE__`. After the save loads, `appearance, motion, sfx, music, haptics, fullscreen, cb, lefty, lang` and `.name` come from `arcade.v1`, in memory only (`P`), re-read on `pageshow`. `drift.v1` keeps the standalone values.
- **Summary:** 300 ms after each save, immediately when leaving, and on page hide: `{v:1, game:'drift', ver:'0.1.0', level, maxLevel:10, xp, xpLevel, xpNext, ach:[[name,desc,done]×22], hi:[['Best Endless wave',…],['Campaign stars','n/135'],['Best score (Hard)',…]], last}`.
- **Navigation:** `const ARCADE_HOME='../index.html', ARCADE_PREFS='../index.html#prefs';` Leaves with `location.replace(…)` only. "‹ Arcade" on home (hidden standalone). Android back: in a game it pauses first; then closes a sheet; then returns home; then, on home in Arcade, goes to Arcade.
- **`#game-settings`:** opens the settings screen and clears the hash with `history.replaceState`. No other hashes are used.
- **Settings inside Arcade:** layout, steering, auto-fire, button size, danger pulse, camera lead, radar size, How to play, What's new, Drift-only backup (`DRIFT1Z.` gzip / `DRIFT1.` plain), and an "Arcade settings" row. Shared settings (including left-handed) are hidden.
- **No service worker. CSP:** `default-src 'self'`, inline scripts and styles, `data:` fonts and images, no outside requests.

## Engine notes
- `step(st, inputs)` is pure: one 60 Hz tick, no DOM or timers, all state plain JSON. Inputs are `['p'|'r', key]` for left/right/up/down/fire, `['p','dash']`, `['p','use']`, and `['stick', ax, ay]` (−64..64).
- Determinism: all randomness from the run's seeded RNG (cyrb128 → sfc32); angles are 256 steps from a rounded sine table, and direction → angle is a table search (no `atan2` / `sin` / `cos` in the logic). Tests check same seed + inputs → same fingerprint, and that a save mid-boss resumes exactly.
- Collisions: circles everywhere, a spatial hash (128-unit cells) over rocks, wrap-aware distances across seams. Bosses bounce off soft walls instead of escaping.
- Loop: Linefall's fixed-timestep accumulator, at most 4 catch-up ticks per frame; the last-kill slow motion runs the accumulator at ⅓ speed for 45 ticks (logic is unaffected). A hidden page pauses.
- Bullet cap: 6 normally, ×3 with Spread, ×2 with Rapid (so the power-ups aren't throttled by the cap).

## Tuning from the bot sims
Two bots play through `step()` with real inputs (aim with lead, keep a safe distance, sidestep threats, dash when a hit is about to land; casual reacts slower, aims worse and rarely dashes).
- **Par times** (third star): casual-bot median clear time × 1.15, 8 runs per level, stored in `PAR` in `levels.js`. Normal mode par: Easy 2:05, Normal 5:30, Hard 10:05 at Normal density (scaled by density).
- **Every level is cleared by the strong bot** (`tests/run.js` checks all 45). The casual bot clears all Easy and Normal levels; it struggles on **Hard 7 (gravity well), 13 (all-sides wrap), 14 (one life + fog) and 15 (Leviathan)** at about 50% (flagged in `tests/sim.js`). That may be right for the hardest campaign, but they're the first levels to check by hand.
- **Endless:** casual bot ~wave 10–13, strong ~wave 19–20 (kickoff target: 8–10 and 20+). The bots see the whole field (no fog, no camera), so a real casual player should land lower.
- Changes made from the sims: Hard campaign rock speed eased slightly (0.82× → 1.02× of Hard's across the campaign), the gravity-well level has 20% fewer rocks, Leviathan's level has 8 incoming rocks instead of 12, and spawning now waits while more than 2 × "calm" + 2 rocks are in play (with all-sides wrap, rocks never leave, so the old timer let the field overfill and the casual bot failed every time).

## Tests
- `node tests/run.js`: 330 checks. Angles; ship thrust, drag (slides to a stop in ~2 s), true space, brake, turn rate, Direct steering (short way, diagonals, tap-to-aim), thumbstick; fire rate, 6-bullet cap, range ≈ 70% of the view, inherited speed, the four fire modes; dash distance, 0.3 s invincibility, 3 s cooldown, Close Call; hits per size, splits, scores, knock-back, combo build-up/cap/reset, speed and score multipliers, world sizes; all three wrap modes for ship/bullets/rocks, collisions across a seam, soft walls, escaped rocks re-queued, ricochet; incoming counts and mix, progress bar, entry warnings ~1 s ahead, no rock aimed at a protected ship (200 entries), the win condition; lives, safe respawn, protection ending early, extra lives up to 5, game over; power-up drop rates over 10,000 kills, pickup, single slot and swap, all five effects, Shield with no timer; all six rock types incl. volatile chains and magnetic pull; drone timing, path, shots, 2 hits, 200 points, shots breaking rocks; each boss's stages; determinism and mid-boss resume; all 45 recipes (counts, introductions, twists, fixed seeds) and the strong bot clearing each; Endless escalation, break and bonus; core (old saves, XP levels, a reward at 2–10, cumulative stars, unlocks, campaign bonus, Normal win stars and records, milestone and expedition XP, losses earn nothing, backup round trip); the Arcade contract.
- `node tests/layout.js`: 123 checks. No sideways scroll at 360 and 390 px in English and German on every screen and sheet; German shows no untranslated English; the ship starts clear of the HUD and radar at 360 px on every difficulty; screen touches ignored; holding ▲ while pressing A both register (and release); one thumb holds a diagonal; B / Select / Start; Android back pauses; reload → Continue → resume; keyboard; all three layouts and both steering styles; left-handed swap; Hard with 40+ rocks and the Leviathan draws in under 10 ms a frame (90th percentile); standalone CSP and no outside requests; the whole Arcade build contract.

## Decisions taken (kickoff section 16, all easy to change)
1. **Medium splits:** seeded 2 or 3 (the proposal).
2. **Default steering on phones:** Direct.
3. **Starting lives:** 3 everywhere.
4. **Default wrap:** None.
5. **Power-up drop rate:** Small 3%, Medium 4%, Large 7%; Gold always drops one. Measured 4.0% on Mediums.

Also decided along the way:
- **Object sizes and view:** the first estimate (800-unit view, ship radius 14) made everything tiny on a 360–412 px phone. The view is now **700 units** across the short side on Normal and Hard, and every radius is ×1.25 (ship 18; rocks 20/38/62; bosses 138, Leviathan's core 78). Bullet range kept at ~70% of the view (490 units).
- **Direct steering and the brake:** in Direct, ▼ points the ship down, so there is no brake key; drag stops the ship. A tap (under 0.1 s) only aims; holding thrusts once the ship faces within ~67°. Classic keeps ▼ = brake.
- **Easy 7 "No brake"** also halves drag (the ship glides), so the twist matters in Direct steering too.
- **D-pad only** keeps B for dash; A is hidden since fire is automatic.
- **Auto-fire On** waits until spawn protection ends, so it doesn't cancel protection instantly.
- **Drone kills of rocks** split them but score nothing; volatile explosions and shockwaves you cause do score.
- **Endless** uses the Normal field (1200 × 1500) with difficulty ×1 (×1.2 with the gravity well).
- **Daylight and Signal** are owned from the start; Afterburn unlocks at level 7.

## Open items for playtesting
- Not yet tried on a real phone. Object sizes, the 700-unit view, Direct steering's tap-to-aim window, thrust (0.2/tick), drag and the thumbstick radius (60 px) all need the Galaxy S20 FE.
- Hard 7, 13, 14 and 15 are the levels the casual bot finds hardest (above).
- Score multipliers and par times are first estimates from the bots.
- In the claude.ai preview, "Save to file" in Backup does nothing (the viewer blocks downloads); Copy works. It works in the standalone and Arcade builds.
- Translations are machine-assisted.
- **Name:** "Drift" is a working title. A registered "DR!FT" mark covers mobile game software and "DRIFT" was filed for software; check properly or move to a compound name (Driftfield, Rockdrift, Drift Belt) before any public release (not legal advice). The word "asteroids" is not used anywhere in the game.
- **Later (not in the demo):** daily/League (only if wanted), challenge codes, co-op/versus, more boss designs, rescue/escort levels.
