# 05: @mini-pi/tui — Ink TUI + 端到端串线

**What to build:** Ink 4.x + React 18 TUI 应用，串起真实 StreamFn + 真实工具 + agent 循环。启动后看到终端界面，输入 prompt → 流式看到回复 → 工具执行显示 → 最终回答。端到端可 demo。

**Blocked by:** 01, 02, 03, 04 (needs all packages complete).

**Status:** done

## Acceptance criteria

- [x] `pnpm start` 或 `node dist/cli.mjs` 启动 TUI，看到终端界面
- [x] 界面分两个区域：上部流式输出区、底部输入区（带 `>` 提示符号）
- [x] 输入区用 `ink-text-input` v5，支持单行文本输入和回车提交
- [x] 提交 prompt 后输入区禁用，显示"思考中"指示
- [x] 流式文本按 token 级粒度渲染到输出区（非逐字符）
- [x] 已完成的文本段落移入 `<Static>` 组件，不再参与重渲染
- [x] 工具调用显示：名称 + 参数摘要 + 执行中 spinner → 完成后显示结果
- [x] 工具结果用终端 dim 色渲染，与普通文本视觉区分
- [x] 界面顶部显示 turn 计数和 token 用量
- [x] Ctrl+C 中断当前请求，保留已流式输出的部分文本
- [x] API 错误时界面显示错误消息，不崩溃
- [x] API key 从 `ANTHROPIC_API_KEY` 环境变量读取
- [x] 启动参数接受 `--model` 指定模型，默认 `claude-sonnet-5`
- [x] 端到端 smoke：启动 TUI → 输入 "read package.json" → 看到工具调用和文件内容