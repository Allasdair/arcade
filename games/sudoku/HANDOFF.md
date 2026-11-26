# Sudoku v0.1.0 — handoff

Demo only. Nothing has been pushed to GitHub. Built 2026-11-25 from the kickoff (`claude/sudoku-kickoff.md`), the Arcade contract (`claude/arcade-integration.md`), Solitaire v0.1.0 (shell: screens, sheets, i18n watcher, Web Audio synth, Linefall's Style screen, settings, backup, hint counter, weekday Daily, campaign stars, `core.js`, `build.py`, `tests/lib.js`, Arcade contract code) and Sweep (`games/sweep`, read-only: grading by logic steps, the 15-level campaign pattern, cyrb128 → sfc32). This is the game on its own; the Arcade contract is built in, so it should drop in.

**Private playable demo:** https://claude.ai/artifact/KDQcsxjJj6KUPM7qCVVzpN (`dist/demo.html`)

## Summary for the Arcade chat (when it's time)
- **Game id:** `sudoku` · **Arcade build file:** `dist/sudoku/index.html` · **"‹ Arcade" button:** `#arcadeBtn` · **settings button:** `#settingsBtn`
- **Registry entry:** `{id:'sudoku', name:'Sudoku', desc:'Pure logic, never a guess', path:'sudoku/index.html', prefix:'sudoku.', art:'sudoku'}`
- **Page size:** Arcade build **385 KB** (fonts linked), standalone **543 KB** (Inter, JetBrains Mono and Caveat inlined). The bank is 116 KB of that; the translation tables about 75 KB.
- **Fonts:** the Arcade build uses Inter, JetBrains Mono and **Caveat** (the Handwritten digit font) from `../fonts.css`. Arcade's `docs/fonts.css` already has all three.
- **Import check:** leaves only through `leaveTo(url)` → `location.replace(url)` and handles `#game-settings`, so it should print `ok, nothing to fix`.
- **Storage:** `sudoku.v1` (save) and, in Arcade mode, `arcade.summary.sudoku`. Reads `arcade.v1`, never writes it.

## What's in v0.1.0
- **Classic:** Mini 6×6, Classic, Diagonal, Jigsaw × Easy / Normal / Hard / Expert (Mini: Easy and Normal). Generated on the phone in ~8 ms slices for Easy to Hard (and Mini Easy), falling back to the bank after 2.5 s; Expert and Mini Normal always come from the bank (no repeats until that part of the bank is used up). Stars: ★ clear, ★ under par time, ★ no assists.
- **Campaign:** Novice, Adept, Master, 15 levels each (45 levels, 135 stars), Sweep's design: basics 1–3, variant levels 4/8/12, rising standard puzzles 5/6/9/11/13, twists 7/14, a technique puzzle at 10, a finale at 15. Stars build up across attempts. 30/75/135-star unlocks.
- **Daily:** `SUDD1|YYYY-MM-DD` picks from the bank by weekday (Mon Classic Easy, Tue Classic Normal, Wed Diagonal Normal, Thu Classic Hard, Fri Jigsaw Hard, Sat Diagonal Hard, Sun Classic Expert). One scored attempt (saved, resumable, "End attempt" uses it up), unlimited practice, share line (`Sudoku Daily · Wed 25 Nov · Diagonal · 7:42 · ★★★`, `· assisted`), 20 XP doubled on its release day, streak, last 7, Full Week.
- **Engine** (`engine.js`, pure, JSON state): every variant is a list of houses (rows, columns, regions, diagonals). Givens locked, clashes outlined (always on), notes with auto-remove, Fill notes, unlimited free undo, mistakes and the mistake limit, win detection.
- **Input:** tap a cell then a digit; long-press a digit to lock it (digit-first; a setting makes a short tap lock); Notes mode; Erase; Undo; Hint; keyboard (arrows, 1–9, Shift+digit note, N, Backspace/0, U/Ctrl+Z, H, P/Esc). Highlights: row/column/box, same digit, and in Notes mode (or with a locked digit) every note with that digit. A pad digit greys out when all its copies are placed (and shows how many are left).
- **Logic solver** (`solver.js`): naked/hidden singles, pointing, claiming, naked/hidden pairs, triples and quads, X-Wing, Swordfish, XY-Wing, XYZ-Wing, simple colouring (wrap and trap), easiest first, on candidates. Grades, counts, par time, hints. **Exact solver:** bit masks with backtracking, counts to 2.
- **Hints:** the next logical step, with the cell or notes it changes, the houses involved highlighted, the pattern cells marked, and a one-line explanation per technique and house ("X-Wing on 4: in these 2 rows, 4 can only go in the same 2 columns, so it comes out of the rest of those columns."). **Apply** places the digit or removes those notes; **OK** just closes. A wrong digit is pointed out first ("This 5 is wrong." · Erase it).
- **Progression:** XP (Classic 10/15/22/30, half if assisted; campaign 6/10/15 per new star + 75/150/225 per campaign; Daily 20, ×2 on its day), 10 levels on Sweep's first 10 steps with a reward at every level 2–10, +1 hint per level-up, hints refill to 5 a day and stack to 99, records per variant × difficulty (wins, best unassisted time, fewest mistakes, current and best streak), 39 achievements, 38 cosmetics in 9 categories on Linefall's Style screen.
- **Look:** six board themes (Paper, Slate, Graph Paper, Midnight, Sakura, Terminal), five digit fonts (Inter, JetBrains Mono, Serif, our own stroke-drawn **Rounded**, Handwritten/Caveat), three note styles (Grid, Corner, Centre), five highlight colours, four completion effects (Ripple, Shimmer, Pulse, Sweep), five win effects (None, Confetti, Fireworks, Digit Rain, Grid Glow). Givens are always bolder, a different colour and on a lightly tinted cell. High contrast, large digits and colourblind-safe highlights are free settings; the Arcade's colourblind setting turns on high contrast and the colourblind-safe highlights.
- **Sound:** synthesized live. Soft / Pencil / Chiptune packs (tap, place, note, erase, undo, completion chime rising with how many houses finished, hint, mistake, lose, win, level-up, stars). Music: **Inkwell** (new, 72 BPM, F major, soft bells; default), **Lanterns** (new, 80 BPM, E minor lo-fi; level 10), Sweep's **Daylight** (Daily Star). Ambience: Rain, Café, Library (follows the Music switch).
- **Languages:** the i18n watcher with `i18n_0_ui.js` (rows shared with Solitaire), `i18n_1_game.js` (game screen, every hint × house, results, all 45 level tips) and `i18n_2_screens.js` (setup, Daily, Progress, Style, Settings, How to play, achievements). `[en, es, fr, de, pt]`, machine-assisted. Level, achievement and cosmetic names stay English.
- **Saving:** every game (Classic, campaign, Daily attempt, practice) saves after every action and on page hide, with its undo history, and resumes exactly.

## Files
```
sudoku/
  src/app.html          UI, screens, board and pad, input, highlights, hints, effects, audio
  src/engine.js         RNG, variants and houses, rules, actions (place, notes, erase, Fill notes, undo), mistakes, compact puzzle format
  src/solver.js         logic solver (15 techniques, grading, par, hint steps), exact solver, Jigsaw layouts, generator (sliced)
  src/bank.js           generated: 4,200 graded puzzles (300 per variant × grade) + 48 Jigsaw layouts
  src/levels.js         generated: the 45 campaign levels (3 technique puzzles with their notes)
  src/core.js           save, XP/levels, stars, records, hints, Daily, campaign, achievements, cosmetics, backup, Arcade contract
  src/i18n_*.js         translation tables
  tools/build_bank.js   node tools/build_bank.js [N] → src/bank.js (~5 min on 2 cores)
  tools/build_levels.js node tools/build_levels.js → src/levels.js (~2 s)
  tests/run.js          node tests/run.js (QUICK=1 for short runs) · 1,109 checks · ~8 s
  tests/layout.js       node tests/layout.js (Playwright + Chrome; python3 build.py first) · 200 checks · ~50 s
  tests/lib.js          loads the sources the way build.py concatenates them
  fonts/                Inter, JetBrains Mono, Caveat (SIL OFL, licences included)
  build.py              python3 build.py → dist/
  package.json          dev dependency: playwright (only for tests/layout.js)
```

## Bank (`tools/build_bank.js 300`, 116.0 KB, target < 150 KB)
Givens: fewest / median / most. Par: median. Hardest technique: how many puzzles need it as their hardest step.

| Variant | Grade | Puzzles | Givens | Par | Hardest technique |
|---|---|---|---|---|---|
| mini | easy | 300 | 14 / 16 / 18 | 2:30 | Hidden single 300 |
| mini | normal | 300 | 10 / 12 / 14 | 4:00 | Pointing 261, Naked pair 22, Claiming 16, Hidden pair 1 |
| classic | easy | 300 | 36 / 40 / 45 | 8:00 | Hidden single 299, Naked single 1 |
| classic | normal | 300 | 27 / 30 / 35 | 11:00 | Pointing 202, Naked pair 52, Claiming 31, Hidden pair 15 |
| classic | hard | 300 | 24 / 30 / 31 | 15:30 | XY-Wing 269, X-Wing 23, Naked triple 7, Hidden triple 1 |
| classic | expert | 300 | 25 / 30 / 30 | 19:00 | Simple colouring 259, XYZ-Wing 32, Swordfish 9 |
| diag | easy | 300 | 30 / 35 / 40 | 9:00 | Hidden single 294, Naked single 6 |
| diag | normal | 300 | 22 / 27 / 30 | 12:30 | Pointing 169, Claiming 75, Naked pair 38, Hidden pair 18 |
| diag | hard | 300 | 20 / 25 / 26 | 19:30 | XY-Wing 253, Naked triple 24, X-Wing 17, Hidden triple 6 |
| diag | expert | 300 | 20 / 24 / 24 | 30:00 | Simple colouring 283, XYZ-Wing 16, Swordfish 1 |
| jigsaw | easy | 300 | 36 / 40 / 45 | 8:00 | Hidden single 300 |
| jigsaw | normal | 300 | 27 / 29 / 35 | 11:30 | Pointing 266, Claiming 22, Naked pair 11, Hidden pair 1 |
| jigsaw | hard | 300 | 24 / 26 / 31 | 21:00 | XY-Wing 175, X-Wing 97, Naked triple 24, Hidden triple 4 |
| jigsaw | expert | 300 | 22 / 26 / 30 | 26:00 | Simple colouring 247, XYZ-Wing 43, Swordfish 9, Naked quad 1 |

- **Format:** a 6-bit mask over the first half of the cells (givens are 180° symmetric), then the given digits three per two characters (base 9); Jigsaw puzzles start with their layout's index. About 28 characters per 9×9 puzzle.
- **Every bank puzzle** is checked by the tests: exactly one solution (exact solver), solved by logic within its grade with its hardest technique exactly its grade, 180° symmetric, given count in range.
- **Generation cost (Node, 1 core):** Classic Normal ~0.08 s, Hard ~0.2 s, Expert ~0.3 s per kept puzzle; Mini Normal ~0.7 s (1 kept in ~360 tries). **On the page with Chrome's CPU throttled 4×** (roughly a mid-range phone): Classic Normal median 0.25 s, Hard 0.4 s; Jigsaw Normal 0.15 s, Hard 0.23 s (worst 1.9 s); Diagonal under 0.1 s; worst single slice ~19 ms (≈5 ms unthrottled). No bank fallbacks in 64 runs. "Making a puzzle…" shows after 250 ms.

## Par time
- **Formula** (`PAR` in `solver.js`, one place to loosen it): Σ over the solver's steps of the technique's casual spotting time × **1.4** slack, rounded up to 30 s. Spotting times: hidden single 8 s, naked single 10 s, pointing 30 s, claiming 32 s, naked pair 40 s, hidden pair 50 s, naked triple 75 s, hidden triple 90 s, X-Wing 100 s, XY-Wing 110 s, Swordfish / XYZ-Wing / naked quad 150 s, hidden quad 170 s, simple colouring 180 s. Mini singles count 0.6×.
- **Medians:** Classic Easy 8:00, Normal 11:00, Hard 15:30, Expert 19:00; Diagonal 9:00 / 12:30 / 19:30 / 30:00; Jigsaw 8:00 / 11:30 / 21:00 / 26:00; Mini 2:30 / 4:00 (table above).
- These are first estimates (bots can't measure human spotting time). The lesson from Solitaire and Mahjong was "too tight", so they lean generous; loosen `PAR.slack` if testers still miss the star.

## Campaign (`src/levels.js`)
| # | Novice | Adept | Master |
|---|---|---|---|
| 1 | First Steps (Mini Easy) | Next Step (Normal) | Master Class (Hard) |
| 2 | Six by Six (Mini Easy) | Pointers (Normal) | Into the Deep (Expert) |
| 3 | Full Size (Easy) | Pair Up (Normal, hidden pair) | Long Chains (Expert, colouring) |
| 4 | Small Print (Mini Normal) | Diagonal Lines (Diagonal Normal) | Jigsaw Master (Jigsaw Hard) |
| 5 | Open Rows (Easy) | Triples (Hard, triple) | Swordfish (Expert, Swordfish) |
| 6 | Box Clever (Easy) | Wings (Hard, XY-Wing) | Three Corners (Expert, XYZ-Wing) |
| 7 | Careful Now (Easy · mistake limit 3) | No Safety Net (Normal · check off) | Three Strikes (Hard · mistake limit 3) |
| 8 | Crossroads (Diagonal Easy) | Odd Shapes (Jigsaw Normal) | Double Cross (Diagonal Expert) |
| 9 | Pointing the Way (Normal, pointing) | Corner to Corner (Hard, X-Wing) | Pattern Hunter (Expert) |
| 10 | Only Here (technique: hidden single) | Pointing (technique: pointing pair) | X Marks (technique: X-Wing) |
| 11 | Pairs (Normal, naked pair) | Hard Graft (Hard) | Endgame (Expert) |
| 12 | Pocket Puzzle (Mini Normal) | Patchwork (Jigsaw Hard) | Shattered (Jigsaw Expert) |
| 13 | Steady (Normal) | Deep Water (Hard) | Summit (Expert) |
| 14 | Pen Only (Easy · no notes) | Against the Clock (Hard · tight par) | Blindfold (Expert · check off) |
| 15 | Graduation (hardest Normal) | Adept's Trial (hardest Hard) | Grandmaster (hardest Expert in the bank) |

- Unmarked standard levels are Classic. Levels named after a technique use a puzzle that needs it. Standard levels rise by difficulty score within their grade.
- **Technique puzzles** are part-solved grids (63–69% solved) cut from a logic-solver trace exactly where the easiest step is the technique; the solved cells become givens. Adept and Master ship with notes (the solver's candidates at that point), so the next step really is pointing / X-Wing; Novice's hidden-single puzzle ships without notes and has no naked single available. The level sheet shows a diagram of the technique.
- **Grandmaster** (Master 15) is the bank's hardest Expert by the work beyond singles: a Diagonal with par 72:00.

## Decisions taken (all easy to change)
1. **Given counts are per variant.** The kickoff's ranges were "roughly". Random symmetric 9×9 puzzles stay singles-only down to ~26 givens, so Classic and Jigsaw use Normal 27–35, Hard 24–31, Expert 22–30 (Easy 36–45 as asked). Diagonal's extra houses need fewer givens: Easy 30–40, Normal 22–30, Hard 19–26, Expert 17–24. Mini: Easy 14–18, Normal 10–15.
2. **The generator steers.** Pairs come out at random until near the target count, then it prefers a removal that makes the puzzle need the target grade. It keeps a puzzle only if its hardest technique is exactly the grade.
3. **Mini Normal comes from the bank only.** 6×6 puzzles almost never need more than singles (1 in ~360 generated), too slow for the phone. Expert is bank-only too, as the kickoff says.
4. **Quads are Expert** (the grade table didn't place them). **Fish** (X-Wing, Swordfish) run on rows and columns only. **Simple colouring** uses chains of 3+ cells with the wrap and trap rules.
5. **Hints read your notes, but never trust wrong ones.** Candidates are the legal ones narrowed by your notes wherever those still hold the right digit. A hint is spent when shown. **Apply** places the digit, or removes the notes (filling a cell's candidates first if it had none). A wrong digit is shown first, with "Erase it".
6. **Mistake check off:** when the grid is full and wrong a message says so; the clashing cells are already outlined (with one solution, a full wrong grid always has a clash). No assist. **Turning mistake check on mid-game** counts the digits already wrong as mistakes (they turn red).
7. **Placing the same digit again erases it.** Undo, Fill notes and auto-remove notes are never assists.
8. **Restart** starts the same puzzle with the clock at 0. If the game was assisted it stays assisted; the mistake count resets, so a failed mistake-limit level can be retried.
9. **Twists:** Novice 7 mistake limit, 14 no notes; Adept 7 check off, 14 tight par (70% of par); Master 7 mistake limit, 14 check off.
10. **Achievements:** "Wing It" became *clear a puzzle that needs an XY-Wing or XYZ-Wing* (the kickoff's "clear an Expert puzzle" was the same as "Expert Solver"). "Polymath" is Classic, Diagonal and Jigsaw at Hard or Expert plus a Mini at Normal (Mini has no Hard). "Pencil Pusher" counts Hard or Expert, "Ink Only" Normal or harder. Difficulty, variant, clears and technique achievements count Classic, campaign and the Daily's scored attempt (not practice).
11. **Cosmetic unlocks:** level 2 Slate, Confetti · 3 Corner notes, Sky · 4 Pencil sounds, Rain · 5 JetBrains Mono, Shimmer · 6 Graph Paper, Mint · 7 Centre notes, Fireworks, Café · 8 Serif, Amber, Pulse · 9 Midnight, Chiptune · 10 Rounded, Violet, Lanterns. Stars: 30 Digit Rain, 75 Sakura, 135 Grid Glow. Achievements: Terminal board (Wing It), Handwritten digits (Pencil Pusher), Sweep completion (Polymath), Library ambience (Scholar), Daylight music (Daily Star).
12. **Fonts:** Rounded is drawn as our own SVG strokes (same on every device); Serif uses the system serif (Georgia / Noto Serif); Handwritten is Caveat (OFL), bundled.
13. **Fill notes** is in the pause menu (the "menu"). **Landscape:** the pad sits right of the board (left when left-handed), digits in a 3×3 block.
14. **The clock starts on the first move** (selecting a cell isn't a move) and stops when paused, hidden, on another screen or while a sheet is open.
15. **Jigsaw layouts:** 48 random connected layouts, shared by the bank's Jigsaw puzzles; Classic Jigsaw on the phone generates a new puzzle on one of them.
16. **Translations:** "Jigsaw" is *Puzzle* in French and German and *Quebra-cabeça* in Portuguese; Spanish keeps *Jigsaw*. Campaign names are translated (Novato / Novice / Anfänger / Iniciante…).

## Tests
- `node tests/run.js` — **1,109 checks:** houses for every variant (Mini 2×3 boxes, diagonals, all 48 Jigsaw layouts connected, 9 × 9 cells); givens locked; clashes; notes add/remove, auto-remove, Fill notes = exactly the legal candidates; undo restores every earlier state over random action sequences; mistakes, mistake check off, the mistake limit; **every technique on a hand-made position** (hidden and naked single, pointing, claiming, naked and hidden pair/triple/quad, X-Wing, Swordfish, XY-Wing, XYZ-Wing, colouring wrap and trap); every solver step over ~700 bank puzzles agrees with the solution; **all 4,200 bank puzzles** unique, graded exactly, symmetric, in range; generated puzzles unique, symmetric and graded, slices p99 < 8 ms; hints alone finish 84 games across every variant × grade with every step legal; a wrong digit is shown first; wrong notes are ignored; Daily (120 days in two separate loads, the weekday table, pinned `2026-11-25 → diag|normal|167` and `2027-01-01 → jigsaw|hard|219`, one scored attempt, release-day XP, share line, streak, last 7, Full Week); all 45 levels load with one solution, twists apply, technique puzzles start exactly at their technique, Master 15 is the hardest Expert, stars build up, unlocks; old saves through `defSave()`, exact mid-game restore; XP, a reward at every level 2–10, hints, records, achievements, cosmetics, backup; the Arcade contract (shared settings, summary fields, only `sudoku.*` keys, `location.replace`, `#game-settings`, `#arcadeBtn`, `#settingsBtn`, no service worker, no outside URLs, Arcade build links `../fonts.css`, strict CSP).
- `node tests/layout.js` — **200 checks:** no sideways scroll at 360 and 390 px in English and German on 36 screens, sheets and game states; German shows no untranslated text, and every level tip, achievement, cosmetic description, toast and all 41 hint wordings have German rows; cells 37 px at 360 px; all five digit fonts distinct at that size, givens distinct from player digits in each, digits ≥ 16 px tall; notes ≥ 8.5 px in all three styles; Jigsaw borders 2.6 px and ≥ 3:1 contrast in every theme; pad, long-press digit-first, digit-first setting, notes, erase, undo, keyboard; a wrong digit turns red; landscape puts the pad beside the board; Android back opens the pause menu; Arcade mode (`#game-settings`, Arcade settings row, shared settings and colourblind, ‹ Arcade button, only `sudoku.*` keys, summary written, no outside requests).

## Open items for playtesting
- **Not yet tried on a real phone.** The pad, long-press locking (420 ms) and 37 px cells need the Galaxy S20 FE.
- **Par times are estimates.** Medians are above; the Expert Diagonal pars (30:00) and Grandmaster (72:00) may feel long or short. One constant to change.
- **Hard is mostly XY-Wing and Expert mostly colouring.** That's what the steered generator finds most often. X-Wing is common in Jigsaw Hard (97 of 300). If more variety is wanted, the generator could prefer a technique per puzzle.
- **Mini Normal** puzzles need exactly one pointing or pair step; they feel close to Easy.
- **Translations** are machine-assisted.
- In the claude.ai preview, "Save to file" in Backup does nothing (the viewer blocks downloads); Copy works.
- **Later (not in the demo):** Killer Sudoku, challenge codes, a Daily league, 16×16.
