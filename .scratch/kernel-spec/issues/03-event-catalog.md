Type: grilling
Status: resolved
Assignee: xiechimon

# Kernel Event catalog


## Question

What is the closed set of Event kinds on an Issue timeline, and what payload does each kind carry?

Locked already: the timeline is Events; Comment is one kind; agent stdout summaries become Comments; DiffReady is an Event; StatusChanged is an Event.

This ticket names every kind the kernel will persist. No open-ended "log line" type. Each kind must be enough for a later Agent to read the Issue and know what happened without scraping prose.

Run names are locked in [Run lifecycle and Issue status](02-run-lifecycle.md): `running` `succeeded` `failed` `cancelled`. A Blocked Event is required: on Run `succeeded` it is the only signal that Issue Status becomes `blocked` instead of `in_review`.

## Answer

Closed set, six kinds. No open-ended log-line type.

**Envelope** (every Event): `id` (monotonic integer, the ordering key; `at` is display only), `at`, `issue_id`, `kind`, `actor` (`operator` | `agent` | `kernel`), `run_id` (set when the Event belongs to a Run; null for Operator Comments and idle Status drags). Append-only: never edited, never deleted. `kernel` is a writer role, not a glossary teammate.

**Writers**: RunStarted, RunEnded, DiffReady, StatusChanged are kernel-only. Agent writes only Comment and Blocked. Operator writes only Comment and (when idle) StatusChanged. The kernel also writes Comment in exactly one scenario: crash reconciliation after a restart ([Kernel logging and crash recovery](12-logging-crash-recovery.md)), `actor=kernel`. *(Revised by ticket 12; original answer allowed kernel no Comment.)*

**Payloads**:

- `Comment`: `{ text }`. Author is the envelope `actor`. Sources: Agent explicit mid-Run; Operator; kernel fallback at Run end (auto-summary of `result.result` text, recorded `actor=agent`, only when the Agent wrote no closing Comment).
- `RunStarted`: `{ agent_id, workdir }`, `run_id` set. Written at spawn.
- `RunEnded`: `{ outcome: succeeded | failed | cancelled }`. Written when the process ends. Exit detail may also be a Comment; outcome itself is never prose.
- `DiffReady`: `{ diff_id }`, pointer to the frozen Diff row on that Run. No diff text in the Event. Emitted only when a Diff row was stored (empty-tree and non-git cases are [Diff capture without a git repo](05-diff-without-git.md)).
- `Blocked`: `{ reason }` string, required — a Comment alone never blocks. `run_id` required, `actor=agent`. At most one per Run; the kernel reads it at Run end and ignores further Blocked Events from the same Run (the Agent may still Comment). Operator idle-drag to `blocked` is StatusChanged only.
- `StatusChanged`: `{ from, to }`. Kernel writes automatic transitions; Operator writes idle drags. No no-op events (`in_progress` → `in_progress` is not recorded).

**Run-end order** (UI may rely on it): freeze Diff → `DiffReady` → `RunEnded` → automatic `StatusChanged` last.

**Agent channel**: a Pacman-hosted MCP server, passed at spawn via `--mcp-config`, exposing `pacman_report_blocked(reason)` and `pacman_comment(text)`. Bound to `127.0.0.1`, per-Run token so one Run cannot write another's timeline. No stdout marker parsing. Transport, token lifecycle, and MCP server form hang on [Kernel process stack](07-process-stack.md) and stay in the map's fog.

**Comment length**: no hard cap. Operator/Agent explicit Comments stored verbatim; the kernel fallback summary truncates at 64KB with a truncation note.
