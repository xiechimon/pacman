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

v0.1 MVP 范围已定：单轮对话 TUI，Anthropic only，4 内核工具，无会话持久化。后续功能的加装顺序需要决定。候选功能：

1. **多轮会话 + JSONL 持久化**（session tree、leaf 指针、会话恢复）
2. **上下文压缩**（compaction，长会话的 token 管理）
3. **Slash commands**（`/compact`、`/clear`、`/model` 等）
4. **多行输入编辑**（JLine 级别或 Ink 自定义，当前是单行 TextInput）
5. **CLI 非交互模式**（`--prompt "xxx"` 单次执行，不走 TUI）
6. **Skills 渐进披露**（SKILL.md 发现 + 系统提示词按需加载）
7. **自定义工具**（硬编码注册，非插件——比如 `web_fetch`、`todo_write`）
8. **Markdown 渲染**（代码高亮、表格、链接）

哪种排序最合理？哪些可以并行加？

---

## Resolution

混合策略，4 个版本从 MVP 到完整：

```
v0.1 MVP（单轮 TUI）
  → v0.2 多轮会话 + JSONL
    → v0.3 并行：上下文压缩 | CLI 模式 | 自定义工具
      → v0.4 并行：Slash commands | Skills
        → v0.5 多行输入 + Markdown 渲染（抛光）
```

v0.2 地基先打，v0.3 三线并行（压缩/CLI/工具互不依赖），v0.4 Skills+Slash 一起出（Skills 触发方式本身依赖 slash command），v0.5 抛光。