# todos.dev 复刻 · 领域模型与术语表

本仓库是 todos.dev（"task-driven workspace for humans and agents"）的 1:1 复刻（像素级 UI + 功能等价）。本文件是复刻的 canonical 词汇表：为每个领域概念固定「中文界面词 ↔ 英文原词 ↔ 复刻代码内部名」三列映射，并裁决概念之间的边界。实现契约（完整 phase 枚举、REST/SSE 端点、record 形状）不在此表，归 `docs/spec/` 架构册（地图票 #41）。

内部名取自 todos.dev 实测 API 词表（R3 协议盘点）；仅在词被重载处改名并标注（见「密钥」）。

## 租户层级

| 中文界面词 | 英文原词 | 内部名 | 定义 / 边界 |
|---|---|---|---|
| 团队 | Team | `team` | 顶层租户边界，项目、Agent、机器、资源与套餐（plan）都归属其下。 |
| 项目 | Project | `project` | 团队下聚合任务、仓库与文件的单位。 |
| 仓库 | Repo | `repo` | 项目绑定的代码仓库（Todos 托管或 GitHub 接入）。是 Project 的属性，不是独立租户层。 |

_Avoid_：**Workspace** —— 它不是领域实体，仅指执行机本地的任务检出目录（`~/.tds/workspaces/<conversationId>`）；禁止用它指代团队或任何界面层级。

## 任务生命周期

| 中文界面词 | 英文原词 | 内部名 | 定义 / 边界 |
|---|---|---|---|
| 任务 | Todo | `todo` | 用户要办的一件事，持久且带序号（`#seqNum`）；看板上的卡片即一个 todo。 |
| 阶段 | Phase | `phase` | todo 的当前状态。看板的列只是 phase 的一种视图，非独立实体。 |
| 运行 | Build | `build` | todo 的一次执行：一次运行 = 一个 build = 一个 conversation = 一个 worktree+分支。其 id 与 `conversationId` 同值。 |
| 对话 | Conversation | `conversation` | build 产生的消息流的别名视图，与其同 UUID；不作为独立实体。 |
| 方案 | Plan | `plan` | build 内类型化的规划产物卡（Context / Changes / Edge cases / Verification）；不是独立实体。 |
| 标签 | Tag | `tag` | todo 的多对多标签。 |

边界裁决：
- **无 Goal 概念** —— 工作单元只有一个，即 `todo`；「Goal」不引入。
- **`待验收` 与 `审核` 是同一 phase 的两个界面词**，正名取列名 `待验收`；`完成`（`done`）是动作/按钮，不是阶段名。
- Build 与 Conversation 是一个实体的两面（执行 vs 消息流），不拆成两套 id。

## 执行体

| 中文界面词 | 英文原词 | 内部名 | 定义 / 边界 |
|---|---|---|---|
| 机器 | Machine | `machine` | 登记的执行主机（`tds` daemon + 内嵌 pi runtime），领取并运行 build 步。一个机器可承载多个 Agent 的步；它不是 Agent 的属性。 |
| Agent | Agent | `agent` | 配了模型、职责、技能、工具、密钥、MCP 与记忆的执行角色；运行在某台机器上。 |
| 总管 | Chief | `chief` | 每「用户×团队」一个的调度与对话代理，负责分派任务；领域上区别于干活的 worker Agent。 |
| 记忆 | Memory | `memory` | Agent 在工作中沉淀的经验条目。todos.dev 写入路径未实测 [黑盒]；复刻采最小机制（02-架构平价 §4.4，全标 [推断]，待 #46 校准）。 |

边界裁决：Agent ≠ Machine（一个是配置好的角色，一个是承载它的物理主机）。Chief 是单独概念，不作为普通 Agent 的子类型混称。

## 资源与配置

| 中文界面词 | 英文原词 | 内部名 | 定义 / 边界 |
|---|---|---|---|
| 技能 | Skill | `skill` | 含 `SKILL.md` 的可复用流程文件夹，传授给 Agent；Agent 可默认携带或被授予。 |
| 模型服务 | Provider | `provider` | 配了凭证的模型来源（api_key / oauth / 自定义端点三协议）。 |
| 模型 | Model | `model` | Provider 下的一个具名可选项。[排除项：内置 built-in 模型走 Pro，不在复刻范围。] |
| MCP 服务器 | MCP server | `mcpServer` | 团队接入、为 Agent 提供额外工具的外部 MCP 服务器（方向：外部 → Agent）；工具名 `mcp__<标识符>__<工具>`。 |
| 团队密钥 | Secret | `secret` | 以环境变量注入任务 shell 的键值，只写不读。 |
| API 密钥 | API key | `apiKey` | `tds_…` 形态的凭证，用于注册机器与作为 MCP Bearer，带读/写工具白名单。 |

边界裁决：
- **「密钥」是重载词，强制拆两义** —— `secret`（团队环境变量）≠ `apiKey`（访问令牌）。代码里两词严格分开。
- **MCP 只有一个方向是实体** —— `mcpServer` 指团队接入外部工具（外部 → Agent）。todos.dev 自身被外部 MCP 客户端连接，是 `apiKey` 的一项能力，不单立 `McpClient`/`McpGateway` 概念。
- Provider ≠ Model（一个是配凭证的来源，一个是其下的可选项）。

## 记录与观测

| 中文界面词 | 英文原词 | 内部名 | 定义 / 边界 |
|---|---|---|---|
| 定时 | Schedule | `schedule` | 按周期或单次自动重跑某 todo，每轮触发一个新 build，到确认/审核关口暂停。 |
| 通知 | Notification | `notification` | 桌面浏览器推送 + 站内未读的统称；一个概念、多种投递渠道。 |
| 记录流 | Transcript | `transcript` | build 的有序消息与工具调用记录；是 build 的一面（facet），非独立可操作实体。 |
| Token 用量 | Token usage | `tokenUsage` | 按「build × model × 输入/输出/缓存读/缓存写」统计的记账读数；值对象，无自身生命周期。 |
