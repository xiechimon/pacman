# Agent 状态行「创建于」验证（XMON-18 / B4 裁决 A）

Agent 详情概览的状态行从只出 `active` 改成原版形态 `active · 创建于 YYYY/M/D`，
用户可见行为变了——`agent.createdAt` 列 + `POST /agents` 写路径 +
`agentRecordSchema` 投影三件一起落，故按 `verify-pacman` 的 live 探针走真用户
路径取证。

一手来源：`docs/research/assets/r5/raw/chief-record-testA.json` 的
`agentActor.createdAt = 1789786840183`（= 2026/9/19），与
`docs/research/assets/r3/53-agent-overview.png` 的 `active · 创建于 2026/9/19`
逐字吻合——原版 wire 有这一位，本仓缺列，补列而非发明。

## 命令

```sh
VERIFY_REPO_ROOT=<worktree> node <worktree>/.claude/skills/verify-pacman/scripts/launch.mjs
VERIFY_REPO_ROOT=<worktree> node <worktree>/.claude/skills/verify-pacman/scripts/drive-agent-detail.mjs
```

隔离栈：api `127.0.0.1:8791` + web `127.0.0.1:5273` + scratch `PACMAN_HOME`。

## 结果

`drive agent-detail: PASS`，30 项 check 全绿（完整清单见
`agent-detail-result.json`）。与本次改动直接相关的两条：

| check | 实测输出 |
|---|---|
| `server-created-at-set` | `1790794949297`（POST 建出的 Agent，`GET agents/{aid}` 回的是毫秒数，非 null、非 0 占位） |
| `overview-status-line` | `active · 创建于 2026/10/1`（UI 逐字 = 按上面那个真值渲染出的行） |

两条缺一不可：只验 server = 没证明接上了 UI，只验 UI = 没证明日期不是前端编的。
全量 check 与既有面（名称/职责/模型/思考强度/权限/密钥/记忆/创建弹窗）同批绿，
无回归。

**null 分支不在本 probe 覆盖内**：live 栈是全新 scratch 库，没有「加列之前建的
行」。旧行语义（`createdAt` 为 null 时状态行只出 `active`，不填 1970 占位、不造
「未知」文案）由 `apps/server/test/agent-created-at.test.ts` 的 ② 与 ④ 两条锁——
④ 会真的造一个「旧库 + 已有 agent 行」，再用完整 `drizzle/` 续跑 migration。

## 截图

- `agent-detail-overview.png` — 概览整屏；状态行在模型/思考强度之下，出
  `active · 创建于 2026/10/1`。

源证据目录（本地态，gitignored）：
`.claude/verify-evidence/2026-09-30T19-02-29-256Z-agent-detail`。