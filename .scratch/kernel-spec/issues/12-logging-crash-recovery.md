Type: grilling
Status: resolved
Assignee: xiechimon

# Kernel logging and crash recovery


## Question

Where do kernel logs go, and what happens to a `running` Run when the kernel process itself dies?

Locked already: one process, Node 22+, SQLite at `~/Library/Application Support/pacman/pacman.sqlite` ([Kernel process stack](07-process-stack.md)); Run states `running|succeeded|failed|cancelled` ([Run lifecycle and Issue status](02-run-lifecycle.md)); a crashed *Claude* process is Run `failed` — this ticket is about the *kernel* crashing.

Still open:

- Kernel log destination and level: stdout only (Operator terminal), or a rotating file under `PACMAN_DATA_DIR`? The process may be launched from a GUI.
- What the kernel logs at all: Run spawn/exit, MCP calls, SSE clients, git capture errors?
- Restart reconciliation: on boot, any Run row still `running` has no live process (port bind = single instance, so no second kernel). Mark it `failed`? Emit RunEnded + which Events? Issue Status consequences per the lifecycle rules.
- Orphaned Claude process: kernel died but the spawned process group may live. Kill on restart (how — stored pid?), or let it finish and discard its output?
- Per-Run token and `--mcp-config` temp file cleanup after a crash.
- Whether the SPEC needs any crash-report artifact at all, or `failed` + logs is enough for a single-Operator local tool.

## Answer

**Log destination**: always write `~/Library/Application Support/pacman/logs/pacman.log` (follows `PACMAN_DATA_DIR`); mirror to stdout when a TTY is present (GUI launches have none). Size rotation: 5MB × 3 files. Level `info` default, `PACMAN_LOG=debug` overrides. Human-readable lines `ts level msg` — no logging framework, no JSON lines, no new dependency.

**What is logged**: operations only — startup + migrations, port bind, Run spawn/exit (pid, exit code, duration), binary resolution results, git capture errors, MCP token validation failures, SSE connect/disconnect (debug). **Never payload text**: prompts, Comment bodies, Diff text, and stdout content stay out of logs; SQLite already holds them.

**Restart reconciliation**: boot sequence = migrate → scan `run` rows in `running` → `kill -0 pid`:

- Process dead → mark the Run `failed`, emit `RunEnded{failed}`, **no Diff capture** (death time unknown, workdir possibly half-written; no Diff beats a fake Diff). Issue stays `in_progress` per [Run lifecycle and Issue status](02-run-lifecycle.md). A crashed Run is `failed`, never `blocked` (locked).
- One kernel-written Comment lands on the timeline explaining the reconciliation ("kernel restarted, Run had no live process, marked failed") — this revised the writer table in [Kernel Event catalog](03-event-catalog.md): the kernel may write Comment, reconciliation only, `actor=kernel`.

**Orphaned Claude process**: `kill -0` alive → SIGTERM the process group, 5s grace, SIGKILL (same path as Operator Cancel), then Run `failed`. Never let it finish: its MCP token died with the old kernel, its SSE buffer is gone, its output has nowhere to go, and it would keep editing the workdir unseen.

**Tokens and temp files**: per-Run MCP tokens live in memory only, never persisted — a kernel crash destroys them all, which is the security property. `--mcp-config` temp files: deleted at Run end on the happy path; crash leftovers are swept at boot — every `pacman-mcp-*` file in the OS temp dir is deleted (the port-bind single-instance guarantee means no other kernel is using one).

**Crash reports**: none. Run `failed` + the log file is the whole incident record for a single-Operator local tool. No Sentry, no dump files, no error upload — offline is locked and there would be nowhere to send them.
