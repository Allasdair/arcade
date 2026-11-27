# Arcade

Ad-free games. Nothing to buy, nothing tracked. Play at **https://allasdair.github.io/arcade/**, and install it from the browser menu to use it like an app. After the first visit, every game works offline.

| Game | Folder | What it is |
|---|---|---|
| Sweep | `games/sweep` | No-guess minesweeper with campaigns, dailies and a League |
| Ship Fight | `games/ship-fight` | Naval battle against an AI |
| Snake | `games/snake` | Classic snake, 7 arenas |
| 2048 | `games/2048` | Slide and merge tiles |
| Linefall | `games/linefall` | Falling-block stacking on a handheld-style console |
| Drift | `games/drift` | Thrust, shoot, clear the field |
| Tilecraft | `games/tilecraft` | Word game against the computer or a friend |
| Solitaire | `games/solitaire` | Card solitaire where every deal is winnable |
| Mahjong | `games/mahjong` | Mahjong solitaire: match pairs, clear the stack |
| Sudoku | `games/sudoku` | Pure logic, never a guess |
| Chess | `games/chess` | Play, solve, improve |
| Quintessence | `games/quintessence` | Match the elements, master the storm |

Each game keeps its own save, levels and unlocks. The Arcade adds the levels up, keeps the settings every game shares (username, appearance, sound, accessibility, language), and backs everything up in one file. Progress lives only on your device.

## Layout
```
src/parts/            the Arcade home (page and styles, script, card art, translations in tr.py); build.py joins them
web/                  service worker template, manifest, icons
games/<game>/         each game's own source, tests and build.py
build.py              python3 build.py  →  docs/  (what GitHub Pages serves)
tests/                Arcade tests (Playwright + Chrome)
docs/                 built site — don't edit by hand
```

## Making a change
1. Edit `src/` or a game in `games/`.
2. Run `python3 build.py`. It builds every game, runs the import check on each (see below) and writes `docs/`.
3. Test (below), then commit and push. Pages redeploys in 1–2 minutes; players get the update in the background and see "Arcade updated · Reload".

**Saves must stay compatible.** Storage keys start with each game's id (`sweep.`, `shipfight.`, `snake.`, `t2048.`, `linefall.`, `drift.`, `tilecraft.`, `solitaire.`, `mahjong.`, `sudoku.`, `chess.`, `quintessence.`), and the Arcade's own are `arcade.*`. Never rename or remove a key players already have.

## Tests
- Each game: `cd games/<game> && node tests/run.js`
- The Arcade (needs Python Playwright and Chrome):
  ```
  mkdir -p /tmp/site && ln -sfn "$PWD/docs" /tmp/site/arcade
  python3 tests/server.py /tmp/site 8771 &
  python3 tests/arcade_flow.py     # shell, shared settings, backup, Sweep save migration
  python3 tests/home_flow.py       # profile, avatars, favourites, badges, milestones, translations
  python3 tests/games_flow.py      # every game inside the Arcade
  python3 tests/offline_test.py    # airplane mode, dead connection, updates, broken updates, wiped caches
  ```

## Adding a game
Follow the Arcade integration checklist (the game ships a folder with `src/`, `build.py` and `tests/`, an Arcade build with `window.__ARCADE__=1`, and the summary record). Then add it to `GAMES` in `src/parts/b_script.js` (and an avatar in `AVATARS`), to the game list and cache parts in `build.py`, and to `tests/games_flow.py` and `tests/offline_test.py`.

The **import check** in `build.py` runs on every game: it makes sure leaving for the Arcade replaces the page in history and that `#game-settings` opens the game's settings, fixes either if missing and says so, and stops the build if it can't tell.

## Licence
MIT (see `LICENSE`). Fonts: Inter, JetBrains Mono and Caveat under the SIL Open Font License (licences in `docs/fonts/`).
Tilecraft's word list is ENABLE (public domain); its offensive-word filter started from the LDNOOBW list (CC BY 4.0). The filter list itself is kept private and isn't in this repository; the shipped dictionary already leaves those words out.
