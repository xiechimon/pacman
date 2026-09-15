# 01: 项目骨架 + 类型契约

**What to build:** pnpm workspace 三包（`@mini-pi/ai`、`@mini-pi/agent`、`@mini-pi/tui`）可编译，所有核心类型从对应包正确导出。

**Blocked by:** None (can start immediately).

**Status:** done

## Acceptance criteria

- [x] `pnpm install` 在仓库根目录成功，三包各自 `node_modules` 就位
- [x] `tsc --noEmit` 三包全绿
- [x] `@mini-pi/ai` 导出 `StreamFn`、`AgentEvent`、`ToolDef`、`AssistantMessage`、`StopReason` 类型
- [x] `@mini-pi/agent` 依赖 `@mini-pi/ai`，可 import 其类型
- [x] `@mini-pi/tui` 依赖 `@mini-pi/agent` 和 `@mini-pi/ai`
- [x] 根目录 `.gitignore` 排除 `node_modules/`、`dist/`、`.env`
- [x] `tsconfig.json` 配置：ES2022 target，ESM 模块，bundler resolution