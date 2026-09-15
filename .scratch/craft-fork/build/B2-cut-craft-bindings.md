---
labels: [build, ready-for-agent]
status: open
blockedBy: [B0]
---

# B2 · 裁剪 Craft 服务绑定

以 `issues/01-craft-service-bindings.md` 为唯一事实源，逐条勾销：

- a 类 19 条必删（Sentry 全链路、Plausible、send_developer_feedback、mcp.craft.do 校验器）
- c 类 10 条逐项处置（Pages sharing 用 `CRAFT_FEATURE_PAGES_SHARING=0` 关断；auto-update feed、install 脚本、Slack relay 等）
- Dockerfile 弃用（上游引用不存在目录，本已坏）

先建**身份与裁剪审计脚本**（grep 死名单零命中），裁完跑它。

**完成条件**：审计脚本零命中；`bun run electron:start` 起窗无报错。
