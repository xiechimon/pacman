# Agent 概览撤「状态」行验证（XMON-18）

Agent 详情概览撤掉一行只读展示——`状态`（`agentStatusSchema` 只有 `active` 一个
取值，摆出来零信息量）。用户可见行为变了，故按 `verify-pacman` 的 live 探针走真
用户路径取证。

本票的**行为改动**只有撤这一行：`思考强度` 行与它的能力读面保留原样（档位交给
agent 编排指的是不给人手设，不是把值藏起来），`创建于 …` 继续不做（不需要创建
时间，`main` 上不会加 `agent.createdAt` 列；它此前从未渲染过，所以那一条是「不做」
不是「撤行」）。

同一次 commit 里还带了一行**与本票无关的 drive-by 修复**：`agent-detail.spec.ts` 里
硬写的密钥副文案停在旧版（#527 换过 shared canon 后那条断言一直红）。它随行是为了
让这条车道的 CI 不再是既有的红，范围上不算本票的行为改动——列在这里以免把 diff 读窄。

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

`drive agent-detail: PASS`，29 项 check 全绿（完整清单见
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

- `agent-detail-overview.png` — 概览整屏；模型之下是 `思考强度 / 默认`，再下面是
  页面底——没有 `状态 / active` 那一行。

源证据目录（本地态，gitignored）：
`.claude/verify-evidence/2026-09-30T21-05-05-519Z-agent-detail`。