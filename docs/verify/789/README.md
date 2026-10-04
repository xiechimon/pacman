# #789 P2 evidence — V2 checkbox bone (16px square + hand-made check motion)

Spec: `docs/spec/base-ui-theme.md` §1.2 + §2. Before stack: `origin/main`
one-shot worktree (`/tmp/p2-before`, P1 tip). After stack: this branch.
Face: accept dialog frozen open on fixture `?scenario=34`.

## Motion GIFs (before / after, one each — statics below are supplements)

| Theme | Before (18px, no motion) | After (16px, hand motion) |
|---|---|---|
| dark | `toggle-dark-before.gif` | `toggle-dark-after.gif` |
| light | `toggle-light-before.gif` | `toggle-light-after.gif` |

Each GIF = one off-toggle (90ms glyph shrink + 100ms bg flip back) followed by
one on-toggle (100ms bg flip to theme fill + 140ms glyph scale .5→1 with
`cubic-bezier(0.34, 1.4, 0.64, 1)` overshoot), cropped to the accept row.

## Rendered contrast pairs (better-colors: measured on the rendered tile, not estimated)

| Theme | Before | After | Gate |
|---|---|---|---|
| dark | 2.03:1 — white glyph on `#cba6f7`, 18px (FAIL) | 8.81:1 — `#17171a` glyph on `#cba6f7`, 16px | ≥ 4.5:1 |
| light | 5.41:1 — white glyph on `#8839ef`, 18px | 5.41:1 — white glyph on `#8839ef`, 16px | ≥ 4.5:1 |

Raw: `contrast-{dark,light}-{before,after}.json` (bg/glyph computed colors +
tile box). The dark before-value is the bug P2 fixes: the hardcoded white
glyph on the light-purple fill. The fix routes the glyph through `currentColor`
(`--text-on-accent`), so each theme gets its own glyph color.

## Statics

`tile-{dark,light}-checked-{before,after}.png` — accept-row close-ups.

## Mechanism (built CSS, not source reading)

`built-css-mechanism.txt` — grep over the production build
(`pnpm --filter @pacman/web build` → `dist/assets/*.css`): 16px tile,
radius 0, bg 100ms flip, indicator enter 140ms overshoot, exit 90ms shrink.
Single mechanism on the face: no `animate-in`/keyframe in
`components/ui/checkbox.*` (the one `animate-in` in dist is Tailwind's own
utility + dialog/popover group variants).

## Tests

- `checkbox-unified`: 7/7 incl. new geometry (16×16 / radius 0) and hand-motion
  (100ms tile / 140ms enter overshoot / 90ms exit) pins.
- `e2e:affected`: 719 passed, 1 failed (`board-dnd` flash-home — no checkbox
  reference in that spec; passes solo on this branch 21/21 and on main, load
  flake under the full run).
- `board-dnd` solo on this branch: 21/21.
- `pnpm lint` clean on touched files; `pnpm -r typecheck` green; no unit
  tests cover these files (`vitest related --changed`: none found).
