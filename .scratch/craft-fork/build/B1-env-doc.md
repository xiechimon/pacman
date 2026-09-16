---
labels: [build, ready-for-agent]
status: done
resolution: docs/environment.md（干净克隆全链路复现通过 2026-09-16）
blockedBy: []
---

# B1 · 环境固化

把 03 票实跑结论写成可复现的环境文档（进 README 或 docs）：bun 版本与装法、~/.bun 必须本机化（悬空 symlink 死循环大坑）、ELECTRON_MIRROR 兜底、`bun install` 必须放行 postinstall。

**完成条件**：按文档在干净环境能复现 `bun install` 成功。
