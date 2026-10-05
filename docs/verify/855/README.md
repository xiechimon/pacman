# #855 verify: bare `<input>` sites ruled

9 sites from the ticket, each either migrated to `components/ui/input.tsx`
or marked deliberate-native. `node scripts/ui-drift-gate.mjs` is GREEN
(5 bare sites, all marked, 0 uncommented).

## Rulings

- Migrated (2): `model-select-core.tsx:252` typeahead search box,
  `agent-detail-page.tsx:774` agent name field.
- Deliberate-native (5): 3 hidden file-picker triggers
  (`composer.tsx`, `chief-drawer.tsx`, `new-task-dialog.tsx`),
  `filter-panel.tsx:217` tri-state checkbox, `branch-dialog.tsx:167`
  custom-switch a11y layer.
- Already done (1): `api-key-create-dialog.tsx` (Input + Checkbox, XMON-75).
- Gone (1): `ui/select.tsx` no longer exists (moved to
  `components/ui/select.tsx` under XMON-75; no bare inputs remain).

## Checks

- `node scripts/ui-drift-gate.mjs` green (see gate.log).
- `pnpm -r typecheck` green, all 5 workspace projects.
- `pnpm --filter @pacman/web e2e:affected`: 445 passed, 0 failed
  (includes `agent-detail.spec.ts` name inline-edit roundtrip and
  `chief-drawer-model.spec.ts` typeahead search).
- Repo-wide `pnpm lint` (biome ci) green; the 9 files touched here are
  biome-clean.

## Screenshots (after state, focused)

- `agent-name-input-focused.png`: migrated name field renders with value.
- `model-pick-input-focused.png`: typeahead row renders (icon + query,
  36px bordered row); inner input stays ring-free per the chief.css guard
  (row 252x36, input 205x20 inside it).
