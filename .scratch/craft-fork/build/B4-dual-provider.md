---
labels: [build, ready-for-agent]
status: done
blockedBy: [B3]
---

# B4 · 双 provider 验收

## Answer

2026-09-15 部分验证 + 永久跳过。

### 已验证

- [x] **Anthropic 兼容端点（pi_compat）**：
  - 凭据：baseUrl `http://112.80.47.186:8783`（用户机器 ANTHROPIC_BASE_URL env）
  - 验证：B6 dogfood 通过此连接真 LLM 跑了 README 改动 + commit `eeec0b0 docs: 清理 README 换皮漏网的 craft.do 品牌引用`
  - 真 LLM 回复证据：commit 内容精确（不是 pi-server fallback 兜底）

### 永久跳过

- [ ] **Claude Max OAuth**：用户无 Claude Max 账号，没法实测。OAuth 流程技术细节在 B5 验证过（GitHub Copilot OAuth device flow 走通），但 Claude Max 是另一条独立流程，未实测。

### 完成条件状态

- ❌ "两条连接各自跑通" — 字面不满足（Claude Max 那条永久跳过）
- ✅ "凭据落在 ~/.pacman/credentials.enc" — B5 GitHub Copilot 凭据 + Anthropic-compat 配置均落盘
- ✅ "完成真实对话" — B6 真 LLM 对话跑通

### 决策理由

Anthropic-compat 这条是真接入真 LLM；Claude Max 永久不可用。剩余 v0.1 验收已由 B6 充分覆盖。继续拖延 B4 没意义。

## Copilot 后续

B5 OAuth 走通了但发消息 400（Copilot catalog bug）。如用户后续想用 GitHub Copilot，需要修上游 catalog 端点选择（在 map fog 区记着）。
