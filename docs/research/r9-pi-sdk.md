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

---

## S3 SessionManager —— JSONL tree 格式与上游 schema 兼容度

### S3.1 coding-agent SessionManager（AgentSession 层持久化）

- **文件格式**：JSONL，**树结构**。`CURRENT_SESSION_VERSION = 3`（`coding-agent/src/core/session-manager.ts:30`）。首行 header `{type:"session", version, id(uuidv7), timestamp, cwd, parentSession?}`（:32-39）；其后每行一个 entry，**每条 entry 带 `id`（8-hex 短 uuid，冲突重试）+ `parentId`**（:46-51,220-228）——同一文件内多分支共存，`leafId` 指针决定当前分支（:1374-1394）。
- **entry 类型全集**（:144-153）：`message`（AgentMessage 原样）、`thinking_level_change`、`model_change`、`compaction{summary,firstKeptEntryId,tokensBefore,details?,usage?,fromHook?}`（:69-80）、`branch_summary{fromId,summary,...}`（:82-92）、`custom{customType,data}`（**不进 LLM 上下文**，扩展状态持久化，:94-108）、`custom_message{customType,content,details,display}`（**进上下文**转 user 消息，:123-141）、`label{targetId,label}`（书签，:110-115）、`session_info{name}`（:117-121）。
- **上下文重建**：`buildSessionContext(entries, leafId)` = leaf→root 路径反转（:334-360）→ compaction-aware 裁剪（最新 compaction entry + firstKeptEntryId 起的保留段 + 之后全部，:410-454）→ `sessionEntryToContextMessages` 投影（:379-408；null content 归一 :386-393）+ 路径上的 model/thinkingLevel 状态折叠（:362-377）。
- **文件命名/目录**：`<ISO时间戳(:.→-)>_<sessionId>.jsonl`（:947-951）；默认目录 `~/.pi/agent/sessions/--<cwd 路径编码(/,\:→-)>--/`（:476-489）。
- **写入节奏**：每 entry `appendFileSync` 一行（:1029-1056）。**懒创建**：第一条 assistant 消息到达前不落盘（内存缓冲，`flushed` 状态机；文件以 `wx` 一次性写入全部缓冲 entry）——空会话不产生文件。**无文件锁、无 fsync、无原子重写**（对照 r2 §附3 nanobot FileLock+原子重写+sidecar 分层：pi 是纯 append-only 单节奏）。迁移时才 `_rewriteFile`（:993-1003）。
- **损坏容错**：坏行跳过（:503-511）；末行不完整补 `\n`（:548-556）；header 非法则整体拒读（:550-553）。
- **版本迁移**：v1→v2 补 id/parentId + firstKeptEntryIndex→Id（:230-257）；v2→v3 hookMessage→custom role（:259-275）。
- **fork/branch 家族**：`branch(id)`/`resetLeaf()`（同文件内切 leaf，:1374-1394）；`branchWithSummary`（弃分支摘要 entry，:1395-1420）；`createBranchedSession(leafId)`（**提取单路径到新文件**，label entry 去除后重链 parentId，:1421-1470）；`static forkFrom(sourcePath, targetCwd)`（全量复制 entry 到新文件、header 记 parentSession，:1611-1662）；`static open/create/continueRecent/inMemory/list/listAll`（:1551-1700+）。`inMemory(cwd, options, entries)` = 无持久化实例（:1600）。
- **与上游 schema 兼容度判定**（对照 r2 §3.3）：
  - metadata 行 → pi 分散为 `session_info`/`label`/`custom` entry + header.cwd/parentSession；上游 per-session metadata dict 可用 `custom` entry 承载（扩展已在用此机制存状态）。
  - provider_state 行 → **无对应物**（pi 无 provider conversation state 概念；thinking signature 等留在 message 内）。
  - checkpoint sidecar → **无对应物**（AgentSession 层）；harness 层的事务性 pending entry/operation state 是其 durable 等价（S1.4；`agent/src/harness/session/jsonl/storage.ts:204,230` 事务重放、`drive/tools.ts:250-260` pendingEntry）。
  - 消息回放保留键（tool_calls/thinking_blocks 等）→ pi 消息是结构化对象原样落盘（AgentMessage 联合类型），无需保留键清单。
  - 上游「会话 key = channel:chat_id、base64url 文件名、workspace 命名空间、0600/0700 权限」→ pi 是「cwd 命名空间 + 时间戳文件名」，**无会话 key 概念、无权限收紧**（grep 未见 chmod；对照 r2 manager.py:565-566,606）——多租户/多渠道会话索引属上层职责（缝）。
- **自定义后端可行性**：SessionManager 是具体类非接口，但 `createAgentSession({sessionManager})` 可注入任意实例（sdk.ts:81-82,183）；`inMemory` 证明可脱离文件。彻底换后端 = 复制 SessionManager 公开面（ReadonlySessionManager Pick 清单 :190-206 是最小读面）。SettingsManager 有正式 `SettingsStorage` 抽象（`SettingsManager.fromStorage`，settings-manager.ts:352-355）——settings 可换后端，session 不可（判定：session 后端要 fork/重写，settings 不用）。

### S3.2 harness session（durable 层，对照参考）

- 独立于 coding-agent SessionManager：`agent/src/harness/session/`（types/commit/fork/memory/mutation-line/fork-policy）+ `session/jsonl/`（codec/repo/storage/legacy-v3）。存储是 **value/事务模型**：`Write`（setValue/deleteValue）、`replayCommitted` 重放已提交事务（jsonl/storage.ts:204,230）、pending entry 两阶段提交（drive/tools.ts:250-260 settle 时 `pendingEntry` 转正 + 删除 memo）。
- Entry 模型带 `Operation/OperationState/OperationResultRecord`、`InboxItem`（steer/followUp/nextRun/write 四种队列项持久化，`agent-harness.ts:229-247`）、lane 配置值。session 不变量错误类型化：`SessionInvariantError/SessionPendingAssistantMessageError`（lane.ts:36-37 import）。
- `legacy-v3.ts` 表明 harness 可读 coding-agent v3 JSONL【推断：文件名与迁移用途，未逐行验证】。

---

## S4 ModelRuntime / pi-ai —— provider、OAuth、catalog、timeout/cancel、fallback

### S4.1 ModelRuntime（coding-agent）

- `ModelRuntime implements Models`（pi-ai 集合接口，`coding-agent/src/core/model-runtime.ts:130`）。`ModelRuntime.create({credentials?, authPath?, modelsPath?, modelsStore?, allowModelNetwork?, modelRefreshTimeoutMs?, catalogBaseUrl?, signal?, refreshOnCreate?})`（:66-82,172-217）。
- **三层 provider 组合**（`recomposeProvider`，:245-267）：builtin（pi-ai `providers/all` catalog）← `models.json` 配置 overlay（ModelConfig）← extension 注册（`registerProvider(name, ProviderConfigInput)` 或 `registerNativeProvider(Provider)`，:741-794；合并语义：重注册 merge 已定义值，:755-762）。组合失败记录 `compositionErrors` 并回退 base（:262-266），`getError()` 聚合诊断（:426-435）。
- **openai-compat 自定义 baseUrl/模型注入**：两条正路——① `models.json`（`~/.pi/agent/models.json`，config.ts:543）里的 provider 配置（baseUrl/apiKey/models）；② 扩展 `pi.registerProvider("my-proxy", {baseUrl, apiKey:"$ENV_VAR", api:"openai-completions"|"openai-responses"|"anthropic-messages"|…, models:[{id,name,reasoning,input,cost,contextWindow,maxTokens,headers?,compat?}], headers?, authHeader?, streamSimple?, refreshModels?, oauth?})`（extensions/types.ts:1434-1556 完整契约与示例；apiKey 支持 `$ENV`/`${ENV}`/`!command` 插值 :1518-1519）。**`streamSimple` 字段 = 完全自定义 wire 协议的官方注入点**（:1522-1528，须回调 onPayload/onResponse）。
- **认证**：`getAuth(model|providerId, overrides)` 每请求解析（含 OAuth 刷新、`minOAuthValidityMs` 默认 5 分钟，:84-89）；credential 操作按 provider 串行队列（`enqueueCredentialOperation`，:494-512）；`login(providerId, type, interaction)`/`logout`；`setRuntimeApiKey/removeRuntimeApiKey`（进程内 key，不落盘）；凭据源优先级 runtime > stored > configured > environment（`getProviderAuthStatus`，:561-571）；同步失败类型化 `CredentialSynchronizationError`（凭据已提交但快照失败，:93-111）。存储：`~/.pi/agent/auth.json`（AuthStorage，config.ts:548）。
- **Anthropic OAuth 原生**：pi-ai `auth/oauth/` 有 `anthropic.ts`（Claude 订阅 OAuth）、`openai-codex.ts`、`github-copilot.ts`、`xai.ts`、`kimi-coding.ts`、`openrouter.ts`、`radius.ts`、`device-code.ts`、`pkce.ts`（目录清单实测）。`isUsingOAuth/isUsingSubscription`（model-runtime.ts:458-464）。
- **catalog 更新机制**：内置模型表是**生成代码**（`ai/src/models.generated.ts` + 每 provider `*.models.ts`；`getBuiltinModelDataGeneratedAt()` 时间戳，providers/all.ts:74）；运行时叠加 **pi.dev 远程 catalog overlay**（`withRemoteCatalog`：默认 `https://pi.dev`，4h 刷新间隔，ETag 304 重验证，持久化到 `models-store.json`，本地生成时间新于远程则忽略，`coding-agent/src/core/remote-catalog-provider.ts:1-80+`）；`PI_OFFLINE` env 关闭模型网络（model-runtime.ts:196）；`allowModelNetwork` 默认 false（create 时不联网，:73-74,200）。动态 provider 可自实现 `refreshModels(context)`（含 `publish({persist})` 世代检查发布，ai/src/models.ts:44-61,131-138）。
- **timeout/cancel**：每请求 `ProviderRequestOptions{signal, timeoutMs, maxRetries, maxRetryDelayMs(默认60s，服务器要求更长延迟→立即失败交上层), fetch(自定义 fetch 注入), env(provider 级环境覆盖), headers(null=删默认头), onPayload, onResponse}` + `StreamOptions{temperature, samplingParams(任意 body 参数直merge——llama.cpp/vLLM 定制点), maxTokens, transport:"sse"|"websocket"|"websocket-cached"|"auto", cacheRetention, sessionId, websocketConnectTimeoutMs, metadata}` + `SimpleStreamOptions{toolChoice, reasoning, deferred, thinkingBudgets}`（ai/src/types.ts:124-243,314-321）。coding-agent 侧默认值来自 settings：`httpIdleTimeoutMs`（0→2^31-1 技巧，sdk.ts:315-321）、`providerRetry{timeoutMs,maxRetries,maxRetryDelayMs}`、`websocketConnectTimeoutMs`（settings-manager.ts:890-914）。
- **重试**：pi-ai `utils/retry.ts` 词表分类（retryable：overloaded/rate-limit/429/5xx/524/网络词表含 ENOTFOUND/socket hang up 等；non-retryable：quota/billing/订阅限额，:7-60+）；`isRetryableAssistantError` 供 AgentSession 自动重试（S1.4）。**SDK 客户端 maxRetries 与 AgentSession 层 auto-retry 双层**（settings.retry 默认 enabled/maxRetries 3/baseDelayMs 2000 → 2s/4s/8s，settings-manager.ts:31-33）。
- **fallback 判定**：**pi 无 FallbackProvider 同形物**（grep 全仓无 provider 级 failover 链；`AnthropicAllowedFallbackModel` 是 Anthropic wire 协议自身的 fallback 模型字段，ai/src/types.ts:307,723，与上游 `agents.defaults.fallback_models` 语义无关）。模型失败转移需上层自建：可行挂点 = 自定义 `streamFn`（Agent.streamFunction 可替换，agent.ts:181,222）或 `shouldStopAfterTurn`+`setModel`+`continue()` 组合，或扩展 `registerProvider` 包一个内部做 failover 的 provider【推断：由接口面推得的构造方案，非仓内现成物】。
- **deferred/长任务**：`streamDeferred/fetchDeferred/cancelDeferred`（provider 可选能力，model-runtime.ts:647-679）+ `SimpleStreamOptions.deferred:{window:"15m"|"1h"|"24h"}`（ai/src/types.ts:317-318）+ harness `run_suspend{deferred}`（S1.4）——上游无同形物，是 pi 多出的能力面（OpenAI Codex 类异步任务）。
- **radius**：内置 gateway provider（`radiusProvider({id,name,gateway})`，models.json 里 `oauth:"radius"`+baseUrl 触发动态实例化，model-runtime.ts:186-188,219-234）——pi 自家的多 provider 网关【推断：由 configureRadiusProviders 逻辑判断】。

---

## S5 MCP 判定

- **pi 核心零 MCP**：coding-agent/agent/ai 三包源码 grep "mcp" 仅两处无关命中（`coding-agent/src/utils/tool-result-images.ts:15` 注释提 "MCP bridges" 作为图片来源例子；anthropic oauth 无关文件）。官方文档 pi.dev/docs/latest/sdk 与 /extensions 均**不含 MCP 字样**（WebFetch 实测 2026-09-18）；extensions 文档定位「Extensions are TypeScript modules that extend pi's behavior」，即**扩展体系是 pi 唯一官方可扩展机制**。
- **社区一等替代品**：`pi-mcp-adapter`（npm，v2.34.0，2026-09-14 发布；repo nicobailon/pi-mcp-adapter：1490 stars、2026-09-15 push、MIT、10 open issues，gh api 实测 2026-09-18）。以 pi extension 形式把 MCP server 的 tools 桥接进 pi（keywords 含 `pi-package`，走 pi 自带 npm/git 包管理器分发，`coding-agent/src/core/package-manager.ts:101,139`）。周边生态已出现（`pi-figma-remote-auth`、`@geohar/pi-mcp-combiner`，npm search 实测）。
- **判定**：MCP = 「非一等、社区成熟」。对照 r3 S3（nanobot 内建 MCPProvider：三类 wrapper、OAuth、SSRF/DNS pinning、重连、webui presets）——pi 核心完全没有这层；若政策需要 MCP，路线是 a) 依赖 pi-mcp-adapter（社区维护、版本跟随 pi 快）或 b) 作者用官方 `@modelcontextprotocol/sdk` 自写 defineTool 桥（可控但自担 r3 S3 全部语义：超时/瞬态重试/terminated 重连/命名 sanitize/OAuth）。pi 扩展 `registerTool` 的动态注册/注销面足够承载 wrapper 模式（S2.1）。

---

## S6 版本策略 / license / Node 矩阵

- **发布节奏（gh api releases 实测 2026-09-18）**：极快。2026-06 以来 minor 约每周一个：0.80.0（6/23）→ 0.81.0（7/21）→ 0.82.0（7/24）→ 0.83.0（7/29）→ 0.84.0（8/6）→ 0.85.0（9/4），patch 高频（0.80.x 十个、0.79.x 十个）。latest = v0.85.1（9/5，研究日 13 天前）。repo pushed_at 2026-09-18（当天），106,689 stars。
- **0.x breaking 常态化**：v0.85.0 release notes 自带 "Breaking Changes" 段（gh api 实读）：`AgentHarness`/v2 session **从 experimental 子路径提升为 pi-agent-core 默认导出并删除 experimental 子路径**；删除 legacy JSONL/in-memory repo API（改 v4 `JsonlSessionRepo`/`InMemorySessionRepo` + `SessionRepo` 契约）；`ModelsStreamTransforms`→`ModelsRequestTransforms` 更名。0.81 曾把 `streamFn` 变为必填（`coding-agent/src/core/sdk.ts:34-37` "Preserve the pre-0.81 fallback" 注释为证）。仓内无 CHANGELOG 文件，变更记录只在 GitHub Releases。
- **对本票的含义**：harness 于 0.85.0（2026-09-04）刚转正——「AgentSession 稳定面 + harness 新默认导出」并存是当前快照；钉版策略必须精确到 patch（craft 即钉 `0.85.1` 三等号，见 S7），升级要过 release notes 的 Breaking 段。
- **license**：MIT（`LICENSE`，Copyright (c) 2025 Mario Zechner）。全 monorepo 包一致【推断：以 coding-agent package.json `"license":"MIT"` 与根 LICENSE 为据，未逐包核对】。
- **Node 支持矩阵**：所有包 `engines.node >= 22.19.0`（十处 package.json grep 实测一致）；npm dist-tag `legacy-node20 → 0.74.2`（冻结线，npm view 实测）。craft 用 bun 构建 target bun（S7）。

---

## S7 嵌入实例近读：craft-ai-agents/craft-agents-oss `packages/pi-agent-server`

- **形态**：`@craft-agent/pi-agent-server@0.13.3`（Apache-2.0），「Out-of-process Pi agent server communicating via JSONL over stdio」——**没用 pi 的 RPC mode**，自建 stdio JSONL 协议与宿主进程通信；bun build --target=bun；依赖**精确钉版** `@earendil-works/pi-{coding-agent,agent-core,ai}: 0.85.1`（package.json 实读 2026-09-18，gh api main 分支）。
- **会话装配**（`src/index.ts:583-757` ensureSession）：
  - 全内存模型运行时：`ModelRuntime.create({credentials: InMemoryCredentialStore, modelsPath: null, modelsStore: InMemoryModelsStore})`——无 auth.json/models.json 文件 IO、create 时不联网（index.ts:544-548）；宿主凭据经 `adaptCredentialForPiSdk` 写入 store（`credentials.modify(provider,…)`，index.ts:527-540）；模块级缓存 runtime+registry，注释明确「RuntimeCredentials 读穿 store 不缓存，token_update 立即可见」（index.ts:503-512）。
  - 自定义 openai/anthropic-compat 端点：`registry.registerProvider('custom-endpoint', {baseUrl, apiKey, api, authHeader:true, models:[…]})`；**registerProvider 是整体替换语义**，craft 自维护全量 model id Set 每次全量传（index.ts:461-497）。
  - 工具面：**不用 pi 内置实例**，重新 `createReadToolDefinition(cwd)` 等 7 个 + 自制 web_search/web_fetch（pi 无内置 web 工具）+ proxy tools，全部 `wrapToolsWithHooks` 后经 `customTools` 传入，`tools` allowlist 给全名单（index.ts:619-650）。注释记录 SDK 0.70.0 契约坑：「customTools 收 ToolDefinition[]；tools 必须是 string[]，传对象会静默零工具；同名 custom tool 在 `_refreshToolRegistry` 覆盖内置实现」（index.ts:619-627）——与 S2.1 源码判定一致。
  - 权限：wrapSingleTool 内 execute 前 `requestPreToolUseApproval(sdkToolName, input, toolCallId)` stdio 握手到宿主进程（可改参/可 block），execute 后大响应摘要（阈值随 `agent.state.model.contextWindow` 动态取）（index.ts:788-880+）。
  - 设置隔离：`createCraftSettingsManager` = `SettingsManager.inMemory(buildCraftPiSettings())`，注释明确动机：默认 SettingsManager 会合并 `<cwd>/.pi/settings.json`（**工作目录里的 repo 能翻转 retry/compaction/tool 默认值**）并把 SDK 侧写入落到全局文件——嵌入式场景两者都不要（session-settings.ts 头注释实读）。retry 双层显式钉死：agent 层 {enabled,maxRetries:4,baseDelayMs:2000} + provider 层 {maxRetries:2,maxRetryDelayMs:60000}（Pi SDK provider 层默认 0）（session-settings.ts:33-52）。
  - 扩展隔离：`agentDir` 指到会话目录下临时 `.pi-agent/`，防加载 `~/.pi/agent` 全局扩展（index.ts:652-658）。
  - 会话续跑/分支：`SessionManager.continueRecent(cwd, sessionDir)`（每 Craft 会话独立 `.pi-sessions/` 目录，跨子进程重启续跑）；分支 = `forkFrom(parentFile)` + `branch(anchorEntryId)`（「Pi 版 resumeSessionAt」，anchor 不存在则 fail-closed 拒绝降级为新会话）（index.ts:660-695）。
  - 临时会话（queryLlm/标题/摘要）：`createAgentSession({sessionManager: SessionManager.inMemory(), …})` + 独立小 retry 预算 + deadline（index.ts:1017-1028；session-settings.ts:56-75）。
- **踩坑清单（带 issue 号的一手证据，全部实测于其 main 分支源码注释）**：
  1. **systemPrompt 无公开 per-turn API**：`state.systemPrompt` 直接赋值会在每次 `session.prompt()` 被 `_baseSystemPrompt` 冲掉；craft 的 workaround 是同时钉三个内部字段 `state.systemPrompt`/`_baseSystemPrompt`/`_rebuildSystemPrompt`（system-prompt-override.ts 全文实读；「Remove once the SDK exposes a public per-turn system-prompt API」；同款模式指向 OpenClaw pi-embedded-runner）。0.85.1 源码复核：`_systemPromptOverride` 仍 private（agent-session.ts:1297-1305），公开面只有扩展 `before_agent_start` 返回 systemPrompt（extensions/types.ts:1156-1160）——**缝仍在**。
  2. **message_end 先于持久化**：SDK 在 `appendMessage` 之前同步 emit `message_end`（0.85.1 复核：agent-session.ts:667-691 顺序未变），事件时刻 `getLeafId()` 还指向上一条 → 用它做 branch anchor 会把下一轮变成 assistant 消息的兄弟、从 LLM 视野里丢掉 assistant 回复（craft-agents-oss#782）。craft 用 `queueMicrotask` 在 append 后读 leaf 再补发 `pi_turn_anchor` 事件（index.ts:1208-1260）。
  3. **压缩竞态**：wrapper 侧并行 `session.compact()` 与 SDK `_runAutoCompaction` 竞态导致 AbortController 崩溃（craft-agents-oss#464）；现在 prompt/compact 前都 `waitForCompaction(session)` 串行化（index.ts:1429-1432,1571-1584），并明确「overflow 恢复交给 SDK 的 compact-and-retry-once，不自建」（index.ts:1440-1446 注释）。
  4. **并发 prompt 抛错**：会话流式期间新消息必须 `streamingBehavior:'followUp'` 排队，否则 "Agent is already processing"（index.ts:1433-1437）——印证 S1.6#1 判定。
  5. **工具面变更 = 整会话重建**：动态改 tools 不走 `_buildRuntime()`（私有），而是 dispose + `continueRecent()` 重建（index.ts:1401-1412）。
- **对本票的含义**：craft 验证了「纯 SDK（无扩展文件）+ 全内存 services + customTools 同名覆盖 + stdio 自建协议」的嵌入路线可行且已生产化；同时其 workaround 清单就是 AgentSession 层公开面的**缝清单实证**（systemPrompt、事件-持久化顺序、压缩竞态、工具热更）。
