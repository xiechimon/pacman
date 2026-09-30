# Agent 详情编辑面

团队页的 Agent 卡是进 Agent 详情编辑面的入口。详情面三 tab：概览（头像、名称行内编辑、职责、默认 skill、模型、思考强度与状态只读行）、记忆（条目列表 + 删除）、权限（工具 6 开关 + 团队密钥 + MCP 逐个勾选）。创建 Agent 弹窗按服务商是否就绪走两态：候选非空 = 弹窗内直接选 provider/modelId（不跳页）；候选空 = 「尚未配置模型服务商」告警行 + 配置外链。

## Sub-features

- `card-link` — 团队页 `.team-agent-card` 是 `<a>`，点击落 `/app/resources/agents/<id>`，`?scenario=` 随行。
- `overview-fields` — 名称（行内编辑）、职责、默认 skill、模型选择器，各自提交后 server 记录随之变。
- `overview-readonly` — 思考强度与状态是只读值行（无按钮）：档位词表无 server/web 暴露面，`创建于` 无 createdAt 列，两者都不发明。
- `memory-tab` — 条目列表 + 删除；空态文案 = shared `MEMORY_EMPTY_COPY` canon。
- `permissions-tab` — 工具 6 开关（文案 = shared `AGENT_TOOL_SWITCHES`）、团队密钥勾选、MCP 逐个勾选，落 `PATCH tools/secrets/mcpServers`。
- `create-model-slot` — 创建弹窗模型槽两态；选中后 `POST /api/teams/{id}/agents` body 带 `provider` 与 `modelId`。

## How to get to it (user POV)

- 团队页（`/app/team`）→ 点任意 Agent 卡 → 详情页。
- 详情页 tab 行 → 概览 / 记忆 / 权限。
- 团队页 dashed「创建 Agent」→ 弹窗（有服务商时内含模型下拉）。
- 无 DP 入口：Agent 不在侧栏资源行里（原版命令面板「前往」清单也无 Agents 行），只能从团队页卡进入。

## Driving it with drive-agent-detail.mjs

Preconditions:

- `launch.mjs` 起隔离栈（默认 api 8791 / web 5273，全新 scratch 库）。脚本自播种：一个 custom provider（`verify-485-gw` + `claude-sonnet-5`）与一个 Agent（`verify-485-builder`）。
- 从 worktree 路径跑脚本本体，并带 `VERIFY_REPO_ROOT=<worktree 绝对路径>`（用主仓旧脚本验 lane 新代码会得到迷惑症状）。

- 团队页卡是链接并落详情路由 → `node <worktree>/.claude/skills/verify-pacman/scripts/drive-agent-detail.mjs` → `team-card-is-link`（卡元素是 `a`）+ `card-opens-detail-route`（pathname = `/app/resources/agents/<id>`）。
- 概览回显 = server 真值 → 同命令 → `overview-name` / `overview-role-empty-canon` / `overview-model` / `overview-thinking-readonly`。
- 改名称、改职责 → 同命令 → `name-persisted` / `role-persisted`（重取 `GET /api/teams/{id}/agents/{aid}` 对字段，不看 UI 回显）。
- 模型槽清空再选回 → 同命令 → `model-cleared`（provider/modelId 双 null）/ `model-persisted`（`verify-485-gw/claude-sonnet-5`）。
- 权限开关 → 同命令 → `perm-six-switches`（6 个）+ `tool-persisted`（server `tools` 数组）。
- 记忆空态 → 同命令 → `memory-empty-canon`。
- 创建弹窗选模型建 Agent → 同命令 → `create-dialog-model-slot` / `create-dialog-no-warn` / `create-with-model-persisted`（重取 members 投影对 provider/modelId）。

## Gotchas

- **fixture e2e 与 live probe 互不替代**：`apps/web/e2e/agent-detail.spec.ts` + `agent-create-model.spec.ts` 跑 fixture 面（无后端），证明的是交互与两态；落库只能由本 probe 证。本票之前 `patchAgent` 是零消费点的死代码，这条缝从没被 web 面走过。
- **模型行首行恒是「未设置模型」清空行**：按 `hasText` 定位模型行，别用 `nth(0)`。
- **同一模型 id 可能出两行**：`toChiefModelOptions` 是 custom providers ∪ model-sources 非 pi 段的并集，`claude-sonnet-5` 在 providers 与 claude-code 段各一行——断言要按 provider 位分。
- **浮层截图要等入场动画**：`anim-pop` 从 opacity 0 起，Playwright 的 visible 判定不看 opacity，抢拍会得到与上一张逐字节相同的假图。
- **PATCH 是 invalidateAll 重取（S8）**：点完给 ~400ms 落窗再读 server，或改读 server 而不依赖 UI 时序。