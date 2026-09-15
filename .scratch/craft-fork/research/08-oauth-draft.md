# 08 — OAuth 三家流程调研（Claude Max / ChatGPT / GitHub Copilot）

调研对象：`/Users/xmon/Code/AgentProjects/craft-agents-oss`（craft-agents-oss v0.13.3，只读）
所有路径相对该仓库根。

---

## 三家 OAuth 对照表

| Provider | 用户是否要去平台注册 OAuth client？ | client_id 来源 | authorize endpoint | token endpoint | callback 形态 | redirect URI | token 存储 |
|---|---|---|---|---|---|---|---|
| **Claude Max**（`claude_oauth`） | 不需要 | 硬编码 `9d1c250a-e61b-44d9-88ed-5944d1962f5e`（Anthropic 第一方公开 client，PKCE 公共客户端，无 secret）<br>`packages/shared/src/auth/claude-oauth-config.ts:13` | `https://claude.ai/oauth/authorize`<br>`packages/shared/src/auth/claude-oauth-config.ts:18` | `https://platform.claude.com/v1/oauth/token`<br>`packages/shared/src/auth/claude-oauth-config.ts:24` | **手工复制 code**：跳到 Anthropic 自家页面 `console.anthropic.com/oauth/code/callback`，页面把 code 显示出来，用户复制粘回 App（不开本地 callback 服务器，也不走 deep link） | `https://console.anthropic.com/oauth/code/callback`（Anthropic 托管的回调页，写死在 client 注册里，不能改）<br>`packages/shared/src/auth/claude-oauth-config.ts:30` | `~/.craft-agent/credentials.enc`（AES-256-GCM，PBKDF2 派生自硬件 UUID）<br>`packages/shared/src/credentials/backends/secure-storage.ts:44-45`<br>凭据 key：`claude_oauth::global`（legacy）+ `llm_oauth::{connectionSlug}`（现行） |
| **ChatGPT**（`pi_chatgpt_oauth` / Codex） | 不需要 | 硬编码 `app_EMoamEEZ73f0CkXaXp7hrann`（OpenAI Codex CLI 官方公共 client）<br>`packages/shared/src/auth/chatgpt-oauth-config.ts:16` | `https://auth.openai.com/oauth/authorize`<br>`packages/shared/src/auth/chatgpt-oauth-config.ts:22` | `https://auth.openai.com/oauth/token`<br>`packages/shared/src/auth/chatgpt-oauth-config.ts:27` | **本地 HTTP 回调服务器**：Electron 在 `http://localhost:1455/auth/callback` 起一次性 server 接住 code（端口 1455 是 Codex CLI 注册的，不能换） | `http://localhost:1455/auth/callback`<br>`packages/shared/src/auth/chatgpt-oauth-config.ts:33,39`<br>在 `apps/electron/src/preload/bootstrap.ts:367-371` 通过 `createCallbackServer({port:1455, callbackPaths:['/auth/callback']})` 起 | 同上：`llm_oauth::{connectionSlug}`，字段含 `idToken` / `accessToken` / `refreshToken` / `expiresAt` |
| **GitHub Copilot**（`pi_copilot_oauth`） | 不需要 | 硬编码 `Iv1.b507a08c87ecfe98`（VS Code Copilot Chat 公开 OAuth app，源码里 base64 轻混淆为 `SXYxLmI1MDdhMDhjODdlY2ZlOTg=`）<br>`packages/shared/src/auth/github-copilot.ts:34` | device flow：先 POST `https://github.com/login/device/code` 拿 user_code，再让用户在 `https://github.com/login/device` 输码<br>`packages/shared/src/auth/github-copilot.ts:29` | `https://github.com/login/oauth/access_token`（轮询换 GitHub access token）<br>+ `https://api.github.com/copilot_internal/v2/token`（GitHub token → Copilot API token）<br>`packages/shared/src/auth/github-copilot.ts:30-31` | **无 callback**：device flow 纯轮询。浏览器只在 `github.com/login/device` 打开一次让用户输码 | 无 redirect URI（device flow 不需要） | 同上：`llm_oauth::{connectionSlug}`，字段含 `value`=Copilot API token（短命 ~1h）、`refreshToken`=GitHub access token（长命，承担刷新凭据）、`expiresAt` |

> 三家都**不要**用户去平台方注册自己的 OAuth client。三个 client_id 都是上游（Anthropic / OpenAI / GitHub-VS Code）已经登记好的公共 client，被 Craft 直接复用。这是把「借用上游 CLI 的 OAuth 身份」当作标准玩法。

---

## 各 provider 逐步流程

### A. Claude Max（`claude_oauth`）— 浏览器打开 → 用户手抄 code 回粘

源码依据：

1. 用户在 Settings → AI Providers 选「Claude」触发 `handleSelectProvider('claude')` → `handleStartOAuth('claude_oauth')`（`apps/electron/src/renderer/hooks/useOnboarding.ts:603-614`）。
2. 渲染进程调 `window.electronAPI.startClaudeOAuth()`（`apps/electron/src/renderer/hooks/useOnboarding.ts:614`）。
3. preload 覆写层调 RPC `onboarding:startClaudeOAuth`（`apps/electron/src/preload/bootstrap.ts:335-352`；channel 名见 `packages/shared/src/protocol/channels.ts:185`）。
4. Electron 主进程 handler 调 `prepareClaudeOAuth()`（`apps/electron/src/main/onboarding.ts:96-109`），返回 `authUrl`。
5. `prepareClaudeOAuth()`（`packages/shared/src/auth/claude-oauth.ts:114-138`）生成 PKCE `codeVerifier`/`codeChallenge` 和 `state`，存到模块级 `currentOAuthState`（10 分钟 TTL），用 `URLSearchParams` 拼出 `https://claude.ai/oauth/authorize?code=true&client_id=…&redirect_uri=https%3A%2F%2Fconsole.anthropic.com%2Foauth%2Fcode%2Fcallback&scope=org:create_api_key+user:profile+user:inference&code_challenge=…&code_challenge_method=S256&state=…`。
6. preload 拿 `authUrl` 调 `shell.openExternal(authUrl)`（`apps/electron/src/preload/bootstrap.ts:343`），系统默认浏览器打开 Claude 登录页。
7. 用户在浏览器里完成 Claude 登录授权，Anthropic 把浏览器重定向到 `https://console.anthropic.com/oauth/code/callback?code=…&state=…`——这是 **Anthropic 自家的 HTML 页面**，把 code 用大字号渲染出来。
8. 用户**手动复制** code，回到 App 的 code 输入框粘贴（UI：`apps/electron/src/renderer/components/onboarding/CredentialsStep.tsx:198-228` 的 `isWaitingForCode` 分支）。
9. 用户点提交，渲染层调 `window.electronAPI.exchangeClaudeCode(code, connectionSlug)`（`apps/electron/src/renderer/hooks/useOnboarding.ts:681-682`）。
10. 主进程 `EXCHANGE_CLAUDE_CODE` handler（`apps/electron/src/main/onboarding.ts:112-151`）调 `exchangeClaudeCode()`（`packages/shared/src/auth/claude-oauth.ts:190-280`）→ POST JSON 到 `https://platform.claude.com/v1/oauth/token`，请求头 `User-Agent: CraftAgents/{APP_VERSION}`（`claude-oauth.ts:223`）。
11. 拿到 tokens 后双写：`manager.setLlmOAuth(connectionSlug, …)` 和 `manager.setClaudeOAuthCredentials(…)`（`apps/electron/src/main/onboarding.ts:129-141`），后者写到 legacy `claude_oauth::global` 槽位以保兼容。
12. 刷新：用 `refreshClaudeToken()`（`packages/shared/src/auth/claude-token.ts:16-73`），同 token endpoint、同 client_id、`grant_type=refresh_token`，由 `state.ts` 的 `getValidClaudeOAuthToken` + `performTokenRefresh`（带 mutex）驱动（`packages/shared/src/auth/state.ts:104-180, 202-257`）。

> 特点：**不起本地服务器、不走 deep link**。callback 完全靠 Anthropic 托管的 `console.anthropic.com/oauth/code/callback` 页面 + 用户手抄 code。换皮不需要去 Anthropic 登记任何 URL。

### B. ChatGPT（`pi_chatgpt_oauth`）— 本地 1455 端口一次性 callback 服务器

源码依据：

1. 用户选「ChatGPT」→ `handleStartOAuth('pi_chatgpt_oauth')`（`apps/electron/src/renderer/hooks/useOnboarding.ts:554-570`）。
2. 渲染层调 `window.electronAPI.startChatGptOAuth(connectionSlug)`（`apps/electron/src/renderer/hooks/useOnboarding.ts:559`）。
3. preload 覆写层 `startChatGptOAuth`（`apps/electron/src/preload/bootstrap.ts:358-411`）跑一个完整的多步编排：
   - **Step 1**：`createCallbackServer({appType:'electron', port:1455, callbackPaths:['/auth/callback']})`（`bootstrap.ts:367-371`）——在用户本机 1455 端口起 HTTP 监听。
   - **Step 2**：RPC `chatgpt:startOAuth`（`bootstrap.ts:374`）→ 主进程 `prepareChatGptOAuth()` 生成 PKCE + authUrl（`packages/server-core/src/handlers/rpc/llm-connections.ts:649-671`，调用 `packages/shared/src/auth/chatgpt-oauth.ts:69-90`）。
   - **Step 3**：`shell.openExternal(startResult.authUrl)`（`bootstrap.ts:379`）打开 `https://auth.openai.com/oauth/authorize?client_id=app_EMoamEEZ73f0CkXaXp7hrann&redirect_uri=http%3A%2F%2Flocalhost%3A1455%2Fauth%2Fcallback&scope=openid+profile+email+offline_access&code_challenge=…&state=…&codex_cli_simplified_flow=true&id_token_add_organizations=true`。
   - **Step 4**：用户在浏览器完成 ChatGPT 登录授权，OpenAI 重定向到 `http://localhost:1455/auth/callback?code=…&state=…`，被本机 callback server 接住（`bootstrap.ts:382`）。
   - **Step 5**：callback server 返回成功页（`generateCallbackPage`，`packages/shared/src/auth/callback-page.ts`），并把 query 传给 promise。
   - **Step 6**：RPC `chatgpt:completeOAuth`（`bootstrap.ts:398`）→ 主进程 `exchangeChatGptTokens(code, codeVerifier)`（`packages/server-core/src/handlers/rpc/llm-connections.ts:674-715`）→ POST form 到 `https://auth.openai.com/oauth/token`（`packages/shared/src/auth/chatgpt-oauth.ts:96-142`）。
4. 拿到 `{id_token, access_token, refresh_token, expires_in}` 后 `credentialManager.setLlmOAuth(connectionSlug, {accessToken, idToken, refreshToken, expiresAt})`（`llm-connections.ts:696-701`）。
5. 另外 `exchangeIdTokenForApiKey()`（`chatgpt-oauth.ts:218-261`）支持把 id_token 通过 RFC 8693 换成标准 OpenAI API key（用 `urn:ietf:params:oauth:grant-type:token-exchange` 走同一个 token endpoint）。
6. 刷新：`refreshChatGptTokens(refreshToken)`（`chatgpt-oauth.ts:151-207`），同 endpoint `grant_type=refresh_token`。

> 特点：**走本地 HTTP 回调（端口 1455）**，不走 deep link，也不要求用户手抄 code。端口和路径 `/auth/callback` 是 Codex CLI 在 OpenAI 注册的合法 redirect，**改端口/路径会让 OpenAI 拒绝**。

### C. GitHub Copilot（`pi_copilot_oauth`）— device flow 轮询

源码依据：

1. 用户选「GitHub Copilot」→ `handleStartOAuth('pi_copilot_oauth')`（`apps/electron/src/renderer/hooks/useOnboarding.ts:574-601`）。
2. 渲染层先 `window.electronAPI.onCopilotDeviceCode(callback)` 订阅设备码事件，再调 `window.electronAPI.startCopilotOAuth(connectionSlug)`（`useOnboarding.ts:580-585`）。
3. RPC `copilot:startOAuth` handler（`packages/server-core/src/handlers/rpc/llm-connections.ts:775-833`）调 `loginGitHubCopilot()`（`packages/shared/src/auth/github-copilot.ts:251-376`）。
4. `loginGitHubCopilot` Step 1（`github-copilot.ts:258-291`）：POST `https://github.com/login/device/code`，body `client_id=Iv1.b507a08c87ecfe98&scope=read:user`，UA `GitHubCopilotChat/0.35.0`，拿回 `{device_code, user_code, verification_uri='https://github.com/login/device', interval, expires_in}`。
5. handler 把 `userCode + verificationUri` 通过 `RPC_CHANNELS.copilot.DEVICE_CODE` push 给前端（`llm-connections.ts:795-798`），并通过 `CLIENT_OPEN_EXTERNAL` 让客户端用系统浏览器打开 `https://github.com/login/device`（`llm-connections.ts:800-802`）。
6. 用户在 GitHub 页面**输入 8 位 user code**（UI 同时把它自动复制到剪贴板，见 `apps/electron/src/renderer/components/onboarding/CredentialsStep.tsx:73-91`）。
7. App 后台开始轮询（`github-copilot.ts:296-364`）：POST `https://github.com/login/oauth/access_token`，body `client_id=…&device_code=…&grant_type=urn:ietf:params:oauth:grant-type:device_code`，直到拿到 `access_token` 或超时（默认 5s 间隔，遵守 RFC 8628 `slow_down`）。
8. Step 3（`github-copilot.ts:367-368`）调 `refreshGitHubCopilotToken(githubAccessToken)`（`github-copilot.ts:76-113`）—— GET `https://api.github.com/copilot_internal/v2/token`，拿短命 Copilot API token（响应里 `token` 字段含 `proxy-ep=proxy.individual.githubcopilot.com` 等路由元数据）。
9. Step 4（`github-copilot.ts:370-373`）调 `enableAllGitHubCopilotModels()` 把账户里 policy-gated 的模型逐个 POST 同意 policy，否则 `/models` 列表里看不到 Claude/Grok 等模型（`github-copilot.ts:159-208`）。
10. 凭据落盘：`credentialManager.setLlmOAuth(connectionSlug, {accessToken: credentials.access, refreshToken: credentials.refresh, expiresAt: credentials.expires})`（`llm-connections.ts:816-820`）。这里 `refreshToken` 其实是**长命的 GitHub access token**——它本身就是刷新凭据。
11. 刷新入口：服务端模型刷新器在 token 临期时直接再调 `refreshGitHubCopilotToken(stored.refreshToken)`（`github-copilot.ts:76`），不需要重跑 device flow（除非 GitHub token 也被吊销）。

> 特点：**完全无 callback、无 redirect URI、无 deep link、无本地端口**。GitHub device flow 是公开 OAuth app（VS Code Copilot Chat 的 client_id）+ 用户在 github.com/login/device 输码。

---

## 换皮敏感点清单

下面每一条都是 fork 改名时**必须同步替换**或**必须保留原值**的位置。`文件:行号` 全部相对仓库根。

### 必须保留原值（改了 OAuth 就废）

| 项 | 值 | 位置 |
|---|---|---|
| Claude client_id | `9d1c250a-e61b-44d9-88ed-5944d1962f5e` | `packages/shared/src/auth/claude-oauth-config.ts:13` |
| Claude authorize URL | `https://claude.ai/oauth/authorize` | `packages/shared/src/auth/claude-oauth-config.ts:18` |
| Claude token URL | `https://platform.claude.com/v1/oauth/token` | `packages/shared/src/auth/claude-oauth-config.ts:24` |
| Claude redirect URI | `https://console.anthropic.com/oauth/code/callback` | `packages/shared/src/auth/claude-oauth-config.ts:30` |
| Claude scopes | `org:create_api_key user:profile user:inference` | `packages/shared/src/auth/claude-oauth-config.ts:35` |
| ChatGPT client_id | `app_EMoamEEZ73f0CkXaXp7hrann` | `packages/shared/src/auth/chatgpt-oauth-config.ts:16` |
| ChatGPT authorize URL | `https://auth.openai.com/oauth/authorize` | `packages/shared/src/auth/chatgpt-oauth-config.ts:22` |
| ChatGPT token URL | `https://auth.openai.com/oauth/token` | `packages/shared/src/auth/chatgpt-oauth-config.ts:27` |
| ChatGPT redirect URI | `http://localhost:1455/auth/callback` | `packages/shared/src/auth/chatgpt-oauth-config.ts:33` |
| ChatGPT 端口 | `1455` | `packages/shared/src/auth/chatgpt-oauth-config.ts:39`，并被 `apps/electron/src/preload/bootstrap.ts:369` 引用 |
| ChatGPT scopes | `openid profile email offline_access` | `packages/shared/src/auth/chatgpt-oauth-config.ts:45` |
| ChatGPT 额外参数 | `codex_cli_simplified_flow=true`, `id_token_add_organizations=true` | `packages/shared/src/auth/chatgpt-oauth.ts:81-82` |
| GitHub Copilot client_id | `Iv1.b507a08c87ecfe98`（base64 混淆 `SXYxLmI1MDdhMDhjODdlY2ZlOTg=`） | `packages/shared/src/auth/github-copilot.ts:34` |
| GitHub device code URL | `https://github.com/login/device/code` | `packages/shared/src/auth/github-copilot.ts:29` |
| GitHub access token URL | `https://github.com/login/oauth/access_token` | `packages/shared/src/auth/github-copilot.ts:30` |
| Copilot token URL | `https://api.github.com/copilot_internal/v2/token` | `packages/shared/src/auth/github-copilot.ts:31` |
| Copilot 调用头（让 GitHub 把我们当 VS Code Copilot） | `User-Agent: GitHubCopilotChat/0.35.0`、`Editor-Version: vscode/1.107.0`、`Editor-Plugin-Version: copilot-chat/0.35.0`、`Copilot-Integration-Id: vscode-chat` | `packages/shared/src/auth/github-copilot.ts:37-42`，并在 `packages/shared/src/agent/backend/internal/drivers/pi.ts:19` 重复使用 |
| GitHub scope | `read:user` | `packages/shared/src/auth/github-copilot.ts:265` |

### 可以/应该改（fork 品牌面）

| 项 | 当前值 | 位置 | 影响 |
|---|---|---|---|
| Electron `appId` | `com.lukilabs.craft-agent` | `apps/electron/electron-builder.yml:1` | macOS bundle id / Windows AppUserModelID |
| Electron `productName` | `Craft Agents` | `apps/electron/electron-builder.yml:2` | 安装包名、菜单栏标题 |
| 运行时 app 名 | `Craft Agents`（被 `CRAFT_APP_NAME` 环境变量覆盖） | `apps/electron/src/main/index.ts:220` | 窗口标题、菜单 |
| Deep link scheme | `craftagents`（被 `CRAFT_DEEPLINK_SCHEME` 覆盖） | `apps/electron/src/main/index.ts:199`、`apps/electron/src/main/index.ts:227,231` | 决定 `xxx://` 注册到 OS |
| 默认 deep link 解析白名单 | `craftagents:` 字面量 | `apps/electron/src/main/deep-link.ts:99`、`packages/shared/src/utils/url-safety.ts` 等 | 必须与上面同步替换 |
| OAuth 完成页跳回 App 的 deep link | `${deeplinkScheme}://allSessions/session/${sessionId}` | `packages/shared/src/auth/types.ts:71-74`（`buildOAuthDeeplinkUrl`） | 只在 MCP/通用 OAuth 流用到，三家主流程不用 |
| OAuth callback 服务器端口段（**通用 MCP/Source OAuth，不是三家**） | `START_PORT=6477, MAX_PORT_ATTEMPTS=100` | `packages/shared/src/auth/callback-server.ts:8-9` | 通用源用；chatgpt 走固定 1455 |
| 老 CraftOAuth 类端口段 | `CALLBACK_PORT_START=8914, CALLBACK_PORT_END=8924` | `packages/shared/src/auth/oauth.ts:26-27` | 旧 MCP 流程遗留 |
| MCP 客户端显示名 | `Claude Code (Craft Agent)` | `packages/shared/src/auth/oauth.ts:29`（`CLIENT_NAME`） | 动态注册 MCP OAuth client 时发给授权服务器 |
| MCP 默认 fallback client_id | `craft-agent` | `packages/shared/src/auth/oauth.ts:267, 577, 580` | MCP 服务器不支持动态注册时使用 |
| Claude / 通用 token 请求 UA | `CraftAgents/${APP_VERSION}` | `packages/shared/src/auth/claude-oauth.ts:223`、`packages/shared/src/auth/claude-token.ts:32` | 改品牌时同步改 |
| 网络拦截/抓取工具 UA | `Craft-Agent/1.0`、`Mozilla/5.0 (compatible; CraftAgent/1.0)` | `packages/shared/src/utils/icon.ts:143`、`packages/pi-agent-server/src/tools/web-fetch.ts:362` | 与 OAuth 无关但同属品牌面 |
| 凭据落盘路径 | `~/.craft-agent/credentials.enc` | `packages/shared/src/credentials/backends/secure-storage.ts:44-45` | 换皮需要改目录名 |
| 凭据加密 key 派生盐 | `craft-agent-v1`（legacy）/`craft-agent-v2`（现行） | `packages/shared/src/credentials/backends/secure-storage.ts:326, 344` | 改了就解不开旧凭据 |
| 凭据 key 前缀（`type::scope`） | `claude_oauth`、`llm_oauth`、`anthropic_api_key` 等 | `packages/shared/src/credentials/types.ts:19-38` | 不建议改，只是 store 内部 key，但 fork 若想完全隔离可改 |
| 应用根目录 | `~/.craft-agent/`（多处） | 见 `packages/shared/src/interceptor-common.ts:30,39` 等 | 与凭据目录同步 |
| 上游产品域名 | `thecraftagents.com` | OAuth 不依赖（除了 slack/google 共享的 `oauth-relay.ts:3`），但更新清单 `electron-builder.yml:79`、帮助链接 `apps/electron/src/shared/menu-schema.ts:302`、`branding.ts:18` 都用 | 不影响三家 OAuth，但属于品牌面 |
| OAuth 回调中转到产品域名 | `https://thecraftagents.com/auth/callback` | `packages/shared/src/auth/oauth-relay.ts:3` | **只用于 WebUI 模式的 Slack/Google/MCP 通用源**，不影响 Claude/ChatGPT/Copilot 三家 |

> 结论：**三家 OAuth 的 client_id / authorize / token / redirect URI 全部是上游已经注册好的公共值，fork 换皮一个都不需要改**。要改的只是「皮肤」：appId/productName/deep link scheme/凭据目录/UA 字符串。

---

## 每问逐答

### 1. 三家是否需要用户去平台方注册 OAuth client？

**全部不需要。** 三家都复用上游已注册的公共 client：

- **Claude Max**：用 Anthropic 自家的公共 PKCE client_id `9d1c250a-e61b-44d9-88ed-5944d1962f5e`（`packages/shared/src/auth/claude-oauth-config.ts:13`），与 Claude Code CLI 同一个。PKCE 公共客户端没有 client_secret，redirect URI 由 Anthropic 服务端登记。
- **ChatGPT**：用 OpenAI Codex CLI 的官方公共 client_id `app_EMoamEEZ73f0CkXaXp7hrann`（`packages/shared/src/auth/chatgpt-oauth-config.ts:16`），源码注释明说「This is the official Codex CLI public client ID (registered with OpenAI)」。
- **GitHub Copilot**：用 VS Code Copilot Chat 的公共 OAuth app client_id `Iv1.b507a08c87ecfe98`（`packages/shared/src/auth/github-copilot.ts:34`，base64 轻混淆）。device flow 天然适配公共 client（无 secret、无 redirect URI）。

> 用户侧什么都不用注册，打开 App 选「Connect」就完事。

### 2. callback 落在哪？localhost 还是 deep link？

三家**各不一样**，而且**都不是 `craftagents://` deep link**：

- **Claude Max**：**既非 localhost 也非 deep link**——重定向到 Anthropic 自家托管的 `https://console.anthropic.com/oauth/code/callback` 静态页面（`claude-oauth-config.ts:30`），由该页面把 code 显示给用户，用户**手抄**回 App。没有任何本机端口监听，也没有 deep link 跳回。Anthropic 后台登记的 redirect URI 就是这个 console 页面，**不可改**。
- **ChatGPT**：**localhost HTTP 回调服务器**，固定 `http://localhost:1455/auth/callback`（`chatgpt-oauth-config.ts:33,39`），Electron 在 `apps/electron/src/preload/bootstrap.ts:367-371` 通过 `createCallbackServer` 起一次性监听。OpenAI 后台登记的 redirect URI 就是这个 1455 地址（Codex CLI 注册），**不可改**。
- **GitHub Copilot**：**无 callback**——device flow 走 `https://github.com/login/device/code` + `https://github.com/login/device`，浏览器只用来让用户输 8 位码，不发生任何 HTTP 重定向回 App（`github-copilot.ts:258-364`）。

`craftagents://` deep link 在本仓库里**只用于应用内导航和 MCP/通用 OAuth 完成后跳回 session**（`apps/electron/src/main/deep-link.ts:9-34`，`packages/shared/src/auth/types.ts:71-74` 的 `buildOAuthDeeplinkUrl` 构造 `craftagents://allSessions/session/{id}`），**不参与** Claude/ChatGPT/Copilot 三家主流程的 code 接收。

### 3. 换皮（fork 改名）对 OAuth 的影响面

**对三家 OAuth 主流程：几乎零影响**，所有 client_id/authorize/token/redirect 都是上游值，不用动。

**真正需要同步改的清单**（详细见上表）：

1. **deep link scheme**：`craftagents` → 你的 scheme。涉及 `apps/electron/src/main/index.ts:199`（`DEEPLINK_SCHEME`）、`apps/electron/src/main/index.ts:227,231`（`setAsDefaultProtocolClient`）、`apps/electron/src/main/deep-link.ts:99`（protocol 字面量）、`packages/shared/src/utils/url-safety.ts`（白名单）、所有拼接 `craftagents://` 的渲染层代码（`apps/electron/src/renderer/components/app-shell/SidebarMenu.tsx:98` 等约 10 处）。
2. **Electron 品牌**：`apps/electron/electron-builder.yml:1-3` 的 `appId`/`productName`/`copyright`；`apps/electron/src/main/index.ts:220` 的 `app.setName('Craft Agents')`。
3. **凭据存储位置与加密盐**：`~/.craft-agent/credentials.enc`（`secure-storage.ts:44-45`）以及 PBKDF2 盐 `craft-agent-v1`/`craft-agent-v2`（`secure-storage.ts:326,344`）——改盐会让老用户凭据全部解密失败。
4. **User-Agent 字符串**：`CraftAgents/${APP_VERSION}` 用于 Claude token 请求（`claude-oauth.ts:223`、`claude-token.ts:32`），可选改；**GitHub Copilot 的 `GitHubCopilotChat/0.35.0` 等头不能改**（`github-copilot.ts:37-42`），否则会被 GitHub 当成非 VS Code 客户端拒绝。
5. **MCP 动态注册的 `client_name`**：`Claude Code (Craft Agent)`（`oauth.ts:29`）——不影响三家，但属于用户授权页面上看得见的字符串。
6. **凭据 key 前缀**：`claude_oauth`、`llm_oauth` 等（`credentials/types.ts:19-38`）——内部 key，可不改；改了等于清空所有用户已存的 token。
7. **三家的所有 client_id、endpoint、redirect、端口 1455、device flow URLs**：**全都不能动**，动了 OAuth 就废。

### 4. 每家从「打开设置」到「连接成功」的实际操作步骤预估

下面是从用户视角的步数估算（首次连接）：

**Claude Max**（两步流，最繁琐）
1. 打开 Settings → AI Providers（约 2 次点击）
2. 点「Add connection / Connect」选 **Claude**（1 次点击）
3. 在 credentials step 点 **Sign in with Claude** 按钮（1 次点击，`CredentialsStep.tsx:218-`）
4. 系统浏览器自动打开 `claude.ai/oauth/authorize?...`（0 次操作）
5. 在 Claude 页面登录账号（视是否已登录，0-N 步）
6. 点「Authorize」同意（1 次点击）
7. 浏览器跳到 `console.anthropic.com/oauth/code/callback`，页面显示一长串 code
8. **手动复制 code**（1 次快捷键）
9. 切回 App，**粘贴到输入框**（1 次快捷键 + 1 次点击 Continue）
10. App 完成 token 交换 → 显示 Connected

合计：~6-9 次用户操作，**需要手抄 code**，体验最弱。

**ChatGPT**（一键流）
1. Settings → AI Providers → Add → 选 **ChatGPT**（约 3 次点击）
2. 点 **Sign in with ChatGPT**（1 次点击）
3. 浏览器自动打开 `auth.openai.com/oauth/authorize?...`（0 次）
4. 在 OpenAI 页面登录 + 授权（0-N 步，已登录则直接到下一步）
5. 浏览器自动跳 `http://localhost:1455/auth/callback?...`，App 后台自动接住 code 并交换 token
6. 浏览器 tab 显示 "Authorization successful" 并 1.5s 后自动 `window.close()`（`callback-page.ts:32-38`）
7. App UI 显示 Connected

合计：~4-6 次用户操作，**无需手抄**，体验最好。

**GitHub Copilot**（device flow）
1. Settings → AI Providers → Add → 选 **GitHub Copilot**（约 3 次点击）
2. 点 **Sign in with GitHub**（1 次点击）
3. App 把 8 位 user code 自动复制到剪贴板，并自动用系统浏览器打开 `https://github.com/login/device`（`useOnboarding.ts:580-585` + `llm-connections.ts:795-802`）
4. 用户在 GitHub 页面**粘贴/输入 8 位码**（1 次粘贴 + 1 次点击 Continue）
5. GitHub 页面让用户 Authorize VS Code Copilot Chat（1 次点击）
6. App 后台轮询拿到 token，自动换 Copilot API token + 启用所有 policy-gated 模型
7. App UI 显示 Connected

合计：~6-8 次用户操作，**要输一次 8 位码**但不用跳回 App 粘贴，比 Claude 友好。

---

## 参考：通用 MCP/Slack/Google OAuth（不属于本工单三家，仅备注）

- `packages/shared/src/auth/oauth.ts` 的 `CraftOAuth` 类是老的 MCP 服务器 OAuth 流，端口 8914-8924。
- `packages/shared/src/auth/callback-server.ts` 是新的通用 callback server，端口 6477 起扫 100 个。
- `packages/shared/src/auth/oauth-relay.ts` 把 `https://thecraftagents.com/auth/callback` 作为 WebUI 模式的中转 redirect（state 用 base64url 编码 `{v,r,s}`），只在 Slack/Google/通用源走 WebUI 时启用。
- Slack / Google / Microsoft 的 client_id 走**环境变量**（`SLACK_OAUTH_CLIENT_ID`、`GOOGLE_OAUTH_CLIENT_ID`、`MICROSOFT_OAUTH_CLIENT_ID`），与 Claude/ChatGPT/Copilot 的硬编码公共 client 是两种策略。
