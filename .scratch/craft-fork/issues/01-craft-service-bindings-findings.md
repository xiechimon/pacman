# 01 Findings · Craft 服务绑定与身份引用

调查对象：`/tmp/craft-agents-oss-survey`（craft-agents-oss v0.13.3，Electron + Bun monorepo，只读）。
注：OSS 导出**不含** `workers/pages` 与 `apps/marketing`、`apps/docs-site`（根 `package.json:39` 已有缺失守卫）。

## a) 必须删

**Sentry 遥测（主 + 渲染进程，env 有值即上报）**
- `apps/electron/src/main/index.ts:9` — `import * as Sentry from '@sentry/electron/main'`
- `apps/electron/src/main/index.ts:21` — `Sentry.init({ dsn: process.env.SENTRY_ELECTRON_INGEST_URL, ... })`，`:27` enabled 开关
- `apps/electron/src/main/index.ts:72` — `Sentry.setUser({ id: machineId })` 匿名机器指纹上报
- `apps/electron/src/main/index.ts:481` / `:635` / `:1319` / `:1324` — 各处 `Sentry.captureException`
- `apps/electron/src/main/index.ts:1096`-`1100` — `Sentry.setTag` 上报 authType/provider/model/workspaceCount
- `apps/electron/src/renderer/main.tsx:3`-`5`、`:57`、`:85` — 渲染进程 Sentry 双初始化（含 captureConsoleIntegration 把 console.error 变事件）
- `apps/electron/src/preload/bootstrap.ts` — preload 侧 Sentry 引入（随主/渲染一并清）
- `apps/electron/src/renderer/components/app-shell/input/InputErrorBoundary.tsx`、`packages/ui/src/components/ui/Island.tsx`、`apps/electron/src/renderer/event-processor/useEventProcessor.ts` — UI 层 Sentry 调用点
- `apps/electron/vite.config.ts:6`-`30` — sentryVitePlugin（当前注释掉，连着注释和依赖一起删）
- `apps/webui/vite.config.ts:51`-`52` + `apps/webui/src/shims/sentry-electron.ts:1` — webui 的 Sentry shim，删依赖后可去
- 根 `package.json` 依赖：`@sentry/electron`、`@sentry/react`、`@sentry/vite-plugin`、`@sentry/cli`（trustedDependencies）

**Plausible 分析（session 分享查看器）**
- `apps/viewer/index.html:8`-`12` — 加载 `https://plausible.io/js/pa-VCOpOqeNVm6n6u1hUMMUH.js` 并 `plausible.init()`（向 Craft 的 Plausible 站点 ID 上报）

**开发者反馈工具（agent 可把反馈写给 Craft 团队）**
- `packages/session-tools-core/src/tool-defs.ts:536` — `send_developer_feedback` 工具描述："Send freeform feedback to the Craft Agent development team"
- `packages/session-tools-core/src/tool-defs.ts:683` — 工具注册（含 `handleSendDeveloperFeedback`，handler 在 `handlers/send-developer-feedback.ts`）
- `packages/session-mcp-server/src/index.ts:241`-`247` — `submitFeedback` 把反馈 JSON 写入 `{configDir}/feedback/`
- `packages/server-core/src/sessions/SessionManager.ts:532` — 工具显示名 `'Send Feedback'`
- `packages/shared/src/feature-flags.ts:35`、`:86`-`89` — `CRAFT_FEATURE_DEVELOPER_FEEDBACK` 开关（当前默认关，但代码链路整段是为 Craft 准备的）

**Craft 文档 MCP 集成（mcp.craft.do 专属校验）**
- `packages/shared/src/validation/url-validator.ts:24`-`58` — 内置 system prompt 只认 `https://mcp.craft.do/links/{id}/mcp` 的 Craft MCP URL 校验器（经 `validation/index.ts` 导出；OSS 导出中未见调用方，属死代码但指向 Craft 服务）
- `README.md:94` — "Craft MCP Integration: 32+ Craft document tools" 宣传语（文档层面同步清）

## b) 必须换

**打包身份（electron-builder）**
- `apps/electron/electron-builder.yml:1` — `appId: com.lukilabs.craft-agent`（bundle id；`TRADEMARK.md:45` 明确要求 fork 改掉）
- `apps/electron/electron-builder.yml:2` — `productName: Craft Agents`；`:3` copyright Craft Docs Ltd.
- `apps/electron/electron-builder.yml:129`/`:137`/`:162`/`:205` — `artifactName: "Craft-Agents-${arch}..."`；`:143` dmg `title: "Craft Agents"`；`:200` linux maintainer `Craft Docs Ltd. <support@craft.do>`
- `apps/electron/scripts/afterPack.cjs:29` — 硬编码 `'Craft Agents.app'` 路径
- `scripts/build/darwin.ts:66` — 硬编码 `release/.../Craft Agents.app`

**运行时应用名 / scheme**
- `apps/electron/src/main/index.ts:220` — `app.setName(process.env.CRAFT_APP_NAME || 'Craft Agents')`（macOS 菜单栏、缓存目录名都源自它）
- `apps/electron/src/main/index.ts:199` — `const DEEPLINK_SCHEME = ... || 'craftagents'`；`:227`/`:231` `setAsDefaultProtocolClient`；`:280` `open-url` 处理
- `apps/electron/src/main/deep-link.ts:4`-`34` — 整个文件解析 `craftagents://` URL（scheme 改名需同步）
- `apps/electron/src/main/handlers/workspace.ts:108` — 拼 `craftagents://allSessions/session/${id}` 链接
- `apps/electron/src/main/handlers/system.ts:205`-`214` — openUrl 对 `craftagents://` 的内部拦截

**配置/数据目录 `~/.craft-agent`**
- `packages/shared/src/config/paths.ts:19` — `export const CONFIG_DIR = process.env.CRAFT_CONFIG_DIR || join(homedir(), '.craft-agent')`（总入口）
- 绕过总入口的硬编码点：`apps/electron/src/main/window-state.ts:32`、`apps/electron/src/main/logger.ts:84`、`:213`、`apps/electron/src/main/index.ts:670`、`packages/server/src/index.ts:214`、`packages/server-core/src/handlers/rpc/auth.ts:62`、`packages/server-core/src/handlers/rpc/workspace.ts:63`、`packages/server-core/src/services/privileged-execution-broker.ts:25`、`packages/session-tools-core/src/handlers/config-validate.ts:38`
- 安装/部署侧：`scripts/install-app.sh:6`、`:318`、`:347`，`Dockerfile.server:96`
- 用户可见文档字符串：`packages/session-tools-core/src/tool-defs.ts:250`、`:573` 等工具描述里直接写 `~/.craft-agent/docs/...`（agent 会读到，需一并换）

**User-Agent**
- `packages/shared/src/auth/claude-oauth.ts:223` 与 `packages/shared/src/auth/claude-token.ts:32` — 向 Anthropic OAuth 端点发送 `User-Agent: CraftAgents/${APP_VERSION}`
- `packages/pi-agent-server/src/tools/web-fetch.ts:362` — `User-Agent: Mozilla/5.0 (compatible; CraftAgent/1.0)`
- `packages/shared/src/utils/icon.ts:143` — favicon 抓取 `User-Agent: Craft-Agent/1.0`

**协议身份字符串（MCP clientInfo / serverInfo）**
- `packages/shared/src/mcp/client.ts:91` — MCP 客户端 `name: 'craft-agent'`（连所有用户 MCP server 时自报家门）
- `packages/shared/src/mcp/pool-server.ts:109` — `'craft-pool-proxy'`；`packages/shared/src/mcp/api-source-pool-client.ts:20` — `'craft-pool-api-source'`；`packages/shared/src/mcp/validation.ts:412` — `'craft-agent-validator'`
- `packages/session-mcp-server/src/index.ts:444` — 内置 session MCP server `name: 'craft-agent-session'`
- `apps/electron/resources/bridge-mcp-server/index.js:18239` — 打包产物内 `name: "craft-agent-api-bridge"`（由构建生成，改源头后重新打包）

**workspace 包名（12 个）**
- `packages/{core,shared,server,server-core,session-tools-core,session-mcp-server,pi-agent-server,messaging-gateway,messaging-whatsapp-worker,ui}/package.json:2` 与 `apps/{cli,electron,viewer,webui}/package.json:2` — 全部 `@craft-agent/*`，源码里 import specifier（如 `packages/session-mcp-server/src/index.ts:33` 的 `@craft-agent/shared/feature-flags`）全网跟随

**UI/文档品牌字符串**
- `apps/electron/src/renderer/index.html:7` — `<title>Craft Agents</title>`
- `apps/webui/src/public/manifest.json:2`-`3` — PWA `name`/`short_name: "Craft Agents"`
- `apps/viewer/index.html:6`-`7` — meta description + `<title>Craft Agents Session Viewer</title>`
- `apps/electron/src/main/menu.ts:82` — macOS 应用菜单 `label: 'Craft Agents'`；`:237` 帮助菜单打开 `https://thecraftagents.com/docs`
- `apps/electron/src/shared/menu-schema.ts:302` — 菜单 schema 里的 docs URL
- `packages/shared/src/i18n/locales/en.json` — 17 处 "Craft Agents" / 29 处 "Craft"（de/es/hu/ja/pl/zh-Hans 六个 locale 同步）
- Pi 后端显示名：`packages/shared/src/agent/pi-agent.ts:166` `backendName = 'Craft Agents Backend'`；`apps/electron/src/renderer/lib/provider-icons.ts:58`-`59`；`packages/server-core/src/domain/connection-setup-logic.ts:163`；`apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx:251` 等

**作者/分发元数据**
- `apps/electron/package.json:8`-`11` — author Craft Docs Ltd. / support@craft.do / homepage thecraftagents.com
- `packages/server/package.json:17`-`21` — 同上
- `Dockerfile.server:28`-`29` — OCI label 指向 `github.com/lukilabs/craft-agents-oss`；`:44`-`45` 容器用户 `craftagents`

**环境变量前缀 `CRAFT_`（组级，可选但建议统一）**
- `packages/shared/src/feature-flags.ts:35`/`:46`/`:57`/`:74` — `CRAFT_FEATURE_*` 系列；`packages/shared/src/config/paths.ts:19` `CRAFT_CONFIG_DIR`；`apps/electron/src/main/index.ts:199` `CRAFT_DEEPLINK_SCHEME`、`:220` `CRAFT_APP_NAME`；`scripts/electron-dev.ts:91`、`:288` 注入同名变量

**内部命名（低优先）**
- `packages/shared/src/auth/oauth.ts` — 类名 `CraftOAuth`（在 `packages/shared/src/sources/credential-manager.ts:29`、`:651`、`:1236` 被引用，纯内部标识）

## c) 可选断开

**自动更新（electron-updater → Craft 的 R2/S3）**
- `apps/electron/electron-builder.yml:78`-`80` — `publish: { provider: generic, url: https://thecraftagents.com/electron/latest }`（不改就会去 Craft 服务器拉更新清单）
- `apps/electron/src/main/auto-update.ts:5` — 整个模块基于上面的 feed；`apps/electron/src/main/menu.ts:75` 附近菜单项触发 `checkForUpdates`

**Pages 分享（Cloudflare 发布）**
- `packages/shared/src/pages/publisher.ts:35` — `DEFAULT_PAGES_SHARE_API_BASE_URL = 'https://thecraftagents.com/p/api'`（发布/更新/删除都打到 Craft 的 Worker；`:44` 支持 `CRAFT_PAGES_SHARE_API_URL` 覆盖）
- `packages/shared/src/feature-flags.ts:74` — `CRAFT_FEATURE_PAGES_SHARING` 默认 ON，`=0` 可关（最省事的断法）
- `packages/server-core/src/handlers/rpc/pages.ts:364` — 服务端分享开关；`apps/electron/src/renderer/components/pages/SharePageDialog.tsx:32` — 分享 UI（`apps/electron/src/renderer/pages/ChatPage.tsx:586`、`:600` 有分享文档链接）

**Session 分享查看器站点**
- `apps/viewer/` 整个 app — 部署在 thecraftagents.com/s/ 的会话 transcript 查看器（`apps/viewer/public/_redirects:7` 依赖 Cloudflare Pages functions）；README `:36`、`:53` 的分享样例链接指向它

**安装脚本 / Slack OAuth 中继**
- `scripts/install-app.sh:5` — `VERSIONS_URL="https://thecraftagents.com/electron"`；`scripts/install-app.ps1:7` 同
- `packages/shared/src/auth/slack-oauth.ts:269`、`:360` — Slack OAuth 走 `https://thecraftagents.com/auth/slack/callback` Cloudflare 中继（Slack 强制 HTTPS redirect；fork 需自建中继或改流程）

**文档外链**
- `apps/electron/src/main/menu.ts:237`、`apps/electron/src/shared/menu-schema.ts:302`、`README.md:71`/`:76`/`:434`/`:554` — thecraftagents.com 文档/安装/回调链接

**OSS 导出残缺（顺手修）**
- `Dockerfile.server:63`-`64`、`:71`-`72` — COPY 不存在的 `packages/craft-agents-commands`、`packages/craft-cli`、`apps/marketing`、`apps/docs-site`，docker build 必失败

## d) 可保留

- **Anthropic/Claude OAuth 配置**：`packages/shared/src/auth/claude-oauth-config.ts:13`-`38` 的 public client_id、`claude.ai`/`platform.claude.com` 端点是 Anthropic 公共资产，非 Craft 绑定（只需换 UA 字符串，见 b）
- **GitHub Copilot 伪装 UA**：`packages/shared/src/auth/github-copilot.ts:38` 等 `GitHubCopilotChat/0.35.0` 是模拟 GitHub 官方客户端，改掉反而坏兼容性
- **`packages/shared/src/unified-network-interceptor.ts`**：纯本地 fetch patch（给 SDK 子进程注入 schema/捕获错误），数据不出本机
- **release-notes 机制**：`packages/shared/src/release-notes/index.ts:42`-`48` 只读 bundled 文件同步到配置目录，无远程抓取（目录名随 CONFIG_DIR 改即可）
- **主体功能代码**：agent 后端（pi/claude/codex）、MCP 客户端框架、credential vault、messaging gateway、UI 组件库、i18n 框架、browser 工具等，均无私有服务端点

## Top touchpoints

1. **`apps/electron/electron-builder.yml:1`-`3` + `:79`** — appId/productName/版权/更新 feed 一处定生死：bundle id 决定 macOS 钥匙串、Squirrel 更新、协议注册的实际落点
2. **`apps/electron/src/main/index.ts:21` + `:199` + `:220`** — 单文件三连：Sentry.init（删掉）、DEEPLINK_SCHEME（换掉）、app.setName（换掉），rebrand 第一天就要动
3. **`packages/shared/src/config/paths.ts:19`** — `~/.craft-agent` 总入口；但另有 ~9 处绕过它的硬编码 `join(homedir(), '.craft-agent')`（见 b 列表），漏一个就出现两个配置目录并存
4. **`@craft-agent/*` 包名全网重命名** — 12 个 package.json + 全仓 import specifier，体量最大但纯机械
5. **`packages/shared/src/pages/publisher.ts:35` + `apps/viewer/index.html:8`** — 分享发布 API 与查看器 Plausible：不处理就持续向 Craft 服务器发数据
