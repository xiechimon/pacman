# A3-board 收编报告

board 域散写 UI 收编到 ui/ 原语层 + 圆角归一（6px → 8px）。任务书 `docs/a3/tickets/board.md`；裁决依据 `docs/a3/diff-audit.md`（2026-09-26 用户拍板）。

## 收编清单（文件 / 原类名 → 原语 variant）

| 文件 | 原散写 | 收编形态 | per-face 差值（原语表达不了，留 board.css） | 别名保留原因 |
|---|---|---|---|---|
| `board.tsx` | `.board-new-task` `<button>` | `Button variant="text" size="compact"` | `width: 59.5px`、`gap: 11px`、`font-size: 14px`（r7 topbar 实测；`.btn.board-new-task` 复合选择器 0-2-0 钉死对 `.btn` 13px 字号的覆写，不依赖 CSS 打包顺序） | e2e `newtask-project-select.spec` + parity `matrix.mjs` clicks 钉类名 |
| `todo-card.tsx` | `.todo-card-action--primary` / `--ghost` 两个条件分支 `<button>` | `Button variant={action.kind} size="card"`（kind 与 variant 一一同构，单源 `columns.ts cardAction`；两分支收敛为单节点） | `padding: 0 7.25px` + `flex: none`（`.btn.todo-card-action` 0-2-0 钉死对 `.btn--card` 8px 内距的覆写） | e2e `board-dnd.spec` 钉 `.todo-card-action--ghost` |
| `notify-banner.tsx` | `.board-notify-banner-action` `<button>` | `Button variant="primary" size="compact"` | `flex: none` + `margin-left: auto`（布局位） | e2e `notify-banner.spec` 钉类名 |

原散写块删除的属性（高度/内距/字色/描边/光标/line-height）全部与 `.btn`/`.btn--primary`/`.btn--ghost`/`.btn--card`/`.btn--compact` 同值（line-height 例外：原 primary 26px / ghost 24px 弃用，flex `align-items: center` 居中接管，diff-regions 实证零文本漂移）。

## 圆角归一（6px → 8px，本域 5 处）

| 位置 | 归一方式 |
|---|---|
| `.board-notify-banner-action`（board.css） | 删散写 radius，Button 原语 8px 承载 |
| `.todo-card-action`（board.css） | 同上 |
| `.rail-row::before` pill（sidebar.css:340） | 值改 8px |
| `.sidebar-row` / `.sidebar-subrow` / `.sidebar-group` 的 `::before` pill（sidebar.css:417） | 值改 8px |
| `.sidebar-team-collapse` hit box（sidebar.css:435） | 值改 8px |

sidebar 三处的入编判定：行 pill 是**可交互行**的圆角形态，非 diff-audit #1 豁免名单里的「非交互元素装饰角」（名单 = 头像 4px / 徽章 9999px 类）；全站 6px×35 的按钮圆角普查将其计入。若主线读作装饰豁免，三处各一行改回即回滚。

不动（豁免或已达标）：`.project-avatar` 4px、徽章 9999px×6、`.sidebar-kbd` 3px（键帽装饰）、`.sidebar-online-dot` 50%、`.sidebar-team-row--active` 8px（已达标）、`.board-column-list[data-drop]` 8px（已达标）、edge 家族三处 `var(--edge-radius)`（token 单源）。

## 卡片判定（票面动作 3）：保留 CSS 类

`.todo-card` / `.board-column` / `.board-notify-banner` 不换 `<Card>` 组件：三者的 radius / ring / shadow / bg 已全部 token 单源（`--edge-radius` / `--edge-ring` / `--card-shadow` / `--card-bg` / `--col-bg` / `--surface-secondary`），与 Card 原语（card / inset / elevated 三 tone）零值差；换组件会把 `<article>` / `<section>` 降级为 `<div>`（语义回归）且零视觉收益。票面允许此选项（「保留 CSS 类但确认值全部来自 token」）。

## 保留散写的控件（原语无对应形态）

- `.board-guide`（28×28 图标钮）：Button 无 icon variant，text 变体会把字色刷成 indigo（错色）——保留散写。无 radius 声明，无归一点。e2e `dead-buttons.spec` 钉类名（未动）。
- `.todo-card-branch`（13×16 微图标钮）、`.board-column-collapse`（25×25）、`.board-column-strip`（整列收展钮）：非原语尺寸档，保留散写（`.todo-card-branch`/`.todo-card-action` 的 `position: relative; z-index: 1` 伸展链覆盖律原样保留）。
- sidebar / rail 导航行（36px / 32px 行、react-router `<Link>`）：Button 是 `HTMLButtonElement` 原语，不适用；行 pill 样式与圆角归一见上节。
- chip（票面动作 4）：本域无状态 chip，跳过。

## 验证

- `pnpm lint`：exit 0（175 warnings 均为存量、board 文件零命中）。
- `pnpm typecheck`：`pnpm -r` 全绿。
- `PARITY_PORT=8391 pnpm parity`：见下节。

## parity 结果

`PARITY_PORT=8391 pnpm parity`：**229/229 全绿，0 红项**（exit 0；report.json 复核 total=229 red=0）。

圆角归一的实际像素变化存在但未触发红项：变化面积（按钮角 + 行 pill 圆角）占 1440×732 视口比例过小，SSIM 降幅远低于 0.85 门槛。抽查定位（`diff-regions.mjs`，board-confirm-card-light vs r7 基线）：热区仅两簇——sidebar 选中 pill 圆角（x24/y384-432）与卡片动作钮圆角（x1056-1368/y168），mean cell diff 0.06；无其它漂移，实证收编零回归（line-height 弃用 / 字体 / 内距差值全部无痕）。

基准像素与现状不再逐像素一致（角部 2px），但 SSIM 闸全绿；是否 rebaseline 归主线合并后统一决策（diff-audit 既有口径，本 lane 不动基准）。

## 未决问题

1. **sidebar pill 归一解读**：3 处 pill/hit-box（rail-row / 行 ::before / sidebar-team-collapse）按「可交互控件圆角」解读入编归一；若主线读作装饰豁免，各一行改回 6px 即回滚——两个方向都不触发 parity 红项，闸门对此中性。
2. **icon 按钮家族**：`.board-guide`、`.todo-card-branch`、`.board-column-collapse` 等原语无对应形态保留散写；后续若 Button 扩 icon variant（原语作者决策，本票禁动 ui/），可再收编。
3. **基准像素漂移**：见上节——rebaseline 决策归主线。
