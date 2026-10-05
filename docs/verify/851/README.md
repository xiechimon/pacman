# Verify evidence, ticket 851

Two mechanisms carry this ticket number; each has its evidence indexed below.

## Debt gate — construction-period brake (#851 rewrite of 2026-10-05, #908 wave 0a)

`scripts/ui-debt-gate.mjs` freezes the two debt ledgers into
`scripts/ui-debt-baseline.json` (`--write`) and keeps them from growing while
the #908 overhaul runs. Frozen from main @ `b38e70d7`:

- per-face CSS: **20 files / 11,412 lines** — the #908 headline "25 files /
  12,337 lines" counts the five whitelisted carrier stylesheets too
  (shadcn 397 + tokens 222 + motion 171 + app 97 + fonts 38 = 925 lines).
- bare controls: **76 sites / 30 files** — the `count-raw-controls.mjs`
  ledger (77 with `components/ui/select.tsx`) minus `components/ui/`, the
  exclusion #851 specifies.
- Ledger reconciliation: the #908 itemization lists "ui directory 354" while
  the files on main sum to 299 (dialog 240 + chip 42 + input 17). The 12,337
  headline is unaffected; the per-file baseline JSON is the authoritative cut.

`run-scenarios.sh <mechanism-sha>` replays every verdict path in a detached
scratch worktree and regenerates the transcripts below verbatim:

| file | proves |
|---|---|
| `01-clean-pass.txt` | clean tree at the frozen baseline passes |
| `02-d1-css-plus-one.txt` | +1 line in chief.css → D1 red |
| `03-d2-control-plus-one.txt` | +1 bare `<button>` → D2 red (77 > 76) |
| `04-d1-new-css-file.txt` | brand-new per-face css file → D1 red (a new face has baseline 0) |
| `05-d3-baseline-raise.txt` | adding debt AND re-freezing the baseline → still red: D1 compares against the base sha's baseline and D3 names the raise |
| `06-d4-corrupt-baseline.txt` | corrupt or internally inconsistent baseline → exit 2, fail-closed |
| `07-ratchet-down-note.txt` | debt removed → PASS + ratchet-down note; `--write` follows the tree down |
| `08-base-not-fetched.txt` | unavailable base sha → exit 2 instead of a silent fallback to the branch baseline |
| `09-freeze-idempotent.txt` | re-freezing an unchanged tree → no numeric change |

CI-side proof (the base-sha plumbing on a real runner, and the green path on
main) is linked from the PR body: a throwaway draft PR carrying the 05
scenario shows the check job red at the gate step; the PR for this ticket
shows it green.

## Drift gate — original audit scope (PR #856, merged)

Scope of that PR: audit only + `scripts/ui-drift-gate.mjs` + one CI step. No
app code changed, so there is no rendered before/after — the mechanism proof
is the gate output below plus the ledger snapshot.

- `gate-output.txt` — `node scripts/ui-drift-gate.mjs` on that branch: PASS
  (no live `.btn` selectors, no hex escapes outside the token source,
  six chip variants single-sourced, 25 CSS files scanned).
- `raw-controls.txt` — `node scripts/count-raw-controls.mjs` ledger snapshot
  at the time (60 `<button>` / 9 `<input>` / 2 `<select>` / 9 `<textarea>` =
  80 raw sites, 50 handrolled classes, 49 files on `components/ui/button`).
- `checks.txt` — `pnpm -r typecheck` (all packages green), `biome ci` on the
  changed files (clean), `e2e:affected` verdict (no web e2e surface touched —
  scripts + CI-only change, coverage is the vitest integration layer on CI).
