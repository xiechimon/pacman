# Pacman

A single-operator, local-first board where named agents take Issues and run on this machine.

## Language

**Operator**:
The human at this machine. Anyone who can reach the localhost UI is the Operator. There is no login.
_Avoid_: User, member, account

**Workspace**:
The one board this app shows. Pacman has exactly one Workspace.
_Avoid_: tenant, organization, project (as a container for Issues)

**Issue**:
A card of intent on the Workspace: number, title, body, assignee, status, and workdir. An Issue is not an execution. The assignee may be null; the workdir may be missing until a Run starts.
_Avoid_: task, ticket (in product copy)

**Run**:
One attempt to execute an Issue on an Agent. An Issue may have many Runs.
_Avoid_: task (Multica's word), job, session (unless a Claude Code session id)

**Run state**:
One of `running`, `succeeded`, `failed`, `cancelled`. A Run is never queued.
_Avoid_: queued, job status, session status

**Agent**:
A named teammate bound to Claude Code on this machine: a unique name, an optional model, and an optional binary path. There is no Runtime entity and no per-Agent persona.
_Avoid_: runtime, bot, CLI (the CLI is what the Agent uses)

**Event**:
One append-only entry on an Issue timeline. Exactly six kinds: Comment, RunStarted, RunEnded, DiffReady, Blocked, and StatusChanged. Every Event carries an actor (`operator`, `agent`, or `kernel`) and, when it belongs to a Run, that Run's id.
_Avoid_: message, log line (as the timeline unit)

**RunEnded**:
The Event that records a Run's outcome (`succeeded`, `failed`, or `cancelled`) on the timeline, written by the kernel when the process ends.
_Avoid_: job result, exit log

**Blocked**:
An Event the Agent writes during a Run, carrying a `reason`: the work needs a decision from the Operator. At most one per Run; it is the only signal that makes a `succeeded` Run leave the Issue `blocked` instead of `in_review`.
_Avoid_: error, failure (a blocked Run is not a failed Run)

**Comment**:
An Event whose payload is human-readable text, written by the Operator, by the Agent during a Run, or by the kernel in the two cases it owns: a fallback summary of the Agent's final output when the Agent wrote no closing Comment, and a crash-reconciliation note after a restart.
_Avoid_: chat message, bubble

**Diff**:
The unified diff a Run produced, captured when the Run ends against the tree state at Run start (the Operator's uncommitted work is not blamed on the Agent), stored frozen on that Run. It does not change if the workdir changes later. Requires a git workdir; a Run in a non-git workdir never starts.
_Avoid_: patch file, live git status

**workdir**:
Absolute path on this machine where a Run process starts. Owned by the Issue.
_Avoid_: repo, project path, workspace folder

**Status**:
One of `todo`, `in_progress`, `in_review`, `blocked`, `done`, `cancelled`. An Agent may push an Issue as far as `in_review`. Only the Operator marks `done`. `blocked` is a decision the work needs from the Operator, not a dead process.
_Avoid_: column, category, custom status
