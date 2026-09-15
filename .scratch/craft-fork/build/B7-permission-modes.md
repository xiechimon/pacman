---
labels: [build, ready-for-agent]
status: open
blockedBy: [B4]
---

# B7 · 权限三模式各试一次

safe（只读）/ ask（弹批）/ allow-all（直跑）各触发一次工具调用。

**完成条件**：三模式行为符合预期（safe 拒写、ask 有确认、allow-all 直跑）。
