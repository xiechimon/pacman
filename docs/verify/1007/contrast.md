# L4 pages 增量面对比度实测（#1007 验收模板 v3 项 3）

方法 = #909 实测门同款：token hex 直取 shadcn.css（#1002 落仓值，非 oklch），alpha 档按 sRGB 直叠合成后算 WCAG 对比度；阈值 4.5:1（本域增量文本全 ≤14px 常规档）。全局 109 对色板与 chip 五对槽已由 #988 双模封账，不重测；此处只测本车道新组合的表面。

## dark

| 组合 | 对比度 | 4.5:1 |
|---|---|---|
| muted-foreground / card  (settings labels, popover crumbs, picker head) | 7.18 | PASS |
| muted-foreground / muted@50-over-card  (task-row meta, history meta) | 6.87 | PASS |
| foreground / muted@50-over-card  (task-row title link) | 12.44 | PASS |
| foreground / card  (Badge outline ink, values) | 13.00 | PASS |
| secondary-foreground / secondary  (Badge secondary: 托管 chip) | 11.87 | PASS |
| destructive / card  (inline error rows) | 8.84 | PASS |

## light

| 组合 | 对比度 | 4.5:1 |
|---|---|---|
| muted-foreground / card  (settings labels, popover crumbs, picker head) | 10.73 | PASS |
| muted-foreground / muted@50-over-card  (task-row meta, history meta) | 10.41 | PASS |
| foreground / muted@50-over-card  (task-row title link) | 15.65 | PASS |
| foreground / card  (Badge outline ink, values) | 16.14 | PASS |
| secondary-foreground / secondary  (Badge secondary: 托管 chip) | 15.17 | PASS |
| destructive / card  (inline error rows) | 6.09 | PASS |

结论：全部 PASS。
