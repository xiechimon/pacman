# Spike 05: Anthropic StreamFn Wrapper -- Findings

- **Spike path**: `.scratch/mini-pi-agent-v2/spikes/05-anthropic-streamfn/`
- **Date**: 2026-09-13

## 1. Minimal types

Three core types drive the contract:

```ts
interface AssistantMessage {
  role: 'assistant';
  content: ContentBlock[];          // text | tool_use union
  stopReason: StopReason;           // 'end' | 'length' | 'toolUse' | 'stopSequence' | 'refusal' | 'error' | 'aborted'
  errorMessage?: string;            // only set on 'error' / 'aborted'
  usage: { inputTokens: number; outputTokens: number };
}

type AgentEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_use_start'; id: string; name: string }
  | { type: 'tool_use_delta'; id: string; inputJsonDelta: string }
  | { type: 'tool_use_end'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'error'; message: string };

type StreamFn = (
  prompt: string,
  tools: ToolDef[],
  signal: AbortSignal,
  onEvent: (e: AgentEvent) => void,
) => Promise<AssistantMessage>;
```

This is the minimal set. The `AgentEvent` union gives callers five hooks:
`text_delta` (per-chunk), `tool_use_start`/`tool_use_delta`/`tool_use_end`
(lifecycle), and `error` (non-fatal notification; the function still returns an
`AssistantMessage` rather than throwing).

## 2. Error-handling mapping

The `createStreamFn` factory wraps the entire streaming loop in a single
try/catch. Every code path returns an `AssistantMessage`:

| Failure mode                  | stopReason | What the caller gets                        |
|-------------------------------|------------|---------------------------------------------|
| `signal.aborted` before call  | `aborted`  | empty content + `errorMessage`              |
| `signal.aborted` mid-stream   | `aborted`  | partial content accumulated so far          |
| Anthropic `APIError`          | `error`    | `errorMessage` = `err.message`              |
| Anthropic `RateLimitError`    | `error`    | `errorMessage` = `err.message`              |
| `APIUserAbortError` (wrapped) | `aborted`  | detected by string match on `"abort"`       |
| Unexpected exception          | `error`    | `errorMessage` = `err.message` or fallback  |

The string-matching heuristic for abort detection (checking for `"abort"`,
`"AbortError"`, `"APIUserAbortError"` in the message) is functional but not
ideal. A better approach would be `instanceof APIUserAbortError`, but that
requires importing the SDK's error classes. In the prototype this works
reliably because the SDK's abort error message is stable.

## 3. Anthropic streaming event model -- gotchas

### 3a. Tool-use deltas are indexed, not id-addressed

The most subtle part of the Anthropic streaming protocol is the relationship
between tool-use block identity and deltas:

- `content_block_start` (type: `tool_use`) carries the block `id` and `name`,
  alongside the `index` into the content array.
- `content_block_delta` (type: `input_json_delta`) carries ONLY the `index` and
  `partial_json` -- **no id**.
- `content_block_stop` carries only the `index`.

This means the wrapper must maintain both `index -> id` and `id -> block`
mappings. The prototype uses two Maps: `toolUseByIndex` and `toolUseById`.

### 3b. stop_reason arrives on message_delta, not message_stop

Anthropic's protocol sends the `stop_reason` inside the `message_delta` event
(the `delta.stop_reason` field), **not** in `message_stop`. The
`message_stop` event is a sentinel with no payload -- it merely signals
end-of-stream. The accumulation order is typically:

```
content_block_delta (final text chunk)
content_block_stop
message_delta          ← stop_reason and usage.output_tokens HERE
message_stop           ← sentinel, no data
```

### 3c. `end_turn` normalisation diverges from Anthropic's ToolRunner

In the Anthropic SDK, `pause_turn` is a stop reason that means "the model
paused mid-turn to call a tool." The SDK's `BetaToolRunner` resumes
automatically. Since our wrapper doesn't manage a tool-execution loop, we map
`pause_turn` to `'toolUse'` so the caller can decide what to do.

### 3d. `ping` events are not typed in some SDK versions

The `ping` SSE keep-alive event may or may not appear in the
`RawMessageStreamEvent` union depending on the SDK version. The prototype
handles this in the `default` case, silently ignoring pings rather than
emitting an `error` event.

### 3e. input_tokens may be absent from message_start with proxies

When running against a non-Anthropic proxy (e.g., the test environment that
routes through a custom gateway), `message.usage` on `message_start` may be
null, resulting in `inputTokens: 0`. With the real Anthropic API,
`message_start` always carries `usage.input_tokens`. Callers should not
depend on `inputTokens > 0` as a validity check.

## 4. No-throw contract complexity assessment

The no-throw contract adds roughly 15 lines of boilerplate (the try/catch
block, the abort-before-start guard, and the mid-stream abort return). The
value trade-off:

- **For the caller**: the contract is clean -- every call resolves to an
  `AssistantMessage`, no try/catch needed. This simplifies agent-loop code
  that needs to handle partial results on abort or error.
- **For the wrapper author**: error-type discrimination is coarse (string
  matching for abort detection). This is sufficient but not elegant.
- **Complexity: LOW**. The wrapper's internal logic is ~180 lines, most of
  which is event-handling that would exist regardless.

**Recommendation**: keep the no-throw contract. The caller-side simplicity
is worth the internal string-matching heuristic. If abort discrimination
becomes unreliable, add a direct `instanceof APIUserAbortError` check by
importing the SDK's error class.

## 5. Verified behaviours

Both streaming paths confirmed working against a live API proxy:

| Scenario              | stopReason | Content                         |
|-----------------------|------------|---------------------------------|
| Text-only ("say hello")            | `end`      | 1 text block, "Hello!"          |
| Tool use (get_weather)             | `toolUse`  | 1 tool_use block, parsed input  |
| 404 / model_not_found              | `error`    | empty content + errorMessage    |

Unit tests cover: text accumulation, tool-use JSON parsing (happy + malformed),
stop-reason mapping, error normalisation, abort detection, and the
AssistantMessage shape.