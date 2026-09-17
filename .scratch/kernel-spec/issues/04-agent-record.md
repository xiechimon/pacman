Type: grilling
Status: resolved
Assignee: xiechimon

# How Operator defines an Agent


## Question

What fields does an Agent record have, and how does the Operator create the first one?

Locked already: Agent is a named teammate bound to Claude Code; no Runtime entity; Claude Code only.

Still open:

- Required fields (name, model id, binary path, extra argv).
- Optional vs required model. Default if unset.
- Binary: always PATH `claude`, or Operator-set absolute path.
- How many Agents the kernel allows. One is enough for MVP; several names sharing one CLI is the "teammate" bet.
- First-run: empty board with a setup screen, or a default Agent named by the Operator on first assign.
- Editing or retiring an Agent that is the assignee of open Issues.

## Answer

**Record**: three fields. `name` (required), `model` (optional), `claudePath` (optional). No extra argv — global flags (permission mode etc.) belong to [Run prompt contents](10-run-prompt.md) / [Kernel process stack](07-process-stack.md); per-Agent argv would only corrupt the locked argv from [Claude Code spawn contract](01-claude-code-spawn-contract.md). No persona / per-Agent system prompt — standing instructions are one global set, the kernel does not do per-Agent character.

**name**: required, globally unique (case-insensitive), renamable at any time. History is unaffected because each Run row freezes the agent name it ran with (see Retire).

**Binary resolution**: automatic by default — PATH lookup first; on miss, login-shell resolution (`$SHELL -ilc`, the Multica-evidenced fallback for GUI processes whose PATH lacks `~/.local/bin` / Homebrew); still miss → Run start refused with an explicit error. `claudePath` is an optional per-Agent override, validated to exist at save time and at Run start.

**model**: optional. Unset → do not pass `--model`; the CLI's own default applies. No built-in model-id enumeration (lists drift). A set value is passed through verbatim, not validated at save; a bad id fails the Run and the failure lands on the timeline.

**Count**: no limit. Agents are rows; global concurrency is already one Run.

**First-run**: no wizard. The Agents screen has create; the empty board's empty state links to it (surface shape is [Kernel screens](08-kernel-screens.md)). Assign flow stays single-purpose.

**Edit / retire**:

- Editing name/model/claudePath is frozen only while that Agent's Run is `running`; otherwise anytime. Edits affect future Runs only.
- Retire = delete. Refused while that Agent's Run is `running`. Each historical Run row freezes `agent_id` plus the agent name at run time, so history stays readable.
- Deleting an Agent that is still the assignee of open Issues: assignee becomes null, Status unchanged, no Event (the six-kind catalog has no AssigneeChanged, locked in [Kernel Event catalog](03-event-catalog.md)). The Issue can be re-assigned immediately.
