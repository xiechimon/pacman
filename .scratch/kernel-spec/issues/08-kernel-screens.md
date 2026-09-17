Type: grilling
Status: resolved
Assignee: xiechimon

# Kernel screens


## Question

Which screens does the kernel UI have, and which does it refuse?

Candidate minimum:

- Board (columns = Status).
- Issue (timeline + assign + Retry + Cancel + Diff).
- Agents (list + create/edit).
- Nothing else.

Still open:

- Settings screen vs Agents-only.
- Creating an Issue: modal on the board vs a route.
- Whether the running Run's stdout streams on the Issue page, or only as Comments after chunks.
- Empty states: no Agent yet, no Issue yet, Claude binary missing.

Out of scope for this ticket: visual design. This is which surfaces exist so `SPEC.md` can name them.

## Answer

**Screen set**: exactly three — Board, Issue, Agents. No Settings screen: port and data dir are env vars (`PACMAN_PORT` / `PACMAN_DATA_DIR`, [Kernel process stack](07-process-stack.md)), and Agent configuration lives on the Agents screen. `SPEC.md` states the kernel refuses a fourth screen.

**Creating an Issue**: modal on the Board, not a route. The form is title / body / workdir (assignee optional at create, per [Issue fields](09-issue-fields.md) — still open there); too small to earn its own route.

**Running Run visibility**: two channels.

- Persistent: the Event timeline (RunStarted, Agent Comments via `pacman_comment`, kernel fallback summary at end).
- Ephemeral: the Issue page streams the running Run's stdout tail over SSE ephemeral frames — not Events, never persisted, lost on refresh, ring-buffered with a length cap. The six-kind Event catalog ([Kernel Event catalog](03-event-catalog.md)) stays closed. The board card shows only a running spinner, no stdout.

**Run history + Diff**: the Issue page holds the timeline plus a Run list (state, timestamps, frozen agent name). Selecting a Run shows its frozen Diff (from DiffReady). No separate Diffs screen.

**Board columns**: all six Statuses as columns, horizontal scroll. `done` / `cancelled` default to the most recent few with expand (exact count is implementation). In-column ordering belongs to [Issue fields](09-issue-fields.md), not here.

**Empty states + missing claude binary**:

- No Agent: Board empty state links to the Agents screen (no first-run wizard, per [How Operator defines an Agent](04-agent-record.md)).
- No Issue: Board empty state with the create-Issue action.
- Missing `claude`: the Agents screen shows a per-Agent resolution dot (resolved absolute path / not found), validated on screen load. No global banner; a refused Run start still lands on the timeline as the Run's failure.
