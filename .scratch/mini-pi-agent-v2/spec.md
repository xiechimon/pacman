---
Status: ready-for-agent
---

# mini-pi v2 — v0.1 MVP Build Spec

## Problem Statement

我需要一个个人终端编码 agent，能用自然语言命令在本地工作区里读文件、改代码、跑命令。现有的 Pi agent 架构方向正确，但为平台化做了太多扩展性设计（Extensions hook 系统、多供应商、RPC 分布式、chord 运行时），个人使用不需要这些，反而增加理解和维护成本。需要一个去掉可扩展性后保留核心架构的版本。

## Solution

从零用 TypeScript/Node.js 重建 mini-pi v2，参考 Pi 的四层核心抽象（AI 适配 → Agent 循环 → 工具执行 → TUI），但砍掉全部代码级可扩展机制。v0.1 MVP 是单轮对话的终端 TUI：输入一句话 → 流式看到回复 → agent 可调用 read/write/edit/bash 四个工具 → 看到工具结果 → 继续对话直到输出最终回答。

## User Stories

### 核心对话流

1. As a user, I want to type a prompt into a terminal input area and submit, so that I can ask the agent to perform a coding task.
2. As a user, I want to see the assistant's text response stream in token-by-token in the terminal, so that I get immediate feedback without waiting for the full response.
3. As a user, I want the streaming text to appear smoothly at ~50-100 tokens per second, so that reading feels natural.
4. As a user, I want completed text blocks to stay visible and not flicker or redraw, so that the terminal output is stable.

### 工具执行

5. As a user, I want the agent to read files from my workspace, so that it can understand my code before making changes.
6. As a user, I want the agent to write new files, so that it can create configuration, scripts, or source files.
7. As a user, I want the agent to edit existing files, so that it can fix bugs or refactor code without my manual intervention.
8. As a user, I want the agent to run shell commands, so that it can install dependencies, run tests, or check git status.
9. As a user, I want to see which tool is currently running with its arguments, so that I know what the agent is doing.
10. As a user, I want to see the output of a completed tool, so that I can verify what was read, written, edited, or executed.
11. As a user, I want tool results to use the terminal's color for visual distinction, so that I can scan them quickly.

### 错误与中断

12. As a user, I want the agent to handle API failures (rate limit, connection error) gracefully without crashing, so that I don't lose my typed prompt.
13. As a user, I want to see a clear error message when the API call fails, so that I know what went wrong.
14. As a user, I want to interrupt a running request with Ctrl+C, so that I can cancel a runaway tool or a stalled API call.
15. As a user, I want the agent to preserve any partial text already streamed when I interrupt, so that I can read what was generated before cancellation.
16. As a user, I want the agent to reject tool execution when the model response was truncated (max_tokens), so that I don't run commands with cut-off arguments.

### 多轮工具链

17. As a user, I want the agent to make multiple sequential tool calls when needed, so that it can read a file, then edit it, then run tests — all in one turn.
18. As a user, I want tool results to feed back into the LLM context automatically, so that the agent can use them to decide the next action.

### TUI 体验

19. As a user, I want to launch the agent with a single CLI command, so that I can start working immediately.
20. As a user, I want an input area at the bottom of the terminal with a prompt indicator, so that I know where to type.
21. As a user, I want an active tool call to show a visual indicator while it is running, so that I know the agent is working even when no text is streaming.
22. As a user, I want the TUI to show basic session stats (turn count, tokens used) in a header area, so that I have context awareness.

## Implementation Decisions

### 项目结构

- **Monorepo 3 包**：`@mini-pi/ai`、`@mini-pi/agent`、`@mini-pi/tui`。pnpm workspace，`tsc --noEmit` 类型检查 + `esbuild` 构建。
- **依赖方向严格单向**：`tui → agent → ai`。ai 不依赖任何内部包，agent 只依赖 ai 的 StreamFn 类型，tui 是组装层，同时依赖 agent 和 ai。
- **Node.js 22+**，ES2022 target，ESM 模块。

### AgentMessage 管线

- **3 种消息类型**：`user | assistant | toolResult`。Pi 的 `bashExecution`/`custom`/`branchSummary`/`compactionSummary` 全砍。bash 是普通工具，结果走 `toolResult`。消息联合类型编译时封闭，不使用 declaration merging。
- **单阶段转换**：`transformContext`（扩展链式变换）砍掉——无扩展时它是恒等函数。合并为 `messagesToProvider(messages, maxTokens?)` 一个函数，3 种标准角色 1:1 映射到 Anthropic 的 `user`/`assistant`/`tool_result` 格式。
- **Tool use 直接解析**：不用 Pi 的 5 事件 streaming 归一化。assistant 消息到达后直接遍历 Anthropic content block 数组，提取 `tool_use` block，执行工具，结果追加为 `toolResult` 消息。

### Agent 循环

- **单层 `while (hasMoreToolCalls)` 循环**：Pi 的双层 while（内层工具链 + 外层 followUp）砍掉。单轮无并发用户交互，followUp 和 steering 队列都不需要。
- **8 种事件**：`agent_start` / `agent_end`、`turn_start` / `turn_end`、`message_start` / `message_update` / `message_end`、`tool_execution_start` / `tool_execution_end`。`tool_execution_update` 砍掉（工具流式进度非 MVP 必需）。
- **串行执行工具**：MVP 用 for 循环逐个执行。Pi 的 Promise.all 并行 + 完成顺序重排 + terminate 提前结束逻辑全部推迟。
- **Harness 全砍**：Pi 的 ~5360 行 Harness 代码（intent-settlement 两阶段提交、accept/drive 分离、effect gate、11 hooks、compaction、recovery/replay、lane storage）全部不进入 MVP。保留 4 个 agent 级回调为可选参数：`beforeToolCall`、`afterToolCall`、`shouldStopAfterTurn`、`transformContext`——~500 行等价逻辑。

### StreamFn 契约

来自 spike 05，一次 API smoke test + 9 单测已验证。核心类型形状：

```ts
// AgentEvent union — 5 variants
type AgentEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_use_start'; id: string; name: string }
  | { type: 'tool_use_delta'; id: string; inputJsonDelta: string }
  | { type: 'tool_use_end'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'error'; message: string };

// Stop reason — maps Anthropic stop_reason + internal errors
type StopReason = 'end' | 'length' | 'toolUse' | 'stopSequence' | 'refusal' | 'error' | 'aborted';

// The seam — never throws
type StreamFn = (
  prompt: string,
  tools: ToolDef[],
  signal: AbortSignal,
  onEvent: (e: AgentEvent) => void,
) => Promise<AssistantMessage>;
```

- **no-throw 包装 ~15 行**：整个 streaming loop 包一个 try/catch，所有 failure 都返回带 `stopReason: "error" | "aborted"` 的 AssistantMessage。abort 检测用字符串匹配 SDK 错误消息。
- **3 个 SDK 陷阱**：① tool_use delta 按 `index` 寻址（非 `id`），需维护 index→id 和 id→block 双 Map；② `stop_reason` 在 `message_delta` 事件中不在 `message_stop`；③ `pause_turn` 映射为 `toolUse`。

### TUI

来自 spike 04，headless benchmark（5 档速率）+ interactive demo 已验证。

- **Ink 4.x + React 18**：~30 FPS terminal output，无数据丢失，无闪烁撕裂。`ink-text-input` v5 兼容 Ink 4.x。
- **按 token 渲染**：不按字符。30 FPS 终端逐字无意义，token 级粒度减少 ~4x state 更新。
- **`<Static>` 组件存已完成块**：一旦文本段落或工具结果完成，移入 `<Static>` 避免重渲染历史文本。
- **`useTransition` 做帧对齐**：如果 token 到达快于 Ink 帧率，批量更新到帧大小 chunks。

### 4 个内核工具

每个工具定义：`name` + `description` + `parameters`（JSON Schema）+ `execute(callId, args): Promise<ToolResult>`。

- **read**：读文件，参数 `path`（相对工作区）+ `offset`/`limit`（可选）。返回内容，自动 truncate 到 2000 行/50KB。
- **write**：写文件，参数 `path` + `content`。覆盖式写入，文件不存在则创建。
- **edit**：替换式编辑，参数 `path` + `old_string` + `new_string`。精确匹配 `old_string` 必须唯一，否则报错。
- **bash**：执行 shell 命令，参数 `command` + `description`。返回 stdout + stderr + exit code。继承用户 shell 权限，不做内置沙箱。

### 配置

- API key 从 `ANTHROPIC_API_KEY` 环境变量读取。
- 模型在启动参数中指定，默认 `claude-sonnet-5`。

## Testing Decisions

### Seam

唯一测试 seam = **StreamFn 契约**。三包各自在它两侧测试：

- `ai` 包：对 Anthropic SDK 的 mock 响应测试 StreamFn 实现（事件顺序、stop_reason 映射、错误编码、abort 处理）。Spike 05 的 9 单测即先例。
- `agent` 包：注入 fake StreamFn（同步 yield 预定义事件），断言事件序列、工具调用顺序、消息产物。不碰真实网络。
- `tui` 包：用 fake AgentEvent 序列驱动 Ink 组件渲染，检查输出。Spike 04 的 headless benchmark 即先例。

### 测试原则

- 测外部行为，不测内部实现。断言事件序列和最终状态，不对内部循环变量或类字段做断言。
- 每个包独立可测——agent 不需要真实 API key，tui 不需要真实 agent 循环。
- Vitest 作为测试框架（Node 原生 ESM，快，API 兼容 Jest）。

## Out of Scope

以下明确不在此 spec 范围内（v0.2+ 或永久排除）：

### v0.2 之后加入

- 多轮会话 + JSONL 持久化（session tree、leaf 指针、会话恢复）
- 上下文压缩（compaction，token 管理）
- CLI 非交互模式（`--prompt "xxx"`）
- 自定义工具注册（硬编码，非插件）
- Slash commands（`/compact`、`/clear` 等）
- Skills 渐进披露（SKILL.md 发现 + 系统提示词按需加载）
- 多行输入编辑
- Markdown 语法高亮渲染

### 永久排除

- Extensions / hook 链插件系统
- 多模型供应商切换（transformMessages）
- RPC 模式 / JSONL frame 协议
- pi-server / pi-client 分布式架构
- chord 应用组合运行时
- pi-protocol CBOR 协议
- MCP client/server
- 权限弹窗 / Plan Mode / 子 agent 系统
- OAuth 登录流程（仅 API key）
- 容器化沙箱隔离
- Pi 包分发机制（Skills 用本地目录加载）

## Further Notes

- 所有工具执行继承用户 shell 权限。不需要安全沙箱——这是个人工具，用户对 agent 行为负责。
- 构建产物通过 esbuild 打包为单文件 `dist/cli.mjs`，`node dist/cli.mjs` 直接启动，无需 npm 发布。
- 参考上游 Pi 源码时应提取核心抽象而非照搬实现——我们有意裁掉了扩展层，实现细节会有分歧。
- Spike 代码在 `.scratch/mini-pi-agent-v2/spikes/` 下保留，作为实现时的参考先例，但不会被正式包引用。