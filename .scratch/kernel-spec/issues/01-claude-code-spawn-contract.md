Type: research
Status: resolved

# Claude Code spawn contract


## Question

What is the current Claude Code CLI contract for one non-interactive Pacman Run?

Need a cited answer covering:

- How the Operator's machine finds the `claude` binary (PATH, `~/.claude/local/`, env).
- Argv for a one-shot run with a prompt, a cwd, and streamed progress (print mode, output format, permission flags).
- stdin versus argv versus a prompt file.
- How to tell the process succeeded, failed, or is waiting on permission.
- How to cancel the process so the Run can be marked failed/cancelled.
- Whether a session id exists that a later Run on the same Issue should resume.
- What the Multica daemon actually does today for provider `claude` (`MULTICA_CLAUDE_PATH`, `MULTICA_CLAUDE_ARGS`, spawn in `server/internal/daemon`). Pacman will not speak Multica's protocol; this is evidence of a working spawn, not a spec to copy.

Primary sources: current Claude Code CLI docs, `claude --help` if present on this machine, and `/Users/xmon/Code/AgentProjects/multica` daemon source.

Write findings on branch `research/claude-code-spawn-contract` and leave a path pointer under this ticket.

## Findings
`.scratch/kernel-spec/research/claude-code-spawn-contract.md` on branch `research/claude-code-spawn-contract`

## Answer

Cited contract is `.scratch/kernel-spec/research/claude-code-spawn-contract.md` on `research/claude-code-spawn-contract` (`1d31182`). Local CLI sampled: Homebrew `claude` 2.1.236.

- Binary: PATH. No official `CLAUDE_PATH`. Native `~/.local/bin/claude`; legacy `~/.claude/local/`; Homebrew/npm/apt. GUI PATH often misses both. Multica evidence: `MULTICA_CLAUDE_PATH` then LookPath then login-shell PATH.
- cwd is process cwd. No `--cwd`. Do not use `--worktree`.
- One-shot: `claude -p --output-format stream-json --verbose --permission-mode <mode> -- <prompt>`.
- User prompt: positional argv and/or stdin. No `--prompt-file`. `--*-prompt-file` is system prompt. `--input-format stream-json` is SDK control channel.
- `-p` starts Manual (`default`). Unattended needs `dontAsk` / allowlists / `--permission-prompts none` / `bypassPermissions`.
- Success: exit 0 and `result.is_error=false` (also `terminal_reason`). Fail: non-zero, `is_error`, or no result. Waiting: unanswered `control_request` only if Pacman is the permission host.
- Cancel: SIGTERM process group (exit 143, no result); SIGKILL if needed.
- Persist `session_id` from the result; later Run may `claude -p --resume <id>`. Resume vs fresh prompt is [Run prompt contents](10-run-prompt.md).
- Multica spawn (do not copy protocol): hardcoded `-p --output-format stream-json --input-format stream-json --verbose --permission-mode bypassPermissions`, prompt on stdin as a user frame.

Product choice of PATH vs Operator-set absolute path stays on [How Operator defines an Agent](04-agent-record.md). Permission mode for Pacman stays on [Run prompt contents](10-run-prompt.md) / process stack, not this ticket.
