---
labels: [wayfinder:research]
status: closed
blockedBy: []
---

# 08 · OAuth 验证路径：各家需要什么

## Question

05 号票定了首发「Anthropic 兼容端点 + Claude Max OAuth」两条都验。扫描上游源码（`/tmp/craft-agents-oss`，重点 `packages/shared/src/auth/`），回答：

1. Claude Max / ChatGPT / GitHub Copilot 三个 OAuth 流程各自是否需要用户去平台方注册 OAuth client？还是用 SDK 自带的一方 client id？
2. callback 落在哪：本地 localhost 回调服务器，还是 deep link（`craftagents://` → 我们改 `pacman://`）？若是 deep link，平台后台需要登记什么 redirect URI？
3. 换皮对 OAuth 的影响面：除了 scheme，还有没有 client name、UA 之类的注册面需要同步改？
4. 给出每家从「打开设置」到「连接成功」的实际操作步骤预估。

输出：三家对照表 + 换皮敏感点清单。

## Answer

调研对象：`/Users/xmon/Code/AgentProjects/craft-agents-oss`（v0.13.3，只读）。所有 `文件:行号` 相对该仓库根。完整调研草稿（含逐步流程与完整引用）：`.scratch/craft-fork/research/08-oauth-draft.md`。

### 三家对照表

| Provider | 用户要注册 OAuth client？ | client_id 来源 | callback 形态 | redirect URI | token 存储 |
|---|---|---|---|---|---|
| Claude Max（`claude_oauth`） | 不需要 | 硬编码 Anthropic 公共 PKCE client `9d1c250a-e61b-44d9-88ed-5944d1962f5e`（`packages/shared/src/auth/claude-oauth-config.ts:13`） | **既非 localhost 也非 deep link**：跳到 Anthropic 托管页展示 code，用户手抄回 App | `https://console.anthropic.com/oauth/code/callback`（`claude-oauth-config.ts:30`，Anthropic 服务端登记，不可改） | `~/.craft-agent/credentials.enc`（AES-256-GCM，PBKDF2+硬件 UUID，`packages/shared/src/credentials/backends/secure-storage.ts:44-45`），key `llm_oauth::{slug}` + legacy `claude_oauth::global` |
| ChatGPT（`pi_chatgpt_oauth`） | 不需要 | 硬编码 OpenAI Codex CLI 公共 client `app_EMoamEEZ73f0CkXaXp7hrann`（`packages/shared/src/auth/chatgpt-oauth-config.ts:16`） | **本地一次性 HTTP 回调服务器**（Electron 起在 1455 端口，`apps/electron/src/preload/bootstrap.ts:367-371`） | `http://localhost:1455/auth/callback`（`chatgpt-oauth-config.ts:33,39`，Codex CLI 注册，不可改） | 同上，`llm_oauth::{slug}`，含 idToken/accessToken/refreshToken/expiresAt |
| GitHub Copilot（`pi_copilot_oauth`） | 不需要 | 硬编码 VS Code Copilot Chat 公共 app `Iv1.b507a08c87ecfe98`（base64 混淆，`packages/shared/src/auth/github-copilot.ts:34`） | **无 callback**：device flow 轮询（`github-copilot.ts:258-364`），浏览器仅用于 `github.com/login/device` 输 8 位码 | 无（device flow 不需要） | 同上；`refreshToken` 实为长命 GitHub access token，负责刷新短命 Copilot API token |

端点速查：Claude `https://claude.ai/oauth/authorize` + `https://platform.claude.com/v1/oauth/token`（`claude-oauth-config.ts:18,24`）；ChatGPT `https://auth.openai.com/oauth/authorize` + `.../oauth/token`（`chatgpt-oauth-config.ts:22,27`）；Copilot `github.com/login/device/code` → `github.com/login/oauth/access_token` → `api.github.com/copilot_internal/v2/token`（`github-copilot.ts:29-31`）。

### 逐问作答

**1. 是否需要用户注册 OAuth client？** 三家全都不需要——全部复用上游已注册的公共客户端身份（Anthropic 自家 PKCE client、OpenAI Codex CLI client、VS Code Copilot Chat OAuth app），无 client_secret。用户侧零注册，App 内点 Connect 即可。

**2. callback 落在哪？** 三家各不相同，且**没有一家走 `craftagents://` deep link**：
- Claude Max：Anthropic 托管页展示 code + 用户手抄粘贴（无任何本机监听/跳转）；
- ChatGPT：`localhost:1455` 一次性回调服务器，自动接 code；
- Copilot：device flow 纯轮询，无 redirect。
- `craftagents://` 仅用于应用内导航与 MCP/通用 OAuth 完成后跳回 session（`packages/shared/src/auth/types.ts:71-74` 的 `buildOAuthDeeplinkUrl`；解析在 `apps/electron/src/main/deep-link.ts:99`）。平台后台要登记的 redirect 全是上游值，fork 无需登记任何自己的 URI。

**3. 换皮影响面。** 三家 OAuth 主流程的 client_id / endpoint / redirect / 端口 1455 / device URL 全是上游公共值，**一个都不能改，改了即废**。真正要同步改的皮肤面：
- deep link scheme `craftagents` → `pacman`：`apps/electron/src/main/index.ts:199,227,231`、`apps/electron/src/main/deep-link.ts:99`、`packages/shared/src/utils/url-safety.ts` 白名单、渲染层约 10 处拼接；
- Electron 品牌：`apps/electron/electron-builder.yml:1-3`（appId/productName/copyright）、`apps/electron/src/main/index.ts:220`；
- 凭据目录 `~/.craft-agent/credentials.enc` 与 PBKDF2 盐 `craft-agent-v1/v2`（`secure-storage.ts:44-45,326,344`）——改盐 = 老用户凭据全部解密失败；
- UA `CraftAgents/${APP_VERSION}`（`claude-oauth.ts:223`、`claude-token.ts:32`）可改；**Copilot 的 `GitHubCopilotChat/0.35.0` + `Editor-Version: vscode/1.107.0` + `Copilot-Integration-Id: vscode-chat` 头不能改**（`github-copilot.ts:37-42`），改了 GitHub 拒认客户端；
- MCP 动态注册的 `CLIENT_NAME = 'Claude Code (Craft Agent)'`（`packages/shared/src/auth/oauth.ts:29`）会显示在第三方授权页，建议随品牌改，但不影响三家；
- 凭据 key 前缀（`claude_oauth`、`llm_oauth`，`packages/shared/src/credentials/types.ts:19-38`）属内部 key，改了等于清空存量 token，不建议动。

**4. 操作步骤预估（首次连接）。**
- Claude Max（~6-9 步，最繁琐）：Settings → AI Providers → Add → Claude → Sign in with Claude → 浏览器登录授权 → 托管页**手抄 code** → 回 App 粘贴 → Connected。
- ChatGPT（~4-6 步，最顺）：Settings → Add → ChatGPT → Sign in → 浏览器授权 → 自动跳 `localhost:1455` 接住 → 成功页自动关闭 → Connected。
- Copilot（~6-8 步）：Settings → Add → Copilot → Sign in → App 自动复制 8 位码并打开 `github.com/login/device` → 粘贴输码 → Authorize → 后台轮询换 token + 自动启用 policy-gated 模型 → Connected。

> 备注：Slack/Google/Microsoft 走环境变量 client_id + `https://thecraftagents.com/auth/callback` 中转（`packages/shared/src/auth/oauth-relay.ts:3`），不属于本工单三家，但若 pacman 后续支持则需在对应平台自注册 client。
