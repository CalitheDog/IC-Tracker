# ESO Imperial City Tracker

A boss timer and Tel Var calculator for Elder Scrolls Online Imperial City, built for console players. PC players have an in-game addon that handles IC boss timers — console players don't have an equivalent. This is the second-screen alternative: runs in any browser, so you can open it on your phone, tablet, or laptop next to your TV while you farm.

Tracks boss respawn timers across all six districts and estimates Tel Var earned per kill.

## What it does

- **Boss timers** — 15-minute respawn countdown for each district. Flashes and beeps when a boss is back up, warns 1 minute before respawn.
- **Next Respawn** — prominent hero card showing the soonest-respawning district and a live countdown.
- **Tel Var estimator** — calculates per-kill Tel Var based on your stone multiplier, group size, and how many districts the enemy alliance controls. Tracks carrying, banked, and lost amounts.
- **Risk meter** — set a carrying limit; a pulsing warning fires when you exceed it so you know when to bank.
- **Alliance & district control** — select your alliance (EP / DC / AD) and toggle which districts the enemy holds to keep the formula accurate.
- **Unknown timers** — if you find a dead boss you didn't kill, use Guess to estimate when it died, or Seen Alive to confirm it's up.
- **Visual themes** — Normal, Whip Tactician, The Dutiful Guar, The Streakah.

## Running locally

Requires Python (any version with `http.server`).

```bash
python -m http.server 5173
```

Then open `http://localhost:5173` in your browser.

No build step, no dependencies, no npm. It's a single HTML file.

## How to use

### During a farming run

1. **Select your alliance** — tap EP, DC, or AD in the Tel Var panel.
2. **Toggle DC-held districts** — tap each district your enemy alliance controls to apply the bonus.
3. **Set your stone multiplier and group size** — matches what you're carrying in-game.
4. *(Optional)* **Open Start Farming** inside the Tel Var panel to start the session timer.
5. **Kill a boss → tap Killed** on that district row. The 15-minute timer starts.
6. **Bank when prompted** — use the Bank button in the quick-action bar (or when the risk warning fires).
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

### Risk meter

Open the Tel Var panel → Risk Limit → enter a carrying amount → Set. When your carried Tel Var hits that number, a red warning banner pulses and the carrying stat turns red. Bank before you get ganked.

## Project structure

```
index.html        — the entire app (HTML + CSS + JS, single file)
js/app.js         — copy of the JS logic used by the test runner
tests/
  index.html      — test harness (loads app.js + tests)
  runner.js       — minimal describe/it/assert test runner
  tests.js        — 154 tests covering all core logic
```

## Running tests

```bash
python -m http.server 5173
```

Open `http://localhost:5173/tests/` — results render in the browser.

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

Built by **JNVGaming** (PSN). Hate mail and gold gratefully accepted.
