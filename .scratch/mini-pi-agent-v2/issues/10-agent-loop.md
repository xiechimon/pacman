# 04: @mini-pi/agent — Agent 循环 + 消息管线

**What to build:** 单层 `while (hasMoreToolCalls)` agent 循环 + `messagesToProvider()` 消息转换管线。注入 fake StreamFn 和 fake 工具即可测通整个循环，不碰真实网络。

**Blocked by:** 01 (needs types from @mini-pi/ai).

**Status:** done

## Acceptance criteria

- [x] `messagesToProvider(messages: AgentMessage[], maxTokens?: number): AnthropicMessage[]` 将 3 种消息类型 1:1 映射到 Anthropic 格式
- [x] `runAgentLoop(prompt, streamFn, tools, config?): Promise<AgentLoopResult>` 执行完整单轮循环
- [x] 8 种事件按正确顺序发出：agent_start → turn_start → message_start(user) → ... → agent_end
- [x] 循环检测 assistant 消息中的 tool_use block → 查找匹配工具 → 执行 → 追加 toolResult → 回到 LLM 调用
- [x] `stopReason: "length"` 时所有 tool_use 标记为失败（参数可能被截断），不给 LLM 发送 tool_result
- [x] `stopReason: "error"` 或 `"aborted"` 时循环退出，保留已累积的消息
- [x] `config.maxTurns` 达到上限时循环退出
- [x] 可选 callback：`beforeToolCall`、`afterToolCall`、`shouldStopAfterTurn`、`transformContext`
- [x] 测试：注入 fake StreamFn（同步 yield 预定义事件），断言事件序列和最终消息列表
- [x] 测试：注入 fake 工具（echo tool），断言工具被调用且结果正确追加到消息列表
- [x] 测试：fake StreamFn 返回 stopReason: "error"，断言循环优雅退出且不抛异常