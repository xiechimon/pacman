---
labels: [build, ready-for-agent]
status: open
blockedBy: [B2]
---

# B3 · 深换皮为 pacman

以 `issues/01-craft-service-bindings.md` b 类 35 条为清单，全换：

- productName `pacman`、appId `app.pacman`、`pacman://` scheme、`~/.pacman` 配置目录（含 10 处硬编码绕行）、`@pacman/*` 12 包名、UA、MCP clientInfo/serverInfo、i18n 七语言、`CRAFT_` → `PACMAN_`
- **红线**（08 票）：OAuth 公共 client_id/endpoint/端口 1455 不改；Copilot 伪装请求头不改；PBKDF2 盐不改
- 视觉不动（沿用上游图标/主题色，自用不分发）

**完成条件**：审计脚本对身份名单零命中；UI 标题/菜单/配置目录均为 pacman。
