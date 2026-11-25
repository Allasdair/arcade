# Solitaire v0.1.0 — handoff

Demo only. Nothing has been pushed to GitHub. Built 2026-11-25 from the kickoff (`claude/solitaire-kickoff.md`), the Arcade contract (`claude/arcade-integration.md`) and Tilecraft v0.1.0 (shell: i18n watcher, Web Audio synth, sheets, Style screen, settings, backup, `build.py`, test loader). This is the game on its own; the Arcade import is a later step (the Arcade contract is already built in, so it should drop in).

**Private playable demo:** https://claude.ai/artifact/SmqqAMSLKhLsxbJMuTSJkQ (`dist/demo.html`)

## Summary for the Arcade chat (when it's time)
- **Game id:** `solitaire` · **Arcade build file:** `dist/solitaire/index.html` · **"‹ Arcade" button:** `#arcadeBtn` · **settings button:** `#settingsBtn`
- **Registry entry:** `{id:'solitaire', name:'Solitaire', desc:'Every deal winnable', path:'solitaire/index.html', prefix:'solitaire.', art:'solitaire'}`
- **Page size:** Arcade build **257 KB** (fonts linked), standalone **349 KB** (Inter and JetBrains Mono inlined).
- **Import check:** leaves only through `leaveTo(url)` → `location.replace(url)` and handles `#game-settings`, so it should print `ok, nothing to fix`.
- **Bank:** `src/bank.js` is **32.3 KB** (target < 100 KB). Grade thresholds: Easy ≥ 75% bot wins, Medium 50–75%, Hard 25–50%, Expert < 25% (20 blind-bot plays per deal).

## What's in v0.1.0
- **Classic:** Klondike, Draw 1 / Draw 3, passes Unlimited / 3 / 1, Open deck, difficulty Any / Easy / Medium / Hard / Expert (from the graded bank, no repeats until that part of the bank is used up). New deal (two taps mid-game), Restart, Undo, Hint, Pause. Win stars: ★ clear, ★ par moves, ★ par time.
- **Campaign:** Draw 1 Basics, Mixed, Draw 3 Masters, 15 levels each (45 levels, 135 stars), Sweep's structure. Open deck at 4/8/12, twists at 7/14, a puzzle at 10, a finale at 15. Stars ★ par moves, ★ par time, ★ no hints (clearing required), built up across attempts. 30/75/135-star unlocks.
- **Daily:** `SOLD1|YYYY-MM-DD` picks a winnable deal by weekday (Mon Easy → Fri Hard in Draw 1, Sat Draw 3 Medium, Sun Draw 3 Hard). One scored attempt (saved, resumable, "End attempt" counts), unlimited practice, share line (`Solitaire Daily · Wed 25 Nov · 96 moves · 4:12 · ★★☆`, `· hinted` if a hint was used), 20 XP doubled on its release day, streak, last 7, Full Week tracker.
- **Card engine:** pure `engine.js`, JSON state; drag (single cards and runs, lift, targets highlight, invalid drops slide back), tap (best destination; tapping again cycles), double-tap to foundation, "select then tap" mode, stock tap, keyboard (arrows, Enter/Space, D, U/Ctrl+Z, H, P/Esc), unlimited undo (counts as a move), auto-complete button, safe auto-move (setting), stuck sheet, move limits, undo limits.
- **Solver:** proves deals, sets par, gives hints (the next move on a winning path) and the "still winnable?" banner. Runs in the page in ~8 ms slices.
- **Progression:** XP (Classic 10/15/22/30 by grade, +5 Draw 3, +5 one pass, half if assisted), 10 levels on Sweep's first 10 steps with a reward at every level 2–10, +1 hint per level-up, hints refill to 5 a day and stack to 99, records, 31 achievements (including First Clear → Legend cumulative clears), 54 cosmetics in 13 categories on Linefall's Style screen.
- **Look:** our own: six tables, ten card backs (three animated star unlocks), five court-art styles drawn as small SVGs (Classic crowned busts, Minimal, Botanical, Pixel, Constellation), four frames, four empty-pile badge styles. Faces always keep standard suits, large corner rank + suit (16.5 px at 360 px wide), and the 4-colour / high-contrast settings are free. No Microsoft Solitaire art, layout or bouncing win; our Bouncing Cascade springs cards off the foundations with no trails.
- **Sound:** synthesized live. Soft / Wooden / Chiptune packs; pick, place, flip, stock, reset, a foundation chime rising with rank, undo, hint, alert, stuck, win, level-up. Music: **Parlour** (new, 76 BPM, D major parlour piano; default), **Lamplight** (new, 88 BPM, A minor bossa; level 10), Sweep's **Daylight** (Daily Star). Ambience: Rain, Café, Fireplace.
- **Languages:** the i18n watcher with `src/i18n_0_ui.js` and `src/i18n_1_game.js` (`[en, es, fr, de, pt]`, machine-assisted). Level, achievement and cosmetic names stay English.
- **Saving:** every game (Classic, campaign, Daily attempt, practice) saves after every move and on page hide, with its undo history, and resumes exactly.

## Files
```
solitaire/
  src/app.html        UI, screens, card rendering and layout, drag/tap/keyboard, animation, audio, effects
  src/engine.js       deck, deal from seed (cyrb128 → sfc32, Fisher–Yates), piles, rules, moves and counting, undo,
                      tap targets, safe auto-move, auto-complete, action encoding
  src/solver.js       perfect-knowledge solver (sliced, fast and exact modes), win check, blind bot, grading
  src/bank.js         generated: 2 × 2,000 graded deals + 2 × 500 Open deck grades, par-time table
  src/levels.js       generated: the 45 campaign levels (3 puzzle positions included)
  src/core.js         save, XP/levels, stars, records, hints, Daily, campaign, achievements, cosmetics, backup, Arcade contract
  src/i18n_*.js       translation tables
  tools/build_bank.js node tools/build_bank.js [N]  → src/bank.js + tests/bank_solutions.json.gz (~22 min on 2 cores)
  tools/build_levels.js node tools/build_levels.js  → src/levels.js + tests/level_solutions.json (~80 s)
  tests/run.js        node tests/run.js (QUICK=1 for short runs) · 10,512 checks · ~15 s
  tests/layout.js     node tests/layout.js (Playwright + Chrome; python3 build.py first) · 246 checks · ~33 s
  tests/lib.js        loads the sources the way build.py concatenates them
  fonts/              Inter, JetBrains Mono (SIL OFL, licences included)
  build.py            python3 build.py → dist/
  package.json        dev dependency: playwright (only for tests/layout.js)
  dist/solitaire/index.html   Arcade build: window.__ARCADE__=1, ../fonts.css, strict CSP
  dist/standalone.html        single file, fonts inlined, strict CSP
  dist/demo.html              standalone without the CSP meta, for the claude.ai artifact preview
```
`tests/sim.js` from the kickoff isn't a separate file: the long sims live in `tools/build_bank.js` and `tools/build_levels.js`, which is where par times and grades are tuned.

## The solver
- **State:** stock and waste are one array in drawing order plus a waste pointer, so a pass reset is just "pointer to 0", exactly like the real game.
- **Collapsed stock:** one solver move is "turn the stock as needed (draws and resets, each counted), then play waste card p". No state repeats by just drawing, and pass limits are tracked.
- **Search:** depth-first with a 53-bit transposition table (column order ignored, so mirrored layouts merge). Move order: cheap foundation moves, moves that turn a face-down card (most face-down first), cheap waste plays, then the rest; waste plays that need a long run through the stock sink down the list. The node budget is spent on 5 restarts with the order shuffled a little, which cut the median search from ~18,000 to ~550 nodes.
- **Pruning (fast mode):** safe foundation moves are applied automatically; tableau moves must uncover a card, empty a column for a waiting King, or free a card that something can use; foundation-to-tableau only if something can then land on the card; one empty column stands for all.
- **Stops at auto-complete:** once the stock and waste are empty and every card is face up, the rest always goes up (and costs no moves).
- **"Still winnable?":** fast search first; if it runs out of moves, an **exact** search (no pruning that could hide a win, only provably safe auto-moves) must also run out before the banner shows. A timeout stays quiet. The tests check it never warns along 40 stored winning lines and does flag dead positions.
- **Hints:** the first action of a fast-mode solution (a draw highlights the stock). A hint is only spent when one is found.

## Deal bank (from `tools/build_bank.js 3400`)
| | Draw 1 | Draw 3 |
|---|---|---|
| Deals tried / kept | 3,400 / 2,000 | 3,400 / 2,000 |
| Easy · Medium · Hard · Expert | 1,036 · 166 · 131 · 667 | 305 · 102 · 106 · 1,487 |
| Winnable in 1 pass · in 3 passes or fewer | 78 · 1,345 | 32 · 518 |
| Par moves: median · 90th pct · max | 136 · 186 · 531 | 144 · 174 · 510 |
| Median par time (Easy / Expert) | 2:20 / 3:05 | 2:00 / 2:40 |
| Open deck grades (first 500) | 265 · 53 · 15 · 167 | 71 · 18 · 26 · 385 |

- Deals the solver can't prove within 40,000 nodes are thrown away (about a third), as the kickoff says.
- **Par moves** = the shortest proven win found (1 solver run + 6 shuffled runs, or the bot's shortest of its 20 plays, whichever is shorter) + 15%, rounded up. Every stored line is replayed by the tests.
- **Par time** = par × seconds per move for that draw mode and grade, rounded up to 5 s. Seconds per move = 1.2 s × (the bot's average moves in its wins ÷ par): 1.06–1.08 s.

## Decisions taken (all easy to change)
1. **Safe auto-move rule tightened.** The kickoff's rule (both opposite-colour cards one rank lower are up) can, in rare positions, send up a card that's still needed. The game uses the provably safe form: Aces and 2s always; otherwise both opposite-colour suits must hold rank − 1 and the other suit of the same colour rank − 2. Safe auto-moves are automatic, so they count 0 moves.
2. **Par includes the bot's shortest win.** The DFS solver's first solutions ran ~25% longer than a casual bot's wins (195 vs 116 moves), which would have made par trivial. Branch-and-bound barely helped, so par uses the shortest proven win from either source.
3. **Passes** = times through the stock: 3 passes = 2 resets, 1 pass = none. The top bar shows resets left.
4. **Foundations are fixed per suit** (♠ ♥ ♦ ♣, left to right; swapped side in left-handed mode).
5. **Open deck:** the "face-down" cards are dealt face up but stay blocked until uncovered (shown slightly dimmed, spaced wider so their corners read), and the stock order is shown as a strip under the top row. The Open bank reuses the first 500 deals of each draw bank, graded by the bot seeing every card.
6. **Clearing a level unlocks the next even with no star** (the kickoff makes clearing the unlock and the gate for stars).
7. **Twists:** Basics 7 = 3 undos, 14 = no undo; Mixed 7 = a move limit (par + 25%), 14 = 1 pass; Masters 7 = 3 undos, 14 = no undo and 1 pass. The Masters finale is the Draw 3 Expert deal (3 passes) with the lowest bot rate and the most solver effort among 309 candidates.
8. **Restart** (Classic, campaign, practice) starts the deal again with moves and time at 0; hints already used keep the game assisted. The Daily's scored attempt can't restart; "End attempt" uses it up.
9. **A started Classic game counts as a loss** if abandoned (New deal, or starting another Classic game). "Save and quit" doesn't.
10. **Double-tap:** the first tap already prefers the foundation, so the second tap of a double-tap is ignored.
11. **The clock starts on the first move** and stops when paused, hidden or on another screen.
12. **Ambience follows the Music setting** (one switch for background audio). 4-colour suits also follow the Arcade's shared colourblind setting.
13. **Undo history** keeps 2,000 steps per game (in practice unlimited) and is saved with the game.
14. **Cosmetics:** 54 items in 13 categories (the kickoff's "move effects" became Flip style, Move trail and Foundation glow). Level rewards 2–10, star rewards 30/75/135 (the animated backs), achievement rewards: Navy Plain (Regular), Pixel court (Centurion), Constellation court (Puzzle Solver), Crests badges (Mixed finished), Constellations badges (Daily Streak), Foundation Burst (Clean Sweep), Space table (Perfect Masters), Daylight (Daily Star).
15. **Fonts:** Inter and JetBrains Mono only (Caveat isn't used).
16. **No Draw button:** the stock is the draw control (plus D on the keyboard), so the toolbar has the kickoff's New deal, Restart, Hint, Undo; Pause sits top left.

## Tests
- `node tests/run.js` — **10,512 checks**: deals (1,000 seeds), every move rule, stock and passes for both draw modes and all pass limits, move counting (undo = 1, automatic = 0), undo restores flips and stock position, undo limits, tap order, safe auto-move, auto-complete, **every one of the 4,000 bank deals replays its stored winning line and par ≥ its length**, 1-pass/3-pass deals re-proven, grades repeatable, hints keep the game winnable, the warning never fires on a winnable position and flags dead ones, a timeout stays quiet, solver slices under 8 ms, Daily (120 days, weekday table, pinned fingerprints `2026-11-25 → 1|1049|medium|130`, `2027-01-01 → 1|264|hard|130`, one scored attempt, release-day XP, share line, streak, Full Week), all 45 levels load and win under their own rules (move limits and pass limits included), twists apply, puzzles are reachable and winnable, stars build up, unlocks, XP, hints, records, streaks, achievements, cosmetics, backup, old saves through `defSave()`, exact resume, and the Arcade contract (shared settings, summary fields, `solitaire.*` keys only, `location.replace`, `#game-settings`, `#arcadeBtn`, `#settingsBtn`, no service worker, no outside requests).
- `node tests/layout.js` — **246 checks**: no sideways scroll at 360 and 390 px in English and German on 28 screens and sheets; German shows no untranslated text; corner rank and suit ≥ 11 px in all 5 court styles × 4 frames × normal / 4-colour / high-contrast; cards about 48 px wide at 360 px; the 19-card column fits; drag a card and a run, an illegal drop slides back, tap, double-tap, stock tap, keyboard undo, left-handed swaps the top row, Android back opens the pause menu.

## Open items for playtesting
- **Not yet tried on a real phone.** Drag, tap, double-tap and the 46–48 px cards need the Galaxy S20 FE. The hint and warning searches are sliced, but on a slow phone a hard position may take a few seconds (the warning stays quiet if it times out).
- **Grades are lopsided.** The blind bot either nearly always wins a deal or nearly never does, so Medium and Hard are scarce (Draw 3 is three-quarters Expert). There are enough for the Daily and campaign, but Classic "Medium" and "Hard" pools are small (102–166 deals). Options: a stronger or noisier bot, or grade by a finer measure (bot moves, solver effort).
- **Par time may be tight** for casual players (about 1.07 s per par move; Easy Draw 1 ≈ 2:20). Easy to loosen in `tools/build_bank.js`.
- **A few loose pars:** 21 deals (of 4,000) have par over 250 because only the solver ever won them. They're all Expert; harmless, but they could be dropped.
- **Translations** are machine-assisted.
- In the claude.ai preview, "Save to file" in Backup does nothing (the viewer blocks downloads); Copy works. Fine in the standalone and Arcade builds.
- **Later (not in the demo):** challenge codes, a Daily league, FreeCell and other solitaires, Vegas scoring.
