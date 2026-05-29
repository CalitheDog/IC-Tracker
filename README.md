# ESO Imperial City Tracker

A **Tel Var farm optimizer** for Elder Scrolls Online Imperial City, built for console players. Uses the 15-minute boss respawn cycle across all six districts to help you chain kills, time your runs, and squeeze the maximum Tel Var per hour. PC has an in-game boss-timer addon; console doesn't — this is the second-screen workaround you open on your phone, tablet, or laptop next to your TV while you farm.

## What it does

- **Boss timers** — 15-minute respawn countdown for each district. Flashes and beeps when a boss is back up, warns 1 minute before respawn.
- **Next Respawn** — the soonest-respawning district and a live countdown, always shown in the top status bar.
- **Tel Var estimator** — calculates per-kill Tel Var based on your stone multiplier, group size, and how many districts the enemy alliance controls. Tracks carrying, banked, and lost amounts.
- **Alliance & district control** — select your alliance (EP / DC / AD) and toggle which districts the enemy holds to keep the formula accurate.
- **Unknown timers** — if you find a dead boss you didn't kill, use Guess to estimate when it died, or Seen Alive to confirm it's up.

## Running locally

Requires Python (any version with `http.server`).

```bash
python -m http.server 5173
```

Then open `http://localhost:5173` in your browser.

No build step, no dependencies, no npm to **run** the app — it's a single HTML file. (npm is used only for the headless test runner; see Tests.)

## Tests

A browser test suite lives in `tests/` (109 tests covering the Tel Var formula, timers, presets, undo, alliance/district logic, and keyboard shortcuts).

**In the browser:** with the server running, open `http://localhost:5173/tests/`. Green means everything passes. (Serve over HTTP, not `file://`.)

**Headless / CI:**

```bash
npm install
npx playwright install --with-deps chromium
npm test
```

`npm test` spins up its own server and a headless browser, runs the suite, and exits non-zero on failure. GitHub Actions runs it automatically on every pull request and on pushes to `main`.

## How to use

### During a farming run

1. **Select your alliance** — tap EP, DC, or AD in the Tel Var panel.
2. **Toggle DC-held districts** — tap each district your enemy alliance controls to apply the bonus.
3. **Set your stone multiplier and group size** — matches what you're carrying in-game.
4. *(Optional)* **Tap Start Farming** in the Tel Var panel to start the session timer.
5. **Kill a boss → tap Killed** on that district row. The 15-minute timer starts.
6. **Bank regularly** — use the Bank button in the quick-action bar to bank your carried Tel Var before you get ganked.
7. **Ganked** — if you die, tap Ganked. It removes 50% of your carried Tel Var.
8. **Undo** — reverses the last action if you mis-tap.

### Timer states

| Color | Meaning |
|-------|---------|
| Green / ALIVE | Boss is up — go kill it |
| Gold countdown | Dead, respawning |
| Amber pulse | Respawning in under 1 minute |
| Red pulse | Respawning in under 15 seconds |

### Unknown timers (Guess / Seen Alive)

- **Guess** — prompts for how many minutes ago you think the boss died. Builds a partial timer from that estimate.
- **Seen Alive** — confirms the boss is currently up without adding Tel Var (scout check).
- **Reset** — clears a timer and marks the boss as alive.

## Project structure

```
index.html        — the entire app (HTML + CSS + JS, single file)
assets/           — boss portraits, alliance crests, icons, textures
manifest.json     — PWA manifest
sw.js             — service worker (offline caching)
tests/            — browser test suite + headless CI runner
package.json      — test tooling only (the app needs no npm)
.github/          — CI workflow that runs the tests
```

## Districts and bosses

| District | Bosses |
|----------|--------|
| Memorial | Volghass, Nunatak |
| Arena | Glorgoloch the Destroyer, King Khrogo |
| Arboretum | Lady Malygda, Ysenda Resplendent |
| Temple | Immolator Charr, Mazaluhad |
| Nobles | Baron Thirsk, Amoncrul |
| Elvens | Zoal the Ever-Wakeful, Screeching Matron |

Respawn time: **15 minutes** from kill. Warning fires at **1 minute** remaining.

## Credits

Built by **JNVGaming** — NA PS Server. Hate mail and gold gratefully accepted.
