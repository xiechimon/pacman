---
labels: [wayfinder:research]
parent: map.md
---

---
status: closed
resolution: see below
---

## Question

Pi 的 AgentMessage 管线有两阶段（`transformContext` → `convertToLlm`），支持自定义消息类型和 declaration merging。在去掉扩展系统后：

1. 我们需要哪些 AgentMessage 类型？（user/assistant/toolResult/bashExecution 是否足够？）
2. 是否还需要两阶段管线，还是单阶段直转？
3. Anthropic API 的 tool use content block 如何映射到我们的消息模型？

---

## Resolution

1. **AgentMessage 类型：3 种** — `user | assistant | toolResult`。Pi 的 `bashExecution`/`custom`/`branchSummary`/`compactionSummary` 全部是为扩展和分支会话服务的，砍掉。bash 就是普通工具，结果走 `toolResult`。

2. **单阶段管线** — `transformContext` 的唯一用途是扩展链式变换消息，无扩展时它是恒等函数。合并为 `messagesToProvider(messages, maxTokens?)` 一个函数，3 种标准角色 1:1 映射到 Anthropic 格式。

3. **直接解析 Anthropic content block** — 不用 Pi 的 5 事件 streaming 归一化层（toolcall_start/delta/end）。assistant 消息到达后直接遍历 content block 数组，提取 tool_use block，执行工具，结果追加为 toolResult 消息。Declaration merging 砍掉——消息联合类型在编译时封闭。

详见 [02-agentmessage-pipeline-findings.md](02-agentmessage-pipeline-findings.md)