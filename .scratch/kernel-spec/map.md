# Pacman kernel spec

## Destination

A `SPEC.md` at the root of `/Users/xmon/Code/AgentProjects/pacman` that a later session can implement without re-deciding the kernel: TypeScript, local-first, one Operator, one machine. The Operator assigns Issues to named Agents; Agents run Claude Code in the Issue workdir; Runs report through an Event timeline; a Diff is stored on the Run; only the Operator marks `done`.

Published: the spec shipped as GitHub issue [Pacman kernel #5](https://github.com/xiechimon/pacman/issues/5) (label `ready-for-agent`) instead of a root `SPEC.md`; the issue body supersedes the planned file.

## Notes

- Product and git repo: **pacman** (`/Users/xmon/Code/AgentProjects/pacman`). Empty tree except leftover Craft Agent `.gitignore` / `.env.example`; those are not kernel.
- Inspiration only: `/Users/xmon/Code/AgentProjects/multica` and https://github.com/multica-ai/multica. New names, new store, no official API or daemon protocol.
- Tracker: local-markdown under `.scratch/kernel-spec/`. Refer to tickets by title, not bare numbers.
- Skills every session should consult: `grilling`, `domain-modeling`, `research`. Keep `CONTEXT.md` as the glossary; do not put implementation in it.
- Plan, don't build. This map ends at `SPEC.md`, not at running code.
- Locked before tickets existed (do not re-grill unless the destination is redrawn):
  - Spec handoff, not an in-map MVP build.
  - Inspiration subset, not a fork and not protocol-compatible.
  - Single Operator, single machine, offline assign + history still work.
  - Kernel only: board + Issue + Agent + Run + Comment/progress. No mobile, desktop, billing, cloud runtime, IM, squads, skills.
  - One Node/Bun process: localhost web, API, SQLite, spawn Claude Code.
  - One Workspace. Issue carries `workdir`.
  - Issue ≠ Run. Many Runs per Issue.
  - Named Agent, Claude Code only, no Runtime entity.
  - Assign starts a Run. Comments do not start a Run. Retry is explicit.
  - Statuses: `todo` `in_progress` `in_review` `blocked` `done` `cancelled`.
  - One SQLite file. No Postgres. Workdir git stays git.
  - Global concurrency: one Run.
  - Timeline is Events. Comment is one Event kind.
  - No login. Bind `127.0.0.1`.
  - In-place edit in workdir. On Run end, capture `git diff`. No auto-commit, no auto-push.
  - Diff entity in SQLite on that Run, frozen.

## Decisions so far

- [Claude Code spawn contract](issues/01-claude-code-spawn-contract.md): PATH `claude`, cwd=workdir, `claude -p --output-format stream-json --verbose --permission-mode <mode>`; persist `session_id`; SIGTERM to cancel. Full cite in research note.
- [SQLite library for a single process](issues/06-sqlite-library.md): `better-sqlite3` + Drizzle; SQL migrations at process start. Node-first; Bun later swaps constructor only. Full cite in research note.
- [Run lifecycle and Issue status](issues/02-run-lifecycle.md): Run `running|succeeded|failed|cancelled` (no queue). Busy/`done`/`cancelled` start refused. Start → `in_progress`; success → `in_review` or `blocked` if Blocked Event; fail/cancel Run leaves `in_progress`. Freeze Status/assignee/workdir while running.
- [Kernel Event catalog](issues/03-event-catalog.md): six kinds — Comment, RunStarted, RunEnded, DiffReady, Blocked, StatusChanged. Envelope `id/at/issue_id/kind/actor(operator|agent|kernel)/run_id`, append-only. Agent writes Comment/Blocked via Pacman-hosted MCP tools (`--mcp-config`, per-Run token); kernel fallback summary at Run end; kernel Comment for crash reconciliation only (revision from [Kernel logging and crash recovery](issues/12-logging-crash-recovery.md)). Run-end order DiffReady → RunEnded → StatusChanged.
- [How Operator defines an Agent](issues/04-agent-record.md): record = `name` (required, unique ci, renamable) + optional `model` + optional `claudePath`; no extra argv, no persona. Binary auto-resolves PATH → login-shell → refuse Run; no model enumeration. No Agent limit; no first-run wizard. Edit frozen only while that Agent's Run runs; delete refused then; Run rows freeze agent name; deleted assignee → null, no Event.
- [Diff capture without a git repo](issues/05-diff-without-git.md): non-git workdir → Run start refused (Run `failed`). Baseline = `git stash create` sha when dirty else HEAD, stored on Run (`baseline_sha`/`baseline_kind`). End capture = `git diff <baseline>` + synthesized new-file diffs for untracked (no `add -N`). No `--binary`; verbatim storage, 10MB truncate + full `--stat`. Subdir workdir OK (toplevel recorded); nested repos are gitlinks, not descended. Empty diff stored, DiffReady still emitted.
- [Kernel process stack](issues/07-process-stack.md): Node 22+; Hono (`@hono/node-server`) serves API + Vite-built React SPA; MCP = TS SDK Streamable HTTP mounted at `/mcp`, per-Run token in temp `--mcp-config`; live updates = SSE keyed by Event id; port 4747 (`PACMAN_PORT`, busy → exit, bind = single instance); `npm run pacman` / global `pacman` bin; SQLite at `~/Library/Application Support/pacman/pacman.sqlite` (`PACMAN_DATA_DIR`); Run spawn uses absolute binary + login-shell PATH in `cmd.env`.
- [Kernel screens](issues/08-kernel-screens.md): exactly three screens — Board, Issue, Agents; no Settings, fourth screen refused. Issue create = modal on Board. Running Run = ephemeral stdout tail over SSE (never persisted; Event catalog stays closed) + board spinner. Issue page = timeline + Run list + selected Run's frozen Diff. Six Status columns, horizontal scroll. Empty states link Agents/create; claude-missing shows as per-Agent resolution dot on Agents screen.
- [Issue fields](issues/09-issue-fields.md): five locked fields only + autoincrement integer id (`#N`) + `created_at`/`updated_at`. No priority/labels/due date/manual board position — out of scope. Column sort = `updated_at` desc. Assignee nullable; assign = Run-start attempt, unassign = idle-only plain clear, no Event. workdir optional at create, required (and validated: exists + git) at Run start. title required, body optional, plain text.
- [Run prompt contents](issues/10-run-prompt.md): whole prompt over stdin, argv flags only. `--permission-mode bypassPermissions --disallowedTools AskUserQuestion`. Fresh context every Run; `session_id` persisted but never `--resume`d. Five fixed sections: Issue #N+title+body, standing instruction, MCP tools, Retry history digest (outcome/summary/Blocked/`--stat` per prior Run), previous Diff inline ≤50KB else `--stat`. Standing instruction: kernel-fixed text, five rules (in-place workdir, no commit/push/history rewrite, stop and let kernel set `in_review`, blocked → `pacman_report_blocked`, progress → `pacman_comment`). Nothing written into workdir; `--mcp-config` temp file in OS temp only.
- [SQLite schema](issues/11-sqlite-schema.md): five tables — issue, agent, run, event, diff; no workspace table, no UUIDs, no FK on assignee/agent (deletable Agents, readable history). Integer epoch ms everywhere; Event payload = one JSON TEXT column, kind/actor CHECKed enums; append-only by convention, no triggers. Indexes: `event(issue_id,id)`, partial unique `run(state) WHERE running` (DB-level one-Run lock), `issue(status,updated_at DESC)`, `UNIQUE(lower(agent.name))`, `UNIQUE(diff.run_id)`. Run row carries frozen `agent_name`, `session_id`, `baseline_sha/kind`, `pid`.
- [Kernel logging and crash recovery](issues/12-logging-crash-recovery.md): logs tee to `PACMAN_DATA_DIR/logs/pacman.log` (5MB×3 rotation) + stdout on TTY; ops only, never payload text. Boot reconciliation: `running` rows → `kill -0 pid`; dead → Run `failed` + `RunEnded`, no Diff, one kernel Comment explains (revised the Event-catalog writer table: kernel may Comment, reconciliation only); alive → SIGTERM group/SIGKILL then `failed`. MCP tokens memory-only; `pacman-mcp-*` temp sweep at boot. No crash reports.

## Not yet specified

(empty — every remaining question is a live ticket)

## Out of scope

- Official Multica API, daemon wire protocol, or a fork inside `multica/`.
- Mobile, desktop, billing, cloud runtime, Slack/Lark/Telegram and other IM.
- Squads, skills, custom statuses, `backlog` column, multiple Workspaces.
- Login, LAN multi-user, second machine, daemon split.
- Concurrent Runs, git worktrees, auto-commit/push, 26 CLI adapters.
- File-tree snapshot capture for non-git workdirs ([Diff capture without a git repo](issues/05-diff-without-git.md) settled on refusing the Run; the kernel diff contract is git-only).
- Issue priority, labels, due dates, and manual per-column board position ([Issue fields](issues/09-issue-fields.md) kept the five-field set closed).
