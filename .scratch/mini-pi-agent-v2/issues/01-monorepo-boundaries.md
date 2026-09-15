---
labels: [wayfinder:grilling]
parent: map.md
---

---
labels: [wayfinder:grilling]
parent: map.md
status: closed
---

## Question

monorepo 的包边界画在哪？Pi 有四层拓扑（chord → pi-ai/pi-agent-core/pi-tui → pi-coding-agent），但我们砍掉了 chord、RPC、多供应商、扩展系统。需要决定：

1. 哪些 Pi 层可以合并？
2. `pi-ai`（AI 接口）和 `pi-agent-core`（agent 循环）在单供应商场景下是否应该合并？
3. TUI 层是否应该独立成包，还是在 agent 包里做？

---

## Resolution

3 包结构，`@mini-pi` scope，`tsc --noEmit` + `esbuild` 构建：

```
packages/ai/       → Anthropic SDK 包装（StreamFn no-throw、stopReason 映射）
packages/agent/    → Agent 循环 + 事件 + 工具 + 消息模型
packages/tui/      → Ink 组件树（流式渲染、输入区、CLI 入口）
```

依赖方向：`tui → agent → ai`。ai 不依赖任何内部包，agent 只依赖 ai，tui 是组装层。