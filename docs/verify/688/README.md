# Verify evidence — #688 z ladder

Capture method: fixture-mode build (`vite build --mode fixture`) + `vite
preview`, driven by a Playwright probe script (kept out of the commit; the
durable pin is `apps/web/e2e/z-ladder.spec.ts`). Scenario `?scenario=111`
(board route, chief drawer open), viewport 1440x732, dark scheme.

The before side was captured on a pristine detached worktree of
`origin/main` (base `0a1069fd`) running its own preview; the after side on
this branch's build. Same probe script, same scenario, same viewport.

## The bug (before)

- `before-drawer-covers-dialog.png` — drawer open + new-task dialog open via
  `C`: the dialog's right band (x 1022-1056, including the close button and
  the footer's right edge) renders under the drawer, and the drawer stays
  fully lit above the modal scrim.
- `before-hit-test.json` — computed z: drawer 30, dialog panel 21, dialog
  backdrop 20. `elementFromPoint` at the panel's right edge / top-right /
  bottom-right all return `DIV.chief-body` (the drawer).
- `before-close-click.json` — an unforced Playwright click on the dialog's
  close button never lands: `<div class="chief-body">` intercepts pointer
  events (retried until timeout).

## The fix (after)

- `after-drawer-under-dialog.png` — same scene: the dialog paints whole
  above the drawer; the drawer stays open, dimmed under the scrim.
- `after-hit-test.json` — computed z: drawer 10 (`--z-docked`), panel 21,
  backdrop 20. Every panel probe point hit-tests inside the dialog
  (`new-task-body` / `new-task-head` / `new-task-footer`); a point over the
  drawer center returns `DIV.dlg-backdrop` (the scrim owns the viewport);
  the drawer is still mounted.
- `after-close-click.json` — the close click is received, the dialog
  closes, and the drawer is still open afterwards (ruling: raise the dialog
  only, never collapse the drawer).

## Reference (todos.dev, live capture)

- `reference-todosdev-drawer-open.png` — the reference board with its chief
  drawer open (low-z chrome).
- `reference-todosdev-dialog-over-drawer.png` — the reference new-task
  dialog open over the still-open drawer: full-viewport `rgba(0,0,0,.6)`
  scrim, drawer dimmed underneath, never collapsed.
- `reference-todosdev-measurements.json` — probed values: dialogs ride a
  `position:fixed; z-index:9999` portal host; the drawer composer stays
  mounted while `elementFromPoint` over it returns the dialog overlay; the
  resting board ladder (1 / 10 / 30 / 100 / 9999 / max). Includes the
  alignment notes and the one documented deviation (graded modal rungs
  instead of a single always-top tier — the repo has several modal tiers
  that must stay ordered among themselves).
