# Claude Code CLI contract for one non-interactive Pacman Run

Question: what is the current Claude Code CLI contract for one non-interactive Pacman Run?

This note is a cited contract, not a Pacman implementation. Multica is evidence of a working spawn, not a protocol to copy.

Local CLI sampled on this Operator machine: `claude --version` → `2.1.236 (Claude Code)` via Homebrew at `/opt/homebrew/bin/claude`. Official docs fetched 2026-09-17 via agent-reach / Jina Reader from `https://code.claude.com/docs/en/…`.

---

## 1. How the Operator's machine finds `claude`

There is no official `CLAUDE_PATH` / `CLAUDE_CODE_PATH` environment variable for locating the binary. Discovery is PATH plus installer layout.

### Official install locations

From [Advanced setup](https://code.claude.com/docs/en/setup) and [Troubleshoot installation](https://code.claude.com/docs/en/troubleshoot-install):

| Channel | Where the launcher lives | Notes |
| --- | --- | --- |
| Native installer (recommended) | `~/.local/bin/claude` on macOS/Linux; `%USERPROFILE%\.local\bin\claude.exe` on Windows | Symlink into `~/.local/share/claude/versions/`. Auto-update manages that launcher unless replaced with a custom one. |
| Legacy local npm | `~/.claude/local/` | Older Claude Code versions. Docs still tell operators to check this when diagnosing conflicting installs. |
| Homebrew | `claude-code` (stable) or `claude-code@latest` | Cask; does not use the native auto-updater. |
| npm `-g` | whatever `npm root -g` puts on PATH | Same native binary as the standalone installer as of v2.1.198; requires Node 22+. |
| Linux packages | apt / dnf / apk `claude-code` | Signed repos; updates via the package manager. |

`command not found: claude` means the install directory is not on PATH. Native install expects `~/.local/bin` on PATH ([troubleshoot-install § Verify your PATH](https://code.claude.com/docs/en/troubleshoot-install#verify-your-path)).

Auth for a `-p` run is not the binary path. In non-interactive mode, `ANTHROPIC_API_KEY` is always used when present ([env-vars](https://code.claude.com/docs/en/env-vars)). Bare mode (`--bare`) never reads OAuth or the keychain; Anthropic auth is then `ANTHROPIC_API_KEY` or `apiKeyHelper` via `--settings` ([headless](https://code.claude.com/docs/en/headless), local `claude --help`).

### This machine (evidence, not a spec)

- PATH search: `/opt/homebrew/bin/claude` → `/opt/homebrew/Caskroom/claude-code/2.1.236/claude` (Homebrew, reports `2.1.236`).
- Native installer also present: `~/.local/bin/claude` → `~/.local/share/claude/versions/2.1.269`. Homebrew is earlier on PATH, so `claude` is not the native binary.
- `~/.claude/local/` is absent.

A Pacman process that inherits a GUI/launchd PATH (no `~/.local/bin`, no Homebrew) will miss both.

### Multica discovery (evidence)

`MULTICA_CLAUDE_PATH` overrides the command used to look up Claude. Empty → `"claude"`. Probe order in `server/internal/daemon/agents_probe.go`:

1. `envOrDefault("MULTICA_CLAUDE_PATH", "claude")`
2. `exec.LookPath` / `resolveAgentExecutablePath` (pins an absolute path; skips a `~/.multica/hooks` wrapper that would recurse)
3. If the value is a bare name and LookPath misses: login-shell resolve (`$SHELL -ilc …`) because a GUI-launched daemon does not inherit interactive PATH. Comment names fnm/nvm/volta **and** the Anthropic native installer prefix `~/.claude/local/` (`config.go` around the `resolveAgentsViaLoginShell` comment).
4. An explicit `MULTICA_CLAUDE_PATH` that contains `/` or `\` and does not exist is a hard miss (no silent fallback).

Spawn then uses that pinned `AgentEntry.Path` as `agent.Config.ExecutablePath`. If empty, `claudeBackend.Execute` falls back to `"claude"` and `LookPath` again (`server/pkg/agent/claude.go`).

---

## 2. Argv for one one-shot Run (prompt + cwd + streamed progress)

### Shape

From local `claude --help` and [CLI reference](https://code.claude.com/docs/en/cli-reference):

```
claude [options] [command] [prompt]
```

Non-interactive: `-p` / `--print`. The workspace trust dialog is skipped when `-p` is set **or** stdout is not a TTY. Settings files that fail validation are silently ignored in this mode.

There is **no `--cwd` flag**. Working directory is the process cwd. Extra readable/editable trees are `--add-dir`. `--worktree` / `-w` creates a git worktree under `<repo>/.claude/worktrees/<name>` — a different contract from "run in this Issue workdir".

### Print / output / streaming

`--output-format` (print mode only): `text` (default), `json` (one object), `stream-json` (NDJSON events). [Headless](https://code.claude.com/docs/en/headless):

- Streamed progress: `--output-format stream-json` plus `--verbose` (turn-by-turn). Token-level deltas need `--include-partial-messages` as well.
- Last stream line is a `result` message (text, cost, session metadata).
- `--verbose` overrides `viewMode` from settings.

`--input-format` (print mode only): `text` (default) or `stream-json` (realtime streaming input). Pair with `--output-format stream-json` for the Agent SDK control protocol on stdin/stdout.

### Permission flags Pacman actually needs to choose

From `--help`, [CLI reference](https://code.claude.com/docs/en/cli-reference), [permission modes](https://code.claude.com/docs/en/permission-modes), [headless](https://code.claude.com/docs/en/headless):

| Flag | Contract |
| --- | --- |
| `--permission-mode <mode>` | `default` (help lists `manual` as the alias for Manual), `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan`. Overrides `permissions.defaultMode`. |
| `--dangerously-skip-permissions` | Same as `--permission-mode bypassPermissions`. Docs: isolated sandboxes / no internet. |
| `--allowedTools` / `--allowed-tools` | Auto-approve matching tools; does not remove the rest. |
| `--disallowedTools` | Deny / remove. |
| `--permission-prompt-tool <mcp_tool>` | MCP tool answers prompts in `-p`. Wait up to `MCP_TIMEOUT` (default 30s) for that server. |
| `--permission-prompts host\|none` | v2.1.259+. Default `host` (SDK `canUseTool` or the prompt tool). `none` denies anything that would prompt. |

Built-in starting mode for `claude -p` / Agent SDK is **Manual** (`default`), on every plan ([permission-modes § Which mode a session starts in](https://code.claude.com/docs/en/permission-modes#which-mode-a-session-starts-in)). If Pacman does not pass a mode or allowlist, writes and most Bash will try to prompt.

Unattended options that still complete:

- `--permission-mode dontAsk` — deny anything that would prompt; reads and pre-approved tools still run.
- `--permission-mode acceptEdits` plus `--allowedTools` for the Bash the Run needs.
- `--permission-mode bypassPermissions` / `--dangerously-skip-permissions` — skip checks (Multica's choice; not required by the CLI).
- `--permission-prompts none` — do not wait on a host; denials show as `permission_denied` system events and `permission_denials` on the result (stream-json).

### Minimal argv that matches the ticket (prompt + cwd + stream)

Spawn with `cwd = Issue workdir`, then:

```
claude -p --output-format stream-json --verbose --permission-mode <chosen> [permission extras…] -- <prompt>
```

`--` is optional if the prompt cannot look like a flag. Local help: prompt is a positional argument.

`--bare` is optional: skips hooks, skills, plugins, MCP auto-discovery, CLAUDE.md. Useful for CI-identical Runs; drops project CLAUDE.md unless passed another way.

---

## 3. stdin versus argv versus a prompt file

| Channel | What it carries | Source |
| --- | --- | --- |
| Positional `[prompt]` | The user prompt for this invocation. | `claude --help`; `claude -p "query"` in [CLI reference](https://code.claude.com/docs/en/cli-reference) |
| stdin, `--input-format text` (default) | Piped bytes treated as extra input; classic `cat log \| claude -p "explain"` | [Headless § Pipe data](https://code.claude.com/docs/en/headless) |
| stdin, `--input-format stream-json` | NDJSON control/user frames (`{"type":"user","message":{…}}`). Keep stdin open for `control_response`. | `--help`; [streaming input](https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode) |
| `--system-prompt-file` / `--append-system-prompt-file` | **System** prompt, not the user prompt. | CLI reference |
| `--append-subagent-system-prompt-file` | Subagent system prompt (print mode, v2.1.261+). | CLI reference |

There is **no** `--prompt-file` for the user message in current `--help` or the CLI reference. A file becomes the user prompt only by shelling it into argv (`claude -p "$(cat file)"`) or by writing a stream-json user frame on stdin.

If stdin cannot be read (parent closed its end), Claude Code prints a warning on stderr and continues with the argv prompt. Before v2.1.211 an unreadable stdin on Windows could crash or exit silently ([headless](https://code.claude.com/docs/en/headless)).

`--replay-user-messages` re-emits stdin user frames on stdout; requires both input and output `stream-json`.

---

## 4. Succeeded, failed, or waiting on permission

### Process exit

[Headless](https://code.claude.com/docs/en/headless):

- Exit **0** on success; **non-zero** on failure. Scripts should branch on status.
- Invalid flags: error on **stderr** before the run starts.
- Failure inside the run (e.g. missing auth): failure printed as the **result on stdout**.
- SIGTERM on `claude -p`: exit **143**. No result recorded for the in-flight turn. `SessionEnd` hooks still run. Bash process trees are killed.

JSON / stream-json `result` object (CLI + [SDKResultMessage](https://code.claude.com/docs/en/agent-sdk/typescript#sdkresultmessage)):

| Field | Use |
| --- | --- |
| `type` | `"result"` (last stream-json line) |
| `subtype` | `"success"` vs error subtypes such as `error_during_execution` / `error_max_turns` |
| `is_error` | boolean |
| `result` | final text (or error text) |
| `session_id` | resume handle |
| `permission_denials` | authoritative list of denied tool calls |
| `terminal_reason` | why the loop ended (`completed`, `max_turns`, `api_error`, `prompt_too_long`, `budget_exhausted`, …) |
| `total_cost_usd`, `usage`, `modelUsage` | client-side estimates |

`is_error` and `terminal_reason` are computed independently. A `prompt_too_long` turn can arrive with `is_error` false (Multica observed this; they treat `terminal_reason=prompt_too_long` as failure). Prefer both fields.

### Waiting on permission

A `-p` run **does not show a TTY permission UI**. Behavior:

1. Built-in mode is Manual (`default`). Unapproved tools need a host.
2. With no host (`canUseTool` / `--permission-prompt-tool`): those calls are **denied** and the run continues ([headless § Turn off permission prompts](https://code.claude.com/docs/en/headless#turn-off-permission-prompts-in-unattended-runs); [SDK permission_denied events](https://code.claude.com/docs/en/agent-sdk/typescript)). Before v2.1.223 the `permission_denied` stream event was omitted in no-callback runs.
3. With a host: Claude emits `control_request` on stdout and **waits indefinitely** for a `control_response` on stdin ([user-input](https://code.claude.com/docs/en/agent-sdk/user-input): "The callback can stay pending indefinitely"). The OS process stays alive. That is the "waiting on permission" state.
4. `--permission-prompt-tool` missing at first approval: stderr `MCP permission prompt tool not found`, exit **1**, no answer ([errors](https://code.claude.com/docs/en/errors)).
5. `--permission-prompts none`: do not wait; deny; `permission_denied` events + `permission_denials` on the result.

Detect waiting only if Pacman speaks stream-json input and sees an unanswered `control_request`. Otherwise a hung process is indistinguishable from a long model/tool turn except by idle timeout.

---

## 5. How to cancel so the Run can be marked failed/cancelled

Official ([headless § Stop a run with SIGTERM](https://code.claude.com/docs/en/headless#stop-a-run-with-sigterm)):

| Signal | Effect |
| --- | --- |
| **SIGTERM** (`kill`, supervisor) | Exit 143. In-flight turn unfinished, **no result** recorded. Running Bash trees terminated. `SessionEnd` only. If a permission prompt was outstanding, it is left unanswered. |
| **SIGINT** (or Agent SDK `interrupt()`) | Ends the **turn** first. Docs: send this before stopping the process if you want a completed turn rather than a truncated one. |
| Close stdin (SDK) | Cancels an outstanding permission prompt as soon as input ends. |

Resume after SIGTERM **continues the unfinished turn**.

Pacman should: signal the process group (Claude spawns MCP servers and Bash children), wait, then SIGKILL if needed. Do not assume exit 0 after cancel.

---

## 6. Session id and a later Run on the same Issue

Yes. A print-mode run gets a session id.

- `json` / `stream-json` result includes `session_id`. `system/init` also carries it.
- `--session-id <uuid>` forces the id (must be a UUID).
- Resume: `claude -p --resume <session-id> "follow-up"` or `--continue` for the most recent conversation in the **current directory**.
- `-p` / Agent SDK sessions are **omitted** from the interactive picker and from `claude --continue`. They **are** included in `claude -p --continue`, and they resume by explicit `--resume <id>` ([sessions](https://code.claude.com/docs/en/sessions), [headless § Continue conversations](https://code.claude.com/docs/en/headless#continue-conversations)).
- Lookup by id (v2.1.223+): current project and its worktrees, then every other project on the machine. Missing → `No conversation found with session ID: …`.
- Transcripts: `~/.claude/projects/<project>/<session-id>.jsonl` (`<project>` = cwd with non-alphanumerics → `-`). Override root with `CLAUDE_CONFIG_DIR`.
- `--no-session-persistence` (print mode) or `CLAUDE_CODE_SKIP_PROMPT_HISTORY`: no disk, cannot resume.
- `--fork-session` with `--resume`/`--continue`: new id, original kept.

A later Pacman Run on the same Issue can resume **if** Pacman stored `session_id` from the previous result and the transcript still exists. `--continue` is cwd-scoped and easy to grab the wrong conversation; prefer explicit `--resume`.

`--resume` with `-p` starts in the permission mode a **new** `-p` run would use, not the stored mode, except a plan-mode resume under documented conditions ([sessions § Permission mode on resume](https://code.claude.com/docs/en/sessions#permission-mode-on-resume)). Pass `--permission-mode` again.

Flags such as `--mcp-config`, `--settings`, `--plugin-dir`, `--add-dir` are **not** restored; pass them again.

---

## 7. What Multica does today for provider `claude`

Pacman will not speak Multica's protocol. This is a working spawn, not a template.

### Path and extra args

| Knob | Role | Source |
| --- | --- | --- |
| `MULTICA_CLAUDE_PATH` | Absolute or command name for the binary | `CLI_AND_DAEMON.md`; `agents_probe.go` `probe("MULTICA_CLAUDE_PATH", "claude", …)` |
| `MULTICA_CLAUDE_MODEL` | Default model if the agent record has none | same |
| `MULTICA_CLAUDE_ARGS` | Daemon-wide extra argv; POSIX shellwords | `config.go` `shellArgsFromEnv`; applied as `ExecOptions.ExtraArgs` via `defaultArgsForProvider` |

Argv merge order (Multica docs + `buildClaudeArgs`): hardcoded protocol flags → `MULTICA_CLAUDE_ARGS` (`ExtraArgs`) → per-agent `custom_args`. Blocked overrides: `-p`, `--output-format`, `--input-format`, `--permission-mode`, `--mcp-config`, `--effort`.

### Spawn (`server/pkg/agent/claude.go`)

Hardcoded:

```
-p
--output-format stream-json
--input-format stream-json
--verbose
--permission-mode bypassPermissions
--disallowedTools AskUserQuestion
```

Then optional `--strict-mcp-config` + `--mcp-config <temp>`, `--model`, `--effort`, `--max-turns`, `--resume <PriorSessionID>`, filtered extras, optional `--settings`.

- `cmd.Dir = opts.Cwd` (task workdir). Prompt is **not** on argv; it is one stream-json user frame on stdin (`buildClaudeInput`). Stdin stays open for `control_request` → auto-`allow` `control_response`.
- Process group: on cancel, EOF stdin, SIGTERM group, 5s grace, SIGKILL. `WaitDelay` 10s.
- Success/fail: parse stream; `result.is_error`; `terminal_reason`; `cmd.Wait` exit; stderr tail. Session id from `system` / `result` `session_id`. Resume stored as `task.PriorSessionID`.
- Resume rejection phrases include `no conversation found` (stderr) and account-binding errors; daemon may retry with a fresh session.

That protocol (stream-json in **and** out, auto-allow control, `bypassPermissions`) is Multica-specific. Pacman can use `-p` + argv prompt + `stream-json` out without speaking control frames, if it picks a permission mode that does not wait.

---

## Contract gist (for the later Pacman spec)

1. Resolve `claude` from PATH; native launcher is `~/.local/bin/claude` → `~/.local/share/claude/versions/`; legacy `~/.claude/local/`; optional explicit path (Multica: `MULTICA_CLAUDE_PATH`). No official binary-path env.
2. One-shot: `cwd=Issue workdir`, `claude -p --output-format stream-json --verbose --permission-mode <mode> [tools/prompts flags] <prompt>`.
3. User prompt: argv and/or stdin. No `--prompt-file`. `--*-prompt-file` flags are system prompt. Stream-json stdin is the SDK control channel.
4. Exit 0 + `result.is_error=false` (and `terminal_reason` not a failure) = success. Non-zero / `is_error` / missing result = fail. Waiting = unanswered `control_request` only if Pacman is the permission host; otherwise `-p` denies or hangs until timeout.
5. Cancel: SIGTERM process group → exit 143, no result; SIGINT/interrupt to finish the turn; SIGKILL if it will not die.
6. Persist `session_id` from the result; later Run: `claude -p --resume <id>`.

---

## Sources

- Local: `claude --help`, `claude --version` (2.1.236 Homebrew); filesystem `~/.local/bin/claude`, `~/.local/share/claude/versions/`, `/opt/homebrew/bin/claude`.
- https://code.claude.com/docs/en/cli-reference
- https://code.claude.com/docs/en/headless
- https://code.claude.com/docs/en/setup
- https://code.claude.com/docs/en/troubleshoot-install
- https://code.claude.com/docs/en/sessions
- https://code.claude.com/docs/en/permission-modes
- https://code.claude.com/docs/en/env-vars
- https://code.claude.com/docs/en/errors
- https://code.claude.com/docs/en/agent-sdk/typescript
- https://code.claude.com/docs/en/agent-sdk/user-input
- https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode
- Multica: `/Users/xmon/Code/AgentProjects/multica/CLI_AND_DAEMON.md`, `server/internal/daemon/agents_probe.go`, `server/internal/daemon/config.go`, `server/internal/daemon/daemon.go` (`defaultArgsForProvider`, `ExecOptions`, `ExecutablePath`), `server/pkg/agent/claude.go`
