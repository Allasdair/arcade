# Tilecraft v0.1.0 — handoff to the Arcade chat

Demo only. Nothing has been pushed to GitHub.

Built 2026-11-24 from the kickoff (`claude/tilecraft-kickoff.md` in the Arcade Game Lab project), the Arcade contract (`claude/arcade-integration.md`), Linefall v0.1.0 (shell: i18n watcher, Web Audio synth, sheets, Style screen, settings, backup, Arcade contract, `build.py`, test setup), Ship Fight (AI levels and campaign shape) and a read-only clone of Sweep v1.2.1 (`github.com/Allasdair/sweep`, `main`, commit `ab7cecd`) for the seeded RNG, share-code format, hint economy and shape masks.

**Private playable demo:** https://claude.ai/artifact/PggV4yq2i44UNF6EBTwRPz (`dist/demo.html`)

## Summary for the Arcade chat
- **Game id:** `tilecraft` · **Arcade build file:** `dist/tilecraft/index.html` · **"‹ Arcade" button:** `#arcadeBtn` · **settings button:** `#settingsBtn`
- **Registry entry:** `{id:'tilecraft', name:'Tilecraft', desc:'Craft words, outscore the rest', path:'tilecraft/index.html', prefix:'tilecraft.', art:'tilecraft'}`
- **Page size:** Arcade build **742 KB** (fonts linked), standalone **901 KB** (fonts inlined). Target was under ~1.2 MB. The dictionary is 480 KB of that; mind it in the service worker's cache part.
- **Import check:** the source already leaves with `location.replace(url)` (in `leaveTo`) and handles `#game-settings`, so it should print `ok, nothing to fix`.
- **Credits for Arcade's About page:** ENABLE word list (public domain); banned-word review started from the LDNOOBW "List of Dirty, Naughty, Obscene and Otherwise Bad Words" (LDNOOBW contributors, CC BY 4.0); Inter, JetBrains Mono, Caveat (SIL OFL).

## What's in v0.1.0
- **Classic:** you against the computer (Easy, Normal, Hard, Expert). Setup sheet: board size (Small 11×11, Medium 15×15, Large 19×19), shape (Square, Ring, Cross, Diamond), turn timer (Off/30/60/90 s/2 min, your turns only, 5-second warning ticks, tiles recalled and the turn passed at 0), minimum word length (main word only), maximum word length (every word formed), blanks (default/0/2/4), no repeat words, swaps allowed, more rare letters. Choices are remembered. Every game has a freshly generated board.
- **Campaign:** Apprentice, Journeyman, Master, 15 levels each (45 levels, 135 stars), Sweep's structure: linear unlocks (clearing a level opens the next, level 15 opens the next campaign), stars ★ goal / ★ no hints / ★ twist that build up across attempts, level intro sheet, 30/75/135-star cosmetic unlocks. Duels, score targets, three best-move puzzles, shaped boards at 4/8/12, twist levels with modifiers at 7/14, finales against Normal/Hard/Expert.
- **Daily:** `TCD1|YYYY-MM-DD` seeds a Medium board and the whole bag order; solo, 10 turns, no hints; par from the solver playing the Expert's choices; ★ 60% / ★★ 85% / ★★★ 100% of par; one scored attempt (saved and resumable), unlimited practice; share line with no words, e.g. `Tilecraft Daily · 24 Nov · 312 (84% of par) · ★★☆`; 20 XP, doubled on its release day; streak, best % of par, last 7 Dailies.
- **2-Player:** share codes (`TCF1.` + base64url; paste the whole message, the code is found in the text; share sheet → copy → select fallback) and pass-and-play ("Pass to [name]" hides the rack). Games list with Your turn / Waiting / Finished, opponent, scores and last-move time; New game, Paste code, Delete (two taps). No XP; share-code wins count toward Rivals I–V, pass-and-play counts nothing.
- **Game screen:** scoreboard (names, scores, whose turn, bag or turn count, timer, par or goal), board filling the width with pinch zoom, drag to pan, double-tap to toggle whole-board/zoomed, optional auto-zoom round the first tile, last move highlighted; word line (each word ✓/✗ with its score, and the reason a move isn't allowed); rack of 7; Shuffle, Recall, Swap, Pass, Hint and Play; menu with move history, settings, resign, save and quit. Drag or tap placement (setting: Drag/Tap/Both); placed tiles can be dragged to another square or back; blanks open an A–Z sheet and show their letter in a different colour with a dotted underline, worth 0. Keyboard on desktop: Enter plays, Esc recalls or pauses, Space shuffles, Backspace takes back the last tile.
- **Computer:** 4 strengths exactly as the kickoff describes; it thinks in ~8 ms slices per frame (no Worker), waits 0.6–1.2 s (Settings: off = instant), and its tiles animate onto the board one by one.
- **Progression:** XP (Classic 5 + win bonus 10/20/30/45, +10% per harder modifier capped at 40%; campaign 6/10/15 per new star + 75/150/225 per campaign; Daily 20/40), 10 levels on Sweep's first 10 steps with a reward at every level 2–10, +1 hint per level-up, hints refill to 3 a day and stack to 99, records, 30 achievements, 25 cosmetics (7 tile styles, 6 board themes, 3 letter fonts, 4 word effects, 3 soundtracks, 2 sound packs) on Linefall's Style screen with preview cards.
- **Sound:** synthesized live. Soft click on placing, glint on premium squares, count-up on the word line, big-move and Full Rack fanfares, computer tile ticks, timer ticks. Soundtracks: **Hearth** (new, ~80 BPM, F major, warm electric-piano pad; default), **Inkwell** (new, 92 BPM, D minor lo-fi swing; level 7) and Sweep's **Daylight** (Daily Spark achievement).
- **Word effects:** Sparks (default), Embers, Confetti, Lightning; 50+ moves play the effect, a Full Rack plays a bigger one. Animations off / Reduce Motion: tiles appear instantly, no effects.
- **Languages:** the i18n watcher with `src/i18n_0_ui.js`, `i18n_1_game.js`, `i18n_2_camp.js` (461 rows, `[en, es, fr, de, pt]`, machine-assisted). Level, achievement and cosmetic names stay English; the word list is English in every language (How to play and Settings say so).
- **Saving:** every game in progress (Classic, Campaign, Daily, practice and each 2-Player game) saves after every move and on page hide, and resumes exactly.

## Letter values and tile counts (confirmed table, reproduced by `tools/letters.py`)

| Letter | Value | Small (70) | Medium (100) | Large (150) |
|---|---|---|---|---|
| E | 1 | 9 | 12 | 19 |
| A | 1 | 6 | 9 | 13 |
| I | 1 | 5 | 8 | 12 |
| R | 1 | 5 | 7 | 11 |
| O | 1 | 4 | 7 | 10 |
| S | 1 | 3 | 5 | 7 |
| N | 1 | 4 | 5 | 9 |
| T | 1 | 4 | 5 | 8 |
| L | 1 | 4 | 5 | 8 |
| D | 2 | 3 | 4 | 6 |
| U | 2 | 2 | 4 | 6 |
| C | 2 | 2 | 3 | 5 |
| G | 3 | 2 | 3 | 4 |
| P | 3 | 2 | 3 | 4 |
| M | 3 | 2 | 3 | 4 |
| H | 3 | 1 | 2 | 4 |
| B | 3 | 1 | 2 | 3 |
| Y | 4 | 1 | 2 | 3 |
| F | 4 | 1 | 2 | 2 |
| K | 4 | 1 | 1 | 2 |
| W | 5 | 1 | 1 | 2 |
| V | 5 | 1 | 1 | 1 |
| Z | 7 | 1 | 1 | 1 |
| X | 7 | 1 | 1 | 1 |
| J | 8 | 1 | 1 | 1 |
| Q | 10 | 1 | 1 | 1 |
| Blank | 0 | 2 | 2 | 3 |

`tools/letters.py` reproduces every value and count from ENABLE. The exact method (the kickoff left two details open): letter frequency counts every letter occurrence in words of 2–8 letters; S is fixed at its cap before the other letters share the remaining tiles; each letter gets max(1, floor(share)) and the leftover tiles go by largest remainder to letters whose share is at least 1. Then Q 9 → 10 and Medium E 13 → 12, F 1 → 2, as planned. Vowels are 40.8% of the Medium letters; 18 of 26 letters differ from the original game's table (the test requires 10).

## Files
```
tilecraft/
  src/app.html        UI, screens, DOM board with zoom/pan, drag and tap placement, computer turns in slices, audio, effects
  src/engine.js       letters, bag, boards and premium generation, shapes, rules and scoring, end of game, modifiers,
                      move generator (generator function), AI strengths and leave values, Daily, 2-Player codes
  src/dict.js         generated: the packed DAWG (base64) + lookup (tools/build_dict.py)
  (banned list)       private, not in the public repo: tools/build_dict.py reads src/banned.js or TILECRAFT_BANNED
  src/core.js         save, XP/levels, hints, stars, records, achievements, cosmetics, 2-Player list, backup, Arcade contract (no DOM)
  src/levels.js       the 45 campaign recipes, their seeds, and the 3 puzzles
  src/i18n_*.js       translation tables, Sweep's format [en, es, fr, de, pt]
  tools/build_dict.py ENABLE − banned → uppercase, 2–19 letters → minimised DAWG → src/dict.js
  tools/letters.py    computes the letter values and tile counts from ENABLE (and checks engine.js)
  data/enable1.txt    the word list (public domain; see data/README.md)
  fonts/              Inter, JetBrains Mono, Caveat (SIL OFL, licences included), inlined into the standalone builds
  tests/run.js        node tests/run.js (Node only; QUICK=1 for short sims; ~55 s, ~11 s quick)
  tests/sim.js        node tests/sim.js leave|strength|levels|daily|pick  (long sims for tuning)
  tests/gen_puzzles.js rebuilds and verifies the 3 puzzles
  tests/layout.js     node tests/layout.js (Playwright + Chrome; python3 build.py first; ~55 s)
  build.py            python3 build.py → dist/
  package.json        dev dependency: playwright (only for tests/layout.js)
  dist/tilecraft/index.html   Arcade build: window.__ARCADE__=1, ../fonts.css, strict CSP
  dist/standalone.html        single file, fonts inlined, strict CSP
  dist/demo.html              standalone without the CSP meta, for the claude.ai artifact preview
```
`build.py` fills `/*ENGINE*/` in `app.html` with `dict.js`, `engine.js`, `levels.js`, `core.js`, then the i18n tables, and refuses to build if the banned list would ship.

## What the Arcade chat does
1. Unzip into `games/tilecraft/`.
2. Add the registry entry above and `tilecraft` card art.
3. Add the build step: id `tilecraft`, folder `games/tilecraft`, Arcade build file `dist/tilecraft/index.html`, settings button `#settingsBtn`. Add a cache part in the service worker (the page is 742 KB) and rows in `tests/games_flow.py` and `tests/offline_test.py`.
4. Add Tilecraft's credits (above) to Arcade's About/Privacy page if it lists credits.
5. Run the import check (it should print `ok, nothing to fix`), Arcade's flow and offline tests, and `node tests/run.js` for every game.
6. Republish the Arcade demo. Still no GitHub push.

## Arcade contract, as implemented
- **Storage:** writes `tilecraft.v1` (including the 2-Player games list) and, in Arcade mode only, `arcade.summary.tilecraft`. Reads `arcade.v1`, never writes it. A one-off `tilecraft.probe` is written and removed at start-up.
- **Arcade mode:** `const ARCADE=!!window.__ARCADE__`. After the save loads, `appearance, motion, sfx, music, haptics, fullscreen, cb, lefty, lang` and `.name` (the default 2-Player name) come from `arcade.v1`, in memory only, re-read on `pageshow`. `tilecraft.v1` keeps its standalone values.
- **Summary:** 300 ms after each save, immediately when leaving, and on page hide: `{v:1, game:'tilecraft', ver:'0.1.0', level, maxLevel:10, xp, xpLevel, xpNext, ach:[[name,desc,done]×30], hi:[['Best move',…],['Campaign stars','n/135'],['Daily best','n% of par']], last}`.
- **Navigation:** `const ARCADE_HOME='../index.html', ARCADE_PREFS='../index.html#prefs';` Leaves with `location.replace(…)` only (`leaveTo`). "‹ Arcade" on home, hidden standalone. Android back: in a game it opens the pause menu first; then it closes a sheet; then it returns home (or to the game, from settings opened in a game); then, on home in Arcade, it goes to Arcade.
- **`#game-settings`:** opens the settings screen and clears the hash with `history.replaceState`. No other hashes are used.
- **Settings inside Arcade:** tile placement, zoom while placing, computer thinking pause, confirm before Play, show moves after each turn, How to play, What's new, Tilecraft-only backup (`TILECRAFT1Z.` gzip / `TILECRAFT1.`), About and credits, and an "Arcade settings" row. Shared settings (including left-handed and language) are hidden.
- **No service worker. CSP:** `default-src 'self'`, inline scripts and styles, `data:` fonts and images, no outside requests.

## Dictionary and banned words
- ENABLE 172,823 words → **172,287** in the game: 257 banned words that are in ENABLE removed, and 279 words over 19 letters dropped.
- Packed as a minimised DAWG: 122,957 edges × 3 bytes = 360 KB, **480 KB as base64** (target < 700 KB). The tests check it against a plain Set for every word and 100,000 random strings.
- **Banned (258 entries; the list is private and not in the public repo):** slurs (race, ethnicity, religion, sexuality, disability), vulgar obscenities and insults, words for sexual acts and sexual abuse, each inflection listed. Exact words only: GRAPE, SPICE, CUMIN, ASSASSIN, FAGOTING stay valid.
- **Kept valid on purpose** (LDNOOBW words with a main innocent meaning, or anatomy/medicine): e.g. ASS, COCK, TIT, BOOB, HOOKER, SNATCH, SCAT, SKEET, SUCK, SWINGER, SPUNK, SMUT, BASTARD, SWASTIKA, SEX, NUDE, PENIS, VAGINA, INCEST. The full lists are in the private banned file. Easy to change: edit it and run `python3 tools/build_dict.py` with it in place.

## Engine notes
- **Boards:** premium squares are generated per board from its seed, symmetric under 90° rotation. Because of that symmetry every count is a multiple of 4: Medium has 3×Word 8, 2×Word 16, 3×Letter 12, 2×Letter 20 or 24 (inside the kickoff's 6–8, 14–18, 10–14, 20–26); other sizes and shapes scale by playable area. Rules: no 3×Word within 4 squares (Chebyshev) of the centre, 3×Word squares at least 4 apart, no two Word squares touching (8 neighbours), only 2×Letter next to the start square, and (my addition) no two of the same letter premium side by side. Labels: 2× Letter, 3× Letter, 2× Word, 3× Word (compact "2×L" when squares are small).
- **Move generator:** Appel & Jacobson over the DAWG with per-square cross-checks; blanks, minimum/maximum length, no repeats and shapes applied during the search. It matches a brute-force search on 200 random positions (blanks included) and the rules checker scores every move the same.
- **Speed (Large board, mid-game):** Node: 2–11 ms for normal racks, ~60 ms with one blank, ~260 ms with two. Headless Chrome with **4× CPU throttling**: 9–56 ms for normal racks (target 300 ms), ~220 ms with one blank, **~800 ms with two blanks**. The search yields between small units (95% under 1 ms at 4×; GC pauses aside), so the screen never freezes; the 0.6–1.2 s thinking pause covers most of it.
- **AI fairness:** the computer sees only its rack, the board and the unseen pool; its random choices are seeded from the game seed and move number. Tested: two different hidden racks with the same visible state give the same choice, for every strength.
- **Expert:** best score + leave value. Leave values were fitted by self-play (`node tests/sim.js leave 2000`): a ridge regression of the next turn's best score on the tiles kept, over 32,842 turns of Hard vs Hard, centred on the average tile (the centred table beat the raw fit: 61% vs Hard, +28 average margin). With the bag empty it looks one reply ahead (the other rack is exactly the unseen tiles) and blocks; with 7 or fewer in the bag it avoids opening 3×Word squares.
- **Codes:** a 16-bit checksum catches damaged codes; replaying every move from the seeds catches impossible ones. Complete bot games encode to 187 (Small), 236 (Medium) and 305 (Large) characters; the test's maximum is 1,100 for a full Large game.

## AI tuning (200 games per pairing, Medium)

| Pairing | Stronger wins | Average score |
|---|---|---|
| Normal vs Easy | 197/200 (99%) | 244–148 |
| Hard vs Normal | 200/200 (100%) | 573–143 |
| Expert vs Hard | 118/200 (59%) | 442–411 |
| Hard vs Easy · Expert vs Easy · Expert vs Normal | 200/200 each | 600–94 · 619–89 · 587–133 |

Order Expert > Hard > Normal > Easy holds (also checked in every `node tests/run.js`).

## Campaign targets, twists and seeds (from the bots)
- `node tests/sim.js levels` plays each level with a casual bot (Normal), a good bot (Hard) and a strong bot (Expert) in your seat.
- **Score targets** sit at casual + 10% / 30% / 50% of the gap to the good bot for Apprentice / Journeyman / Master: A5 100 in 8 turns, A9 135 in 10, J5 205 in 10, J9 230 in 10, M5 305 in 10, M9 330 in 12.
- **Twists** the strong bot rarely managed (e.g. "beat Expert by 40") were replaced with achievable ones (a big single move, a 7-letter word, a Full Rack).
- **Seeds:** each level's fixed seed is picked (`node tests/sim.js pick`) so the strong bot meets the goal and, wherever it can, the twist; the tests check all 45 levels are completed by a strong bot and 40+ twists too.
- **Puzzles** (`tests/gen_puzzles.js`): seeded Hard-vs-Hard positions with one best move at least 8 points clear: Apprentice PHONIER 48, Journeyman FLAXY 51, Master YA 72 (a two-letter play scoring through crossing words). Answers checked against the solver.
- Achievement thresholds kept from the kickoff: Heavy Hitter 80+, Hammer Blow 120+ (the good bot's best move per Medium game is typically 70–110).

## Daily par (20 days from 2026-11-24)
Par ranged 323–527. Against it: the Easy bot scored 20% on average, Normal 30%, Hard 100%. **So the kickoff's stars (60/85/100% of the Expert's par) need strong play: a casual player will often get no star.** See open items.

## Tests
- `node tests/run.js`: **16,832 checks** — dictionary (count, every word, banned words, 100,000 random strings, size), letters (engine = `tools/letters.py` = kickoff table, bags 70/100/150, ≥10 differ), boards (750 boards: symmetry, counts, every distance rule, connected shapes, start square, same seed same board), rules (placement, words, scoring with every premium, two Word squares, blanks, Full Rack, swap, pass, both end conditions, leftovers), modifiers (min length on the main word only, max length on every word, no repeats, timer pass, swaps off, shapes, rare letters, blanks), move generator (200 brute-force positions, valid, no duplicates, speed, slice size), AI (200 games per adjacent pairing, never a banned or invalid word, hidden-information fairness for every strength, endgame), Daily (120 days, two pinned fingerprints `2026-11-24 → 95fb9c1f`, `2027-01-01 → 5b7a5c83`, par repeatable, one scored attempt, release-day XP, share line with no words, streak), 2-Player (round trip, modifiers, pasted text, tampered / impossible move / wrong turn / older / same / deleted rejected, code length, Rivals counting, pass-and-play counts nothing), campaign (45 levels, level mix, opponents, all completed by a strong bot, puzzles match the solver, stars build up, unlocks, XP), core (old saves through `defSave()`, exact resume, XP and a reward at every level 2–10, hints, records, assisted games, achievements, 25 cosmetics, backup, Arcade settings, summary, keys), sources (`ARCADE_HOME`/`PREFS`, `location.replace` only, `#game-settings`, `#settingsBtn`, no service worker, only `tilecraft.*` keys, the original game's name nowhere).
- `node tests/layout.js`: **207 checks** — no sideways scroll at 360 and 390 px in English and German on every screen and sheet (home, Classic sheet, campaign tabs, level sheet, Daily sheet, 2-Player list and sheets, Progress tabs, Style tabs, Settings, How to play, What's new, About, Language, Name, Backup, game, pause, history, swap mode, blank sheet, results); German shows no untranslated text; tap and drag placement, drag between squares and back, tap to take back, Recall, Shuffle, the blank sheet; a full move and the computer's reply; last move highlighted; Android back opens the pause menu; save after every move, reload, Continue resumes exactly; double-tap and pinch zoom on 19×19 (tiles 32 px+ zoomed), pan, auto-zoom; move generation at 4× throttling; a share-code game between two browser contexts (play, send, paste, join, reply, older and deleted codes refused, two-tap delete); pass-and-play cover; the Daily (par, no hints, resume, one scored attempt); a campaign puzzle earning 3 stars; standalone CSP and no outside requests; the Arcade build contract.

## Decisions taken (all easy to change)
1. **Medium bag points:** the confirmed table sums to **186** points, not the 182 the kickoff quotes. I kept the confirmed table; the test checks 186.
2. **Premium counts** are multiples of 4 (90° symmetry; see Engine notes). Tiny shaped boards whose scaled range holds no multiple of 4 use the nearest one (at least 4).
3. **"Within 4 squares"** and **"closer than 4"** use Chebyshev distance; **"next to"** means the 8 surrounding squares.
4. **Ring** is a wheel (outer ring, a hub round the start square, four 3-wide spokes), so the centre start square stays playable as the kickoff requires.
5. **Main word of a one-tile move:** the across word if there is one, otherwise the down word (this is what minimum length and no repeats look at).
6. **More rare letters** adds one J, Q, X and Z.
7. **Solo games** (Daily, score targets, puzzles) have no leftover-tile adjustment.
8. **Swapped tiles** go back into the bag at seeded positions, so replays and codes rebuild the same bag.
9. **Campaign opponents** follow the kickoff's mix: levels 1–3 vs Easy / Normal / Hard; 6, 11, 13 vs Normal / Hard / Expert; finales vs Normal / Hard / Expert. Apprentice uses Small boards except 11 and 15 (Medium).
10. **Cosmetic unlocks:** levels 2–10 give Slate tiles, Paper board, Chiptune, Embers, Midnight, Inkwell, Glass, Ocean, Neon + JetBrains Mono; stars 30/75/135 give Wood Grain, Garden, Retro; achievements give Ember tiles (Wordsmith: Expert), Confetti (Full Rack), Lightning (Hammer Blow), Parchment (Puzzle Master), Daylight (Daily Spark), Caveat (Daily Streak).
11. **Hints** come only from the daily refill and level-ups (as the kickoff says); none from wins.
12. **Records** (best game, best move, longest word, most Full Racks, wins table) come from Classic games; assisted games still count wins but set no best-score records.
13. **The Classic modifier bonus** multiplies the whole Classic XP (5 + win bonus).
14. **Results** show "Longest word" for the kickoff's "best word", next to the highest-scoring move.
15. **Additions:** Resign in the pause menu (Classic and campaign), an About and credits screen, the letter table on How to play, and a keyboard on desktop.
16. **Player 2's name** is added to the game when they join from a code; the next code carries both names.

## Open items for playtesting
- **Difficulty:** Normal → Hard is a big jump (Hard averages ~570 a game on Medium against Normal's ~145). Journeyman's Hard duels and Master's Expert duels will be hard for most players. If that's too steep: soften Hard (for example 70th–98th percentile instead of "best 80%"), or move some Journeyman duels back to Normal.
- **Daily stars:** with par from the Expert, Normal-style play gets ~30% of par. Options: par from the Hard bot's 10 turns, or stars at 40/65/90%.
- **Two blanks on Large** take ~800 ms at 4× throttling (sliced, so no freeze). Fine behind the thinking pause, but the Hint button can take that long too.
- **Not yet tried on a real phone.** Drag, pinch and auto-zoom need the Galaxy S20 FE, especially on Large.
- **The empty space** above and below the board on tall phones is left as is (the board is width-limited).
- **Translations** are machine-assisted.
- **"Tilecraft" name:** an unrelated 2022 Steam game and a "Tile Craft 3D" app exist (different genres). Check before any public release (not legal advice).
- In the claude.ai preview, "Save to file" in Backup does nothing (the viewer blocks downloads); Copy works.
- **Later (not in the demo):** opening a 2-Player code from a link, word lists for other languages, Daily league, online play, definitions.
