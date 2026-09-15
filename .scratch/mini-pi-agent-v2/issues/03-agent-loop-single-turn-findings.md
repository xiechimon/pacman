# Agent Loop: Single-Turn Simplification Research

Sources: pi-wiki ch07, ch09; upstream Pi source `packages/agent/src/`
(commit from `https://github.com/earendil-works/pi`, shallow clone).

---

## 1. Pi's Double-While Loop

Source: `packages/agent/src/agent-loop.ts` `runLoop()` (lines 156-273).

```
while (true) {                          // outer: followUp loop
    while (hasMoreToolCalls
           || pendingMessages.length > 0) { // inner: tool + steering loop
        // 1. prepareNextTurn (compaction, model switch etc.)
        // 2. emit turn_start
        // 3. inject pending messages (steering)
        // 4. streamAssistantResponse → LLM call
        // 5. executeToolCalls (or fail truncated)
        // 6. emit turn_end
        // 7. shouldStopAfterTurn? → agent_end, return
        // 8. poll getSteeringMessages() → pendingMessages
    }
    // Inner exited → agent would stop
    followUpMessages = await getFollowUpMessages()
    if any → pendingMessages = followUpMessages; continue (back to inner)
    break  // agent_end
}
```

**Inner loop** (`hasMoreToolCalls || pendingMessages.length > 0`):
- Drives the tool-call chain: LLM response, tool execution, re-enters if the
  assistant produces new tool calls.
- Steers mid-run: after each turn, `getSteeringMessages()` returns queued user
  messages. If any, they are injected before the next LLM call in the SAME
  turn. Loops until no tool calls AND no steering.

**Outer loop** (`followUp`):
- Only fires when the inner loop would exit (agent appears "done").
- Polls `getFollowUpMessages()`. If any exist, sets them as pending and
  re-enters the inner loop (new `turn_start`).
- This lets queued follow-up tasks chain without a new top-level `prompt()`
  call.

**Key insight for single-turn**: Neither steering nor followUp queues are
relevant when there is no concurrent user interaction. Single-turn MVP
collapses the double-while into a flat `while (hasMoreToolCalls)`.

---

## 2. Events Emitted

Source: `packages/agent/src/types.ts` `AgentEvent` union (lines 431-446).

```
agent_start         // run begins
  turn_start        // one turn = assistant response + tool execution
    message_start   // user/toolResult message (or assistant partial)
    message_update  // assistant streaming delta (text/toolcall tokens)
    message_end     // message complete

    tool_execution_start   // each tool call begins
    tool_execution_update  // streaming partial from tool
    tool_execution_end     // tool finished

    // (message_start/message_end for toolResult messages)
  turn_end          // turn finished, with summary stats
agent_end           // run finished, carries final message list
```

For single-turn MVP, only these are essential:
- `agent_start`, `agent_end` -- lifecycle bookends
- `turn_start`, `turn_end` -- turn framing
- `message_start`, `message_end` -- message boundaries
- `message_update` -- streaming tokens to UI
- `tool_execution_start`, `tool_execution_end` -- tool lifecycle

Droppable: `tool_execution_update` (tool streaming progress) can be deferred
or omitted for MVP.

---

## 3. Parallel Tool Execution

Source: `packages/agent/src/agent-loop.ts` `executeToolCallsParallel()`
(lines 487-561).

Strategy:
1. **Prepare**: Each tool call is prepared sequentially (resolve tool, validate
   args, `beforeToolCall` hook). This is sequential because the hook can
   modify/reject each call.
2. **Execute**: Cleared tools run concurrently via `Promise.all`. Each
   execution is wrapped in an async closure enriched with `signal` awareness.
3. **Emit `tool_execution_end`**: In tool completion order (as each resolves).
4. **Emit tool-result messages**: In assistant source order (the order the
   model listed them in `content[]`).

Fallback to sequential: if ANY tool declares `executionMode: "sequential"` or
config sets `toolExecution: "sequential"`, the entire batch runs one-by-one
(`executeToolCallsSequential()`).

Early termination (`terminate`): If EVERY finalized tool result has
`terminate: true`, the batch truncates and `hasMoreToolCalls` is set to false.

**For single-turn MVP**: Parallel tool execution is relevant only if a single
turn includes multiple tool calls. MVP could start with sequential-only and
upgrade later, since:
- Single-turn MVP can emit `hasMoreToolCalls = toolCalls.length > 0` after
  the first batch.
- The inner loop already handles looping back for another LLM call after tools
  run.
- The main complexity of parallel is re-ordering tool-result messages to match
  assistant source order and the concurrent Promise management.

---

## 4. StreamFn No-Throw Contract

Source: `packages/agent/src/types.ts` `StreamFn` JSDoc (lines 18-32),
`agent-loop.ts` lines 285-369.

**Contract**: `StreamFn` must never throw or return a rejected promise. All
failures must be encoded in the returned `AssistantMessageEventStream`:
- On `error`/`aborted`: the stream yields events normally, then the final
  `AssistantMessage` carries `stopReason: "error"` or `stopReason:
  "aborted"`, plus `errorMessage: string`.
- The loop consumes this uniformly:
  ```typescript
  if (message.stopReason === "error" || message.stopReason === "aborted") {
      emit({ type: "turn_end", message, toolResults: [] });
      emit({ type: "agent_end", messages: newMessages });
      return; // early exit, no tool execution
  }
  ```

**`handleRunFailure` fallback** (Agent class only, agent.ts lines 511-527):
If the loop ITSELF throws (not the stream function, but the JS runtime), the
Agent class synthesizes a full event sequence:
```
message_start → message_end → turn_end → agent_end
```
This prevents UI state machines from hanging. The synthesized message has
`stopReason: "error"/"aborted"` and `errorMessage` set.

**For single-turn MVP**: The StreamFn contract is essential. Single-turn loop
must:
1. Not catch errors from the LLM call -- let StreamFn encode them.
2. Check `stopReason` after each stream and exit cleanly.
3. Report the `errorMessage` field to the UI.

---

## 5. Harness Components to Drop for MVP

Source: ch09 (intent-settlement, accept/drive, 11 hooks, compaction);
`packages/agent/src/harness/` (~5360 lines total across key files).

### Must keep (single-turn loop inherits)
- `beforeToolCall` / `afterToolCall` -- the agent-loop-level hooks (not
  harness hooks). These live in `AgentLoopConfig` and are callbacks passed
  directly to the loop, with no persistence or gate semantics. Keep them as
  simple callbacks.
- `shouldStopAfterTurn` -- determines early exit, useful even in single-turn.
- `transformContext` -- context pruning/injection, useful for token management.

### Can drop (Harness persistence/state-machine layer)
These are the ~5360 lines of harness code we don't need for MVP:

| Component | Lines (est.) | Why Droppable |
|---|---|---|
| Intent-settlement 2-phase commit | ~500 | No crash recovery needed for MVP |
| accept/drive ownership separation | ~300 | Single-turn has no async interleaving |
| Effect gate (`AbortRequested`, gate.admit) | ~200 | Simple AbortSignal sufficient |
| 11 hooks (harness-level via HookRegistry) | ~500 | Agent-level hooks (beforeToolCall, afterToolCall) suffice |
| `before_drive` | ~50 | No drive lifecycle |
| `before_run` / `before_run_end` | ~100 | No structured run lifecycle |
| `transform_context` (harness hook) | ~100 | Keep the agent-loop-level `transformContext` callback |
| `before_request` / `before_payload` / `after_response` | ~200 | StreamFn options handled inline |
| `before_compaction` / `before_navigation` | ~200 | No compaction or navigation in MVP |
| Compaction / branch summarization | ~400 | No long-context management needed |
| Structural navigation / summary generation | ~300 | No multi-step task orchestration |
| Recovery & replay (`replay: "safe"`, memos) | ~300 | No crash recovery |
| Lane storage (JSONL, durable values, entries) | ~1500 | In-memory transcript only |
| Config snapshots + replacement | ~200 | Static config for MVP |
| Progress/checkpoint system | ~200 | No durable progress needed |
| Tool context resolver | ~100 | Static tool config |
| Telemetry spans | ~100 | Drop for MVP |
| Adaptive publisher | ~100 | Drop for MVP |

**Harness lines in scope**: ~5360 lines
**Keepable for single-turn MVP**: ~500 lines (beforeToolCall, afterToolCall,
shouldStopAfterTurn, transformContext callbacks at agent-loop level)

### Summary: What a single-turn MVP loop looks like

```
function singleTurnLoop(context, config, signal, streamFn):
    emit agent_start
    emit turn_start
    emit message_start(user) → message_end(user)

    // LLM call (StreamFn contract — no throw)
    message = await streamAssistantResponse(context, config, signal, streamFn, emit)

    if message.stopReason == "error" or "aborted":
        emit turn_end → agent_end; return

    // Tool execution
    toolCalls = message.content.filter(c => c.type == "toolCall")
    if message.stopReason == "length":
        fail all tool calls (arguments may be truncated)

    toolResults = []
    for each toolCall:
        prepare → validate → beforeToolCall? → execute → afterToolCall?
        emit tool_execution_start/end
        toolResults.push(toolResultMessage)
        emit toolResult message_start/end

    emit turn_end

    // Optionally: if toolResults exist, loop back for another LLM call
    // with tool results in context

    emit agent_end
```

This is approximately the inner loop of Pi's `runLoop()`, stripped of:
- Steering/followUp queue polling
- `prepareNextTurn` (no dynamic model/context change mid-run)
- `shouldStopAfterTurn` (keep as optional callback)
- Driving from followUp messages (single-turn = one entry point)