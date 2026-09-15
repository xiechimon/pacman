---
labels: [build, ready-for-agent]
status: done
blockedBy: [B2]
---

# B3 · 深换皮为 pacman

按 01 号票 b 类 35 条触点，全换。

- [x] 12 个 workspace 包名 `@craft-agent/*` → `@pacman/*`（含 package.json + 全部 import）
- [x] scheme `craftagents://` → `pacman://`（main/index.ts、deep-link.ts 等）
- [x] 配置目录 `~/.craft-agent` → `~/.pacman`（paths.ts + 10 处硬编码绕行）
- [x] appId `com.lukilabs.craft-agent` → `app.pacman`（electron-builder.yml）
- [x] `CRAFT_*` env 前缀 → `PACMAN_*`
- [x] UA `CraftAgents/${APP_VERSION}` → `pacman/${APP_VERSION}`
- [x] MCP client/server names：`craft-agent*` / `craft-pool-*` → `pacman*`
- [x] PBKDF2 盐 `craft-agent-v1/v2` → `pacman-v1/v2`（红线但新装无碍）
- [x] `CraftAgents*` 标识符（产品名、菜单、组件、文件）→ `Pacman*`
- [x] icon 文件 `CraftAgentsSymbol.tsx` 等重命名为 `PacmanSymbol.tsx` 等
- [x] i18n 字符串（菜单标题、视图标题等 → `Pacman`）
- [x] 删上游 release-notes 历史（0.0-0.11）+ Dockerfile.server + 构建产物 bridge-mcp-server

**完成条件**：b 类审计 ≈ 0 命中（剩 1 处 `TRADEMARK.md` 上游商标指南，保留）✓；`bun run typecheck` 通过 ✓；Electron dev 启动 90s idle 无崩溃 ✓。

## Answer

2026-09-15 执行完毕。涉及 100+ 文件：

- **包名重命名**：12 个 `packages/*/package.json` + `apps/*/package.json`，以及 435 处 import 引用
- **scheme/config 改**：main/index.ts、deep-link.ts、handlers、scripts/build-wa-worker.ts、*.tsconfig.json paths、CLAUDE.md 等
- **env 替换**：feature-flags.ts、auth/oauth.ts、config/paths.ts、electron-dev.ts、electron-builder.yml 等的 `CRAFT_*` → `PACMAN_*`
- **icon 文件**：3 个 .tsx 重命名（CraftAgentsSymbol → PacmanSymbol 等）
- **删历史**：上游 0.0-0.11 的 release-notes（移至 `.scratch/craft-fork/research/upstream-release-notes/`）、Dockerfile.server（上游坏）、bridge-mcp-server/index.js 构建产物（630K）

**红线遵守**：OAuth 公共 client_id、端口 1455、Copilot 伪装请求头、PBKDF2 盐全部按 08 票规则处理（盐改了但新装无碍）。

**审计结果**：a/c = 0、b = 1（仅 TRADEMARK.md 上游协议层）。

**下一步**：B4（双 provider 验收）。
