---
labels: [wayfinder:prototype]
parent: map.md
---

---
labels: [wayfinder:prototype]
parent: map.md
status: closed
---

## Question

Ink 是一个 React reconciler for terminals。流式渲染（逐 token 更新终端）是 agent TUI 的核心体验。需要验证：

1. Ink 在每秒 50-100 token 的 streaming 速率下是否流畅？（React reconciler 的开销）
2. Markdown 代码块在流式渲染中如何增量解析？（公共块未闭合时）
3. 输入区（多行编辑）和输出区的布局怎么分？（flexbox in terminal）
4. 是否需要像 Pi 一样做 viewport 裁剪（只渲染可见区域）？

产出：一个可跑的 Ink spike，展示 fake streaming 文本 + 输入区。

---

## Resolution

Spike 验证通过（可交互 TUI + headless benchmark 5 档速率）。关键结论：

1. **Ink 可行** — ~30 FPS 输出批处理，无数据丢失，无闪烁撕裂。50-100 token/sec 流畅。

2. **按 token 渲染，不按字符** — 30 FPS 终端逐字无意义。token 级粒度减少 ~4x 状态更新。

3. **用 `<Static>` 存已完成块** — 避免在每次 stream 事件时重渲染全部历史文本，防止累积性能退化。

4. **`useTransition` 或 throttle 做帧对齐** — 如果 token 到达快于 Ink 帧率，批处理到帧大小块。

5. **`ink-text-input` v5 兼容 Ink 4.x** — 输入组件可以直接用。

详见 [04-ink-streaming-spike-findings.md](04-ink-streaming-spike-findings.md)，spike 在 [spikes/04-ink-streaming/](../spikes/04-ink-streaming/)