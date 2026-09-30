# Agent 创建时间验证（XMON-18 / B4 = A1a）

Agent 详情概览的状态行从 `active` 变成 `active · 创建于 2026/10/1`——用户可见行为
变了，故按 `verify-pacman` 的 live 探针走真用户路径取证。列本身（0018 migration 加的
可空 `agent.createdAt`）另由 server/web 单测覆盖，见下文「本次增的自动化」。

## 命令

```sh
node .claude/skills/verify-pacman/scripts/launch.mjs
node .claude/skills/verify-pacman/scripts/drive-agent-detail.mjs
```

隔离栈：api `127.0.0.1:8791` + web `127.0.0.1:5273` + scratch `PACMAN_HOME`。

## 结果

`drive agent-detail: PASS`，`allOk=true`，29 项 check 全绿（完整清单见
`agent-detail-result.json`）。与本次改动直接相关的一条：

| check | 实测输出 |
|---|---|
| `status-line-created-at` | 状态行 `active · 创建于 2026/10/1`；同一时刻 server `GET agents/{aid}` 的 `createdAt=1790796410551` |

这条是「列真的接到了界面上」的判据：只验端点返回值不算数（改前 web 拿到记录也不渲染
日期分句）。probe 播种 Agent 走的是 `POST /api/teams/{id}/agents`，所以它同时证明**新建
路径写真值**。截图见 `agent-detail-overview.png`。

## 本次增的自动化

live 探针证不到两个分支，由单测补（这两条也是「为什么落 A1a」的守卫）：

| 位置 | 钉住的失败方式 |
|---|---|
| `apps/server/test/agent-created-at.test.ts` | REST 与 chief 工具两条写路径都写真值；PATCH 不改 `createdAt`；members / chief 两处读面投影带该字段；**旧行读出 `null` 而不是 `0`**；**≤0017 旧库带行续跑 0018 必须成功**（NOT NULL 无默认值 = 旧安装启动即崩） |
| `apps/web/test/agent-status-line.test.ts` | 日期形逐字 `2026/9/19`（r3 §4 截图）；**未知（null）只出 `active`**，不摆占位日期；en 面不回落中文 |
| `apps/web/e2e/agent-detail.spec.ts` | fixture 面状态行逐字 = `active · 创建于 2026/9/19` |
| `packages/shared/test/records.test.ts` | `agentRecordSchema` 收 `createdAt`（可空），缺字段仍拒 |