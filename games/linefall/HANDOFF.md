# Linefall v0.1.0 — handoff to the Arcade chat

Demo only. Nothing has been pushed to GitHub.

Built 2026-11-23 from the kickoff doc (`claude/linefall-kickoff.md` in the Arcade Game Lab project) and a read-only clone of Sweep v1.2.1 (`github.com/Allasdair/sweep`, `main`, commit `ab7cecd`). No Snake or 2048 ZIPs were attached, so the shell pieces (i18n watcher, Web Audio synth, Daylight, fonts, seeded RNG) came from Sweep and the fixed-timestep loop was built fresh. The Arcade contract follows `claude/arcade-integration.md`.

**Private playable demo:** https://claude.ai/artifact/CdHtUPx36KeKmDFQnFjXsB (`dist/demo.html`)

## What's in v0.1.0
- **Classic:** endless. The setup sheet chooses the board (Small 8×16, Medium 11×22 default, Large 14×24), speed (1×, 1.5×, 2×), piece set (Classic, Kind, Junior, Pentomix, Chaos), Next previews (5/3/1), and Hold, Ghost, Rising garbage and Fading stack. Choices are remembered and the score multiplier is shown.
- **Campaign:** 30 levels in 3 chapters (Basics, Pressure, Mastery), 5 stars each (150), 3 stars opens the next level. Each chapter has 3 Sprint, 2 Survive, 2 Score Attack, 1 Dig, 1 Puzzle and 1 Restricted level, ending on a finale. Fixed seeds per level.
- **Daily Blitz:** a 3-minute score attack. The seed `LFD1|YYYY-MM-DD` picks one of 30 curated combos and deals the piece order. One scored attempt (saved and resumable, clock pauses with the game), then unlimited practice on the same piece order. Share line, e.g. `Linefall Daily · 23 Nov · Medium · 1× · Kind · Rising · 50,000 · 40 lines · ★★☆`.
- **Records:** best score for every board × speed × piece set, Daily best, streak and the last 7 Dailies, lifetime stats.
- **Progression:** XP (Classic 1 per 5 lines × speed, capped 50; campaign 5/8/12 per new star + 50/100/150 per chapter; Daily 20, ×2 on its day), 10 levels on Sweep's first 10 steps, a reward at every level 2–10, 25 achievements, 30 cosmetics (7 palettes, 4 block styles, 5 board themes with their own clear and lock effects, 5 bezels, 3 soundtracks, 4 new-best effects, 2 sound packs).
- **Console UI:** the screen (57% of the height) shows the game only; touches on it are ignored in play. The control zone below is the only in-game touch area. Three layouts in Settings → Controls: D-pad + A/B (default), D-pad only, Swipe pad. Select = Hold, Start = Pause in every layout. Multi-touch (each pointer tracks its own button, and a finger can roll between D-pad arms), left-handed swap, Normal/Large buttons, repeat delay 100–250 ms (160), repeat rate 0–50 ms (33), soft drop 10×/20×/instant. Wide screens get a wide console (D-pad, screen, A/B side by side).
- **Keyboard:** ◀ ▶ move, ▼ soft drop, Space hard drop, ↑ or X rotate clockwise, Z rotate counter-clockwise, C or Shift hold, P or Esc pause.
- **Game feel:** theme line-clear effects (wipe, shatter, dissolve, flash) and lock effects (flash, dust, ripple), hard-drop trails, Quad bezel pulse and shake, danger glow and heartbeat in the top 4 rows (the music drops to a lighter mix), top-out greying from the bottom up, popups for Quad/Twist/back-to-back/combo/Clean Sweep. Animations off or Reduce Motion: no shake, trails or particles; clears fade.
- **Sound:** synthesized live. Effects for move, rotate, lock, hold, clears (pitch rises with lines), Quad fanfare, Twist chime, rising combo notes, Clean Sweep, level up, heartbeat, top-out and countdown. Soundtracks: **Signal** (new, 120 BPM, A minor, driving; default), **Afterglow** (new, 92 BPM, D major, half-time; level 7) and Sweep's **Daylight** (level 3). Tempo rises slightly with level. Soft and Chiptune packs.
- **Saving:** a game in progress saves on pause, Save & quit, backgrounding and page hide, and resumes with a 3-2-1 countdown (Continue on home; the Daily scored attempt resumes from its card).
- **Style screen:** laid out like Sweep's: tabs (Colours, Blocks, Boards, Consoles, Sounds, Effects) and a grid of cards, each previewing the item itself. Palettes, block styles and board themes draw a small board scene in that item; consoles draw a mini console in that bezel. Locked cards are greyed with a lock badge and their unlock line ("Reach level 8", "Unlock: Finish Chapter 3"). Tapping a sound pack plays a sample and tapping an effect plays it, even while locked; tapping an owned item uses it. The header shows owned/total (16/30 at level 5).
- **Languages:** Sweep's i18n watcher with `src/i18n_0_ui.js` (`[en, es, fr, de, pt]`), machine-assisted. Labels built from parts ("Medium · 1× · Classic") translate part by part. Level, cosmetic and achievement names stay English, as in Sweep.

## Files
```
linefall/
  src/app.html        UI, shell, console layout, canvas drawing, input zone, audio, particles
  src/engine.js       board, pieces and sets, rotation and kicks, bag RNG, gravity/lock/DAS, scoring, Twist, garbage, fading, goals, bot
  src/core.js         save, XP/levels, stars, records, achievements, cosmetics, backup, Arcade contract (no DOM)
  src/levels.js       the 30 campaign levels, the 3 puzzles (with stored solutions), Dig layouts, the Daily table
  src/i18n_0_ui.js    translation table, Sweep's format
  fonts/              Inter, JetBrains Mono (SIL OFL, licences included), inlined into the standalone builds
  tests/run.js        node tests/run.js   (Node only; QUICK=1 for shorter bag checks; ~16 s)
  tests/layout.js     node tests/layout.js (Playwright + Chrome; run python3 build.py first; ~60 s)
  tests/sim.js        node tests/sim.js levels|daily|classic [N]  (long bot sims for tuning)
  tests/gen_puzzles.js  rebuilds and verifies the 3 puzzles
  build.py            python3 build.py → dist/
  package.json        dev dependency: playwright (only for tests/layout.js)
  dist/linefall/index.html   Arcade build: window.__ARCADE__=1, links ../fonts.css, strict CSP
  dist/standalone.html       single file, fonts inlined, strict CSP
  dist/demo.html             standalone without the CSP meta, for the claude.ai artifact preview
```
`build.py` fills `/*ENGINE*/` in `app.html` with `engine.js`, `levels.js`, `core.js`, then the i18n tables.

## What the Arcade chat does
1. Unzip into `games/linefall/`.
2. Add a registry entry (there's no placeholder card):
   `{id:'linefall', name:'Linefall', desc:'Stack, clear, keep it falling', path:'linefall/index.html', prefix:'linefall.', art:'linefall'}`
   and add `linefall` card art.
3. Add the build step: id `linefall`, folder `games/linefall`, Arcade build file `dist/linefall/index.html`, settings button id **`#settingsBtn`**. Add a cache part in the service worker and rows in `tests/games_flow.py` and `tests/offline_test.py`.
4. Run the import check (it should print `ok, nothing to fix`: the source already uses `location.replace` and handles `#game-settings`), Arcade's flow and offline tests, and `node tests/run.js` for every game.
5. Republish the Arcade demo. Still no GitHub push.

## Arcade contract, as implemented
- **Storage:** writes `linefall.v1` and, in Arcade mode only, `arcade.summary.linefall`. Reads `arcade.v1`, never writes it. A one-off `linefall.probe` is written and removed at start-up.
- **Arcade mode:** `const ARCADE=!!window.__ARCADE__`. After the save loads, `appearance, motion, sfx, music, haptics, fullscreen, cb, lefty, lang` and `.name` come from `arcade.v1`, in memory only (`P`), re-read on `pageshow`. `linefall.v1` keeps the standalone values.
- **Summary:** 300 ms after each save, immediately when leaving, and on page hide:
  `{v:1, game:'linefall', ver:'0.1.0', level, maxLevel:10, xp, xpLevel, xpNext, ach:[[name,desc,done]×25], hi:[['Best score (Medium 1×)',…],['Campaign stars','n/150'],['Daily best',…]], last}`
- **Navigation:** `const ARCADE_HOME='../index.html', ARCADE_PREFS='../index.html#prefs';` Leaves with `location.replace(…)` only. "‹ Arcade" on home (hidden standalone). Android back: in a game it pauses first; then closes a sheet; then returns home; then, on home in Arcade, goes to Arcade.
- **`#game-settings`:** opens the settings screen and clears the hash with `history.replaceState`. No other hashes are used.
- **Settings inside Arcade:** controls layout, button size, repeat delay and rate, soft drop speed, block colours, danger glow, fast line clears, How to play, What's new, Linefall-only backup (`LINEFALL1Z.` gzip / `LINEFALL1.` plain), and an "Arcade settings" row. Shared settings (including left-handed) are hidden.
- **No service worker. CSP:** `default-src 'self'`, inline scripts and styles, `data:` fonts and images, no outside requests.

## Engine notes
- 60 Hz logic ticks, `step(state, inputs)` pure and deterministic; all state is plain JSON, so saves resume exactly. Loop: fixed-timestep accumulator, at most 4 catch-up ticks per frame, one canvas scaled for devicePixelRatio.
- Gravity follows the standard exponential curve, stored as an integer table so every browser computes the same game. Level up every 10 lines; cap 20 rows per tick with lock delay still applying.
- Lock delay 500 ms with up to 15 resets (a new lowest row resets the count); line clear 300 ms (200 ms fast); entry delay 100 ms. DAS charges through the entry delay. Rotate/hold pressed during the entry delay are buffered to the spawn.
- Rotation: standard 4-state, 5-test kick tables for the 7 pieces (I has its own); a generic 8-offset search for 3- and 5-block pieces; O never kicks. Pieces spawn in the hidden rows and drop one row into view.
- Twist: T only, last action a rotation, 3 of 4 diagonal corners filled; mini if a front corner is open (unless the 5th kick was used). Scoring as kickoff section 6, plus mini-Twist Single/Double 200/400 and a 5-line clear ("Quint", I5 only) worth 1,200, both my additions.
- Bags: every piece in the set once per bag. Pentomix adds 1 five-block piece per bag (from a sub-bag of I5, L5, P, T5, U); Chaos adds 1 three-block and 1 five-block. Measured over 100,000 pieces, the rates are within ±0.4% of 1/8 (Pentomix) and 1/9 each (Chaos).

## Star targets and the Daily table (from the bot sims)
Two bots play through `step()` with real inputs. **Casual:** no hold, no lookahead, noisy weights, ~0.7 s per piece, occasional off-by-one drops (an average player). **Strong:** hold, one-piece lookahead, builds a well for Quads, ~0.3 s per piece (mastery). A **flat** variant of the strong bot (no Quad well) was used for Survive and Dig.
- Sprint: ★2 = casual median time × ~1.15 (par), ★3 = 0.8 × par, ★4 no hold, ★5 Quads ≈ 0.6 × the strong bot's count. No-hold levels use a strong-bot time for ★4.
- Survive: ★2 = casual median final stack height, ★3 = casual median score, ★4 no hold, ★5 never above half height (the flat bot manages it on every level except Long Haul, whose ★5 is a score instead).
- Score Attack: ★2 ≈ 0.7 × casual 40th percentile, ★3 = casual 75th percentile, ★4 = 2 × that, ★5 a Clean Sweep.
- Dig: the casual bot digs poorly (95–264 pieces), so ★2/★3 sit between it and the strong bot (5, 41 and 43 pieces).
- Puzzle: ★2/★3 from the stored solution's move count (par 12, 21, 17), ★5 a time.
- Daily: no combo made the casual bot top out under 60 s (worst 1 in 10), so all 30 stay. Thresholds: ★1 = 0.6 × casual 30th percentile, ★2 = casual 80th percentile, ★3 = twice that.
- Level changes from the sims: Long Haul 240 s at 1.5× from level 5 → 180 s at 1× from level 4; Double Time starts at level 1; Pressure Cooker 150 s → 120 s; Chaos Theory → 120 s on Large; Pocket Rocket 2× → 1.5×, 20 lines; Deep Dig 7 → 8 rows; Bedrock 10 → 8 rows. The strong bot can't finish High Roller (3 min at 2×; it dies at 20G); the casual bot does.

## Tests
- `node tests/run.js`: 593 checks — every piece's 4 states, kicks off walls/floor/stack, the generic search, O never kicks; bags (once per bag, rates over 100,000 pieces, every piece fits every board); gravity and the 20-row cap; lock delay, the 15-reset cap and new-lowest-row reset; DAS/ARR tick timing and ARR 0; 1–5 line clears, Twist Double, mini-Twist Single, back-to-back, combo, Clean Sweep (+3,000 after a Quad), width and modifier multipliers; rising garbage timing, fading visibility, both top-out rules; determinism (same seed + inputs, and save/resume mid-run, by fingerprint); 30 levels with 5 goals; Dig layouts have no full rows; puzzles replay their stored solutions to a Clean Sweep; a bot gets ★1 on every other level; Daily: same combo and pieces for 120 days, pinned fingerprints (`2026-11-23 → f9e63a03`, `2027-01-01 → c1df23ae`), 3:00 clock, one scored attempt, release-day XP, streak, share line; core: old saves through `defSave()`, XP levels, rewards at 2–10, cumulative stars and 3-star gating, chapter bonus and unlocks, records, achievements, practice earns nothing, backup round trip; Arcade: shared settings, summary fields and keys; QUICK bot games on all 45 board × speed × set combos.
- `node tests/layout.js`: 132 checks — no sideways scroll at 360 and 390 px in English and German on every screen and sheet (home, Classic sheet, campaign chapters, level sheet, Daily sheet, Records, Progress, Achievements, Style, Settings, How to play, What's new, Backup, game, pause, results); German shows no untranslated text except the SELECT/START hardware labels; board and panel fit the screen on all three boards at 360 px; screen touches ignored; holding ◀ while tapping A both register; all three layouts and the keyboard; Select/Start; Android back pauses; reload → Continue → resume; left-handed swap; Large 2× at 60 fps (draw under 8 ms a frame); standalone CSP and no outside requests; the Arcade build contract (`__ARCADE__`, `../fonts.css`, shared settings, standalone values kept, summary, only `linefall.*` keys, `arcade.v1` untouched, Arcade settings row, `pageshow` re-read, `#game-settings`, `location.replace`, `#settingsBtn`, no service worker).

## Decisions taken (kickoff section 15, all easy to change)
1. **Campaign seeds:** fixed piece order per level.
2. **Default colour mode:** by height (bottom-to-top palette bands).
3. **Handling defaults:** DAS 160 ms, ARR 33 ms — still to be checked on the Galaxy S20 FE.
4. **Classic XP cap:** 50 per game.
5. **Default soundtrack:** the new original Signal.

Also decided along the way:
- **Keyboard ↑:** the kickoff lists ↑ as both hard drop and rotate. I used ↑ = rotate clockwise and Space = hard drop (the common keyboard convention); on the console D-pad, ▲ is still hard drop.
- **A/B buttons** sit level with each other (not staggered), to keep clear of the original console's slanted pair.

## Open items for playtesting
- Not yet tried on a real phone. Handling, button sizes and the swipe thresholds (28 px per cell, flick ≥ 0.5 px/ms) need the S20 FE.
- The puzzles are generated and verified, but Small Parts and Endgame read as "fill the walled well"; hand-designed puzzles would be more interesting.
- Score thresholds for achievements are still the kickoff's placeholders; the sims suggest 30k on a board is a few minutes' play.
- The kickoff's 1,000 games per board × speed × set wasn't run (the bot sims here were 10–12 casual + 3 strong per level and per Daily combo). `tests/sim.js` can run more.
- In the claude.ai preview, "Save to file" in Backup does nothing (the viewer blocks downloads); Copy works. It works in the standalone and Arcade builds.
- Translations are machine-assisted.
- "Linefall" name: a quick search found no game by that name. Check properly before any public release (not legal advice).
- **Later (not in the demo):** League for the Daily Blitz, challenge codes, shaped wells, Versus, 40-line Sprint in Classic, replays.
