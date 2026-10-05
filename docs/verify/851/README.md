# Verify evidence, ticket 851 (UI primitives audit + drift gate)

Scope of this PR: audit only + `scripts/ui-drift-gate.mjs` + one CI step. No app
code changed, so there is no rendered before/after — the mechanism proof is the
gate output below plus the ledger snapshot.

- `gate-output.txt` — `node scripts/ui-drift-gate.mjs` on this branch: PASS
  (no live `.btn` selectors, no hex escapes outside the token source,
  six chip variants single-sourced, 25 CSS files scanned).
- `raw-controls.txt` — `node scripts/count-raw-controls.mjs` ledger snapshot
  (60 `<button>` / 9 `<input>` / 2 `<select>` / 9 `<textarea>` = 80 raw sites,
  50 handrolled classes, 49 files on `components/ui/button`).
- `checks.txt` — `pnpm -r typecheck` (all packages green), `biome ci` on the
  changed files (clean), `e2e:affected` verdict (no web e2e surface touched —
  scripts + CI-only change, coverage is the vitest integration layer on CI).

Note: full-repo `pnpm lint` reports pre-existing findings in
`integration/eval/chief-dispatch/build-report-lite.mts` (landed in `e9b1a82d`,
identical to `origin/main`, untouched by this branch).
