# A4-deep 全站深收编报告（icon / quiet / 危险禁用形）

> 票：docs/a3/tickets/deep-adoption.md。契约上游 = `7e4f104bb`（Button icon/quiet variant + danger:disabled、Chip mini）。
> 范围：board / detail / overlays / chief+schedules 四域 13 个点位；ui/、tokens.css、parity 基准、motion.css 未触碰。
> 本票 Chip mini 无消费点（票面范围表未列 chip 点位），未动用。

## 收编结果（15 处按钮 + 1 条面规则移除）

| # | 点位 | 文件 | 原语 | per-face 保留（`.btn.<face>` 叠特异性） |
|---|---|---|---|---|
| 1 | `.board-guide` | board.tsx + board.css | `Button icon` | 28×28 几何 |
| 2 | `.board-column-collapse` | board.tsx + board.css | `Button icon` | 25×25 + 双 margin 几何 |
| 3 | `.todo-card-branch` | todo-card.tsx + board.css | `Button icon` | 13×16 + flex:none + 负 margin 几何；**dim 墨（canon 偏差，原 tertiary 之外实测值）** |
| 4 | `.dlg-copy` | branch-dialog.tsx + detail/overlays.css | `Button icon` | flex:none + 24×24 几何（radius 8 = 原语默认，A3 裁决 #1 已归一，声明删除等值） |
| 5 | `.new-task-close` | new-task-dialog.tsx + overlay.css | `Button icon` | margin-left:auto + 28×28 几何（票面写 24×24，css 实测 28×28 为准） |
| 6 | `.new-task-tag-add` | new-task-dialog.tsx + overlay.css | `Button icon` | **1px 描边 + 9999 圆 + dim 墨（canon 偏差：圆环加钮自成一形，非 FAB 族）** + 20×20 几何 |
| 7-9 | `.new-task-tools` ×3 | new-task-dialog.tsx + overlay.css | `Button icon`（无类名） | 30×30 几何走既有 `.new-task-tools button` 元素选择器（特异性 0,1,1 天然压 size 档） |
| 10 | `.delete-confirm-cancel` | delete-confirm.tsx + overlay.css | `Button quiet` | 12px/16px 字排 + `height:auto`（挡 `.btn--standard` 32 泄漏）；dim 墨 = quiet canon 等值删除 |
| 11 | `.delete-confirm-cancel`（项目面） | delete-project-confirm.tsx | `Button quiet` | 同上——两面共享 `.delete-confirm-*` css 面，皮肤规则删除后必须同构收编，归入票面「删除确认弹窗」点位 |
| 12 | `.delete-confirm-delete:disabled` | overlay.css | 面规则**删除** | 禁用降透明度（opacity .5 + cursor default）已由原语 `.btn--danger:disabled` 承载，值逐字等值；覆盖任务/项目两面删除钮 |
| 13 | `.chief-send` | chief-drawer.tsx + chief.css | `Button icon` | **实底双态（seg-active/indigo + dim/on-accent 墨，canon 偏差：icon 皮肤=透明底）** + 32×32 + margin-left:auto；`.btn.chief-send.is-on:hover` 显式钉住，防原语 icon hover 增亮（同特异性 0,3,0）随打包顺序渗进实底态 |
| 14 | `.chief-set-back` | chief-settings.tsx + chief.css | `Button icon` | 28×28 + margin-left:14px + **radius 6（canon 8 的 per-face 偏差，r7 实测，background:none 下不可见仍保真）** |
| 15 | `.sched-card-more` | schedules-page.tsx + pages.css | `Button icon` | flex:none + 24×24 几何 |
| 16 | `.sched-form-close` | schedules-page.tsx + pages.css | `Button icon` | 24×24 几何 |

皮肤/几何拆分律执行：所有散写皮肤声明（display/align/justify 居中、background、border、padding、cursor、canon 等值 color/radius）删除；几何（width/height/margin/flex/position/z-index）与非等值皮肤偏差 per-face 保留。`.todo-card-branch, .todo-card-action` 共享的 position/z-index 规则（stretched-link 层级）原样未动。

## 钉扎四面检查记录（动手前逐点位 grep）

13 个类名过四面：

- **① apps/web e2e**：`.board-guide`（dead-buttons.spec.ts:62 click + aria-expanded + popover 内容断言）、`.board-column-collapse`（collapse-family.spec.ts:76/101 click）、`.delete-confirm-cancel`（project-settings-delete.spec.ts:45 click）、`.delete-confirm-delete`（:70/85 click + toBeDisabled/toBeEnabled 闸门断言）。→ 四类名全部经 className 叠加保留，aria-expanded / disabled 行为经 Button rest 透传不变。
- **② integration/test**：13 类名零命中（m5 钉的 `.new-task-start` 是 A3 已收编面，非本票点位）。
- **③ parity 点击矩阵**：`clicks:['.board-guide']`（board-guide-open-light）、`clicks:['.board-column-collapse']`（board-column-collapsed-light/dark）→ 类名保留可点；overlay-delete-light/dark/fresh-dark 静态捕获 delete-confirm 面 → quiet 收编受零像素闸约束（已过，见下）。
- **④ 视觉 spec computed-style 几何断言**：grep `radius).toBe|height).toBe|width).toBe|toHaveCSS` 全部 spec——仅 collapse-family.spec.ts:81 `width 40`（列 strip 盒，非本票按钮）；13 类名无 computed-style 钉扎。

hover 态专项核查：parity `page.click` 后指针驻留触发器，但 board-guide 打开态被全屏 `.overlay-click-catcher`（fixed inset:0 z-29）接管 hit-test，触发器不吃 `:hover`；board-column-collapse 点击后即卸载（折叠为 strip）。229/229 实测证实无 hover 像素渗入。motion.css 的 `.todo-card-branch:hover` / `.new-task-close:hover` 背景 hover 家族律靠类名命中，原样生效。

## 已知行为变化（静态零像素、无钉扎冲突）

- 原无 hover 色变的 icon 面（board-guide、dlg-copy、sched-* 等）收编后获得 canon hover 增亮（tertiary→secondary）——icon 皮肤契约行为，收编目的本身。
- 有 hover 背景的面（todo-card-branch、new-task-close）hover 背景现在带 8px 圆角（原语 `.btn` radius，原 0）——A3 圆角归一裁决 #1 同方向；静态捕获不可见。
- `.todo-card-branch` hover 时 dim→secondary 增亮压过 per-face dim（原语 hover 特异性 0,3,0）——canon hover 行为，静态不受影响。

## 上游观察（ui/ 本票冻结，报主线）

`Button` 注释声明「icon/quiet/text 不吃 size」，但 css 只豁免了 padding，`.btn--standard` 的 `height:32px` 仍泄漏到 icon/quiet 面。本票逐面以 `.btn.<face>` height/width 覆盖化解（icon 面本就 per-face 几何；quiet cancel 加了 `height:auto`）。若后续原语修正（如 icon/quiet/text 不渲染 size 类），各面 per-face 几何规则不受影响，可直接受益。

## 验证结果（全绿）

| 闸 | 命令 | 结果 |
|---|---|---|
| lint | `pnpm lint`（biome ci） | 通过 |
| typecheck | `pnpm typecheck` | 5 包全 Done |
| parity | `PARITY_PORT=8397 pnpm parity` | **229/229 pairs green**（皮肤等值替换零像素实证） |
| E2E 全量 | `apps/web && npx playwright test` | **229 passed**（36.8s） |
| m5 单文件 | `integration && npx vitest run test/m5-web-e2e.test.ts` | **3 passed**（11.65s） |

## 未决项

本票范围内 0 项。票面「明确不做」清单（⌘K Input palette、`.overlay-btn` 族、res-pill chip canon、delete-confirm-input 30px、FAB 9999 族）原样遗留，不属本票。
