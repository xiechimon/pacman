# #790 P3 evidence: V2 overlay shell + scale-fade enter

## Method

- before stack: one-shot worktree `/tmp/p3-before-main` at `origin/main`
  (detached), own install, `vite build --mode fixture`, preview on `:8403`.
- after stack: this branch, same build, preview on `:8404`.
- Probe `probe-menu.mjs` (`BASE` + `TAG` env): fixture detail
  `/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=27`, settles 1.2s, clicks
  `.detail-head-icon--more`, records video. Non-loopback requests aborted
  (626 precedent: dicebear hangs ~8s otherwise).
- GIF cut: the Playwright webm timestamps are unreliable for `-ss`, so
  frames were selected by NUMBER (`between(n,55,83)` — menu enters at
  ~frame 60-65), cropped on the menu corner, slowed 2x for legibility
  (100ms realtime enter reads as ~200ms).
- Geometry stills: `probe-faces.mjs` + frame grabs from the same videos.

## What changed (spec: `docs/spec/base-ui-theme.md` §1.2 + §2.6)

- Enter/exit on all overlay faces: slide -8px removed, scale .98 + fade,
  100ms ease-out (`zoom-in-98`/`zoom-out-98` are tw-animate-css functional
  utilities — verified `--tw-enter-scale:calc(98*1%)` in dist output).
  Single-mechanism grep: `slide-in-from|slide-out-to` returns only
  `chief-drawer.tsx` (directional drawer slide, P6 scope, excluded).
- Shell geometry on the 12 anchored-pop panels: 12px padding, 1px
  `--border-default` frame, radius 0, 8px anchor gap, min-width 220,
  12x6 outlined Arrow drawn inside the padding zone (`::before` ink +
  `::after` panel fill) so no `overflow` rule needs to change.
- Text insets preserved by construction (row side-padding trimmed by the
  same 8px the shell gained); only 3 e2e pins needed F6 updates.

## Files

- `before-enter.gif` / `after-enter.gif`: more-menu enter, before (slide)
  vs after (scale-fade). 0.5x slowdown noted above.
- `before-more-menu.png` / `after-more-menu.png`: shell stills (rounded +
  edgeless vs square + 12px frame + ink border).
- `arrow-zoom.png`: 3x-DPI crop of the Arrow (12x6 outlined triangle,
  tip touching the top frame from inside).
- `chip-popover.png`: fixed 298x193 holds under the new shell.
- `probe-menu.mjs` / `probe-faces.mjs`: capture scripts.

## Verification

- `pnpm lint`, `pnpm typecheck`: clean.
- Full web e2e on a quiet machine: **719 passed, 0 failed**.
- 3 F6 pin updates, all rest-geometry preserving (see PR body).
