---
labels: [wayfinder:prototype]
parent: map.md
---

---
labels: [wayfinder:prototype]
parent: map.md
status: closed
---

## Question

Pi 的 StreamFn 契约要求 LLM 客户端永不抛错——所有失败（error/aborted）编码进返回的事件流。Anthropic SDK 有自己的 error types（`APIError`、`APIConnectionError`、`RateLimitError` 等）和 streaming iterator。需要验证：

1. 如何把 Anthropic SDK 的 streaming response 包装成 Pi 风格的 `EventStream<AgentEvent>`？
2. SDK 的 `stream()` 返回 `Promise<MessageStream>`，如果要同时支持 cancel（AbortSignal）和 no-throw 语义，wrapper 应该怎么写？
3. `stopReason` 映射：Anthropic 的 `end_turn`/`max_tokens`/`tool_use`/`stop_sequence`/`refusal` → 我们的 stop reason enum

产出：一个可跑的 `AnthropicStreamFn` 函数，输入 prompt + tools，输出事件流，不抛错。

---

## Resolution

Spike 验证通过（9 单测 + 2 真实 API smoke test）。结论：

1. **StreamFn 用 Promise 而非 EventStream** — `(prompt, tools, signal, onEvent) => Promise<AssistantMessage>`。5 种 AgentEvent（text_delta / tool_use_start / tool_use_delta / tool_use_end / error）。

2. **no-throw 包装 ~15 行样板** — 整个 streaming loop 包一个 try/catch，所有 failure 都 return 一个带 `stopReason: "error"|"aborted"` 的 AssistantMessage。abort 检测用字符串匹配（够用，后续可换 `instanceof APIUserAbortError`）。

3. **三个 SDK 陷阱**：① tool_use delta 按 index 寻址（非 id），需维护 index→id 和 id→block 双映射；② `stop_reason` 在 `message_delta` 而非 `message_stop`；③ `pause_turn` 映射为 `toolUse`（因为我们的 wrapper 不管理工具循环）。

详见 [05-anthropic-streamfn-findings.md](05-anthropic-streamfn-findings.md)，spike 在 [spikes/05-anthropic-streamfn/](../spikes/05-anthropic-streamfn/)