## Summary of changes

Widens the evidence gate link rules and adds the two answer-checked
sections to the PR template.

## Verification

- [x] `pnpm lint` and `pnpm typecheck` pass
- [x] fixture replay green: docs/verify/939/

## Upstream equivalent

No equivalent exists: pi has no PR-body surface and claude-agent-sdk
none either; this extends the repo's own scripts/pr-evidence-gate.py
rather than adding a parallel implementation.

## Failure-path evidence

fixture-user-attachments-bare.md asserts not-embedded on a link the old
gate never scanned (old run: scanned 0, GREEN).

## Related issues

Closes #1
