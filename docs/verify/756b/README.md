# #756 follow-up: chief picker search is typeahead-only — evidence

Branch carries `956c2082` (typeahead-only search shared by both chief picker
faces via `ModelPickList`) plus a merge of `origin/main` (no rebase) and a
test-only fix described below.

## What the shots show

- `drawer-open-no-search.png`: drawer-head picker open — zero search
  footprint (no `.chief-pick-search` node), default row only. Scenario 111 is
  fixture mode, where `modelOptions` is `undefined` (live-only union), so the
  face shows the default row alone by design.
- `drawer-after-n-revealed.png`: after pressing `n` — box revealed prefilled
  with `n`, focused, default row + empty state. The drawer's `N` new-thread
  hotkey did not steal the key (chip title unchanged, menu still open).
- `settings-open-no-search.png` / `settings-after-x-revealed.png`: same
  contract on the settings compaction picker (fixture canon: default + one
  model row; `x` matches neither, so default + empty state).

## Measured assertions (evidence script output)

- drawer: openRows 1, openSearch 0; after `n`: value `n`, focused true,
  chip unchanged true.
- settings: after `x`: value `x`, focused true, 1 row, empty visible true.

## Test-only fix on top of 956c2082 (no product code change)

`t-0102`'s drawer test expected 2 open rows, but scenario 111 never had
options in fixture mode (pre-existing red, unrelated to the main merge).
Counts corrected to the designed single default row, and both typeahead tests
got a focus-settle guard (`waitForFunction`: activeElement inside the face
before typing) — without it, a key pressed before FloatingShell moves focus
asynchronously lands on the trigger, where the drawer's `N` hotkey steals it.
Observed flake signature: `toBeVisible` on the search input, element not
found.

## Verification

- `pnpm -r typecheck`: all projects Done, no failures.
- `pnpm lint`: exit 0 (warnings/infos only).
- `pnpm --filter @pacman/web exec playwright test
  e2e/chief-drawer-model.spec.ts e2e/chief-settings.spec.ts --list`:
  20 tests, both typeahead tests present.
- Affected-surface e2e: 136 passed; the drawer typeahead case caught the
  stale count above, fixed, then 20/20 on the two specs (plus 4/4 repeat and
  8/8 full-file reruns for the flake guard).
