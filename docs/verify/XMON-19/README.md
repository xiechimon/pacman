# 删除 Agent：观测原版 → 补 DELETE 端点 + DeleteConfirm + 定 canon（票 XMON-19 / B2）

> 目录名用 issue identifier（本票来自 Multica 票池，无 GitHub 编号可挂），不进 `docs/verify/<GitHub 票号>/` 序列。

## 观测结果（canon 出处）

参考产品的登录态在另一台机器的 ego-browser 上，本机（Linux）拿不到，故**没有走登录后的 UI 观测**。改用两条一手通道取原文与语义，都是产线产物本身，不是转述：

1. **产线 bundle 静态提取**（todos.dev 公开静态资源 + app 自身的 i18n 语料）。四个语料区（en / zh-CN / zh-TW / ja）里 `agent_modal` 命名空间原文逐字：

| i18n key | zh-CN（canon） | en-US |
|---|---|---|
| `remove`（概览入口钮） | `删除 Agent` | `Delete agent` |
| `remove_title`（确认层标题） | `删除 Agent？` | `Delete agent?` |
| `remove_confirm`（确认层正文） | `将「{name}」移出团队？该 Agent 进行中的任务将被停止。` | `Remove "{name}" from this team? Active tasks for this agent will be stopped.` |
| `remove_over_quota`（超额提示） | `移除后团队仍有 {count} 个 Agent，已达到计划上限 {limit} 个，之后将无法添加新的 Agent。` | `The team already has {count} agents after removal, reaching the plan limit of {limit}.…` |

  同批取到的还有**任务侧的连带提示**（run 停止原因命名空间）：`agent_removed` = `该任务的 Agent 已被移除`、`agent_removed_hint` = `请为该 todo 指派其他 Agent 后重新运行。`

2. **通用确认层行为**（app 产线 chunk 的 `ConfirmProvider` 源码）：取消钮 / X / Esc / backdrop 四路径关闭且 resolve(false)；确认执行期间两钮禁用、Esc 与 backdrop 被挡；onConfirm 抛错则层不关、loading 复位。

3. **官方 docs**（todos.dev `/docs/agents`、`/docs/memory`、`/docs/team`）：`A removed agent stops taking on work. Its memory is kept but no longer used, since it is no longer running todos.` / `Removing an agent is done from the same tab.` / 更新日志 `Delete safeguard warnings: Deleting an agent or machine now warns when removal leaves no room to add one back`。

**未观测（如实记账，不推测）**：确认之后的落点路由（要登录态）；确认层两钮是否被调用点覆盖文案；`variant` 档。本仓落点取团队页（详情页 `backHref` 同向），代码里标 `[推断]`。

## 关联面取舍（三件）

| 面 | 处置 | 依据 |
|---|---|---|
| `agent_memory` | **不级联**，本体行留存 | docs 明写「memory is kept but no longer used」；仓内 project 删除保记忆本体先例。代价：记忆行 agentId 悬空（列 notNull，无「已删 Agent」键位可迁），成为不可达知识——选保留不选清库 = 破坏性操作里选可回滚一侧 |
| `todo.assignment` | **摘槽**（指向该 Agent 的 plan/build 槽置 null） | 与上一条相反的一侧，理由不同：这里摘的是活引用。悬空槽会让 `resolveStepCredentials` 走 agentRow=null 分支静默给出空 provider/secrets，用户查不出原因；摘空回既有「未指派」态，与原版提示「请为该 todo 指派其他 Agent 后重新运行」同向 |
| `chief.agentId` | **摘绑定**（置 null） | chief 步凭证解析按 `chief.agentId` 取行，取不到直接 404——悬空绑定 = 该团队所有 chief 回合硬 404。该列本就可空（schema「未绑定 null」），置 null 落回产品既有「尚未选择 Agent」态 |

**明确不做**：原版确认层正文许诺的「该 Agent 进行中的任务将被停止」在本仓无对应实现——本仓停止面是 `POST /api/builds/{id}/stop`（按 buildId 逐条停），DELETE 端点上没有 buildId 上下文，逐 todo 反查在建 build 并停步属另一条面。`remove_over_quota` 同因不渲染：本仓没有套餐 / Agent 上限模型，无锚可挂。

## 证据清单

栈 = `verify-pacman` 隔离 live 栈（api 8791 / vite 5273 / `PACMAN_HOME` scratch 全新库），脚本 `drive-agent-detail.mjs`（本票在其尾部补了第 9 步删除流程），**34 checks 全 PASS**。

| 文件 | 内容 |
|---|---|
| `08-delete-confirm.png` | 概览页脚点开确认层：标题「删除 Agent？」+ 正文「将「verify-485-renamed」移出团队？该 Agent 进行中的任务将被停止。」+ 取消/删除两钮 |
| `09-team-after-delete.png` | 确认后落团队页：被删的卡消失，邻居卡留存 |
| `result.json` | 34 条 check 逐条 PASS/FAIL + 栈坐标；删除面 9 条见 `delete-*` 前缀 |

删除面 9 条 check 的真值一律取自 server（不是 UI 回显）：`GET /api/teams/{id}/agents/{aid}` → 404、复删 → 404、`GET members` 名单与页面卡数对账。

## 三闸

| 闸 | 命令 | 实际输出 |
|---|---|---|
| typecheck | `pnpm typecheck` | shared / web / daemon / server / integration 五包全 `Done` |
| lint | `npx biome ci . --reporter=github` | **0 error**（仓库存量 4 warnings + 25 infos 不在本票文件内） |
| server 测试 | `cd apps/server && npx vitest run` | **484 passed / 44 files**（含本票新增 `test/agent-delete.test.ts` 7 例） |
| shared 测试 | `cd packages/shared && npx vitest run test/snapshot.test.ts` | **79 passed**（DELETE_FACE 快照随改） |
| web e2e（本票新面） | `cd apps/web && E2E_PORT=8401 npx playwright test e2e/agent-delete.spec.ts` | **5 passed** |
| web e2e（邻面回归） | 同上，`agent-detail` + `team-org-chart` + `escape-wiring` + `dead-buttons` | **67 passed / 1 failed** |

**唯一红灯不在本票**：`e2e/agent-detail.spec.ts:227` 断言的是团队密钥副文案的旧句，而 `packages/shared/src/records/agent.ts` 现行文案已被 #510 改成按需取用句。`git status --short` 证本票 diff 不含这两个文件（改的是 `packages/shared/src/protocol/rest.ts` 与 snapshot，未触 `records/agent.ts`），红项与本票无因果。同一红灯在 `docs/verify/xmon-13/README.md` 已记录为存量。

## 未覆盖

- **登录态下的原版 UI 实测**：确认之后落到哪个路由、确认层两钮有无调用点覆盖，两条都取不到（缺参考产品的登录会话）。本仓落点按 `[推断]` 实现并已在代码注释与 issue 评论里标明。
- **「进行中的任务将被停止」**：见上文「明确不做」。
- **`remove_over_quota` 超额提示**：本仓无套餐模型，不渲染。