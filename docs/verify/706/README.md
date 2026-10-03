# docs/verify/706 — build-step liveness sweeper (#706, B-C7)

Live probe on an isolated verify stack (server 8791 + web 5273, fresh scratch
DB). All machine-side behavior over the real wire: enroll / presence / claim /
heartbeat / wake-SSE abort. Threshold is the production 120s + 15s scheduler tick.

## Result: 9/9 PASS (`result.json`)

| # | Scenario | Detection latency | Outcome |
|---|---|---|---|
| B | B-C7: claimed, zero heartbeat progress, machine online | 141s | step failed (`构建步领取后无进展…`), todo phase → failed |
| N | Same window: pending steps + machine online | — | stay pending; machine stays online |
| B | Todo phase flip | — | `failed` via API |
| A | Claimed + 1 heartbeat, then SSE abort (daemon death) | offline in 0s, failed in 130s | step failed (`执行机器失联…`) |
| A+ | Aged pending step once zero machines online | 0s (already aged) | step failed (`本轮无人认领…`) |

## Files

- `result.json` — checks, todos/builds/steps/machine rows (SQLite truth).
- `01-board-failed.png` — board: three failed cards with retry entries, nothing
  stuck "in progress".
- `02-detail-failure-line.png` — todo detail: `失败` phase chip + failure line
  carrying the sweeper's `build.errorMessage` + `重跑` entry.
- `probe-706.mjs` — the probe (usage: `node probe-706.mjs <out-dir>` against a
  running verify stack; provider/agent rows are seeded into the scratch DB via
  sqlite3 as setup scaffolding — the sweep path itself is all real HTTP).
- `shot-706.mjs` — screenshot helper
  (`node shot-706.mjs <out-dir> <todoA-id>`, run from repo root for module
  resolution).

## Unit layer

`apps/server/test/build-abandoned-sweep.test.ts`, 10 tests: the four ticket
failure modes (offline death, B-C7 online zero-progress, pending无人认领,
idempotency/chief-kind exclusion), three negatives (fresh heartbeat online and
offline, pending + online machine, online + stale-after-progress wedge),
scheduler-tick wiring, and the 120s threshold pin. Affected e2e
(`token-gate.spec.ts`, server surface): 4/4 green.
