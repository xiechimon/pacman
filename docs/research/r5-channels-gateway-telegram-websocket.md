# R5 · 上游近读：channels / gateway / telegram / websocket

> wayfinder research 票 xiechimon/pacman#19 产出。源码基线：`/Users/xmon/Code/AgentProjects/nanobot`（只读精读；所有行号均来自实际 Read 到的文件内容）。
> 下游消费方：「设计：channels + gateway + telegram + websocket TS 化」票。
> 引用格式：`路径:行号`，路径相对 nanobot 仓库根。

## 1. TL;DR

1. nanobot 共 17 个 channel 包（telegram、websocket + 15 个 bridge），每包 = `manifest.py`（免依赖的 `ChannelPlugin` 描述符）+ `runtime.py`（`BaseChannel` 子类）；平台 SDK 只在 channel 被启用时才 import（`nanobot/channels/plugin.py:74-94`、`nanobot/channels/registry.py:20-44`）。
2. channel 核心契约极小：抽象方法仅 `start/stop/send`，其余十余个流式/推理/文件编辑钩子全部可选（`nanobot/channels/base.py:74-102`、`129-199`）；鉴权、配对码、stream 标志注入统一收敛在 `BaseChannel._handle_message`（`base.py:255-321`）。
3. bus = 两条 `asyncio.Queue`（inbound/outbound）+ 本地事件订阅（`nanobot/bus/queue.py:31-69`）；`OutboundMessage.event` 携带类型化事件（判别联合风格），由各 channel adapter 自行投影到平台线格式（`nanobot/bus/events.py:52-68`、`nanobot/bus/outbound_events.py:23-111`）。
4. `ChannelManager` 用单个串行 dispatch loop 处理全部出站：stream delta 合并、重复内容抑制、按 `(channel, chat_id)` FIFO 链 + 全局 32 并发信号量 + 1/2/4s 指数退避重试（`nanobot/channels/manager.py:767-850`、`728-759`、`998-1056`）。
5. gateway 是双含义：`nanobot/gateway/` 只管进程生命周期（前台/后台/按需租约 + JSON state 文件 + systemd/launchd 安装器），真正的运行时装配在 `cli/gateway_runtime.py::_run_gateway`（`nanobot/gateway/runtime.py:202-416`、`nanobot/cli/gateway_runtime.py:340-1034`）。
6. Telegram 基于 python-telegram-bot：默认 long polling（120s liveness watchdog + 自动重建 app），可选 webhook（强制公网 HTTPS + secret token）；消息长度三层限制 markdown 4000 / HTML 4096 / rich 32768；流式输出 = 编辑同一条消息，私聊且开 richMessages 时改用 ephemeral rich draft（`nanobot/channels/telegram/runtime.py:603-657`、`413-465`、`44-53`、`1316-1518`）。
7. WebSocket channel 同时是 WebUI 的传输层与 HTTP 服务器：同一监听端口处理 WS upgrade、REST API、token 签发、静态 dist（SPA fallback）（`nanobot/channels/websocket/runtime.py:678-792`、`nanobot/webui/ws_http.py:556-617`、`1711-1766`）。
8. WS 鉴权三路：静态 token、一次性 bootstrap 签发 token（`nbwt_` 前缀，TTL 默认 300s、消费即失效）、trusted-proxy assertion header；host 绑 0.0.0.0/:: 时强制至少启用一种（`nanobot/webui/gateway_endpoint.py:77-111`、`nanobot/webui/gateway_tokens.py:50-82`、`websocket/runtime.py:284-293`）。
9. session key 全局规则 `channel:chat_id`（`bus/events.py:39-42`）；Telegram forum topic 覆写为 `telegram:{chat}:topic:{tid}`（`telegram/runtime.py:1664-1670`），WebUI 为 `websocket:{uuid chat_id}`（`nanobot/webui/session_identity.py:8-19`）；unified_session 模式全部折叠到 `unified:default`（`nanobot/session/keys.py:12-16`、`nanobot/agent/loop.py:901-905`）。
10. websocket channel 在 `ChannelManager._build_channel` 里被按名字特判、注入整套 `GatewayServices`（REST router / token store / transcript / workspace / temporary chats）——这是 channel 抽象上最重的耦合点，TS 化需要显式决策（`manager.py:183-215`、`nanobot/webui/gateway_services.py:32-160`）。

## 2. Channel 接口契约

### 2.1 BaseChannel：抽象方法与可选钩子

类声明与类级开关：`BaseChannel(ABC)`，类属性 `name="base"`、`display_name`、`send_progress=True`、`send_tool_hints=True`、`show_reasoning=True`（`nanobot/channels/base.py:21-33`）。构造签名 `__init__(self, config: Any, bus: MessageBus)`，config 类型不限（Pydantic model 或 dict 均可），内部绑定 loguru logger 与 `_running=False`（`base.py:35-46`）。

| 成员 | 种类 | 签名/语义 | 引用 |
|---|---|---|---|
| `start()` | **abstract** | 长驻 async 任务：连接平台、收消息、经 `_handle_message()` 转发到 bus | `base.py:74-84` |
| `stop()` | **abstract** | 停止并清理资源 | `base.py:86-89` |
| `send(msg)` | **abstract** | 发送 `OutboundMessage`；失败必须 raise，由 manager 统一重试 | `base.py:91-102` |
| `login(force)` | 可选 | 交互式登录（如扫码）；默认返回 True | `base.py:62-72` |
| `transcribe_audio(path)` | 可选 | Whisper 转写音频，失败返回 `""` | `base.py:48-60` |
| `send_delta(chat_id, delta, metadata, *, stream_id, stream_end, resuming, merge_next)` | 可选 | 流式文本块；覆写即视为支持 streaming | `base.py:129-151` |
| `send_reasoning_delta(chat_id, delta, metadata, *, stream_id)` | 可选 | 推理内容流（低强调渲染），默认 no-op | `base.py:153-171` |
| `send_reasoning_end(chat_id, metadata, *, stream_id)` | 可选 | 推理段结束信号，默认 no-op | `base.py:173-186` |
| `send_reasoning(msg)` | 可选 | 一次性推理块；默认实现 = delta+end 复用流式原语 | `base.py:201-223` |
| `send_file_edit_events(chat_id, edits, metadata)` | 可选 | 结构化文件编辑事件，默认 no-op | `base.py:188-199` |
| `progress_transport_defaults()` | 可选 | 返回 `(send_progress, send_tool_hints)` 传输层默认；None 表示用全局策略 | `base.py:104-110` |
| `should_retry_send_error(err)` | 可选 | 业务错误可返回 False 阻止 manager 重试 | `base.py:112-119` |
| `start_error_message(err)` | 可选 | 启动失败的用户可读消息；None 用 manager 通用兜底 | `base.py:121-127` |
| `supports_streaming` | property | config.streaming 为真 **且** 子类覆写了 `send_delta`（`type(self).send_delta is not BaseChannel.send_delta` 的鸭子检测） | `base.py:225-235` |
| `is_allowed(sender_id)` | 可覆写 | 允许序：`"*"` in allowFrom → 精确匹配 → pairing store `is_approved` → 拒绝 | `base.py:237-253` |
| `_handle_message(...)` | 入口模板 | 见 2.6 | `base.py:255-321` |
| `default_config()` | classmethod | onboard 用默认配置，默认 `{"enabled": False}` | `base.py:323-326` |
| `refresh_feature_metadata(config_path, *, instance_id)` | classmethod | 设置动作后刷新持久化展示元数据，默认 False | `base.py:328-336` |
| `is_running` | property | 返回 `_running` | `base.py:338-341` |

### 2.2 InboundMessage 完整字段表（`nanobot/bus/events.py:24-49`）

| 字段 | 类型 | 默认 | 语义 | 引用 |
|---|---|---|---|---|
| `channel` | `str` | 必填 | channel 名（telegram/discord/...） | `events.py:28` |
| `sender_id` | `str` | 必填 | 平台用户标识 | `events.py:29` |
| `chat_id` | `str` | 必填 | 会话/群标识 | `events.py:30` |
| `content` | `str` | 必填 | 消息文本 | `events.py:31` |
| `timestamp` | `datetime` | `datetime.now` | 接收时间 | `events.py:32` |
| `media` | `list[str]` | `[]` | 媒体 URL/本地路径列表 | `events.py:33` |
| `metadata` | `dict[str, Any]` | `{}` | channel 特有数据（见各 channel） | `events.py:34` |
| `session_key_override` | `str \| None` | None | thread/topic 级 session 覆写 | `events.py:35` |
| `require_existing_session` | `bool` | False | 无既有 session 则丢弃 | `events.py:36` |
| `input_role` | `Literal["user","system"] \| None` | None | 强制输入角色 | `events.py:37` |
| `session_key`（property） | `str` | — | `override or f"{channel}:{chat_id}"` | `events.py:39-42` |
| `is_user_input`（property） | `bool` | — | role 未设时 `channel != "system"` | `events.py:44-49` |

保留 metadata 键：`_runtime_control`、`_user_shell`（只允许受信传输层铸造，不可从客户端原样透传）（`events.py:17-21`）。

### 2.3 OutboundMessage 完整字段表（`nanobot/bus/events.py:52-68`）

| 字段 | 类型 | 默认 | 语义 | 引用 |
|---|---|---|---|---|
| `channel` | `str` | 必填 | 路由目标 channel（= manager.channels 的 runtime name） | `events.py:61` |
| `chat_id` | `str` | 必填 | 目标会话 | `events.py:62` |
| `content` | `str` | 必填 | 文本内容（typed event 时可为其 fallback 文本） | `events.py:63` |
| `reply_to` | `str \| None` | None | 回复目标 | `events.py:64` |
| `media` | `list[str]` | `[]` | 媒体路径/URL | `events.py:65` |
| `metadata` | `dict[str, Any]` | `{}` | 路由上下文（`message_id`、thread id 等）+ 可选 `_agent_ui` 富载荷 | `events.py:66`、`events.py:10-13` |
| `buttons` | `list[list[str]]` | `[]` | 行内按钮（Telegram inline keyboard 等） | `events.py:67` |
| `event` | `AgentEvent \| None` | None | 类型化运行时/UI 事件 | `events.py:68` |

### 2.4 类型化出站事件目录（`nanobot/bus/outbound_events.py`）

| 事件 | 关键字段 | 引用 |
|---|---|---|
| `ProgressEvent` | `content, tool_hint, reasoning, reasoning_delta, reasoning_end, stream_id, tool_events, file_edit_events` | `outbound_events.py:23-32` |
| `FileEditEvent`（ProgressEvent 子类） | 需要 interested consumer 的文件活动快照 | `outbound_events.py:35-37` |
| `StreamDeltaEvent` | `content, stream_id` | `outbound_events.py:40-43` |
| `StreamEndEvent` | `content, stream_id, resuming, merge_next` | `outbound_events.py:46-51` |
| `StreamedResponseEvent` | 标记「已经流式发完」，manager 不再调 send | `outbound_events.py:54-56`、`manager.py:930-931` |
| `TurnEndEvent` | `latency_ms, goal_state, usage, round_usages, context_window_tokens, outcome, failure_*` | `outbound_events.py:59-70` |
| `GoalStatusEvent` | `status, started_at` | `outbound_events.py:73-76` |
| `GoalStateSyncEvent` | `goal_state` | `outbound_events.py:79-81` |
| `SessionUpdatedEvent` | `scope` | `outbound_events.py:84-86` |
| `UserInputEvent` | `content, created_at_ms, provenance` | `outbound_events.py:89-95` |
| `RuntimeModelUpdatedEvent` | `model, model_preset` | `outbound_events.py:98-101` |
| `TurnModelUpdatedEvent` | `model, model_preset, context_window_tokens, fallback` | `outbound_events.py:104-111` |
| 另有 re-export：`ContextCompactionEvent / RecoveryStateEvent / RetryStatusEvent / RetryWaitEvent` | 定义在 `nanobot/events` | `outbound_events.py:16-19` |

`outbound_message_for_event()` 把 typed event 包成 OutboundMessage，content 取 `_event_content()` 的文本 fallback（如 compaction 各 phase 的固定文案）（`outbound_events.py:114-130`、`148-162`）。

### 2.5 MessageBus（`nanobot/bus/queue.py:19-148`）

- 结构：`inbound: asyncio.Queue[InboundMessage]`、`outbound: asyncio.Queue[OutboundMessage]`、本地 handler 列表、pending task 集合（`queue.py:31-35`）。
- channel → agent：`publish_inbound` / `consume_inbound`（`queue.py:37-43`）；agent 侧唯一消费者是 `AgentLoop.run()`（`nanobot/agent/loop.py:1267-1269`）。
- agent/cron/tool → channel：`publish_outbound`、`publish_event(event, channel, chat_id, metadata)`（后者自动包 OutboundMessage）（`queue.py:45-65`）。
- 本地事件面（不进 outbound 队列）：`subscribe(handler, event_type)` 返回退订函数（`queue.py:92-116`）、`publish` 按注册序 await（`118-126`）、`publish_nowait`（`128-143`）、`drain`（`145-148`）。
- 语义要点：本地订阅者被 await，channel 投递走队列——「本地状态转移永远不等网络发送」（`queue.py:20-29` docstring）。

### 2.6 注册、发现与生命周期

**包发现**：`discover_plugins()` 用 `pkgutil.iter_modules` 扫 `nanobot/channels/` 下带 `manifest.py` 的子包（`registry.py:20-44`）；`load_channel_package()` 要求 manifest 导出的 `PLUGIN.name` 与包目录名一致、`runtime`/`connector` 目标必须留在本包内（`plugin.py:134-179`）。

**ChannelPlugin 描述符**（`plugin.py:22-72`）字段：`name, display_name, runtime("module:attr"), connector, setup(ChannelSetupSpec), management(ChannelManagementSpec), dependencies(PEP 508 元组), default_enabled, settings_visible, capabilities, webui(前端入口 ts/tsx)`。`load_channel_class()` 校验目标是 BaseChannel 真子类且 `cls.name == plugin.name`（`plugin.py:74-94`）。

**装配**：`ChannelManager._init_channels()`：discover → 读 config section（缺省 section 时用 `channel_default_config`，`manager.py:152-172`）→ `channel_instance_specs` 展开多实例 → runtime name 冲突检测（`manager.py:262-272`）→ `ensure_enabled_channel_dependencies` 检查可选依赖（`manager.py:279-281`）→ `plugin.load_channel_class()` + `_build_channel`（`manager.py:283-309`）。runtime name 规则：单实例 = channel 名；多实例必须 `"{name}.{instance_id}"` 前缀作用域（`contracts.py:325-334`、`544-554`；feishu 是唯一 multi_instance=True 的包，`feishu/instances.py:249-250`）。

**启动/停止**：`start_all()` 先建 outbound dispatcher task，再为每个 channel 建 `_start_channel` task 并 gather（channel 启动失败不拖垮 gateway，错误进 `_channel_errors` 并由 `get_status()` 报 `failed/starting/running/stopped`）（`manager.py:373-395`、`598-616`、`1062-1096`）；`stop_all()` 先 cancel dispatcher 再逐个 `_stop_channel`（先取消该 channel 的在途 outbound）（`manager.py:397-427`、`668-681`）。

**热启停**：`apply_channel_feature_action(action, name, instance_id)` 支持 WebUI 不重启 gateway 即 enable/disable 单个 channel 实例；`always_enabled` capability（websocket）拒绝热关（`manager.py:429-596`、`websocket/manifest.py:19`）。

**setup 契约**：`ChannelSetupSpec{fields, required, official_url, validator, verifies_connection}` 驱动设置界面与校验（`contracts.py:158-230`）；validator 由各包自带（如 telegram 的 token 格式 + getMe 实测，`telegram/validation.py:49-162`）。

### 2.7 鉴权、配对与入站模板 `_handle_message`

`BaseChannel._handle_message(sender_id, chat_id, content, media, metadata, session_key, is_dm, authorization_id, require_existing_session)`（`base.py:255-321`）：

1. 授权主体 = `authorization_id or sender_id`（群/房间级授权与发送者身份解耦）（`base.py:266-275`）。
2. `is_allowed` 未过：DM → 生成配对码并直接 `send()` 回复（pairing store I/O 失败只丢这条消息不崩 handler）；群消息 → 仅记 warning 静默拒绝（`base.py:276-304`）。
3. 过了授权：若 `supports_streaming` 则给 metadata 注入 `_wants_stream: True`（agent 侧据此决定流式）（`base.py:307-308`）。
4. 组装 `InboundMessage`（含 `session_key_override`、`require_existing_session`）→ `bus.publish_inbound`（`base.py:310-321`）。

allowFrom 缺省时进入 pairing-only 模式（manager 启动时打日志说明）（`manager.py:328-345`）。

## 3. Telegram 全细节

类：`TelegramChannel(BaseChannel)`，`name="telegram"`（`nanobot/channels/telegram/runtime.py:503-512`）。SDK：`python-telegram-bot[socks,webhooks]>=22.6,<23.0`（`telegram/manifest.py:41-45`）。配置模型 `TelegramConfig`（`telegram/runtime.py:413-465`）：`enabled, token, mode("polling"|"webhook", 默认 polling), allow_from, proxy, reply_to_message, react_emoji("👀"), group_policy("open"|"mention", 默认 mention), connection_pool_size(32), pool_timeout(5.0), streaming(True), inline_keyboards(False), rich_messages(False), stream_edit_interval(0.6), webhook_url, webhook_listen_host(127.0.0.1), webhook_listen_port(8081), webhook_path("/telegram"), webhook_secret_token, webhook_max_connections(4)`；webhook 模式强校验：公网 HTTPS URL + 1-256 位 `[A-Za-z0-9_-]` secret（`runtime.py:447-465`）。setup 契约 required 只有 `token`，`verifies_connection=True`（`telegram/manifest.py:30-33`），validator 做 token 格式 `^\d+:[A-Za-z0-9_-]{20,}$` + 真实 getMe 连通验证（`telegram/validation.py:36-46`、`86-124`）。

### 3.1 updates 获取：long polling（默认）与 webhook

- `start()` 是一个 supervisor 循环：`_start_app()` → `_watch_polling()`；polling 卡死（120s 无 getUpdates 往返，`POLL_STALE_SECONDS`）就 `_teardown_app()` 重建连接池重来；启动失败按 5s→300s 指数退避，仅网络类错误（NetworkError/TimedOut）可重试，`InvalidToken` 直接 fail 并清洗 token 后 re-raise（`runtime.py:603-657`、`67-73`、`770-778`）。
- `_start_app()`：两套独立 HTTPX 连接池——API 池（发送）与 getUpdates 池（长轮询），互不饿死；getUpdates 池外包 `_LivenessTrackedRequest` 上报每次往返时间供 watchdog（`runtime.py:659-685`、`76-99`）。
- polling：`updater.start_polling(allowed_updates, drop_pending_updates=False, error_callback)`——启动时处理积压 update（`runtime.py:760-766`）。
- webhook：`updater.start_webhook(listen, port, url_path, webhook_url, allowed_updates, drop_pending_updates=False, secret_token, max_connections)`；`url_path` 是本地路由，`webhook_url` 是 Telegram 回调的公网地址（反代可改写）（`runtime.py:747-759`）。
- 初始化后 `get_me` 缓存 bot 身份并 `set_my_commands(BOT_COMMANDS)` 注册命令菜单（18 条：start/new/compact/stop/restart/status/history/goal/trigger/pairing/model/skill/dream/dream_log/dream_restore/dream_prompt/evaluator_prompt/help）（`runtime.py:515-534`、`736-745`）。
- handler 注册顺序：`/start` regex → bus 斜杠命令 regex（`TELEGRAM_BUS_SLASH_COMMAND_RE`，`runtime.py:539-542`）→ 连字符 dream 命令 → `/help` → 消息（filters `TEXT|PHOTO|VIDEO|VIDEO_NOTE|ANIMATION|VOICE|AUDIO|Document.ALL|LOCATION` 且 `~COMMAND`）→（开 inline_keyboards 时）CallbackQueryHandler，且 allowed_updates 加 `callback_query`（`runtime.py:690-724`）。
- `_teardown_app()`：`updater.stop → app.stop → app.shutdown → bot.shutdown`（最后一步补 HTTPX 池泄漏），全程 `_teardown_lock` 串行（`runtime.py:817-834`）。

### 3.2 inbound 时序：update 到达 → bus

1. **per-session 重排队**：`_on_message`/`_forward_command` 不直接处理，而是 `_enqueue_ordered_update` 放进以最终 session key（`telegram:{chat_id}` 或 `telegram:{chat_id}:topic:{tid}`）为键的缓冲区，每键一个 worker（`runtime.py:1947-1954`、`1909-1916`、`1839-1875`）。
2. **排序窗口**：worker 每 0.2s 取一批，按 `(message_id, update_id)` 稳定排序后逐条处理（`runtime.py:1877-1907`、`1844-1850`）。
3. **鉴权**：sender_id 构造为 `"{id}|{username}"`（`runtime.py:1645-1649`）；`is_allowed` 覆写支持把 `id|username` 拆开分别对 allowFrom 匹配（`runtime.py:574-591`）。未过且是私聊 → 借 `_handle_message` 的空 content 路径发配对码（`runtime.py:1965-1966`、`1651-1662`；`base.py:276-297`）。
4. **群策略**：`group_policy="mention"` 时仅当 @提及（entities 或文本兜底）或回复 bot 消息才处理（`runtime.py:1970-1971`、`1802-1827`、`1776-1800`）。
5. **内容组装**：text、caption、location → `[location: lat, lon]`（`runtime.py:1977-1987`）；媒体下载 `_download_message_media`：photo 取最大分辨率 `photo[-1]`，voice/audio/document/video/video_note/animation → `bot.get_file` → 存 `get_media_dir("telegram")/{file_unique_id}{ext}`（ext 由 mime_type 映射表或类型兜底，`runtime.py:1711-1763`、`2148-2173`）；voice/audio 下载后立即 `transcribe_audio`（Whisper），成功则 content 加 `[transcription: ...]`（`runtime.py:1752-1757`；`base.py:48-60`）。
6. **回复上下文**：被回复消息文本截断到 4000 后加前缀 `[Reply to bot: ...]` / `[Reply to @username: ...]` 插入 content 头部；被回复消息的媒体也会下载并前置到 media 列表（`runtime.py:1998-2008`、`1687-1709`）。
7. **media group 聚合**：同 `media_group_id` 的消息缓冲 0.6s 合并为一轮（content join、media 去重合并）（`runtime.py:2017-2035`、`2051-2065`）。
8. **UX 反馈**：处理前启动 typing 循环（每 4s 重发 `send_chat_action`）+ 给原消息加 `react_emoji`（默认 👀）reaction（`runtime.py:2037-2039`、`2067-2113`）。
9. **入 bus**：`_handle_message(sender_id, chat_id, content, media, metadata, session_key)`；metadata 固定含 `message_id, user_id, username, first_name, is_group, message_thread_id, is_forum, reply_to_message_id`（`runtime.py:2042-2049`、`1672-1685`）→ `base.py:255-321` → `bus.publish_inbound`（`base.py:321`）→ `AgentLoop.run` 消费（`agent/loop.py:1267-1269`）。
10. **命令转发**：bus 斜杠命令剥掉 `@botname` 后缀、把 Telegram 安全别名（下划线）规范化回连字符命令后，同样走 `_handle_message` 交给 AgentLoop 的统一命令路由（`runtime.py:1918-1945`、`468-476`、`593-601`）；`/start`、`/help` 本地应答不进 bus（`runtime.py:1618-1643`）。
11. **inline keyboard 回调**：按钮点击 → `query.answer()` → 清键盘 → 以按钮 label 为 content 走 `_handle_message`（metadata 带 `callback_query_id/button_label/is_callback`）（`runtime.py:2198-2231`）。

### 3.3 会话映射（chat id → session）

- 默认 session key = `telegram:{chat_id}`（`InboundMessage.session_key`，`bus/events.py:39-42`）。
- forum topic（有 `message_thread_id`）覆写为 `telegram:{chat_id}:topic:{thread_id}`（`runtime.py:1664-1670`，经 `session_key_override` 传入 `base.py:317`）。
- 线程上下文缓存 `_message_threads[(chat_id, message_id)] = thread_id`（上限 1000 条 FIFO 淘汰），供出站回复找回 topic（`runtime.py:1829-1837`、`1081-1086`）。
- unified_session 模式下 agent 侧把无 override 的消息折叠到 `unified:default`（`agent/loop.py:901-905`；`session/keys.py:12-16`）。
- 存储：session 由 `SessionManager(config.workspace_path)` 统一管理，channel 自身不存会话（`cli/gateway_runtime.py:441`；推断：Telegram channel 内无持久化调用，全部会话状态经 bus 进 agent/session 层——依据是 `telegram/runtime.py` 全文无任何 session 存储 API 引用）。

### 3.4 outbound 时序：agent 回复 → sendMessage

1. agent/cron/tool 把 `OutboundMessage`（或 typed event）放进 `bus.outbound`（`bus/queue.py:45-65`）。
2. `ChannelManager._dispatch_outbound_loop` 取出：reasoning 类事件仅当 `show_reasoning` 才投递（`manager.py:787-801`）；progress/tool_hint 受 `send_progress/send_tool_hints` 门控（`manager.py:803-811`）；`RetryWaitEvent` 直接丢弃（`manager.py:813-814`）；连续 `StreamDeltaEvent` 同 `(channel, chat, stream_id)` 合并（`manager.py:823-828`、`933-996`）；同源重复内容按 `origin_message_id` 指纹抑制（`manager.py:698-719`、`830-843`）。
3. `_queue_outbound`：每 `(channel, chat_id)` 一条 FIFO task 链 + 全局 32 并发信号量 + 256 待发上限（`manager.py:728-759`、`61-62`）。
4. `_send_with_retry`：`send_max_retries`（默认 3，`config/schema.py:37`）+ 1/2/4s 退避；`should_retry_send_error` 可短路（`manager.py:998-1056`；`base.py:112-119`）。
5. `_send_once` 按 event 分派到 `send_reasoning_delta/end`、`send_reasoning`、`send_file_edit_events`、`send_delta`（stream）或 `send`（`manager.py:908-931`）。
6. **`TelegramChannel.send()`**（`runtime.py:1059-1193`）：
   - `_wait_for_app()`：app 重建中最多等 2s，等不到就 raise（让 manager 重试）；channel 已停则静默返回（`runtime.py:780-795`、`73`）。
   - 最终回复（非 ProgressEvent）：停 typing、移除 👀 reaction（`runtime.py:1066-1073`）。
   - `chat_id` 必须可 int()，否则记异常丢弃（`runtime.py:1075-1079`）；`reply_to_message` 配置开启时用 metadata `message_id` 构造 `ReplyParameters(allow_sending_without_reply=True)`（`runtime.py:1080-1094`）；thread id 从 metadata 或 `_message_threads` 缓存取（`runtime.py:1081-1086`）。
   - `ContextCompactionEvent` 特判：started 发一条并记 message_id，终态原地 edit（失败则重发新消息），缓存上限 64（`runtime.py:1096-1102`、`1269-1314`、`57`）。
   - **媒体**：逐条按扩展名猜类型 photo/video/voice/audio/document（`_get_media_type`，`runtime.py:860-872`）选 sender API；HTTP(S) URL 直传（先 `validate_url_target` SSRF 校验）；本地文件读 bytes + filename 上传；video 加 `supports_streaming=True`；单条失败发 `[Failed to send: ...]` 占位文本（`runtime.py:1104-1158`）。
   - **文本**：tool_hint → `<blockquote expandable>` 折叠块（`runtime.py:1162`、`193-195`）；buttons → InlineKeyboardMarkup（callback_data 截到 64 字节），未开 inline_keyboards 时按钮 label 拼进正文（`runtime.py:1163-1170`、`2175-2196`）；`metadata.render_as == "text"` 时命令名渲染回 Telegram 别名且跳过格式化（`runtime.py:1166-1167`、`479-500`）。
   - rich 快路：`rich_messages=True` 且未 latch 关闭时先试 Bot API 10.1 `sendRichMessage`（raw markdown），能力错误永久关闭 `_rich_send_disabled`（`runtime.py:1172-1184`、`905-959`、`879-903`）。
   - 常规路：markdown 按 4000 字符分块（保代码围栏平衡的分割器，跨块补 ```）（`runtime.py:44-48`、`102-185`、`1186-1193`）→ `_send_text`：`_markdown_to_telegram_html`（代码块/表格转 box-drawing/标题转粗体/链接/粗斜删/列表，`runtime.py:235-354`）以 `parse_mode="HTML"` 发送，`BadRequest` 时降级纯文本重发（`runtime.py:1230-1263`）。
   - API 调用层 `_call_with_retry`：3 次尝试，`TimedOut` 按 0.5s 倍增退避，`RetryAfter`（flood control）按服务端要求等待（`runtime.py:388-389`、`1195-1228`）。
7. **流式 `send_delta()`**（`runtime.py:1316-1518`）：per-chat `_StreamBuf{text, message_id, draft_id, last_edit, stream_id}`（`runtime.py:393-400`、`560`）。
   - 首块：私聊且 rich 开启 → `sendRichMessageDraft` 建 ephemeral draft（draft_id = 非零时间戳取模，`runtime.py:961-964`），draft 更新最小间隔 0.75s（40 次/30s/chat 限速，`runtime.py:55`、`1468-1472`）；否则 legacy：先发一条 `_strip_md_block` 纯文本预览消息并记 message_id（`runtime.py:1036-1057`、`1448-1466`）。
   - 后续块：距上次编辑 < `stream_edit_interval`(0.6s) 直接攒着；超过 4000（legacy）或 32768（rich）触发溢出冲刷——已满块固化发送、尾块继续流（网络类失败保留 buf 等下一 delta，避免 manager 重试造成重复追加）（`runtime.py:1467-1518`、`1520-1616`）。
   - `stream_end`：rich draft → 按 32768 分块逐块 `sendRichMessage` 固化，被拒则整段回落 legacy；legacy → 最终 HTML 按渲染后 ≤4096 分块，首块 `edit_message_text(parse_mode=HTML)`（`message is not modified` 幂等吞掉；HTML 失败再退纯文本），其余块逐条新发（`runtime.py:1334-1424`、`357-385`、`49`）。
   - `merge_next`：stream_end 被改写成非终结 delta（同一用户可见消息的 provider 边界）（`runtime.py:1334-1337`；`base.py:148-150`）。
   - 结束同时停 typing、移除 reaction、清 buf（`runtime.py:1344-1347`、`1372`、`1423`）。
8. `stop()`：停 typing、cancel media-group/inbound worker、`_teardown_app()`（`runtime.py:836-858`）。

### 3.5 Telegram 特有可靠性机制小结

| 机制 | 参数 | 引用 |
|---|---|---|
| polling liveness watchdog | 120s 无往返 → 重建 app | `runtime.py:66-68`、`802-809` |
| 启动退避 | 5s→300s，仅 NetworkError/TimedOut 可重试 | `runtime.py:69-70`、`770-778` |
| 发送重试（channel 内） | 3 次 / 0.5s 倍增 / RetryAfter 遵从 | `runtime.py:388-389`、`1195-1228` |
| 发送重试（manager 层） | send_max_retries + 1/2/4s | `manager.py:60`、`998-1056` |
| rich 能力 latch | 一次能力错误永久关 rich | `runtime.py:898-903` |
| stream rich 超时歧义 | `sendRichMessage` 超时视为成功不重试（防重复） | `runtime.py:997-1034` |
| 入站重排 | 0.2s 窗口按 (message_id, update_id) | `runtime.py:1877-1907` |
| media group 聚合 | 0.6s 缓冲 | `runtime.py:2051-2065` |

## 4. WebSocket channel 与 WebUI 协议

类：`WebSocketChannel(BaseChannel)`，`name="websocket"`（`nanobot/channels/websocket/runtime.py:363-367`）。manifest：`default_enabled=True`、capabilities `{"always_enabled"}`（不可热关，重启生效）（`websocket/manifest.py:13-21`；`manager.py:451-457`）。库：`websockets.asyncio.server`（`runtime.py:20`）。构造需要额外注入 `gateway: GatewayServices`（`runtime.py:369-407`），由 `ChannelManager._build_channel` 特判组装（`manager.py:183-215`；`webui/gateway_services.py:53-160`）。

配置 `WebSocketConfig`（`runtime.py:174-293`）：`enabled(True), host(127.0.0.1), port(8765), unix_socket_path, path("/"), public_ws_url, token, token_issue_path, token_issue_secret, trusted_proxy_auth, token_ttl_s(300, 30..86400), websocket_requires_token(True), allow_from(["*"]), streaming(True), max_message_bytes(37,748,736≈36MB, ≤40MB), ping_interval_s(20), ping_timeout_s(20), ssl_certfile, ssl_keyfile`。约束：`token_issue_path != path`（`runtime.py:276-282`）；host 为 0.0.0.0/:: 时必须配置 token / token_issue_secret / trusted_proxy_auth 之一（`runtime.py:284-293`）；unix socket 建好后 chmod 0600（`runtime.py:722-723`）。

### 4.1 监听器与 HTTP/WS 分流

- `start()` 内 runner 循环：`serve()`（TCP，可 TLS）或 `unix_serve()`；监听 socket 健康巡检（0.5s 间隔 `SO_ACCEPTCONN`，macOS ENOPROTOOPT 兜底），可恢复网络错误按 1/2/4/8/16/30s 退避重绑，稳定运行 30s 后清零失败计数；不可恢复（端口占用等）直接 raise 让 channel 进 failed（`runtime.py:585-643`、`678-792`、`65-103`）。
- 所有非 upgrade 请求经 `process_request` 进 HTTP 应用（`runtime.py:690-694`、`560-568`）→ `WebUIGatewayEndpoint.process_request`：path == `config.path` 且是完整 WS upgrade → 握手鉴权；否则 → `GatewayHTTPHandler.dispatch`（`webui/gateway_endpoint.py:52-75`）。
- HTTP 路由顺序（`webui/ws_http.py:556-617`）：`token_issue_path`（GET → `{"token","expires_in"}`，需 Bearer/X-Nanobot-Auth secret，`ws_http.py:637-661`）→ `/webui/bootstrap`、`/webui/terminal`（`ws_http.py:569-572`、`665-738`）→ settings 路由 → recovery → sessions（`/api/sessions/{key}/webui-thread`、`/context`、`/file-preview`、`/automations`、`/delete`、`/webui-thread/trace-detail`，`ws_http.py:764-793`）→ media → automations（`ws_http.py:1196-1204`）→ misc（`/api/sessions`、`/api/commands`、`/api/workspaces...`、`/api/webui/skills...`、`/api/webui/sidebar-state...`，`ws_http.py:1426-1456`）→ 其余 `/api/*` 404（`ws_http.py:605-607`）→ 静态 dist（`ws_http.py:609-617`）。
- `webui_request` 信封可把约 50 个 mutation action 经 WS 复用到同一张 HTTP 路由表（action→path 映射 `ws_http.py:168-219`）。

### 4.2 鉴权

握手鉴权 `authorize_websocket_handshake`（`gateway_endpoint.py:77-104`）：
1. trusted-proxy：来源 IP 在 `trusted_peer_cidrs` 且带指定 `assertion_header`（禁止 Host/X-Forwarded-* 等路由头充当断言）→ 直接通过并标记为受信 WebUI 连接（`gateway_endpoint.py:84-86`；`websocket/runtime.py:124-171`）。
2. 静态 token：query `?token=` 与 `config.token` `hmac.compare_digest` 恒时比较（`gateway_endpoint.py:88-91`）。
3. 一次性签发 token：`GatewayTokenStore.take_issued_token_audience` 消费即焚、TTL 校验、audience=webui 的连接进受信集合（`gateway_endpoint.py:92-94`、`106-111`；`gateway_tokens.py:50-82`）。
4. `websocket_requires_token=True`（默认）且无静态 token 时仍必须出示有效签发 token，否则 401（`gateway_endpoint.py:97-100`）。
前置还有：`terminal_protocol=1` 必须匹配本进程 `gatewayId`（uuid4 instance_id）否则 409；`client_id` 截 128 字符后过 `is_allowed`（allowFrom，默认 `["*"]`）否则 403（`gateway_endpoint.py:62-74`；`gateway_tokens.py:23`；`websocket/runtime.py:208`）。
bootstrap（`GET /webui/bootstrap`）：本地浏览器或持 secret 或受信代理才可访问；签发 `token`（audience=webui）、可选 `api_token`、`ws_url/ws_path/expires_in/limits/model_name/runtime_surface/runtime_capabilities/terminal{protocolVersion,gatewayId}`（`ws_http.py:665-738`）。REST API 用 `check_api_token`（Bearer 或 `?token=`，独立 TTL 池）（`gateway_tokens.py:28-39`；`ws_http.py:454-457`）。

### 4.3 连接生命周期与重连语义

- 连接建立：`client_id`（query，缺省生成 `anon-{hex12}`）→ 每连接生成 `default_chat_id = uuid4` → 发 `ready` 事件 → attach + hydrate（`runtime.py:794-826`）。
- **hydrate（重连状态回放）**：attach 后重放持久化 goal_state（active 或 blocked）与同进程仍在跑的 turn（`goal_status running + started_at + turn_id`）（`runtime.py:526-528`；`webui/session_projection.py:59-103`）；`attached` 事件附带 `model_preset/recovery_state/usage` 会话快照（`webui/session_projection.py:34-57`）。
- 历史消息不靠 WS 重放，走 HTTP `GET /api/sessions/websocket:{chat_id}/webui-thread`（transcript 持久化见 `runtime.py:1097-1167`；路由 `ws_http.py:773-775`）。
- 出站隔离：每连接独立有界队列（256 帧 / 8MB / 单帧发送 10s 超时），溢出或超时 → close 1013（队列满）/1011（发送失败）主动 retire，不拖累其他客户端（`runtime.py:72-75`、`934-1095`）。
- 断连清理：释放 temporary chat、退订全部 chat、清 request 锁与连接态（`runtime.py:509-524`；`webui/inbound_commands.py:201-213`）。
- 幂等 mutation：`webui_request` 以 `request_id + action + payload sha256` 缓存 5min/256 条，重放同 id 不同 action/payload → 409（`inbound_commands.py:54-55`、`737-841`）。

### 4.4 inbound 信封目录（client → server）

判定：JSON object 且带 string `type` 才算 typed envelope；否则按 legacy 处理（纯文本或 `{"content"|"text"|"message"}` 提取为消息文本）（`runtime.py:296-341`、`828-853`）。typed envelope 交 `WebUICommandRouter.dispatch`（`runtime.py:861-878`；`inbound_commands.py:285-474`）。

| type | payload 关键字段 | 语义/应答 | 引用 |
|---|---|---|---|
| `message` | `chat_id, content, turn_id?, media?(attachments), webui?, user_shell?, intent?, quoted_context?, cli_apps?, mcp_presets?, session_mentions?, workspace 相关字段` | 校验→媒体落盘→workspace scope→transcript→bus→广播 `user_message`（其他订阅端）→回 `message_accepted` | `inbound_commands.py:467-468`、`476-735` |
| `attach` | `chat_id` | 订阅既有 chat；回 `attached` + hydrate | `inbound_commands.py:364-391` |
| `new_chat` | workspace scope 字段 | 新建 uuid chat；回 `attached` + `session_updated` + hydrate | `inbound_commands.py:296-324` |
| `new_temporary_chat` | — | 连接私有不落盘 chat；回 `attached{temporary:true}` | `inbound_commands.py:325-341` |
| `fork_chat` | chat_id 等 | 会话分叉 | `inbound_commands.py:342-344` |
| `discard_temporary_chat` | `chat_id` | 丢弃临时 chat 并退订 | `inbound_commands.py:345-363` |
| `set_sidebar_state` | `state` | 仅受信 WebUI 连接；广播 `sidebar_state_updated` | `inbound_commands.py:392-417` |
| `set_workspace_scope` | `chat_id` + scope 字段 | 改 chat 的 workspace 作用域；回 `session_updated` | `inbound_commands.py:418-459` |
| `transcribe_audio` | `request_id, data_url, duration_ms?` | 回 `transcription_result` 或 `transcription_error` | `inbound_commands.py:460-466`；`webui/transcription_ws.py:22-51` |
| `webui_request` | `request_id, action, payload` | REST mutation 复用通道；回 `webui_response` | `inbound_commands.py:293-295`、`737-841` |
| （未知 type） | — | 回 `error{detail:"unknown type: ..."}` | `inbound_commands.py:470-474` |
| （legacy 文本帧） | 纯文本/`{"content"}` | 直接 `_handle_message`（is_dm=False，握手已鉴权故不走 pairing） | `runtime.py:841-853` |

chat_id 合法性：`^[A-Za-z0-9_:-]{1,64}$`（`webui/session_identity.py:9-14`）。入站文本另过 `WebUIIngressPolicy.validate_text`（`inbound_commands.py:509-517`）。`user_shell=true` 且内容以 `!` 开头（仅受信 WebUI 连接）→ 铸造内部 `_user_shell` metadata 并改写为 user-shell 命令（`inbound_commands.py:613-622`；`bus/events.py:17-18`）。

### 4.5 outbound 事件目录（server → client）

所有帧都是 JSON object，以 `event` 字段判别；除注明广播外均按 `chat_id` 订阅集 fan-out（`runtime.py:380-385`、`473-499`）。

| event | 方向/范围 | payload 字段 | 引用 |
|---|---|---|---|
| `ready` | 连接建立即发 | `chat_id, client_id, terminal?{protocolVersion,gatewayId}` | `runtime.py:809-822` |
| `attached` | 单连接 | `chat_id, temporary?, model_preset?, recovery_state?, usage?` | `inbound_commands.py:176-181`、`310-315`、`384-389`；`session_projection.py:34-57` |
| `error` | 单连接 | `detail, reason?, chat_id?, turn_id?, request_id?` | `inbound_commands.py:160-165` 等 |
| `message` | chat 订阅者 | `chat_id, text, turn_id?, media?, media_urls?(签名URL), reply_to?, latency_ms?, tool_events?, agent_ui?, kind?("tool_hint"\|"progress")` | `runtime.py:1172-1228` |
| `delta` | chat 订阅者 | `chat_id, text, stream_id?` | `runtime.py:1353-1361` |
| `stream_end` | chat 订阅者 | `chat_id, text?, stream_id?, resuming?, merge_next?` | `runtime.py:1339-1365` |
| `reasoning_delta` / `reasoning_end` | chat 订阅者 | `chat_id, text?, stream_id?` | `runtime.py:1230-1298` |
| `file_edit` | chat 订阅者 | `chat_id, edits[]` | `runtime.py:1300-1322` |
| `goal_state` | chat 订阅者 | `chat_id, goal_state` | `runtime.py:1428-1436` |
| `goal_status` | chat 订阅者 | `chat_id, status("running"\|"idle"), started_at?, turn_id?` | `runtime.py:1438-1461` |
| `session_updated` | **全连接广播** | `chat_id, scope?` | `runtime.py:1463-1473` |
| `user_message` | chat 其他订阅者 | `chat_id, text, starts_turn, turn_id?, media_urls?, cli_apps?, mcp_presets?, session_mentions?, active_turn_id?, started_at?, created_at_ms?, provenance?` | `inbound_commands.py:219-262`；`runtime.py:1475-1498` |
| `message_accepted` | 单连接 | `chat_id, turn_id, starts_turn, active_turn_id?, started_at?` | `inbound_commands.py:716-735` |
| `runtime_model_updated` | **全连接广播** | `model_name, model_preset?` | `runtime.py:1500-1518` |
| `turn_model_updated` | chat 订阅者 | `chat_id, model_name, model_preset?, context_window_tokens?, fallback?` | `runtime.py:1520-1550` |
| `turn_end` | chat 订阅者 | `chat_id, turn_id?, latency_ms?, goal_state?, usage?, round_usages?, context_window_tokens?, outcome?, failure_*?` | `webui/outbound_wire.py:86-97`、`198-231`；`outbound_projection.py:227-244` |
| `retry_status` | chat 订阅者 | `chat_id, state, attempt, max_attempts?, error_kind, retry_after_s?, turn_id?` | `outbound_wire.py:77-84`、`177-197` |
| `recovery_state` | chat 订阅者 | `chat_id, status, recovery_id, attempts, reason?, can_continue?` | `outbound_wire.py:68-75`、`116-132` |
| `context_compaction` | chat 订阅者（含离线持久化） | `chat_id, compaction_id, phase(started/succeeded/failed/cancelled)` | `outbound_wire.py:100-104`、`135-146`、`163-169` |
| `webui_response` | 单连接 | `request_id, ok, result? \| error{status,message}` | `inbound_commands.py:946-973` |
| `sidebar_state_updated` | 受信 WebUI 广播 | `state` | `inbound_commands.py:416`、`927-931` |
| `transcription_result` / `transcription_error` | 单连接 | `request_id, text?` / `detail, request_id?` | `transcription_ws.py:34-51` |

事件→线的投影层：`WebUIOutboundProjector.send()` 把 bus 的 typed event 映射到上述 wire 事件；无订阅者时仅记日志（quiet 列表）；`RetryWaitEvent` 不上线；`TurnEndEvent` 之后自动补发 `session_updated`（`webui/outbound_projection.py:110-256`）。出站正文的本地 markdown 图片会被改写为签名媒体 URL（`runtime.py:1180`、`1349`；`WebUIMediaGateway`）。tool_events 上线前剔除 base64 二进制（`outbound_wire.py:23-60`）。

### 4.6 web dist 静态文件

- dist 位置：wheel 内 `nanobot/web/dist`（构建时 hatch hook 用 bun/npm 把根目录 `webui/`（Vite 前端）打进去）（`manager.py:49-56`；`hatch_build.py:1-19`）。
- 挂载：无独立 mount 前缀——HTTP dispatch 的**最后兜底**，任何未命中 API 的路径都进 `_serve_static`（`ws_http.py:609-617`）。
- `_serve_static` 语义：`/` → index.html；路径穿越双重防护（`..` 分段检查 + resolve 后 relative_to 校验）；文件不存在 → SPA fallback 回 index.html；预压缩 `.gz` 协商（`Vary: Accept-Encoding`）；缓存策略 index.html `no-cache`、其余 `public, max-age=31536000, immutable`（`ws_http.py:1711-1766`）。
- 即 WebUI 前端与 WS/REST 同源同端口（默认 127.0.0.1:8765），gateway 健康端口（默认 18790）另有轻量 `/health`（见 §5.4）。

## 5. Gateway：运行时职责与启动装配

### 5.1 两层 gateway

- **进程管理层** `nanobot/gateway/`：不负责消息，只负责「一个共享本地 gateway 进程」的生命周期。`GatewayRuntimePaths`：state 文件 `~/.nanobot/run/gateway.json`（非默认 config/workspace 时加 `gateway.{sha1[:16]}.json` 实例后缀）、日志 `~/.nanobot/logs/gateway.log`（`gateway/runtime.py:127-149`、`699-703`、`69-70`）。`build_gateway_command` 生成子进程命令 `python -m nanobot gateway --foreground --port N [--verbose] [--workspace] [--config]`（`gateway/runtime.py:107-124`）。
- **运行时装配层** `nanobot/cli/gateway_runtime.py::_run_gateway`：真正构建 bus/agent/channels 并跑事件循环（`cli/gateway_runtime.py:340-1034`）。CLI 命令注册于 `cli/commands.py:451-464`（`nanobot gateway [--foreground|--background] / status / logs / stop / restart / install-service / uninstall-service`，`cli/gateway.py:152-408`）。

生命周期模式：
- **foreground**：`foreground_instance()` 上下文声明本进程为 gateway（写 state、检测已有实例 → `GatewayAlreadyRunningError`；Windows 后台拉起前台的 PID handoff 特判）（`gateway/runtime.py:327-392`；`cli/gateway_runtime.py:1028-1034`）。
- **background**：`start_background` 以子进程跑 `--foreground`，并把 on-demand 实例 promote 为 persistent（`gateway/runtime.py:233-268`）。
- **on-demand**：本地交互客户端（TUI 等）经 `GatewayClientLease` 注册租约（state 同目录 `gateway.clients.json`，FileLock 串行化）；`monitor_gateway_clients` 每秒轮询，最后一个客户端消失且 `auto_stop=true` 时自动停机（`gateway/runtime.py:245-257`、`419-548`、`682-696`；`cli/gateway_runtime.py:924-930`）。
- **OS 服务**：`GatewayServiceInstaller` 渲染 systemd user unit（`Restart=always`、`RestartSec=10`、`NoNewPrivileges=yes`）或 macOS LaunchAgent（`KeepAlive.SuccessfulExit=False`）（`gateway/service.py:44-203`、`253-280`、`129-169`）。

### 5.2 `_run_gateway` 装配顺序（`cli/gateway_runtime.py`）

```
_run_gateway(config, port, ...)                          # 340
 ├─ 1  端口占用预检（health 端口 + webui 端口，冲突即退出）  # 386-402
 ├─ 2  webui bundle 准备（缺 dist 时按 mode 构建/告警）      # 405-409
 ├─ 3  sync_workspace_templates(workspace)                # 410
 ├─ 4  bus = MessageBus()                                 # 411
 ├─ 5  provider snapshot（LLM 工厂 + 用量观察器；未配置 provider
 │      时降级为 unconfigured snapshot 而不是崩溃）          # 414-440
 ├─ 6  SessionManager(workspace_path)                     # 441
 ├─ 7  GatewayInstance.resolve + GatewayRuntime（前台/后台同一身份）# 443-456
 ├─ 8  CronService(workspace/cron/jobs.json) + LocalTriggerStore # 462-465
 ├─ 9  TurnDeliveryFactory(bus, WebuiTurnRoutePolicy)      # 467-470
 ├─ 10 ToolRegistry + MCPProvider.from_config              # 472-473
 ├─ 11 RecoveryCoordinator(sessions, bus, unified_session)  # 475-479
 ├─ 12 AgentLoop.from_config(config, bus, provider..., cron,
 │      session_manager, turn_delivery_factory, hooks=[MCP readiness,
 │      file-edit activity], recovery_admission)            # 482-499
 ├─ 13 WebuiTurnCoordinator(bus, sessions, recovery)       # 503-508
 ├─ 14 _deliver_to_channel（发布 + 可选镜像进 session）挂到 MessageTool # 519-553
 ├─ 15 cron.on_job：dream / heartbeat / bound cron 三类执行路径  # 556-700
 ├─ 16 ChannelManager(config, bus, session_manager, cron, triggers,
 │      webui_* 回调×9, config_path)  ← channels 在构造时即完成
 │      发现与实例化（_init_channels）                       # 715-733；manager.py:150
 ├─ 17 注册 dream / heartbeat 系统 cron job                 # 817-847
 └─ 18 run()（asyncio）                                     # 896-1034
      ├─ cron.start()                                      # 910
      ├─ agent.runtime_resolver.invalidate()               # 912
      ├─ recovery.scan()   ← 必须先于 channel 收新输入        # 913-916
      └─ 并发 tasks（asyncio.gather）                        # 932-970
          ├─ nanobot-config-watcher（配置文件热更 → invalidate）# 933-939
          ├─ nanobot-agent-loop（mcp.connect + agent.run）    # 917-922, 940
          ├─ nanobot-channels（ChannelManager.start_all）     # 941
          ├─ nanobot-local-triggers                          # 942-949
          ├─ nanobot-gateway-client-monitor（on-demand 租约）  # 924-930, 950-953
          ├─ nanobot-health-server（可选）                    # 955-959
          ├─ nanobot-open-browser（可选）                     # 960-964
          └─ nanobot-webui-dev-server watch（可选 Vite sidecar）# 965-969
```

信号与停机：SIGINT/SIGTERM → shutdown_event（第二次 Ctrl+C 强制 cancel 全部 task）（`cli/gateway_runtime.py:96-143`、`903-908`）。finally 顺序：`cron.stop` → `agent.preserve_inflight_turns_on_shutdown()`（gateway 退出保留恢复检查点，不当作用户 stop）→ `agent.stop` → `_close_gateway_runtime`（**先 `channels.stop_all()` 关传输，再 cancel tasks（15s 有界 + 二次 cancel），再 `agent.aclose` / `mcp.aclose`（各 15s 有界）**）→ `bus.drain()` → `sessions.flush_all()`（防 rclone/NFS 写回丢数据）→ 恢复信号处理器（`cli/gateway_runtime.py:997-1026`、`288-337`）。

### 5.3 gateway 托管哪些 channel

`ChannelManager` 托管全部启用的 channel 包实例（含 websocket）；`enabled_channels` 即 runtime name 列表（`manager.py:136`、`1098-1101`；`cli/gateway_runtime.py:750-753`）。websocket channel 因 `default_enabled=True` 事实上常驻（`websocket/manifest.py:18`；`manager.py:152-172` 缺省 section 时补默认配置）。

### 5.4 health / readiness

- health server 是 gateway 端口（`config.gateway.port`，默认 18790，`config/schema.py:353-359`）上的裸 asyncio HTTP，仅 `GET /health`：64 连接信号量 + 2s 读超时（`cli/gateway_runtime.py:230-231`、`761-816`）。
- readiness 语义：进程存活恒报 `"process": "alive"`；`ready` 取决于 websocket channel 是否 running（websocket 未启用则恒 ready）；非 ready 返回 503（`cli/gateway_runtime.py:250-285`、`789-792`）。
- 进程管理侧 `_gateway_health_ready` 用同一端点判定后台实例可用性（绕过系统代理直连，`gateway/runtime.py:42-66`、`290-302`）。
- 注意区分三个端口：gateway health（18790）、WebSocket/WebUI（8765）、Telegram webhook 本地监听（8081）（`config/schema.py:357`；`websocket/runtime.py:198`；`telegram/runtime.py:434`）。

### 5.5 gateway 与 bus/agent 的关系

gateway 进程内只有**一个** bus 实例，`AgentLoop` 是 inbound 的唯一消费者（`cli/gateway_runtime.py:411`；`agent/loop.py:1267-1269`）；channels 只持有 bus 引用做 `publish_inbound`（`base.py:321`）。出站方向 agent 经 `TurnDeliveryFactory`/`publish_event` 写入同一 bus 的 outbound 队列，由 ChannelManager 的 dispatcher 消费（`cli/gateway_runtime.py:467-470`；`bus/queue.py:45-65`；`manager.py:606`、`761-850`）。cron/heartbeat/trigger 的输出也走 `_deliver_to_channel` → `bus.publish_outbound`（可选把投递镜像写回 session 历史）（`cli/gateway_runtime.py:519-553`）。

## 6. 其余 bridges 清单（out of scope，仅登记）

共 15 个（telegram/websocket 之外）。公共实现模式：每包 `manifest.py` 导出 `PLUGIN = ChannelPlugin(...)`（name/display_name/runtime/dependencies/webui 前端入口），`runtime.py` 定义 `XxxChannel(BaseChannel)` 并覆写 `start/stop/send`（+按需覆写流式与策略钩子）；manifest 声明的 SDK 依赖只在启用时安装/导入（`plugin.py:22-94`、`registry.py:68-88`）。下表行号为 grep 实测的声明行。

| 包 | 平台 | 类（runtime.py） | 传输方式 | 覆写（除 start/stop/send 外） | manifest/类引用 |
|---|---|---|---|---|---|
| dingtalk | 钉钉 | `DingTalkChannel`（:228） | Stream Mode（dingtalk-stream SDK） | `default_config`:247 | `dingtalk/manifest.py:22-27` |
| discord | Discord | `DiscordChannel`（:381） | discord.py gateway | `send_delta`:527（`_StreamBuf`:43） | `discord/manifest.py:30-35` |
| email | Email | `EmailChannel`（:104） | IMAP 轮询 + SMTP 回复 | `progress_transport_defaults`:154 | `email/manifest.py:56-58`；`email/runtime.py:1` |
| feishu | 飞书/Lark | `FeishuChannel`（:949） | lark-oapi WS 长连接 | `login`:1004、`send_delta`:2272；**唯一 multi_instance** | `feishu/manifest.py:43-52`；`feishu/instances.py:249-250` |
| matrix | Matrix/Element | `MatrixChannel`（:307） | matrix-nio sync | `send_delta`:647 | `matrix/manifest.py:36-43` |
| mattermost | Mattermost | `MattermostChannel`（:87） | WebSocket + REST | `is_allowed`:366、`send_delta`:544 | `mattermost/manifest.py:36-38`；`mattermost/runtime.py:1` |
| mochat | MoChat | `MochatChannel`（:263） | Socket.IO（HTTP polling fallback） | — | `mochat/manifest.py:36-43` |
| msteams | Microsoft Teams | `MSTeamsChannel`（:107） | 内置小型 HTTP webhook 服务器（PyJWT+cryptography 验签） | — | `msteams/manifest.py:30-37`；`msteams/runtime.py:1` |
| napcat | NapCat/QQ(OneBot) | `NapcatChannel`（:56） | OneBot v11 WebSocket（aiohttp） | — | `napcat/manifest.py:22-27`；`napcat/runtime.py:1` |
| qq | QQ 官方机器人 | `QQChannel`（:196） | qq-botpy SDK（WS） | — | `qq/manifest.py:23-30` |
| signal | Signal | `SignalChannel`（:353） | signal-cli daemon JSON-RPC | `is_allowed`:390、`_handle_message`:423 | `signal/manifest.py:27-29`；`signal/runtime.py:1` |
| slack | Slack | `SlackChannel`（:104） | Socket Mode（slack-sdk） | `is_allowed`:807 | `slack/manifest.py:35-42`；`slack/runtime.py:1` |
| wecom | 企业微信 | `WecomChannel`（:69） | wecom-aibot-sdk | — | `wecom/manifest.py:19-24` |
| weixin | 个人微信 | `WeixinChannel`（:291） | ilinkai.weixin.qq.com HTTP long-poll | `progress_transport_defaults`:342、`should_retry_send_error`:345、`start_error_message`:352、`login`:979、`send_delta`:2126；connector（扫码登录态存储） | `weixin/manifest.py:35-44`；`weixin/runtime.py:1-3` |
| whatsapp | WhatsApp | `WhatsAppChannel`（:295） | neonize（Go 绑定）| `login`:383（QR）；connector、`local_state_present` | `whatsapp/manifest.py:27-36`；`whatsapp/runtime.py:1-2` |

公共模式补充：
- 需要交互式登录的包（feishu/weixin/whatsapp）声明 `connector="…connect:XxxConnectStore"`，由 `ChannelPlugin.load_connector()` 惰性构造（`plugin.py:96-113`；`feishu/manifest.py:47`、`weixin/manifest.py:38`、`whatsapp/manifest.py:30`）。
- webhook 型只有 msteams（自建 HTTP 服务器）与 telegram（PTB 内置 webhook server）；其余全部为出站长连接/轮询，无需公网入口。
- token/secret 类字段统一在各自 `SETUP_SPEC.fields` 标 `field("secret")`，快照默认不回显（如 telegram `telegram/manifest.py:10-11`、feishu `feishu/manifest.py:11-12`；`contracts.py:168-174`）。
- 通知路由元数据按 channel 白名单保留（telegram 保 `message_thread_id`；matrix/feishu/slack/mattermost 各自 thread 字段）（`channels/notification_routes.py:8-23`）。

## 7. 对 TS 化设计的关键约束与决策点

以下每条均由上文源码事实推出（依据随行标注）：

1. **接口契约可以极小**：TS `Channel` 接口只需 `start/stop/send` 必选；streaming/reasoning/file-edit/login 等全部可选方法。但注意上游用「子类是否覆写 send_delta」的鸭子检测决定 `supports_streaming`（`base.py:225-235`）——TS 里应改为显式 capability 声明（如 `readonly supportsStreaming: boolean` 或可选方法存在性检查 `typeof impl.sendDelta === 'function'`），避免依赖原型链比较。
2. **消息模型照抄成本低**：InboundMessage/OutboundMessage 都是扁平 dataclass（`bus/events.py:24-68`），TS 直接映射为 interface；`event` 字段是天然的 discriminated union（`outbound_events.py:23-111`），TS 可用 `{kind: 'progress'|'stream_delta'|...}` 判别式获得穷尽检查——比 Python 的 isinstance 链（`manager.py:908-931`）更强。
3. **必须保留的 manager 语义**（全部在 `manager.py`）：单 dispatcher 串行取件（767-850）；per-(channel,chat) FIFO 链 + 全局并发信号量 + 待发上限（728-759，常量 60-62）；delta 合并依赖「同步窥视队列头」（933-996 用 `get_nowait`）——TS 无对等 API，需要在自有队列实现上提供 peek/drain 原语；重试退避 1/2/4s 与 `should_retry_send_error` 短路（998-1056）；重复内容指纹抑制（683-719）；`_wants_stream` 元数据约定（`base.py:307-308`）。
4. **channel 插件化 = 目录约定 + 惰性加载**：上游靠 `manifest.py` 免依赖描述符（PEP 508 deps、runtime "module:attr"、包内路径封闭性校验）（`plugin.py:22-94`、`134-179`）。TS 对等物：每 channel 一个子包，manifest 用 `import()` 字符串指向 runtime，可选 SDK 放 peerDependencies/optionalDependencies；「未启用不 import SDK」这一硬约束必须保留（依赖缺失时 channel 标记 error 而非进程崩溃，`manager.py:279-309`）。
5. **多实例与 runtime name**：`feishu.{instance}` 命名作用域与冲突检测是既有契约（`contracts.py:325-334`、`544-554`；`manager.py:262-276`），TS 化若支持多账号需原样保留；单实例 channel 的 runtime name 恒等于 channel 名（出站路由键 = runtime name，`manager.py:830`）。
6. **websocket channel 不是普通 channel**：它被 manager 按名字特判并注入 `GatewayServices`（HTTP router、token store、transcript、workspace、temporary chats、settings）（`manager.py:183-215`；`gateway_services.py:32-160`），且 `always_enabled` 不可热关（`websocket/manifest.py:19`；`manager.py:451-457`），health readiness 也绑定它（`cli/gateway_runtime.py:262-285`）。TS 设计决策点：把「WebUI gateway（HTTP+WS+静态站）」从 channel 抽象中拆出为独立子系统、只留一个薄 channel adapter 对接 bus，还是复刻现状。上游的耦合是历史形成的显式特判，拆分是低风险改进。
7. **WS 协议面很大且有版本化雏形**：typed envelope（10 个入站 type）+ 23 种出站 event + `webui_request` 的 request_id 幂等（sha256 digest、5min/256 缓存、409 冲突）+ terminal `protocolVersion:1`/`gatewayId`（`inbound_commands.py:285-474`、`737-841`；`gateway_endpoint.py:62-68`）。TS 化建议以本目录（§4.4/4.5）为协议基线，用 zod/valibot 固化信封 schema，并保留 legacy 纯文本帧兼容层（`websocket/runtime.py:296-314`）。
8. **鉴权语义必须逐条对齐**：恒时比较（`hmac.compare_digest`，`gateway_endpoint.py:91`）、一次性 token 消费即焚 + audience 区分（`gateway_tokens.py:68-82`）、trusted-proxy 断言头黑名单（禁止 Host/X-Forwarded-* 充当断言，`websocket/runtime.py:106-164`）、wildcard host 强制鉴权（`websocket/runtime.py:284-293`）、bootstrap localhost-only 兜底（`ws_http.py:675-680`）。TS 对应 `crypto.timingSafeEqual` 等。
9. **每连接背压是明确产品语义**：256 帧/8MB/10s 发送超时 → close 1013/1011 retire（`websocket/runtime.py:72-75`、`999-1095`）。TS 实现不能简化为「慢客户端无限缓冲」。
10. **Telegram 迁移到 grammY/telegraf 时需搬运的不变量**：双连接池分离（发送 vs getUpdates，`telegram/runtime.py:665-685`）；120s polling watchdog + app 重建（603-657、802-809）；0.2s 入站重排窗口（1877-1907）；0.6s media group 聚合（2051-2065）；fence-balanced markdown 分割器与 4000/4096/32768 三层限制（102-185、357-385、44-53）；HTML 失败降纯文本（1230-1263）；rich draft 0.75s 限速与超时歧义不重试（1468-1472、997-1034）；RetryAfter 洪水控制（1214-1227）；`id|username` 复合 sender 与 allowlist 拆分匹配（1645-1649、574-591）；topic session key（1664-1670）。
11. **gateway 进程管理的核心是文件协议**：state JSON + FileLock + lease 文件 + 原子写（mkstemp+rename+fsync）（`gateway/runtime.py:229-231`、`438-440`、`663-679`）。TS（Node）化需要跨进程文件锁等价物（如 proper-lockfile），且保留 pid/进程身份校验防 stale state（`process_identity_record`，`gateway/runtime.py:378`、`579-636`）。决策点：是否保留 on-demand 租约自动停机语义（682-696）。
12. **停机顺序是正确性约束**：先关 channel 传输再 cancel agent task，有界等待 + 二次 cancel，最后 drain bus、flush sessions（`cli/gateway_runtime.py:288-337`、`997-1026`）；`preserve_inflight_turns_on_shutdown` 把「进程退出」与「用户 stop」区分开（1004-1007）。TS 需等价的优雅停机编排。
13. **recovery 先于 channel 收输入**：`recovery.scan()` 必须在 `channels.start_all()` 之前完成，否则新消息会与恢复中的旧 turn 竞争（`cli/gateway_runtime.py:913-916`、`agent/loop.py:1329-1335`）。装配顺序不可打乱。
14. **session key 规则要原样保留**：`channel:chat_id` 默认 + override + unified 折叠（`bus/events.py:39-42`；`session/keys.py:12-16`；`agent/loop.py:901-905`）；WebUI 持久键前缀 `websocket:`（`session_identity.py:8-19`）。跨语言迁移时这是存储兼容面。
15. **pairing 流程位于 base 而非各 channel**：DM 未授权 → 配对码（`base.py:276-304`），websocket 明确豁免（握手已鉴权，is_dm=False，`websocket/runtime.py:844-853`）。TS 抽象应把「授权失败分支」留在基类模板方法里。
16. **静态站与 API 同源单端口**：SPA fallback、预压缩 gz、immutable 缓存（`ws_http.py:1711-1766`）。若 TS 化改用 Express/Fastify/Hono，需要等价 fallback 与缓存头语义；webui 前端源码在仓库根 `webui/`，构建产物进 `nanobot/web/dist`（`hatch_build.py:1-19`）——TS 化后前端构建管线可以原样保留。
17. **规模参考**（决策「复刻范围」用）：telegram/runtime.py 2231 行、websocket/runtime.py 1550 行 + `nanobot/webui/` 目录 49 个 .py（其中 ws_http.py 1906 行、inbound_commands.py 991 行）、manager.py 1101 行、gateway 进程管理与 CLI（gateway/runtime.py 703 + gateway/service.py 286 + cli/gateway.py 410 + cli/gateway_runtime.py 1034）≈ 2433 行。WebUI REST/mutation 面（settings/skills/automations/mcp/oauth…）远大于 channel 抽象本身，是 TS 化的主要工作量所在。

---

*完。本笔记全部断言可由引用行号在 `/Users/xmon/Code/AgentProjects/nanobot` 复核；标注「推断」处为非直接源码事实。*

