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
