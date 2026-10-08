# #1008 better-colors 增量面实测（验收模板 v3 第 3 项）

口径：全局色板 #988 已双模 109 对 0 fail 封账，不重测；本表只测**本车道迁移新引入的渲染面**（registry 弹层件在新色板上的实际文本对）。方法 = better-colors skill「measure the rendered pair」：fixture 生产包（`vite preview --mode fixture`，1440 视口）上逐面取 computed color，背景按祖先链 alpha 合成为实渲染值，WCAG 相对亮度算比值——全部实测，零估算。暗模 = :root 缺省，亮模 = 根挂 `.light`（本仓主题机制）。

结果：**22 对（11 面 × 双模）全 PASS，最低 6.09:1（地板 4.5:1），无 HIGH/MEDIUM 发现 → Approve**。

| 面 | 模 | fg | bg | ratio | font-size |
|---|---|---|---|---|---|
| tooltip-content 正文（bg-foreground/text-background 反转对） | dark | #1f1b18 | #eee8e4 | 14.08 | 12px |
| tooltip 内 Kbd（反色变体，background/10 合成） | dark | #1f1b18 | #d6d1cd | 11.28 | 12px |
| Popover 行文本（项目 listbox，popover-foreground/popover） | dark | #eee8e4 | #26221f | 13 | 12px |
| AlertDialog 标题（discard 闸） | dark | #eee8e4 | #26221f | 13 | 14px |
| AlertDialog 次要钮（继续编辑，muted-foreground/popover） | dark | #b3aeaa | #26221f | 7.18 | 12px |
| Dialog 行文本（mention-picker 类目行） | dark | #eee8e4 | #26221f | 13 | 14px |
| Popover 三级墨行（chip popover owner 行，text-tertiary） | dark | #b3aeaa | #26221f | 7.18 | 12px |
| DropdownMenu 行文本（more-menu） | dark | #eee8e4 | #26221f | 13 | 14px |
| DropdownMenu destructive 行（删除） | dark | #ffabb7 | #26221f | 8.84 | 14px |
| Dialog 标题（sched-form DialogTitle） | dark | #eee8e4 | #26221f | 13 | 16px |
| Dialog 正文二级墨（sched 行 label，text-secondary） | dark | #d3ceca | #26221f | 10.11 | 13px |
| tooltip-content 正文 | light | #f6f1ec | #120f0b | 17.03 | 12px |
| tooltip 内 Kbd（background/20 合成） | light | #f6f1ec | #0f0c09 | 17.39 | 12px |
| Popover 行文本 | light | #120f0b | #f0ebe6 | 16.14 | 12px |
| AlertDialog 标题 | light | #120f0b | #f0ebe6 | 16.14 | 14px |
| AlertDialog 次要钮 | light | #36322e | #f0ebe6 | 10.73 | 12px |
| Dialog 行文本 | light | #120f0b | #f0ebe6 | 16.14 | 14px |
| Popover 三级墨行 | light | #595450 | #f0ebe6 | 6.31 | 12px |
| DropdownMenu 行文本 | light | #120f0b | #f0ebe6 | 16.14 | 14px |
| DropdownMenu destructive 行 | light | #9e2c49 | #f0ebe6 | 6.09 | 14px |
| Dialog 标题 | light | #120f0b | #f0ebe6 | 16.14 | 16px |
| Dialog 正文二级墨 | light | #36322e | #f0ebe6 | 10.73 | 13px |

未测面（不适用/非文本）：DialogOverlay 背板（bg-black/10 + blur，纯遮罩无文本，WCAG 对比要求不适用）；弹层 ring-foreground/10 描边（非文本 UI，边界辨识由投影+底色差承载，归 better-ui 面）。

复跑：起 fixture 预览（`corepack pnpm --filter @pacman/web exec vite preview --mode fixture --port <p>`），按上表面逐个开面后用 getComputedStyle + 祖先链 alpha 合成取对（测量函数见 git 历史中本车道工作脚本，或按 better-colors skill contrast.md 配方重写）。
