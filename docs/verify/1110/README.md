# #1110 evidence: the repo owns its PR body contract

The failure being fixed: a lane writing a PR body follows the global
`/pr` skill (show-me: `## Summary` / `## Evidence` / `## Merge Danger`),
fails `pr-evidence`, and hand-rewrites the body into the repo's six-section
contract. Four lanes hit it in one day (#1100, #1103, #1105, #1111).

Everything below was recorded before the PR was opened.

## Files

| file | what it is |
|---|---|
| `fixture-showme-body.md` | a body written per the global show-me `/pr` template, filled with this PR's own content — the counterexample the four lanes actually produced |
| `gate-showme-red-old-gate.txt` | that fixture against the gate as it sits on main: RED, names both missing sections, points nowhere |
| `gate-showme-red-new-gate.txt` | the same fixture against this change: same RED verdict plus the two new pointer lines (canonical template path, repo skill path) |
| `pr-body-contract.drawio` / `.drawio.svg` | the `## What` diagram (before/after routing) |
| `gate-six-section-green.txt` | this PR's own body against the gate, run locally before the PR was opened: GREEN |

## The two halves

Red: `python3 scripts/pr-evidence-gate.py docs/verify/1110/fixture-showme-body.md`
exit 1 — `sections: 0/2 answered`, `missing-section: Upstream`,
`missing-section: Verified` (recorded in both `.txt` files; the second one
adds the contract pointers this PR introduces).

Green: `python3 scripts/pr-evidence-gate.py <this PR's body file>` exit 0 —
recorded in `gate-six-section-green.txt` after the branch (and the
SHA-pinned diagram URL it embeds) was pushed, so the gate's HTTP probes
answered 200 against the real remote.

The gate-logic delta (option 2 on the ticket) is the only difference
between the two red recordings: the verdict logic, exit codes, and
section names are untouched — `git show HEAD:scripts/pr-evidence-gate.py`
produced the old-gate recording, the working tree produced the new one.
