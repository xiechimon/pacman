# #765 evidence — the e2e shards actually shard

Ticket: ci: e2e 的 `--shard` 从未生效 — https://github.com/xiechimon/pacman/issues/765

## Before the change — every shard ran the whole suite

run 37134551409 (throwaway branch, workflow identical to this PR's): all four e2e
jobs log `Running 688 tests using 2 workers`, and the single one-test probe spec
failed in all four shards — one test cannot land in two shards under a working
split.

Reproduced locally with CI's exact command form:

| command | output |
|---|---|
| `pnpm --filter @pacman/web e2e -- --shard=1/4 --list` | `Running 688 tests` |
| `pnpm --filter @pacman/web e2e --shard=1/4 --list` | `Total: 173 tests in 17 files` |

## After the change — the shards partition the suite

run 37135808110 (this PR), read from the job logs:

| job | log line |
|---|---|
| e2e (1) | `Running 174 tests using 2 workers, shard 1 of 4` |
| e2e (2) | `Running 178 tests using 2 workers, shard 2 of 4` |
| e2e (3) | `Running 164 tests using 2 workers, shard 3 of 4` |
| e2e (4) | `Running 172 tests using 2 workers, shard 4 of 4` |

174 + 178 + 164 + 172 = 688 = the full suite (`playwright test --list` →
`Total: 688 tests in 90 files`), with no overlap. The `shard N of 4` suffix in
that log line only appears once playwright parses the flag.

Judgement rule kept for future edits to this step: the per-shard
`Running N tests` values must sum to the full suite without overlap.