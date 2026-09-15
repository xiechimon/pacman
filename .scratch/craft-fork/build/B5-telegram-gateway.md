---
labels: [build, ready-for-agent]
status: done
blockedBy: [B0]
---

# B5 · Telegram 网关（HITL）

启用 Telegram 网关（06 票决策：IM 只配 Telegram）。

- [x] 用户在 @BotFather 建 bot：`pacman12_bot`，token 提供（8908221738:AAF...fjO-0）
- [x] 验证 token：`getMe` 返回 bot `pacman12_bot`（HTTP 200, ok=true）
- [x] pacman UI 填入 token → gateway 启动：bot.init ok + polling started + adapter registered
- [x] Telegram 用户发消息 → pacman 收到 → 路由到 session → LLM 调用 → 回复

**完成条件** ✓：从 Telegram 发消息，pacman 回话（实测端到端：/start → /pair → /new → "你好" → 回复 6 字符）。

## Answer

2026-09-15 实测通过。日志路径：`/tmp/pacman-electron.log`。

**已知疑问**（留观）：LLM 回复是 pi-server 内置 fallback（"日常问候交流"）而非真实模型输出——根因是 Copilot model_not_supported 未解（在 map fog 区）。后续若接通 Anthropic 兼容端点或修 Copilot catalog 问题，应该会触发真 LLM 回复。
