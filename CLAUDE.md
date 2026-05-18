# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Dev server

```bash
python -m http.server 5173
```

- App: `http://localhost:5173`
- Tests: `http://localhost:5173/tests/`
- OBS overlay mode: `http://localhost:5173/?obs=1`

No build step, no npm, no bundler.

## Running tests

Open `http://localhost:5173/tests/` after starting the server. Results render on the page; there is no CLI test runner.

When you edit `tests/tests.js`, `js/app.js`, or `tests/runner.js`, **bump the `?v=N` cache-busting query in `tests/index.html`'s script tags** — the browser cache for these files is sticky and will otherwise serve stale copies and produce misleading FAILs against names that no longer exist.

## Critical architecture: two copies of JS

- **`index.html`** is the live app — all HTML, CSS, and JS inline.
- **`js/app.js`** is a separate copy of the JS, loaded by `tests/index.html` so tests can import functions without the live DOM.

**The two files must be kept in sync manually.** When adding or changing a function, update both. The two files have drifted in places (some functions in `js/app.js` reference state shapes that don't exist live, e.g. `state.timers[i]`); only edit the parts of `js/app.js` that the tests actually call, and prefer mirroring the live `index.html` implementation.

## Key globals (module-level, no framework)

| Variable | Purpose |
|---|---|
| `stI` | Stones multiplier index (0–3 → ×1/×2/×3/×4) |
| `grSz` | Group size (1–4) |
| `alliance` | Active alliance: `'ep'`, `'dc'`, or `'ad'` |
| `dcHeld` | `Set` of district indices (0–5) held by the **player's currently-selected alliance**. Variable name is legacy (the app was DC-only before alliance support was added); the Tel Var formula adds `0.33 × dcHeld.size` to the multiplier because ESO's mechanic rewards YOUR alliance's district control. The label, `.dc-pill` text, and color all update with `setAlliance()` to reflect the player's faction, not an enemy. |
| `timers[]` | Array of 6 timer objects `{end, running, wasRunning, warnFired, unknown, unknownAt, seenAt}` |
| `currentTelVar` | Tel Var currently being carried. Updated via `setManualTelvar()` — which **sets** the absolute carry total (renamed from the older `addManualTelvar`; if you see that name in old commits or PRs, it's the same function with the previous "add to current" semantics). |
| `bankedTelVar` | Tel Var banked this session |
| `lostTelVar` | Tel Var lost to ganks |
| `telvarTarget` | Session target. Shown in the progress bar **and** the always-visible "Session Target" stat (`#tvTGT`). |
| `actionStack[]` | Undo stack — each entry is a full snapshot via `snapshot()` |
| `wakeLock`, `lastWakeLockState` | Screen Wake Lock — re-acquired in `updateWakeLock()` whenever any timer is running, released when none are |

## Tel Var formula

```
perKill = round(1327 × MULT[stI] × (1 + dcHeld.size × 0.33) / grSz)
```

`BASE_TV = 1327`, `MULT = [1, 2, 3, 4]`, `RESPAWN = 900s`, `WARN_AT = 60s`.

## localStorage keys

`ic-alliance`, `ic-dcHeld`, `ic-telvar-target`, `ic-help-seen`, `esoIcSession`, `esoIcBestStreak`

## Layout structure

Three top-level blocks under `<body>` (other than the corner chrome buttons and overlays):

1. **`.layout`** — flex row at ≥980px (flex column on mobile).
   - **`.left-col`** — fixed width, just the map.
   - **`.right-col`** — flex:1; contains the JS sentinel divs (`display:none`), `.next-up` hero card, `.districts` grid, `.action-strip`, `.reset-all`.
2. **`.telvar-details`** — full-width section *after* `.layout`. Its `.telvar-panel` body wraps two `.telvar-col` divs in a `1fr 1fr` grid at ≥980px, flex column on mobile. Columns are hand-balanced (alliance-controlled district toggles live in the right column to even the heights). The left column ends with a permanent `.formula-card` (rendered as a multi-row breakdown by `updateTV()`) — **don't re-wrap it in `<details>`/`<summary>`**; the user explicitly wanted the formula always visible.
3. **`.footer`** + **`.credits`**.

There is **no** CSS Grid named-area layout anymore; do not reintroduce `grid-template-areas`.

### `.districts` boss-card grid

`display:grid; grid-template-columns:repeat(2,minmax(0,1fr));` at ≥480px, single column below. Each `.drow` is `display:flex; flex-wrap:wrap;` with its four action buttons wrapped in a `.drow-actions` child whose `width:100%` forces them onto a new visual row inside the card.

## Map SVG footgun

`svg.map text { pointer-events: none; user-select: none; }` is intentional — without it, clicking a district label selects the word instead of toggling the slice underneath. If you touch map CSS, keep this rule.

## OBS overlay mode

`isObsMode()` checks `?obs=1` and adds `body.obs` early in `init()`. A single block of `body.obs ... { display: none !important; }` rules hides everything except `.next-up` and `.districts`, makes the background transparent, and compresses the layout to ~380px. The first-visit help modal is also suppressed in OBS mode.

## PWA

`manifest.json`, `sw.js`, and the `assets/*.png` images make the app installable. The favicon / PWA icon is `assets/stone.png` (a Tel Var stone image); `assets/bag-of-telvar.png` is the help-modal hero. The service worker uses `CACHE = 'ic-tracker-vN'` — **bump the version** in `sw.js` when shipping CSS/HTML/asset changes you want users to pick up promptly. Installed-PWA users will otherwise serve from the cached version until they hard-refresh.

## Dead code worth knowing about

- **`.unknown` timer state**: Rendering for purple/UNKNOWN exists and is exercised by tests, but no production code path sets `timers[i].unknown = true`. Don't promise this in user-facing copy.
- **`#netSessionTv` / `#grossSessionTv` / `#effSessionTv` / `#sessionLog` / `#districtStatusSummary` / `#nextTargetTitle` / `#nextTargetReason` / `#killNextBtn` / `#projectedNote` / `#copyPill`**: hidden sentinel divs in `.right-col` only exist so legacy `updateCommandCenter()`-style code paths don't throw on `getElementById(...).textContent`. The functions writing to them are never rendered. If you remove either the elements or the functions, remove both together.

## Test structure

`tests/tests.js` uses `describe` / `it` / `assert` from `tests/runner.js`. Each suite calls `resetState()` first to restore globals to a clean baseline — keep `resetState()` updated whenever new module-level state is added.

Tests run against `js/app.js` with a mock DOM in `tests/index.html`. Hidden `<div>` sentinel elements (matching live-app IDs) are required so JS null-checks don't throw. When adding a new live-app element with an `id` referenced in JS, also add a hidden sentinel for it here.

## What NOT to add

The app is intentionally a focused second-monitor tool. Avoid adding panels, stats grids, or logging features — timers are the primary content. The Tel Var Estimator was deliberately made permanent (not collapsible) at user request; don't collapse it back. The map text labels are intentionally non-interactive; clicks should always toggle the slice underneath, never select text.
