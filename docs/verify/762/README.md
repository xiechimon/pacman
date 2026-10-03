# #762 evidence — `e2e-gate` failure and success paths

Ticket: ci: e2e 合并闸从未生效 — https://github.com/xiechimon/pacman/issues/762

## What was verified

`.github/workflows/ci.yml` `e2e-gate`: `if: always()` plus an explicit
`needs.e2e.result` judgement. Every row below is a real GitHub-hosted run read
from the jobs API — not inferred from the workflow source, which is how the hole
was missed the first time.

## Before the change — a failing shard reported `skipped`

`e2e-gate` was `needs: e2e` with `run: exit 0`, so a failing shard skipped the
job outright, and branch protection counts `skipped` alongside `successful` and
`neutral` as passing (about-protected-branches, "Require status checks before
merging").

| run | branch | e2e shards | e2e-gate |
|---|---|---|---|
| 37130371196 | hp/pacman/t-0053-b-656-catb-pr | e2e (3)=failure, rest success | `skipped` |
| 37128928219 | hp/pacman/t-0053-b-656-catb-pr | e2e (3)=failure, e2e (4)=failure | `skipped` |
| 37125498051 | hp/pacman/t-0086-728-claude-code-detail-composer-blocking | e2e (3)=failure | `skipped` |

## After the change

| run | branch | e2e shards | e2e-gate |
|---|---|---|---|
| 37134551409 | probe/762-gate-failure-path | e2e (1..4)=failure | `failure` |
| 37135665650 | ci/e2e-merge-gate-762 (this PR) | e2e (1..4)=success | `success` |

The failure path was probed on a throwaway branch whose workflow is the one
proposed here, plus a single deliberately failing spec
(`apps/web/e2e/zz-gate-probe.spec.ts`), so the shard redness is real and the job
definition under test is unchanged. That branch's pull request (#763) was closed
unmerged.