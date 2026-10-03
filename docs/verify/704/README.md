# #704 delivery-surface verification evidence

Ticket: server: hosted repo for manual projects + agent PR backfill so the
review surfaces have truth (B-C1/B-C16) — https://github.com/xiechimon/pacman/issues/704

## What was verified (real closed loop, no GitHub OAuth connection anywhere)

Manual `owner/repo` project (`xiechimon/pacman-verify-704`, public scratch
repo), isolated verify stack (server 8791 / web 5273 / fresh PACMAN_HOME),
real daemon from this branch, real LLM agent (glm-5.3 over the user relay),
agent edited `VERIFY.md`, pushed the conv branch and opened PR #1 with the
machine's gh login — exactly the B-C16 shape from #519.

## delivery-loop/ (drive-704-delivery.mjs, 10/10 PASS)

| check | truth |
|---|---|
| api-build-pr-backfilled / api-build-pr-number | `GET /api/builds/{id}` → `prUrl=https://github.com/xiechimon/pacman-verify-704/pull/1`, `prNumber=1` |
| api-changes-nonempty | `GET /api/builds/{id}/changes` → `files=[VERIFY.md]` additions=1 (matches the daemon-side diff hunk) |
| db-build-pr-url / db-build-changes-files | SQLite `build` row: `prUrl` + `changes` column (parsed DocumentDiffFile[]) |
| ui-changes-file-row | detail page review-phase changes pane renders the real diff file row |
| ui-branch-pane-pr-slot | 「分支与 PR」pane PR slot = `#1` → `https://github.com/xiechimon/pacman-verify-704/pull/1` |
| ui-files-github-degradation | project page files tab states files live on GitHub (B-C1 honest degradation) |
| ui-files-github-link | outbound link `https://github.com/xiechimon/pacman-verify-704` |
| ui-files-no-404-noise | zero tree/file 404s after reload (console-spam gap closed) |

Screenshots: `11-todo-changes.png` (changes pane), `12-branch-pane-pr.png`
(branch-and-PR pane with the PR slot), `20-project-files-github.png` (files
tab degradation).

## daemon-log.txt

`pushed pacman/conv-…` + `pr probe: #1 for pacman/conv-…` — the daemon-side
read-only probe (gh ladder) found the agent-opened PR at step finalize and
reported it over the done channel.

## mea-anonymous-probe.txt

Read-only GitHub API probe from mea (self-hosted form, no connection): repo
metadata + pulls list reachable anonymously for public repos — the probe
ladder's anonymous rung. The user's own service units on mea were not
touched.

## scripts/ (reproduce)

```sh
# after verify-pacman launch (VERIFY_REPO_ROOT=this worktree)
node scripts/setup-704-seed.mjs          # manual github project + relay provider + agent + todo + machine enroll
# start the daemon from apps/daemon (proxy env unset, PACMAN_HOME scratch):
#   env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy -u all_proxy -u ALL_PROXY \
#     PACMAN_HOME=/tmp/pacman-704-daemon-home ./node_modules/.bin/tsx src/cli.ts start \
#     --foreground --server http://127.0.0.1:8791 --api-key <seed key> --team <seed team> --name verify-704-mbp
# start the build (POST /api/projects/{id}/builds, withPlan:false), wait for review phase, then:
node scripts/drive-704-delivery.mjs <todoId>
```

Also pinning the five ticket failure modes at unit level:
`apps/server/test/delivery-surface.test.ts` (6), `apps/daemon/test/runner-delivery.test.ts`
(6), `apps/daemon/test/github-probe.test.ts` (8).
