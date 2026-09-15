---
labels: [wayfinder:grilling]
status: closed
owner: user
blockedBy: []
---

# 06 · 重子系统的自用启用范围

## Question

全留 ≠ 全启用。定每个重子系统在自用场景的启用边界：

- **Pages**：Cloudflare sharing 已裁，本地 Pages（仪表盘/活文档）保留成什么形态？
- **Automations**：自用跑哪些触发器（cron？label 变化？），有没有第一条想自动化的真实任务？
- **IM 网关**：Telegram / WhatsApp / Lark 配哪个？（各自需要用户提供 bot token / 账号）
- **browser_tool**：自用有没有真实场景（自动填表、抓需登录的页面），还是仅保留代码？

调用 `grilling` 与 `domain-modeling`。

## Answer

- **Pages**：功能整体保留。注意：对外发布（Cloudflare sharing）仍按地图既定裁剪断开（`CRAFT_FEATURE_PAGES_SHARING=0`）——01 票确认该通路会持续向 Craft 服务器发数据；想保留发布能力需另议，不在本次裁剪豁免内。
- **Automations**：代码全留，不配任何触发器；有第一条真实重复任务时再开。
- **IM 网关**：启用 **Telegram**，其余不配。前置条件：用户在 @BotFather 建 bot 拿 token——列为 spec 里的 HITL 施工票。
- **browser_tool**：保持启用，不动。
