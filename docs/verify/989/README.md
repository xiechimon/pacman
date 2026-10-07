# Verify evidence, ticket 989

## Mechanism: the components/ui registry gate (#989, map #980, criteria ruled in #985)

`scripts/ui-registry-gate.mjs` enforces, mechanically and offline, the claim
that `apps/web/src/components/ui/` is registry-sourced:

- **manifest** (`scripts/ui-registry.json`) — every file in the directory is
  registered as a pristine registry item, a registered deviation from a named
  upstream item (reason required), or a local adapter (reason required). An
  unregistered file is red (S1); a stale entry is red (S2).
- **hash ledger** — each entry freezes a sha256 over the comment-stripped,
  line-normalized file content (`scripts/ui-normalize.mjs`). An edit without a
  same-PR re-freeze is red (S3), which turns a silent overwrite into a
  visible ledger diff — the review face.
- **vendored upstream snapshots** (`scripts/ui-upstream-snapshots.json`) — the
  16 base-nova items fetched through the pinned `shadcn@4.21.3` CLI, five
  documented deterministic rewrites (registry import paths, IconPlaceholder →
  repo icons, `use client` drop, `cn-*` token strip, React type-import) and
  the repo's own biome pipeline. A `pristine` entry whose ledger hash no
  longer equals its snapshot hash is red (S4): either the file drifted or
  upstream moved, and both must be resolved deliberately. The CLI runs only
  in `scripts/ui-registry-refresh.mjs` (dev-time); CI is zero-network,
  pre-install, <1s — the live-diff form was measured and rejected in #985
  (batch `add --diff` truncates at 5 of 16; cold npx ~67s; upstream releases
  would redden an untouched main).
- **status ratchet** (S5) — against the PR base manifest, an existing entry
  may only move up: `pristine → deviated` and `registry → adapter`
  downgrades are red, and re-freezing inside the PR cannot hide them (the
  comparison runs against the base copy, debt-gate D3's stance). New
  registrations pass mechanically — the manifest diff and #939's human layer
  carry that review — and are named in the output.
- **fail-closed** (S6) — malformed JSON, unknown enums, missing reasons,
  malformed hashes, pristine entries without a snapshot item, a missing
  snapshot file, an empty directory or an unfetched base sha all exit 2.

Companion changes in the same commit: drift-gate **G5** (no raw palette
classes, no arbitrary color values in `components/ui/*.tsx` — the
zero-skin constraint #985 ruled mechanically checkable), the shared comment
stripper's missing `m` flag (column-0 `//` lines after the first were
surviving stripping), and the vestigial `'use client'` dropped from
`alert-dialog.tsx` (`rsc:false`; `shadcn add` strips it itself — the file
now matches its pinned snapshot).

**First freeze** (main @ `e9253388`, 25 files): 16 registry items —
6 pristine (alert-dialog, badge, card, dialog, empty, kbd) + 10 registered
deviations (avatar, button, checkbox, dropdown-menu, input, popover, select,
switch, tabs, textarea, each with ticket-referenced reasons) — plus 9
adapters. This is a stronger cut than #985's "at least 6 deviated" estimate:
with the normalization pipeline in place, badge/card/alert-dialog/empty/kbd
proved byte-identical to upstream and dialog's icon/use-client/heading
rewrites proved fully mechanical.

## Scenario transcripts

`run-scenarios.sh <mechanism-sha>` replays every verdict path in a detached
scratch worktree at `e5a8d3c9` and regenerates the transcripts below
verbatim (scenario 13 runs in the lane worktree and is the only one needing
network + node_modules):

| file | proves |
|---|---|
| `01-clean-pass.txt` | **acceptance 2 — gate green**: the frozen tree passes all three UI gates (registry + drift incl. G5 + debt #851) |
| `02-s1-unregistered-file.txt` | **acceptance 1 — gate red demo**: a hand-written file in components/ui → S1 red, reason line names the file and the registration path |
| `03-s3-content-edit.txt` | editing a registered file without re-freeze → S3 red (ledger vs tree hashes named) |
| `04-s4-pristine-drift-refrozen.txt` | editing a pristine file AND re-freezing still → S4 red: the ledger no longer equals the pinned snapshot |
| `05-s5-downgrade.txt` | re-registering pristine → deviated → S5 red against the base manifest; re-freeze cannot legalize it |
| `06-s2-stale-entry.txt` | deleting a file while its entry stays → S2 red |
| `07-s6-corrupt.txt` | corrupt manifest / deviated entry without reason / missing snapshot → exit 2 each, fail-closed |
| `08-base-not-fetched.txt` | unavailable base sha → exit 2 instead of a silent fallback to the branch manifest |
| `09-bootstrap-pass.txt` | base without the manifest (main @ e9253388) → S5 skipped, PASS — the introducing PR is green |
| `10-write-refuses-unregistered.txt` | `--write` refuses to invent registrations (exit 2) and prints the entry skeleton |
| `11-write-idempotent.txt` | re-freezing an unchanged tree reports no change, twice |
| `12-g5-raw-color.txt` | `bg-red-500` + `text-[#fff]` injected into a ui file → drift-gate G5 red |
| `13-refresh-deterministic.txt` | refresh re-run against unchanged upstream: all 16 statuses confirm, only `fetchedAt` moves in the snapshot (1-line git diff), restore leaves the tree clean |

CI-side proof: this PR's `check` job runs the `UI registry gate (#989)` step
green on the head sha (pre-install slot, next to the #851 debt gate); the
red path on a real runner is the same script/exit code as `02`, which the
scratch worktree replays verbatim.

Full-suite e2e (`e2e:affected` falls back to full for shared surfaces —
components/ui is consumed everywhere): **811 passed / 104 specs, 1.8m**,
port 8398, at the mechanism commit.
