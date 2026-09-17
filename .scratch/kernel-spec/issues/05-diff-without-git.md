Type: grilling
Status: resolved
Assignee: xiechimon

# Diff capture without a git repo


## Question

What does Pacman store as a Diff when `Issue.workdir` is not a git repo, or is a git repo with a dirty tree at Run start?

Locked already: in-place edit; on Run end capture `git diff`; Diff entity frozen in SQLite on that Run; no auto-commit; no auto-push; global one Run.

Still open:

- workdir is not a git directory: refuse the Run, or snapshot files another way (candidate: no Diff, Comment only; or a file-tree snapshot).
- workdir is git but has uncommitted changes at Run start: diff against `HEAD`, against the index, or against a snapshot taken at Run start (so Operator dirt is not blamed on the Agent).
- Binary files and huge diffs: truncate in the Event, store full text, or omit.
- Nested git repos / workdir not the repo root.

## Answer

**Non-git workdir**: Run start refused. The Run ends `failed` with an explicit timeline error ("workdir is not a git repo; run `git init` first"). The kernel contract is `git diff`; snapshot machinery for non-git trees is out of scope.

**Dirty baseline**: at Run start, baseline = `git stash create` when the tree is dirty — a side-effect-free commit object holding tracked modifications plus the staged state; nothing in the worktree, index, or refs is touched. Clean tree → baseline = `HEAD`. The Run row records `baseline_sha` and `baseline_kind` (`head` | `stash`). At Run end: `git diff <baseline_sha>`. `stash create` survives long enough for one short-lived Run (no ref, but the object stays until gc; acceptable). If `stash create` unexpectedly fails, fall back to `HEAD` and mark that on the Diff row. Documented limitation: the baseline covers tracked files only.

**Untracked files**: bare `git diff` misses Agent-created files, so end capture = `git diff <baseline_sha>` plus a synthesized untracked patch: list `git ls-files --others --exclude-standard`, emit a new-file diff (`/dev/null` → file) for each text file, record "Binary file added + byte size" for binary ones. Never `git add -N` (pollutes the index). Operator untracked dirt present at Run start cannot be attributed — documented limitation alongside the baseline one.

**Binary and huge diffs**: no `--binary` (binary files appear as "Binary files differ" lines only; the kernel Diff is for review, not machine apply). Full diff text is stored verbatim in SQLite; over 10MB it is truncated to the first 10MB with `truncated=true`, plus the full `git diff --stat` summary. DiffReady is still emitted.

**Nested repos / subdirectories**: at Run start, `git rev-parse --show-toplevel` resolves the repo root. A workdir that is a subdirectory runs normally; the diff is captured in the workdir (git's default subtree limiting) and the Diff row records the workdir's path relative to the root. Other git repos nested inside the workdir are gitlinks: git does not descend, their inner changes never enter the Diff — documented limitation, not handled.

**Empty diff**: stored (empty text) and DiffReady emitted. "Ran, changed nothing" stays distinguishable from "no Diff captured" on the timeline; the [Kernel Event catalog](03-event-catalog.md) rule "DiffReady only when a Diff row exists" holds unchanged.
