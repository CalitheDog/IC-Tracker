# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Dev server

```bash
python -m http.server 5173
```

App: `http://localhost:5173`  
Tests: `http://localhost:5173/tests/`

No build step, no npm, no bundler.

## Running tests

Open `http://localhost:5173/tests/` in the browser after starting the server. Results render on the page. There is no CLI test runner.

## Critical architecture: two copies of JS

**`index.html`** is the live app — all HTML, CSS, and JS are inline in one file.

**`js/app.js`** is a separate copy of the JS logic only, loaded by `tests/index.html` so tests can import the functions without a browser DOM. **These two files must be kept in sync manually.** When adding or changing any JS function, update both files.

## Duplicate function definitions in index.html

`index.html` contains multiple definitions of several functions (`tick`, `killBoss`, `resetAll`, `updateTV`, `setAlliance`). JavaScript uses the **last** definition. Earlier definitions are dead code from previous versions that were never removed. When editing these functions, always target the last occurrence in the file.

## Key globals (module-level, no framework)

| Variable | Purpose |
|---|---|
| `stI` | Stones multiplier index (0–3 → ×1/×2/×3/×4) |
| `grSz` | Group size (1–4) |
| `alliance` | Active alliance: `'ep'`, `'dc'`, or `'ad'` |
| `dcHeld` | `Set` of district indices (0–5) held by the enemy |
| `timers[]` | Array of 6 timer objects `{end, running, wasRunning, warnFired, unknown, unknownAt, seenAt}` |
| `currentTelVar` | Tel Var currently being carried |
| `bankedTelVar` | Tel Var banked this session |
| `lostTelVar` | Tel Var lost to ganks |
| `riskTolerance` | Carrying limit for the risk warning (0 = off) |
| `telvarTarget` | Session target for the progress bar (0 = off) |
| `actionStack[]` | Undo stack — each entry is a full snapshot via `snapshot()` |

## Tel Var formula

```
perKill = round(1327 × MULT[stI] × (1 + dcHeld.size × 0.33) / grSz)
```

`BASE_TV = 1327`, `MULT = [1, 2, 3, 4]`, `RESPAWN = 900s`, `WARN_AT = 60s`.

## localStorage keys

`ic-alliance`, `ic-dcHeld`, `ic-telvar-target`, `ic-risk-tolerance`, `ic-help-seen`, `esoIcSession`, `esoIcBestStreak`

## Desktop layout (CSS grid)

Named grid areas on ≥980px viewports:

```
"map      actions"
"telvar   nextup"
"telvar   districts"
".        reset"
```

`telvar` is a `<details>` element (`grid-area: telvar`) that spans rows 2–3 of the left column. **Grid items inside the telvar panel need `min-width: 0`** or they will overflow into the right column.

## Test structure

`tests/tests.js` uses `describe` / `it` / `assert` from `tests/runner.js`. Each suite calls `resetState()` before tests to restore all globals to a clean baseline. `resetState()` must be updated whenever new module-level state variables are added.

Tests run against `js/app.js` with a mock DOM in `tests/index.html`. Hidden `<div>` sentinel elements (matching the IDs in the live app) are required so JS null-checks don't throw.

## What NOT to add

The app is intentionally a focused second-monitor tool. Avoid adding panels, stats displays, or logging features — the design principle is that timers are the primary content and everything else is secondary or collapsible.
