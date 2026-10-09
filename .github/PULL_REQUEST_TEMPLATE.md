## What

<!-- What this PR does and why, plus the ticket it answers. This
section must embed one explanatory diagram -- not a screenshot, but
what the change does (structure, flow, call tree, state machine;
before/after is best). The format is specified, not a suggestion:
.drawio.svg, draw.io's editable SVG export:

  drawio -x -f svg -e --embed-svg-images -o name.drawio.svg name.drawio

Before committing the diagram, run the text-fit gate over it -- a label that spills out of its shape fails the check (#1087): python3 scripts/check-diagram-text-fit.py 'docs/verify/**/*.drawio.svg'

GitHub renders it as an inline SVG, draw.io reopens it for edits, and
the pr-evidence gate probes it like any embedded image. Commit it
under docs/verify/<ticket>/ and embed it here as ![label](raw-url).
The gate checks that an image link is embedded and reachable; whether
it explains the change is the reviewer's call. -->

## Verified

<!-- Required; the pr-evidence CI gate checks that this section carries
answer text (HTML comments do not count as an answer, so deleting or
keeping only this comment fails the build). The gate checks that you
answered, not how well; the reviewer judges the answer.
Both halves, pasted, not narrated: the command run on the old code
(the actual failing output, or an --expect=old leg) and the same
command on this change (the passing output; for code changes this is
where pnpm lint / typecheck / relevant e2e results go). A claim that
"without this change X would fail" is not evidence. -->

## Upstream

<!-- Required; the pr-evidence CI gate checks that this section carries
answer text (HTML comments do not count as an answer, so deleting or
keeping only this comment fails the build). The gate checks that you
answered, not how well; the reviewer judges the answer.
If this PR adds a mechanism: does an equivalent exist in the current
dependencies (pi / claude-agent-sdk / code already in this repo)? If an
equivalent was rejected, give the checkable reason (security boundary,
different data source, different interaction semantics); "more
controllable" or "fits our model better" do not qualify. If the PR adds
no mechanism, say so in one line. -->

## Risk

<!-- One-way or two-way door? Blast radius: what else this change can
touch, and what was run to rule that out (name the runs). -->

## Acceptance

<!-- Conditional. If the ticket carries an acceptance checklist,
reconcile it item by item, each item pointing at its evidence. If the
ticket has no checklist, write exactly that in one line. Not
gate-checked: whether a ticket has acceptance items is a property of
the ticket, and a hard check here would force performative paragraphs. -->

## Issues

Closes #N
