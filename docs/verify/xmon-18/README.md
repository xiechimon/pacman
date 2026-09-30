# Agent 概览撤行验证（XMON-18）

Agent 详情概览撤掉两行只读展示——`思考强度`（档位交给 agent 编排，不给人手设）
与 `状态`（`agentStatusSchema` 只有 `active` 一个取值）。用户可见行为变了，故按
`verify-pacman` 的 live 探针走真用户路径取证。

同一张票的上一版（补 `createdAt` 列 + 状态行 `active · 创建于 …`）在 PR #541 上
实现完、验完，随后被同一轮裁决推翻——「创建于 2026/10/1 也不要，不需要创建时间」。
那个 PR 已关闭、未合并，`main` 上不会有 `agent.createdAt` 列，也不会有删列的
migration；本目录是撤行这一版（PR #542）的证据。

## 命令

```sh
VERIFY_REPO_ROOT=<worktree> VERIFY_PORT=8891 VERIFY_WEB_PORT=5373 \
  VERIFY_RUN_DIR=<worktree>/.claude/verify-run-trim \
  node <worktree>/.claude/skills/verify-pacman/scripts/launch.mjs
VERIFY_REPO_ROOT=<worktree> VERIFY_RUN_DIR=<worktree>/.claude/verify-run-trim \
  node <worktree>/.claude/skills/verify-pacman/scripts/drive-agent-detail.mjs
```

端口是换过的：本机 8791 上有别的车道起着的验证栈，不能杀（脚本自己会拦下来并
提示换号）。

## 结果

`drive agent-detail: PASS`，26 项 check 全绿（完整清单见
`agent-detail-result.json`）。与本次改动直接相关的一条：

| check | 实测输出 |
|---|---|
| `overview-no-thinking-status-rows` | `thinking=0 status=0` |

判据取「元素计数为零」而不是断言文案——撤行最典型的两种坏法（行长回来、撤了行
但留下空壳类名）都逃不掉。全量 check 与既有面（名称/职责/模型/运行时/权限/密钥/
记忆/创建弹窗）同批绿，无回归。

`capabilities-seven-levels` 仍在跑，但语义变了：原先它是「读面接到了 UI 上」的
前一半（后一半是两条已随行删掉的 `thinking-*-rendered` 判据），现在只验端点形状
——概览撤行后 `GET /api/capabilities` 在 web 侧零消费点，端点与 shared schema
的去留未裁，未裁前不删。

## 截图

- `agent-detail-overview.png` — 概览整屏；模型之下直接是页面底，没有「思考强度」
  与「状态」两行。

源证据目录（本地态，gitignored）：
`.claude/verify-evidence/2026-09-30T20-17-16-519Z-agent-detail`。