---
name: pr-pacman
description: Use when writing a PR body for this repo. Carries the pacman PR body contract (six sections from .github/PULL_REQUEST_TEMPLATE.md, checked by the pr-evidence CI gate) and replaces the global show-me template (Summary/Evidence/Merge Danger), which fails the gate here.
---

# pr-pacman — writing a PR body in pacman

The body is a hard contract, not a style suggestion: two CI gates check it
(`pr-evidence`, `diagram-text-fit`) and review checks the rest. The global
`pr` skill (Humanlayer show-me: `## Summary` / `## Evidence` / `## Merge
Danger`) does not pass this repo's gate — four lanes in one day each followed
it, failed, and hand-rewrote the body (#1100, #1103, #1105, #1111; issue
#1110). When writing a PR body in this repo, follow this skill; do not use
the global template even if it also matches.

## The six sections (exact headings)

### `## What`

What this PR does and why, plus the ticket it answers. Must embed one
explanatory diagram — structure, flow, call tree, state machine,
before/after is best — as a `.drawio.svg` (draw.io's editable SVG export),
never a screenshot:

```sh
drawio -x -f svg -e --embed-svg-images -o docs/verify/<ticket>/name.drawio.svg docs/verify/<ticket>/name.drawio
python3 scripts/check-diagram-text-fit.py 'docs/verify/**/*.drawio.svg'  # before committing the diagram
```

Commit the diagram under `docs/verify/<ticket>/` and embed it with a
SHA-pinned raw URL (the repo is public, raw is anonymously readable):

```markdown
![label](https://raw.githubusercontent.com/xiechimon/pacman/<sha>/docs/verify/<ticket>/name.drawio.svg)
```

The SHA must already be on the remote, so: commit and push the branch first,
then write the body. Headless `drawio -x` sometimes hangs; when it does, edit
the SVG's `rect`/`div` geometry directly (the file is small) and re-run the
text-fit gate. Exported labels must not sit next to CJK in source — keep
diagram labels plain and let the text-fit gate judge the fit.

### `## Verified`

Both halves pasted verbatim, not narrated: the command run on the old code
(its actual failing output) and the same command on this change (its passing
output — `pnpm lint` / `pnpm typecheck` / affected e2e results go here). A
claim that "without this change X would fail" is not evidence. HTML comments
do not count as an answer (the gate strips them).

### `## Upstream`

Does an equivalent exist in the current dependencies (pi / claude-agent-sdk /
code already in this repo)? If an equivalent was rejected, give the checkable
reason (security boundary, different data source, different interaction
semantics); "more controllable" or "fits our model better" do not qualify. If
the PR adds no mechanism, say so in one line. HTML comments do not count.

### `## Risk`

One-way or two-way door? Blast radius: what else this change can touch, and
which runs ruled that out (name the runs).

### `## Acceptance`

If the ticket carries an acceptance checklist, reconcile it item by item,
each item pointing at its evidence. If the ticket has no checklist, write
exactly that in one line.

### `## Issues`

`Closes #N`. The squash commit body is what actually closes the ticket —
carry the closing keyword in the branch commit message too (PR bodies do not
enter the squashed commit). If this PR is one segment of a multi-segment
ticket, state which segment closes the ticket and that the squash body must
not carry the closing keyword for the parent ticket.

## Mechanics

- Write the body to a temp file; never inline multi-line markdown as
  `--body`.
- Create from a worktree lane:
  `gh pr create --repo xiechimon/pacman --head xiechimon:<branch> --body-file /tmp/pr.md`.
- Run the gate locally before opening:
  `python3 scripts/pr-evidence-gate.py /tmp/pr.md` — exit 1 names each
  problem (`missing-section` / `empty-section` / `not-embedded` /
  `unreachable`).
- Editing an open PR: `gh pr edit` breaks on Projects-classic GraphQL
  errors; use `gh api -X PATCH repos/xiechimon/pacman/pulls/<n> -F
  body=@/tmp/pr.md`, then re-read with `gh pr view <n> --json body` and
  compare.
- Image links must be the embedded `![label](url)` form and must not sit
  inside fenced code blocks — a link in a fence renders nowhere.
- Bodies are in English.

## Gate facts — what is actually enforced

| requirement | enforced by |
|---|---|
| `## Verified`, `## Upstream` answered (non-empty after stripping comments) | pr-evidence (required check) |
| image links embedded + HTTP 200 | pr-evidence (required check) |
| diagram labels fit their shapes | diagram-text-fit (advisory) |
| `.drawio.svg` present in `## What` | review only — the gate passes a text-only body, do not rely on it |
