# Chess v0.1.0 — handoff

Demo only. Nothing has been pushed to GitHub. Built 2026-11-25/26 from the kickoff (`claude/chess-kickoff.md`, updated for Arcade 0.11–0.12), the Arcade contract (`claude/arcade-integration.md`), `claude/arcade-updates-for-game-chats.md`, Sudoku v0.1.0 (shell: screens, sheets, i18n watcher, Web Audio synth, Linefall's Style screen, settings, backup, hint counter, weekday Daily, campaign stars, `core.js`, `build.py`, `tests/lib.js`, Arcade contract code), Tilecraft 0.1.1 (`games/tilecraft`, read-only: sliced computer search, share codes with avatars, games list, pass-and-play with the Player 2 avatar picker) and Sweep (`games/sweep`, read-only: cyrb128 → sfc32, the 15-level campaign pattern). The puzzles come from `Allasdair/lichess-puzzles` (`puzzles_filtered.csv`, already filtered to popularity ≥ 85, 500+ plays, rating deviation ≤ 90).

**Private playable demo:** https://claude.ai/artifact/Cw1XWWq7gMMMeGJQwt1npw (`dist/demo.html`)

## Summary for the Arcade chat
- **Game id:** `chess` · **Arcade build file:** `dist/chess/index.html` · **"‹ Arcade" button:** `#arcadeBtn` · **settings button:** `#settingsBtn`
- **Registry entry:** `{id:'chess', name:'Chess', desc:'Play, solve, improve', path:'chess/index.html', prefix:'chess.', art:'chess'}`
- **Page size:** Arcade build **824 KB** (fonts linked), standalone **916 KB** (Inter and JetBrains Mono inlined). The puzzle bank is 480 KB of that; the translation tables about 120 KB. Mind it in the service worker's cache part.
- **Fonts:** Inter and JetBrains Mono from `../fonts.css` (no Caveat).
- **Import check:** leaves only through `leaveTo(url)` → `location.replace(url)` and handles `#game-settings`, so it should print `ok, nothing to fix`.
- **Storage:** `chess.v1` (save, including the 2-Player games list and the analysis queue) and, in Arcade mode, `arcade.summary.chess`. Reads `arcade.v1`, never writes it.
- **Avatars:** guarded by `ARCADE && window.ArcadeAvatars`. In the CHF1 code the avatars sit **after the move list**: `0xA1`, seat-0 avatar, seat-1 avatar, then the 16-bit checksum. A code without them reads as 0, 0. Shown on both player bars, the games list (opponent), the "Join X's game" sheet and the pass-and-play "Pass to…" cover; pass-and-play setup has a "Player 2's avatar" picker. `tests/avatar_flow.py` row: import a CHF1 code from another player and check their avatar shows; the reply carries both.
- **Credits for Arcade's About page:** Lichess puzzle database (database.lichess.org, CC0); Inter, JetBrains Mono (SIL OFL).

## What's in v0.1.0
- **Play the computer:** 8 strengths, colour White / Black / Random, clock None / 10 min / 5 + 3 / 3 + 2 (the computer gets the same clock; its think time is capped by its clock), Standard or Chess960. Hints (the engine's best move as an arrow), takebacks (your move and the reply), draw offers (accepted when the computer's evaluation is within ±0.6 and 20+ moves are played), resign (two taps). Stars ★ win ★ no assists ★ accuracy ≥ 75%. Records per strength × colour, best accuracy, longest win streak, Chess960 record. An abandoned Classic game counts as a loss for the streak.
- **Puzzles:** by difficulty (Beginner < 1000, Easy 1000–1399, Normal 1400–1799, Hard 1800–2199, Expert 2200+), by theme (mate in 1/2/3, fork, pin, skewer, discovered attack, back-rank mate, promotion, endgame), or **Puzzle Streak** (each puzzle about 60 points harder; a wrong move ends it and plays out the solution). The computer plays the replies; any move that also mates counts; a wrong move shows a red square and is taken back. Hints: the first highlights the piece, the second shows the move (one hint from the counter). Stars ★ solved ★ first try ★ no hints. 2 XP per first-try solve without hints, capped at 30 a day. No repeats until that part of the bank is used up.
- **Campaign:** Pawn, Knight, Queen, 15 levels each (45 levels, 135 stars): puzzle sets, technique sets at 10 (back-rank mate, the fork, deflection, each explained with a diagram), endgame drills at 4/8/12, games, position games at 11, twists at 7/14, finales at 15 against strengths 3, 5 and 8. Stars build up across attempts. 30/75/135-star unlocks.
- **Daily:** `CHD1|YYYY-MM-DD` picks from the reserved Daily part (2,016 puzzles, 288 per weekday band; never used by Classic). Mon 800–1100 … Sun 2100–2400. One scored attempt (saved, resumable, "End attempt" uses it up), unlimited practice, share line with no moves (`Chess Daily · Wed 25 Nov · ★★★ · first try · 0:48`), 20 XP doubled on its release day, streak, last 7, Full Week.
- **2-Player:** share codes (`CHF1.`, paste the whole message; Copy, Share, select fallback) and pass-and-play (board flips to whoever moves, setting; optional clock and Chess960). Games list with Your turn / Waiting / finished results, two-tap delete. Resignations, draw offers ("offer a draw with your next move") and accepted draws travel in the codes. No XP; share-code wins count toward Rivals I–V; pass-and-play has its own record and counts nothing.
- **Game screen:** board edge to edge in portrait (45 px squares at 360 px), opponent bar above, yours below (avatar or strength badge, captured pieces with material count, clock), move list in SAN (tap a move to view it; ◀ ▶; "Back to game"), toolbar Takeback · Hint · Back · Forward · Menu; flip button. Landscape puts the move list beside the board. Tap-tap with legal-move dots and capture rings, or drag; last move and check highlighted; promotion sheet (auto-queen setting); confirm-move setting; keyboard (type e4 / Nf3 / O-O and Enter, arrows, U or Ctrl+Z, H, F, P or Esc).
- **Post-game analysis:** runs in the background in slices, resumes after leaving (partial results saved), toasts when ready and awards the accuracy star then. Review screen: every move classified (★ best, ✓ good, ?! inaccuracy, ? mistake, ?? blunder), accuracy per side with counts, an evaluation graph (tap to jump), "best was …" arrow and text.
- **Progression:** XP (Classic 5 + 5 × strength for a win, half for a draw, half again if assisted; puzzles 2 per first-try solve, 30 a day; campaign 6/10/15 per new star + 75/150/225 per campaign; Daily 20, ×2 on its day), 10 levels on Sweep's first 10 steps with a reward at every level 2–10, +1 hint per level-up, hints refill to 5 a day and stack to 99, 47 achievements, 33 cosmetics in 8 categories on Linefall's Style screen.
- **Look and sound:** piece sets Classic (Staunton-style), Minimal, Flat, Pixel, Glass, Medieval and the free **Letter** set, all our own SVG; white pieces light with a dark outline, black pieces dark with light details and a light rim. Boards Walnut, Green Tournament, Slate, Marble, Paper, Midnight, plus a free high-contrast board (the Arcade's colourblind setting turns it on). Highlights Accent, Amber, Sky, Mint. Check/mate effects Pulse, Ripple, Crack. Win effects None, Confetti, King Topple, Fireworks. Sounds (synthesized): Wood, Felt, Chiptune. Music: **Study** (new, 70 BPM, G major, soft bells; default), **Gambit** (new, 84 BPM, A minor lo-fi; level 10), Sweep's **Daylight**. Ambience: Library, Rain, Park (follows the Music switch). Reduce Motion / Animations off: pieces jump, no effects.
- **Languages:** the i18n watcher with `i18n_0_ui.js` (rows shared with Solitaire and Sudoku) and `i18n_1_chess.js` (Chess's own text), `[en, es, fr, de, pt]`, machine-assisted. Move notation stays standard; level, achievement, cosmetic and strength names stay English.
- **Saving:** every game (Classic, campaign, puzzle, Daily attempt, practice, each 2-Player game) saves after every move and on page hide, and resumes exactly (games are saved as start FEN + UCI moves and replayed).

## Files
```
chess/
  src/app.html        UI, screens, board and pieces, input, move list, analysis view, clock, audio, effects
  src/engine.js       0x88 board, legal moves, make/unmake, rules and draws, Chess960, SAN, FEN, Zobrist, perft
  src/search.js       evaluation, sliced alpha-beta search, strengths, hints, analysis
  src/book.js         the opening book (hand-written lines; 661 positions)
  src/puzzles.js      generated: the Classic and Daily puzzle banks
  src/levels.js       generated: the 45 campaign levels
  src/codes.js        2-Player share codes (CHF1.), including avatars
  src/pieces.js       SVG for every piece set (Letter set included)
  src/core.js         save, XP/levels, stars, records, hints, puzzles, Daily, campaign, games list, achievements,
                      cosmetics, analysis queue, backup, Arcade contract (no DOM)
  src/i18n_*.js       translation tables
  tools/build_puzzles.js  Lichess CSV (or .csv.zst) → src/puzzles.js (filters, sampling, replay check) · ~2 min
  tools/build_levels.js   → src/levels.js (plays every drill and position game to set par) · ~6 min; --nopar
  tools/calibrate.js      self-play between neighbouring strengths
  tests/run.js        node tests/run.js (QUICK=1 for short runs) · 1,497 checks · ~5 min (QUICK ~20 s)
  tests/layout.js     node tests/layout.js (Playwright + Chrome; python3 build.py first) · 238 checks · ~80 s
  tests/lib.js        loads the sources the way build.py concatenates them
  tests/daily_pins.json   two pinned Daily fingerprints
  fonts/              Inter, JetBrains Mono (SIL OFL, licences included)
  build.py            python3 build.py → dist/
  package.json        dev dependency: playwright (only for tests/layout.js)
```
To rebuild the bank: `node tools/build_puzzles.js path/to/puzzles_filtered.csv 4000 2016`, then `node tools/build_levels.js` (the levels reference puzzle ids), then refresh `tests/daily_pins.json`.

## Engine
- **Board:** 0x88 with incremental Zobrist keys (two 32-bit halves) and incremental middlegame/endgame piece-square scores. Pseudo-legal generation, legality by make + "is my king attacked". Castling is encoded king → own rook, so standard and Chess960 share one code path; typed or tapped g1/c1 also work in standard chess.
- **Perft:** start position to depth 5 (4,865,609), Kiwipete to 4, the en passant/pin, castling/promotion, promotion and middlegame reference positions, and three Chess960 positions, all exact. All 960 back ranks generated correctly; castling checked in every arrangement.
- **Search:** iterative deepening, PVS alpha-beta, quiescence on captures and promotions (delta pruning), transposition table (2^18), hash/MVV-LVA/killer/history ordering, null move, late-move reductions, futility at the last ply, check extension, repetition and fifty-move detection. ~250–400 k nodes/s in Node. Mates are reported exactly (it keeps deepening until a shorter mate is ruled out).
- **Evaluation (our own, written as formulas):** material and piece-square tables blended by phase, doubled/isolated/passed pawns (king distance in the endgame), bishop pair, rook on open/half-open files, mobility, king safety (pawn shield, open files, attackers on the king zone), tempo; endgames: drive a lone king to the edge (K+B+N: to a corner of the bishop's colour), Q v R included; pawnless edges smaller than four pawns are scaled down; insufficient material = 0.
- **Slices:** every node from the last ply up is a generator and yields when the ~6.5 ms budget is used, so a slice ends around 7–8 ms (Node: p99 ≈ 7.2 ms, worst ≈ 11 ms). One search runs at a time: the computer's move and hints first, the background analysis when nothing else needs the engine; each job keeps its own search state and table context.
- **Opening book:** ~80 hand-written main lines (open games, Sicilian, French, Caro-Kann, Scandinavian, Pirc, Alekhine, QGD, Slav, QGA, Nimzo/Queen's Indian, King's Indian, Grünfeld, Benoni, Benko, London, English, Réti and others), 661 positions; moves weighted by how many lines continue with them, so games vary. Strengths use it to 2/3/5 moves (3/4/5) or fully (6–8); never in Chess960.

## The 8 strengths and calibration
Weaker levels use depth caps, evaluation noise (σ in centipawns on each root move's score) and a chance to play a random legal move. Ratings are labels anchored at strength 1 ≈ 400, not official ratings.

| # | Name | Label | Search | Noise | Random move |
|---|---|---|---|---|---|
| 1 | Pebble | ~400 | depth 1, no quiescence | 200 | 25% |
| 2 | Twig | ~650 | depth 2, 1-ply quiescence | 200 | 20% |
| 3 | Lantern | ~900 | depth 3, 3-ply quiescence | 230 | 16% |
| 4 | Brook | ~1150 | depth 4 | 175 | 10% |
| 5 | Falcon | ~1400 | depth 5 (6 in endgames) | 155 | 8% |
| 6 | Tower | ~1650 | depth 6 | 120 | 6% |
| 7 | Sage | ~1900 | ~1 s | 90 | 4% |
| 8 | Titan | as strong as it gets | ~2 s | 0 | 0% |

Self-play (`/tmp`-style tuning runs with `tools/calibrate.js` logic; colours alternate; games over 240 plies adjudicated by evaluation), stronger side's score:

| Pairing | Result | Notes |
|---|---|---|
| 2 v 1 | 75% (40 games) | measured with these settings |
| 3 v 2 | 60–70% (48 games each for 220/.20 and 240/.16) | 230/.16 chosen between them |
| 4 v 3 | 57% at 200/.12, 89% at 150/.09 (40 games each) | 175/.10 chosen between them |
| 5 v 4 | 83% at 140/.07, 97% at 120/.06 (30 games each) | 155/.08 chosen |
| 6 v 5 | 54% at 150/.08, 98% at 110/.05 (24 games each) | 120/.06 chosen |
| 7 v 6 | 83% (12 games) | Sage 1 s, noise 90, 4% random |
| 8 v 7 | 100% (12 games) | Titan is noiseless at 2 s: the top step is the biggest |

**What this shows:** the steps from 2 to 7 land at or near the 70–80% target; the jump to Titan is much bigger (Titan is meant to be "as strong as our engine gets", but Sage could take less noise to close the gap, which would widen 7 v 6). Search depth is worth a lot, so most of each step comes from the noise and random-move settings, and the response is steep (a little more noise turns 98% into 54%). The chosen values sit between measured points; a full `node tools/calibrate.js 40 1 8` run (several hours; levels 7–8 think for 1–2 s a move) would confirm them. The kickoff's depths for 6 (depth 7) were lowered to depth 6 because the noisy levels search every root move with an open window, which at depth 7 was too slow for a phone.

**Thinking pause:** strengths 1–6 wait 0.4–1.0 s (setting). On phones, the time-based levels 7–8 simply search less deeply in their 1–2 s.

## Post-game analysis and accuracy
Each position is searched to depth 7 with a fresh table (so the same game always gives the same result). Win chance from the mover's view: **W(cp) = 100 / (1 + e^(−cp/250))**, mates ±100. A move's loss **L = W(best) − W(after the move)**. **Move accuracy = 100 · e^(−L/15)**; a player's accuracy is the mean over their moves (only moves skipped). Classes: best (the engine's move, no worse than it, or L ≤ 1), good ≤ 5, inaccuracy ≤ 12, mistake ≤ 24, blunder above. A 40-move game took about 26 s in Node (a desktop browser is similar); a mid-range phone is several times slower, so likely 1–2 minutes, a bit over the kickoff's "usually within a minute". `AN_DEPTH` in `search.js` is one constant: depth 6 roughly halves the time. It runs in the background and resumes.

## Puzzle bank (`tools/build_puzzles.js`, from `puzzles_filtered.csv`)
- Input: 40,000 puzzles (2,000 per 100-point band, 600–2599). Mate-in-5 and "veryLong" puzzles dropped: 35,506 candidates.
- **Classic: 4,000** · by band: Beginner 916, Easy 800, Normal 800, Hard 788, Expert 696 · by theme: mate in 1 387, mate in 2 561, mate in 3 329, fork 553, pin 276, skewer 184, discovered attack 266, back-rank mate 251, promotion 201, endgame 1,938, deflection 255.
- **Daily: 2,016** (288 per weekday band, Sun 2100–2400, Mon 800–1100, Tue 1100–1300, Wed 1300–1500, Thu 1500–1700, Fri 1700–1900, Sat 1900–2100) — about 5.5 years.
- **480 KB** (target < 500 KB). Stored per puzzle: Lichess id, the position after the opponent's first move (placement, side, castling, en passant), that first move (for the last-move highlight), the solution, rating, theme bits.
- Every kept puzzle is replayed by our engine: all moves legal, mate puzzles end in mate, other lines end ≥ +1.5 for the solver (depth-4 check).
- **Lichess credit:** How to play ("Puzzles credit") and About: *"Puzzles come from the Lichess puzzle database (database.lichess.org), released into the public domain (CC0). Thank you, Lichess."* Each puzzle's id is shown on its results sheet.

## Campaign (`src/levels.js`)
| # | Pawn | Knight | Queen |
|---|---|---|---|
| 1 | Rook and Bishop (set: 2 rook + 2 bishop moves) | Opening Bell (game v 3) | Strong Start (game v 5) |
| 2 | Queen and Knight (set) | Forks (set) | Mate in Three (set) |
| 3 | Pawn and King (set) | Pins (set) | Hidden Attacks (set) |
| 4 | Queen Mate (K+Q v K) | Opposition (K+P v K) | Bishop and Knight (K+B+N v K) |
| 5 | First Mates (mate in 1) | Mate in Two | Hard Tactics |
| 6 | First Game (game v 1) | Midgame (game v 4) | Steel (game v 6) |
| 7 | Black to Play (v 2, as Black) | Against the Clock (v 4, 5 + 3) | Dark Side (v 6, as Black) |
| 8 | Rook Mate (K+R v K) | Rook Endgame (K+R+P v K+R) | Lucena |
| 9 | Free Pieces (set) | Skewers and Discoveries (set) | Expert Tactics (set) |
| 10 | Back Rank (technique) | The Fork (technique) | Deflection (technique) |
| 11 | Up a Piece (position v 2) | Press the Advantage (position v 4) | Convert (position v 6) |
| 12 | Two Rooks (K+2R v K) | Queen vs Pawn (K+Q v K+P) | Philidor (defence drill) |
| 13 | Sharp Eyes (set) | Tactics Mix (set) | Master Tactics (set) |
| 14 | No Help (v 3, no takebacks or hints) | Shuffled (v 5, Chess960) | Unaided 960 (v 7, Chess960, no assists) |
| 15 | Pawn Finale (v 3) | Knight Finale (v 5) | Titan (v 8) |

Sets are 4–5 puzzles (rising rating), picked by theme and rating from the Classic bank with no repeats between levels; with this bank no pick needed relaxing. Drills are played against strength 6 (Philidor's attacker: 7).

**Par (from the engine's own winning line + slack; `tools/levels_report.json`):** drills par = ⌈moves × 1.5⌉ + 4, capped at 48 for pawnless drills (fifty-move rule); position games: three engine games against the level's strength, the median win, par = ⌈moves × 1.5⌉ + 6, at least 30.

| Level | Engine | Par |
|---|---|---|
| Pawn 4 K+Q v K | 13 | 24 |
| Pawn 8 K+R v K | 10 | 19 |
| Pawn 11 Up a Piece | 17/19/20 | 35 |
| Pawn 12 K+2R v K | 5 | 12 |
| Knight 4 K+P v K | 11 | 21 |
| Knight 8 K+R+P v K+R | 10 | 19 |
| Knight 11 Press the Advantage | 19/29/30 | 50 |
| Knight 12 K+Q v K+P | 8 | 16 |
| Queen 4 K+B+N v K | 38 | 48 (fifty-move cap) |
| Queen 8 Lucena | 18 | 31 |
| Queen 11 Convert | 38/44/46 | 72 |

## Decisions taken (all easy to change)
1. **Philidor is a defence drill.** "Clear = checkmate" doesn't fit Philidor (it's the drawing method), so Queen 12 has you defend R v R+P as Black: ★ hold 25 moves (or reach a draw) · ★ keep your rook · ★ no assists.
2. **Strength 6 searches to depth 6** (not 7), see calibration; the noisy levels need every root move scored.
3. **Puzzle Streak** is a third Puzzles option (rising difficulty); the record counts first-try solves in a row in any Classic, Daily or campaign puzzle.
4. **A puzzle hint costs one hint for both stages** (piece, then move). Wrong moves can be retried, except in Streak.
5. **Classic XP** follows the kickoff's chess-specific rule (5 + 5 × strength; draw half), with "assisted wins earn half" applied on top.
6. **Takebacks** are only against the computer (not in puzzles or 2-Player); they're assists and disabled on "no assists" levels.
7. **Pass-and-play** shows the "Pass to…" cover when a game is opened or resumed, not after every move (nothing is hidden in chess); the board flips after each move (setting).
8. **2-Player codes** carry the start (standard or the Chess960 index), seat 0's colour, names, every move as its index among the legal moves sorted by UCI (1 byte a move), the end (resign/agreed draw) and a draw-offer flag. A 120-ply game is ~230 characters.
9. **Clock games:** the clock starts on the first move; increments are added after each move; flag fall loses unless the opponent has only a king (draw). The computer's own time per move is capped by its clock.
10. **Cosmetic unlocks:** level 2 Green Tournament + Confetti · 3 Minimal + Amber · 4 Felt + Library · 5 Slate + Ripple · 6 Flat + Sky · 7 King Topple + Rain · 8 Marble + Mint · 9 Pixel + Chiptune · 10 Paper + Gambit. Stars 30 Glass, 75 Midnight, 135 Medieval. Achievements: Fireworks (Perfect Game), Crack (Smothered), Park (Hot Streak), Daylight (Daily Star).
11. **Draw offers to the computer** are accepted at |eval| ≤ 0.6 after 20 moves.
12. **Analysis** is automatic by default; with it off, a game is queued but waits for the Analysis button.

## Tests
- `node tests/run.js` — **1,497 checks**: perft (all reference positions, standard and Chess960), all 960 back ranks, castling in every arrangement, castling rules (through check, out of check, rights lost), en passant, promotions, draws (threefold, fifty moves, insufficient material, stalemate, mate), SAN out (disambiguation by file, rank, square; check and mate suffixes; promotion) and typed input (SAN, lowercase, UCI, 0-0), FEN round trips; engine: mates in 1, 2 and 3 found exactly and played through, never an illegal move (standard and 960, levels 1–4), slice times, book legal and varied, strength order; puzzles: every bank puzzle replays legally, mates are mate, alternative mates accepted, Daily part separate, no repeats, streak gets harder, stars, XP cap; analysis: deterministic, resumes after leaving, flags a bad move; Daily: 120 days in two loads, weekday bands, pinned fingerprints, one scored attempt, release-day XP, share line with no moves, streak, Full Week; campaign: 45 levels, puzzles exist and aren't reused, layout (drills 4/8/12, technique 10, finale 15, twists 7/14), unlocks, stars build up, accuracy star arrives later, every drill mated by the engine within par; codes: round trips (moves, names, avatars, Chess960, a 120-ply game), avatar bytes position, code without avatars, damaged/illegal/wrong turn/older/same/deleted refused, resign and draw offer travel, Rivals counting, pass-and-play counts nothing; core: old saves via `defSave()`, exact resume, a reward at every level 2–10, hints, XP rules, records, mate-kind achievements, backup, cosmetics; Arcade contract (shared settings, summary fields, only `chess.*` keys, `location.replace`, `#game-settings`, `#arcadeBtn`, `#settingsBtn`, no service worker, no outside URLs, no code hidden after a `//` comment).
- `node tests/layout.js` — **238 checks**: no sideways scroll at 360 and 390 px in English and German on 50 screens, sheets and game states; German shows no untranslated text; every tip, star goal, achievement, cosmetic, result and message has a German row; 45 px squares at 360 px; every piece set distinguishable in grayscale; tap-tap, drag, move-list navigation, flip, promotion sheet, keyboard entry, Android back → pause; the Arcade build with `avatars.js` (#game-settings, shared settings, colourblind → high contrast, my avatar, the join sheet, both player bars, the reply carrying both avatars, the games list, the Player 2 picker, the pass cover, only `chess.*` keys, summary, no outside requests) and the standalone build showing no avatars.
- **Found and fixed while building:** a `//` comment in the one-line job scheduler swallowed the rest of the line (exactly the Arcade 0.12 lesson); now `/* */`, and `tests/run.js` scans every source for code hidden after a `//` comment.

## Open items for playtesting
- **Not yet tried on a real phone.** Tap, drag, the 45 px squares and the time-based strengths (7–8 search less deeply on a phone) need the Galaxy S20 FE.
- **Strength steps** are tuned from short self-play runs (above); a long `tools/calibrate.js` run would firm them up, and human feedback matters more than bot win rates.
- **Par** for position games depends on how the defender plays; Queen 11 (72) may be loose, Knight 4/8 drills fairly tight. One constant each in `tools/build_levels.js`.
- **The K+B+N drill** is a stretch level: its par equals the fifty-move limit.
- **Translations** are machine-assisted.
- In the claude.ai preview, "Save to file" in Backup does nothing (the viewer blocks downloads); Copy works.
- **Later (not in the demo):** online play, more variants, an opening explorer, PGN export, a Daily league, opening a 2-Player code from a link.
