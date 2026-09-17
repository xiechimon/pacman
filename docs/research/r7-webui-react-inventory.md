# R7 · nanobot WebUI (React) 功能级清单

> 目的：为 pacman「WebUI feature parity」设计票提供上游功能地图。
> 上游根目录：`/Users/xmon/Code/AgentProjects/nanobot/webui`（只读研究，未改动）。
> 方法：功能地图级（package.json → 路由/屏幕 → 组件目录逐层）。每条事实标注文件/目录路径；未直接读到、靠签名或调用点推断的标「推断」。约 300 个 TS/TSX 文件（`find src -type f`）。

---

## 1. 技术栈与依赖

来源：`webui/package.json`、`webui/vite.config.ts`、`webui/components.json`。

| 维度 | 选型 | 依据 |
|---|---|---|
| 框架 | React 18.3 + react-dom 18.3（`createRoot`） | `package.json` deps；`src/main.tsx` |
| 语言/构建 | TypeScript 5.7 + Vite 5.4（`@vitejs/plugin-react`） | `package.json`；`vite.config.ts` |
| **路由** | **无路由库**。自研 hash 路由 + `history.pushState/replaceState` | `package.json`（无 react-router 等）；`src/App.tsx` `readShellRoute/writeShellRoute/shellRouteHash` |
| **状态管理** | **无 zustand/redux/mobx**。React Context + hooks + `useState`；单一 `ClientProvider` | `package.json`；`src/providers/ClientProvider.tsx`（唯一 provider 文件） |
| UI 原语 | Radix UI（alert-dialog / dialog / dropdown-menu / popover / select / slot / tooltip）+ shadcn/ui（new-york 风格，neutral base，CSS 变量） | `package.json`；`components.json` |
| 样式 | Tailwind CSS 3.4 + `tailwindcss-animate` + `@tailwindcss/typography`；`class-variance-authority`/`clsx`/`tailwind-merge` | `package.json`；`src/globals.css`；`tailwind.config.js` |
| 图标 | `lucide-react` | `package.json` |
| **Markdown/流式** | **`streamdown` 2.5.0**（核心流式 MD 渲染）+ `remark-gfm` / `remark-math` / `remark-breaks` + `rehype-katex` + `katex` + 自研 `remark-tex-math` | `package.json`；`src/components/MarkdownTextRenderer.tsx`；`src/lib/remark-tex-math.ts` |
| 代码高亮 | `react-syntax-highlighter` 15.6（prism-async-light，懒加载） | `package.json`；`src/components/CodeBlock.tsx` |
| Diff | `diff` 9.0（`parsePatch` 解析 unified diff） | `package.json`；`src/lib/file-diff.ts`；`src/components/thread/activity/DiffSyntaxHighlight.tsx` |
| i18n | `i18next` 26 + `react-i18next` 17（详见 §5） | `package.json`；`src/i18n/*` |
| 二维码 | `qrcode` 1.5（channel 连接扫码） | `package.json`；`src/components/settings/channels/ChannelQrConnectFlow.tsx` |
| **WebSocket** | **无 ws 库**，用原生 `WebSocket`（native 宿主下走 `HostWebSocket` 桥接） | `src/lib/nanobot-client.ts`；`src/lib/runtime.ts` |
| Markdown 微依赖 | `micromark-factory-space` | `package.json` |
| 测试 | Vitest 2.1 + `@testing-library/react` + `happy-dom`；覆盖率阈值 statements/lines 85%、branches/functions 80% | `package.json`；`vite.config.ts` `test`；`src/tests/*`（~95 个测试文件） |
| Lint | ESLint 10 + `typescript-eslint` + `eslint-plugin-react-hooks` | `package.json` scripts |

**构建产物与分包（`vite.config.ts`）**：输出到 `../nanobot/web/dist`（打进 Python 包，由 gateway 提供）；`manualChunks` 强制把 `react-vendor / markdown-vendor / markdown-code / markdown-diagrams（streamdown mermaid）/ syntax-highlight / katex / markdown-math / locale-*` 拆成独立 chunk；`guardWebuiEntryChunk` 插件在 entry 静态引入这些懒加载 chunk 时直接 build 失败；`gzipWebuiAssets` 产出 `.gz`。dev server 代理 `/webui`、`/api`、`/auth` → `http://127.0.0.1:8765`（gateway）。

**PWA（`webui/public/manifest.json`、`webui/public/sw.js`、`src/main.tsx`）**：`display: standalone`、可安装、含 maskable 图标；`main.tsx` 注册 `/sw.js`（`updateViaCache:"none"`，失败静默）；SW 预缓存 `/`、`manifest.json`、`asset-manifest.json`，静态资源 network-first，favicon（favicon.im / duckduckgo / google s2）cache-first 且上限 128 条（`ICON_CACHE_LIMIT`）。`index.html` 内联脚本在 app 启动前应用主题（防 FOUC）并本地化 boot splash 文案 + `<html lang>` + meta description。

---

## 2. 屏幕/路由清单

**无路由库**：视图切换 = `ShellView` 状态 + hash 同步（`src/App.tsx`）。

- `ShellView = "chat" | "settings" | "apps" | "automations" | "skills" | "channels"`（`App.tsx` 类型定义）。
- 路由读写：`readShellRoute()` 解析 `window.location.hash`，`writeShellRoute()` 用 `pushState/replaceState` 写回，`shellRouteHash()` 生成 hash；监听 `hashchange`/`popstate`（`App.tsx` `useEffect`）。
- **启动引导状态机 `BootState`**（`App.tsx`）：`loading`（连接动画）→ `auth`（密码表单 `AuthForm`）→ `error`（网关不可达）→ `ready`（渲染 `ClientProvider`+`Shell`）。
- **鉴权**：`fetchBootstrap` GET `/webui/bootstrap`，401/403 → `AuthForm` 输密码（header `X-Nanobot-Auth`）；密码存 localStorage（`loadSavedSecret/saveSecret/clearSavedSecret`），支持 URL `?bootstrapSecret=` 一次性注入（`consumeUrlBootstrapSecret`）；token 到期前 30s 自动刷新（`tokenRefreshDelayMs`）；登出 `handleLogout` 清密码关连接。帮助折叠面板指向 `~/.nanobot/config.json` 的 `channels.websocket.tokenIssueSecret`（`src/lib/bootstrap.ts`）。

| Hash 路由 | 视图 | 功能点 | 依据 |
|---|---|---|---|
| `#/` `#/new` | chat（空） | 新建会话欢迎页（hero composer、随机问候、工作区/项目选择、临时聊天开关） | `App.tsx` `defaultShellRoute`；`ThreadShell` hero variant |
| `#/chat/<key>` | chat | 打开某会话（key 形如 `websocket:<chatId>`） | `App.tsx` `readShellRoute` |
| `#/temporary/<chatId>` | chat（临时） | 非持久「临时聊天」，断线即弃（`client.discardTemporaryChat`） | `App.tsx`；`src/lib/temporary-chat.ts` |
| `#/settings?section=<k>` | settings | 设置页，section ∈ 15 个键（见 §3.6） | `App.tsx` `SETTINGS_SECTION_KEYS` |
| `#/apps` | apps | CLI Apps / 应用目录（settings 的 apps 分节独立成顶视图） | `App.tsx` `shellViewForSettingsSection` |
| `#/automations` | automations | 自动化（定时/触发任务）日历与列表 | 同上 |
| `#/channels` | channels | 渠道（Telegram/WhatsApp…）配置 | 同上 |
| `#/skills` | skills | 技能目录 + 市场 | 同上 |

- `settings`/`apps`/`automations`/`skills`/`channels` 共用 `SettingsView`（`App.tsx` 渲染），仅 `showSidebar`/`initialSection` 不同；apps/automations/skills/channels 是 settings 的分节被提升为顶层 `ShellView`。
- **重启路由恢复**：`/restart` 或 native engine 重启前用 `rememberRestartRoute()` 存 hash，重启后 `maybeRestoreRestartHash()` 在 5min TTL 内恢复（`App.tsx` `RESTART_*`）。
- **全局快捷键**（`src/lib/sidebar-shortcuts.ts`，Cmd/Ctrl）：New chat `⇧O`、Search `K`、Apps `⇧1`、Skills `⇧2`、Automations `⇧3`、Channels `⇧4`、Settings `,`；Apple 平台检测显示 `⌘` 符号（`App.tsx` keydown 监听）。
- **配对弹窗**（`PairingCodePopup`，`App.tsx`）：非路由的悬浮层，轮询 `fetchPairingRequests` 显示待配对聊天用户，8 位码自动匹配 → `runPairingAction(approve/deny)`；可见 5s/空闲 15s 轮询、30s snooze。
- **document.title** 随视图/会话标题动态设置（`App.tsx` `useEffect`）。

---

## 3. 组件层次概要

```
App (BootState 引导/鉴权/token 刷新/配对弹窗/重启)          src/App.tsx
└─ ClientProvider (client/token/modelName/ingressLimits)    src/providers/ClientProvider.tsx
   └─ ThemeProvider (light/dark)                            src/hooks/useTheme.ts
      └─ Shell (hash 路由、sessions、workbench、sidebar 状态、workspace scope)
         ├─ HostChrome (native 桌面宿主拖拽条, 条件渲染)      src/lib/runtime.ts
         ├─ Sidebar (桌面流式布局) / Sheet(移动端抽屉)         src/components/Sidebar.tsx, ui/sheet.tsx
         │  └─ ChatList (会话分组/多选/拖拽/右键菜单)          src/components/ChatList.tsx
         ├─ 主区 main
         │  ├─ PaneWorkbench (多窗格) → renderPane → ThreadShell   src/components/workbench/*
         │  │  └─ ThreadShell                                     src/components/thread/ThreadShell.tsx
         │  │     ├─ ThreadHeader (+ SessionInfoPopover / PromptNavigator / ModelPresetBadge / theme)
         │  │     ├─ ThreadViewport → ThreadMessages
         │  │     │   ├─ MessageBubble (user/assistant/trace/compaction/session-message)
         │  │     │   │   └─ MarkdownText→MarkdownTextRenderer(streamdown), CodeBlock, AttachmentTile, ImageLightbox
         │  │     │   └─ AgentActivityCluster → activity/* (FileEditRow/DiffPair, GenericToolRun, WebSearchRun, ReasoningRow…)
         │  │     ├─ ThreadComposer (+ ModelPresetBadge, ComposerUsagePopover, WorkspaceControls, 附件/语音/slash/mention)
         │  │     └─ RecoveryNotice / StreamErrorNotice / ContextCompactionNotice / FilePreviewPanel
         │  └─ SettingsView (view≠chat 时)                       src/components/settings/*
         │     └─ SettingsPage → SettingsSidebar + 分节组件
         ├─ SessionSearchDialog (Cmd+K)                          src/components/SessionSearchDialog.tsx
         ├─ DeleteConfirm / RenameChatDialog (懒加载)            src/components/DeleteConfirm.tsx, RenameChatDialog.tsx
         └─ PairingCodePopup                                     src/App.tsx
```

### 3.1 状态管理方式
- **Context**：仅 `ClientProvider`（`useClient()` 暴露 `client/token/getToken/modelName/ingressLimits`，`src/providers/ClientProvider.tsx`）+ `ThemeContext`（`src/hooks/useTheme.ts`）+ `ThreadVisibilityContext`（`src/hooks/useThreadVisibility.ts`）+ `FilePreviewAvailabilityContext`（`src/components/FilePreviewAvailabilityContext.tsx`）。无全局 store 库。
- **服务端状态**：会话/历史/sidebar 状态通过 hooks 拉 REST + 订阅 WS，本地 `useState` 持有；跨设备同步的偏好（pin/archive/排序/标题覆盖/workbench 布局）持久化到**服务端**（见 §4）。纯本地偏好（主题/语言/activity 展开模式/代码换行/品牌 logo/浏览器通知/文件编辑显示模式）存 localStorage（`src/lib/local-preferences.ts`，key `nanobot-webui.settings-preferences`）。

### 3.2 Hooks 清单（`src/hooks/`，逐个角色）
| Hook | 角色 |
|---|---|
| `useNanobotStream` | 核心流式状态机：订阅 `client.onChat(chatId)`，把 WS 事件投影成 `UIMessage[]`；暴露 `messages/isStreaming/runStartedAt/retryStatus/goalState/recoveryState/send/stop/transcribeAudio/streamError/reconcileTurnComplete`；delta 缓冲 + rAF/timeout flush |
| `useSessions` | 会话列表 CRUD：`listSessions` 拉取、乐观插入、`createChat/forkChat/deleteChat/getSessionAutomations` |
| `useSessionHistory` | （在 `useSessions.ts`）单会话历史分页：`fetchWebuiThread` + `webuiThreadCache`（stale-while-revalidate）、`loadOlder`、`hasMoreBefore`、`completedTurnIds`、`activeTurnId`、`forkBoundaryMessageCount` |
| `useSidebarState` | sidebar 状态（pin/archive/order/title/tags/workbench/view）拉取+防抖持久化到服务端（`fetchSidebarState`/`set_sidebar_state`），并订阅 `sidebar_state_updated` |
| `useTheme` / `useThemeValue` | light/dark 主题（localStorage + `prefers-color-scheme` 默认），`.dark` class + theme-color meta |
| `useAttachedImages` | 附件状态机（encoding/ready/error）、图片/文档编码、限制校验（详见 §3.5） |
| `useClipboardAndDrop` | 粘贴/拖拽文件接入（忽略 HTML 片段防 XSS，dragDepth refcount） |
| `useComposerMentionInput` | composer 文本编辑 + @mention 原子化 + 自实现 undo/redo（历史上限 100） |
| `useVoiceRecorder` | MediaRecorder 录音 + 波形 + WAV 转换（详见 §3.5） |
| `useComposerMentionInput`/`useDeferredTitleRefresh` | 回合结束后延迟刷新会话标题 |
| `useSkills` | 拉取已启用技能列表（供 `$skill` palette） |
| `useSessionAutomationJobs` | 懒加载某会话的 automation jobs（SessionInfoPopover 打开时） |
| `usePageVisibility` / `useThreadVisibility` / `useMediaQuery` | 页面/thread 可见性、媒体查询（驱动轮询、流式 flush、移动端 workbench 关闭） |
| `useSidebarState`/`useFileEditDisplayMode` | 文件编辑显示模式本地偏好（summary/diff/collapsed_diff） |
| `useLogoFallback` | 品牌 logo 加载失败降级到首字母/图标 |

### 3.3 Thread / 消息渲染（`src/components/thread/`, `MessageBubble.tsx`, `MarkdownText*.tsx`, `CodeBlock.tsx`）
- **ThreadShell**（`ThreadShell.tsx`，1775 行）：组合 header/viewport/composer/notices/file-preview；协调「canonical 历史（REST 快照）vs live WS」竞态（`preservesDurableMessages`/两阶段 hydrate-commit/`reconcileCanonicalCompletion`）；切会话走 `ThreadMessageCache`；trace 详情懒加载 `fetchWebuiThreadTraceDetail`；model preset 切换发 `/model <name>` 系统命令；计算 composer usage（context tokens + 最近 8 轮 round usage）。
- **消息模型 `UIMessage`**（`src/lib/types.ts`）：`role` user/assistant/tool/system；`kind` message/trace/compaction；字段含 `isStreaming`、`reasoning`/`reasoningStreaming`、`traces[]`、`toolEvents[]`、`fileEdits[]`、`traceDetail{ref,bytes,traceCount}`、`images[]`/`media[]`、`cliApps[]`/`mcpPresets[]`/`sessionMentions[]`、`usage`/`roundUsages[]`/`contextWindowTokens`/`latencyMs`、`turnId/turnPhase/turnSeq`、`deliveryStatus`(sending/accepted/failed)/`deliveryErrorKind`、`compaction`、`source`(cron/trigger)、`sessionMessage`（跨会话来消息）。
- **MessageBubble**（`MessageBubble.tsx`，987 行）：
  - user：右对齐气泡、图片缩略图、引用上下文（`parseQuotedUserMessage`→blockquote）、slash 前缀高亮、`@mention`/`$skill` token 渲染、临时聊天虚线样式、deliveryStatus（sending 时钟 / failed 告警 + tooltip：message_too_big / workspace_scope_rejected / turn_rejected）、时间戳 + 复制。
  - assistant：文档式 prose（非气泡）、reasoning 先渲染 `ReasoningRow`、streaming 无内容显示 "Thinking…" sheen、`MarkdownText` 流式渲染、media、footer（复制 + **fork from here** + 完成时间戳 + automation 触发标签）。
  - trace：折叠工具面包屑组（计数、懒展开）；compaction：`ContextCompactionNotice`；session-message：左侧色条 + `@handle`。
- **Markdown**（`MarkdownText.tsx` 懒加载壳 + error boundary → `MarkdownTextRenderer.tsx`）：核心 **streamdown**（streaming/static 模式、`parseIncompleteMarkdown`）；插件链 remarkBreaks/remarkGfm/remarkMath(single-dollar off)/自研 `remark-tex-math`/自研 CJK 粗体边界修复/自研安全 HTML 子集（仅 mark/sub/sup/details/summary）；KaTeX 按需懒加载（含 `$`/`\[` 才 import）；URL 白名单（https?/mailto/xmpp/ircs + 相对）；`#session/`、`#/chat/` 链接→会话内跳转；文件路径→`FileReferenceChip`（可开预览）；引用列表项→favicon 链接预览行；表格可滚动；task-list 只读勾选。
- **CodeBlock**（`CodeBlock.tsx`）：懒加载 react-syntax-highlighter（prism-async-light，oneDark/oneLight 随主题）；ANSI 着色（`src/lib/ansi.ts`）；语言归一（`src/lib/code-language.ts`）；复制按钮、可选行号、可选换行；`chrome="none"` 变体供预览面板。
- **图片/附件**：`AttachmentTile`（image/video/file 三态）、`ImageLightbox`（←/→/Home/End、循环、预解码、reduced-motion）。

### 3.4 Activity / 工具调用渲染（`src/components/thread/activity/`）
- **聚类**（`src/lib/activity-timeline.ts`）：以 user 消息切 turn，按 `turnSeq` 稳定排序；连续 activity 行（trace/reasoning-only/`activityKind==="model"`）合并成一个 activity unit；连续 answer 切片合并。
- **AgentActivityCluster**（`AgentActivityCluster.tsx`）：折叠壳显示状态文案——retryStatus（exhausted/waiting + 倒计时 + 尝试次数）、streaming "Working for Ns"（每秒 tick）、完成 "Worked for Ns"；streaming 自动展开，用户手动后以其为准，完成 300ms 后收起；`traceDetail.ref` 懒加载（失败可 Retry）。
- **行类型**：`FileEditRow`（Edited/Editing/Could not edit/Deleted + `FileReferenceChip` + `DiffPair` +N/−M）→ `FileUnifiedDiff`（`diff` 解析、>160 行折叠、hunk gap、"Open file"）；`DiffSyntaxHighlight`（双行号 old/new、增删绿红底、懒加载高亮）；`GenericToolRun`（content-search/file-search/list/read/memory 家族合并）；`WebSearchRun`（"Searched {scope}·{query}" + 最多 8 条来源 favicon 行）；`WebActivityRow`（favicon + host/path，URL 剥凭据/拒私网）；`ReasoningRow`（压缩单行预览、>512 截断、streaming 旋转/完成绿勾）；`CliRunRow`（品牌 logo + redact 命令）；`McpRunRow`（navigate/click/type 等翻译文案）。
- **文本安全**（`activity/activity-text.ts`）：`redactActivityText`（API key/token/Bearer/sk-/ghp_/AKIA）、`compactActivityPath`（/Users/x→~）、`truncateMiddle`。

### 3.5 Composer（`src/components/thread/ThreadComposer.tsx`，3329 行；详见 §6）
多行自动增高 textarea（上限 260px）、Enter 提交/Shift+Enter 换行/IME 感知、自实现 undo/redo；**两套 palette**：`/` slash 命令（`GET /api/commands`，5 种 lifecycle）与 `$` skill；`@` mention（session/cli-app/mcp 三类，无 @file）；附件（文件选择/粘贴/拖拽，图片+文档白名单，image worker 归一化 ≤6MB，最多 4 个/单 6MB/总 24MB，受 `ingressLimits` 覆盖）；语音（MediaRecorder + 波形 + Ctrl+Shift+D + WS `transcribe_audio`）；模型 preset 选择；流式中「排队提示」（queued guidance，可编辑/删除/拖拽重排/回合结束自动 flush）；引用回复（`> [!QUOTE]`）；stop/abort；乐观消息 + 字节超限内联报错；移动端 16px 防缩放 + bottom sheet。

### 3.6 Settings 面板（`src/components/settings/`）
- **结构**：`SettingsView`（薄壳）→ `useSettingsController`（状态中枢）→ `SettingsPage`（`SettingsSidebar` 导航 + 分节 switch）。桌面侧栏 7 项：overview / appearance / models / capabilities / runtime(显示名 "System") / advanced / about + 底部 Restart（`requires_restart` 时橙色 pending）+ Logout；`<1024px` 切 `MobileSettingsNavigation` 下拉（`SettingsSidebar.tsx`）。`isCapabilitySection()` 把 image/voice/browser/memory 折叠进 capabilities 页渲染（`SettingsPage.tsx`）；apps/automations/skills/channels 是**独立全屏 shell view**（`showSidebar=false`，自带返回 + 大标题）。
- **控制器**（`useSettingsController.ts`）：挂载即 `fetchSettings`（GET `/api/settings`）；`applyPayload()` 统一落 settings + 从 payload 重建各表单 draft（agent/image/transcription/networkSafety/webSearch，可 `preserveAgentForm/preserveCapabilityForms`）；`pendingRestartSections` 来自 `restart_required_sections`(runtime|browser|image)。overview 激活且页面可见时**每 5s 轮询** `/api/settings/usage` 合并（`useSettingsController.ts`）。
- **重启**：`restartViaSettingsSurface` — native surface 且 `can_restart_engine` → `onNativeEngineRestart()` 取新 token 后重拉 settings；否则 `onRestart()`（发 `/restart`）。保存后 `maybeRestartHostEngine()` 在 requires_restart 时自动重启 native 引擎。
- **exit guard**（`contracts.ts` `SettingsExitGuard`）：`requires_restart` 且未重启时拦截离开 → Dialog（"稍后"/"立即重启"），经 `registerExitGuard` 注册给宿主。
- **自动保存**（`shared/useAutoSave.ts`）：draft JSON 签名变化 + dirty 时 **600ms debounce** 触发一次；同签名只尝试一次（失败等下次编辑）；`enabled` 门控（如 image 需 provider 已配置、web 需 olostep 已装）。runtime_config 组粒度保存（toggle 类 0ms、文本 600ms；含 manual 字段 dirty 时转手动 Save）。
- **传输**：所有 mutation 走 WS `requestMutation(action,payload)`→`webui_request`（断线重放，默认 20s / 安装类 150s）；REST 读用 `request()` Bearer（`src/lib/api.ts`）。
- 15 个 section（`App.tsx`/`contracts.ts`）→ 组件（`SettingsPage.tsx` switch）：

| section | 组件 | 主要功能 |
|---|---|---|
| overview | `overview/OverviewSettings` | 概览（token 用量卡 `TokenUsageCard`/`TokenUsageDetails`/`TokenUsageModelTrend`） |
| about | `AboutSettings` | 版本（`settings.version.current`）、文档链接 |
| appearance | `AppearanceSettings` | 主题（light/dark）、density、show previews/timestamps、代码换行、品牌 logo、浏览器通知等本地偏好 |
| models | `models/ModelsSettings`+`ProviderSettings` | 模型 preset CRUD、call order、provider（api_key/oauth）、temperature/maxTokens/contextWindow/reasoningEffort |
| capabilities | `capabilities/*` + 运行时开关 | image gen / web / dream(memory consolidation) 总开关 |
| image | `capabilities/ImageGenerationSettings` | provider/model/aspect ratio/size/max images/save dir |
| voice | `capabilities/TranscriptionSettings` | STT provider/model/language/max duration/max upload |
| browser | `capabilities/WebSettings`+`RuntimeConfigSettings` | web search provider/max_results/timeout、proxy、user_agent、jina reader、远程浏览器访问 |
| channels | `system/ChannelsSettings`+`channels/*` | 见 §4 channel-plugins |
| apps | `system/AppsSettings` | CLI apps 目录（install/update/uninstall/test/oauth） |
| automations | `system/AutomationsSettings`+`AutomationCalendar`/`RunAtPicker`/`RunDialog` | cron/local_trigger 任务，enable/disable/delete/run、日历视图 |
| memory | `RuntimeConfigSettings`(memory 组) | 记忆/dream 相关运行时字段 |
| skills | `SkillsCatalogSettings`+`SkillsMarketplace` | 目录（enable/disable/delete）+ 市场（search/trending/install） |
| runtime | `system/RuntimeSettings`+`RuntimeConfigSettings` | gateway host/port、heartbeat、config/workspace path、unified_session、重启 |
| advanced | `capabilities/SecuritySettings`(`AdvancedSettings`) | workspace sandbox、SSRF 白名单、本地服务访问、private service protection、MCP 数量、exec sandbox |

- **分节关键细节**（组件级，来自 `settings/*` 逐文件研读）：
  - **Overview**：`TokenUsageCard` = 30 天（按 agent 时区对齐）堆叠柱状图，每柱 5 段（cached input / cache miss / cache 状态未知 / output / other），tooltip 含当日 tokens/requests/cache 命中率；底部「按来源」百分比（user(Chat)/api/cron(Automations)/dream(Memory)/system(Auxiliary)）。`TokenUsageDetails` 弹窗（30d total/requests/cache 命中率）+ `TokenUsageModelTrend`（Top5 模型 + Other 的 30 天堆叠 + per-model 命中率）。下方 AI/Capabilities 快捷行跳转 models/browser/image/voice。
  - **Models**（`models/ModelsSettings.tsx`）：preset 列表按 `model_call_order` 排序，行内 provider icon + Primary 徽章 + 拖拽重排（pointer + ArrowUp/Down）+ enable/disable（最少留 1）；preset 编辑 Dialog：name（唯一校验，服务端 409→`presetNameDuplicate`）、provider、model（`ModelIdPicker`）、Advanced（maxTokens / temperature 0–2 / contextWindow SegmentedControl 64K·200K·256K·500K·1M / reasoningEffort）；legacy「Convert to presets」迁移。
  - **Providers**（`models/ProviderSettings.tsx`）：API-key 型（apiKey 显隐/已存 hint/编辑、apiBase、custom displayName）+ OAuth 型（Sign in/out，`ProviderOAuthLoginDialog` 粘贴 callback URL/code + 1s 轮询 complete）；Advanced（api_type auto/chat_completions/responses、thinking_style、proxy、region、AWS profile、extra_headers/body/query 用 JSON 弹窗）；`ProviderRequestOptions`（codex Fast mode、openai web search、deepseek web search、grok X search）；bedrock/azure 保存前先 `feature.enable`；创建自定义 provider。`ModelIdPicker` GET `/api/settings/provider-models`，16 个大目录 provider 延迟加载（≥2 字符查询），支持手输 model ID。
  - **Capabilities 页**：4 个 `SettingsFeature` 开关卡（Image generation / Transcription / Web search / Memory-Dream），点标题/Configure 开 Dialog 内嵌对应分节；web/memory 开关直写 runtime_config（`tools.web.enable`/`agents.defaults.dream.enabled`）。
  - **image**：provider（复用 Providers 凭据）/model（限 `provider.models`，可手输）/默认宽高比（1:1…21:9）/默认尺寸（1K/2K/4K…）/Advanced maxImagesPerTurn(1–8)、save_dir。
  - **voice**：provider（默认 groq/whisper-large-v3）/model/language(en/zh/ja/ko，空=Auto)/Advanced maxDurationSec(1–600)、maxUploadMb(1–100)。
  - **browser/Web**：search provider（credential 类型 none/api_key/optional_api_key/base_url 决定 UI）/api key/base_url(searxng)/Advanced maxResults(1–10)、timeout(1–120s)、Jina reader 开关；olostep 未装→`CapabilityInstallNotice` 自动安装。
  - **advanced/Security**（`capabilities/SecuritySettings.tsx`）：Local Service Access 开关 + Default access SegmentedControl(default/full)→`settings.network_safety.update`；并承载 execution/shell(sandbox bwrap/seatbelt、allow/deny patterns、env keys)/network(proxy/user_agent)/safety(restrict_to_workspace、SSRF 白名单、远程包安装)/cli/gateway(restart_mode auto/exec/spawn/exit)/api 等 runtime_config 组。
  - **runtime/System**（`system/RuntimeSettings.tsx`）：native host（engine 状态 Ready/Pending/Restarting、Open logs、Export diagnostics）；API server（Start/Stop、Access This device/Local network、Port、API key，运行中显示 endpoint）；Observability（Langfuse enable/setup）；System（gateway host:port、config path、Restart）。
  - **Apps**（`system/AppsSettings.tsx`+`McpManagementDialog.tsx`）：CLI apps 与 MCP presets 合并目录，Ready/Apps/MCP 分段 + 搜索；CLI install/update/uninstall/test，装完 `CliAppReadyPanel`（@name、复制 prompt、Open chat）；MCP 状态机按钮（Enable/Disable、OAuth Connect popup+轮询、Manage）；`McpManagementDialog` 三 tab（Overview 指标卡 / Tools 逐个开关 + `["*"]` 通配 / Connection 凭据表单）；自定义 MCP（stdio/streamableHttp/sse、auth none/oauth/headers、import mcp.json）。
  - **Automations**（`system/AutomationsSettings.tsx`+Calendar/RunAtPicker/RunDialog）：页顶 `ThreadComposer` 自然语言创建（`intent:"create_automation"`）；Tasks/Calendar 双视图；过滤 All/Active/Disabled/Needs attention（带计数，protected 隐藏）；月网格日历（planned + recorded runs，≤3/天 +N more）；`AutomationRunDialog`（GET `.../automations/result`，Markdown 渲染）；详情/编辑弹窗（Every/Cron/Once + RunAtPicker 日历键盘导航；enable/disable/run/delete）。
  - **Channels**（`system/ChannelsSettings.tsx`+`channels/*`）：目录来自 nanobot-features 中 `type==="channel"`（5s 轮询 + focus 刷新），搜索 + All/Enabled 过滤，分组「无需安装 / 需装依赖」；行 = logo + 名称 + Install/Enable Toggle（未配置先开设置弹窗）；设置弹窗三分支：① channel-plugin 自定义 Panel ② 多实例 `ChannelInstancesPanel`（每实例头像/状态徽章/Toggle/字段编辑）③ 通用 `ChannelSetupSurface` 三 mode（`webui` 仅徽章 / `credentials` 契约驱动字段表单：分 section、secret 显隐/移除、自动保存 `settings.channel.configure`、Enable 前 `settings.channel.validate` 客户端+服务端校验、Check connection / `connect` QR 流：`settings.channel.connect.start`→`qrcode` 渲染→`poll` 每 2.5s→`cancel`，无插件时显示终端命令 + Copy）；`ChannelValidationProgress` 逐条动画揭示 pass/warn/fail；`ChannelHelpMenu`（官方 + 文档链接）。插件机制详见 §4.10。
  - **Skills**（`SkillsCatalogSettings.tsx`+`SkillsMarketplace.tsx`）：Installed（搜索、All/Enabled/Disabled、分组 Custom/Built-in/Other、状态 Enabled/Needs setup/Disabled）；详情 Sheet（`GET /api/webui/skills/{name}`：use-skill 开关、requirements missing_bins/env + install_options 命令复制、raw SKILL.md、Delete）；Discover=市场（搜索 ≥2 字符 300ms debounce、Trending、provider all/skills.sh/SkillHub、SVG sparkline 趋势、安装前第三方风险确认）。
  - **Appearance**（`overview/OverviewSettings.tsx`）：Theme(light/dark) + Language + 本地偏好（Activity detail auto/expanded、File edit display summary/diff/collapsed_diff、Code wrapping、Brand logos、Task notifications→`Notification.requestPermission`）。**About**：版本 + Check for updates（`/api/settings/version-check`，PyPI 外链）+ docs/source/issues 链接。
- **运行时配置 schema 驱动**（`system/runtime-config-fields.ts`）：`RUNTIME_CONFIG_GROUPS`（identity/memory/chat/execution/sessions/tools/web/shell/network/safety/cli/gateway/api/storage）映射到页面（runtime/memory/advanced/browser/image）；控件按 kind（boolean/toggle→ToggleButton、number→Input min/max、text→Input、timezone→TimezonePicker、list→SettingsTextEditor、select/preset→ProviderPicker）；`when` 条件显隐 + 组级 `enabledBy` 门控；字段 i18n `settings.runtimeConfig.fields.*`。
- **共享控件**（`settings/shared/`+`ToggleButton.tsx`）：`SettingsControls`（SectionTitle/Group/Row/ReadOnlyRow/StatusPill/NumberInput/StatusMessage/`RestartSettingsFooter`/RestartRequiredNotice/CapabilityInstallNotice/`NanobotFeatureInstallDialog`/DismissibleStatusMessage）、`SettingsFeature`（开关卡 + Dialog）、`ModelControls`（ProviderPicker/ModelIdPicker/PROVIDER_ICONS 40+）、`SettingsTextEditor`（JSON/list 弹窗）、`TimezonePicker`（Intl 时区 + 模糊搜索）、`SettingsHint`（tooltip）、`ToggleButton`（iOS 风格 role=switch）。

### 3.7 Workbench（多窗格工作台，`src/components/workbench/`）
- 一个「tab/group」可含最多 **4 个 pane**（`MAX_WORKBENCH_PANES`），每 pane 渲染一个独立 `ThreadShell`（并行多会话）。
- **布局**（`workbench-layout.ts`）：CSS grid，5 种 `columns/rows/grid/bsp/main-stack`，可拖拽 resize handle（比例 0.05–0.95，最小 160px），main-stack 主窗格比例 1.65/2.65。
- **操作**（i18n `workbench.*`）：add pane、create/rename/dissolve group、move pane to group、detach pane、promote to primary、拖拽/方向键移动、resize boundary、delete all chats in group；active pane 的 header/composer 通过 portal 提升到工作台 chrome。
- 状态持久化在 sidebar 状态的 `workbench` 字段（服务端），`workbench-model.ts` 提供纯函数 reducer（add/attach/detach/dissolve/rename/reconcile/order/setLayout/setSplitRatios）。

### 3.8 会话列表/管理（`src/components/Sidebar.tsx`, `ChatList.tsx`）
- Sidebar：brand、搜索、new chat、utility 导航（Apps/Skills/Automations/Channels）、archive 切换、`ChatList`、settings、`ConnectionBadge`；支持折叠 rail 模式 + 拖拽改宽（`SidebarResizeHandle`，272px 默认，存 localStorage）；移动端走 `Sheet` 抽屉。
- ChatList：分组（Pinned/All/Today/Yesterday/Earlier/Archived/Projects，`src/lib/chat-groups.ts`）、排序（updated_desc/created_desc/title_asc/manual）、pin/archive/rename/delete、多选 + 批量删除、拖拽重排/移入 group（`src/lib/session-drag.ts`）、右键 DropdownMenu（含 workbench createGroup/detachPane/dissolveTab/moveTo）、running/updated/recovery 活动指示、session `@handle` 彩色标签（`src/lib/session-handle.ts` FNV hash→hue）、show more/less 折叠。
- 对话框：`SessionSearchDialog`（Cmd+K，多词 AND 子串过滤 title+preview，键盘导航）、`RenameChatDialog`（会话/tab/project 三种复用）、`DeleteConfirm`（单/多，显示将被删除的关联 automations）。

### 3.9 ui/ 基础组件库（`src/components/ui/`，shadcn 风格）
overlay 类：`alert-dialog`、`dialog`、`sheet`、`popover`、`dropdown-menu`、`select`、`combobox`、`tooltip`；控件类：`button`（CVA variants）、`input`、`textarea`、`form-control`、`segmented-control`、`disclosure`（可折叠）、`expandable-text`；定位工具：`floating-portal`、`floating-surface`（统一浮层 elevation）。

---

## 4. 数据流

### 4.1 传输总览
UI 对后端有**两条通道**（`webui/README.md` 亦述）：
1. **REST（只读为主）** — 同源 `/api/*` 与 `/webui/bootstrap`，`fetch` + Bearer token（`src/lib/http.ts` `fetchWithTimeout`，默认 20s；`src/lib/api.ts` `request<T>()` 注入 `Authorization`，解析 JSON，识别「网关误返 HTML」）。
2. **WebSocket（多路复用）** — 单一连接承载：会话消息流、临时聊天、fork、attach、语音转写、sidebar 状态、**以及所有写操作（mutation）**。客户端 `src/lib/nanobot-client.ts`（`NanobotClient`，1535 行）。

### 4.2 引导与 token
`fetchBootstrap` GET `/webui/bootstrap` → `BootstrapResponse{token/api_token, ws_path, ws_url?, expires_in, limits(WebUIIngressLimits), model_name, runtime_surface, runtime_capabilities}`（`src/lib/types.ts`）。`deriveWsUrl` 由 window.location + `ws_path` 拼 WS URL（dev 5173→8765，支持 `wss`/`nanobot-host` scheme），token 作 query。token 到期前刷新（`App.tsx`）。

### 4.3 WebSocket 协议（`src/lib/types.ts`）
- **出站 `Outbound`**（`type` 字段）：`new_chat`(可带 workspace_scope)、`new_temporary_chat`、`fork_chat`(source_chat_id/before_user_index/title)、`attach`(chat_id)、`message`(chat_id/content/media[]/cli_apps[]/mcp_presets[]/session_mentions[]/quoted_context/intent/workspace_scope/turn_id/webui:true)、`transcribe_audio`(request_id/data_url/duration_ms)、`set_workspace_scope`、`set_sidebar_state`、`discard_temporary_chat`、`webui_request`(request_id/action/payload — **通用 mutation**)。
- **入站 `InboundEvent`**（`event` 字段）：`ready`、`attached`(recovery_state/usage)、`message_accepted`(turn_id/starts_turn)、`user_message`、`message`(text/media/tool_events/kind: tool_hint|progress|reasoning/latency_ms/source/agent_ui)、`delta`(流式文本 token)、`stream_end`(resuming/merge_next)、`reasoning_delta`/`reasoning_end`、`file_edit`(edits[])、`turn_end`(usage/round_usages/context_window_tokens/goal_state/outcome/failure_*)、`goal_status`(running/idle/started_at)、`goal_state`、`runtime_model_updated`/`turn_model_updated`(fallback)、`session_updated`(scope/workspace_scope)、`sidebar_state_updated`、`transcription_result`/`transcription_error`、`webui_response`(ok/result 或 error{status,message})、`error`(detail/reason/turn_id)；以及来自共享包的 `retry_status`/`recovery_state`/`context_compaction`（`NotificationEvent`，`packages/client-events/notifications`）。
- **turn/run 生命周期对账**：`NanobotClient` 维护 `runStartedAtByChatId`、`latestRunTurnIdByChatId`、`unsettledRunTurnIdsByChatId`、`canonicalCompletedTurnIdsByChatId`，用 `canReconcileCanonicalCompletion`/`reconcileCanonicalCompletion` 把 REST 权威快照与 live WS 事件对齐，避免重复/丢消息（`nanobot-client.ts`）。

### 4.4 流式：WS event → state → render
`useNanobotStream`（`src/hooks/useNanobotStream.ts`）`client.onChat(chatId)` 订阅 → `handle(ev)` 分派：`delta`/`reasoning_delta` 进 `StreamBuffer`，用 `requestAnimationFrame` + `setTimeout` 合帧 flush（离屏/不可见时降频），其余事件（message/file_edit/turn_end/goal_*/retry_status/recovery_state/context_compaction/attached）即时处理。投影纯函数在 `src/lib/thread-event-projection.ts`（找开放 stream 段、合并 fileEdits、closeReasoningStream、finalize turn）+ `src/lib/tool-traces.ts`（toolEvents↔trace 文本）。`messages` state → `ThreadMessages` → `projectActivityTimeline`(`activity-timeline.ts`) → MessageBubble/AgentActivityCluster。浏览器通知在 turn 完成且 `browserNotifications` 开启时触发（`new Notification`，`useNanobotStream`）。

### 4.5 历史与会话（REST）
- `listSessions` GET `/api/sessions`（`useSessions` 乐观插入 + 去抖 refresh）。
- `fetchWebuiThread` GET `/api/sessions/{key}/webui-thread`（分页 `before` cursor/direction/limit）→ `WebuiThreadPersistedPayload{messages, completed_turn_ids, has_pending_tool_calls, active_turn_id, fork_boundary_message_count, page, workspace_scope}`；`webuiThreadCache`（`WebuiThreadCache extends MemoryLruCache`）做 stale-while-revalidate。
- `fetchWebuiThreadTraceDetail` GET `.../webui-thread/trace-detail`（超大 trace 展开时拉）；`fetchFilePreview`/`fetchFilePreviewAvailability` GET `.../file-preview`。
- `ThreadMessageCache`（`src/lib/thread-message-cache.ts`）：切会话缓存 displayMessages，临时聊天常驻（无磁盘历史）。

### 4.6 Mutation over WS（`webui_request`）
所有写操作经 `client.requestMutation(action, payload)` → `webui_request` 帧；服务端回 `webui_response{request_id, ok, result|error}`。断线重连时用同 `request_id` **重放** pending 请求（`rawSendSerialized`）。`api.ts` 里的 action 名（节选）：`session.delete`、`sidebar.update`、`automation.update`、`skill.update/delete/install`、`settings.model_configuration.create/update/delete/migrate`、`settings.model_call_order.update`、`settings.provider.update/create/oauth_login/oauth_complete/oauth_logout`、`settings.web_search.update`、`settings.network_safety.update`、`settings.image_generation.update`、`settings.transcription.update`、`settings.runtime_config.update`、`settings.api_service.start/stop`、`settings.feature.enable/disable`、`settings.channel.connect.start/poll/cancel`、`settings.channel.configure/validate`、`settings.mcp.oauth_start/oauth_complete/oauth_cancel/custom/import/tools`、CLI app `install/update/uninstall/test`。超时 20s（打包类 150s）。

### 4.7 REST 只读端点（`src/lib/api.ts`，节选）
`/api/sessions`、`/api/sessions/{key}/webui-thread`(+`/trace-detail`)、`/api/sessions/{key}/file-preview`、`/api/sessions/{key}/automations`、`/api/webui/automations`(+`/result`)、`/api/webui/skills`(+`/{name}`、`/search`、`/trending`、`/trends`)、`/api/settings`、`/api/settings/usage`、`/api/settings/version-check`、`/api/workspaces`、`/api/settings/cli-apps`、`/api/settings/nanobot-features`、`/api/settings/api-service`、`/api/settings/pairing`、`/api/settings/mcp-presets`、`/api/settings/mcp-oauth/status`、`/api/settings/provider-models`、`/api/commands`、`/api/webui/sidebar-state`。OAuth 回调走 `/auth/*`（provider `:1455/auth/callback`、mcp `/auth/mcp/callback`，见 `vite.config.ts` proxy 与 tests）。

### 4.8 重连与容错（`nanobot-client.ts`）
指数退避 `min(500·2^attempt, maxBackoffMs)`（0.5s→1s→2s→4s…）；`onReauth` 重连前刷新 token/url；`handleOpen` 重连后 re-attach 所有 `knownChats`、重放 pending webui_request、flush `sendQueue`（离线期间排队的帧）；`ConnectionStatus` idle/connecting/open/reconnecting/closed/error 经 `onStatus` 广播给 `ConnectionBadge`。`StreamError` 结构化：message_too_big / workspace_scope_rejected / turn_rejected / model_request_failed。

### 4.9 Workers（`src/workers/`）
- `imageEncode.worker.ts`：离主线程图片编码/归一化。magic-bytes 校验（防扩展名伪装）→ ≤`TARGET_MAX_BYTES`(6MB) 直通 base64；超限用 `createImageBitmap`+`OffscreenCanvas` 缩到长边 ≤2048 重编码（JPEG/WebP→webp q0.85，PNG/GIF→png）；失败原因枚举 invalid_mime/magic_mismatch/too_large_after_normalize/decode_failed/io。`src/lib/imageEncode.ts` 懒启单例 worker，不可用则主线程兜底。

### 4.10 channel-plugins（`src/channel-plugins/` + 后端 `nanobot/channels/*/webui/`）
- **插件式渠道 UI**：`registry.ts` 用 `import.meta.glob("../../../nanobot/channels/*/webui/index.{ts,tsx}")` 自动注册各渠道贡献的 `ChannelUiContribution{presentation(displayName/initials/color/logoUrl), aliases?, Panel?, ConnectFlow?, canConnectBeforeConfigured?}`（`types.ts`）。每渠道一个 UI 贡献，别名可覆盖 presentation。
- **本地化**：`locale-registry.ts` glob `nanobot/channels/*/webui/locales/*.json`，按渠道生成 i18n namespace（`channelNamespace`），随 app 语言懒加载；`i18n.ts` 定义 `ChannelMessages`。
- 现有 17 个渠道贡献 webui：dingtalk/discord/email/feishu/matrix/mattermost/mochat/msteams/napcat/qq/signal/slack/telegram/websocket/wecom/weixin/whatsapp（`nanobot/channels/*/webui`）。whatsapp 带自定义 `WhatsAppConnectFlow.tsx`。
- 渠道连接 UX：`settings/channels/*`（catalog、CredentialForm、ChannelQrConnectFlow 用 `qrcode`、ChannelInstancesPanel、ChannelValidationProgress），后端经 `settings.channel.connect.start/poll/cancel`、`configure`、`validate` mutation。

### 4.11 native 桌面宿主（`src/lib/runtime.ts`）
`RuntimeSurface = browser | native`。native 下宿主注入 `window.nanobotHost`（或 URL fragment `?nativeHostPort=&nativeHostToken=` 的 loopback HTTP 桥，仅 127.0.0.1、token 存 sessionStorage）：`pickFolder`（原生目录选择）、`restartEngine`、`openLogs`、`exportDiagnostics`，以及 **WS 桥** `HostWebSocket`（openSocket/sendSocket/closeSocket/onSocketEvent 隧道，仅文本帧）。`runtime_capabilities` 控制这些能力可用性。`HostChrome` 提供窗口拖拽区。

---

## 5. i18next

来源：`src/i18n/config.ts`、`src/i18n/index.ts`、`src/i18n/locales/*`、`src/components/LanguageSwitcher.tsx`。

- **机制**：`initializeI18n()`（`main.tsx` 启动前 await）用 `import.meta.glob("./locales/*/common.json")` 懒加载；启动只加载「当前语言 + fallback(en)」两个 bundle，其余按需 `loadLocaleResources` 再 `addResourceBundle`。`defaultNS:"common"`，namespace = `["common", ...channelLocaleNamespaces()]`（渠道插件追加）。`interpolation.escapeValue:false`、`returnNull:false`、`supportedLngs` 限定。
- **语言检测/持久化**：`resolveInitialLocale()` = localStorage(`nanobot.locale`) ?? `defaultLocale("en")`（`config.ts`）。**注意**：运行时 i18n 初值只读 storage，不读浏览器语言；浏览器语言检测仅在 `index.html` 内联脚本用于 boot splash 文案 + `<html lang>`（首访未存储时 app UI 实际落 en，直到用户切换）。「推断」：这是有意的（splash 用浏览器语言，app 默认 en）。`normalizeLocale` 做 zh/zh-CN/zh-TW/pt-BR 等归一。切换语言 `setAppLanguage()` → `i18n.changeLanguage` + `persistLocale` + `applyDocumentLocale`。
- **切换 UI**：`LanguageSwitcher.tsx`（Radix Select，显示各语言 nativeLabel），出现在 AuthForm 等处。
- **完整语言列表（10 种，来自 `src/i18n/locales/<code>/common.json` 目录名 + `config.ts` `supportedLocales`）**：
  1. `en` English（default & fallback）
  2. `zh-CN` 简体中文
  3. `zh-TW` 繁體中文
  4. `fr` Français
  5. `ja` 日本語
  6. `ko` 한국어
  7. `es` Español
  8. `pt-BR` Português (Brasil)
  9. `vi` Tiếng Việt
  10. `id` Bahasa Indonesia
- **规模**：`en/common.json` 1952 行，顶层命名空间 app/temporaryChat/sidebar/settings(最大,~1287 行)/chat/deleteConfirm/connection/thread/message/recovery/lightbox/filePreview/code/workbench/common/errors/workspace。渠道插件另有独立 namespace JSON（后端目录内）。

---

## 6. 功能级 parity 清单

> 图例：🔗 = 深度耦合上游后端协议（WS 事件/`webui_request` action/bootstrap/渠道），克隆需后端配合或替换；🧩 = 通用 UI 功能（可独立实现）。

### 6.1 连接 / 鉴权 / 引导
- [ ] 🔗 Bootstrap 引导：GET `/webui/bootstrap` 取 token+ws_path+limits+runtime_surface
- [ ] 🔗 密码鉴权表单（`X-Nanobot-Auth`），401/403 触发；密码本地保存、URL `?bootstrapSecret=` 注入、登出清除
- [ ] 🔗 Token 到期前自动刷新（30s margin）
- [ ] 🔗 网关不可达错误页 + 提示
- [ ] 🔗 WS 连接状态徽章（idle/connecting/open/reconnecting/closed/error）
- [ ] 🔗 断线指数退避重连 + 重连后 re-attach 会话 + 重放 pending mutation + flush 离线队列
- [ ] 🔗 结构化流错误（message_too_big / workspace_scope_rejected / turn_rejected / model_request_failed）+ 内联/通知展示
- [ ] 🔗 native 桌面宿主桥（pickFolder/restartEngine/openLogs/exportDiagnostics/HostWebSocket）+ 窗口拖拽 chrome
- [ ] 🔗 `/restart` 系统命令 + 重启后 hash 路由恢复（5min TTL）
- [ ] 🔗 聊天用户配对弹窗（轮询 pairing requests + 8 位码自动匹配 approve/deny）

### 6.2 全局布局 / 导航 / 主题
- [ ] 🧩 深色/浅色模式切换（localStorage + `prefers-color-scheme` 默认，`.dark` class + theme-color meta，防 FOUC 内联脚本）
- [ ] 🧩 语言切换（10 种，Select UI，懒加载 bundle）
- [ ] 🧩 hash 路由（chat/new/temporary/settings/apps/automations/skills/channels）+ 浏览器前进后退
- [ ] 🧩 全局键盘快捷键（new/search/apps/skills/automations/channels/settings，Apple 符号）
- [ ] 🧩 侧栏折叠 rail 模式 + 拖拽改宽（持久化）+ 移动端抽屉
- [ ] 🧩 响应式/移动端适配（触屏检测、bottom sheet、16px 防缩放、安全区 inset）
- [ ] 🧩 PWA（manifest 可安装、service worker 静态缓存 + favicon 缓存）

### 6.3 会话管理
- [ ] 🔗 会话列表（REST `/api/sessions`）+ 乐观插入
- [ ] 🔗 新建会话（可带 workspace scope + model preset）
- [ ] 🔗 临时聊天（非持久，断线即弃，`#/temporary/`）
- [ ] 🔗 Fork 会话（在某 user 消息前分叉，`fork_chat`）+ fork 边界分隔线
- [ ] 🔗 删除会话（单/多选批量）+ 关联 automations 阻断提示
- [ ] 🧩 重命名会话 / tab-group / project（标题覆盖，服务端持久化）
- [ ] 🧩 Pin / Archive / 显示归档
- [ ] 🧩 分组（Pinned/Today/Yesterday/Earlier/Projects/Archived）+ 排序（updated/created/title/manual）
- [ ] 🧩 拖拽重排 / 拖入 workbench group
- [ ] 🧩 会话搜索对话框（Cmd+K，多词 AND，键盘导航）
- [ ] 🧩 活动指示（running / updated / recovery 待处理）
- [ ] 🔗 session `@handle`（彩色标签，跨会话身份）
- [ ] 🔗 workspace scope（项目路径 + full/restricted 访问模式，原生/ RPC 目录选择，拒绝错误处理）

### 6.4 Thread / 消息渲染
- [ ] 🔗 逐 token 流式渲染（delta/reasoning_delta，合帧 flush）
- [ ] 🔗 流式 markdown（streamdown，`parseIncompleteMarkdown`）
- [ ] 🧩 Markdown：GFM 表格/任务列表、数学公式(KaTeX 懒加载)、换行、安全 HTML 子集、CJK 粗体修复
- [ ] 🧩 代码块：语法高亮（懒加载 prism）、语言归一、复制、可选行号/换行、ANSI 着色
- [ ] 🧩 链接安全白名单 + 会话内跳转链接 + 文件路径 chip + favicon 链接预览行
- [ ] 🔗 用户消息：图片缩略图、引用上下文、slash 前缀高亮、@mention/$skill token、delivery 状态（sending/accepted/failed + 错误 kind）
- [ ] 🔗 assistant 消息：reasoning 段、"Thinking…" 状态、footer（复制/**fork from here**/完成时间戳/automation 来源标签）
- [ ] 🔗 工具活动聚类（activity cluster）：折叠壳 + Working/Worked for Ns + retry 倒计时
- [ ] 🔗 文件编辑 diff 渲染（unified diff、双行号、增删色、大 diff 折叠、Open file）
- [ ] 🔗 通用工具行 / web 搜索行(带来源) / web 活动行 / CLI 运行行 / MCP 运行行
- [ ] 🔗 reasoning 行（压缩预览、streaming 旋转/完成绿勾）
- [ ] 🔗 context compaction 通知（started/succeeded/failed/cancelled）
- [ ] 🔗 recovery 通知（awaiting_user/failed → Dismiss/Continue，resuming spinner）
- [ ] 🔗 trace 面包屑折叠组 + 超大 trace 懒加载详情（可 Retry）
- [ ] 🔗 跨会话来消息（session-message，色条 + @handle）
- [ ] 🔗 选中文本「引用提问」浮动按钮（AssistantSelectionAction，流式中禁用）
- [ ] 🧩 图片 lightbox（键盘导航、循环、预解码、reduced-motion）
- [ ] 🧩 复制消息/代码到剪贴板（成功反馈）
- [ ] 🔗 token 用量显示（context meter + 最近 8 轮 round usage 柱状图，KV cache 命中率）

### 6.5 滚动 / 视口
- [ ] 🧩 智能自动滚动状态机（follow-latest/anchor-prompt/follow-output/browsing-history…，用户滚动让权，边界恢复跟随）
- [ ] 🧩 历史向上分页 + prepend 滚动锚定 + 消息窗口化（初始 120，滚动增量）
- [ ] 🧩 Scroll-to-bottom 按钮（避让键盘/composer）
- [ ] 🧩 软键盘 inset 适配、会话切换淡入淡出、reduced-motion
- [ ] 🧩 PromptNavigator（Sheet 列出所有 user prompt，可搜索跳转）+ PromptRail（右侧迷你地图，聚合 marker + 预览）
- [ ] 🧩 离屏消息懒渲染（IntersectionObserver 占位）

### 6.6 Composer
- [ ] 🧩 多行自动增高 textarea（上限 260px）、Enter 提交 / Shift+Enter 换行 / IME 感知
- [ ] 🧩 自实现 undo/redo（历史上限 100）
- [ ] 🔗 `/` slash 命令 palette（`GET /api/commands`，5 种 lifecycle：side_channel/finalize_active_turn/stop_active_turn/agent_turn/agent_turn_with_args，argHint，recents，流式时 `/stop` 置顶）
- [ ] 🔗 `$` skill palette（已启用技能，`useSkills`）
- [ ] 🔗 `@` mention（session / cli-app / mcp-preset 三类，配额分组，logo 降级，原子化编辑，session 拖拽入框）
- [ ] 🔗 附件：文件选择/粘贴/拖拽；图片(png/jpeg/webp/gif)+文档(pdf/office/txt/md/csv/json/xml/html/log/yaml/toml/ini)白名单；image worker 归一化(≤6MB,长边≤2048)；限制 4 个/单 6MB/总 24MB（受 `ingressLimits` 覆盖）；预览 chip（encoding/ready/error，可删）
- [ ] 🔗 语音输入：MediaRecorder + 实时波形 + 点击/按住/Ctrl+Shift+D + WS `transcribe_audio` + WAV 转换（特定 provider）+ 时长约束(650ms–120s)+ 错误提示
- [ ] 🔗 模型 preset 选择器（per-session，来自 SettingsPayload；needsSetup→「Configure model」CTA）
- [ ] 🔗 流式中「排队提示」（queued guidance：入队/编辑/删除/拖拽重排/回合结束自动 flush/第二次 Enter 直发）
- [ ] 🔗 引用回复（`> [!QUOTE]` blockquote + `quoted_context`）
- [ ] 🔗 stop/abort 生成（按钮 + `/stop`）
- [ ] 🔗 乐观消息 + 字节超限内联报错（max_text_bytes，无实时计数器）
- [ ] 🔗 goal 状态条（持续目标，`goal_state` WS）
- [ ] 🔗 workspace/project picker（hero，`can_change_project`）+ access 模式菜单
- [ ] 🧩 发送后清空/blur、移动端紧凑控件、usage popover 触发

### 6.7 Workbench（多窗格）
- [ ] 🔗 多窗格并行会话（每 group ≤4 pane，各独立 ThreadShell）
- [ ] 🧩 5 种布局（columns/rows/grid/bsp/main-stack）+ 切换
- [ ] 🧩 拖拽 resize 分隔（比例/最小宽度约束）+ 方向键
- [ ] 🔗 group 操作：create/rename/dissolve、add pane、move pane to group、detach、promote to primary、delete all
- [ ] 🔗 布局状态服务端持久化（随 sidebar 状态）

### 6.8 文件预览
- [ ] 🔗 文件预览侧栏（`fetchFilePreview`，可拖拽改宽，availability 探测缓存）
- [ ] 🔗 代码 chip 点击打开预览、diff「Open file」

### 6.9 Settings（各分节，详见 §3.6）
- [ ] 🧩 设置侧栏导航（7 项 + Restart pending 态 + Logout）+ 移动端下拉 + 独立全屏页（apps/automations/skills/channels）返回
- [ ] 🔗 Overview：token 用量卡（30d 堆叠柱、5 段 cached/miss/unknown/output/other、cache 命中率 tooltip、按来源百分比）/ 明细弹窗 / Top5 模型趋势；usage 5s 轮询
- [ ] 🧩 About：版本 + Check for updates（version-check + PyPI 外链）+ docs/source/issues 链接
- [ ] 🧩 Appearance：主题 + 语言 + 本地偏好（activity detail / file-edit display / 代码换行 / 品牌 logo / 任务通知+权限请求）
- [ ] 🔗 Models：preset 列表按 call order + 拖拽/键盘重排 + Primary 徽章 + enable/disable（最少 1）+ preset CRUD（name 唯一校验、provider、model、maxTokens/temperature/contextWindow 64K–1M/reasoningEffort）+ legacy 迁移
- [ ] 🔗 Providers：api_key 型（key 显隐/hint/编辑、apiBase、custom 创建）+ OAuth 型（login/complete/logout、粘贴 callback URL/code、1s 轮询）+ advanced（api_type/thinking_style/proxy/region/profile/extra_headers/body/query）+ per-provider 请求开关（codex fast/openai web search/deepseek/grok X）+ bedrock/azure 依赖安装
- [ ] 🔗 ModelIdPicker：provider-models 拉取、大目录延迟加载（≥2 字符）、搜索、手输 model ID
- [ ] 🔗 Capabilities 聚合页：image / transcription / web / memory(dream) 四开关卡（直写 runtime_config）
- [ ] 🔗 Image：provider/model（限静态列表，可手输）/宽高比 1:1–21:9/尺寸 1K·2K·4K/maxImagesPerTurn 1–8/save_dir
- [ ] 🔗 Voice：STT provider/model/language(en/zh/ja/ko/Auto)/maxDurationSec 1–600/maxUploadMb 1–100
- [ ] 🔗 Web/Browser：search provider（credential none/api_key/optional/base_url）/api key/base_url/maxResults 1–10/timeout 1–120/Jina reader/olostep 自动安装
- [ ] 🔗 Channels：见 6.10
- [ ] 🔗 Apps：CLI apps + MCP presets 合并目录（Ready/Apps/MCP 分段 + 搜索）；CLI install/update/uninstall/test + Ready 面板；
- [ ] 🔗 MCP 管理：OAuth connect（popup + 轮询 + callback）、三 tab 管理弹窗（Overview/Tools 逐个开关 + `["*"]` 通配/Connection 凭据）、自定义 MCP（stdio/http/sse、auth none/oauth/headers）、import mcp.json、enable/disable/remove/test/reconnect
- [ ] 🔗 Automations：自然语言创建（composer intent）+ Tasks/Calendar 双视图 + 过滤(All/Active/Disabled/Needs attention) + 月网格日历(planned+recorded) + 运行结果弹窗(Markdown) + 详情/编辑(Every/Cron/Once + RunAtPicker) + enable/disable/run/delete
- [ ] 🔗 Memory：dream/memory consolidation 运行时字段
- [ ] 🔗 Skills：Installed（搜索/过滤/分组/状态）+ 详情 Sheet（use-skill 开关、requirements missing bins/env + install 命令、raw SKILL.md、delete）+ 市场（搜索/trending/provider 过滤/sparkline/风险确认安装）
- [ ] 🔗 Runtime/System：native host（engine 状态/logs/diagnostics）+ API server（start/stop、access device/network、port、api key）+ Observability(langfuse) + gateway host/port/config path/restart
- [ ] 🔗 Advanced/Security：local service access + default access mode(default/full) + workspace sandbox(bwrap/seatbelt、allow/deny patterns、env keys) + SSRF 白名单 + restrict_to_workspace + 远程包安装 + exec/cli/gateway(restart_mode)/api 组
- [ ] 🔗 schema 驱动运行时配置（RUNTIME_CONFIG_GROUPS/fields、控件按 kind、when 显隐、enabledBy 门控、组粒度自动保存）
- [ ] 🧩 自动保存（600ms 防抖，每签名一次）+ 离开需重启分节的 exit guard 弹窗 + restart-aware 提示 + native 自动重启引擎

### 6.10 Channels（渠道插件系统）
- [ ] 🔗 渠道目录（来自 nanobot-features `type==="channel"`，5s 轮询）+ 搜索 + All/Enabled 过滤 + 分组（无需安装 / 需装依赖）
- [ ] 🔗 行 Install（feature.enable install_only）/ Enable-Disable Toggle（未配置先开设置弹窗）+ 品牌 presentation（displayName/initials/color/logo）
- [ ] 🔗 设置弹窗三分支：插件自定义 Panel / 多实例 InstancesPanel / 通用 SetupSurface
- [ ] 🔗 通用面板三 mode：`webui`（仅徽章）/ `credentials`（契约驱动字段，分 section，secret 显隐/移除，自动保存 `channel.configure`，Enable 前客户端+服务端 `channel.validate`，Check connection）/ `connect`（QR 流）
- [ ] 🔗 QR 扫码连接（`qrcode` 本地渲染，`connect.start`→`poll` 2.5s→`cancel`，无插件时显示终端命令 + Copy）
- [ ] 🔗 校验进度逐条动画揭示（pass/warn/fail + action_url）+ 最终身份/连接状态条
- [ ] 🔗 多实例面板（每实例头像/状态徽章 Configured·Needs setup·Failed·Starting·Connected / 独立 Toggle / 字段编辑）
- [ ] 🔗 插件式渠道 UI 注册（`import.meta.glob` 后端 `channels/*/webui`，Panel/ConnectFlow/aliases，17 渠道）
- [ ] 🔗 渠道独立 i18n namespace（随语言懒加载）
- [ ] 🔗 聊天用户配对（REST pairing + WS approve/deny，App 全局弹窗）
- [ ] 🧩 帮助菜单（官方 + 文档链接，docs 基址可覆盖）

### 6.11 i18n / 通用
- [ ] 🧩 10 语言完整覆盖 + 懒加载 + fallback en
- [ ] 🧩 渠道插件翻译合并
- [ ] 🔗 boot splash 本地化（index.html 内联，浏览器语言检测）

---

## 7. 未覆盖/存疑点

- **未逐行读的大文件**（靠 grep/签名/子代理摘要）：`ThreadComposer.tsx`(3329)、`ChatList.tsx`(1934)、`ThreadShell.tsx`(1775)、`nanobot-client.ts`(1535)、`types.ts`(1611)、`api.ts`(1121)、`MessageBubble.tsx`(987)、`PaneWorkbench.tsx`(849)、`useNanobotStream.ts`(1500) 的完整实现细节；本清单为功能地图级，非行级。
- **Settings 分节**已逐文件研读并综合进 §3.6/§6.9（`SettingsPage.tsx` 映射、`useSettingsController.ts`、各 `capabilities/*`·`models/*`·`system/*`·`channels/*`·`shared/*` 组件、`SettingsPayload`、`runtime-config-fields.ts`、`contracts.ts`、`api.ts` action 名）。个别 runtime_config 字段全集（memory/advanced 组的每个 key）未逐一枚举，仅列代表字段。
- **后端协议**：WS 事件/`webui_request` action 的**服务端语义**未读（在 `nanobot/` Python 侧，本次只读前端消费面）；`packages/client-events/notifications.ts` 只确认了 retry_status/recovery_state/context_compaction 三类。
- **消息级「编辑已发送」「失败重试」**：composer 子代理确认 composer 内**不存在**；是否在消息层别处实现「未确认」（MessageBubble 未见编辑/重试按钮，仅 fork/copy/quote）。
- **首访语言**：运行时 i18n 初值仅读 localStorage（默认 en），不读浏览器语言；浏览器语言仅用于 boot splash（`index.html`）。是否为有意设计标「推断」。
- **channel-plugins 各渠道 Panel/ConnectFlow 的具体 UI**：仅读了 registry/locale-registry/types 与 whatsapp 存在自定义 ConnectFlow；17 个渠道各自面板细节未逐一读（在后端 `nanobot/channels/*/webui/`，超出 webui 目录）。
- **`agent_ui`/`AgentUIBlob`**（message 事件的结构化 channel-specific payload）：类型存在于 `types.ts`，但前端如何渲染未深入（「未确认」）。
- **测试 fixtures**（`src/tests/fixtures`）与 ~95 个测试文件未纳入功能清单（仅用于佐证行为，如 notifications/sw/pwa）。
- 未运行任何构建/测试/git；上游目录严格只读。
