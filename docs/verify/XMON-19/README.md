# 删除 Agent：观测原版 → 补 DELETE 端点 + DeleteConfirm + 定 canon（票 XMON-19 / B2）

> 目录名用 issue identifier（本票来自 Multica 票池，无 GitHub 编号可挂），不进 `docs/verify/<GitHub 票号>/` 序列。

## 观测（2026-10-01，登录态原版实测）

在用户自己的 todos.dev 账号（team `BoZYfvqKSGanlxsXVbXSa`）上把删除流走了一遍：入口 → 确认层 → 取消 → 删除 → 落点。**全部为实测，不是转述。**

| 观测点 | 实测结果 |
|---|---|
| 入口 | Agent 详情页概览页脚 `删除 Agent`（在 `进行中` 一栏之下） |
| 确认层标题 | `删除 Agent？` |
| 确认层正文 | `将「{name}」移出团队？该 Agent 进行中的任务将被停止。`（`{name}` = Agent 名） |
| 确认层按钮 | `取消` / `删除` 两枚 |
| 取消行为 | 层关闭，**留在详情页**，Agent 未删（团队名单前后同为 3 个 Agent） |
| **确认后落点** | 地址先停在详情页，随请求落地切到 **`/app/team`**（团队页）；**无 toast / 无横幅** |
| 详情页其它事实 | 状态行 `active · 创建于 2026/9/19`；`进行中` 空态 `暂无进行中的任务`；概览字段 = 职责 / 默认 skill / 运行时 `内置 (pi)` / 模型 / 思考强度 |

确认层 DOM 事实：容器 `role="dialog"`，四个可点元素（两个无名 + `取消` + `删除`）——与产线 bundle 里通用 `ConfirmProvider` 的结构一致。

**观测用的是一次性 Agent**（`xmon19-tmp-delete-me`，经应用自身 `POST /api/teams/{id}/agents` 建成，id `m7lTuOkgjGnG5cUB3Ma0M`），删完即止，用户原有三个 Agent（`r3-builder` / `r5-scribe` / `ces`）未动。收尾核对过无残留同名单。

## 第二源：产线 bundle 静态提取（与实测逐字一致）

参考产品的 i18n 语料是公开静态资源，四个语料区（en / zh-CN / zh-TW / ja）里 `agent_modal` 命名空间原文：

| i18n key | zh-CN（canon） | en-US |
|---|---|---|
| `remove`（入口钮） | `删除 Agent` | `Delete agent` |
| `remove_title`（标题） | `删除 Agent？` | `Delete agent?` |
| `remove_confirm`（正文） | `将「{name}」移出团队？该 Agent 进行中的任务将被停止。` | `Remove "{name}" from this team? Active tasks for this agent will be stopped.` |
| `remove_over_quota`（超额提示） | `移除后团队仍有 {count} 个 Agent，已达到计划上限 {limit} 个，之后将无法添加新的 Agent。` | 同义 |

同批取到的任务侧连带提示（run 停止原因命名空间）：`agent_removed` = `该任务的 Agent 已被移除`、`agent_removed_hint` = `请为该 todo 指派其他 Agent 后重新运行。`

两源对标题、正文、入口钮**逐字相同**——实测是主源，bundle 是佐证。

## 第三源：官方 docs

`/docs/agents`「Removing an agent」：`A removed agent stops taking on work. Its memory is kept but no longer used, since it is no longer running todos.`
`/docs/memory`：`A removed agent's entries stay stored but stop being used, since it no longer runs tasks.`
`/docs/team`：`Removing an agent is done from the same tab.`
changelog：`Delete safeguard warnings: Deleting an agent or machine now warns when removal leaves no room to add one back`（对应 `remove_over_quota`）。

## 关联面取舍（三件）

| 面 | 处置 | 依据 |
|---|---|---|
| `agent_memory` | **不级联**，本体行留存 | docs 明写「memory is kept but no longer used」；仓内 project 删除保记忆本体先例。代价：记忆行 agentId 悬空（列 notNull，无「已删 Agent」键位可迁），成为不可达知识——破坏性操作里选可回滚一侧 |
| `todo.assignment` | **摘槽**（指向该 Agent 的 plan/build 槽置 null） | 摘的是活引用：悬空槽会让 `resolveStepCredentials` 走 agentRow=null 分支静默给出空 provider/secrets，用户查不出原因；摘空回既有「未指派」态，与原版提示「请为该 todo 指派其他 Agent 后重新运行」同向 |
| `chief.agentId` | **摘绑定**（置 null） | chief 步凭证解析按该列取行，取不到直接 404——悬空绑定 = 该团队所有 chief 回合硬 404；该列本就可空 |

完整论证在 `apps/server/src/services/agents.ts` 文件头。

**明确不做（记账，非漏项）**：确认层正文许诺的「该 Agent 进行中的任务将被停止」在本仓无对应实现——本仓停止面是 `POST /api/builds/{id}/stop`（按 buildId 逐条停），DELETE 端点上没有 buildId 上下文。`remove_over_quota` 不渲染：本仓无套餐 / Agent 上限模型，无锚可挂。

## 证据清单

### 登录态实测（本目录 `2026-10-01-live-observation/`）

| 文件 | 内容 |
|---|---|
| `01-agent-detail.png` | Agent 详情页概览：字段全貌 + 页脚 `删除 Agent` 入口 |
| `02-delete-confirm.png` | 真实 Agent 上打开的确认层（标题 / 正文 / 取消 / 删除） |
| `03-tmp-agent-confirm.png` | 一次性 Agent 上的确认层（正文里的 `{name}` 已代入） |
| `04-after-delete-team.png` | 确认后落到的团队页：一次性 Agent 消失，原三个 Agent 原样 |

### verify-pacman live 栈（本仓实现，`2026-09-30T18-31-58-195Z-agent-detail/`）

栈 = 隔离 live 栈（api 8791 / vite 5273 / `PACMAN_HOME` scratch 全新库），脚本 `drive-agent-detail.mjs`（本票在其尾部补了第 9 步删除流程），**34 checks 全 PASS**，其中删除面 9 条真值全部取自 server（不是 UI 回显）：

`delete-confirm-canon-title`、`delete-confirm-canon-body`、`delete-cancel-keeps-row`（取消后 `GET agent` 仍 200）、`delete-lands-on-team`、`delete-row-gone-404`、`delete-repeat-404`、`delete-roster-drops-target`、`delete-roster-keeps-neighbor`、`delete-roster-count-matches-server`。

## 三闸

| 闸 | 命令 | 实际输出 |
|---|---|---|
| typecheck | `pnpm typecheck` | shared / web / daemon / server / integration 五包全 `Done` |
| lint | `npx biome ci . --reporter=github` | **0 error**（仓库存量 4 warnings + 25 infos 不在本票文件内） |
| server 测试 | `cd apps/server && npx vitest run` | **484 passed / 44 files**（含本票新增 `test/agent-delete.test.ts` 7 例） |
| shared 测试 | `cd packages/shared && npx vitest run test/snapshot.test.ts` | **79 passed**（DELETE_FACE 快照随改） |
| web e2e（本票新面） | `cd apps/web && E2E_PORT=8401 npx playwright test e2e/agent-delete.spec.ts` | **5 passed** |
| web e2e（邻面回归） | 同上，`agent-detail` + `team-org-chart` + `escape-wiring` + `dead-buttons` | **67 passed / 1 failed** |

**唯一红灯不在本票**：`e2e/agent-detail.spec.ts:227` 断言的是团队密钥副文案的旧句，而 `packages/shared/src/records/agent.ts` 现行文案已被 #510 改成按需取用句。本票 diff 不含这两个文件，红项无因果；同一红灯在 `docs/verify/xmon-13/README.md` 已记录为存量。

## 未覆盖

- **「进行中的任务将被停止」**：原版确认层明文许诺，本仓无对应实现（见上文「明确不做」）。原版任务侧的可见性——`该任务的 Agent 已被移除` 提示——本仓也尚无承载位。
- **`remove_over_quota` 超额提示**：本仓无套餐 / Agent 上限模型，无锚可挂，不渲染。
- **原版的失败/竞态分支**（删除请求 4xx/5xx 时层的行为、并发删除）：本轮只观测了成功路径。