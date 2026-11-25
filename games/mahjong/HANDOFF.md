# Mahjong v0.1.0 — handoff

Demo only. Nothing has been pushed to GitHub. Built 2026-11-25 from the kickoff (`claude/mahjong-kickoff.md`), the Arcade contract (`claude/arcade-integration.md`), Tilecraft v0.1.0 from a read-only clone of `github.com/Allasdair/arcade` (commit `b116aa5`: shell, i18n watcher, Web Audio synth, sheets, Style screen, settings, backup, `build.py`, test loader) and Sweep (`games/sweep`: cyrb128 → sfc32, shape masks, hint economy, Daylight). Solitaire's handoff was read for the approach (its ZIP isn't in the project, so no code came from it). The Arcade import is a later step; the contract is built in, so it should drop in.

**Private playable demo:** https://claude.ai/artifact/D2EfBdBfc6Rk315Yra3th2 (`dist/demo.html`)

## Summary for the Arcade chat (when it's time)
- **Game id:** `mahjong` · **Arcade build file:** `dist/mahjong/index.html` · **"‹ Arcade" button:** `#arcadeBtn` · **settings button:** `#settingsBtn`
- **Registry entry:** `{id:'mahjong', name:'Mahjong', desc:'Match pairs, clear the stack', path:'mahjong/index.html', prefix:'mahjong.', art:'mahjong'}`
- **Page size:** Arcade build **237 KB** (fonts linked), standalone **328 KB** (Inter and JetBrains Mono inlined).
- **Import check:** leaves only through `leaveTo(url)` → `location.replace(url)` and handles `#game-settings`, so it should print `ok, nothing to fix`.
- **Grade thresholds** (blind bot, 20 plays, no shuffles): Easy ≥ 75% wins, Normal 50–75%, Hard 25–50%, Expert < 25%.

## What's in v0.1.0
- **Classic:** setup sheet with Difficulty (Easy 72 / Normal 108 / Hard 144 / Expert 144), Layout (Random or any unlocked layout of that size, drawn as a little map), Shuffles (Unlimited / 3 / None), Time Attack, Fog (Hard and Expert only). Choices are remembered. Random boards are generated on the phone and graded by the blind bot in ~8 ms slices until one matches the difficulty's grade ("Finding a hard board…", usually under a second; after 10 tries it takes the closest).
- **Campaign:** Garden, Temple, Summit, 15 levels each (45 levels, 135 stars), Sweep's structure: linear unlocks, stars ★ clear / ★ par time (Time Attack: 30 s left) / ★ no assists, built up across attempts, 30/75/135-star unlocks. Shaped layouts at 4/8/12, twists at 7/14 exactly as the kickoff lists, puzzles at 10, finales at 15 (Summit 15 is the Turtle).
- **Daily:** `MJD1|YYYY-MM-DD` picks from graded seed lists by weekday (Mon Easy … Sun Expert, as the kickoff's table). One scored attempt (saved, resumable, "End game" uses it), unlimited practice, share line (`Mahjong Daily · Wed 25 Nov · 6:48 · ★★★`, `(assisted)` if any assist), 20 XP doubled on its release day, streak, last 7, Full Week tracker.
- **Engine:** pure `engine.js`, plain-JSON state. Free-tile rule, matching (flowers with flowers, seasons with seasons), unlimited undo, fair Shuffle, assists, combo score (10/20 a pair, ×1.5 → ×3 within 3 s), Time Attack (1:50 / 2:40 / 3:35, +3 s a pair +1 s per combo step, a tick in the last 10 s), Fog (blocked tiles face down; they flip up when freed).
- **Helpers:** Highlight free tiles (on), Show matches (off, an assist), hints (5 a day, +1 per level-up, stack to 99; a pair that keeps the board winnable), "still winnable?" banner with Undo (off in Fog, quiet on a timeout), stuck banner with Undo / Shuffle / End game.
- **Board view:** SVG tiles with layer offsets, side thickness and cast shadows; fit to screen, pinch, wheel, the Zoom button, drag to pan, double-tap the table to toggle; Large tiles and Auto-zoom to fit settings; taps hit the topmost tile.
- **Progression:** XP exactly as the kickoff (Classic 10/15/22/30 + 5 each for no shuffles, Fog, Time Attack, half if assisted; campaign 6/10/15 per new star + 75/150/225; Daily 20/40), 10 levels on Sweep's first steps with a reward at every level 2–10, records, 37 achievements, 38 cosmetics on Linefall's Style screen (Faces, Tiles, Boards, Layouts, Effects, Sounds tabs; preview cards draw the item).
- **Tile art:** our own vector drawings in `src/tiles.js`. No emoji, no Unicode mahjong characters. Numerals for the Characters suit are our own brush strokes over a red seal of our own (not the traditional 萬); winds are compass letters with a pointer; dragons are a flame pearl, jade peaks and a frame. Five face sets: Classic, Minimal, Ink Brush, Pixel, Neon. High-contrast (corner labels B5, C3, D7, EW, RD, F2, S3) is always free and also turns on with the Arcade's colourblind setting.
- **Sound:** synthesized live. Soft Clack / Stone / Chiptune packs (select, blocked thud, match rising with the combo, hint, undo, shuffle, stuck, alert, tick, flip, win, level-up). Music: **Still Water** (new, ~70 BPM, D major sevenths and ninths, no drums, default), **Lantern Walk** (new, 84 BPM, A minor lo-fi swing, level 6), Sweep's **Daylight** (Daily Streak). Ambience: Rain, Stream, Wind Chimes. Neither track uses a pentatonic "oriental" pastiche.
- **Effects:** match Fade / Petals / Sparks / Ink Splash; win None / Lanterns / Petal Storm / Fireworks / Tile Cascade. Animations off or Reduce Motion: tiles vanish at once, no effects, no swirl. Animation speed Normal / Fast.
- **Languages:** the i18n watcher with `src/i18n_0_ui.js` (334 rows, `[en, es, fr, de, pt]`, machine-assisted). Level, achievement, cosmetic, layout and campaign names stay English.
- **Saving:** every game (Classic, campaign, Daily attempt, practice) saves after every move and on page hide, with its undo history, Fog state and Time Attack clock, and resumes exactly.

## Files
```
mahjong/
  src/app.html        UI, screens, SVG board (layers, shadows), zoom/pan, tap input, animation, audio, effects
  src/engine.js       tiles, layouts and the free-tile rule, matching, reverse-built generator, shuffle, undo,
                      assists, combo, Time Attack, Fog, par time
  src/solver.js       full-knowledge solver (generator, sliced), blind bot, grading
  src/layouts.js      generated: the 30 layouts (tools/mask_layouts.js)
  src/tiles.js        face art for every set, tile bodies, the tile back
  src/levels.js       generated: 45 campaign recipes (3 puzzle positions), Daily seed lists (tools/grade.js)
  src/core.js         save, XP/levels, stars, records, hints, campaign, Daily, achievements, cosmetics, backup, Arcade contract
  src/i18n_0_ui.js    translation table
  tools/mask_layouts.js  node tools/mask_layouts.js → src/layouts.js (includes Sweep's shapeMask maths)
  tools/grade.js         node tools/grade.js → src/levels.js (~40 s)
  tools/show.js          prints layouts as text; tools/probe*.js are the tuning probes used while building
  tests/run.js        node tests/run.js (QUICK=1 for short runs) · 247 checks · ~37 s (QUICK ~6 s)
  tests/layout.js     node tests/layout.js (Playwright + Chrome; python3 build.py first) · 186 checks · ~36 s
  tests/lib.js        loads the sources the way build.py concatenates them
  fonts/              Inter, JetBrains Mono (SIL OFL, licences included)
  build.py            python3 build.py → dist/
  dist/mahjong/index.html   Arcade build: window.__ARCADE__=1, ../fonts.css, strict CSP
  dist/standalone.html      single file, fonts inlined, strict CSP
  dist/demo.html            standalone without the CSP meta, for the claude.ai artifact preview
```
`tests/sim.js` from the kickoff isn't a separate file: the long sims live in `tools/grade.js` and `tools/probe*.js`.

## Layouts
All portrait, built by `tools/mask_layouts.js` from a mask on a whole-tile grid stacked by distance from the edge, trimmed symmetrically to the exact tile count. Tests check counts, no overlaps and full support for every upper tile.

| Name | id | Size | Layers | Footprint (tiles) | Kind |
|---|---|---|---|---|---|
| Terrace | terrace | easy | 3 | 7×8 | standard |
| Pebble | pebble | easy | 3 | 8×8 | standard |
| Lantern | lantern | easy | 3 | 8×9 | standard |
| Steps | steps | easy | 3 | 7×8 | standard |
| Brickwork | brickwork | easy | 2 | 7.5×8 | standard (brick rows) |
| Heart | heart | easy | 3 | 8×7 | shaped (Sweep mask) |
| Diamond | diamond | easy | 3 | 8×9 | shaped (Sweep mask) |
| Courtyard | courtyard | normal | 4 | 8×9 | standard |
| Bridge | bridge | normal | 3 | 9×10 | standard |
| Fan | fan | normal | 3 | 9×7 | standard |
| Stagger Hall | stagger | normal | 3 | 8×8.5 | standard (staggered columns) |
| Arches | arches | normal | 3 | 9×9 | standard |
| Ring | ring | normal | 3 | 10×11 | shaped (Sweep mask) |
| Cross | cross | normal | 4 | 9×11 | shaped (Sweep mask) |
| Hourglass | hourglass | normal | 3 | 9×11 | shaped (Sweep mask) |
| Fortress | fortress | hard | 5 | 9×10 | standard |
| Twin Islands | islands | hard | 5 | 12×8 | shaped (Sweep mask) |
| Spire | spire | hard | 5 | 9×12 | standard |
| Cascade | cascade | hard | 4 | 8×10.5 | standard (staggered) |
| Mosaic | mosaic | hard | 4 | 9.5×10 | standard (brick rows) |
| Great Ring | bigring | hard | 5 | 11×12 | shaped (Sweep mask) |
| Grand Cross | bigcross | hard | 5 | 10×11 | shaped (Sweep mask) |
| Turtle | turtle | expert | 5 | 8×15 | traditional, turned 90° |
| Great Heart | bigheart | expert | 5 | 10×10 | shaped (Sweep mask) |
| Citadel | citadel | expert | 5 | 8×9 | standard |
| Pinnacle | pinnacle | expert | 6 | 7×9.5 | standard (staggered) |
| Dragon | dragon | special (144) | 5 | 9×14 | unlock: 30 campaign stars |
| Pagoda | pagoda | special (144) | 5 | 9×11 | unlock: level 8 |
| Constellation | constellation | special (108) | 4 | 10×12 | unlock: clear 7 Dailies |
| Lotus | lotus | special (108) | 4 | 9×9 | unlock: finish Garden |

Tile width at fit-to-screen, 360 px wide: Easy 41–53 px, Normal 33–41 px (target 30). Hard and Expert 28–47 px, with zoom.

## Generator, solver and grading
- **Generator:** reverse building as the kickoff describes; free positions are picked weighted towards high tiles, with a one-step look-ahead so it never strands a lone tile. Each kind's two pairs form a "couple"; a `trap` level (0–1) sets how often a couple is made of two pairs where one blocks the other, which is what makes boards hard for a player who can't see under the stacks. In testing it never needed a retry (10,000 boards, every one replays to a clear).
- **Shuffle:** the same reverse build on the remaining positions, with the remaining faces paired by match group; its build order becomes the new winning line.
- **Solver:** depth-first with a 53-bit Zobrist table, "all remaining tiles of a kind are free → take them all" as a forced move, a dead-end proof (the last two or four of a kind stacked on each other), ordering by tiles freed and new matches created, and 6 restarts with a little noise. The key addition: it is **guided by a known winning line** (the generator's order, then each successful solve, then the shuffle's order), so positions reached by sensible play solve in a few dozen nodes (average ~450 along random play). It yields every 150 nodes; slices stay under 8 ms.
- **Grading:** the blind bot sees face-up tiles only (in Fog, free tiles), counts removed tiles, takes all 4 of a kind when it can, else pairs that free the most tiles, else random. 20 plays without shuffles.
- **Par time:** 1.1 s per pair × grade factor (1, 1.1, 1.2, 1.3) × depth factor (1 + 0.05 per layer over 2), rounded up to 5 s. Easy boards come out at 40–45 s, Normal 70–75 s, Hard 1:45–1:50, Expert about 2:00.

## Campaign (from `tools/grade.js`)
Every level's seed was graded to its target; the tests check that the bot (with shuffles where allowed, retrying where not) clears all 45.

| | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Garden** | First Bloom | Stepping Stones | Paper Lantern | Heart | Morning Dew | Brick Path | Against the Clock (TA) | Diamond | Courtyard Gate | Halfway (puzzle) | Open Fan | Ring | Arbour | No Second Chances (no shuffles) | The Bridge |
| **Temple** | Quiet Hall | Temple Fan | Cloister | Cross | Bell Tower | Long Bridge | No Going Back (no undo) | Hourglass | Gatehouse | Deadlock (puzzle) | Cascade | Twin Islands | Mosaic Floor | Incense Clock (TA) | Temple Spire |
| **Summit** | High Pass | Scree | Waterfall | Great Ring | Needle | Citadel | Cloud Line (Fog) | Grand Cross | Pinnacle | Gordian (puzzle) | Twin Peaks | Great Heart | Thin Air | Whiteout (Fog, no shuffles) | The Turtle |

Grades: Garden mostly Easy, Normal from 11; Temple Normal, Hard at 12/13/15; Summit Hard, Expert at 12/13/15. Puzzles: Halfway (Lantern, 36 tiles left, bot 35%), Deadlock (Hourglass, 58 left, 25%), Gordian (Citadel, 76 left, 20%); each is solver-confirmed winnable without shuffles.

## Decisions taken (all easy to change)
1. **All layouts are portrait; nothing turns at run time.** Wide traditional shapes (the Turtle) are stored turned 90°. Turning the board on a phone would change which tiles block which (left/right), so the Daily wouldn't be the same board on every device.
2. **Double-tap zooms only on the table**, not on a tile: two taps on a tile already mean select then deselect.
3. **Random Classic boards use the difficulty's own layouts**; the layout picker offers every unlocked layout of the same tile count (so Expert can use a Hard layout and vice versa). The grade targeted is the difficulty's own name.
4. **Hints can take up to ~400,000 solver nodes** (sliced); a hint is only spent when one is found. "No winning pair from here" (undo or shuffle) and "couldn't find a sure hint in time" cost nothing.
5. **Undo in Time Attack takes back the pair's time bonus**, so undo-redo can't farm time. Time already spent stays spent.
6. **The clock starts on the first tap**, and stops when paused, hidden or on another screen.
7. **Shuffle can refuse** in the rare position where the remaining shape can't be cleared in any order (for example one tile alone on top of another); the toast suggests Undo.
8. **Restart** (pause menu; not the scored Daily) deals the same board again; assists already used keep the game assisted.
9. **An abandoned Classic game** (starting another Classic game over it) counts as a loss for the win streak.
10. **Campaign difficulty for achievements:** a level counts as its layout's size, or Expert when its grade is Expert. Every clear (Classic, campaign, the scored Daily) counts toward cumulative clears.
11. **Fog levels are graded without Fog**, then made harder by Fog itself.
12. **Ambience follows the Music switch** (one switch for background audio). The Arcade's colourblind setting turns on the High-contrast colours.
13. **Cosmetic unlocks:** level 2 Minimal faces + Petals, 3 Jade + Lanterns, 4 Garden board + Rain, 5 Ink Brush, 6 Bamboo + Lantern Walk, 7 Paper board + Stream, 8 Pagoda layout + Stone sounds, 9 Obsidian + Chiptune, 10 Ink Splash + Fireworks. Stars: 30 Dragon layout, 75 Neon faces, 135 Space board. Achievements: Pixel faces (Combo Master), Glass tiles (Beat the Clock), Night Temple (In the Fog), Constellation layout (7 Dailies), Lotus layout (finish Garden), Sparks (Four of a Kind), Petal Storm (Perfect Garden), Tile Cascade (100 clears), Daylight (Daily Streak), Wind Chimes (Full Week).
14. **Campaign names** stay English, like level names.
15. **Keyboard on desktop:** U/Z undo, H hint, S shuffle, F or +/− zoom, P/Esc pause; mouse wheel zooms.

## Tests
- `node tests/run.js` — **247 checks**: tile sets (72/108/144, kinds × 4, the 8 bonus tiles, Easy uses numbered suits, flower/season matching, labels, every face draws, no Unicode mahjong characters); free-tile rule on a hand-made layout (covered, half-offset cover, blocking across overlapping rows, edges); play (blocked taps, select/deselect/switch, match, undo restores exactly, assists, combo steps and cap, Time Attack start/bonus/undo/loss, stuck); Fog; **10,000 generated boards replay to a clear**; shuffles winnable and face-preserving; same seed same board; grading repeatable; hints keep the board winnable; the warning never fires on a winnable position; timeouts flagged; slices under 8 ms; dead positions proved; all 30 layouts (counts, overlaps, support, layers); Daily (120 days, weekday table, every Daily's grade re-checked, pinned `2026-11-25 → courtyard|0c4ea348`, `2027-01-01 → spire|ddaef8f6`, one scored attempt, release-day XP, share line); campaign (45 levels load, twists apply, puzzles winnable without shuffles, the bot clears all 45, stars build up, unlocks); core (old saves, exact mid-move restore with Fog and the clock, a reward at every level 2–10, hints, XP rules, achievements, 37/38 counts, backup, Arcade settings and summary); sources (`ARCADE_HOME`/`PREFS`, `location.replace` only, `#game-settings`, `#arcadeBtn`, `#settingsBtn`, no service worker, only `mahjong.*` keys, no "Shanghai", no outside requests).
- `node tests/layout.js` — **186 checks**: no sideways scroll at 360 and 390 px in English and German on every screen, sheet, banner and results; German shows no untranslated text; tiles ≥ 30 px on every Easy and Normal layout at 360 px; every face in every set (and High-contrast, on light and dark bodies) renders distinctly at 30×40 px; double-tap and pinch zoom on a Hard layout; taps hit the right tile when zoomed; blocked taps; a pair by touch; Android back opens the pause menu; save after every move, reload, Continue resumes exactly; standalone CSP and no outside requests; the Arcade build contract (button, shared settings, keys, `#game-settings`).

## Open items for playtesting
- **Par time looks tight.** The kickoff's 1.1 s per pair gives 45 s for an Easy board; a casual player will often miss the second star. One constant in `parTime()` (engine.js) changes it; `tools/grade.js` re-stamps the campaign pars.
- **Not yet tried on a real phone.** Pinch, pan and tap accuracy on Hard and Expert need the Galaxy S20 FE. The Turtle is the tallest board (about 30 px tiles at fit on a 360 px phone).
- **Layout looks are generated** from masks; most read well, but Fortress and Pinnacle could use a hand pass.
- **Expert campaign levels** S12, S13 and The Turtle are hard for the bot without shuffles (0–20%). They're winnable and the bot clears them with shuffles; worth a feel check.
- **The solver can time out on dead positions** that take long to prove; the warning then stays quiet (as the kickoff asks). Winnable positions from normal play solve quickly.
- **Translations** are machine-assisted.
- In the claude.ai preview, "Save to file" in Backup does nothing (the viewer blocks downloads); Copy works. Fine in the standalone and Arcade builds.
- **Not in the demo (later, as planned):** challenge codes, a Daily league, a layout editor.
