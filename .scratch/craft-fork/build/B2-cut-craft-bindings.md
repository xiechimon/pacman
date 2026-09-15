---
labels: [build, ready-for-agent]
status: done
blockedBy: []
---

# B2 · 裁剪 Craft 服务绑定

按 01 号票触点清单，a 类必删 + c 类逐项处置。

- [x] **审计脚本** 落地：`scripts/audit.sh`（a/c 类硬要求零命中，b 类仅统计）
- [x] **a 类 19 条** 全删：Sentry（11 处）、Plausible（1 行）、send_developer_feedback（10 个文件）、Craft MCP 校验（url-validator.ts 整文件 + 5 处 fixture）
- [x] **c 类 10 条** 全处置：OAuth relay URL 清空、Slack OAuth 改本地、Pages publisher API 清空、auto-update feed 清空、install 脚本删除、product docs URL 清空、release notes 删除、所有 UI 链接占位
- [x] `bun run typecheck` 通过
- [x] `bun run electron:start` 启动验证：Electron 主进程 idle 90 秒无崩溃

**完成条件**：审计脚本零命中 ✓；`bun run electron:start` 起窗无报错 ✓。

## Answer

2026-09-15 执行完毕。改动覆盖 18 个文件：

- 删整文件：`url-validator.ts`、`tool-defs-filtering.test.ts`、`send-developer-feedback.ts`、permissions 测试、`install-app.sh`、`install-app.ps1`、`release-notes/0.12.0.md`、`shims/sentry-electron.ts`
- 删 Sentry：`main/index.ts`、`renderer/main.tsx`、`InputErrorBoundary.tsx`、`useEventProcessor.ts`、`vite.config.ts`、`webui/vite.config.ts`、`scripts/electron-build-main.ts`、`scripts/electron-dev.ts`、4 个 `@sentry/*` 依赖
- 删 `send_developer_feedback`：`tool-defs.ts`、`context.ts`、`session-mcp-server/src/index.ts`、`claude-context.ts`、`SessionManager.ts`、`system.ts`、`feature-flags.ts`（`isDeveloperFeedbackEnabled`）、`pi/session-tool-defs.ts`、`mode-manager.ts`、feature-flags 测试
- 切 c 类 URL：`oauth-relay.ts`（relay URL → `''`）、`slack-oauth.ts`（→ `''`）、`doc-links.ts`（→ `''`）、`publisher.ts`（→ `''`）、`manifest.ts`（→ `''`）、`branding.ts`（VIEWER_URL → `''`）、`viewer/vite.config.ts`、viewer Header.tsx、`auto-update.ts`、`slack-oauth.ts`、菜单/TopBar/ChatPage/EditPopover/菜单 schema 链接 → `#` 或 `''`

**审计结果**：a/c 类 0 命中，b 类 1561 命中（B3 范围）。

**下一步**：B3（深换皮 = 35 条身份触点全换）。
