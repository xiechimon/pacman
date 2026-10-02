# todos.dev 父卡去留取证（XMON-98 拍板点 1 · Lane A）

> 目的：对参考站 todos.dev（tds）取证四问——父任务概念存在性 / Chief 拆分时看板渲染 / 子卡溯源字段与可见呈现 / 整请求的观察容器。供 pacman「保存并开始」父卡去留裁决。
> 方法：两步走——①仓内归档（`docs/research/` r1/r2/r3/r5/r5b/r8/r12 + `assets/r5/raw/` 一手抓包）；②活体取证（ego-browser 已登录会话 + todos.dev API 直读 + 唯一写操作 = 缺口实验，r98 标记，事后已清理）。
> 证据分级：**[实测]**（本会话活体）／**[归档转引]**（r1–r12 一手归档，含 raw 抓包重解析）／**[推断]**。
> 环境：team `BoZYfvqKSGanlxsXVbXSa`（Xmon Dai's team，free 档）；机器 `xmonsMac-3574.local`；chief 绑定 Agent `r3-builder`（claude-sonnet-5 @ r3-gw 网关）；tds CLI 0.1.53。

---

## Q1 · todos.dev 有没有父任务/父卡/epic/goal 概念？

**结论：四层全无。UI、API、chief 工具词表、docs/MCP 能力面都没有任何 parent/epic/goal 对象。**

| 层 | 证据 | 分级 |
|---|---|---|
| API（todo doc 字段） | `GET /api/teams/{id}/progress`（2026-10-02 活体重放）todo doc 字段集 = `assignment, createdAt, createdBy, hasChanges, hasPlan, id, lastRunAt, latestBuildId, orderIndex, ownerId, phase, phaseAt, prevPhase, projectId, seqNum, sourceBuildId, spec, tagIds, title, updatedAt` + 新增 `v`（版本计数）——**无 parent/parentId/goalId/epicId 任何形态**。同字段集在 r5 时代抓包（19 键）完全一致，`assets/r5/raw/sse-capture-*.txt` 重解析 5 张 todo doc 交叉验证 | [实测]（r5 抓包部分为归档转引） |
| Chief 工具词表 | 活体 `GET /api/teams/{id}/chief/threads` → `toolDefHashes` 49 键（与 r5 时代同为 49 键，词表演进：`delete_skills` 已移除、另有增补）——组织侧只有 `create_todo/update_todo/delete_todos/close_todos/reopen_todos/complete_todos/message_todo` 等，**无 create_parent/goal/epic/subtask 类工具**（`assets/r5/raw/chief-threads-testA.json` 49 键同证） | [实测] |
| docs / MCP server 能力面 | docs MCP 写工具 13 件：`Create Todo / Update Todo / Message Todo / Run Builds / … / Unschedule Todo`，无 parent 概念；能力六组（Read workspace / Read repo / Read progress / **Organize work** / Run work / Manage lifecycle）里 Organize work 不含分组 | r3-protocol-executor.md:208,216 [归档转引] |
| UI（看板/详情/新建表单） | 看板 = 6 相位列平铺卡片（r2-app-ui-inventory.md:147-155）；卡片结构 = 项目芯片 + #序号 + 标题 + 头像/时间/主按钮（r2:162-165）；详情面板字段清单无来源/父引用（r2:205-215）；新建任务表单字段 = 项目/标题/描述/标签（r2:190-198）。营销站 21 条功能卡无 epic/goal/milestone 字样（r1-site-inventory.md:124-125），hero 语料里 "reach the goals you set" 是修辞不是对象（r1:102） | [归档转引] |

旁证：r1 营销 install 页对话 demo 里 Chief「拆 3 个并行 todo #151/#152/#153」——演示叙事也只产出平级 todo，无父对象（r1:138-139）。

---

## Q2 · Chief 把一个请求拆成多张 todo 时，看板渲染什么？

**结论：拆分产物 = N 张平级卡片直接落相位列；没有父行、分组、容器卡。唯一共同视觉 = 同一项目芯片。**

r5 会话从未诱发多 todo 拆分（r5-chief-behavior.md:60 标 [未覆盖]，同类三子事项被并成 1 张、标题 `+` 连接）。本会话补上缺口实验：

**[实测] 缺口实验（2026-10-02 17:36 本地，round 1 即拆分成功）**
- 输入（线程 `chief-01a0fbf9-30e8-79a2-9b08-714f97a373b2`，原话照录）：
  > r98 实验请求：帮我做两件互不依赖的事。第一件，在 r3-lifecycle 项目里新建 docs/r98-notes.md，写两三句话介绍这个仓库的用途；第二件，新建 scripts/r98-date.js，用 node 运行时打印当天日期。
- Chief 回合 46s，产出 **2 张 todo**（一文档一代码，跨类型交付物）：
  - `#23 新建 scripts/r98-date.js 打印当天日期` → 派 r3-builder（代码职责），build 落 review
  - `#24 新建 docs/r98-notes.md 介绍仓库用途` → 派 r5-scribe（文档职责），build failed（环境性失败）
- 看板渲染（截图 `/tmp/xmon98-laneA-shots/15-board-after-split.png`）：**执行中列 2 张平铺卡**，随各自相位漂移（#23 → review「待处理」列，#24 → failed），**互不绑定、无任何父容器/分组/折叠头**；每卡只带各自的项目芯片 `r3-lifecycle`。
- 回执消息（线程内，原话）：「已创建并启动两个互不依赖的任务：• [#24]「新建 docs/r98-notes.md 介绍仓库用途」— 交给文档类 agent [r5-scribe] • [#23]「新建 scripts/r98-date.js 打印当天日期」— 交给代码实现类 agent [r3-builder] 两者并行执行，完成或需要确认时我会再汇报。」（截图 `13/14-*.png`）
- 对照：r5 时代「三件同类小事」→ **1 张** todo（标题 `+` 连接，r5:55-56,60）。**拆不拆是 Chief 按请求结构自裁**：同类小事项合并、跨类型可独立验收的交付物拆开。

---

## Q3 · Chief 建的 todo 怎么携带溯源？卡片/详情有没有可见「来源」？

**结论：溯源 = 三个机器字段 + spec 内嵌原文引语 + 看板卡上一枚「由总管创建」芯片；详情页无任何来源呈现。无 parent 字段。**

**数据层 [实测]**（实验卡 #23/#24 与 r5 遗留 #12 的 JSON，`GET /api/teams/{id}/progress`）：
- `createdBy` = Chief 绑定 Agent id（`TVv0DxUu3jTIhYpeWh6mn`，r3-builder）；人手建卡该字段 = 用户 id（#13/#14 对照）。r5:49 同证。
- `ownerId` = 用户 id（所有卡一致）。
- `sourceBuildId` = **chief 记录 id**（`chief-<userId>-<teamId>`）——注意它**不是线程 id**：#12（线程 A）与 #23/#24（线程 r98）带同一个 `sourceBuildId`。即该字段只表达「由 chief 产生」，**不携带「来自哪次会话」的链接**；todo↔thread 的关联只存在于①会话消息里的 `[#N](todo:<id>)` 实体引用、②watch 记录的 `threadId/threadTitle`（watches[].threadId，r5:66 同形态）。
- **spec 结构**（两张实验卡原文）：
  - `#23 spec`：`> r98 实验请求：新建 scripts/r98-date.js，用 node 运行时打印当天日期。\n\n要求：\n- 新建文件 scripts/r98-date.js\n- 使用 Node.js 运行时，运行后打印当天日期\n- 与 docs/r98-notes.md 任务互不依赖，无需等待对方完成`
  - `#24 spec`：`> r98 实验请求：在 r3-lifecycle 项目里新建 docs/r98-notes.md，写两三句话介绍这个仓库的用途。\n\n要求：…- 纯文档任务，不涉及代码修改`
  - 即：**归一化改写后的「本子任务相关片段」blockquote**（非逐字全文；「第一件/第二件」被剥掉、冠以请求主题）+ 要求 bullet + **兄弟任务的文字交叉引用**（无数据字段）。逐字原话只保存在 chief 会话的 user 消息里。r5:48（#11 spec 三段式）同构。

**UI 层 [实测]**：
- **看板卡片**：chief 建的卡在底行时间旁带一枚芯片 **「由总管创建」**（带图标）。活体 DOM/snapshot：#12、#23、#24 三张 chief 卡均有；人手建的 #13/#22/#1 无。视觉证据：`/tmp/xmon98-laneA-shots/10-cdp-board.png`、`11-todo12-card-zoom.png`（#12 卡特写，芯片清晰可见）、`15-board-after-split.png`。
- **详情页**（`/app/todo/<id>`，#12 实测全文本）：header（#N + 状态芯片 + 主按钮）→ 标题 → 负责人/规划/执行三行 → spec 正文（含 #11 的实体提及芯片）→ 「2026年9月22日 17:37 创建」——**全文无「由总管创建」、无来源区块、无 chief/会话引用**。截图 `03-todo12-detail.png`。
- 即：可见溯源只有看板卡级一枚芯片；`sourceBuildId` 不对 UI 透出。

---

## Q4 · 用户从哪里观察「整个请求」？

**结论：唯一容器 = chief 会话（thread）面板。入口两处：侧栏「工作台」项（带未读徽标）与看板头「展开总管聊天」按钮；面板内主题芯片切换器列全部线程。**

[实测]（截图 `12-chief-chat-expanded.png`，2026-10-02 活体）+ [归档转引]（r5:75-78、r8-chief-panel-adhoc.md）：
- 面板结构：主题芯片（线程切换器）+ 模型位（`r3-builder · claude-sonnet-5`）+ 新主题/总管设置/全屏/更多 + 消息流 + 输入框。消息流里 user 消息 = 请求原话（唯一逐字存档处）；assistant 消息用 `[#N](todo:<id>)`、`[agent](agent:<id>)` 实体芯片引用子卡与执行者（可点击跳转，r5:77）。
- 生命周期回访：gate/settle/failed 的 wake 汇报全部回到该线程（r5:67-69：review 停关 → 1s 内 chief 领 wake step 在线程内汇报；合并完成 → 汇报「已合并完成」；失败 → 法证式汇报）。实验中 #23 落 review 后线程内即刻出现新一轮「处理中…」wake（#24 failed 的 watch 已自动解除，与 r5:70「settle/failed 后自动解除」一致）。
- 无任何其他「请求级」视图：看板不聚合（Q2）、项目页任务 tab 为平列表（r2:104）、搜索/命令面板无请求分组（r2:360）。

---

## 缺口实验完整记录（唯一写操作）

| 项 | 值 |
|---|---|
| 轮次 | 1/3（首措辞即拆分，未用满） |
| 请求 | 见 Q2 原话（跨类型双交付物、自然措辞、不指示拆分） |
| 结果 | 2 张 todo（#23/#24），各自 title/spec/assignment；见 Q2/Q3 JSON |
| 看板 | 两卡平铺、随相位分列、无父容器 |
| watch | 派工即自动挂 #23（reason=`Dispatched by the chief: report back when it parks at a gate or settles.`，带 threadId/threadTitle）；#24 failed 后其 watch 自动解除（活体 watches 数：建后 1 → 只剩 #23 → 清理后 0） |
| 线程 | 回执消息 + run_builds 工具调用流式展示（`调用工具: run_builds`） |
| 环境插曲 | ①7890 代理对 todos.dev 瞬态断流，重试后恢复；②daemon 全局代理 fetch 把 r3-gw（Tailscale 100.65.44.76）也送进代理 → `Connection error` 连锁重试 6/7；修法 = `tds stop` 后带 `NO_PROXY=…,100.65.44.76` 重启，`recover] re-queued 1 step(s)` 续跑同会话成功；③mcp r3mcp 连接失败为非致命降级（r5:43 同现象） |
| 清理 | `DELETE /api/todos/zm_u8YfCq8prOEfgag3qy`、`DELETE /api/todos/i6vExz8kvz5Ug-bCkl5gI` → 各 204；回读 progress：todos 回到实验前 4 张（#12/#1/#13/#22），watches=0，builds 无新增存活；daemon 已 `tds stop`（恢复实验前「not running」态）。r98 线程记录保留在 chief threads 列表（与 r5 两条旧测试线程同等待遇，标题自带 r98 标记，且它本身即研究对象） |

证据文件：`/tmp/xmon98-laneA-shots/`——`03-todo12-detail.png`（详情页无来源）、`06-board-with-chief-created-chip.png`、`10-cdp-board.png`、`11-todo12-card-zoom.png`（「由总管创建」芯片特写）、`12-chief-chat-expanded.png`（线程面板全貌）、`13-chief-gap-exp-round1.png`、`14-chief-round1-receipt.png`（回执）、`15-board-after-split.png`（拆分后看板）。注：`01/02/04-09` 为过程中的黑屏废片（ego-lite `page.screenshot` 在该窗口态捕黑，CDP `Page.captureScreenshot` 正常——产物中有效图均走 CDP）。

---

## 对 pacman 拍板点 1 的对照含义（只陈述参考站事实，不做决定）

1. 参考站的「父记录」形态 = **chief thread + todo 机器字段**，无卡片化父对象：与 r12 评论 3 反提案（容器=会话、子卡带来源字段）同构；但注意 todos.dev 的 `sourceBuildId` 是 **chief 记录级**（不分线程），「子卡→具体哪次会话」的链接靠会话内实体引用 + watch 传递，不是持久字段。
2. 「原文锚点」在参考站 = 会话 user 消息逐字保存 + 每张子卡 spec 内嵌归一化片段引语（非逐字）；兄弟关系靠 spec 文字交叉引用。
3. 可见溯源在参考站 = 看板卡一枚「由总管创建」芯片（r5 时代无此芯片——2026-10-02 活体新观测，属 UI 演进新增；r5 §8 看板映射未记）。
4. 拆分阈值 = Chief 自裁（同类合并成 1 卡 vs 跨类型拆 2 卡），无用户确认闸（r5:61 派工即 `withPlan:false` 直接执行）。

## 四问速答

1. **父概念？** 四层（UI/API/工具词表/docs-MCP）全无 parent/epic/goal；todo doc 20 字段（19+v）无 parent 形态。
2. **拆分时看板渲染？** N 张平级卡落相位列、随相位各漂各列，无父行/分组/容器卡；唯一共同视觉是同项目芯片。
3. **溯源？** 机器字段 `createdBy`=chief agent id、`sourceBuildId`=chief 记录 id（非线程 id）、spec 内嵌归一化原文片段 + 兄弟文字交叉引用；可见呈现仅看板卡「由总管创建」芯片，详情页零来源。
4. **整请求容器？** chief 会话面板（侧栏「工作台」/看板头「展开总管聊天」入口）：user 消息存逐字原话，回执用 todo 实体芯片列全部子卡，gate/settle/failed wake 全回该线程。
