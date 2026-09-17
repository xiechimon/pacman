Type: grilling
Status: resolved
Assignee: xiechimon

# Issue fields


## Question

Which fields does an Issue persist besides title, body, assignee, status, and workdir?

Locked already: those five; one Workspace; workdir is an absolute path.

Still open:

- Identifier: UUID vs short slug vs integer. What the Operator sees on the card.
- Board order: created-at, or Operator-manual position per column.
- Priority, labels, due date: kernel or out of scope.
- Assignee: required to exist as a card, or null = unassigned `todo` with no Run.
- workdir required at create, or required only at assign.
- Timestamps: created, updated, last Run.

## Answer

The Issue persists exactly the five locked fields (title, body, assignee, status, workdir) plus identifier and two timestamps. Nothing else.

**Identifier**: autoincrement integer, unique across the one Workspace. UI shows and references `#N`. Storage-level role (primary key) is [SQLite schema](11-sqlite-schema.md)'s business.

**Board order**: no manual ordering, no position field. Within a column, sort by `updated_at` descending — recently touched cards float, zero new machinery. Cross-column drag remains the idle Status change ([Run lifecycle and Issue status](02-run-lifecycle.md)). Manual per-column position is out of scope.

**Priority / labels / due date**: all out of scope. The five-field set is closed; the kernel adds no decoration fields.

**Assignee semantics**: nullable. An unassigned `todo` card is a legal resting state with no Run. Three distinct moves:

- **Assign** (null → Agent, or Agent → different Agent): a Run-start attempt, subject to every lifecycle gate (refused while any Run is `running`, or the Issue is `done`/`cancelled`).
- **Unassign** (Agent → null): plain field clear, idle only, starts no Run, emits no Event (the closed catalog has no AssigneeChanged, [Kernel Event catalog](03-event-catalog.md)).
- While a Run is `running`, assignee is frozen (locked).

**workdir**: optional at create, required at Run start. A resting card may lack one. Assign/Retry without a workdir → start refused, error lands on the timeline (same treatment as a non-git workdir, [Diff capture without a git repo](05-diff-without-git.md)). Editing validates lightly (absolute-path form); existence and git-repo checks happen at Run start. Editable while idle, frozen while `running` (locked).

**Timestamps and text constraints**: `created_at` + `updated_at` only; any field change refreshes `updated_at`. No denormalized last-Run column — query the Run table. `title` required non-empty, `body` optional; both stored as plain text. Rendering (markdown or not) is visual layer, out of scope.
