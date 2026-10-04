# #756: chief picker search is typeahead-only — evidence

Contract: opening a chief model picker renders zero search footprint (no
`.chief-pick-search` node). A printable key reveals the box with the key
prefilled, filters immediately, and moves focus into the input. Clearing the
query retracts the box — full list back, focus back on the list container.
Space stays with row activation (keyboard a11y contract) and never reveals.

Focus is established synchronously when the list mounts (`ModelPickList` in
`model-select-core.tsx`), so the first key always travels through the
listbox even though FloatingShell moves focus in asynchronously. The specs
additionally wait for focus to settle inside the face before typing.

## What the shots show

First round (`*-open-no-search.png`, `*-after-*-revealed.png`):

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

Second round (`drawer-open-no-box.png`, `drawer-reveal-empty.png`,
`settings-reveal-filter.png` — same steps, manual capture):

- `drawer-open-no-box.png`: drawer picker open, no `.chief-pick-search`.
- `drawer-reveal-empty.png`: key `n` reveals the box prefilled with `n`,
  default row + empty state (fixture face carries no candidates on this face).
- `settings-reveal-filter.png`: compaction picker key `c` prefills `c`,
  default row + the filtered canon row (claude-sonnet-5), no empty state.

## Measured assertions (evidence script output, first round)

- drawer: openRows 1, openSearch 0; after `n`: value `n`, focused true,
  chip unchanged true.
- settings: after `x`: value `x`, focused true, 1 row, empty visible true.

## Verification

- `pnpm -r typecheck`: all projects Done, no failures.
- `pnpm lint`: exit 0 (warnings/infos only).
- `pnpm --filter @pacman/web exec playwright test
  e2e/chief-drawer-model.spec.ts e2e/chief-settings.spec.ts --list`:
  both typeahead tests present.
- Affected-surface e2e: second round ran 140/140 green after the
  mount-sync focus fix, with the drawer typeahead case additionally passing
  `--repeat-each=5`.
