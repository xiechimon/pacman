# #684 verify evidence — chief turn invisible when no machine ever claims it

## Incident (before, user's live stack, 2026-10-03)

Forensics from the real stack (main checkout `pnpm dev`, HEAD = 3a24736a = main):

- `before-incident/daemon-log-death-excerpt.txt` — the daemon process died
  between 10-02 23:04 and 10-03 01:32 with no `[machine] Shutting down…` line
  (not a graceful stop). The concurrently pane kept web+server alive; only the
  daemon child died — and `apps/daemon`'s dev script (`tsx src/cli.ts start -f`)
  has no watch and no supervisor, so it stayed dead.
- `before-incident/db-steps-pending.txt` — the chief steps sent at 01:32 and
  12:18/12:26 are still `pending`, `machineId=null`, never claimed. The 23:03
  steps (daemon still alive) are `done` for contrast.
- `before-incident/db-threads-stuck.txt` — those threads still carry
  `activeRun={"phase":"chief"}`: the drawer shows a turn "in flight" forever.
- `before-incident/db-machine-offline.txt` — the server knew: `machine.online=0`
  (wake SSE disconnect marks offline), but nothing consumed that fact.
- `before-incident/concurrently-children.txt` — only web+server children of the
  concurrently process remain.

Zero feedback: no reply, no toast, no in-thread failure line — the #631 chain
only covers the `done(failed)` path, and a never-claimed step never fails.

## After (fix, isolated verify stack 8795/5277, fresh DB)

Probe: `.claude/verify-shots/drive-chief-abandoned.mjs` — real user path:
chief FAB → drawer → send a message with zero machines enrolled (the exact
incident shape, model bound to `relay-186/deepseek-v4.1-flash[1M]`).

- `01-drawer-typed.png` / `02-sent-pending.png` — user row lands instantly, turn
  hangs "in flight" (steer placeholder) — the before-behavior up to this point
  is identical: this is where the old code went silent forever.
- `03-toast.png` — 127s after send (120s threshold + 15s scheduler tick) the
  sonner toast fires over the conversation stream `message` event (#631 chain).
- `04-failure-line.png` — the persistent in-thread failure line
  (`.chief-error[role=alert]`): `本轮无人认领：团队当前没有在线机器（等待
  120 秒超时）。请确认执行机 daemon 在线后重发。`
- `05-turn-closed.png` — the turn closes: composer placeholder returns to the
  idle canon (`chiefThreads` invalidation via the conversation `step` event —
  without it the placeholder kept claiming "steer while it runs").
- `db-step.txt` / `db-chief-thread.txt` / `db-machine.txt` / `db-chief-message.txt`
  — SQLite truth: step `failed`, `activeRun` cleared, machine offline, and the
  `chief-err-<stepId>` system row (kind `chief_turn_error`).
- `api-messages.json` — the failure row is visible over the public messages API.
- `result.json` — 8/8 checks PASS.

## Verdict

The "failure must be visible" bottom line now holds for the never-claimed path:
any chief turn whose machine disappears (pending unclaimed with zero online
machines, or claimed with a stale heartbeat while offline) lands in the existing
#631 failure surface within ~2.5 minutes instead of hanging silently forever.

Not covered here (filed in the issue): worker/build steps stuck the same way
(#682 family), a failure notification when the drawer is closed (#638), and the
daemon dev script having no self-restart.
