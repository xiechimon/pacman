---
labels: [wayfinder:research]
parent: issues/02-agentmessage-pipeline.md
---

# AgentMessage Pipeline Design: Research Findings

## Sources

- pi-wiki Ch 08 (AgentMessage pipeline)
- pi-wiki Ch 21 (Session JSONL)
- pi-wiki Ch 07 (Agent runtime loop)
- pi-wiki Ch 09 (Agent Harness)
- pi-wiki Ch 11 (Tools, streaming, validation)
- Upstream: `https://github.com/earendil-works/pi`, `pi-agent-core` package

---

## 1. AgentMessage Types Pi Defines

**Core union** (Ch 08):

```typescript
AgentMessage = Message | CustomAgentMessages[keyof CustomAgentMessages]
```

where `Message = { role: "user" | "assistant" | "toolResult" } & ContentBlock[]`.

**Seven concrete roles** in coding-agent's exhaustive `convertToLlm` switch (Ch 08, Takeaway 5):

| Role | Category | Converted to LLM? | Notes |
|------|----------|-------------------|-------|
| `user` | Standard Message | passed through | User input |
| `assistant` | Standard Message | passed through | LLM response (may contain tool_use blocks) |
| `toolResult` | Standard Message | passed through | Tool execution result |
| `bashExecution` | CustomAgentMessage | rendered as user text | Shell command + output + exit code; skipped if `excludeFromContext` |
| `custom` | CustomAgentMessage | wrapped as `[TextContent]` or passed through | Extension-injected string content |
| `branchSummary` | CustomAgentMessage | wrapped with prefix/suffix labels | Branch navigation summary |
| `compactionSummary` | CustomAgentMessage | wrapped with prefix/suffix labels | Context compression summary |

**Additional session-level entry types** (Ch 21, not `AgentMessage` but `SessionEntry`): `thinking_level_change`, `model_change`, `label`, `session_info`, `custom_message` (different from `custom` -- goes into context).

**For mini-pi v2 (single-turn, no extensions), the essential set collapses to 3 standard roles:**

- `user` -- the prompt
- `assistant` -- LLM text and/or tool_use requests
- `toolResult` -- tool execution output

These three are all that the Anthropic Messages API accepts. `bashExecution` is not needed because it is Pi's custom wrapper around bash tool results -- in mini-pi v2, bash is just another tool whose output returns as a `toolResult`. `branchSummary`/`compactionSummary`/`custom` exist only for the extension system and multi-session branching, both out of scope.

**Decision**: Define `AgentMessage` as the strict union `{ role: "user" | "assistant" | "toolResult" } & Content`, with tool_use blocks living inside assistant messages per the Anthropic content block model. No custom message types needed in v2.

---

## 2. Two-Stage Pipeline: Collapse Feasibility

### How It Works in Pi

```
AgentMessage[]  ──[transformContext]──>  AgentMessage[]  ──[convertToLlm]──>  Message[]
      (optional, AgentMessage→AgentMessage)              (required, AgentMessage→Message)
```

**`transformContext`** (Ch 08): An optional pre-filter that reshapes the AgentMessage array before LLM projection. In coding-agent, it delegates to `ExtensionRunner.emitContext`, which `structuredClone`s the list and chains through registered extensions. Each extension can replace/modify the message list. Pure projection -- never writes back to the persistent transcript.

**`convertToLlm`** (Ch 08): Required. Takes the (possibly transformed) AgentMessage array and produces a plain `Message[]` for the LLM provider. Default impl: filter out anything not `user`/`assistant`/`toolResult`. Custom impl: flatten custom types into text blocks with descriptive labels.

### Can We Collapse to One Stage?

**Yes, and we should.**

Three reasons:

1. **`transformContext` has zero useful work without extensions.** Its entire purpose (Ch 08, Key Concept "扩展链式变换") is to let extensions inject, reorder, or drop messages before LLM projection. With no extension system, it is an identity function.

2. **Window management can live in `convertToLlm`.** The one thing `transformContext` does that isn't extension-related is "窗口管理" -- trimming the context to fit the token budget. In a single-stage pipeline, `convertToLlm` can accept a `maxTokens` parameter and do truncation during or after conversion. This is simpler than maintaining a separate stage.

3. **Pi itself uses a collapsed equivalent in Harness.** Ch 09 notes that Harness renames `transformContext` to a `transform_context` hook and `convertToLlm` to `toProviderMessages`. The hook exists for extensibility; the actual provider message building is a single function call.

**Decision**: Single `messagesToProvider(messages: AgentMessage[], maxTokens?: number): AnthropicMessage[]` function. It maps the 3 standard roles 1:1, strips non-standard content blocks, and optionally truncates to fit the token window.

**What we lose**: The ability to chain message transformations from extensions. But that is the explicit goal -- no extension system.

---

## 3. Anthropic tool_use Content Block Mapping

### Anthropic's Model (in assistant messages)

```typescript
// In an assistant message content array:
{
  type: "tool_use",
  id: "toolu_01A09q...",
  name: "bash",
  input: { command: "ls", description: "list files" }
}
```

### Pi's Internal Model

Pi normalizes tool_use through a **streaming event protocol** (Ch 11), not by storing the content block directly:

1. During LLM streaming, `toolcall_start` / `toolcall_delta` / `toolcall_end` events are emitted
2. `toolcall_end` carries the completed tool call (name + parsed arguments)
3. The agent loop executes the tool via the 6-stage tool pipeline (Ch 07)
4. Results are persisted as `toolResult` messages: `{ role: "toolResult", toolUseId: "...", content: [...] }`

The assistant's original `tool_use` content block is transient in the streaming layer -- Pi never stores it as a standalone `AgentMessage` role. Instead, the assistant message carries tool_use blocks as content alongside any text, and the tool execution results are appended as separate `toolResult` messages.

### Mapping for mini-pi v2

We adopt a **simpler direct mapping** that mirrors the Anthropic API shape:

```
Anthropic assistant content block (tool_use)  →  assistant AgentMessage with { type: "tool_use", ... }
Anthropic user content block (tool_result)    →  toolResult AgentMessage with { toolUseId, content }
```

**Concrete pipeline**:
1. LLM streams back assistant chunks -- we accumulate text and tool_use blocks into one `assistant` AgentMessage
2. After assistant message completes, extract tool_use blocks → execute tools → produce `toolResult` AgentMessages
3. On next LLM call, `messagesToProvider()` converts the pair (assistant with tool_use + toolResult) back to Anthropic's expected format: the assistant message includes its `tool_use` content blocks, and a separate `user`-role message carries the `tool_result` blocks

**Key difference from Pi**: Pi uses an event-driven architecture where tool_use parsing happens in the stream layer and tool execution hooks through extension interception. We skip all of that -- parse tool_use blocks directly from the Anthropic content block array, execute synchronously or with a simple Promise.all, and append results.

---

## 4. Declaration Merging: What It Is and Why We Drop It

### What It Does

Declaration merging is TypeScript's `declare module` feature that lets separate files augment the same interface:

```typescript
// In pi-agent-core:
interface CustomAgentMessages {
  // empty by default
}

// In an extension:
declare module "@earendil-works/pi-agent-core" {
  interface CustomAgentMessages {
    artifact: ArtifactMessage;
    myFeature: MyFeatureMessage;
  }
}

// Result: CustomAgentMessages is now { artifact, myFeature }
```

This lets extensions add message types without modifying core source, and the `convertToLlm` exhaustive switch catches all registered types at compile time.

### Why Pi Needs It

- Extensions are independently authored and loaded at runtime via jiti (Ch 19)
- Core cannot know at compile time what message types extensions will define
- The `AgentMessage` union must be open for extension but type-checked exhaustively
- Declaration merging solves this: extensions augment the interface, core's switch default handles unknown types, and the compiler verifies no known type is missed

### Why mini-pi v2 Drops It

1. **No extensions.** We control all message types at compile time. The union is closed.
2. **Closed union is simpler.** `AgentMessage = UserMessage | AssistantMessage | ToolResultMessage` -- no `keyof CustomAgentMessages` indirection.
3. **No `convertToLlm` custom dispatch needed.** With only 3 standard roles that map 1:1 to Anthropic, there is nothing to switch on.
4. **Simpler type system.** No module augmentation, no interface merging, no jiti runtime compilation of extension code.

**Decision**: Define AgentMessage as a plain discriminated union at the point of definition. If we later add custom message types (e.g., a system prompt injection message), we add the variant directly to the union -- no declaration merging required.

---

## Summary for mini-pi v2

| Pi Concept | mini-pi v2 Decision |
|---|---|
| AgentMessage union (7 roles) | 3 roles: user, assistant, toolResult |
| transformContext stage | Removed (no extension chain, no window trimming needed in separate stage) |
| convertToLlm stage | Single `messagesToProvider()` function |
| Declaration merging for custom types | Dropped -- closed union at compile time |
| Custom message types (bashExecution etc.) | Not needed -- bash is a tool, results are toolResult messages |
| Extension runner context chain | Out of scope per map.md |
| Streaming tool call normalization (5 events) | Direct Anthropic content block parsing |
| Exhaustive switch in convertToLlm | Not needed -- 1:1 mapping for 3 standard roles |

**Next ticket**: 03-agent-loop-single-turn -- how the single-stage conversion slots into a simplified agent loop without `transformContext`, followUp, steering, or extension hooks.