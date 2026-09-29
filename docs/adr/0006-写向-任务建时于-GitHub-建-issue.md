# ADR 0006 · 写向：任务建时于 GitHub 建 issue（server 出站，失败不阻断）

> 状态：**已裁决**（2026-09-30）。
> 来源：#452 的 grill（2026-09-30），原始诉求出自 #446 的「自己派的任务应该也是要提 issue 的」。
> 关系：**补全 ADR 0005**（不修改它）。ADR 0005 D7 把写向划为后票，本 ADR 就是那一票的决策记录；它同时回答了 ADR 0005「重开触发」里留的那个追问——写向落地后真值归谁。

## Problem Statement

ADR 0005 立了分叉律：`githubRepo` 项目的标签与标题真值都在 issue 上。但对「自己派的任务」这句话是空的——它们根本没有 issue。于是同一个看板上会并存两种标题来路：领来的用 issue 标题，自派的走占位 → agent 回填两段式。这正是 ADR 0005 想消灭的那种分叉，只是换了个位置。

本裁决补上另一半：**自派任务也在 GitHub 建 issue**；执行 agent 回填标题时，写进那枚 issue。

## 侦察事实（2026-09-30 实测，逐条出处）

| # | 事实 | 出处 |
|---|---|---|
| F1 | 全仓**没有任何往 `api.github.com` 写的代码**：`lib/github.ts` 只有 `/user` 与 `/user/repos` 两个 GET，唯一的 POST 是 OAuth token 交换 → 本裁决让 server 第一次写外部系统 | `apps/server/src/lib/github.ts`、`apps/server/src/services/oauth.ts` |
| F2 | 任务创建只有一个收口 `createTodo`：web 路由、chief 的 `create_todo` 工具、MCP face 三条路都过它；它已在对 `tagIds` 做「限本项目标签集」的校验 | `apps/server/src/services/todos.ts`、`apps/server/src/services/chief-tools.ts`、`apps/server/src/services/mcp-face.ts` |
| F3 | daemon 侧只有 git 远端用的 per-step `x-access-token`（拼进 clone/push URL），**没有证据表明它把凭证交给 agent 的 shell** → 「让执行 agent 自己建 issue」要新铺凭证管道 | `apps/daemon/src/runner.ts` |
| F4 | 执行面今天连 PR 都不建（`build.prUrl` / `prNumber` 恒 null）——写 GitHub 的第一个动作就是本裁决的建 issue | `apps/server/src/db/schema.ts`、`apps/server/src/services/builds.ts` |
| F5 | 占位标题的派生已是 shared 单源（正文首行 ≤50 字符截断） | `packages/shared/src/task-meta.ts` |

## Decision

| ID | 裁决 |
|---|---|
| **D1** | 建 issue 由 **server 在 `createTodo` 收口处出站做**——任务落库成功后立刻建。三条创建路径一次覆盖，不在 web/chief/MCP 各写一遍。 |
| **D2** | **失败不阻断**：建不成（未连接 / 权限不足 / 网络）时任务照建，来源标「未建成」并留重试入口。GitHub 的可用性不得成为建任务的前置条件。建 issue 必须落在建任务请求的关键路径之外，不得让建任务的延迟取决于 GitHub。 |
| **D3** | issue 的初始标题 = 正文首行截断的**占位标题**（F5 单源）；执行 agent 回填时把正式标题写进那枚 issue。 |
| **D4** | **导入护栏在 pacman 侧**：一条 issue 至多一个任务，导入列表按已落库的来源反查去重——一条规则同时盖住「自建的 issue 被导入」与「同一条 issue 被导入两次」。不在 GitHub 侧打标记 label。 |
| **D5** | **半耦合按「只提示不覆盖」处理**：任务详情页显示来源 issue 的当前标题与状态（进入时拉一次），不一致时给一行中性提示，**不自动覆盖**。→ 这回答了 ADR 0005 的追问：写向落地后真值关系不是「谁覆盖谁」，而是 **issue 侧仍为真值，pacman 侧只显示差异**。 |
| **D6** | **回读失败的降级**：拉不到（未连接 / token 失效 / 限流 / issue 被删）就隐藏那一行——不显示陈旧值、不弹错。回显是补充信息，不该把详情页变成错误现场。 |

## Premortem（假设已失败，三种最可能死因 + 护栏）

| 死因 | 护栏 |
|---|---|
| **server 卡在建 issue 上**：`createTodo` 是同步路径、底层是同步 sqlite 驱动，一个挂住的出站 HTTP 就能拖垮建任务 | D2 的「不阻断」是硬约束而非偏好：建 issue 落在请求关键路径之外（落库后触发 + 失败可重试）。施工时把「没连 GitHub 的项目建任务耗时不变」写成验收条件。 |
| **仓库 issue 列表被任务流水灌满**：每个自派任务一条 issue，那份列表不再是「精选待办」 | 这是本裁决的**核心动机**（GitHub 侧能看到全部工作），不是副作用，不设护栏去压。D4 保证 pacman 侧不会把自家 issue 再吃回来。将来若嫌吵，处置方向是在 GitHub 侧按 label 过滤视图，不是少建。 |
| **凭证面扩大**：server 从「只读 GitHub」变成「可写 GitHub」，多租户化时这一步最容易被忽略 | 沿用租户级单行连接的 `openGithubToken` 作唯一出站边界，不新增凭证存储面；写操作**只有两种**（建 issue、写标题），写进本 ADR 以备将来审计与收窄。 |

## Consequences

- **正向**：分叉律闭合——github 项目的任务无论来路，在 GitHub 侧都有落点；人在 GitHub 上能看到全部工作，不必回 pacman 才知道有什么在跑。
- **负向**：server 首次获得写外部系统的能力，信任面变大；仓库 issue 列表被任务灌满；两个真值源进入「issue 为准、pacman 只提示」的不对称关系——这条不对称靠 D5 的回显才不至于悄悄漂，所以 D5 不是可选的锦上添花。
- **与 ADR 0005 的关系**：补全。0005 的 D1–D6 一字不改；本裁决把它的 D7 从「后票」落实成形态，并回答了它留的追问。
- **重开触发**：出现第二种外部来源（PR / CI 失败 / 外部工单）时重审出站边界与来源族的形状；pacman 需要改为**自动覆盖** issue 时重审 D5；多租户部署时重审凭证面与 D2 的降级语义。