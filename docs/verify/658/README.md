# #658 evidence — dead-CSS removal (A/B/F/G/H/I) + failed-tone chip addition

Two fixture-mode builds, same machine, same Playwright chromium, viewport
1440x732, dark scheme:

- **before** = `origin/main` @ `20b34584` (detached one-shot worktree,
  `vite build --mode fixture` + `vite preview` on :8401)
- **after** = this branch (same build recipe, `vite preview` on :8399)

One shared probe script visited each face on both stacks and captured
screenshots plus `getComputedStyle` readings (`computed-styles-*.json`).

## Result

Six of the eight face pairs are **byte-identical** (md5): the dead-rule
removals change no rendered pixel. The two pairs that differ are exactly the
intended fix — the failed-phase search chip, which had no rule before.

| files | face | md5 |
|---|---|---|
| `search-chip-failed-{before,after}.png` | `.search-row-chip--failed` element (⌘K panel, scenario r8-78, query README) | DIFFERS — the fix |
| `search-panel-failed-{before,after}.png` | whole ⌘K panel with the failed row | DIFFERS — the fix |
| `board-r8-78-{before,after}.png` | board carrying the failed #12 card (context face) | identical |
| `search-panel-01-{before,after}.png` | ⌘K nav rows, scenario 01 (other tone rows parity) | identical |
| `machines-{before,after}.png` | resources/machines shell (res-tile orange family) | identical |
| `skills-{before,after}.png` | resources/skills shell (res-tile orange family) | identical |
| `agent-detail-{before,after}.png` | agent task rows — the only Chip primitive consumer | identical |
| `schedules-{before,after}.png` | schedules list (sched-card-chip family, done tone) | identical |

Computed styles (dark theme), full readings in `computed-styles-*.json`:

| selector | before | after |
|---|---|---|
| `.search-row-chip--failed` | `background rgba(0,0,0,0)`, `color rgb(212,212,216)` (bare base, no rule) | `background rgb(53,28,26)` = `--chip-failed-bg`, `color rgb(221,82,76)` = `--chip-failed-fg` |
| `.res-tile--orange` | `rgb(51,34,27)` / `rgb(242,194,75)`, 28px, radius 8px | identical readings |
| `.chip--idle.chip--mini` (agent-detail) | `rgb(32,39,51)` / `rgb(158,163,174)`, 14px | identical readings |
| `.sched-card-chip--done` | `rgb(20,41,28)` / `rgb(94,194,106)`, radius 6px | identical readings |

Faces with nothing to capture, by design:

- **A (ui/card)** — zero importers, never bundled; no rendered face exists.
- **B (.input--palette)** — the ⌘K face migrated to components/ui/input in
  #574; the two remaining `.input` consumers (provider/secret dialogs)
  render the untouched base rule, and the class string emitted for the
  default variant is unchanged (`input` plus any className).
- **F (--indigo) / H (five btn variants) / I (--neutral)** — dead means no
  element ever carried the class; the living faces of each family are the
  identical pairs above, backed by the full apps/web e2e suite (605 passed;
  the single failure, chip-hotzone H2, reproduces identically on the
  origin/main baseline in this environment — pre-existing, while CI on main
  is green).
- **G (.mention-chip--todo)** — runtime-unreachable (the SCHEME regex in
  api/mappers.ts matches only agent|skill|project|machine) and fixtures
  carry no mention segments, so no face exists to shoot.
- **sched-card-chip--failed** — no fixture schedule carries a failed todo,
  so the added rule has no fixture face; it mirrors the search-row rule
  token-for-token (same `--chip-failed-bg/fg` pair).
