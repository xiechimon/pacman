Type: grilling
Status: resolved
Assignee: xiechimon

# SQLite schema


## Question

What tables, columns, keys, and indexes does the kernel SQLite file have, and what does each entity's Drizzle schema look like?

Locked already: one SQLite file; `better-sqlite3` + Drizzle ([SQLite library for a single process](06-sqlite-library.md)); SQL migrations applied at process start; entities are Issue, Agent, Run, Event, Diff (one Workspace, implicit).

Settled inputs this ticket assembles, it decides nothing new unless a contradiction surfaces:

- Event: six kinds, envelope `id` (monotonic integer) / `at` / `issue_id` / `kind` / `actor` / `run_id` (nullable), append-only, per-kind payload ([Kernel Event catalog](03-event-catalog.md)).
- Run: states `running|succeeded|failed|cancelled`; frozen agent name; `baseline_sha` + `baseline_kind` (`head`|`stash`) ([Run lifecycle and Issue status](02-run-lifecycle.md), [Diff capture without a git repo](05-diff-without-git.md)).
- Diff: one per Run, frozen text, `truncated` flag, `--stat` summary, workdir-relative-to-toplevel path ([Diff capture without a git repo](05-diff-without-git.md)).
- Agent: `name` unique case-insensitive, optional `model`, optional `claudePath` ([How Operator defines an Agent](04-agent-record.md)).
- Issue: five locked fields plus autoincrement integer identifier (`#N` in UI), `created_at`/`updated_at`, nullable assignee, workdir optional at create ([Issue fields](09-issue-fields.md)).

Still open here:

- Payload storage shape: typed column per kind vs one JSON column.
- Id strategy per table (integer rowid vs UUID) and what the UI shows.
- Indexes the board and timeline queries need (Events by issue ordered by id; the single-running-Run check).
- Append-only enforcement: triggers, or convention in the kernel code.
- `at` storage format (integer epoch ms vs text ISO).
- Schema for Run's frozen agent name and session_id (from [Claude Code spawn contract](01-claude-code-spawn-contract.md)).

## Answer

Five tables, no more: `issue`, `agent`, `run`, `event`, `diff`. No `workspace` table — the single Workspace stays implicit (locked). Booleans are integer 0/1. Migrations: `drizzle-kit generate` SQL applied at process start ([SQLite library for a single process](06-sqlite-library.md)). Later tickets may add columns via migration; nothing here blocks that.

**Ids**: every table uses autoincrement integer ids (rowid alias). Zero UUIDs anywhere — one machine, one file, no merge story. Issue id renders as `#N` ([Issue fields](09-issue-fields.md)); Event id is the monotonic timeline key and SSE `Last-Event-ID`.

**Timestamps**: all `*_at` columns are integer epoch milliseconds. ISO display is derived in the UI.

**Event payload**: one TEXT column holding JSON. `kind`, `actor`, `issue_id`, `run_id` are real columns (they get queried); the heterogeneous per-kind payload does not. Type safety lives in kernel TypeScript as a discriminated union; the DB only CHECKs the enums.

**Append-only**: convention, no triggers. Single process, single writer — the kernel is the only write path; `SPEC.md` states the event table takes no UPDATE/DELETE. Triggers would add migration noise with no adversary to stop.

**Table shapes**:

- `issue`: `id`, `title` (required non-empty), `body` (nullable), `status` TEXT CHECK (`todo|in_progress|in_review|blocked|done|cancelled`), `assignee_id` INTEGER nullable (no FK — Agent deletion must not cascade into Issues, [How Operator defines an Agent](04-agent-record.md)), `workdir` TEXT nullable, `created_at`, `updated_at`.
- `agent`: `id`, `name` TEXT, `model` TEXT nullable, `claude_path` TEXT nullable, `created_at`.
- `run`: `id`, `issue_id` INTEGER (FK issue), `agent_id` INTEGER, `agent_name` TEXT (frozen at start; no FK — Agents are deletable, history stays readable), `state` TEXT CHECK (`running|succeeded|failed|cancelled`), `session_id` TEXT nullable (persisted, unconsumed — [Run prompt contents](10-run-prompt.md)), `baseline_sha` TEXT, `baseline_kind` TEXT CHECK (`head|stash`), `pid` INTEGER (reserved for orphan handling, [Kernel logging and crash recovery](12-logging-crash-recovery.md)), `started_at`, `ended_at` INTEGER nullable.
- `event`: `id`, `issue_id` INTEGER (FK issue), `run_id` INTEGER nullable (no FK needed for query patterns; kernel writes both), `kind` TEXT CHECK (`comment|run_started|run_ended|diff_ready|blocked|status_changed`), `actor` TEXT CHECK (`operator|agent|kernel`), `payload` TEXT (JSON), `at`.
- `diff`: `id`, `run_id` INTEGER (FK run), `text` TEXT, `truncated` INTEGER 0/1, `stat` TEXT, `workdir_relpath` TEXT (workdir relative to repo toplevel, empty when equal), `created_at`.

**Indexes and constraints**:

- `event (issue_id, id)` — timeline reads and SSE resume.
- Partial unique index on `run`: `UNIQUE(state) WHERE state='running'` — the global one-Run lock enforced at DB level; a racing start hits the constraint.
- `issue (status, updated_at DESC)` — board columns.
- `agent`: `UNIQUE(lower(name))` — case-insensitive name uniqueness.
- `diff`: `UNIQUE(run_id)` — one Diff per Run.
