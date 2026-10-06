# r15 · Multica 的 run 过程呈现（UI 渲染 + 事件流）源码级事实

> 目的：把「一个 agent 正在跑的工作单元在 Multica UI 上怎么呈现」钉到源码级事实（前端渲染 + wire + 落库时机），供 pacman 总管抽屉的实时行改动做对照。
> 素材 A（源码侧，唯一一手来源）：`multica-ai/multica` 浅克隆 `--depth 1`，HEAD = `b4ca5b4a23e68b26292a680dca7689a952bb1cd5`（2026-10-04 12:48:20 +0800，"refactor(skills): retire legacy issue skill redirect (#9046)"），落在 `/tmp/multica-src-runui.BHtJaX`（仓外，不污染 pacman）。克隆时间 2026-10-05 15:57 UTC。
> 素材 B（文档口径）：同仓 `apps/docs/content/docs/*.mdx`（随源码版本走）。
> 未使用素材：本机 Multica 桌面版（`~/Library/Application Support/Multica/`）与 CLI 未取；活界面未取——源码已能回答全部六问，不需要 B/C 一级来源里的后两类。
> 阅读约定：出处两类，逐条标注——**C**（代码）= multica 源码 `路径:行号`（相对克隆根）；**D**（文档）= `apps/docs/content/docs/*.mdx:行号`；**[推断]** = 无直接出处、由代码行为推断的结论。全篇无 emoji。
> 命名先说清：Multica 里一次 agent 执行叫 **task**（UI 层叫 **run**）。UI 有两条独立的呈现面共用同一份 task 数据——**chat 面**（`packages/views/chat/`，会话流里 agent 的回复）与 **issue 面**（`packages/views/issues/`，issue 详情里的 live 运行条 + 执行日志）。两边都读同一份 `task_message` 行，但切分与折叠逻辑不同，下文分开写。

---

## 1. 结论先行

1. **一次 run 在 UI 上是「一行」（one row），页面按 `task:<taskId>` 作行键**；实时流与终稿共用这一个键，落库时是**同一行的数据原地替换**，不是卸载重建（`packages/views/chat/components/chat-message-list.tsx:124-137,469-479`）。行**内部**再按时间线切成多条 step（叙述文本 / 工具调用 / thinking / error），这些 step 是**实时逐个出现**的，不是收尾批量补的。（§2、§3）
2. **一条 `task_message` 的界不是「一次工具调用」，而是「一段连续同类型增量」**：daemon 把连续的 text（或 thinking）增量攒进同一个缓冲，直到**类型变化 / 500ms tick / 运行结束**才封成一行；工具调用与工具结果各是**独立行**，不进这个缓冲。（`server/internal/daemon/daemon.go:9439-9469,9573-9666`）（§2）
3. **切分与折叠发生在读取端，不在写入端**：wire 是扁平的 `(seq, type, tool, content, input, output, call_id)` 行；前端把 `tool_use`/`tool_result` 按 `call_id` 配成一步、把连续同类 text 合并、把连续同工具调用（≥3 个且非 shell）折成一组。（`packages/views/common/task-transcript/build-steps.ts:95-198`、`build-timeline.ts:23-46,135-154`）（§2、§4）
4. **工具调用在流式期就可见**，形态是**可展开的一行**（provider 原生工具名 + 最有信息量的一个参数），不是独立大卡片。工具行与前后叙述文本的**交错次序被保留**，靠 `seq` 排序。（`chat-message-list.tsx:1232-1280`、`trace-event-presenter.ts:124-147`）（§3）
5. **中间叙述文本与最终结论在 chat 面被显式分层**：`splitTimeline` 把时间线切成 preface（首个非文本项之前的文本）/ middle（首个到最后一个非文本项，含夹在中间的文本）/ final（最后一个非文本项之后的文本）。流式期 final 在 fold 外当正文渲染；**settled 后 spine 的落库 `chat_message.content` 接管 final**，preface+middle 留作过程历史。（`packages/views/chat/lib/copy-text.ts:16-34`、`chat-message-list.tsx:1075-1150`）（§3、§4）
6. **一次 run 的多条 assistant 消息不各占 UI 记录，而是合并**。两级合并：daemon 端连续增量封进一行（§2），前端 `buildTimeline` 再把相邻同类型行二次合并（`build-timeline.ts:135-154`）。一个 chat 会话里**每一轮**各占一行，轮内不再拆成多行。（§4）
7. **折叠默认值与流态联动**：chat 面的过程 fold **流式期默认展开、settled 时自动折叠**（`chat-message-list.tsx:1171-1176`）；issue 面 live 运行条**默认折叠**（`inline-comment-run.tsx:42`）；完整 transcript 弹窗**默认时间正序、不跟随**，只有切到「Newest first」才启用 live 跟随（`agent-transcript-dialog.tsx:581-582`、`stores/transcript-view-store.ts:19-20`）。（§5）
8. **wire 面：实时推送走 WebSocket，且「先落库再广播」**。daemon → server 是 HTTP POST 批量（500ms 一拍 + 首个可见事件立即）、server 先 `CreateTaskMessages` 落库、再按 seq 顺序 `publishTask` 广播；前端按 `task:message` 帧增量写 React Query 缓存，客户端在**打开某个 run 时**再从 REST 回填整条时间线。没有 SSE、没有轮询。（`server/internal/handler/daemon.go:5090-5233`、`use-realtime-sync.ts:1488-1512`、`chat/queries.ts:218-235,321`）（§6）
9. **文本行与工具行在 wire 上是同一个通道**（同一个 `task:message` 事件、同一个 seq 空间、按 seq 全局排序），只是 `type` 字段不同；差异全在下游渲染（§3）与 daemon 的封口策略（§2）。（§6）
10. 「打字行被落库行接管」这类交接是**显式写死的**：chat 面用 `pendingAlreadyPersisted` 门 + 稳定行键 + 同一个 `AssistantMessage` 组件承载两态（`chat-message-list.tsx:238-257,524-600`）；缓存写入用按 `seq` 的并集合并，避免回填覆盖已到的实时帧（`chat/queries.ts:249-298`）。（§6）

---

## 2. 面 1：过程是「一个持续增长的块」还是「按步骤切分的多条记录」

### 2.1 源码实测（C）

**一条 run = UI 上一个实体，内部是多条按 seq 排序的 step。**

- 实时行与终稿行**共用一个 Virtuoso 行键**：`messageRowKey` 对带 `task_id` 的 assistant 消息返回 `task:<taskId>`，与 live 行 `key: task:<taskId>` 相同（`packages/views/chat/components/chat-message-list.tsx:124-137`，live 行构造在 `:275`）。注释（`:117-123`）明说这是为了让「已经在渲染的 Mermaid 图 / HTML iframe 在任务完成时挂载不丢」。
- 行内渲染 `TimelineView` → 时间线是一条条 step 顺序铺开（下文 §3）。

**step 的界定义在两端，且都是「连续同类型增量」而非「一步一工具」：**

- **daemon 写入端**（`server/internal/daemon/daemon.go`）：
  - `appendPending(type, content)`：text / thinking 增量追加进 `pendingContent` 缓冲；类型切换时先 `sealPendingLocked()` 把上一段封成一行（`:9455-9469`）。
  - `sealPendingLocked()`：把当前连续帧封成一个带 `seq` 的 `TaskMessageData`（`:9439-9453`）。
  - `flush()`：封当前帧 + 把 `batch` 整批发出（`:9471-9487`），由 500ms ticker（`:9489`）与「首个可见事件」（`flushFirstVisible`，`:9508-9517`）触发。
  - `tool_use` / `tool_result` / `error` **不走缓冲**，各自立即 `batch = append(...)` 成独立行（`:9573-9666`）；`tool_use` 到达时先 `sealPendingLocked()` 封住前面的文本帧（`:9578`），保证文本行与工具行不混在一个 seq 里。
- **前端读取端**：`buildTimeline(msgs)` 按 `seq` 排序，把相邻的 `text`/`thinking` 行再合并（`:135-154`）；合并判据 `canMergeStreamingText` = 前一条与后一条同为 `text` 或同为 `thinking`（`build-timeline.ts:23-25`）。

**「切分时机」是实时的：** daemon 每个 500ms tick 或类型切换就发布一次；客户端 `task:message` 帧**首个立即写缓存、其后按 100ms 固定窗口合并**（`use-realtime-sync.ts:137,1498-1505`）。收尾只有一次补 flush（`daemon.go:9678`），不是把整轮攒到最后一次性切。

### 2.2 文档口径（D）

- `apps/docs/content/docs/tasks.mdx:66`：「Click **View transcript** on a row to see the agent's messages, tool calls, and error output. For a run still in progress the transcript keeps streaming while the dialog stays open, and a **Newest first** toggle flips the event order.」——文档确认「messages / tool calls / error output」三类与「流式期间持续追加」。

### 2.3 差异

- 文档只说 transcript「keeps streaming」，没写切分粒度与时机。源码实测的粒度是**「连续同类型增量」为一行**，而**不是**「一次工具调用为一行」——后者是读取端再加工的产物（§4）。
- 文档没提「同一行实时/终稿原地替换」，这是源码里靠稳定行键 + 单组件双态实现的（§6）。

---

## 3. 面 2 / 面 3：工具调用的形态、交错次序、过程与结论的分层

### 3.1 chat 面（会话流内 agent 回复）

**工具调用形态 = 可展开的一行。**

- `ToolCallRow`（`chat-message-list.tsx:1247-1280`）：折叠态是 `工具名 + 一行摘要`，点开是完整输入 JSON（`<pre>`）。`item.tool` 原样显示（provider 原生名，不重命名）。
- 摘要由 `traceToolArgSummary` 从 input 里按优先级挑一个最有信息量的参数（`query` → 多文件 patch → `file_path`/`path` → `pattern` → `description` → `command`/`cmd` → `prompt` → `skill` → 第一个短字符串），命令还会剥掉 `zsh -lc '...'` 外壳并截到 120 字符（`trace-event-presenter.ts:124-147`）。
- `ToolResultRow`（`:1282-1310`）：单独一行，摘要取输出前 120 字符，点开看前 4000 字符。
- `ThinkingRow`（`:1312-1332`）：单独一行，斜体预览前 150 字符，点开看全文。
- `ErrorRow`（`:1334-1341`）：不可折叠的一行，destructive 色。

**交错次序保留。** `TimelineView` 把时间线按 seq 铺开为行序列，`ItemRow` 按 `item.type` 分派到上面四种行（`:1232-1245`）；fold 内部对 `text` 类型走 `MiddleTextRow`、其余走 `ItemRow`（`:1187-1198`）。即 **工具行与夹在它们之间的叙述文本按到达次序交错呈现**，不是把工具汇总到一处。

**过程与结论分开——边界由 `splitTimeline` 定义**（`packages/views/chat/lib/copy-text.ts:16-34`）：

- `preface` = 首个非 text 项（第一个 thinking/tool/error）之前的 text；
- `middle` = 从首个非 text 项到最后一个非 text 项（含其间的 text）；
- `final` = 最后一个非 text 项之后的 text。
- 流式期渲染：preface 在 fold 上方当正文（`RichContent`），middle 进 `OuterProcessFold`，final 在 fold 下方当正文（`chat-message-list.tsx:1115-1149`）。
- **settled 后**：`processItems = preface + middle` 仍留在 fold 里；`final` 被**落库的 `chat_message.content`（canonical answer）替换**（`:1088-1112`，`canonicalAnswerText` 在 `copy-text.ts:41-47`）。注释（`:1062-1073`）明说：「Once settled, the persisted chat_message content is authoritative for the answer. Preface + middle remain in the process fold so intermediate narration is still inspectable; only trailing transcript text is replaced.」

### 3.2 issue 面（issue 详情内的 live 运行条 + 完整 transcript 弹窗）

**live 运行条（`InlineCommentRun`）**（`packages/views/issues/components/inline-comment-run.tsx`）：

- 折叠态**只有一行活动摘要**：`RunActivitySummary` 显示当前活动——优先「最后一个尚无结果的工具调用」的参数字符串，否则最后一条有内容的 step（text 首行 / thinking 预览 / error 文案 / 「等待响应」）（`:127-136,376-382`）。状态前缀由 task.status 决定（queued/dispatched/waiting/running）（`:137-140`）。
- 展开态是 step 列表（`:231-243`）：`buildSteps`→`groupSteps` 产出 `TraceRow`，每行 `InlineStep`（`:318-361`）是原生 `<details>` 折叠，折叠态一行 `图标 + 摘要 + 箭头`，展开显示该步的 input/result 体（`StepBody`）。工具配对靠 `call_id`，shell 调用不折叠、同工具连续 ≥3 个才折成组（见 §4）。
- 默认**只渲染尾部 12 行**，更多走「显示更早的 N 条」按钮（`:98,236-237`）。

**完整 transcript 弹窗（`AgentTranscriptDialog`）**（`packages/views/common/task-transcript/agent-transcript-dialog.tsx`）：

- 文件头注释（`:109-112`）总结四层读法：「what happened (header), what it produced (outcome), where the time went (timeline), and the evidence (steps)」。
- step 行分派（`TranscriptRow`，`:1412-1417`）：group → `GroupRow`；text 且非 call → `ProseRow`；其余 → `StepRow`。
- `ProseRow`（`:1491-1506`）：**agent 自己的话以正文尺寸常开**，注释（`:1472-1489`）明说这是「the layer inversion the redesign turns on: ... Prose is content and stays open; tool calls are evidence and fold.」——即**叙述文本默认全展开，工具调用默认折叠成一行**。
- `StepRow`（`:1510-1587`）：一行 `偏移时间 + 竖线 + 图标 + 工具名/kind + 一行摘要 + 时长`，点选后右侧开 `StepInspector`（`:1700+`）看完整 input/result 体。
- 展开体的差异化渲染见 `trace-event-presenter.ts:236-258`（`TraceEventDetail` 四种：diff / file / patch / text）——文件改写成 diff、整文件写入当纯内容、多文件 patch 一节一文件。

### 3.3 文档口径与差异

- `tasks.mdx:66` 只列「agent's messages, tool calls, and error output」三类；源码实测的 step 类型是 `text`/`thinking`/`tool_use`/`tool_result`/`error` 五类（`build-timeline.ts:7`、`trace-event-presenter.ts:28-34`）——文档漏了 thinking。
- 文档没有描述「fold」这个结构；`splitTimeline` 的三段分层纯属源码实现（注释自称 "Conductor-style"）。[推断] 这是刻意的产品设计：过程可查但不喧宾夺主。

---

## 4. 面 4：多条 assistant 消息的合并 / 拆分判据

### 4.1 合并（一次 run 内的多条消息）

两级：

1. **daemon 端**（写入前）：连续同类型 text 增量封成一行（`daemon.go:9455-9469`）。
2. **前端**（读取时）：`buildTimeline`（`packages/views/common/task-transcript/build-timeline.ts:135-154`）把相邻的 `text`/`thinking` 行再合并，判据与 `coalesceTimelineItems`（`:28-46`）一致——`canMergeStreamingText(prev, next)` = 两者同为 `text` 或同为 `thinking`（`:23-25`）。合并时 content 直接拼接、`created_at` 取后者。

另有按 `call_id` 的**工具配对**（不发散成两行）：`buildSteps` 把 `tool_use` 与其 `tool_result` 合成一个 `TraceCallStep`，用**不透明的 `call_id`** 配对，没有 `call_id` 的老记录退回「按工具名 FIFO」；两套键分开存（`id:` vs `tool:` 前缀），互不串（`build-steps.ts:95-149`）。孤儿 result 保留为独立 step，绝不丢（`:128-137`）。

**折叠成组**的判据（`build-steps.ts:152-198`）：

- `MIN_GROUP_SIZE = 3`（`:64`）——连续同工具调用 ≥3 个才折成 `TraceGroupRow`；
- **shell 调用永不折叠**（`isShellCall`，`:75-77`），判据是 input 带 `command` 字符串（不依赖工具名白名单，跨 backend 成立）。

### 4.2 拆分（多个 run / 多轮）

- **chat 会话**：每一轮（一个 task）占一行（行键 `task:<taskId>`），轮内不拆多行（`chat-message-list.tsx:124-137,265-278`）。
- **issue 执行日志**：每个 run 一行（`execution-log-section.tsx:47-72` 注释 + active/past 两桶）；完整过程在每行的 transcript 弹窗里。
- **issue live 运行条**：每个 run 一个 section（`inline-comment-run.tsx:173-175`，`data-run-id={task.id}`）。

**判据的代码位置汇总**：轮 = task 的边界（`task.id` / `task_id`）；轮内 step 边界 = daemon `sealPendingLocked`/`appendPending`（`daemon.go:9439-9469`）+ 前端 `buildTimeline`（`build-timeline.ts:135-154`）；工具对 = `buildSteps` 的 `call_id` 配对（`build-steps.ts:95-149`）。

---

## 5. 面 5：长过程的折叠 / 展开与默认值

| 面 | 结构 | 默认 |
|---|---|---|
| chat 过程 fold（`OuterProcessFold`） | `Collapsible`：preface/middle 收进「过程 N 步」折叠区 | **流式期默认展开，settled 自动折叠**（`chat-message-list.tsx:1171-1176`：`useState(!!isStreaming)`，`wasStreaming && !isStreaming → setOpen(false)`） |
| chat 单条工具/结果/thinking 行 | 各自 `Collapsible`，点开看详情 | 默认**折叠**（`ToolCallRow`/`ToolResultRow`/`ThinkingRow` 均 `useState(false)`，`:1249,1284,1313`） |
| chat 正文（final / preface） | `RichContent` | 常开 |
| issue live 运行条 step 列表 | `<details>` 每步折叠；尾部 12 行 | 整体默认**折叠**（`inline-comment-run.tsx:42`），标签「查看活动 · N 步」 |
| transcript 弹窗 step 列表 | 虚拟列表（`react-virtuoso`），`ProseRow` 常开、`StepRow`/`GroupRow` 折叠 | 时间**正序**、不跟随；`Newest first` 才启用 live 跟随（`agent-transcript-dialog.tsx:581-582`，默认值在 `packages/core/agents/stores/transcript-view-store.ts:19-20`） |
| transcript 弹窗「更长」内容 | `ToolDetailSurface` 超 1600 字符 / 14 行 → 渐隐 + 「显示全部」（`detail-surfaces.tsx:248-282`）；diff 超 14 行同理（`:201-229`） | 折叠 |
| 时间线（`RunTimeline`） | 双泳道（模型 / 工具）真实时间轴 + 1×/2×/4×/8× 缩放（`run-timeline.tsx:43,110-288`） | 常开（有 lanes 时） |

**live 跟随模型**（`transcript-follow.ts:1-70` + `chat 面` 的 `stick-to-bottom`）：共用同一个「live-end follow latch」纯状态机——读者主动滚动才解除跟随，系统位移不算；回到边缘区自动重新跟随。chat 面的 live 行滚动用 Virtuoso 的 `scrollToIndex({index:"LAST"})`（`chat-message-list.tsx:202-204`）。

**状态标签**（`TaskStatusPill`，`packages/views/chat/components/task-status-pill.tsx`）：按**最后一条非 error / 非 tool_result 消息的类型**决定标签——`thinking`→「思考中」、`text`→「正在输入」、`tool_use`→按工具 slug 映射（bash/exec→「运行命令」、read/glob→「读取文件」、grep→「搜索代码」、write/edit→「编辑」、web_search→「联网搜索」，未知→「工作中」）（`pickStageKeys`，`:61-123`；映射表 `:44-56`）。秒数用 1s ticker，锚点锁死首次渲染（`:169-199`）。

---

## 6. 面 6：wire 面（实时推送 vs 落库、增量与终稿收敛、工具/文本是否分通道）

### 6.1 通道

- **客户端收：WebSocket**。事件类型 `task:message`（`packages/core/types/events.ts:33`），payload 类型 `TaskMessagePayload`（`:291-316`）：`{task_id, issue_id, seq, type, tool?, call_id?, content?, input?, output?, output_truncated?, created_at?}`。WS 客户端在 `packages/core/api/ws-client.ts`（URL 由 `:85` 构造，`new WebSocket(url.toString())` 在 `:99`）。**无 SSE、无轮询**（grep `EventSource`/`text/event-stream` 在 core/web 全空；task messages 无 `refetchInterval`）。
- **daemon 发：HTTP POST 批量**。`ReportTaskMessages`（`server/internal/handler/daemon.go:5090`），body `{messages: [...]}`（`:5085-5087`）；由 500ms ticker + 首个可见事件驱动（`server/internal/daemon/daemon.go:9489,9508-9517`）。

### 6.2 落库时机：先落库再广播

- `ReportTaskMessages` 先 `CreateTaskMessages`（批插，`:5209`），**成功后才** `h.publishTask(protocol.EventTaskMessage, ...)` 按 seq 顺序逐条广播（`:5216-5230`）。注释（`:5217-5221`）明说：「CreateTaskMessages orders its result by seq ... subscribers render these events as they arrive, so the ordering lives in the query rather than in the clients.」
- 客户端注释直接确认这一契约（`packages/core/chat/queries.ts:321`）：「Dropping a frame for an unregistered task is safe — **the row is persisted before it is broadcast**, so whoever opens the task next fetches it from the server.」
- 落库前服务端**二次脱敏**（`redact.Text/InputMap`）并做 PostgreSQL NUL 清洗（`daemon.go:5157-5180`）；daemon 侧发送前也脱敏一次（`daemon.go:9590-9598`）。

### 6.3 增量的收敛（是否「打字行被落库行接管」）

**是，且是显式逻辑。**

- **缓存层收敛**：`task:message` 帧经 `mergeTaskMessagesBySeq`（`chat/queries.ts:249-258`，按 seq 去重、保留已有对象引用）写入 React Query 缓存 `["task-messages", taskId]`；REST 回填经 `structuralSharing: unionTaskMessagesBySeq`（`:209-213,280-298`，server 数据在冲突时胜出，但响应没提到的 seq **保留不删**）。注释（`:266-278`）说明原因：「a normal query response and the realtime stream race ... A plain replace would drop those seqs, and staleTime: Infinity means nothing would ever refetch them」。
- **视图层接管**：chat 面 `pendingAlreadyPersisted`（`chat-message-list.tsx:238-244`）= 当 messages 里已出现 `task_id === pendingTaskId` 的 assistant 消息时，**抑制 live 时间线**，改由落库消息承载；`showLiveTimeline` / `hasLive` 与之互斥（`:250-278`）。两者用**同一个 `AssistantMessage` 组件**渲染（`:469-479` 与 `:508-522`），`message` prop 从 `undefined`（流式）变为落库对象（settled），`phase` 从 `"streaming"` 变 `"settled"`（`:585`）。
- **回填时机**：`useTaskMessages(taskId, isLive, enabled)` 在挂载时 `refetchOnMount:"always"`、窗口聚焦 `refetchOnWindowFocus:"always"`，并在 `isLive` 由 true→false 时再 refetch（`chat/queries.ts:218-235`）——即「运行中靠 WS，打开/结束时靠 REST 补齐」。

### 6.4 工具行与文本行是不是两条通道

**同一个通道，同一个 seq 空间，只是 `type` 不同**（`events.ts:298` 的 `type` union 含 text/thinking/tool_use/tool_result/error）。差异只在下游：

- daemon 端：text/thinking 走缓冲封口，tool_use/tool_result/error 各自立即成行（§2.1）。
- 渲染端：chat 面按 type 分派到不同行组件（§3.1）；issue 面再用 `call_id` 把 tool_use/tool_result 配成一步（§4.1）。

[推断] 之所以工具行不进文本缓冲，是为了让「调用了什么工具」在 500ms 内就能出来、不被长文本拖住；而文本攒成一段是为了避免每个 token 一行把 transcript 撑爆（`build-steps.ts:3-16` 注释记录过历史教训：「a 75-call run rendered 150 rows」）。

### 6.5 各端的缓存键 / 摄取门

- 广播是**全 workspace fanout**（`daemon.go:5114-5120` 注释；`use-realtime-sync.ts:1443-1446`），但客户端有两个门（`use-realtime-sync.ts:1443-1457`）：(1) 只保留**本客户端已持有时间线缓存条目**的 task 的帧（`isTaskMessageTimelineHeld`，`chat/queries.ts:323-328`）；(2) 存活帧按 100ms 固定窗口合并成一次缓存写。写入前**再查一次**门（GC 可能已回收，`:1461-1472`）。

---

## 7. 对 pacman 的直接含义

pacman 现状（本仓 `chief-live-split` 分支实测位置）：一轮 = 一个 step = 一个 `activeRun`；在飞期间把整轮所有 `text_delta` **无分隔拼成一行 typing 行**（`apps/web/src/api/mappers.ts:1166-1174`）；轮末 transcript 上传才按 assistant message 拆行；带工具披露的 `LiveRow`（`apps/web/src/components/chat/live-row.tsx`）**只在首 token 之前**渲染（`mappers.ts:1175-1206`）。照 Multica 的做法，总管抽屉的实时行要做这几件事：

1. **行键稳定，落库即原地接管**：Multica 实时行与终稿行共用一个键（`task:<id>`），靠同一个组件渲染两态、靠 `pendingAlreadyPersisted` 门切换，落库时是「同一行的数据替换」而非卸载重建（`chat-message-list.tsx:124-137,238-257,469-479`）。pacman 已有「typing 行 ↔ 落库 robot 行」的交接注释（`mappers.ts:1182-1187`），可对照收紧：确认交接是数据替换而非 remount，避免 Markdown/工具展开态在交接瞬间丢。
2. **流式期就按边界切，别攒到轮末**：pacman 现在是「整轮 text_delta 一行、轮末才拆」。Multica 的切分在流式期实时发生——daemon 按「类型变化 / 500ms / 首个可见事件」封口（`daemon.go:9439-9517`），前端再按 seq 合并同类。对应到 pacman：typing 行内部应在**流式期**按事件边界（助手文本段落之间出现工具调用/thinking 时）就断开，而不是等 transcript 落库。
3. **工具行与文本行共存并交错，而非二选一**：pacman 现在「工具披露只在首 token 前，typing 接管后工具行缺席」（`mappers.ts:1193-1195`）。Multica 里工具行是**独立 step 行**，与叙述文本按 seq 交错、随工具对折叠成一步（`build-steps.ts:95-149`、`chat-message-list.tsx:1232-1280`）。总管抽屉应让工具调用在整轮期间持续可见、按次序插入，而不是被文本行顶掉。
4. **过程 / 结论分层，且边界可定义**：Multica 用 `splitTimeline` 三段划分，settled 后落库内容只接管 final，preface+middle 留作可查过程（`copy-text.ts:16-34`、`chat-message-list.tsx:1062-1112`）。pacman 若要做「过程 fold + 答案」，可直接复用这个边界定义（「首个非文本项之前 / 首个到最后一个非文本项 / 最后一个非文本项之后」），并让 fold **流式期默认展开、settled 自动折叠**（`:1171-1176`）。
5. **活动标签取「最新事件类型」，不写死文案**：Multica 的 `TaskStatusPill` 用最后一条非 error/tool_result 消息的类型 + 工具 slug 映射出标签（`task-status-pill.tsx:61-123`），秒数只在有真实起点时才渲染、绝不摆冻结数。pacman 已有 `activityLabel`/最近信号（#905，`mappers.ts:1196-1204`），可对照把抽屉实时行标签也变成「最新事件类型驱动」，并守住「没有真实时刻就整行不渲染秒数」。
6. **增量与终稿按 id/seq 去重合并，别让回填覆盖已到的实时帧**：Multica 用 `mergeTaskMessagesBySeq` + `unionTaskMessagesBySeq` + `structuralSharing`，server 数据在冲突时胜出但响应未提到的 seq 保留（`chat/queries.ts:209-298`）。pacman 的 SSE 已有 stream handoff（`apps/web/test/chief-stream-handoff.test.ts`），可对照检查「终稿重取是否可能丢掉流式期已经渲染、但落库行尚未包含的那一段」这类窗口。

---

## 8. 未拿到 / 边界

- 本机 Multica 桌面版（`~/Library/Application Support/Multica/`、app.asar）与 CLI 未取——源码已足以回答全部六问，且取实物只读成本高于收益。
- 活界面未取。
- `apps/docs/content/docs/tasks.mdx` 是唯一描述该 UI 的文档页（`chat.mdx` 讲 chat 用法，无过程呈现细节）；除 §2.2/§3.3 引的两句外无更多口径可对拍。
- 未验证：chat 面 `OuterProcessFold` 在多轮快速连续任务下折叠态是否会被下一轮的 streaming 重新展开——本次只读源码未实测（[推断] 会，因为 `open` 初值取 `isStreaming`，但同一 `AssistantMessage` 组件实例跨轮不重挂时 `open` 状态如何迁移未逐行追）。