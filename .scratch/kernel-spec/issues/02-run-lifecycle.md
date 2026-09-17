Type: grilling
Status: resolved
Assignee: xiechimon

# Run lifecycle and Issue status


## Question

What states does a Run have, and which Issue Status changes happen automatically?

Locked already: assign starts a Run; comments do not; Retry is explicit; global concurrency is one Run; Agent may push the Issue as far as `in_review`; only Operator marks `done`; statuses are `todo` `in_progress` `in_review` `blocked` `done` `cancelled`.

Still open:

- Run state set (candidate: `queued` | `running` | `succeeded` | `failed` | `cancelled`).
- Assign while another Run is `running` or `queued`: this Run waits, or assign is refused.
- Assign an Issue that is `done` or `cancelled`.
- Automatic Issue Status on Run start (`todo` → `in_progress`?).
- Automatic Issue Status on Run success (`in_progress` → `in_review`?). Agent also writes a Comment and a Diff.
- Automatic Issue Status on Run failure: stay `in_progress`, or `blocked`.
- Operator Cancel of a running Run: Run `cancelled`, Issue Status?
- Retry: always a new Run on the same Issue; from which Issue Statuses is Retry allowed.
- Operator moving a card by hand while a Run is `running`.

## Answer

Run states: `running` | `succeeded` | `failed` | `cancelled`. No `queued`.

Starting a Run is one kernel action (Issue + Agent). The UI may label it assign or Retry. It is allowed only when the Issue is `todo`, `in_progress`, `in_review`, or `blocked`, and no Run on the machine is `running`. It is refused (no Run row) when the Issue is `done` or `cancelled`, or when any Run is `running`.

On start, Issue Status becomes `in_progress` (no-op if already). While that Run is `running`, Status, assignee, and workdir are frozen. Title, body, and Comments may still change. Operator Cancel of the Run is allowed; it is a Run action, not a Status drag.

On Run end (Operator could not drag, so no overwrite race):

- `succeeded` and no Blocked Event → Issue `in_review`
- `succeeded` and a Blocked Event → Issue `blocked` (not `in_review`). The Run stays `succeeded`; the process did not fail.
- `failed` or `cancelled` → Issue stays `in_progress`

Cancel Run ≠ cancel Issue. Issue `done` and `cancelled` are idle Operator drags only. Idle, the Operator may drag any Status; `done` does not require a prior `succeeded` Run.

The Agent never changes Status while a Run is live. `blocked` is written only at Run end. A crashed process is Run `failed`, not Issue `blocked`.
