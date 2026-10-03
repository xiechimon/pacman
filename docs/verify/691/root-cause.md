# Root cause evidence — dev daemon death 2026-10-02 23:38:17 (#691)

All timestamps CST (+0800). Sources: t-0044 lane transcript (Claude session
JSONL on disk), pmset assertion log, the user's `pnpm dev` pane scrollback
(herdr pane w4N:pBV, recovered via `herdr pane read`), `~/.pacman/daemon.log`,
server DB (`~/.pacman/server/server.db`, read-only).

## Premise correction

- The "orphaned server pid 42928 (ppid=1)" named in the issue is an unrelated
  verify stack (its stdout/stderr go to `/private/tmp/xmon100/verify-run/server.log`),
  not part of the user's `pnpm dev` stack.
- The user's real stack (started 2026-10-02 22:32:27 on ttys002, herdr pane
  w4N:pBV) is still running: concurrently (pid 95608) alive with web and server
  children. Only the daemon child died — the parent never died, and the user
  did not Ctrl-C this run (the `^C … exited with code SIGINT` block earlier in
  the same scrollback is the user's own restart of the previous 19h54m stack).

## Death fingerprint (pane scrollback)

    [daemon] [ELIFECYCLE] Command failed.
    [daemon] Error: ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL
    [daemon]   × "pnpm recursive run" failed in …/apps/daemon
    [daemon] [ELIFECYCLE] Command failed with exit code 1.
    [daemon] pnpm dev:daemon exited with code 1

Sits between `[web] 11:15:49 PM` HMR lines and `1:32:12 AM` lines. Zero daemon
output at death: no `[machine] Shutting down…` (every graceful stop prints it
first — `machine-loop.ts` `stop()`), no stack trace, no node crash report in
`~/Library/Logs/DiagnosticReports/` that evening, no jetsam/memorystatus kill
record at the death second.

## Exact death second

The daemon spawns `caffeinate -i -w <daemon pid>` (`machine-loop.ts:184`), so
the power assertion dies with the daemon:

    2026-10-02 23:38:17 +0800 Assertions  PID 95821(caffeinate) ClientDied
    PreventUserIdleSystemSleep "caffeinate command-line tool"  01:05:45

Duration 01:05:45 back from 23:38:17 → started 22:32:32 = the dev daemon's own
start. The daemon node process died at exactly 23:38:17. (The "23:04" in the
issue was the last claimed step's heartbeat — step `xNQ8eG6uX5zIZhIEWSr_A`,
claimedAt = lastHeartbeatAt = 23:04:24, status `done` in the server DB. The
daemon then idled 34 more minutes before dying.)

## The killer — t-0044 lane transcript (15:38 UTC = 23:38 CST)

Lane `hp-pacman-t-0044-claude-code-host-spec-17-t4` (#647) was recycling its
verify stack (VERIFY_PORT 8795) and escalating cleanup of its own leftover
daemons (API keys redacted):

    15:37:43  DAEMON_PIDS=$(pgrep -f "pacman-647-daemon2"; ps aux |
              grep "tsx src/cli.ts start" …); … kill $pid …; node cleanup.mjs
    15:38:11  for pid in 84525 84485 60503 60495; do kill -9 $pid; done
              → tool result: remaining "cli.ts start" matches: 2
    15:38:17  ps aux | grep "cli.ts start" | awk '{print $2}' |
              while read pid; do kill -9 $pid 2>/dev/null; done
              → tool result (15:38:19): count: 0
    15:38:25  launch.mjs VERIFY_PORT=8795 … probe-claude-code-chief.mjs seed

The 2 remaining matches at 15:38:11 were the user's dev daemon chain:
`node …/tsx/dist/cli.mjs src/cli.ts start -f` plus its inner
`node --require …/preflight.cjs --import …/loader.mjs src/cli.ts start -f`.
`pnpm dev:daemon` runs the exact same command shape as verify daemons, so the
broad pattern matched it. Both processes were SIGKILLed at 15:38:17 UTC — the
same second pmset recorded the caffeinate death. The surviving pnpm layers
wrapped the signal death as `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL` / ELIFECYCLE
exit 1; concurrently (no `--kill-others`) kept web+server alive.

## Exit-code fingerprint cross-check

Controlled experiment on this machine (tsx 4.23.15): `tsx script.mjs` with
`kill -9` on the inner node child → tsx exits 137 (128+9). In the incident
both the tsx wrapper and the inner node matched the pattern and were killed
together, so no layer survived to forward a signal exit; the pnpm layers
produced the observed `ELIFECYCLE Command failed.` (signal-death form, no
code) followed by `Command failed with exit code 1`.

## Fix and its verification

cleanup.mjs now sweeps leftover daemons pinned on `cli.ts start` + this
stack's `--server http://127.0.0.1:<VERIFY_PORT>` (ports.json, VERIFY_PORT
fallback; refuses to sweep without a pin; node-interpreter and self/ancestor
guards; SIGTERM then SIGKILL escalation). Decoy test:
`sweep-test.txt` (same directory) — dev-shape decoy survives, pinned decoys
die (including a SIGTERM-ignoring one), another lane's daemon survives.
