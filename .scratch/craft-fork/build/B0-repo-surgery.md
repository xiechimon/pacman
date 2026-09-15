---
labels: [build, ready-for-agent]
status: open
blockedBy: []
---

# B0 · 仓库手术

把 pacman 仓换成 pacman 产品的代码线。

1. mini-pi v2 历史打 tag 封存（`archive/mini-pi-v2`）
2. 上游 v0.13.3 压缩导入 main（一条「初始导入」提交，源：`~/Code/AgentProjects/craft-agents-oss`）
3. 上游全量历史推上 `vendor/upstream` 只读分支
4. LICENSE、版权声明保留，README 注明出处（Apache-2.0）

**完成条件**：main 从导入提交起算；`git log vendor/upstream` 可见上游全史；LICENSE 在。
