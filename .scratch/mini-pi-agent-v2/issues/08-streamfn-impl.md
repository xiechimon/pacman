# 02: @mini-pi/ai — StreamFn 实现

**What to build:** 真实 Anthropic SDK 包装函数，遵循 no-throw 契约——所有错误编码为事件而非异常抛出。9+ 单测（mock SDK 响应）全绿，带真实 API 的 smoke test 可跑。

**Blocked by:** 01 (needs StreamFn type contract from @mini-pi/ai).

**Status:** done

## Acceptance criteria

- [x] `createStreamFn({ apiKey, model, maxTokens? })` 返回一个 `StreamFn` 函数
- [x] StreamFn 调用真实 Anthropic API，通过 SDK 的 `stream()` 方法
- [x] 5 种 AgentEvent 正确发出：`text_delta`、`tool_use_start`、`tool_use_delta`、`tool_use_end`、`error`
- [x] 6 种 stopReason 正确映射：`end`、`length`、`toolUse`、`stopSequence`、`refusal`、`error`、`aborted`
- [x] API error（401/429/5xx）→ 返回 `stopReason: "error"` 的 AssistantMessage，不抛异常
- [x] AbortSignal 触发 → 返回 `stopReason: "aborted"`，保留已累积的部分内容
- [x] tool_use delta 按 index 正确寻址（维护 index→id 和 id→block 双映射）
- [x] `stop_reason` 从 `message_delta` 事件读取（非 `message_stop`）
- [x] 9+ 单测 mock SDK 响应，覆盖正常流、错误流、中断流
- [x] Smoke test：`ANTHROPIC_API_KEY=xxx tsx smoke.ts` 发一句 "say hello"，看到 streaming 事件输出