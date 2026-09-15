---
labels: [wayfinder:grilling]
status: closed
owner: user
blockedBy: [01]
---

# 04 · 命名与换皮

## Question

这个 agent 叫什么？换皮换到哪一层？

- 产品名 / 仓内代号（影响 bundle id、配置目录 `~/.craft-agent` → `~/.<name>`、UI 标题、协议字段）
- 图标与主题色（branding.ts / colors / icons）
- 换皮深度：只改用户可见面，还是连内部模块名、协议字段一起改（后者让上游 merge 变难）

输入：ticket 01 产出的身份引用触点表。调用 `grilling` 与 `domain-modeling`，产出术语写进 spec 词汇表。

## Answer

- **名字：pacman**。落点：productName `pacman`、bundle id `app.pacman`、配置目录 `~/.pacman`、URL scheme `pacman://`、包作用域 `@pacman/*`、env 前缀 `PACMAN_`、MCP clientInfo/serverInfo 名、UA `pacman/<version>`、i18n 七语言文案同步替换。
- **深度：深换皮**。01 号票 b 类 35 条触点全换，含 `@craft-agent/*` 12 个包名重命名。**已明示接受的代价**：上游 merge 会产生大面积重命名冲突，以后捡修复以手工 diff vendor 分支为主。
- **视觉：v0.1 沿用 craft 图标与主题色**（自用不分发）。注意：对外分发前必须重做视觉，craft 品牌资产受其 TRADEMARK 约束——此条记入 spec 风险节。
- 术语已落盘：仓根 `CONTEXT.md`。
