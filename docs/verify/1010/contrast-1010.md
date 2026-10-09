# #1010 增量面对比度实测（better-colors，验收模板 v3 项 3）

select.tsx 手写件退役 → registry compound select 后，本票**增量面** = registry
select 弹层/触发钮在页面上渲染的三对文本-衬底。全局色板已在 #988 双模 109 对
0 fail 封账，此处不重测全局，只测本票新载体（registry select）落地的三对。

口径（better-colors）：浏览器实测 `getComputedStyle` 的渲染前景色，衬底取「元素
向上第一个 alpha≈1 的 background-color」，前景若半透明则 alpha 合成到衬底后再算
WCAG 相对亮度对比度——**实测非估算**。测量在 live 栈（`drive-1010-select.mjs`，
schedules 新建定时弹层的 时 Select）上、进场动效落定后取静息色，light + dark 双模。

| 面对 | 前景 | 衬底 | light | dark | 判据 |
|---|---|---|---|---|---|
| 弹层行文本 / 弹层底（`bg-popover`） | `text-popover-foreground` | popover | **16.14:1** | **13:1** | ≥4.5 ✅ |
| 聚焦行文本 / accent 底（`focus:bg-accent`） | `accent-foreground` | accent | **15.17:1** | **11.87:1** | ≥4.5 ✅ |
| 触发钮文本 / 合成底 | 值文案墨 | 触发钮合成衬底 | **16.14:1** | **13:1** | ≥4.5 ✅ |

实测原值（fg / bg，rgb）：

- light：行文本 `rgb(18,15,11)` / 弹层底 `rgb(240,235,230)`；聚焦行底 `rgb(234,228,224)`
- dark：行文本 `rgb(238,232,228)` / 弹层底 `rgb(38,34,31)`；聚焦行底 `rgb(45,41,38)`

结论：6 对（3 面 × 双模）全过，最低 **11.87:1**，零 fail。registry select 用的是
#988 封账色板上的既有 token（`bg-popover` / `text-popover-foreground` / `focus:bg-accent`
/ `accent-foreground`），本票未引入任何新色值——增量面即「既有 token 在新载体上的
渲染」，实测确认对比度不因载体从手写壳换成 registry 件而回落。

复跑：`node .claude/skills/verify-pacman/scripts/drive-1010-select.mjs`（栈先在跑；
证据 `result.json` 的 `contrast` 节即本表数据源）。
