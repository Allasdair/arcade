# 2048 v0.1.0 — handoff to the Arcade chat

Demo only. Nothing has been pushed to GitHub.

Built 2026-11-23 from the kickoff doc (`claude/2048-kickoff.md` in the Arcade Game Lab project) and a read-only copy of Sweep v1.2.1 (`github.com/Allasdair/sweep`, `main`). Ship Fight's and Snake's folders weren't reachable (no `~/ArcadeLab/` folder on Alasdair's computer, no zip, no `claude/snake-handoff.md`), so the shell pieces came from Sweep and the Arcade contract follows `claude/ship-fight-handoff.md`, as section 8 of the kickoff says.

**Private playable demo:** https://claude.ai/artifact/H5d7n4PtVprGzuZRTSBghq (`dist/demo.html`)

## What's in v0.1.0
- **Classic 2048** with our own code (nothing from Cirulli's repo) and our own look: no beige/orange palette, no original fonts or layout. Powers of two only (no Threes! mechanics).
- **Boards:** 3×3, 4×4 (default), 5×5, 6×6, plus Cross (20 cells), Ring (32), Diamond (25) and Swiss Cheese (5×5 with 2–3 seeded holes, never a single-cell segment). The New game sheet remembers the choice.
- **Rules** exactly as kickoff section 4, including walls splitting rows/columns into segments that slide on their own.
- **Undo:** one step back, restores board, score and spawn RNG (repeating the move gives the same spawn). 3 a day (count/cap), earned extras stack to 99 (+1 per level-up, +1 for 3 stars on a Daily Board). Any undo marks the game assisted; assisted games keep separate bests. At game over, if undos are left, the player can undo instead of finishing.
- **Daily Board:** 4×4, seed `T2048D1|YYYY-MM-DD`, no undo, one scored game, saved and resumable. 20 XP, ×2 on its release day. An unfinished Daily from an earlier day is scored automatically the next time the app opens.
- **Progression:** XP from stars (5/12/25), 10 levels on Sweep's first 10 steps, the 10 kickoff achievements, stars and bests per board, 26 cosmetics (6 palettes + Forest/Dusk filler palettes, 3 tile shapes, 3 number fonts, 5 board themes, 4 effects, 2 sound packs, 1 soundtrack). Every level 2–10 has a reward.
- **Feel:** 100 ms slides (65 ms on Fast), 120 ms merge pop and spawn scale-in, particle bursts on merges of 128+, board glow on 2048, dim on game over, rising-chord combo sounds, merge pitch rising with the tile, haptics (light, stronger at 512+), Sweep's Daylight soundtrack. Animations off / Reduce Motion → tiles move instantly, no pops or particles.
- **Input:** swipe anywhere on the board area (~24 px, diagonals ignored), arrows/WASD, U or Ctrl+Z to undo, P or Esc to pause. A move that arrives mid-animation finishes the current animation instantly and runs, so fast swipes are never dropped.
- **Saving:** after every move; leaving, backgrounding (auto-pause) and reloading never lose a game.
- **Languages:** the i18n watcher from Sweep with `src/i18n_0_ui.js` (`[en, es, fr, de, pt]`). Cosmetic names stay English, as in Sweep.

## Files

```
2048/
  src/app.html        UI, shell, screens, tile drawing and animation, input, audio, particles
  src/engine.js       board, masks and segments, move/merge, spawn, undo, game over, seeded RNG, Daily Board, bots
  src/core.js         save (defSave/loadSave), XP/levels, stars, undo economy, achievements, cosmetics, Arcade contract (no DOM)
  src/i18n_0_ui.js    translation table, Sweep's format
  fonts/              Inter, JetBrains Mono, Caveat (SIL OFL, licences included) — inlined into the standalone builds
  tests/run.js        node tests/run.js   (Node only, no dependencies; QUICK=1 for short sims, ~20 s; full run ~8 min)
  tests/*.test.js     engine, shapes, daily, core, bots
  tests/sim.js        node tests/sim.js 4,ring expectimax 300   (long sims for one board)
  tests/layout.js     node tests/layout.js (Playwright + Chrome)
  build.py            python3 build.py → dist/
  dist/t2048/index.html   Arcade build: window.__ARCADE__=1, links ../fonts.css, strict CSP
  dist/standalone.html    single file, fonts inlined, strict CSP
  dist/demo.html          standalone without the CSP meta, for the claude.ai artifact preview
```

`build.py` fills the `/*ENGINE*/` placeholder in `app.html` with `engine.js`, then `core.js`, then the i18n tables. The game id is `t2048` everywhere (storage prefix, summary key, build folder); the source folder is `2048/`.

## What the Arcade chat does
1. Copy `2048/` next to the other games in the Arcade workspace.
2. Add a registry entry (there's no placeholder card):
   `{id:'t2048', name:'2048', desc:'Slide, merge, reach 2048', path:'t2048/index.html', prefix:'t2048.', art:'tiles'}`
   and add a `tiles` card artwork.
3. From Arcade's `build.py`, run `python3 2048/build.py` and copy `2048/dist/t2048/index.html` into `dist/t2048/`. It already sets `window.__ARCADE__=1` and links `../fonts.css`.
4. Check the two navigation targets at the top of the second `<script>` in `src/app.html`:
   `const ARCADE_HOME='../index.html', ARCADE_PREFS='../index.html#prefs';`
   They're used by "‹ Arcade", the Android back button on home, and the "Arcade settings" row.
5. Check the combined backup includes the `t2048.` prefix, and the Achievements screen shows a 2048 section from `arcade.summary.t2048`.
6. Run Arcade's flow tests and `node tests/run.js` for every game (plus `node tests/layout.js` for 2048 if Playwright is installed).
7. Republish the Arcade demo. Still no GitHub push.

## Arcade contract, as implemented
- **Storage:** writes `t2048.v1` and, in Arcade mode only, `arcade.summary.t2048`. Reads `arcade.v1`, never writes it. A one-off `t2048.probe` is written and removed at start-up.
- **Arcade mode:** `const ARCADE=!!window.__ARCADE__`. Shared settings `appearance, motion, sfx, music, haptics, fullscreen, cb, lefty, lang` and the name are read from `arcade.v1` after the save loads, used in memory only, and re-read on `pageshow` (back/forward cache). `t2048.v1` keeps the standalone values.
- **Summary:** written 300 ms after each save, immediately when leaving for Arcade, and when the page is hidden:
  `{v:1, game:'t2048', ver:'0.1.0', level, maxLevel:10, xp, xpLevel, xpNext, ach:[[name,desc,done]×10], hi:[['Best tile',…],['Best score (4×4)',…],['Daily best',…]], last}`
- **Navigation:** "‹ Arcade" on home (hidden standalone). Back closes a sheet, then returns home, then (home, in Arcade) goes to Arcade. A game in progress and the Daily Board resume exactly.
- **Settings inside Arcade:** animation speed, confirm New game, show move count, How to play, What's new, 2048 backup (`T2048Z.` / `T2048.`), and an "Arcade settings" row. Shared settings are hidden.
- **CSP:** `default-src 'self'`, inline scripts and styles, `data:` fonts and images, no outside requests. No page hashes.

## Star thresholds (from the bot sims)
Two bots play the real rules (`sim()` is tested move-for-move against `move()`): a **corner** bot (left, down, right, up only if forced — a casual player) and a depth-2 **expectimax** bot (a strong player). Rule used: ★ ≈ a tile the corner bot reaches in a small share of games; ★★★ ≈ a tile the strong bot reaches most of the time, capped so a ★★★ game stays around 2,000–4,000 moves.

| Board | ★ | ★★ | ★★★ | Corner bot reaches (1,000 games) | Expectimax reaches |
|---|---|---|---|---|---|
| 3×3 | 64 | 128 | 256 | 64: 46%, 128: 0.5% | 128: 86%, 256: 34%, 512: 0.3% (1,000) |
| 4×4 | 512 | 1024 | 2048 | 256: 44%, 512: 2.9% | 1024: 94%, 2048: 71%, 4096: 19% (300) |
| 5×5 | 1024 | 2048 | 4096 | 1024: 26%, 2048: 1.3% | 8192: 96%, 16384: 75% (24) |
| 6×6 | 2048 | 4096 | 8192 | 2048: 24%, 4096: 2.3% | too slow for a full run; see open items |
| Cross | 512 | 1024 | 2048 | 512: 5.1%, 1024: 0.2% | 2048: 92%, 4096: 63% (300) |
| Ring | 512 | 2048 | 4096 | 512: 13%, 1024: 0.2% | 4096: 96%, 8192: 68% (150) |
| Diamond | 1024 | 2048 | 4096 | 1024: 4.5% | 8192: 83%, 16384: 43% (150) |
| Swiss Cheese | 1024 | 2048 | 4096 | 1024: 5.4%, 2048: 0.1% | 4096: 76%, 8192: 45% (300) |

- **Changed from the kickoff:** 3×3 was 128/256/512. The strong bot reaches 512 on 3×3 in 0.3% of games, so ★★★ was nearly impossible; it's now 64/128/256.
- The strong bot clears 5×5 and 6×6 ★★★ easily; those keep the kickoff values because higher targets mean 4,000–8,000-move games. Retune after playtesting.

## Decisions taken (kickoff section 13, all easy to change)
1. **Name:** "2048" (id `t2048`).
2. **Undo:** limited, 3 a day with earned extras.
3. **Spawn odds:** 90% 2s / 10% 4s (tested over 100,000 spawns).
4. **After 2048:** Keep going (or End game from the win sheet).
5. **Daily Board:** always 4×4 classic.

## Tests
- `node tests/run.js`: about 7,350 checks — the four merge examples in all four directions, merge-once, no-op moves, score, spawn odds and placement, start tiles, win, game over, undo (board/score/RNG, same spawn, one step, off on Daily), JSON restore, sim/move agreement, board sizes, Swiss Cheese holes and segments, walls, game over across walls, Daily determinism for 120 days with two pinned fingerprints (`2026-11-23 → ae5e2bb0`, `2027-01-01 → ed095267`), old saves through `defSave()`, XP/stars/bests/assisted, Daily XP, undo economy, every achievement and unlock, Corner Keeper tracking, Arcade settings and summary, share line, and the bot checks.
- `node tests/layout.js`: 97 checks — no sideways scroll at 360 and 390 px in English and German on every screen and sheet; 5- and 6-digit tiles fit on 6×6 at 360 px in all three number fonts; touch swipes (left, down, diagonal ignored, short drag ignored); a quick double swipe registers both moves; fast key presses keep the DOM in sync; a game survives a reload; standalone has a CSP and makes no outside requests; the Arcade build follows the contract (shared settings, standalone values kept, summary fields, only `t2048.*` keys, `arcade.v1` untouched, Arcade settings row, `pageshow` re-read).

## Open items for playtesting
- **Small Wonder** (512 on 3×3) unlocks Circle tiles, but the strong bot manages it in only 0.3% of games. Consider lowering it to 256.
- **6×6 strong-bot sims** didn't finish in this session (each game runs thousands of moves); the 6×6 stars are the kickoff's.
- Translations are machine-assisted and need a native-speaker pass.
- Tested only in headless Chrome (360, 390 px, touch and mouse); not yet on a real phone.
- Only the Daylight soundtrack and two sound packs (Soft, Chiptune) so far.
- "2048" name: a quick search found no registered mark. Check properly before any public release (not legal advice).
- **Later (not in the demo):** campaign goal levels, challenge codes and League for the Daily Board, Blitz, Hex 2048, blocker tiles, post-game analysis.
