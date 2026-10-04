# #814 evidence: ordered-list auto-continuation in the new-task dialog

Live verify stack (`launch.mjs`, server 8792 + web 5274, fresh seed DB),
Playwright true user path, 1440x732 dark.

- `ordered-list-flow.gif` — full flow: type `1. buy milk` → Enter continues
  `2. ` → type `buy eggs` → Enter continues `3. ` → Enter on the empty
  item exits the list → new `1. ` list continues again.
- `01-board.png` … `07-second-list.png` — the GIF frames as stills.
- `result.json` — probe checks, 4/4 PASS:
  `enter-continues-2`, `enter-continues-3`, `empty-exits-list`,
  `after-exit-continues` (each asserts the exact textarea value).

Unit pin: `apps/web/test/ordered-list.test.ts` (14 cases, pure function
`applyOrderedListEnter`). E2E: `e2e:affected` shared-surface fallback,
95/95 specs, 745 passed, 0 failed (log `/tmp/e2e-814.log` on the run
machine; web unit 33 files / 387 tests green, `pnpm lint` + `pnpm -r
typecheck` green).

## Rework: ordinal glyph + baseline alignment (user feedback on 1./2.)

- `08-ordinal-rendered.png` — saved view: ordinals dimmed to tertiary
  (was secondary, ~30 steps under body), `align-items: baseline` on the
  row, 3ch two-digit gutter so `10.` no longer jogs the content column.
- `09-input-tabular.png` — inputs (`new-task-spec`, both composers) take
  `font-variant-numeric: tabular-nums`: `1.`/`2.` share one advance width
  (measured 2.8px jog on 1 vs 2 before), content keeps a straight column.
- Regression pin: `spec-brief-card.spec.ts` test 6 (3 ordered rows incl.
  `10.` — ordinal/content colors differ, row `align-items: baseline`,
  content left edges within 1px). Rework E2E: full affected 746 passed.
- Weight stays 400 (below-18px floor); distinction rides color only.
