---
labels: [build, ready-for-agent]
status: open
blockedBy: [B3]
---

# B4 · 双 provider 验收

1. Anthropic 兼容端点（pi_compat，沿用 mini-pi 凭据）建连接，完成一轮真实对话
2. Claude Max OAuth（手抄 code 流程，08 票步骤）建连接，完成一轮真实对话

**完成条件**：两条连接各自跑通一轮对话，凭据落在 `~/.pacman/credentials.enc`。
