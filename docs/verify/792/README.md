# docs/verify/792 — P6 board/sidebar/chief/detail/pages bone convergence

Ticket: #792 (`web(theme): board/sidebar/chief/detail/pages bone convergence (P6)`).
Spec: `docs/spec/base-ui-theme.md` §1.1 (second batch) + §2.7 (radius zero, per-face).

## What changed

Radius 0 on the five faces' card/row/panel/composer/tab/button shells
(3 commits: board+sidebar, chief+detail, pages). Ring, shadow, border,
motion and token layers untouched. Geometry pins moved with the CSS in
the same commits: `visual-polish` (card/column/banner 12px→0),
`board-dnd` (drag ghost 8px→0), `sidebar-visual` (row face 6px→0),
`detail-3pane` (composer 12px→0), `spec-brief-card` (spec block 12px→0).

Deliberately untouched (with owner): circles (avatars, fabs, badges,
dots), pills/chips/kbd, code blocks, menus/popovers + their rows (P3
overlay bone), form fields (search inputs, selects — fields keep their
radius), shared component bases (Card/Button/Badge/TagChip), token vars
(`--edge-radius`, `--radius-popover`), diagram nodes (team org chart),
`--drag-shadow`/edge shadows. Screenshots below show the field/bone
contrast on purpose (chief settings select keeps 8px next to square
rows).

## Rendered proof (computed border-radius on the live stack, web 8401)

| Face | Selector | Before | After |
|---|---|---|---|
| board card | `.todo-card` | 12px | 0px |
| board column | `.board-column` | 12px | 0px |
| sidebar row | `.sidebar-row::before` | 6px | 0px |
| board drag ghost | `.board-drag-card` | 8px | 0px (board-dnd spec) |
| chief composer | `.chief-composer` | 12px | 0px |
| chief agent row / tabs / compress | `.chief-agent-row`, `.chief-tabs`, `.chief-tab`, `.chief-compress` | 8px/6px | 0px |
| chief charter empty | `.chief-charter-empty` | 8px | 0px |
| detail composer / bubbles / spec block | `.composer`, `.chat-bubble`, `.spec-block` | 12px | 0px (specs) |
| pages rows / empty tile / tabs | `.prj-task-row`, `.sched-empty-tile`, `.page-tab(s)` | 8-12px/6px | 0px |
| field contrast (kept) | `.chief-select` | 8px | 8px |

Before values are the pre-change assertions in the same specs this PR
updates (spec-as-before); after values are DOM-computed on the
`squash` stack above plus the passing specs below.

## Shots (after; 1440×900, stack web :8401 → server :8402, scratch home)

- `board-light-after.png` / `board-dark-after.png` — square cards,
  columns, selected sidebar row, both themes.
- `chief-dark-after.png` — drawer empty-state tiles + composer, dark.
- `chief-rows-after.png` — open model picker, square turn-tools panel,
  square chat bubbles and composer with a live thread, dark.
- `chief-agent-after.png` / `chief-charter-after.png` — settings rows,
  tabs, compress panel square; select field round (kept).
- `detail-light-after.png` — square composer + chat bubbles, light.
- `schedules-after.png` — square empty tile + square primary button.
- `team-after.png` — square page tabs.
- `pages-light-after.png` — square project task rows.

## Checks

- `pnpm lint` clean, `pnpm typecheck` (web/server/daemon/integration) green.
- `pnpm --filter @pacman/web e2e:affected`: **456 passed, 0 failed**.
- Edited specs parse (`--list`): visual-polish 13, board-dnd 21,
  sidebar-visual 7, detail-3pane 10, spec-brief-card 6.
