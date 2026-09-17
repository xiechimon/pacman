Type: grilling
Status: resolved
Assignee: xiechimon

# Run prompt contents


## Question

What text does Pacman pass Claude Code at the start of a Run?

Locked already: one Run at a time; cwd is Issue.workdir; Agent cannot mark `done`.

Still open:

- Always include: Issue title and body.
- Whether prior Events are inlined, summarised, or omitted (new Run = fresh context).
- Whether the previous Run's Diff is included on Retry.
- Standing instruction: stop at `in_review`, do not commit, do not push, raise blockers instead of inventing product decisions.
- Whether Pacman writes a file into workdir (`.pacman-issue.md`) or only passes argv/stdin, so the Operator's repo stays untouched.

Depends on [Claude Code spawn contract](01-claude-code-spawn-contract.md) (argv vs stdin vs file) and [Kernel Event catalog](03-event-catalog.md) (what can be inlined).

## Answer

**Delivery**: the whole prompt goes over stdin as plain text (`--input-format text`, the default). No positional prompt argument — argv carries flags only. stdin has no OS length ceiling worth worrying about (macOS ARG_MAX ~1MB can bite argv with long bodies + history).

**Permission mode** (the global flag carried over from [How Operator defines an Agent](04-agent-record.md)): `--permission-mode bypassPermissions --disallowedTools AskUserQuestion`. Rationale: unattended Run, Operator's own machine and workdir, Operator watching the board with Cancel available, global concurrency one Run. AskUserQuestion is disallowed because nobody answers interactively; needing a decision is exactly what `pacman_report_blocked` is for. The risk is documented in `SPEC.md`: the no-commit/no-push rule in the standing instruction is a soft constraint; the kernel's own never-auto-commit is the hard one. Assigning an Issue is an act of trust.

**Context strategy**: every Run starts a fresh context. The kernel never passes `--resume`; `session_id` is still persisted ([Claude Code spawn contract](01-claude-code-spawn-contract.md)) but unconsumed — reserved for future use. Resume-rejection fallbacks and session lookup stay out of the kernel.

**Prompt structure**, fixed five sections:

1. Issue `#N`, title, body (verbatim, full).
2. Standing instruction (below).
3. MCP tools: `pacman_comment(text)` for progress, `pacman_report_blocked(reason)` for decisions, reachable via the per-Run `--mcp-config` ([Kernel process stack](07-process-stack.md)).
4. History digest — empty on a first Run; on Retry, one block per prior Run: outcome, its closing summary Comment, Blocked reason if any, and that Run's `git diff --stat`.
5. Previous Run's full Diff, inlined only when ≤50KB; larger → `--stat` only. The full Diff is frozen in SQLite and visible on the Issue page anyway.

**Standing instruction**: fixed kernel text, specified verbatim in `SPEC.md`, not configurable (no Settings screen; per-Agent persona already rejected). Five rules:

- Edit the workdir in place; touch nothing outside it.
- Never `git commit`, never `git push`, never rewrite git history.
- When finished, stop. The kernel moves the Issue to `in_review`; never claim `done`.
- Missing a product decision? Do not invent one — call `pacman_report_blocked(reason)`.
- Report progress with `pacman_comment(text)`; end the final output with a summary paragraph (the kernel's fallback Comment source).

**No files in workdir**: Pacman writes nothing into the workdir — no `.pacman-issue.md`. Any such file would be caught by untracked-file Diff capture ([Diff capture without a git repo](05-diff-without-git.md)), polluting attribution and dirtying the Operator's repo. Prompt travels by stdin only; the sole temp artifact is the `--mcp-config` file, in the OS temp dir.
