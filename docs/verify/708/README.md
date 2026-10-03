# #708 verify evidence — step failure root cause + bounded auto_retry + immediate config effect

Probe: `probe-error-lifecycle.mjs` (verify-pacman skill, full-stack: server + vite + real
daemon + pi + embedded byte-level mock gateway). 17/17 checks PASS (2026-10-03, worktree
lane `hp-pacman-t-0081-708-auto-retry-provider-b-c2`).

## Phase A — un-adaptable 400-with-body fails bounded, root cause surfaces

Mock returns 400 `{"error":{"message":{"text":"Model does not support this
protocol.","type":"server_error"}}}` on every call (SDK-visible equivalent of the #519
relay body; carries both the retryable wordlist hit and the #654 flip signature).

- Plan step failed in **28.8s** (old behavior: infinite same-shape retry until the 540s
  stream wall, `~40 sends/10min`, root cause covered by `stream timeout`).
- `build.errorMessage` = `400: {"message":{"text":"Model does not support this
  protocol.","type":"server_error"}}` — the real terminal error, not the timeout corpse.
- UI failure line (`.chat-para--fail`) carries the same text — `A-failure-line.png`.
- Requests capped at **exactly 8** = 2 sessions x (1 + RETRY_STORM_MAX). The field-shape
  trace `mct,mct,mct,mct,mt,mt,mt,mt` shows the #654 fallback pass in flight: first 4
  sends modern (`max_completion_tokens` + `store`), last 4 with the flipped compat
  (`max_tokens`, no `store`) — then the second storm trips and the step fails with the
  root cause.
- `daemon.log` has the full sequence: `error: 400 …`, `auto_retry_start attempt=1..3`,
  `protocol fallback: provider mock-gw-708 compat adapted …`, `step failed: 400 …`.

## Phase B — PATCH provider takes effect on new sessions without daemon restart

PATCH compat `{maxTokensField: max_tokens, supportsStore: false}` while the daemon stays
up; new conversation's requests show `max_tokens`, no `store`, no
`max_completion_tokens`; plan step succeeds to the confirm gate.

## Phase C — PATCH removal: learned compat does not flow back

PATCH compat back to `{supportsDeveloperRole: false}` (knobs removed); the daemon's
in-process learned flip is invalidated on the config change — requests revert to the
modern shape (`max_completion_tokens` + `store`) without a daemon restart, and the plan
step succeeds.

## Files

| file | what |
|---|---|
| `result.json` | 17 checks + stack coordinates + per-phase summaries |
| `mock-requests.jsonl` | byte-level request bodies, one line per request (phase/mode tagged) |
| `mock-requests-summary.json` | per-request discriminators (field presence) |
| `A-failure-line.png` | todo detail page failure line with the 400 root cause |
| `daemon.log` | daemon journal for the whole run |
