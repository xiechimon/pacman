---
labels: [wayfinder:map]
---

# mini-pi v2 Agent 地图

## Destination

从零用 TypeScript/Node.js 重建一个个人终端编码 agent，参考 Pi 架构的核心抽象（Agent 运行时、AgentMessage 管线、4 内核工具、Skills 渐进披露、会话 JSONL），但砍掉代码级可扩展机制（Extensions/hook 系统、Pi 包分发、RPC、chord、多供应商、MCP）。Skills 保留——它是内容层（Markdown 文件），不需要插件系统。MVP 是单轮对话 TUI，之后沿 roadmap 逐步加多轮会话、持久化、Skills、压缩、slash 命令等。

## Notes

- **语言**：TypeScript，Node.js 22+
- **TUI**：Ink (React)
- **模型**：Anthropic only (`@anthropic-ai/sdk`)
- **包管理**：pnpm
- **项目结构**：`@mini-pi` monorepo，3 包（`ai` → `agent` → `tui`），`tsc --noEmit` + `esbuild`
- **沙箱**：无，继承用户 shell 权限
- **目标用户**：个人使用
- **关键技能**：`pi-wiki`（参考 Pi 架构）、`grilling`、`domain-modeling`、`prototype`、`research`
- **参考上游**：https://github.com/earendil-works/pi

## Decisions so far

- [monorepo 包边界](issues/01-monorepo-boundaries.md): 3 包 `@mini-pi/{ai,agent,tui}`，依赖方向 tui→agent→ai，`tsc --noEmit` 类型检查 + `esbuild` 构建。
- [AgentMessage 管线设计](issues/02-agentmessage-pipeline.md): 3 种消息类型（user/assistant/toolResult），单阶段 `messagesToProvider()` 直转，直接解析 Anthropic content block 不做事件归一化，砍掉 declaration merging。[[findings](issues/02-agentmessage-pipeline-findings.md)]
- [Agent 循环单轮精简](issues/03-agent-loop-single-turn.md): 单层 `while(hasMoreToolCalls)` 循环取代双 while，8 种事件（砍 tool_execution_update），MVP 串行执行工具，~5360 行 Harness 全砍，保留 4 个 agent 级 callback。[[findings](issues/03-agent-loop-single-turn-findings.md)]
- [Anthropic StreamFn 包装](issues/05-anthropic-streamfn.md): Promise-based StreamFn（非 EventStream），5 种 AgentEvent，~15 行 no-throw 样板，3 个 SDK 陷阱已踩（按 index 寻址 tool_use / stop_reason 在 message_delta / pause_turn→toolUse）。9 单测 + 2 smoke test 通过。[[findings](issues/05-anthropic-streamfn-findings.md)]
- [Ink 流式渲染 Spike](issues/04-ink-streaming-spike.md): Ink 4.x + React 18 可行，~30 FPS 无数据丢失。按 token 渲染（非字符），`<Static>` 存已完成块，`useTransition` 帧对齐。`ink-text-input` v5 兼容。[[findings](issues/04-ink-streaming-spike-findings.md)]
- [Roadmap 功能优先级](issues/06-roadmap-priority.md): v0.2 会话地基 → v0.3 并行（压缩/CLI/工具）→ v0.4 并行（Slash/Skills）→ v0.5 抛光（输入/Markdown）。

## Open tickets

（无 —— 通往 v0.1 MVP 的路线已清晰）

**Frontier（可取票）**：无

## Not yet specified

- 多轮会话中上下文窗口的压缩策略
- JSONL 会话格式的具体 schema（对齐 Pi 的 10 种 entry type 还是简化）
- Skills 渐进披露的发现规则与系统提示词注入方式（roadmap v0.3+）

## Out of scope

- Extensions / 插件系统（ch19）— 代码级 hook 链，个人工具不需要
- Pi 包分发机制 — Skills 用本地目录加载，不通过 npm/git 分发
- 多供应商 / transformMessages / 跨模型切换（ch10）
- RPC 模式 / JSONL frame 协议（ch17）
- pi-server / pi-client 分布式（ch24）
- chord 运行时（ch22）
- pi-protocol CBOR（ch23）
- MCP client/server
- 权限弹窗 / Plan Mode / 子 agent
- OAuth 登录流程（只用 API key）
- 容器化隔离