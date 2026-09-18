# r9-pi-sdk — pi SDK 能力面近读（AgentSession/tools/ModelRuntime/缝）

- 票：xiechimon/pacman #33（研究），为「pi SDK 有的用 pi、没有的走作者」政策提供设计票改写输入。
- 对象钉版：`github.com/earendil-works/pi` @ tag `v0.85.1`（2026-09-18 clone 到 `/tmp/pi-src`；npm `@earendil-works/pi-coding-agent@0.85.1` = dist-tag `latest`，另有 `legacy-node20 → 0.74.2`，npm view 实测 2026-09-18）。`@earendil-works/pi-ai` 同为 0.85.1。
- 引用约定：`path:line` 相对 pi monorepo 根，`packages/` 前缀省略（如 `coding-agent/src/core/agent-session.ts:1946` = `packages/coding-agent/src/core/agent-session.ts`）。行号来自 v0.85.1 实读。外部 URL 带访问日期。推断显式标注【推断】。
- 对照基线：本 repo `docs/research/r2-agent-core.md`（nanobot agent core）、`r3-tools-mcp-cron.md`（tools/MCP/cron）、`r4-providers-config-security-cli.md`（providers/config/security）。
- 落盘方式：分段写入，每段独立 commit，防中断。

## S0 结构总览（先读这个）

pi monorepo 相关包（`packages/`）：

| 包 | npm 名 | 职责 |
|---|---|---|
| `agent` | `@earendil-works/pi-agent-core` | 低层 agentLoop 函数 + `Agent` 有状态包装 + **`harness/`（AgentHarness：lane/operation/事务性 JSONL session/恢复重放）** |
| `ai` | `@earendil-works/pi-ai` | 模型/provider 抽象：`streamSimple`、~40 个 provider、模型 catalog、OAuth、`transformMessages` |
| `coding-agent` | `@earendil-works/pi-coding-agent` | `AgentSession`/`AgentSessionRuntime`/`SessionManager`/`ModelRuntime`/extension 系统/内置 tools/三种 run mode（interactive TUI、print、RPC）/`main()` CLI |
| `tui` | `@earendil-works/pi-tui` | 终端 UI 组件库 |
| `server`/`protocol`/`session-backends` | — | 会话服务器/协议（CBOR framing）/会话后端，围绕 harness【推断：由 experimental worker 消费，见 S1.5】 |
| `chord` | `@earendil-works/chord` | JSON 表示层工具（harness 依赖，`agent/src/harness/agent-harness.ts:1`） |
| `evals`/`client`/`telemetry` | — | 评测/客户端/遥测 |

**两层 SDK 并存（本票最重要结构事实）**：
1. **AgentSession 层**（coding-agent，产品化、被 CLI/TUI/RPC 使用）：`createAgentSession()`（`coding-agent/src/core/sdk.ts:173`）→ `AgentSession`（事件、排队、压缩、重试、扩展、持久化到 SessionManager JSONL tree）。
2. **AgentHarness 层**（pi-agent-core `harness/`，从包根公开导出，`agent/src/index.ts:41-76`）：operation/lane 模型 + **事务性持久化 + 崩溃恢复 + 受控重放（`replay:"safe"`）+ deferred/suspend**。coding-agent 中仅 `src/experimental/`（session-worker、mini/worker、services/worker）与 `evals` 消费它（grep 实测，见 S1.5）。
- 【推断】harness 是 pi 演进中的下一代 durable runtime（代码注释出现里程碑代号 "M8"，`agent/src/harness/agent-harness.ts:74`），AgentSession 是当前稳定面。设计票必须两层都对照：上游必保语义大多在 harness 有原生同形物，在 AgentSession 层则部分是缝。

---

## S1 AgentSession / AgentSessionRuntime / Agent / harness —— 对照 r2 必保语义

### S1.1 事件目录

**核心 AgentEvent**（`agent/src/types.ts:431-446`，全集）：
`agent_start`、`agent_end{messages}`、`turn_start`、`turn_end{message,toolResults}`、`message_start{message}`、`message_update{message,assistantMessageEvent}`、`message_end{message}`、`tool_execution_start{toolCallId,toolName,args}`、`tool_execution_update{...,partialResult}`、`tool_execution_end{...,result,isError}`。
- 语义注记：`agent_end` 是最后一个事件，但被 await 的 listener settle 之后 agent 才 idle（`agent/src/types.ts:427-430`；`agent/src/agent.ts:323-330` `waitForIdle`）。

**AgentSessionEvent**（coding-agent 扩展，`coding-agent/src/core/agent-session.ts:144-185`，全集）：
上述（`agent_end` 变体带 `willRetry`）+ `agent_settled`、`queue_update{steering,followUp}`、`compaction_start{reason:"manual"|"threshold"|"overflow"}`、`compaction_end{reason,result,aborted,willRetry,errorMessage?}`、`entry_appended{entry}`、`session_info_changed{name}`、`thinking_level_changed{level}`、`auto_retry_start{attempt,maxAttempts,delayMs,errorMessage}`、`auto_retry_end{success,attempt,finalError?}`、`summarization_retry_scheduled/attempt_start{source}/finished`、`bash_execution_update{id?,delta}`。

**扩展事件面**（extension `pi.on(...)`，30 种，`coding-agent/src/core/extensions/types.ts:1257-1301` 全集）：
`project_trust`、`resources_discover`、`session_start/session_info_changed/session_before_switch/session_before_fork/session_before_compact/session_compact/session_compact_failed/session_shutdown/session_before_tree/session_tree`、`context`（LLM 调用前改 messages）、`before_provider_request`（改 payload）、`before_provider_headers`（原地改 headers，null=删除，types.ts:699-707）、`after_provider_response`、`before_agent_start`（可加 custom message + 覆盖 systemPrompt，types.ts:716-727,1156-1160）、`agent_start/agent_end/agent_settled`、`ui_prompt_start/end`、`turn_start/turn_end`、`message_start/update/end`（message_end 可整体替换消息，types.ts:1151-1154）、`tool_execution_start/update/end`、`model_select`、`thinking_level_select`、`tool_call`（可 block/terminate，input 可原地改，types.ts:939-954,1125-1134）、`tool_result`（可改 content/details/isError/usage）、`user_bash`（`!`/`!!` 前缀命令，可换 BashOperations 或整体接管，types.ts:1136-1142）、`input`（continue/transform/handled，types.ts:866-883）。

**harness 事件**（`HarnessEventPayload`，`agent/src/harness/agent-harness.ts:258-340`）：
`run_start/run_resume/run_suspend{deferred}/run_end{status:completed|aborted|failed}/operation_abort{steer,followUp}`、`fault`、`handler_error`、`turn_start/turn_end`、`retry_scheduled/retry_start/retry_end`、`message_start{recovery?}/message_update{frame?}/message_end{entryId?}`、`tool_start/tool_update/tool_end{terminate}`、`entry_added{entry}`、`queue_update`、`value_update`、`config_update`。带 `lane`/`runId` 维度，且 message 事件可标 `recovery:true`（恢复期合成消息，见 S1.4）。

对照 r2 §3.2（nanobot Progress/StreamDelta/StreamEnd/TurnEnd/Goal…）：pi 事件粒度**更细且类型化**（message_update 携带 provider 级 AssistantMessageEvent 增量），无 goal/runtime-admitted 类事件（nanobot 产品语义，pi 无处安放也不需安放——判定见 S7）。

### S1.2 消息排队（steering / follow-up / nextTurn）

- 双队列在 `Agent`：`steer(msg)`/`followUp(msg)`（`agent/src/agent.ts:283-290`），`PendingMessageQueue` 支持 `QueueMode "all" | "one-at-a-time"`（默认 one-at-a-time，`agent/src/agent.ts:125-159,231-232`；类型注 `agent/src/types.ts:44-50`）。
- 排水点（drain points）在低层 loop：steering 于**每个 turn 的 tool 执行完之后、下一次 LLM 调用之前**注入（`agent/src/agent-loop.ts:168,194-196,257`）；follow-up 于 **agent 即将停止时**注入并继续外层循环（`agent/src/agent-loop.ts:260-266`）；`prepareNextTurn` 可能长耗时（压缩），期间排入的 steering 会被补拉一次（`agent-loop.ts:191-196` 注释明言）。
- `AgentSession.prompt()` 流式期间必须显式给 `streamingBehavior: "steer" | "followUp"`，否则抛错（`coding-agent/src/core/agent-session.ts:1210-1222`；PromptOptions 定义 :242-253）。空闲期直接 `agent.prompt()`。
- 第三种投递 `deliverAs:"nextTurn"`（仅 sendCustomMessage）：随下一个用户 prompt 一起注入（`agent-session.ts:1482-1514,1270-1274`）。
- UI 可见队列状态：`queue_update` 事件 + `getSteeringMessages()/getFollowUpMessages()/pendingMessageCount/clearQueue()`（clearQueue 返回被清消息供编辑器恢复，`agent-session.ts:1582-1610`）。
- 运行结束后的续跑环：`_runAgentPrompt` = `agent.prompt()` 后 `while(_handlePostAgentRun()) agent.continue()`；`_handlePostAgentRun` 依次判 retry → compaction → 队列余量（`agent-session.ts:1105-1148`）。`agent.continue()` 从最后一个 user/toolResult 续跑；若最后是 assistant 则把排队消息当新 prompt（`agent/src/agent.ts:360-388`）。
- 对照 r2 #附4「不丢消息三件套」：pi 队列**无界无数组上限**（`PendingMessageQueue.messages: AgentMessage[]`，无 maxsize）且无 finally-回发机制（clearQueue 是显式 API）；「不静默丢失」由 queue_update 可见性 + abort 时 harness `AbortResult` 返还 steer/followUp（`agent-harness.ts:100-103`）承担。AgentSession 层 abort 不返还队列内容【推断：`agent.abort()` 不清队列，`clearAllQueues` 需显式调；实测代码路径 agent.ts:319-321 无 drain】。

### S1.3 abort 语义

- `Agent.abort()` = abort 当前 run 的 AbortController（`agent/src/agent.ts:318-321`）；signal 贯穿 streamFn（`agent-loop.ts:306-310`）与每个 tool `execute(toolCallId, params, signal, onUpdate)`（`types.ts:396-401`）。
- `AgentSession.abort()` = abortRetry + abortCompaction + abortBranchSummary + agent.abort + **await waitForIdle**（`agent-session.ts:1616-1632`）；`isIdle` = 无活跃 run 且不在压缩（:924-927）。
- 中断物化（AgentSession 层）：StreamFn 契约规定失败/中断**不得 throw**，必须以 `stopReason "error"|"aborted"` + errorMessage 的最终 AssistantMessage 收口（`agent/src/types.ts:22-27`）；loop 收到 error/aborted 即 `turn_end`+`agent_end` 终止（`agent-loop.ts:215-219`）；run 级异常由 `Agent.handleRunFailure` 合成同形 assistant 消息（`agent.ts:511-527`）。该消息经 `message_end` 持久化进 session（`agent-session.ts:673-691`）。
- tool 批内中断：sequential 模式在**当前 call 完结后 break**，剩余 toolCall **不生成 tool result**（`agent-loop.ts:442-479`，:476-478）；parallel 模式未启动的 call 合成 `"Operation aborted"` 错误结果（`agent-loop.ts:520-529`）。→ sequential abort 会在 transcript 留下未应答 toolCall（配对缺口，见 S1.6 判定 2）。
- 会话切换前强制物化：`AgentSessionRuntime.teardownCurrent` 先 `await session.abort()` 让被中断 turn（含 tool results）落盘再 dispose（`agent-session-runtime.ts:167-178` 注释明言动机）。
- 用户 `!` bash 的独立中断面：`abortBash()` + `_bashAbortControllers` 集合（`agent-session.ts:2983-3015,3050-3054`）。

### S1.4 compaction（触发/可配置性）与 harness 恢复

**AgentSession 层**（coding-agent）：
- 手动 `compact(customInstructions?)`：先 abort 当前 run，`session_before_compact` 扩展 hook 可 cancel 或**提供自定义 CompactionResult**，默认走 `compact()` 生成 LLM 摘要，`appendCompaction` 落盘为 tree entry，重建 `agent.state.messages`（`agent-session.ts:1946-2094`）。
- 自动触发三 case（`_checkCompaction`，`agent-session.ts:2111-2236`）：
  1. **overflow+retry**：context overflow 错误或可恢复 length 截断（`isContextOverflow/isRecoverableLength` 来自 pi-ai/compat，:1161-1162）→ 摘掉失败 assistant（保留在 session 历史）→ 压缩 → `agent.continue()` 重试**一次**（`_overflowRecoveryAttempted` 守卫，:2172-2201）。
  2. **overflow 无 retry**：成功响应但超出配置窗口 → 压缩不重试（:2166-2170）。
  3. **threshold**：`shouldCompact(contextTokens, contextWindow, settings)` 越线 → 压缩不重试（:2204-2234）；error/零 usage 消息用估算兜底，且防「压缩前旧 usage 误触发」（:2210-2228）。
- 运行中阈值检查：`prepareNextTurnWithContext` 在**下一次 assistant 响应前**做 `_compactBeforeNextAssistantResponse`（`agent-session.ts:542-583`）；prompt 提交前也检查一次（:1249-1254）。
- 可配置性：`settingsManager.getCompactionSettings()`（enabled 等，`agent-session.ts:2133-2134`；CompactionSettings/DEFAULT_COMPACTION_SETTINGS 导出于 `coding-agent/src/index.ts:28-50`，具体字段见 S3）；`setAutoCompactionEnabled`（:2436-2443）。压缩摘要有独立重试预算（复用 `settings.retry`，:2859-2888）。
- 摘要注入形态：compaction/branch summary 以 `<summary>` 包裹的 user 消息进 LLM 上下文（`coding-agent/src/core/messages.ts:11-24,148-196`）。
- 事件面：`compaction_start/compaction_end` + 扩展 `session_before_compact/session_compact/session_compact_failed`（types.ts:593-630）。
- 树导航弃分支摘要：`navigateTree({summarize})` → `generateBranchSummary`（`agent-session.ts:3113-3304`）。

**自动重试**（区别于压缩）：`_isRetryableError` = pi-ai `isRetryableAssistantError` 且非 context overflow（overflow 归压缩管，`agent-session.ts:2849-2857`）；指数退避 `baseDelayMs * 2^(attempt-1)`、`settings.retry.{enabled,maxRetries,baseDelayMs}`、重试前把 error assistant 摘出 agent state（session 历史保留）（:2890-2944）。

**harness 层（durable 恢复 = 上游 checkpoint 语义同形物）**：
- operation 状态机持久化：tool 执行前先 `publishToolIntent` 把 `effect_pending{replay}` 状态 + args 事务性写入（`agent/src/harness/runtime/drive/tools.ts:187-229`）——等价 r2 §4.8 `awaiting_tools` checkpoint。
- **中断物化不重放**：恢复时对 `effect_pending` 的 call，仅当 `!cancelled && call.replay==="safe" && tool.replay==="safe"` 才重放（`drive/tools.ts:520-533`）；否则合成 `interruptedOutcome` = checkpoint 内容 + 固定标记文本 `"[Tool execution was interrupted. The preceding output is the latest durable progress snapshot; newer live output may be missing, and the external outcome is unknown.]"`（`drive/tools.ts:44-45,158-168,534-537`）——与 r2 recovery.py 的 "Error: Task interrupted…" 语义**同形**。`replay` 是 `AgentTool` 公开字段：`"never"|"safe"`，缺省按 never（`agent/src/types.ts:402-403`；缺省回退 `drive/tools.ts:496`）。
- 取消未启动的 call → `abortedOutcome`（"Tool execution was cancelled before completion."，`drive/tools.ts:140-146`）；length 截断的 assistant → `truncatedOutcome` 全部 fail（`drive/tools.ts:170-181`；AgentSession 层同语义 `agent-loop.ts:227-233,379-404`）。
- assistant 请求中断 → 从**已提交的流 frame 前缀**合成 `stopReason:"error"` + 警告文本的最终消息，**不再发 provider 请求**（`agent/src/harness/runtime/drive/recovery.ts:22-87` `recoverAssistantGeneration`；取消路径 :89-127）。
- effect gate：drive pass 级准入闸（open/aborting/closed 三态，abort 时 throw `AbortRequested` 携带 cancellation promise，`agent/src/harness/execution/effect-gate.ts:1-64`）。
- abort 返还队列：harness `AbortResult` 携带 `{operationId, steer, followUp}`（`agent-harness.ts:100-103,172-179`）——r2「finally 回发」语义的 durable 版。
- 挂起/延迟：`run_suspend{reason:"deferred", deferred: DeferredHandle}`（`agent-harness.ts:260-261`）、`DriveOutcome waiting{retry|deferred}`（:166-170）；pi-ai 侧有 deferred tool 概念（anthropic-messages.ts:1203 附近 `deferredToolNames`）。

### S1.5 hooks/扩展点汇总 + AgentSessionRuntime

- **低层 loop 回调面**（`AgentLoopConfig`，`agent/src/types.ts:149-294`）：`convertToLlm`（AgentMessage→Message，必须不 throw）、`transformContext`（LLM 调用前 AgentMessage 级裁剪/注入）、`getApiKey(provider)`（每次调用动态解析，为过期 OAuth token 设计，:202-210）、`shouldStopAfterTurn`、`prepareNextTurn`（返回替换 context/model/thinkingLevel）、`getSteeringMessages`/`getFollowUpMessages`、`beforeToolCall`（block/reason/terminate）、`afterToolCall`（content/details/isError/usage/terminate 整体替换、无深合并，:71-95）、`toolExecution: "sequential"|"parallel"`。
- **Agent 实例级**：以上全部可赋值（public 字段，`agent.ts:179-214`）+ `streamFn`（provider 注入点）+ `onPayload/onResponse`（HTTP payload/响应拦截，`agent.ts:104-105`）+ `subscribe(listener)`（顺序 await，listener settle 属于 run settlement，`agent.ts:240-253,588-590`）。
- **AgentSession 装配**（`createAgentSession`，`coding-agent/src/core/sdk.ts:173-410`）：streamFn 包一层 settings 重试/超时 + `transformHeaders`（provider attribution + `before_provider_headers` 扩展 hook，:314-342）；`onPayload→before_provider_request`、`onResponse→after_provider_response`（:343-360）；`transformContext→runner.emitContext`（:362-366）；tool hooks 一次性安装、执行时读当前 `_extensionRunner`（热重载不换 hook，`agent-session.ts:478-540`）；`prepareNextTurnWithContext` 链式包装（压缩 + systemPrompt/tools/model 刷新，:561-583）。
- **AgentSessionRuntime**（`coding-agent/src/core/agent-session-runtime.ts:74-414`）：单活跃会话宿主。`switchSession/newSession/fork/importFromJsonl/dispose`；替换前 `teardownCurrent`（abort→session_shutdown 事件→beforeSessionInvalidate→dispose，:167-178）；fork 支持 `position:"before"|"at"`（before 要求目标是 user message，:279-287）；`session_before_switch/before_fork` 可 cancel（:133-165）。**没有多会话注册表/并发编排**——一个 runtime 一个 session。
- **harness 消费方现状**（grep 实测 2026-09-18）：`coding-agent/src/experimental/session-worker.ts`、`experimental/mini/worker/run.ts`、`experimental/services/worker.ts`、`evals/src/pi-harness.ts`。即 harness 的产品接线在 experimental 目录；`packages/server`（connection/listener/session-router/transports）+ `packages/protocol`（CBOR codec/framing）是其服务化配套【推断：由 src 目录名与依赖关系判断，未逐行验证】。

### S1.6 r2 必保语义逐条判定（六项清单）

| # | 上游语义（r2 出处） | pi 判定 | 依据 |
|---|---|---|---|
| 1 | **per-session 串行锁**（loop.py:1411-1418 锁 + pending queue） | **形变：单实例守卫，非锁**。`Agent.prompt/continue/reset` 在 activeRun 存在时**抛错**（不排队），串行由「拒绝并发」保证；排队语义移到显式 steer/followUp API。多会话=多 AgentSession 实例；跨会话并发编排（bus、全局 semaphore、per-session 锁表）**pi 无对应物**，属上层职责。harness 以 lane 为单位：一 lane 一 operation，冲突返回 `LaneBusy`（`agent-harness.ts:127-140`） | agent.ts:351-355,487-489,334-336；agent-session.ts:1210-1222；agent-harness.ts LaneBusy |
| 2 | **tool_call 配对校验**（manager.py 落盘清洗 loop.py:2151-2228 丢弃未声明/重复 tool result；recovery 合成 error result） | **部分，有缝**。防插队机制完备：custom message/bash 消息在流式期**延迟到 turn_end 后 flush**，注释明言「providers that validate message order reject on replay」（agent-session.ts:1505-1510,3034-3044,715-722）；`agentLoopContinue` 拒绝 assistant 结尾上下文（agent-loop.ts:75-77,132-134）；pi-ai 做 toolCallId 归一/null content 归一（ai/src/api/transform-messages.ts:64-95）与 openai-compat 的 assistant-after-toolResult 桥接（openai-completions.ts:1224-1231）。**但无孤儿 tool_call 修复**：sequential 批内 abort 后剩余 call 无 result（agent-loop.ts:476-478），SessionManager 回放不修补（session-manager.ts 无 repair 逻辑，grep 实测），anthropic 转换原样透传 tool_use（anthropic-messages.ts:1321-1327）→ 该 transcript 下轮请求会被 Anthropic 400 拒绝【推断：由 API 契约推得，未实测触发】。harness 层无此缝（恢复期合成 result，drive/tools.ts:158-168） | 见左 |
| 3 | **中断物化不重放**（recovery.py:276-350 "Error: Task interrupted…" 绝不重放执行） | **harness 原生有**（S1.4：effect_pending 意图先落盘、INTERRUPTION_MARKER 合成 result、仅双向 `replay:"safe"` 才重放、assistant 从已提交 frame 合成不再调 provider）。**AgentSession 层无**：abort 只物化 assistant（stopReason:"aborted"），未执行 toolCall 无合成 result；进程崩溃后无 checkpoint 恢复——重启即从 session tree 重放历史，无「物化中断」步骤 | drive/tools.ts:44-45,140-181,187-229,520-537；recovery.ts:22-127；agent-session.ts:1616-1632 |
| 4 | **concurrency_safe 工具分批**（execution.py:81-107 按 read_only/exclusive 连续分批 gather） | **形变：粒度更粗**。pi 是批级二选一：默认 parallel；批内**任一** tool 标 `executionMode:"sequential"` → 整批 sequential（agent-loop.ts:416-423）。parallel 模式：prepare（校验+beforeToolCall）按序、执行 Promise.all 并发、`tool_execution_end` 按完成序、toolResult 消息按原序（agent-loop.ts:487-561；types.ts:36-42 注记）。无 read_only/exclusive 推导，需作者自行给每个 tool 标 executionMode | types.ts:404-411；extensions/types.ts:472-479 |
| 5 | **AgentRunSpec 回调面**（runner.py:88-115：checkpoint/injection/continuation/consolidation 回调注入） | **同形物齐全**（S1.5）：injection→steering/followUp+nextTurn；continuation→shouldStopAfterTurn/prepareNextTurn/follow-up 环；consolidation→transformContext+compaction 系；checkpoint→**AgentSession 层无**（持久化节奏是 message_end 即 append，agent-session.ts:673-691），harness 层是事务性 operation state（drive/checkpoint.ts、session/commit.ts）。provider_state（r2 §3.5）无对应物：pi 消息即状态，thinking signature 留在消息内（transform-messages.ts:96-120） | 见左 |
| 6 | **contextvars turn 隔离**（context.py:23-26 RequestContext ContextVar；workspace scope） | **无对应机制，但不需要**。pi 工具执行上下文=显式参数：扩展/自定义 tool `execute(...,ctx: ExtensionContext)` 第 5 参（extensions/types.ts:481-488），ctx 携带 cwd/sessionManager/model/thinkingLevel/signal/abort 等（:309-349）；内置 tool 在创建期闭包 cwd（sdk.ts:2779-2782）。无 AsyncLocalStorage/全局环境态。多会话隔离靠对象边界（每 session 独立 Agent/registry）。bash 以 `PI_SESSION_ID/PI_SESSION_FILE/PI_PROVIDER/PI_MODEL/PI_REASONING_LEVEL` env 暴露会话元数据（tools/bash.ts:173-189，可经 `exposeSessionEnvironment:false` 关闭） | 见左 |

补充判定（r2 附录其余观察）：
- **持久化两层节奏**（r2 附3：全量原子重写 + sidecar checkpoint）：AgentSession 层是**单节奏 append**——每条 message_end 即 `sessionManager.appendMessage`（增量 append 到 JSONL tree，非全量重写，见 S3）；无 sidecar。harness 层是事务性 write batch（`session/jsonl/storage.ts:204,230` replayCommitted）+ pending entry 机制（`drive/tools.ts:250-260` pendingEntry/setValue）——两层节奏的 durable 等价物。
- **会话缓存/LRU、bus 无界队列、AutoCompact TTL 空闲压缩**：pi 无对应物（单活跃会话模型使 LRU 无意义；空闲 TTL 压缩不存在——压缩只在运行边界触发）。dream/memory 子系统 pi 完全没有（见 S7 缺口）。

---

## S2 tool 接口（对照 r3 S1/S2）

### S2.1 defineTool/ToolDefinition 契约

**`ToolDefinition`**（`coding-agent/src/core/extensions/types.ts:451-500`）字段全集：
- `name`（LLM 调用名）、`label`（UI）、`description`（LLM）
- `promptSnippet?`（进 system prompt "Available tools" 段的一行简介）、`promptGuidelines?`（进 Guidelines 段的 bullets）——**工具自带 prompt 贡献**是 pi 特有（:458-461；消费点 agent-session.ts:2705-2720,1065-1099）
- `parameters: TSchema`（**TypeBox** schema，非 JSON Schema 手写；`defineTool` 保留参数类型推断，:511-515）
- `constrainedSampling?: false | ConstrainedSamplingConfig`（provider 侧约束采样，:464-465；bash 默认启用 `getExperimentalToolSampling()`，tools/bash.ts:239）
- `renderShell?`、`renderCall?`、`renderResult?`（TUI 渲染钩子，:466-467,490-499）
- `prepareArguments?`（schema 校验前的兼容 shim，:469-470）
- `executionMode?: "sequential"|"parallel"`（:472-479）
- `execute(toolCallId, params: Static<TParams>, signal, onUpdate, ctx: ExtensionContext)` → `Promise<AgentToolResult<TDetails>>`（:481-488）

**`AgentToolResult`**（`agent/src/types.ts:361-376`）：`content: (TextContent|ImageContent)[]`（回给模型）、`details: T`（结构化，给 UI/日志，不进 LLM 上下文）、`usage?`、`addedToolNames?`（本 result 之后可用的新 tool——动态工具面）、`terminate?`（批内全部 terminate=true 才提前停，:371-375；agent-loop.ts:589-591）。

**错误语义**：`execute` **throw on failure**（「Throw on failure instead of encoding errors in content」，`agent/src/types.ts:395`）；loop 捕获转 `isError:true` 的 error tool result（`agent-loop.ts:677-717`），异常消息文本即 result 文本。对照 r3（nanobot `ToolResult.error` str 子类 + registry/execution 双层兜底 + "[Analyze the error above…]" 追加提示）：pi 无「错误后引导语」追加，无语义分级（SSRF/workspace 越界标记等在 pi 不存在——沙箱策略本身就是缝，见 S2.3/S7）。

**校验**：`validateToolArguments(tool, toolCall)`（pi-ai 导出，`agent-loop.ts:625`）按 TypeBox schema 校验，失败→immediate error result（:668-674）；未知 tool→"Tool X not found"（:614-621）。无 nanobot 的 cast_params 宽松转换/`{"arguments":...}` 解包/Did-you-mean（r3 registry.py:149-185 语义在 pi 不存在）。

**注册路径**（三条）：
1. SDK `customTools: ToolDefinition[]`（`sdk.ts:76,395`；sourceInfo 标 `<sdk:name>`，agent-session.ts:2680-2686）
2. 扩展 `pi.registerTool(definition)`（extensions/types.ts:1307-1310；运行期 `refreshTools()` 重建 registry，agent-session.ts:2612,2671-2762）
3. 内置 8 工具经 `createAllToolDefinitions(cwd, options)`（agent-session.ts:2779-2782）
- allowlist/denylist：`tools?: string[]`、`excludeTools?: string[]`、`noTools:"all"|"builtin"`（sdk.ts:55-74）；默认激活 `["read","bash","edit","write"]`（sdk.ts:256；agent-session.ts:2808-2810）。
- 同名覆盖：extension/custom tool **覆盖**内置（registry map set 顺序：builtin 先、custom 后，agent-session.ts:2733-2736）——与 nanobot「plugin 撞 builtin 则跳过」相反。
- 动态启用面：`setActiveToolsByName`（重建 system prompt，下轮生效，agent-session.ts:964-985）；tool result `addedToolNames` 支持渐进暴露。

### S2.2 内置工具清单与可替换性（沙箱注入点）

内置 8 个：`read, bash, powershell, edit, write, grep, find, ls`（`coding-agent/src/core/tools/index.ts:95-105`）。每个都有 `createXxxTool(cwd, options)`（AgentTool）与 `createXxxToolDefinition(cwd, options)`（ToolDefinition）双工厂 + **Operations 接口注入**：

| tool | Operations 接口 | 注入选项 | 出处 |
|---|---|---|---|
| bash | `BashOperations.exec(command, cwd, {onData,signal,timeout,env}) → {exitCode}` | `options.operations`、`spawnHook: (ctx{command,cwd,env})→ctx`、`commandPrefix`、`shellPath`、`exposeSessionEnvironment` | tools/bash.ts:59-77,194-205 |
| powershell | `PowerShellOperations` + SpawnHook | 同上 | tools/index.ts:45-55 |
| read/edit/write/grep/find/ls | `ReadOperations/EditOperations/WriteOperations/GrepOperations/FindOperations/LsOperations` | 各自 options | tools/index.ts:12-80（接口导出） |

- **沙箱注入点结论**：上游 bwrap/seatbelt 矩阵（r3 S1 sandbox.py 的命令字符串包装语义）有**两个官方挂点**：
  1. `BashOperations`——docstring 明言 "Override these to delegate command execution to remote systems (for example SSH)"（tools/bash.ts:55-58）。作者可实现 `createSandboxedBashOperations()`：把 command 包进 `bwrap …` / `sandbox-exec -p …` 再交给本地 spawn，即完整复刻 r3 `_wrap_<name>` 后端表；`AgentSession.executeBash` 也接受 per-call `options.operations`（agent-session.ts:2981-3000），`user_bash` 扩展事件可返回替换 operations 或整体接管（extensions/types.ts:1136-1142）。
  2. `BashSpawnHook`——更轻：只改 `{command, cwd, env}` 三元组（tools/bash.ts:158-192），包装命令字符串即可，无需自管进程。
- 本地默认实现 `createLocalShellOperations`：detached spawn（非 win32）、进程树 kill（`killProcessTree`）、timeout→kill 进程树、abort→kill、cwd 存在性检查、输出经 `OutputAccumulator` 截断（尾 `DEFAULT_MAX_LINES` 行或 `DEFAULT_MAX_BYTES`，全量存 temp 文件并给路径）（tools/bash.ts:79-146,235,307-335）。**无 deny patterns、无路径围栏、无 SSRF 检查**——r3 的 `_guard_command` 全套（allow/deny、path traversal、内网 URL）在 pi 内置 bash 不存在；需要作者在 Operations/spawnHook/beforeToolCall 三选一中自建（判定见 S7）。
- bash 错误语义映射：exit≠0 → **throw** `Error(output + "Command exited with code N")`（tools/bash.ts:364-366）→ loop 转 isError result；abort → throw "…Command aborted"；timeout → throw "…timed out after Ns"（:349-359）。对照上游 `ToolResult.error`：pi 的 `isError:true` + content 文本即同形物；`details` 承载结构化截断信息（`BashToolDetails{truncation,fullOutputPath}`，:50-53）。
- 流式部分结果：`onUpdate` 节流推送（BASH_UPDATE_THROTTLE_MS，tools/bash.ts:255-299）→ `tool_execution_update` 事件。
- 文件工具写序列化：`withFileMutationQueue`（tools/file-mutation-queue.ts，导出 index.ts:20）——文件变更排队【推断：跨 tool 实例的 mutation 串行化，未逐行读】。
- **整体替换内置工具**：`AgentSessionConfig.baseToolsOverride: Record<string, AgentTool>`（agent-session.ts:219-225,2772-2778）——完全绕开内置定义，用任意 AgentTool 顶替 `read/bash/edit/write` 等名字。

### S2.3 与上游 ToolResult.error 语义映射表

| nanobot（r3 S1） | pi 对应 | 判定 |
|---|---|---|
| `ToolResult(str)+is_error` | `AgentToolResult.content` + loop 级 `isError`（throw→isError:true） | 同形，方向相反（pi 用 throw） |
| registry/execution 双层异常兜底 | `executePreparedToolCall` try/catch（agent-loop.ts:708-717） | 有 |
| "[Analyze the error above…]" 追加 | 无 | 缝（可 afterToolCall/tool_result hook 补） |
| cast_params/validate（additionalProperties:false） | TypeBox `validateToolArguments`；prepareArguments shim | 有（ stricter，无宽松 cast） |
| concurrency_safe=read_only∧¬exclusive | `executionMode` 手工标注 | 形变（S1.6#4） |
| 错误分级（SSRF 标记、workspace 越界计数） | 无 | 缝（作者策略层自建） |
| MCP wrapper 超时/瞬态重试 | 无内置 MCP（见 S5） | 缺口 |
