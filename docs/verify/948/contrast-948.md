# #948 overlay/ 域对比度实测（better-colors，验收模板 v2 第 3 项）

- 工具：`docs/verify/948/scripts/contrast-948.mjs`（本目录，可重跑）
- token 单源：`apps/web/src/styles/shadcn.css`（#915 翻值后现行正本）
- 算法：WCAG 2.x 相对亮度；tint 底 = alpha 合成（color-mix 渲染等价）后实算
- 阈值：文本 4.5:1（12px/13px 常规字重），大字号文本 3:1，非文本（图标/状态点）3:1
- 配对数：48（dark 24 / light 24）
- **FAIL：0**

| 配对 | 主题 | 前景槽 | 实际底 | 实测 | 阈值 | 结果 |
| --- | --- | --- | --- | --- | --- | --- |
| mention-chip todo | dark | `--spot-text-on-tint` | --spot-soft | 6.73:1 | 4.5 | PASS |
| mention-chip agent | dark | `--chip-done-fg` | --chip-done-bg | 7.84:1 | 4.5 | PASS |
| mention-chip project | dark | `--tile-orange-fg` | --tile-orange-bg | 7.6:1 | 4.5 | PASS |
| mention-chip machine | dark | `--col-dot-building` | --chip-idle-bg | 7.39:1 | 4.5 | PASS |
| mention-chip skill | dark | `--chip-idle-fg` | --chip-idle-bg | 6.55:1 | 4.5 | PASS |
| mention-chip file | dark | `--chip-idle-fg` | --chip-idle-bg | 6.55:1 | 4.5 | PASS |
| mention-icon todo | dark | `--spot-text-on-tint` | 18% tint over --popover-bg | 5.91:1 | 3 | PASS |
| mention-icon skill | dark | `--chip-idle-fg` | 18% tint over --popover-bg | 5.07:1 | 3 | PASS |
| mention-icon agent | dark | `--col-dot-done` | 18% tint over --popover-bg | 5.76:1 | 3 | PASS |
| mention-icon project | dark | `--tile-orange-fg` | 18% tint over --popover-bg | 6.01:1 | 3 | PASS |
| mention-icon machine | dark | `--col-dot-building` | 18% tint over --popover-bg | 5.64:1 | 3 | PASS |
| insert 钮 brand 字形 | dark | `--card-button` | --popover-bg | 7.61:1 | 4.5 | PASS |
| delete 行墨 | dark | `--stop` | --popover-bg | 8.83:1 | 4.5 | PASS |
| delete 行 hover（danger-soft tint） | dark | `--stop` | --danger-soft over --popover-bg | 6.5:1 | 4.5 | PASS |
| 菜单图标墨 | dark | `--menu-icon` | --popover-bg | 3.46:1 | 3 | PASS |
| 正文墨 on popover | dark | `--text-primary` | --popover-bg | 13.09:1 | 4.5 | PASS |
| 次级墨 on surface | dark | `--text-secondary` | --surface | 10.2:1 | 4.5 | PASS |
| 三级墨 on popover | dark | `--text-tertiary` | --popover-bg | 7.25:1 | 4.5 | PASS |
| 继续编辑钮墨 on dialog | dark | `--muted-foreground` | --dialog-bg | 7.25:1 | 4.5 | PASS |
| 搜索输入墨 on inset | dark | `--text-primary` | --surface-inset | 14.17:1 | 4.5 | PASS |
| 在途角标 on 黑 veil 55%（最坏底=白） | dark | `--text-on-veil` | rgb(0 0 0 / 0.55) over white | 4.76:1 | 4.5 | PASS |
| 机器点 online | dark | `--col-dot-done` | --surface | 8.49:1 | 3 | PASS |
| 机器点 offline | dark | `--col-dot-idle` | --surface | 8.06:1 | 3 | PASS |
| 项目 avatar 字形 | dark | `--project-avatar-fg` | --project-avatar-bg | 6.55:1 | 4.5 | PASS |
| mention-chip todo | light | `--spot-text-on-tint` | --spot-soft | 7.63:1 | 4.5 | PASS |
| mention-chip agent | light | `--chip-done-fg` | --chip-done-bg | 8.38:1 | 4.5 | PASS |
| mention-chip project | light | `--tile-orange-fg` | --tile-orange-bg | 5.53:1 | 4.5 | PASS |
| mention-chip machine | light | `--col-dot-building` | --chip-idle-bg | 5.13:1 | 4.5 | PASS |
| mention-chip skill | light | `--chip-idle-fg` | --chip-idle-bg | 5.98:1 | 4.5 | PASS |
| mention-chip file | light | `--chip-idle-fg` | --chip-idle-bg | 5.98:1 | 4.5 | PASS |
| mention-icon todo | light | `--spot-text-on-tint` | 18% tint over --popover-bg | 6.86:1 | 3 | PASS |
| mention-icon skill | light | `--chip-idle-fg` | 18% tint over --popover-bg | 4.89:1 | 3 | PASS |
| mention-icon agent | light | `--col-dot-done` | 18% tint over --popover-bg | 4.04:1 | 3 | PASS |
| mention-icon project | light | `--tile-orange-fg` | 18% tint over --popover-bg | 4.32:1 | 3 | PASS |
| mention-icon machine | light | `--col-dot-building` | 18% tint over --popover-bg | 4.19:1 | 3 | PASS |
| insert 钮 brand 字形 | light | `--card-button` | --popover-bg | 6.14:1 | 4.5 | PASS |
| delete 行墨 | light | `--stop` | --popover-bg | 6.01:1 | 4.5 | PASS |
| delete 行 hover（danger-soft tint） | light | `--stop` | --danger-soft over --popover-bg | 4.84:1 | 4.5 | PASS |
| 菜单图标墨 | light | `--menu-icon` | --popover-bg | 15.86:1 | 3 | PASS |
| 正文墨 on popover | light | `--text-primary` | --popover-bg | 15.86:1 | 4.5 | PASS |
| 次级墨 on surface | light | `--text-secondary` | --surface | 10.72:1 | 4.5 | PASS |
| 三级墨 on popover | light | `--text-tertiary` | --popover-bg | 6.34:1 | 4.5 | PASS |
| 继续编辑钮墨 on dialog | light | `--muted-foreground` | --dialog-bg | 10.72:1 | 4.5 | PASS |
| 搜索输入墨 on inset | light | `--text-primary` | --surface-inset | 16.71:1 | 4.5 | PASS |
| 在途角标 on 黑 veil 55%（最坏底=白） | light | `--text-on-veil` | rgb(0 0 0 / 0.55) over white | 4.76:1 | 4.5 | PASS |
| 机器点 online | light | `--col-dot-done` | --surface | 5.23:1 | 3 | PASS |
| 机器点 offline | light | `--col-dot-idle` | --surface | 5.54:1 | 3 | PASS |
| 项目 avatar 字形 | light | `--project-avatar-fg` | --project-avatar-bg | 4.5:1 | 4.5 | PASS |

全部配对过阈值；kind 身份色槽映射（mention-chip.ts 头注）实测成立。
