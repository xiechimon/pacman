---
labels: [wayfinder:ticket]
status: closed
resolution: fixed-with-live-probe
blockedBy: []
---

# 09 · Copilot model catalog bug（live probe 实测定案）

## 实测证据（2026-09-16，真实 Copilot 账号 /chat/completions + /responses 全探针）

探针脚本：`/tmp/copilot-probe2.ts`（refresh token → 遍历服务器报告的 available 清单逐个 POST）。

**结论比原判断更严重**：

1. `/responses` 端点 **全灭** —— 服务器报告 available 的 ~60 个模型，没有一个能过 `/responses`。
2. `/chat/completions` 只有这批能过：`gpt-4.1`、`gpt-4.1-2025-04-14`、`gpt-4o`（全系）、`gpt-4o-mini`、`gpt-3.5-turbo`（`copilot-search-*`、`exec-agent-*` 是内部模型）。
3. SDK catalog 里的**所有**模型（claude-fable/opus/sonnet/haiku、gpt-5.x、kimi-k2.7-code、kimi-k3、grok、mai-code-*、gemini-3.x-flash）在该账号上两个端点都返回 `model_not_supported`。
4. `/models` 的 enabled 清单也不可信：`gpt-4o` 不在 enabled 里但能通；`gpt-5.4-mini` 在 enabled 里但不通。
5. 之前以为 "gpt-4* 是 legacy 要隐藏" 的 `EXCLUDED_MODEL_PREFIXES` 恰好把唯一能用的模型藏掉了（drivers/pi.ts）。

## 修复（全部落盘）

| 文件 | 改动 |
|---|---|
| `packages/shared/src/config/models-pi.ts` | 新增 `COPILOT_FALLBACK_MODEL_IDS = ['gpt-4.1', 'gpt-4o-mini', 'gpt-4o']`；`getPiModelsForAuthProvider('github-copilot')` 并集注入 |
| `packages/shared/src/agent/backend/internal/drivers/pi.ts` | 删掉 gpt-4/gpt-3.5 前缀排除；动态清单并集兜底模型 |
| `packages/shared/src/config/llm-connections.ts` | `PI_PREFERRED_DEFAULTS['github-copilot']` = `['gpt-4.1', 'gpt-4o-mini', 'gpt-4o', 'claude-haiku-4-5', ...]` → 默认解析到 `pi/gpt-4.1` |
| `packages/pi-agent-server/src/index.ts` | `registerCopilotFallbackModels()`：github-copilot 连接创建 runtime 时把 3 个兜底模型注册进 SDK registry（api=openai-completions，带 Copilot 头）。真实 SDK 验证：注册前 gpt-4.1 不可解析，注册后解析成功且不挤掉 kimi-k3 |
| `packages/shared/src/agent/errors.ts` | "model is not supported" 归入 `invalid_model` + `swapModel` 建议（取白名单第一个存在于 catalog 的） |
| 渲染层 | 错误条新增 "Switch to X and resend" 一键换默认模型并重发（ChatDisplay + event-processor + core Message 类型） |
| OAuth 时序 | `copilot:startOAuth` 立即返回 `{pending: true}`，终态走新 push 通道 `copilot:authResult`（绕开 30s REQUEST_TIMEOUT_MS） |

## 遗留风险

- 免费 tier 用户只能用 gpt-4.1 系；付费 tier 想要更强模型需手动在 picker 里选（claude-sonnet-5 等）。
- SDK catalog 的 `anthropic-messages` 模型在该账号全灭 —— 若是 pi SDK 对 copilot 的 anthropic-messages 路由有额外要求，属上游问题。
- 上游 pi-server catalog ↔ responses 一致性问题依旧存在，等上游修。
