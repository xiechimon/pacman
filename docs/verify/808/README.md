# #808 verify: review verdict tolerates string line numbers + per-finding degradation

## Problem

A reviewer model wrote every finding's `line` as a string (`"line": "1"`,
7/7 in the #709 transcript). `reviewVerdictSchema` validated `line` strictly
as a number, so all 7 `findings.N.line` issues failed at once and the whole
verdict fell back to "判定提取失败" with `findings=[]` — a real AI review
with 1 blocking finding looked like "no review" to the phase machine, and the
blocking auto-rework loop never triggered.

## Change

- `packages/shared/src/records/review.ts`: `line` is now
  `z.coerce.number().int().positive().optional()` (int/positive semantics
  kept); the output-contract example shows a numeric `"line": 42` plus an
  explicit "digits, not strings" note.
- `apps/daemon/src/review-findings.ts`: `extractReviewVerdict` degrades
  per finding when strict validation fails but the payload has a string
  `conclusion` plus a `findings` array — usable findings are kept, broken
  ones are dropped, and the drop detail (index/id + first zod issue) is
  annotated into `conclusion`. Precedence: strict-valid (newest first) >
  degraded (newest degradable) > failed. Zero usable findings, a missing
  conclusion, or a non-array `findings` still fail, so a fully broken
  verdict can never silently collapse into the "no findings = pass" shape.
- One deliberate deviation from the ticket's suggested direction: the drop
  note goes into `conclusion`, not `extractionError`. The web renders any
  `extractionError` as a "判定提取失败" header, which would mislabel a good
  verdict, and the done-body wire contract treats the two keys as mutually
  exclusive. No wire/schema-surface change was needed.

## Evidence

New unit tests in `apps/daemon/test/review-findings.test.ts` (#808 失败方式
5/6/7/8 + 8 续), replayed against both trees:

- Before (`origin/main` disposable worktree, new tests copied over):
  3 failed / 19 passed. The 3 failures are exactly the bug —
  "7 findings 全 line-字符串 → 整单保留", "部分 finding 坏 → 好条目保留",
  and "新消息可降级 → 降级转正" all returned `failed` on old code.
  ("findings 全坏 → failed" and the precedence test pass on old code too —
  that behavior is preserved, not changed.)
- After (this branch): 22/22 pass, including all 17 pre-existing #700 tests.

Related suites green on this branch:

- `packages/shared`: `snapshot.test.ts` + `records.test.ts` +
  `review-prompt.test.ts` — 134 passed, no snapshot update needed
  (`z.coerce.number()` is JSON-schema-transparent).
- `apps/server` `test/review.test.ts` — 17 passed (blocking rework loop +
  both fallback states unchanged).
- `pnpm lint` clean, `pnpm typecheck` clean (all packages).

## Acceptance mapping

- String-line verdict extracts normally, blocking triggers rework:
  covered by 失败方式 5 (`hasBlockingFinding === true` on the 7-string-line
  payload); the server-side rework path itself is unchanged (server
  `review.test.ts` blocking case still green).
- Fully broken input still lands on extraction failure: 失败方式 7.
