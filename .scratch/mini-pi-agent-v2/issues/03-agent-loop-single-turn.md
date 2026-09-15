---
labels: [wayfinder:research]
parent: map.md
---

---
status: closed
resolution: see below
---

## Question

Pi 的 agent 循环是双 while（内层工具调用链 + 外层 followUp），有完整的 turn/message/tool 事件生命周期。在 MVP 单轮（一问一答）场景下：

1. 哪些循环结构可以去掉？（followUp 队列、steering 消息、stop 边界恢复）
2. 事件生命周期需要保留哪些？（AgentStart/TurnStart/MessageStart/Update/End/ToolStart/ToolResult/TurnEnd/AgentEnd 全保留还是精简？）
3. 并行工具执行在单轮场景是否需要？

---

## Resolution

1. **单层 `while (hasMoreToolCalls)` 循环** — 外层 followUp 和内层 steering 队列全部砍掉，单轮无并发用户交互。Pi 的 `prepareNextTurn`（动态模型切换/上下文变更 mid-run）也砍。

2. **事件精简** — 保留 8 种：`agent_start/end`、`turn_start/end`、`message_start/update/end`、`tool_execution_start/end`。砍掉 `tool_execution_update`（工具流式进度）。

3. **MVP 串行执行工具** — 并行需要 Promise.all + 结果重排 + 提前终止逻辑（terminate），MVP 不需要。串行 for 循环足够。

4. **Harness 全砍** — Pi 的 ~5360 行 Harness 代码（intent-settlement、accept/drive、11 hooks、compaction、recovery、lane storage）全部不进入 MVP。Agent 级别的 4 个回调（`beforeToolCall`、`afterToolCall`、`shouldStopAfterTurn`、`transformContext`）保留为简单 callback，~500 行等价。

详见 [03-agent-loop-single-turn-findings.md](03-agent-loop-single-turn-findings.md)