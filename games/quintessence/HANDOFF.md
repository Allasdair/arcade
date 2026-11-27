# Quintessence v0.1.0 — handoff

Demo only. Nothing has been pushed to GitHub. Built 2026-11-26 from the kickoff (`claude/quintessence-kickoff.md`), the Arcade contract (`claude/arcade-integration.md`), `claude/arcade-updates-for-game-chats.md`, Sudoku v0.1.0 (shell: screens, sheets, i18n watcher and the shared `i18n_0_ui.js` rows, Web Audio synth, Style screen, settings, backup, hint counter, weekday Daily, campaign stars, `core.js`, `build.py`, `tests/lib.js`, Arcade contract code), Sweep (`games/sweep` from a read-only clone of `github.com/Allasdair/arcade`, commit `234c02f`: shape masks, cyrb128 → sfc32, the 15-level campaign pattern) and the Mahjong and Solitaire handoffs (grading lessons). Quintessence shows no other players, so no avatar code.

**Private playable demo:** https://claude.ai/artifact/VEmZ37dt5wx444AUHfKNsc (`dist/demo.html`)

## Summary for the Arcade chat
- **Game id:** `quintessence` · **Arcade build file:** `dist/quintessence/index.html` · **"‹ Arcade" button:** `#arcadeBtn` · **settings button:** `#settingsBtn`
- **Registry entry:** `{id:'quintessence', name:'Quintessence', desc:'Match the elements, master the storm', path:'quintessence/index.html', prefix:'quintessence.', art:'quintessence'}`
- **Page size:** Arcade build **291 KB** (fonts linked), standalone **383 KB** (Inter and JetBrains Mono inlined). Translation tables are about 95 KB of that.
- **Fonts:** Inter and JetBrains Mono from `../fonts.css`.
- **Import check:** leaves only through `leaveTo(url)` → `location.replace(url)` and handles `#game-settings`, so it should print `ok, nothing to fix`.
- **Storage:** `quintessence.v1` (save) and, in Arcade mode, `arcade.summary.quintessence`. Reads `arcade.v1`, never writes it. Summary highlights: Campaign stars, Best cascade, Daily streak.
- **Its own avatar** (for `web/avatars.js`, position 14) is up to the Arcade chat; a Prism star would suit.

## What's in v0.1.0
- **Elements:** Fire (three-tongued flame), Water (drop), Earth (faceted stone), Air (swirl), Lightning (bolt), Ice (six-point crystal). 4 / 5 / 6 elements = Easy / Normal / Hard. Every element keeps its shape in every skin; the layout test checks every pair is distinct in grayscale in every skin on a light and a dark board.
- **Board:** 7×7, 8×8 (default), 9×9 and Sweep's masks (Heart, Diamond, Ring, Cross, Hourglass, Twin Islands, at 9×9). One canvas; 43 px tiles on 8×8 at 360 px. Swipe, tap-tap, or both (setting), swipe sensitivity, keyboard (arrows, Space, H, P/Esc). An invalid swap slides back and uses no move.
- **Matching and specials:** 3+ in a line or a 2×2 square. Priority 5-line (Prism) > L/T (Burst) > 4-line (Surge, across = row) > 2×2 (Wisp) > 3. The special appears on the moved piece if it's in the match, else mid-match. Score 60/120/200 × the cascade step. All seven combos as tabled, Overflow at the end of a met goal (same score skipped or not; tap to skip; auto-skip setting).
- **Obstacles and reactions:** Frost (1–2), Lava (spreads only after a move that cleared none; the twist spreads every move), Stone (1–3), Fog, Chains, Relics (leave at glowing exits). Thaw!, Quench!, Freeze!, Erode!, Clear!, Shatter! labels. How to play has the reaction chart and the specials and combos.
- **Fairness:** no new board starts with a match or without a swap; a dead board reshuffles automatically and for free (seeded, obstacles stay); every column has its own seeded stream, and reshuffles, lava, Wisp targets, relics and Overflow have their own streams, so the same moves always give the same board.
- **Classic:** Moves (30), Timed (2:00; clock stops during cascades, +2 s for a 5+ cascade), Zen (endless, saves and resumes, Stillwater plays), on any board, 4/5/6 elements, obstacles Off/Light. Stars ★ bronze ★ silver ★ bronze with no hints, bot-set per mode × board × elements.
- **Campaign:** Origins, Stormfront, Frostfall, 15 levels each (45, 135 stars) on Sweep's pattern: specials taught at 1–3, shapes at 4/8/12, obstacle goal levels, twists at 7/14 (Timed, tight moves, lava every move, combos only), a puzzle at 10, a two-goal finale at 15. Stars ★ goal ★ par moves (timed: seconds) to spare ★ no hints, built up across attempts; 30/75/135-star unlocks. New campaigns can be added (stars are kept per level id).
- **Daily:** `QND1|YYYY-MM-DD` builds the weekday recipe; same board and refills for everyone. One scored attempt (resumable, "End attempt" uses it up), unlimited practice, share line (`Quintessence Daily · Thu 26 Nov · ★★★ · 7 moves left · 48,320`), 20 XP doubled on its day, streak, last 7, Full Week.
- **Help:** hints (the strong bot's best swap, glowing; 5 a day, +1 per level-up, stack to 99) and the idle hint setting. No boosters, no lives.
- **Progression:** XP and 10 levels on Sweep's steps with a reward at every level 2–10, 55 achievements, 30 cosmetics in 7 categories (skins Orbs/Runes/Crystals/Pixel/Watercolour/Glyphs, boards Temple Stone/Open Sky/Deep Sea/Volcano/Night Garden/Paper, match effects, special styles, win effects, music, sound packs) on the Style screen with live previews. High contrast and large tiles are free settings; the Arcade's colourblind setting turns high contrast on.
- **Feel and sound:** element bursts (fire flares, water splashes, earth crumbles, air puffs, lightning crackles, ice shatters), bouncing falls, rising cascade chimes, screen shake and announcer words (Flow!, Surge!, Storm!, Elemental!, Quintessence!) with a synth swell. Reduce Motion / Animations off: no shake or particles, quick cascades, instant Overflow. Music (synthesized, original): **Kindling** (96 BPM, D major, default), **Stillwater** (70 BPM, Zen variant, level 4), **Highwind** (108 BPM, level 10), Sweep's **Daylight** (Daily Star).
- **Languages:** the i18n watcher with `i18n_0_ui.js` (shared rows), `i18n_1_game.js` and `i18n_2_levels.js`, `[en, es, fr, de, pt]`, machine-assisted. Level, achievement, cosmetic and campaign names and the announcer words stay English.
- **Saving:** after every move and on page hide; Classic, Zen, campaign, the Daily attempt and practice all resume exactly.

## Files
```
quintessence/
  src/app.html        UI, screens, canvas board, sprites and animation, input, particles, audio, announcer
  src/engine.js       board and masks, matching, specials, combos, obstacles and reactions, gravity and seeded
                      refills, cascades, goals, reshuffle, Overflow, scoring, recipe maps
  src/bot.js          casual and strong bots, hint, botPlay (grading)
  src/levels.js       generated: the 45 levels, the Daily weekday grades, Classic bronze/silver
  src/core.js         save, XP/levels, stars, records, hints, Classic, Daily, campaign, achievements, cosmetics,
                      backup, Arcade contract (no DOM)
  src/i18n_*.js       translation tables
  tools/recipes.js    the 45 campaign recipes (edit these, then re-grade)
  tools/grade.js      node tools/grade.js → src/levels.js + tools/grade_report.json (~2.5 min on 2 cores;
                      QUICK=1 short; ONLY=o6,s3 re-grades single levels)
  tools/puzzles.js    finds and checks the 3 puzzle levels (minimum moves by full search)
  tests/run.js        node tests/run.js (QUICK=1 short) · 6,322 checks · ~32 s
  tests/layout.js     node tests/layout.js (Playwright + Chrome; python3 build.py first) · 196 checks · ~50 s
  tests/lib.js        loads the sources the way build.py concatenates them
  tests/daily_pins.json  two pinned Daily fingerprints
  fonts/              Inter, JetBrains Mono (SIL OFL)
  build.py            python3 build.py → dist/
```

## Bots and grading
- **Bots see what a player sees.** When a bot judges a swap it simulates with refills off (pieces already on the board fall and can cascade), so it never peeks at the seeded future. Without this, the bots exploited known refills and 4-element levels ended in 2–3 moves.
- **Casual:** values only the match it makes (size, special made, specials it sets off, the element it needs, goal obstacles beside it, a relic above it) plus noise σ 1.6. **Strong:** full visible-cascade simulation scored on goal progress, score, specials made and relic depth, plus half of the casual value, looking one move ahead on its best 4.
- **Move limit:** the casual bot plays each level 300 times without a limit; the limit is the move count at the target quantile (Origins 80%, Stormfront 65%, Frostfall 55%; tight twist −15 points), so every level lands on its target (the reported rate is the share within the limit). **Par** = (limit − strong median, 24 plays) × 0.7, at least 1. **Score goals:** the casual median goal score after the recipe's `scoreMoves`. **Timed levels:** limit × 3.5 s. **Classic:** bronze/silver = casual median / 80th percentile over 30 plays (Timed graded as 40 moves). All constants are `K` at the top of `tools/grade.js`.
- The Solitaire/Mahjong lessons: one constant block, a full distribution rather than pass/fail at a guessed limit (so no lopsided pools), and the table below.

## Campaign, Daily and Classic (from tools/grade.js)
| # | Origins (4) | Stormfront (5) | Frostfall (6) |
|---|---|---|---|
| 1 | First Spark (score 19,000) | Static (score 4,500) | First Snow (score 4,000) |
| 2 | Kindling (collect 70 Fire) | Conductor (collect 36 Lightning) | Crystal Count (collect 24 Ice) |
| 3 | Square One (score 16,000) | Crossfire (score 6,000) | Hearth (frost) |
| 4 | Heartwood (heart, collect 60 Water) | Crossroads (cross, collect 28 Water + score 4,500) | Great Heart (heart, collect 26 Fire + score 3,500) |
| 5 | First Frost (frost) | Magma (lava) | Whiteout (fog) |
| 6 | Standing Stones (stone) | Chained (collect 24 Lightning) | Cold Front (lava) |
| 7 | Quickfire (score 21,000, timed) | Eruption (lava, lava) | Blizzard Clock (score 3,500, timed) |
| 8 | Diamond Dust (diamond, frost) | Hourglass (hourglass, frost) | Great Ring (ring, frost) |
| 9 | Relic Run (3 relics) | Flow Control (lava + score 5,500) | Hidden Links (fog) |
| 10 | Thin Ice (frost, puzzle) | Live Wire (frost, puzzle) | Glacier (frost, puzzle) |
| 11 | Frost and Stone (frost + stone) | Chain Reaction (frost) | Permafrost (frost + stone) |
| 12 | Ring of Ash (ring, 3 relics) | Twin Islands (islands, 3 relics) | Great Islands (islands, 3 relics) |
| 13 | Deep Freeze (frost + 2 relics) | Molten Relics (3 relics + lava) | Everything Melts (lava + fog) |
| 14 | Tight Spot (stone + frost, tight) | Combo Theory (score 2,000, combos) | Narrow Pass (frost + fog, tight) |
| 15 | Wellspring (frost + 3 relics) | Eye of the Storm (3 relics + lava) | Quintessence (3 relics + frost) |

| Level | Limit | Casual rate (target) | Par | Strong median |
|---|---|---|---|---|
| o1 First Spark | 14 | 0.83 (0.80) | 6 | 5 |
| o2 Kindling | 15 | 0.84 (0.80) | 5 | 7 |
| o3 Square One | 19 | 0.83 (0.80) | 8 | 7 |
| o4 Heartwood | 17 | 0.85 (0.80) | 4 | 10 |
| o5 First Frost | 8 | 0.85 (0.80) | 1 | 6 |
| o6 Standing Stones | 8 | 0.80 (0.80) | 2 | 5 |
| o7 Quickfire | 80 s (~22 moves) | 0.83 (0.80) | 35 s | 8 |
| o8 Diamond Dust | 8 | 0.84 (0.80) | 1 | 7 |
| o9 Relic Run | 10 | 0.86 (0.80) | 4 | 3 |
| o10 Thin Ice | 4 (min 3) | puzzle | 1 | — |
| o11 Frost and Stone | 8 | 0.81 (0.80) | 2 | 5 |
| o12 Ring of Ash | 11 | 0.83 (0.80) | 4 | 5 |
| o13 Deep Freeze | 18 | 0.85 (0.80) | 7 | 7 |
| o14 Tight Spot | 11 | 0.68 (0.65) | 4 | 4 |
| o15 Wellspring | 17 | 0.83 (0.80) | 7 | 7 |
| s1 Static | 13 | 0.70 (0.65) | 5 | 5 |
| s2 Conductor | 17 | 0.67 (0.65) | 4 | 10 |
| s3 Crossfire | 17 | 0.68 (0.65) | 8 | 5 |
| s4 Crossroads | 14 | 0.66 (0.65) | 4 | 7 |
| s5 Magma | 20 | 0.68 (0.65) | 9 | 7 |
| s6 Chained | 13 | 0.69 (0.65) | 4 | 7 |
| s7 Eruption | 23 | 0.65 (0.65) | 15 | 1 |
| s8 Hourglass | 11 | 0.71 (0.65) | 4 | 4 |
| s9 Flow Control | 20 | 0.69 (0.65) | 2 | 17 |
| s10 Live Wire | 4 (min 3) | puzzle | 1 | — |
| s11 Chain Reaction | 13 | 0.70 (0.65) | 5 | 5 |
| s12 Twin Islands | 20 | 0.68 (0.65) | 10 | 5 |
| s13 Molten Relics | 28 | 0.69 (0.65) | 7 | 17 |
| s14 Combo Theory | 23 | 0.67 (0.65) | 9 | 9 |
| s15 Eye of the Storm | 34 | 0.65 (0.65) | 15 | 12 |
| f1 First Snow | 16 | 0.60 (0.55) | 4 | 10 |
| f2 Crystal Count | 24 | 0.59 (0.55) | 2 | 20 |
| f3 Hearth | 31 | 0.56 (0.55) | 7 | 21 |
| f4 Great Heart | 18 | 0.56 (0.55) | 7 | 8 |
| f5 Whiteout | 15 | 0.55 (0.55) | 2 | 11 |
| f6 Cold Front | 27 | 0.57 (0.55) | 15 | 5 |
| f7 Blizzard Clock | 65 s (~18 moves) | 0.58 (0.55) | 20 s | 10 |
| f8 Great Ring | 33 | 0.57 (0.55) | 18 | 6 |
| f9 Hidden Links | 19 | 0.60 (0.55) | 2 | 16 |
| f10 Glacier | 4 (min 3) | puzzle | 1 | — |
| f11 Permafrost | 28 | 0.60 (0.55) | 9 | 15 |
| f12 Great Islands | 31 | 0.56 (0.55) | 2 | 27 |
| f13 Everything Melts | 22 | 0.56 (0.55) | 7 | 11 |
| f14 Narrow Pass | 20 | 0.44 (0.40) | 2 | 16 |
| f15 Quintessence | 42 | 0.57 (0.55) | 5 | 34 |

| Day | Elements | Goal | Moves | Par | Casual rate | Score target |
|---|---|---|---|---|---|---|
| Mon | 4 | Score target | 17 | 7 | 0.675 | 21,000 |
| Tue | 4 | Collect an element | 13 | 3 | 0.671 | — |
| Wed | 5 | Clear the Frost | 10 | 2 | 0.692 | — |
| Thu | 5 | Bring down the relics | 23 | 10 | 0.67 | — |
| Fri | 5 | Lava and a score | 13 | 5 | 0.695 | 4,000 |
| Sat | 6 | Fog and Chains | 15 | 4 | 0.681 | — |
| Sun | 6 | Two goals on a shaped board | 26 | 8 | 0.687 | — |

| Mode | Board | 4 elements | 5 elements | 6 elements |
|---|---|---|---|---|
| moves | 7 | 27,100 / 37,800 | 9,200 / 11,900 | 5,200 / 6,700 |
| moves | 8 | 49,600 / 70,500 | 13,600 / 17,400 | 7,200 / 8,800 |
| moves | 9 | 69,200 / 134,300 | 15,800 / 23,100 | 6,800 / 8,900 |
| moves | heart | 40,100 / 52,800 | 9,900 / 13,900 | 5,300 / 6,400 |
| moves | diamond | 35,900 / 49,100 | 10,500 / 14,700 | 5,800 / 7,700 |
| moves | ring | 15,700 / 22,400 | 6,000 / 7,200 | 3,700 / 4,200 |
| moves | cross | 47,700 / 63,700 | 14,800 / 19,200 | 6,300 / 8,100 |
| moves | hourglass | 35,200 / 47,700 | 10,100 / 14,800 | 5,200 / 6,700 |
| moves | islands | 15,900 / 19,400 | 6,300 / 8,200 | 4,200 / 4,700 |
| timed | 7 | 41,100 / 49,700 | 12,200 / 17,500 | 6,600 / 8,500 |
| timed | 8 | 63,800 / 83,600 | 19,200 / 21,200 | 9,000 / 11,200 |
| timed | 9 | 108,700 / 146,700 | 22,800 / 33,600 | 10,100 / 13,100 |
| timed | heart | 53,100 / 60,900 | 14,100 / 22,100 | 7,400 / 10,100 |
| timed | diamond | 46,600 / 60,000 | 14,200 / 17,400 | 7,700 / 9,700 |
| timed | ring | 21,400 / 28,800 | 8,100 / 10,100 | 5,000 / 6,200 |
| timed | cross | 60,900 / 80,500 | 16,600 / 22,700 | 8,200 / 10,000 |
| timed | hourglass | 52,200 / 60,500 | 15,100 / 20,200 | 7,400 / 8,400 |
| timed | islands | 23,100 / 28,800 | 8,800 / 10,400 | 5,500 / 6,400 |

Light obstacles factor: 1.083 · grading run: 147 s on 2 cores

## Decisions taken (all easy to change)
1. **Column streams never repeat an element twice in a row.** Pure random refills with 2×2 squares counting gave runaway cascades on 4 elements (3.7 average, up to 47). The n-th piece of a column is still a function of (seed, column, n) only; 4 elements now average 2.5 steps under random play.
2. **Frost and chains:** a match takes a layer and clears the piece once it's free; a blast (a special) only takes the layer. Otherwise a frozen match stayed in place and re-matched by itself.
3. **Fixed cells split columns.** Stone, lava, frost, chains and fog don't fall; the part of a column below one refills from its own top. Relics leave at the bottom of any column segment that ends at the board's edge (gold markers).
4. **Fogged pieces** can't match and don't fall.
5. **Puzzle levels:** limit = minimum + 1 and par 1, so ★2 means solving in the minimum (3). Each has at most 3 shortest first moves.
6. **Classic XP** uses the kickoff's Classic rule (5/10/15 for first stars, then 3 per starred game; Zen 1 per 100 matches, 20 a day). A Classic "clear" (for counts and the win streak) is at least bronze; abandoning a started game ends the streak.
7. **Light obstacles** = 3 Frost and 2 Stone scatter cells, mirrored; thresholds scale by the measured factor.
8. **Combo achievements:** seven, with Wisp + Surge/Burst as one and Prism + Surge/Burst/Wisp as one; the Prism + Prism one is Grand Unification. 55 achievements in total.
9. **Idle hint** marks a campaign level or the Daily as assisted but doesn't spend the counter.
10. **Daily Sunday** is a relic plus collect on a random shaped board (the first relic + frost version graded at 40–42 moves).
11. **A Prism hit by a blast** clears the most common element.
12. **Reshuffle** tries 60 rearrangements, then re-rolls elements from its stream; if that fails (very few free pieces) the level ends as "No moves left".
13. **Zen** plays Stillwater; the announcer words stay English in every language; reaction labels are translated.
14. **The obstacles "Light" option** is labelled through its own translation row, since "Light" already means the light appearance.

## Tests
- `node tests/run.js` — **6,322 checks:** matches in rows, columns and squares; the special priority order on hand-made boards and where each appears; each special's area; all seven combos; the Prism takes the swapped piece's element; the cascade multiplier; gravity on square and shaped boards and under stone; same seed + same moves → same board over 200 random games; column streams independent; Overflow scores the same skipped or not; 270,000 new boards (3 sizes + 6 shapes × 3 element counts × 10,000) with no match and a swap; reshuffle keeps obstacles, leaves a swap, is seeded and costs no move; every obstacle rule and reaction (lava only spreads when none was cleared, Ice freezes lava into 1-layer stone); every goal type completes; move limits; Zen never ends and resumes exactly; all 45 levels load, layout per Sweep's pattern, puzzles solve in their minimum, every level's casual rate within ±10% of target plus three live re-checks; stars build up; Daily for 120 days, in a second load, pinned fingerprints, the weekday table, one scored attempt, release-day XP, share line; old saves, XP and a reward at every level 2–10, hints, Classic stars and XP, Zen XP cap, achievements, backup; the Arcade contract (shared settings, summary fields, `location.replace`, `#game-settings`, button ids, only `quintessence.*` keys, no service worker, no outside URLs, no code after a `//` in a one-line function, none of King's words).
- `node tests/layout.js` — **196 checks:** no sideways scroll at 360 and 390 px in English and German on 40 screens, sheets and game states; German shows no untranslated text (plus every tip, achievement, cosmetic and toast); 43 px tiles; every skin (and high contrast) distinct in grayscale; tap-tap and swipe swaps under touch emulation; an invalid swap slides back; ≥ 50 fps during a Prism + Prism; Android back opens the pause menu; reload and resume exactly; no outside requests; the Arcade build (`#game-settings`, Arcade settings row, colourblind → high contrast, ‹ Arcade button, only `quintessence.*` keys, summary).

## Open items for playtesting
- **Not yet tried on a real phone.** Swipe feel and sensitivity on the Galaxy S20 FE are the first thing to check.
- **4 elements is cascade-heavy by nature;** Origins and Classic Easy scores run high (9×9 silver ≈ 134,000). Fine for "forgiving", but worth a feel.
- **Some levels are short or long:** First Frost, Diamond Dust, Frost and Stone and Standing Stones at 8 moves; Great Ring 33 and the Frostfall finale 42. One line each in `tools/recipes.js`, then `ONLY=… node tools/grade.js`.
- **The strong bot is weak on relics on islands,** so par is low there (Great Islands par 2).
- **Translations** are machine-assisted.
- In the claude.ai preview, "Save to file" in Backup does nothing (the viewer blocks downloads); Copy works.
- **Later (not in the demo):** more chapters, challenge codes, a Daily league, earned boosters.
