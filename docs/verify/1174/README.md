# #1174 delete-entry wiring — evidence

Fixture face (`vite build --mode fixture` + `vite preview` on a private port,
Playwright-driven, scenario `r2-24c`, project `r3-lifecycle`
`ZAQczKCu0MOAzC1ZqcFlX`):

| file | what it shows |
|---|---|
| `01-project-page-settings-gear.png` | project page topbar right action slot: the new settings gear (28x28 hit box measured at x=1392,y=7.5 — reference shape from todos.dev, ego-browser probe 2026-10-10) |
| `02-settings-danger-zone.png` | gear click lands on `/app/project/<id>/settings?scenario=r2-24c` (query carried); danger card with the true-cascade copy |
| `03-delete-confirm-dialog.png` | DeleteProjectConfirm open (type-name gate, pre-existing #207) |
| `04-board-after-delete.png` | after confirm: board `/app`, sidebar project-row count for the deleted project = 0 (fixture deletions overlay, #66) |
| `delete-entry-wiring.drawio` / `.drawio.svg` | wiring diagram embedded in the PR `## What` |

e2e pin: `apps/web/e2e/project-settings-delete.spec.ts` — new entry test
(`project topbar gear reaches the settings danger zone (#1174 entry)`) plus the
four pre-existing confirm-flow tests, all green.
