# Snake v0.1.0: playable demo

Built 2026-11-23 from `snake-kickoff.md` (Arcade Game Lab project) and a read-only copy of Sweep v1.2.1 (`github.com/Allasdair/sweep`, MIT). The shape masks, seeded RNG, audio synth and Daylight soundtrack are adapted from Sweep. Ship Fight's folder wasn't reachable, so the shell follows kickoff section 8. Demo only: nothing has been pushed to GitHub.

## Build and test
- `python3 build.py` builds `dist/snake/index.html` (Arcade), `dist/standalone.html` and `dist/demo.html`.
- `node tests/run.js` runs 48 checks. `QUICK=1` runs shorter bot sims, and `SHOW_BOTS=1` prints the bot table.
- `node tests/layout.js` needs Playwright and Chrome. It runs 36 checks covering layout at 360/390 px, keyboard, swipe, D-pad, pause/resume, death and results, frame rate and the Arcade contract. Screenshots go to `tests/shots/`.

## In the demo
- Classic runs on 7 arenas (Open, Ring, Cross, Diamond, Hourglass, Swiss Cheese, Twin Islands) in Small, Medium and Large sizes.
  - Speeds: Slow 6, Normal 9 and Fast 13 ticks per second, plus Speed-up.
  - Walls: Solid, or Wrap (dashed edges show where wrapping works).
  - Arenas use 4-way connected regions.
- The Run setup sheet remembers your choices.
- Bonus star: +5, appears after every 8–12 foods, lasts about 5 s and blinks in its last second.
- Daily Run seeded from `SNDR1|YYYY-MM-DD`: one saved, resumable scored attempt, then practice runs.
- XP and levels: max level 10, with a reward at every level.
  - Stars at 10%, 20% and 35% fill. Bests are kept per arena, speed and walls, with Speed-up runs kept separately.
  - 10 achievements and 23 cosmetics.
- Game loop: fixed timestep, at most 2 ticks per frame, interpolated movement, and it pauses when the page is hidden.
- Game feel: eat particles, head widen, death flash, scatter and shake, synthesized sounds, haptics and the Daylight soundtrack. Animations off removes all of these except interpolated movement.
- Controls: swipe, D-pad (mirrored for left-handed players), relative taps, and arrows/WASD. Space, P or Esc pauses.
- Arcade contract (section 8): `snake.` keys only, the summary record, `applyArcade`, `‹ Arcade`, the Android back chain, Arcade-only settings, and `SNAKE1Z.` backups.

## Not done yet
- **Translations.** English only so far. There's no i18n watcher or `i18n_*.js` tables yet, though `build.py` already inlines them if they're added.
- **Hamiltonian-cycle "can every arena be filled" bot.** Not written. Odd-sized Open arenas (15×15, 25×25) have no Hamiltonian cycle, so Full House there needs checking.
- **Star thresholds.** Still the first estimates. Greedy bot median fill: Open 21–31%, shaped 17–25%. Diamond and Swiss Cheese give 0 stars in about 30% of bot runs, so they may need lower thresholds.
- **Tempo-matched soundtrack.** Not done; it was optional.
- **Real-phone testing.** Not yet tried on the Galaxy S20 FE. Headless Chrome holds 61 fps at Large Fast.
- **Extra level rewards.** These cosmetics were added so every level has one: Sunset, Royal, Sand, Berry, Sparkle and Fireworks.
- **`HANDOFF.md`.** Not yet written for the Arcade chat.
