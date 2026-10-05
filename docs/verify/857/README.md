# docs/verify/857 — chief 抽屉流式闪清（#857）

Live probe on the isolation stack (server + vite dev, fresh DB, fake machine
over the real machine wire, zero mocks on the stream path): two streaming
rounds with a mid-turn toolcall upload between them, exactly the ticket's
sequence. Full recipe is reproducible from the committed unit/e2e tests plus
the REST sequence below.

## What was wrong

Every mid-turn `message` SSE event (toolcall row upload, final transcript
rows) synchronously cleared `liveTextStore`, while the `messages` refetch was
still in flight — the already-displayed round text vanished until the refetch
landed. One flash per round; only the final state survived.

Fix: `message` events now only record a handoff (assistant text rows); the
buffer is dropped when the consumer observes `messages` containing that row
(`liveTextStore.getVisible` + `prune`). Toolcall/user rows never hand off
(their prefix has no persisted row covering it yet). Terminal step states
still clear (hub mirror, bounds stale text).

## Stream event log (`stream-events.jsonl`)

The clearing event, nailed live (`t` = ms since claim):

- `t=1088 text_delta 第一轮…` → typing shows round 1
- `t=1418 message c-p857-r1 (toolcall)` → **this event cleared the buffer pre-fix**
- `t=2416 text_delta 第二轮…`, `t=2449 message c-p857-r2 (toolcall)`
- `t=3436 message p857-final` → handoff, converges to the persisted row
- `t=3442 step done` → terminal clear (no-op after convergence)

## Before / after (same probe, 150 ms DOM tail samples)

| run | stack | R1–R5 | round-1 text missing after first paint |
|---|---|---|---|
| before | origin/main one-off worktree | 2/5 (R1, R2, R5 FAIL) | 14 of 19 samples |
| after | this branch | 5/5 | 0 of 19 samples |

Before run: `before/before-result.json`, `before/before-tail-samples.jsonl`.
After run: `result.json` (5/5), `tail-samples.jsonl`, `final-drawer.png`.

## Flow GIF

`chief-857-flow.gif`: round-1 live → after mid-turn tool event (text kept) →
round-2 after tool event (both rounds kept) → converged final.

## Regression locks (in-repo)

- `apps/web/test/chief-stream-handoff.test.ts` — F-H1..H6 at the real
  `startConversationStream` + `liveTextStore` + `mapChief` seam (red pre-fix).
- `apps/web/e2e/chief-stream-markdown.spec.ts` — F-R16, same sequence through
  the real drawer DOM.
- Full gates: `pnpm -r typecheck` clean, `pnpm lint` clean on touched files,
  `e2e:affected` 784/784 green.
