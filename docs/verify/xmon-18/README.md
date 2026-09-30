# Agent 概览撤「状态」行验证（XMON-18）

Agent 详情概览撤掉一行只读展示——`状态`（`agentStatusSchema` 只有 `active` 一个
取值，摆出来零信息量）。用户可见行为变了，故按 `verify-pacman` 的 live 探针走真
用户路径取证。

本票的**行为改动**只有撤这一行：`思考强度` 行与它的能力读面保留原样（档位交给
agent 编排指的是不给人手设，不是把值藏起来），`创建于 …` 继续不做（不需要创建
时间，`main` 上不会加 `agent.createdAt` 列；它此前从未渲染过，所以那一条是「不做」
不是「撤行」）。

合入前 `main` 先后落了 XMON-15（#536，概览「进行中」段）与 XMON-19（#539，删除
Agent），本车道两次并入。XMON-15 顺手把 `agent-detail.spec.ts` 里停在旧版的密钥副
文案修了（本票早先同款 drive-by 修复因此作废、不再带）——本 PR 净改动只剩撤
`状态` 这一行。下面的结果是**合并后复跑**：38 项里多出的 9 项删除 Agent 检查来自
XMON-19，随合并进了本车道，一并跑绿证明两块改动在同一页面上互不打架。

## 命令

```sh
VERIFY_REPO_ROOT=<worktree> VERIFY_PORT=8891 VERIFY_WEB_PORT=5373 \
  VERIFY_RUN_DIR=<worktree>/.claude/verify-run-merge \
  node <worktree>/.claude/skills/verify-pacman/scripts/launch.mjs
VERIFY_REPO_ROOT=<worktree> VERIFY_RUN_DIR=<worktree>/.claude/verify-run-merge \
  node <worktree>/.claude/skills/verify-pacman/scripts/drive-agent-detail.mjs
```

端口是换过的：本机 8791 上有别的车道起着的验证栈，不能杀（脚本自己会拦下来并
提示换号）。

## 结果

`drive agent-detail: PASS`，38 项 check 全绿（完整清单见
`agent-detail-result.json`）。与本改动直接相关的四条：

| check | 实测输出 |
|---|---|
| `overview-no-status-row` | `status=0` |
| `overview-thinking-readonly` | 通过（思考强度行**还在**，值 `默认`、无按钮） |
| `capabilities-seven-levels` | `["off","minimal","low","medium","high","xhigh","max"]` |
| `thinking-inside-vocabulary-rendered` | `high`（PATCH `thinkingLevel: "high"` → 只读行出 `high`） |

撤行的判据取「元素计数为零」而不是断言文案——撤行最典型的两种坏法（行长回来、
撤了行但留下空壳类名）都逃不掉。后两条是「保留的那半确实还在、确实接在能力读面上」
的看门人：只撤状态却把思考强度一起带走，这两条会红。

## 截图

- `agent-detail-overview.png` — 概览整屏（合并后复跑）；模型之下是 `思考强度 / 默认`，
  再往下是「进行中」空态段与页脚删除入口（XMON-15 / XMON-19 随合并进来）——整屏
  没有 `状态 / active` 那一行。

源证据目录（本地态，gitignored）：
`.claude/verify-evidence/2026-09-30T22-33-15-173Z-agent-detail`。