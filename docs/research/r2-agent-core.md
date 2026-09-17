# r2-agent-core — nanobot agent loop / bus / session / memory 近读

- 研究对象：`/Users/xmon/Code/AgentProjects/nanobot`（只读），commit `2fb16593988b9e85131e02f395bb9a5108e220e7`（2026-09-16 16:41:31 +0800，"fix(tui): keep input responsive during agent output (#5791)"）
- 研究日期：2026-09-17；对应票：xiechimon/pacman #16
- 下文所有 `file:line` 均相对上游仓库根（如 `agent/loop.py` = `nanobot/agent/loop.py`）。行号对应上述 commit。
- 用途：为「设计：agent core TS 化」票提供职责边界与数据结构的一手依据。

---

## 1. 模块图（谁调用谁）

```
channels/*  ──publish_inbound──▶  MessageBus.inbound (asyncio.Queue, 无界)   bus/queue.py:32,37-39
                                        │
cli/gateway_runtime.py:920  agent.run() │  cli/agent.py:303 create_task(agent_loop.run())
                                        ▼
                              AgentLoop.run()  agent/loop.py:1261-1379
                                │  wait_for(consume_inbound, 1.0)  loop.py:1269
                                │  ├─ runtime-control 短路        loop.py:1288-1289
                                │  ├─ priority command inline     loop.py:1297-1302
                                │  ├─ automation defer (cron/local trigger)  loop.py:1303-1318
                                │  ├─ 会话已有活跃任务 → pending queue 注入   loop.py:1339-1373
                                │  └─ create_task(_dispatch(msg))             loop.py:1376-1377
                                ▼
                              _dispatch  loop.py:1391-1530
                                │  per-session asyncio.Lock + 可选全局 Semaphore  loop.py:1411-1418
                                │  TurnDeliveryFactory.create                     loop.py:1424-1428
                                ▼
                              _process_message  loop.py:1594-1687
                                │  阶段管线 restore→compact→command→build→run→save→respond
                                │                                               loop.py:1679-1686
                                ▼
                              _run_agent_loop  loop.py:939-1247
                                │  runner.run(AgentRunSpec{...})                 loop.py:1170-1219
                                ▼
                              AgentRunner  agent/runner.py:141-844
                                ├─ ContextGovernor.prepare_request               runner.py:877-882
                                ├─ provider.chat_stream_with_retry               runner.py:984-996
                                ├─ execute_tool_calls                            runner.py:512-522 → tools/execution.py:56-111
                                ├─ consolidate_history / provider compaction → Consolidator  loop.py:1184-1203
                                └─ checkpoint_callback → session.runtime_checkpoint  loop.py:968-982
                              SubagentManager.spawn/run_inline → 自己的 AgentRunner 实例
                                └─ 结果以 InboundMessage(channel="system", sender_id="subagent")
                                   回注 bus.publish_inbound                       agent/subagent.py:521-530
                              出站：TurnDelivery.complete → bus.publish_outbound   agent/turn_delivery.py:294-334（:309）
                              ChannelManager._dispatch_outbound_loop 消费 outbound channels/manager.py:767-784（:782）
                              Memory/Dream：cmd_dream → loop.process_direct(ephemeral) command/builtin.py:485-492,525
                                            cron "dream" job → agent.process_direct   cli/gateway_runtime.py:562-618
```

组装点：`AgentLoop.__init__` 创建 `ContextBuilder`（loop.py:374）、`SessionManager`（loop.py:375）、`ToolRegistry`（loop.py:383）、`AgentRunner`（loop.py:385）、`SubagentManager`（loop.py:386-395）、`Consolidator`（loop.py:433-442）、`AutoCompact`（loop.py:443-448）、`ModelRuntimeResolver`（loop.py:330-342）、`TurnDeliveryFactory`（loop.py:309-315）。`from_config` 是配置驱动的组合根（loop.py:457-522），tool registry 由调用方持有以便与 MCP 共享（loop.py:462-469）。

### agent/ 文件清点（一句话职责）

| 文件 | 职责 | 依据 |
|---|---|---|
| `__init__.py` | 公共导出（AgentLoop、ContextBuilder、MemoryStore、hooks 等） | agent/__init__.py:1-29 |
| `loop.py` | AgentLoop：bus 消费、turn 阶段管线、会话并发编排 | loop.py:1,196-206 |
| `runner.py` | AgentRunner：无产品层关注点的 tool-using LLM 循环 | runner.py:1,141-142 |
| `context.py` | ContextBuilder：system prompt（identity+bootstrap+MEMORY.md+skills）与 transcript 组装 | context.py:1,89-152 |
| `memory.py` | MemoryStore（文件 IO）/ MemoryArchiver（批次归档）/ Consolidator（压缩协调）/ Dream helpers | memory.py:58,758,1072,498-616 |
| `subagent.py` | SubagentManager：后台/内联子代理，独立 runner + 独立 tool registry | subagent.py:93-155,205-225 |
| `context_governance.py` | 模型消息治理：预算压力检测、H/Δ 压缩状态、tool result 规范化 | context_governance.py:1,112-204,207,593-690 |
| `autocompact.py` | 空闲会话 TTL 到期后的后台归档压缩 | autocompact.py:1,26-114 |
| `automation_turns.py` | 会话绑定自动化 turn 的共享协调（deferred 队列、完成回发） | automation_turns.py:1,16 |
| `cron_turns.py` | CronTurnCoordinator：定时 turn 不与直播注入混流 | cron_turns.py:1,16-17 |
| `goal_permission.py` | sustained-goal 变更的 turn 级 ContextVar 许可 | goal_permission.py:1,8-11 |
| `hook.py` | AgentHook 生命周期原语 + CompositeHook + SDKCaptureHook | hook.py:1,66,157,274 |
| `hooks/file_edit_activity.py` | 观察文件编辑工具并发 FileEditEvent 的 hook | hooks/file_edit_activity.py:1,14 |
| `model_presets.py` | 运行时 model preset 选择辅助 | model_presets.py:1 |
| `model_runtime.py` | ModelRuntimeResolver：把 preset/模型选择解析为不可变 LLMRuntime | model_runtime.py:1,16-22 |
| `plugins.py` | 本地 Agent Plugin 包的加载与激活 | plugins.py:1 |
| `progress_hook.py` | AgentProgressHook：runner 事件 → 渠道进度/流式 UI 事件 | progress_hook.py:1,22-77 |
| `skills.py` | SkillsLoader：workspace skills 发现/摘要/always-skills | skills.py:1；context.py:99,132-143 |
| `turn_delivery.py` | TurnRoute/TurnDelivery/TurnDeliveryFactory：turn 的路由、流 id、生命周期发布、出站 | turn_delivery.py:1,31-38,73,177 |
| `turn_hooks.py` | 每 turn hook 链组装（progress + factories + extra hooks → CompositeHook） | turn_hooks.py:1,43-88 |
| `tools/` | ToolRegistry/loader/execution + 具体工具（filesystem、exec/shell、web、search、mcp、spawn、message、sessions、cron、image_generation、long_task、cli_apps、runtime_control、file_state、sandbox、apply_patch 等） | tools/ 目录清单；注册入口 loop.py:615-641 |

### bus/ 文件清点

| 文件 | 职责 | 依据 |
|---|---|---|
| `events.py` | InboundMessage / OutboundMessage dataclass + 保留 metadata 键 | events.py:13-21,24-68 |
| `queue.py` | MessageBus：inbound/outbound 队列 + 本地事件订阅分发 | queue.py:19-148 |
| `outbound_events.py` | 挂在 OutboundMessage.event 上的类型化事件（Progress/StreamDelta/StreamEnd/TurnEnd/Goal 等）与构造函数 | outbound_events.py:1-6,23-130 |
| `runtime_events.py` | turn 作用域运行时事件（SessionTurnStarted/TurnCompleted/…）+ RuntimeEventPublisher | runtime_events.py:17-99,101-293 |
| `notification_delivery.py` | `notification_is_deliverable`：按渠道过滤可投递通知 | turn_delivery.py:13,50-53（消费点） |

### session/ 文件清点

| 文件 | 职责 | 依据 |
|---|---|---|
| `manager.py` | Session/SessionPolicy/SessionManager/JsonlSessionStore：JSONL 持久化、缓存、迁移、fork | manager.py:266-287,548,1644 |
| `keys.py` | UNIFIED_SESSION_KEY、last_channel 元数据 | keys.py:8-42 |
| `summary.py` | SessionSummary/SessionSummaryCheckpoint 与校验 | summary.py:12-58 |
| `recovery.py` | 中断 turn 的持久恢复：pending followup 记录/确认、runtime checkpoint 物化 | recovery.py:1,57,67,150,276-350 |
| `turn_continuation.py` | max_iterations + sustained goal 的内部续跑策略（ invisible continuation slice） | turn_continuation.py:1-6,107-142 |
| `goal_state.py` | sustained-goal 会话元数据 | goal_state.py:1；loop.py:1137-1146 |
| `history_visibility.py` | HIDDEN_HISTORY_META 隐藏历史标记 | history_visibility.py:1；manager.py:335 |
| `model_selection.py` | 会话级 model preset 元数据键 | model_selection.py:1；loop.py:85-88 |
| `session_handles.py` | 会话的公开短 handle | session_handles.py:1 |
| `session_messages.py` | 跨会话转发的用户输入元数据 | session_messages.py:1 |
| `webui_turns.py` | WebUI WebSocket 会话 turn 辅助 | webui_turns.py:1 |
| `automation_turns.py` | automation turn 的 history override 元数据 | automation_turns.py:1；loop.py:80,1818 |

---

## 2. 关键类职责表

| 类 | 位置 | 职责 | 关键方法 | 主要依赖 |
|---|---|---|---|---|
| `AgentLoop` | agent/loop.py:196 | 核心处理引擎：消费 bus、按会话编排 turn、组装全部核心组件 | `from_config`(458)、`run`(1261)、`_dispatch`(1391)、`_process_message`(1594)、`_run_agent_loop`(939)、`process_direct`(2318)、`aclose`(1532) | MessageBus、LLMProvider、SessionManager、ContextBuilder、AgentRunner、SubagentManager、ToolRegistry、Consolidator、AutoCompact、CommandRouter |
| `TurnContext` | agent/loop.py:133-181 | 单 turn 的可变状态载体，贯穿 7 个阶段 | `require_runtime`(183)、`require_session`(189) | InboundMessage、Session、LLMRuntime、TurnDelivery、EventSink |
| `AgentRunner` | agent/runner.py:141 | 纯执行循环：模型请求、tool 执行、注入、恢复、预算收尾 | `run`(308)、`_run_core`(386)、`_request_model`(865)、`_try_drain_injections`(155)、`_try_finalize_after_max_iterations`(1163) | ContextGovernor、ProviderConversationStateController、execute_tool_calls、AgentHook |
| `AgentRunSpec` / `AgentRunResult` | runner.py:88-115 / 118-138 | run 的输入配置 / 输出结果（含 round_usages、stop_reason、summary_checkpoint、provider_state） | — | — |
| `ContextBuilder` | agent/context.py:89 | system prompt（identity+AGENTS/SOUL/USER+MEMORY.md+skills+归档摘要）与 transcript/当前消息组装 | `build_system_prompt`(101)、`build_transcript`(276)、`build_current_message`(310)、`build_user_content`(334) | MemoryStore、SkillsLoader、模板渲染 |
| `TranscriptInput` | agent/context.py:72-86 | 冻结的 turn 原始输入（history、current_message、media、summary、runtime blocks） | `message_count`(83) | SessionSummary、RuntimeContextBlock |
| `MemoryStore` | agent/memory.py:58 | memory 文件纯 IO：MEMORY.md、history.jsonl（append-only + cursor）、SOUL.md、USER.md、Dream prompt/工具/游标 | `append_history`(282)、`read_unprocessed_history`(399)、`build_dream_prompt`(543)、`build_dream_tools`(575)、`compact_history`(403) | GitStore（memory.py:88-90）、threading.Lock（87） |
| `MemoryArchiver` | agent/memory.py:758 | 把 transcript 批次经 LLM 摘要写入 history.jsonl；失败降级 raw dump（16k 字符上限） | `archive`(826)、`archive_session`(996) | MemoryStore、provider（chat_stream_with_retry，memory.py:913） |
| `Consolidator` | agent/memory.py:1072 | Memory checkpoint 协调：per-session 锁、摘要预算计算、空闲会话压缩 | `get_lock`(1099)、`summarize_transcript`(1103)、`compact_idle_session`(1222) | MemoryArchiver、SessionManager |
| `AutoCompact` | agent/autocompact.py:26 | TTL(默认15min, schema.py:147-152) 到期空闲会话的后台归档调度 | `check_expired`(68)、`prepare_session`(116) | SessionManager、Consolidator |
| `SubagentManager` | agent/subagent.py:93 | 后台(`spawn`)/同步(`run_inline`)子代理；容量信号量；结果经 bus 回注 | `spawn`(227)、`run_inline`(291)、`_run_admitted_subagent`(383)、`_announce_result`(488)、`cancel_by_session`(556) | 独立 AgentRunner(151)、独立 ToolRegistry(205-225)、MessageBus |
| `MessageBus` | bus/queue.py:19 | 渠道与 agent core 的解耦：inbound/outbound 无界队列 + 本地事件 handler 顺序分发 | `publish_inbound`(37)、`consume_inbound`(41)、`publish_outbound`(45)、`publish_event`(49)、`subscribe`(92)、`publish`(118)、`publish_nowait`(128)、`drain`(145) | asyncio.Queue |
| `RuntimeEventPublisher` | bus/runtime_events.py:101 | turn 作用域运行时事件的构造与发布；per-session latency/runtime/usage 暂存 | `user_input_accepted`(163)、`turn_completed`(259)、`clear_turn`(157) | MessageBus.publish |
| `TurnDeliveryFactory` / `TurnDelivery` | agent/turn_delivery.py:73 / 177 | turn 的路由解析（system 消息回源渠道，:152-174）、流 segment id、生命周期事件、最终出站 | `create`(85)、`unrouted`(106)、`complete`(294)、`fail`(336)、`idle`(355)、`abort_stream`(383) | MessageBus、RuntimeEventPublisher |
| `Session` | session/manager.py:275-287 | 会话：messages 全量 transcript + metadata + last_consolidated 水位 + provider_state | `add_message`(312)、`commit_summary_checkpoint`(323)、`get_history`(344)、`clear`(477) | SessionPolicy(266-272) |
| `SessionManager` | session/manager.py:1644 | 会话身份/缓存(LRU 128 + weak overflow, :44,1659-1662)/持久化门面/fork/删除 | `get_or_create`(1740)、`save`(1786)、`save_runtime_checkpoint`(1794)、`delete_session`(1870)、`fork_session_before_user_index`(1882) | SessionStore 协议(526-545)、JsonlSessionStore(548) |
| `JsonlSessionStore` | session/manager.py:548 | JSONL 原子读写、workspace 命名空间、损坏修复、checkpoint sidecar | `load`(1038)、`_save_unlocked`(1314)、`save_runtime_checkpoint`(1215)、`repair`(1116) | filelock.FileLock(568,581) |
| `ContextGovernor` | agent/context_governance.py:207 | 请求前治理：压力检测→压缩(H/Δ)或裁剪、tool result 规范化、孤儿 tool result 修复 | `prepare_request`(593)、`fit_to_budget`(336)、`normalize_tool_result`(709)、`snip_history`(951) | ContextGovernanceConfig(112)、ModelRequestState(192)、ContextCompactionState(124) |
| `AgentHook` / `CompositeHook` | agent/hook.py:66 / 157 | 生命周期 hook 面（before_run/iteration、stream、tool 前后、error、finally）；Composite 按序 fan-out 且逐 hook 隔离异常 | hook.py:75-151；Composite `_for_each_hook_safe`(174) | — |
| `AgentProgressHook` | agent/progress_hook.py:22 | 把 runner 流式/think/tool 事件转成 Progress/StreamDelta/StreamEnd 发布 | `on_stream`(54)、`on_stream_end`(70) | EventSink |
| `ModelRuntimeResolver` | agent/model_runtime.py:16 | 模型/preset 选择 → 不可变 LLMRuntime；懒刷新 | `admit`/`resolve_preset`/`invalidate`（loop.py:243-256,528-537 调用点） | ProviderSnapshot、preset loaders |
| `WorkspaceScopeResolver` | security/workspace_access.py:111 | turn 边界解析生效 workspace；仅 `websocket` 渠道启用 per-turn scope，其余用默认 | `for_turn`(139-154)、`persist_message_scope`(156-165) | WorkspaceScope(66-92) |

---

## 3. 数据结构定义（确切字段）

### 3.1 InboundMessage（bus/events.py:24-49，dataclass）

| 字段 | 类型 | 默认 | 行 |
|---|---|---|---|
| `channel` | str（telegram/discord/slack/whatsapp…） | 必填 | events.py:28 |
| `sender_id` | str | 必填 | events.py:29 |
| `chat_id` | str | 必填 | events.py:30 |
| `content` | str | 必填 | events.py:31 |
| `timestamp` | datetime | `datetime.now()` | events.py:32 |
| `media` | list[str]（媒体 URL/路径） | `[]` | events.py:33 |
| `metadata` | dict[str, Any] | `{}` | events.py:34 |
| `session_key_override` | str \| None | None | events.py:35 |
| `require_existing_session` | bool | False | events.py:36 |
| `input_role` | Literal["user","system"] \| None | None | events.py:37 |

派生属性：`session_key = override or f"{channel}:{chat_id}"`（events.py:40-42）；`is_user_input`：有 input_role 则按其判定，否则 `channel != "system"`（events.py:44-49）。保留 metadata 键：`_runtime_control`、`_user_shell`、`_ack` 等（events.py:17-21）。

### 3.2 OutboundMessage（bus/events.py:52-68，dataclass）

| 字段 | 类型 | 默认 | 行 |
|---|---|---|---|
| `channel` / `chat_id` / `content` | str | 必填 | events.py:61-63 |
| `reply_to` | str \| None | None | events.py:64 |
| `media` | list[str] | `[]` | events.py:65 |
| `metadata` | dict[str, Any]（渠道路由上下文 + `_agent_ui` 富载荷） | `{}` | events.py:66；语义注 events.py:10-13,54-58 |
| `buttons` | list[list[str]] | `[]` | events.py:67 |
| `event` | AgentEvent \| None（运行时/UI 语义载体） | None | events.py:68 |

类型化事件（bus/outbound_events.py）：`ProgressEvent{content, tool_hint, reasoning, reasoning_delta, reasoning_end, stream_id, tool_events, file_edit_events}`（:23-32）、`FileEditEvent`（:35-37）、`StreamDeltaEvent{content, stream_id}`（:41-43）、`StreamEndEvent{content, stream_id, resuming, merge_next}`（:46-51）、`StreamedResponseEvent`（:54-56）、`TurnEndEvent{latency_ms, goal_state, usage, round_usages, context_window_tokens, outcome, failure_*}`（:59-70）、`GoalStatusEvent`/`GoalStateSyncEvent`/`SessionUpdatedEvent`/`UserInputEvent{content, created_at_ms, provenance}`/`RuntimeModelUpdatedEvent`/`TurnModelUpdatedEvent`（:73-111）。基类 `AgentEvent`（events.py:12-13）；`EventSink{publish, accepts_type}` + `emit` best-effort / `publish` 直连（events.py:47-75）。

运行时事件（bus/runtime_events.py）：`RuntimeEventContext{channel, chat_id, session_key, metadata, attributes}`（:17-25）；`SessionTurnStarted`(:28)、`UserInputAccepted{content}`(:35)、`TurnRuntimeAdmitted{runtime}`(:43)、`TurnRunStatusChanged{status, started_at}`(:51)、`TurnCompleted{latency_ms, runtime, usage, round_usages, outcome, failure_kind, failure_error_kind, failure_attempts}`(:60-73)、`SessionTurnPersisted{turn_id, sender_id}`(:76)、`GoalStateChanged`(:85)、`RuntimeModelChanged{model, model_preset}`(:93)。

### 3.3 Session JSONL 存储格式

文件路径：`<sessions_root>/<workspace_id>/<base64url(session_key)>.jsonl`。
- sessions_root 默认 `get_runtime_subdir("sessions")`，可传 `data_dir/sessions`（manager.py:554-558；loop.py:481-485）；**必须在 workspace 之外**，否则 RuntimeError（manager.py:559-563）。
- workspace_id：32-hex，存于 `<workspace>/.nanobot/workspace-id`（manager.py:71-73,620-704），sessions_dir = root/workspace_id（manager.py:579）；目录 0o700（manager.py:565-566），文件 0o600（manager.py:606,1251）。
- 文件名编码：`base64.urlsafe_b64encode(key).rstrip("=")`（manager.py:1005-1007,1026-1027）。

每行一条 JSON 记录，三类（写入 manager.py:1314-1339；解析 manager.py:1055-1090）：

1. **metadata 行**（首行）：`{"_type":"metadata", "key":str, "created_at":iso, "updated_at":iso, "metadata":dict, "last_archived":int, "last_consolidated":int}`（manager.py:1320-1331；两字段同值，保留旧名兼容 :1327-1329）。
2. **provider_state 行**（可选）：`{"_type":"provider_state", "state":<private record>}`（manager.py:53,1332-1337,1085-1088）。
3. **message 行**：消息 dict 原样落盘（manager.py:1338-1339）。消息字段：
   - 基础：`role`、`content`、`timestamp`（ISO，add_message manager.py:312-321；_save_turn 兜底 loop.py:2250）
   - 回放保留键：`tool_calls`、`tool_call_id`、`name`、`reasoning_content`、`thinking_blocks`（manager.py:439-441）
   - 可选：`media`（面包屑回放 manager.py:403-407）、`_command`（命令消息不入 LLM 上下文 manager.py:386-387；写入 loop.py:1846-1852）、`HIDDEN_HISTORY_META`（隐藏历史 manager.py:332-337）、`injected_event="subagent_result"` + `subagent_task_id`（loop.py:2294-2300,1044-1054）、`latency_ms`（仅最后一个 assistant，loop.py:2268-2269）、`_channel_delivery`（manager.py:374）、`RUNTIME_CONTEXT_HISTORY_META`（loop.py:2248-2249）、`_recovery_interrupted`（recovery.py:332）。
   - 落盘前清洗：base64 图片块替换为文本占位（loop.py:2090-2115,2229-2247）；未声明/重复的 tool result 丢弃（loop.py:2151-2228）。

**runtime checkpoint sidecar**：`<b64key>.checkpoint.json`（manager.py:59,1029-1030），原子写（manager.py:1247-1260）：`{"version":1, "session_key", "base_updated_at", "base_message_count", "checkpoint":{...}, "provider_state":<private>|null}`（manager.py:57-58,1235-1246）。`checkpoint` 载荷来自 runner：`{phase:"awaiting_tools"|"tools_completed"|"final_response", iteration, model, assistant_message, completed_tool_results, pending_tool_calls}`（runner.py:498-508,554-568,767-778,196-213）+ 可选 `provider_state_checkpoint_version="v1"`（loop.py:258-261,968-982）。加载时校验四个 base 字段一致才 overlay，否则删除（manager.py:1262-1299）；完整 save 后 sidecar 被 unlink（manager.py:1346-1348）。

`Session` dataclass 字段：`key`、`messages:list[dict]`、`created_at/updated_at:datetime`、`metadata:dict`、`last_consolidated:int=0`、`provider_state`（非持久 dataclass 字段，repr=False）、`policy:SessionPolicy{persist=True, log_content=True, disabled_tools=frozenset()}`（manager.py:275-287,266-272）。

### 3.4 Memory 文件格式

- `memory/MEMORY.md`：长期事实，纯文本（memory.py:76,229-233）；注入 system prompt 的 `# Memory` 段（context.py:127-130）。
- `SOUL.md`、`USER.md`：workspace 根（memory.py:79-80）；作为 bootstrap 文件进 system prompt（context.py:92,194-221）。
- `memory/history.jsonl`：**append-only 摄入日志**，每行 `{"cursor":int(自增), "timestamp":"YYYY-MM-DD HH:MM", "content":str, "session_key"?:str}`（memory.py:303-321）；校验规则：cursor 非负 int 且非 bool、timestamp/content 必须 str、session_key 可缺省（memory.py:324-369）。cursor 计数持久在 `memory/.cursor`（memory.py:81,321），Dream 进度在 `memory/.dream_cursor`（memory.py:82,498-505）。上限：单条 hard cap 64,000 字符、raw fallback 16,000（memory.py:750-751）、条目数默认 1000（memory.py:61）。写入经 `strip_think` 清洗 + threading.Lock 保证 cursor 分配与 append 原子（memory.py:282-322,87）。
- Dream 工具面：只读 ReadFileTool(workspace) + Edit/Write/ApplyPatch 限定 `skills/` 目录与 {MEMORY.md, SOUL.md, USER.md} 三个文件（memory.py:575-616）。Dream 追踪文件由 GitStore 管理并 auto-commit，commit message 以真实 working-tree diff 为准（memory.py:65,88-90,565-573,703-719）。
- 近期回放 ≠ history.jsonl：LLM 的近期上下文来自 session JSONL 的 `get_history()` 回放（manager.py:344-475，水位 `last_archived` 之后、跳过 `_command`、token 预算裁剪、合法 tool 边界）；history.jsonl 是 Memory 摄入日志，供 Dream 消费（memory.py:543-563）。

### 3.5 Runner 输入/输出

`AgentRunSpec`（runner.py:88-115）：`initial_messages|transcript_input(+transcript_builder)`、`tools`、`runtime:LLMRuntime`、`max_iterations`、`max_tool_result_chars`、`hook`、`error_message`、`concurrent_tools`、`workspace`、`session_key`、`provider_retry_mode`、`checkpoint_callback`、`consolidate_history`、`consolidate_provider_compaction`、`injection_callback`、`terminal_injection_callback`、`continuation_callback`、`finalize_on_max_iterations=True`、`provider_state`、`llm_usage_source`、`events`。
`AgentRunResult`（runner.py:118-138）：`final_content`、`messages`、`tools_used`、`usage`、`round_usages`、`stop_reason="completed"|"error"|"max_iterations"|"empty_final_response"|"cancelled"`（赋值点 runner.py:399,720,739,791；runner.py:321）、`error`、`failure_error_kind`、`tool_events`、`had_injections`、`pending_stream_content`、`provider_state`、`summary_checkpoint`、`provider_compaction_applied`。
常量：`_MAX_EMPTY_RETRIES=2`、`_MAX_LENGTH_RECOVERIES=3`、`_MAX_INJECTIONS_PER_TURN=3`、`_MAX_INJECTION_CYCLES=5`（runner.py:71-74）；`_SUBAGENT_TERMINAL_WAIT_SECONDS=300`（loop.py:124）。默认配置：`max_tool_iterations=200`、`max_concurrent_subagents=4`、`max_tool_result_chars=16000`、`context_window_tokens=200000`（config/schema.py:126-131）。

---

## 4. 生命周期时序：一条 inbound message → outbound

1. **入队**：channel adapter → `bus.publish_inbound(msg)` → 无界 inbound Queue（bus/queue.py:37-39,32）。
2. **消费**：`AgentLoop.run()` 以 `wait_for(consume_inbound, timeout=1.0)` 轮询；超时分支执行空闲会话压缩扫描 `_check_expired_sessions_if_due`（loop.py:1267-1272,1249-1259）。
3. **准入过滤**（loop.py:1286-1335）：runtime-control 消息短路（:1288）；`require_existing_session` 且无缓存则丢弃（:1290-1294）；用户输入发 `UserInputAccepted`（:1295-1296）；priority command（如 /stop）inline 分发（:1297-1302）；cron/local-trigger turn 在会话活跃时 defer（:1303-1318）；WebUI 消息对 recovery 的抢占 admission（:1329-1335）。
4. **注入或派发**：会话已有活跃任务 → `record_pending_followup` 后 `put_nowait` 进 per-session pending queue（maxsize=20）；QueueFull 则回退为独立派发（loop.py:1339-1373,1421）。否则 `asyncio.create_task(_dispatch(msg))` 并登记到 `_active_tasks[session_key]`（loop.py:1376-1377,857-861）。
5. **_dispatch**：取 per-session lock + 可选全局 semaphore（loop.py:1411-1418,429-432）；创建 pending queue 并发布到 `_pending_queues`（仅锁持有者，loop.py:1419-1422）；`TurnDeliveryFactory.create(enable_stream=True)`（loop.py:1424-1428）；调 `_process_message`（loop.py:1429-1433）。
6. **_process_message 阶段管线**（loop.py:1679-1687，每阶段计时日志 :1689-1714）：
   - **restore**：附件文本化（loop.py:1752-1758）；`sessions.get_or_create`（:1760-1766）；按 policy 裁剪工具（:1769-1777）；记住回投路由（:1787-1792）；`delivery.started()` → `SessionTurnStarted`（:1793；turn_delivery.py:226-231）；websocket scope 持久化（:1794-1795）；物化 runtime checkpoint / pending interruption（:1797-1803；recovery.py:276-350 — 未完成 tool call 变为 "Error: Task interrupted…" 的 tool result，绝不重放执行）。
   - **compact**：`auto_compact.prepare_session` 取待用归档摘要（loop.py:1805-1811；autocompact.py:116-134）。
   - **command**：`CommandRouter.dispatch`；命中则短路 BUILD/RUN/SAVE，但命令问答仍以 `_command=True` 持久化并发 `SessionTurnPersisted`（loop.py:1813-1863）。
   - **build**：解析 `LLMRuntime`（loop.py:1867-1870）；`delivery.runtime_admitted` → `TurnRuntimeAdmitted`（:1908；turn_delivery.py:242-251）；`history = session.get_history()`（:1887）；subagent followup 先持久化为 assistant 记录（:1885-1907,2274-2301）；**用户输入提前持久化** `_persist_user_message_early`（add_message + mark pending + save，:1959-1964,677-718）；provider_state 可续则把当前消息 stage 进 pending_messages（:1913-1958）；产出 `TranscriptInput`（:1971,720-729）。
   - **run**：`delivery.running` → `TurnRunStatusChanged("running")`（loop.py:1976-1978）；`capture_message_deliveries` 监测 message 工具直发（:1980,2003-2008）；进入 `_run_agent_loop`（:1981-1996）→ 见步骤 7；结束后 `maybe_continue_turn`：max_iterations 且 sustained goal 活跃（≤12 轮）时向 pending queue 塞内部续跑消息并抑制本 turn 响应（:2011-2012；turn_continuation.py:107-142,33）。
   - **save**：计算 latency（loop.py:2025-2034）；`_last_usage` 写 metadata（:2035-2036）；`_save_turn` 把 `result.messages[skip:]` 过滤后 append 进 session.messages、提交 summary checkpoint、ack followup（:2037-2042,2140-2272）；清 pending/checkpoint、`sessions.save(session)` 全量原子重写（:2052-2054）；发 `SessionTurnPersisted`（:2055-2061）。
   - **respond**：`_assemble_outbound` 组装 OutboundMessage（流式已完成且非 error 时挂 `StreamedResponseEvent`，metadata 带 latency_ms）（loop.py:2063-2088,1716-1746）；system turn 走 `delivery.background_response`（:2071-2077；turn_delivery.py:268-292）。
7. **AgentRunner 迭代循环**（runner.py:386-844）：`for iteration in range(max_iterations)`（:435）→ `hook.before_iteration`（:441）→ `_request_model`：`ContextGovernor.prepare_request`（压力检测→H/Δ 压缩或裁剪，:877-882；context_governance.py:593-690）→ `provider.chat_stream_with_retry`，streaming 时挂 `on_content_delta/on_thinking_delta/on_tool_call_delta/on_stream_recover` 回调（runner.py:984-996；thinking 增量经 strip 后 `hook.emit_reasoning` :965-977；content 增量 `hook.on_stream` → StreamDeltaEvent，progress_hook.py:54-68）→ 非流式则同方法无回调（:992-996）。TTFT/生成时长记录（:899-1011）。响应后：抽取 reasoning（:467-480）；`should_execute_tools` → append assistant(tool_calls) + checkpoint `awaiting_tools`（:482-508）→ `hook.before_execute_tools` → `execute_tool_calls`（并发批 gather，:512-522；execution.py:81-95,292-316 按 `tool.concurrency_safe` 分批）→ tool result 经 `normalize_tool_result` 截断后 append + checkpoint `tools_completed`（:531-568）→ 注入 drain 检查点1（:571-577）→ continue。无 tool calls：`finalize_content`（:588）；空响应重试 ≤2 后 finalization retry（:594-629）；`finish_reason=="length"` 分段续写 ≤3（:631-656）；终止前注入 drain（含 terminal wait：若本会话仍有 running subagent，最长阻塞 300s 等结果，:690-703；loop.py:1073-1105）；stream end（:707-708）；error/empty break（:715-754）；正常则 final_response checkpoint + break（:756-789）。for-else：`stop_reason="max_iterations"`，drain 剩余注入，可选 no-tools finalization 调用，否则 fallback 文案（:790-823）。
8. **checkpoint 持久化时机**：`checkpoint_callback` → `session.metadata["runtime_checkpoint"]` → `save_runtime_checkpoint` 只写 sidecar 文件（loop.py:968-982,2303-2306；manager.py:1215-1260）。用户 /stop 取消时 `_dispatch` 的 CancelledError 分支把 checkpoint 物化回 session（loop.py:1442-1479）；gateway 关闭则保留 checkpoint 供 Recovery（loop.py:1381-1389,1458-1462）。
9. **memory 写入时机**：a) run 中压缩——ContextCompactionState 在请求超预算时用 `consolidate_history`（= `Consolidator.summarize_transcript`）产出替换摘要，`summary_checkpoint` 随 result 返回并在 save 阶段 `commit_summary_checkpoint`（loop.py:1184-1203；runner.py:838-842；context_governance.py:124-189；loop.py:2176-2187,2266-2267；manager.py:323-342），同时 `MemoryArchiver.archive` 把摘要 append 进 history.jsonl（memory.py:992-993）；b) turn 后空闲压缩——AutoCompact 后台 `compact_idle_session`（memory.py:1222-1297）；c) Dream——`build_dream_prompt` 取 `.dream_cursor` 之后 ≤20 条 history（memory.py:543-563），`process_direct(ephemeral=True, tools=build_dream_tools())` 跑受限 agent 修改 MEMORY.md/SOUL.md/USER.md（builtin.py:485-492），成功才推进 cursor（builtin.py:497-499），git auto-commit + compact_history + prune dream sessions（builtin.py:513-520）；定时路径为 cron job "dream"（gateway_runtime.py:561-618）。
10. **outbound**：`_dispatch` 收到 response → `delivery.complete(response, publish_completion)` → `bus.publish_outbound(response)`（turn_delivery.py:294-309）→ `TurnCompleted`（:319-334）→ finally 分支 drain pending queue 余量回发 inbound（loop.py:1489-1513）、`delivery.idle()` → `TurnRunStatusChanged("idle")` + clear_turn（loop.py:1514-1515；turn_delivery.py:355-361）→ ChannelManager outbound 循环消费并按渠道投递/合并流 delta（channels/manager.py:767-824）。CLI 交互模式则自建 `_consume_outbound` task 渲染（cli/agent.py:310-339,366）。

---

## 5. 并发 / async 模型

- **事件循环入口**：gateway：`run()` 内 `asyncio.create_task(_run_agent)` → `agent.run()`（gateway_runtime.py:896-920,932-939）；CLI 交互：`asyncio.run(run_interactive())` + `create_task(agent_loop.run())` + `create_task(_consume_outbound())`（cli/agent.py:267,303,366）；一次性模式直接 `await process_direct`（cli/agent.py:246-252）。
- **top-level 并发形态**：inbound 单消费者（run 循环），每条消息 `create_task(_dispatch)` → **跨会话并发、同会话串行**。串行由 per-session `asyncio.Lock` 保证，锁表是 `WeakValueDictionary` 允许空闲回收（loop.py:403-405,1376,1411,2382-2388）；`process_direct` 共享同一把锁与 bus turn 串行化（loop.py:2349-2352）。可选全局并发闸：env `NANOBOT_MAX_CONCURRENT_REQUESTS>0` 时的 `asyncio.Semaphore`（loop.py:428-432,1412,1418）。
- **队列与背压**：bus 的 inbound/outbound 都是**无界** `asyncio.Queue`（queue.py:32-33）——bus 本身无背压，生产者永不阻塞在容量上（推断：背压责任被推到消费速率与 per-session 锁排队）。per-session 注入队列**有界 maxsize=20**（loop.py:1421），`put_nowait` 满时不丢消息、回退为独立派发任务（loop.py:1360-1367）；turn 结束 finally 把队列余量重新 `publish_inbound`，保证不静默丢失（loop.py:1489-1513）。注入侧限流：每 turn ≤3 条、≤5 个注入周期（runner.py:73-74,289-295）。
- **本地事件分发**：`bus.publish` 按注册顺序 await 全部 handler，异常逐个捕获记日志（queue.py:118-126）；`publish_nowait` 用 `loop.create_task` + `_pending` 集合持有引用，`drain()` 在停机前 gather（queue.py:128-148）。语义注记：本地状态转移不等网络发送（queue.py:26-29）。
- **工具并发**：`execute_tool_calls` 按 `tool.concurrency_safe` 把同一响应的 tool calls 分批，安全批用 `asyncio.gather` 并发，非安全工具单独成批串行（execution.py:81-107,292-316）；结果顺序稳定（execution.py:68）。主循环传给 runner `concurrent_tools=True`（loop.py:1179）。
- **subagent 并发**：`spawn` = `asyncio.create_task(_run_subagent)`，准入经 `asyncio.Semaphore(max_concurrent_subagents)`（默认 4；subagent.py:150,262-274,368-381；schema.py:130）；排队 phase="queued"（subagent.py:368）。子代理有**独立的 AgentRunner 与 ToolRegistry**（scope="subagent" 加载，subagent.py:151,205-225），与主 loop 共享 bus。结果经 `_announce_result` 以 `InboundMessage(channel="system", sender_id="subagent", session_key_override=原会话)` 回注 bus（subagent.py:488-531）：若原会话 turn 活跃则进 pending queue 成为 mid-turn 注入（loop.py:1044-1054,1339），否则作为 system turn 独立派发。主 turn 收尾前若有 running subagent，terminal injection 最长等 300s（loop.py:124,1073-1105）。取消：`cancel_by_session` 联动 exec session 终止（subagent.py:556-565；loop.py:873-885）。
- **锁清单**：
  - per-session dispatch lock：`asyncio.Lock`（loop.py:403-405,2382-2388）
  - Consolidator per-session 压缩锁：`asyncio.Lock`，WeakValueDictionary（memory.py:1095-1101,1235-1236）
  - MemoryStore append 锁：`threading.Lock`，保证 cursor 分配 + 文件 append + .cursor 写入原子（memory.py:87,306-321）
  - 会话文件锁：`filelock.FileLock`（跨进程）——workspace 迁移锁（manager.py:568-572）与 `.session-files.lock`（manager.py:581-585）；load/save/checkpoint/delete/list 全部持锁执行（manager.py:1038-1040,1211-1213,1222,1406-1410,1539-1543）
  - AgentLoop 关闭锁：`_close_lock` 串行化 run() 自关与外部 aclose（loop.py:402,1532-1547）
- **task 追踪与停机**：`_active_tasks[session_key] -> set[Task]`（loop.py:399,857-871）；`_background_tasks` 集合 + done_callback 自摘（loop.py:401,1583-1587）；`aclose` 取消全部活跃任务 → gather → 后台任务 gather → 关闭 subagents 与 exec sessions，错误聚合成 ExceptionGroup（loop.py:1549-1581）。取消语义：显式 /stop 物化部分结果，gateway 停机保留 checkpoint（loop.py:1442-1479,1381-1389）。泄漏的 CancelledError 在消费循环被识别并忽略（loop.py:1273-1281；utils/cancellation `task_is_cancelling`）。
- **turn 作用域隔离用 contextvars**：`bind_request_context`/`bind_file_states`/`bind_workspace_scope` 在 `_run_agent_loop` 进入时 bind、finally reset（loop.py:1132-1134,1220-1224），使共享 ToolRegistry 能按当前 turn 解析状态（loop.py:376-378 注释）。goal 变更许可也是 ContextVar（goal_permission.py:8-11）。
- **会话缓存**：`SESSION_CACHE_MAX_SIZE=128` 的 OrderedDict LRU + WeakValueDictionary overflow（活跃调用方持有的会话不因 LRU 换出而换身份）（manager.py:44,1659-1683）；FileStateStore 以同一上限按会话跟踪文件读写状态（loop.py:376-382）。
- **AutoCompact 调度**：run() 消费超时分支按 `idle_compact_check_interval_seconds`（默认60s）节流扫描，归档任务经 `schedule_background` 进入受追踪后台任务（loop.py:1249-1259,1271；autocompact.py:68-91；schema.py:153-156）。归档中的会话 key 记入 `_archiving` 防重入，活跃会话（在 `_pending_queues` 中）跳过（autocompact.py:35,78-80；loop.py:1258）。

---

## 附：对 TS 化设计最相关的边界观察（均含推断标注）

1. `AgentRunner` 已被上游刻意做成无产品层依赖的纯循环（runner.py:141-142），产品语义全部经 `AgentRunSpec` 的回调注入（checkpoint/injection/continuation/consolidation，runner.py:106-111）——这是天然的 TS 化切分线。
2. `AgentLoop` 是组合根 + 会话并发编排器 + 阶段管线三合一（loop.py:263-455,1391-1530,1679-1686），2388 行；阶段间通过可变 `TurnContext` 传递状态（loop.py:133-181）。
3. 持久化有两层节奏：全量原子重写（session JSONL，manager.py:1314-1361）+ 高频 sidecar checkpoint（manager.py:1215-1260），TS 化需保留该分层否则 tool-heavy turn 每次 checkpoint 都要重写全 transcript（manager.py:1218-1220 注释明言此动机）。
4. bus 无界队列 + per-session 有界注入队列 + finally 回发的组合是「不丢消息」语义的三件套（queue.py:32-33；loop.py:1421,1360-1367,1489-1513）。推断：TS 化若改用有界总线队列，需要重新设计这三处的回退路径。
5. 推断：`_dispatch` 里 pending queue 的发布权严格绑定 session lock 持有者（loop.py:1419-1422 注释），这是避免双任务同时向一个会话注入的关键不变量，TS 化必须等价保留。
