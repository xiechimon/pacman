# 思考强度能力读面验证（XMON-16 / #499 B3 裁决 A）

能力读面加了一档，用户可见行为变了——Agent 详情「思考强度」只读行的档位现在经
`GET /api/capabilities` 的七档词表呈现（存值不在词表内落「默认」），故按
`verify-pacman` 的 live 探针走真用户路径取证。

## 命令

```sh
VERIFY_REPO_ROOT=<worktree> node <worktree>/.claude/skills/verify-pacman/scripts/launch.mjs
VERIFY_REPO_ROOT=<worktree> node <worktree>/.claude/skills/verify-pacman/scripts/drive-agent-detail.mjs
```

隔离栈：api `127.0.0.1:8791` + web `127.0.0.1:5273` + scratch `PACMAN_HOME`。

## 结果

`drive agent-detail: PASS`，`allOk=true`，28 项 check 全绿（完整清单见
`agent-detail-result.json`）。与本次改动直接相关的三条：

| check | 实测输出 |
|---|---|
| `capabilities-seven-levels` | `["off","minimal","low","medium","high","xhigh","max"]` |
| `thinking-inside-vocabulary-rendered` | `high`（PATCH `thinkingLevel: "high"` → 只读行出 `high`） |
| `thinking-outside-vocabulary-falls-back` | `默认`（PATCH `thinkingLevel: "ultra"` → 只读行落「默认」，且行内 0 个 `button`） |

后两条是「读面真的接到 UI 上」的判据——只验端点返回不算数；跑完探针还原种子态
`thinkingLevel: null`。全量 check 与既有面（名称/职责/模型/权限/密钥/记忆/创建弹窗）
同批绿，无回归。

## 截图

- `agent-detail-thinking-level-high.png` — PATCH `thinkingLevel:"high"` 后重载，只读行出 `high`。
- `agent-detail-overview.png` — 概览整屏（种子态，只读行 `默认`）。

「词表外值落『默认』」那一张与 `agent-detail-overview.png` 逐字节相同（同页面同
状态，只读行都出 `默认`），不另存重复件——该态由 `result.json` 的
`thinking-outside-vocabulary-falls-back` 记录。

源证据目录（本地态，gitignored）：`.claude/verify-evidence/2026-09-30T18-06-51-968Z-agent-detail`。