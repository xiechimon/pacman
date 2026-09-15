---
labels: [build, ready-for-agent]
status: done
blockedBy: [B3, B4]
---

# B6 · dogfood 冒烟

用 pacman 自己改 pacman 仓一处换皮漏网文案并提交。

- [x] Telegram 发任务给 `@pacman12_bot`
- [x] pacman agent 跑：找到 README.md line 25 漏网 `(at craft.do)` 引用
- [x] 删除多余片段 + commit `eeec0b0 docs: 清理 README 换皮漏网的 craft.do 品牌引用`
- [x] 审计脚本零命中（a/c=0, b=1 仅 TRADEMARK.md）

**完成条件** ✓ ✓ ✓

## Answer

2026-09-15 实测通过。

- diff：`-Pacman is a tool we built so that we (at craft.do) can work effectively with agents.` → `+Pacman is a tool we built so that we can work effectively with agents.`
- commit `eeec0b0`（author 是用户 git 配置的 xiechimon，pacman agent 不伪造 git author——这是合理行为）

**额外价值**：B6 跑通也证明了 **Anthropic 兼容端点 (`http://112.80.47.186:8783`) 真接通**——之前 B5 的"日常问候交流"是 Copilot fallback，现在 pacman 能干真活了。
