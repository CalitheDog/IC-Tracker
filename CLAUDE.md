# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Dev server

```bash
python -m http.server 5173
```

- App: `http://localhost:5173`
- OBS overlay mode: `http://localhost:5173/?obs=1`

No build step, no npm, no bundler.

## Architecture

`index.html` is the entire app — all HTML, CSS, and JS inline. No modules, no separate source files.

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

The app is the original single-file markup with a **"Command Deck" redesign layered on top**: a CSS override block (CSS variables prefixed `--cd-`, mostly `!important` rules — the lower half of the `<style>`, starting around `===== body / background =====`) plus a JS IIFE that relocates DOM at wide widths (search `Command Deck:`). The base markup and CSS are still underneath — if a CSS rule isn't taking effect, an `!important` override further down the file is the usual reason.

Top-level blocks under `<body>` (besides overlays and corner chrome buttons):

- **`.cmd-topbar`** — sticky header added by the redesign: brand plus alliance / per-kill / carrying / banked / next-respawn / session cells.
- **`.layout`** — wraps **`.left-col`** (the map: `.map-section` → `.map-toolbar` + `.map-wrap` holding `svg#map`) and **`.right-col`** (hidden JS sentinel divs, the `.next-up` hero card, `.districts`, `.action-strip`, `.reset-all`).
- **`.telvar-details`** — the Tel Var Estimator. `.telvar-cols` holds two `.telvar-col` divs; the left one ends with a permanent `.formula-card` (rendered as a multi-row breakdown by `updateTV()`) — **don't re-wrap it in `<details>`/`<summary>`**; the user explicitly wanted the formula always visible.
- **`.footer`** + **`.credits`**.

The original `.next-up` "Next Respawn" hero card is force-hidden (`.next-up{display:none !important}`); its role moved to the compact `.ctb-next` cell in the topbar.

### Wide-screen layout (≥1280px)

`body` becomes a CSS Grid with `grid-template-areas`:

```
topbar  topbar    topbar
map     districts telvar
actions actions   actions
footer  footer    footer
```

`body > .layout` is set to `display:contents` so `.left-col`, `.right-col`, and `.telvar-details` drop straight into the `map` / `districts` / `telvar` areas. The Command Deck JS IIFE also builds a `.cd-insights` "Session Insights" panel into `.left-col` under the map (`syncInsights()` mirrors Tel Var panel stats into it every 600ms) and moves `.action-strip` + `.reset-all` onto `<body>` as `.cd-bottom-bar` for the `actions` area. Below 1280px all of this reverts and the base single-column flex `.layout` applies.

### `.districts` boss-card grid

Base CSS is a 2-column grid; the redesign overrides `.districts` to `display:flex; flex-direction:column` — a single-column strip of `.drow` rows, each with its action buttons in a `.drow-actions` child.

## Map SVG footgun

`svg.map text { pointer-events: none; user-select: none; }` is intentional — without it, clicking a district label selects the word instead of toggling the slice underneath. If you touch map CSS, keep this rule.

## OBS overlay mode

`isObsMode()` checks `?obs=1` and adds `body.obs` early in `init()`. A single block of `body.obs ... { display: none !important; }` rules hides everything except `.next-up` and `.districts`, makes the background transparent, and compresses the layout to ~380px. The first-visit help modal is also suppressed in OBS mode.

## PWA

`manifest.json`, `sw.js`, and the `assets/*.png` images make the app installable. The favicon / PWA icon is `assets/stone.png` (a Tel Var stone image); `assets/bag-of-telvar.png` is the help-modal hero. The service worker uses `CACHE = 'ic-tracker-vN'` — **bump the version** in `sw.js` when shipping CSS/HTML/asset changes you want users to pick up promptly. Installed-PWA users will otherwise serve from the cached version until they hard-refresh.

## Dead code worth knowing about

- **`.unknown` timer state**: Rendering for purple/UNKNOWN exists, but no production code path sets `timers[i].unknown = true`. Don't promise this in user-facing copy.
- **`#netSessionTv` / `#grossSessionTv` / `#effSessionTv` / `#sessionLog` / `#districtStatusSummary` / `#nextTargetTitle` / `#nextTargetReason` / `#killNextBtn` / `#projectedNote` / `#copyPill`**: hidden sentinel divs in `.right-col` only exist so legacy `updateCommandCenter()`-style code paths don't throw on `getElementById(...).textContent`. The functions writing to them are never rendered. If you remove either the elements or the functions, remove both together.

## What NOT to add

The app is intentionally a focused second-monitor tool. Avoid adding panels, stats grids, or logging features — timers are the primary content. The Tel Var Estimator was deliberately made permanent (not collapsible) at user request; don't collapse it back. The map text labels are intentionally non-interactive; clicks should always toggle the slice underneath, never select text.
