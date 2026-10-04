# #759 verification record — attachment retention and GC sweep

No UI surface in this change (background sweep + grant admission), so there
are no screenshots. Evidence is execution-based: new vitest suites written
before the implementation (red: missing module), green after, plus the three
repo gates.

## What was exercised

Server (`apps/server/test/attachment-gc.test.ts`, 13 tests):

- orphan ready attachment past grace → file + row reaped, stats counted
- grace-period ready attachment → kept
- referenced attachments kept across all five surfaces: `todo.spec`,
  `message.content`, `chief_message.content`, `steer_pending.content`,
  `plan.content` (incl. inline non-whole-line tokens counting as references)
- `deleteTodo` leaves attachments alone (R1); the orphan is reaped by the
  next sweep; still-referenced-elsewhere attachments survive task deletion
- stale `pending` rows reaped, fresh `pending` rows kept
- team quota full → `POST /api/uploads/grant` returns 400 `quota exceeded`
- scheduler: first tick sweeps, ticks within the hour skip, ticks past the
  hour sweep again

Daemon (`apps/daemon/test/step-attachments-gc.test.ts`, 3 tests):

- step dirs older than 72h reaped (names returned), fresh dirs kept,
  missing root returns `[]` without throwing, loose files untouched

## Gate results (this worktree, 2026-10-04)

- `vitest run test/attachment-gc.test.ts test/attachments.test.ts`
  → 2 files, 40 tests passed (see `vitest-server.log`)
- `vitest run test/step-attachments-gc.test.ts test/machine-loop.test.ts`
  → 2 files, 27 tests passed (see `vitest-daemon.log`)
- `pnpm -r typecheck` → clean
- `pnpm lint` → clean (rc=0)
- no migration (no schema change); `pnpm-lock.yaml` untouched

## Observability (log lines this change emits)

- server, every sweep (even when idle, proving the sweeper is alive):

  `attachment gc: <pending> pending, <orphan> orphan, <bytes> bytes reclaimed`

  plus one debug line per reaped file and an info line on unlink failure.
- daemon, only when work was done (same shape as the orphan-worktree sweep):

  `step-attachments recycled: <n> (<stepIds>)`

## Strategy document

Product rulings and numbers live in `docs/spec/20-附件回收策略.md`
(R1 no cascade on task delete; R2 three-state handling; R3 scratch TTL;
R4 quota at admission; PENDING 24h / ORPHAN 7d / QUOTA 1GiB / SWEEP 1h /
STEP 72h, each with its reason).
