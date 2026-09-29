# 弹层行为契约对照：shadcn Dialog × 仓内 OverlayMount 家族（#418）

> 地图 #417（全站铺开 shadcn/ui）的研究子票。产出 = shadcn Dialog 开箱行为清单 ×
> 仓内浮层家族既有实现 × e2e 钉扎点，逐条判定「等价 / 需接线 / 仓内特有契约」，
> 供「弹层族迁移设计」当事实底座。只读调研，不含实现改动。

## 0. 一句话结论

**shadcn Dialog 的开箱行为是 radix Dialog 的开箱行为**（shadcn 只加了一层皮肤 + `data-slot` +
默认关闭钮 + Portal 组合），它的 Esc/遮罩/焦点圈定/焦点回陷/aria 全部由
`@radix-ui/react-dialog@1.1.23` + `dismissable-layer@1.1.19` + `focus-scope@1.1.16` +
`presence@1.1.6` 提供；**与仓内家族真正不兼容的不是行为清单，而是三处机制**：
（a）退场保挂载 —— radix `Presence` 只认 CSS **animation**（transition 一律立即卸载），
仓内 `useOverlayMount` 认 transition + JS 定时器；
（b）Esc 分层 —— radix 靠 layer 栈只给**最顶层**挂 document 捕获监听，仓内是每层各挂一个
`window` keydown 靠 `enabled`/`escMuted` 手工闸；
（c）焦点回陷 —— radix 回的是 `DialogTrigger` 的 ref，仓内所有弹层的触发钮都在 dialog 树**外**，
radix 拿不到 → 必须保留仓内 `returnFocusRef` 手工回陷（并显式 `preventDefault` 挡掉 radix 的空回陷）。
另有 4 处 shadcn 完全不覆盖、**必须额外接线**：`#193` 矮视口封顶三段律（max-height +
body 滚动 + foot 钉底）、`#389` 焦点入层的目标元素（首 tabbable ≠ 仓内想要的正文 textarea）、
遮罩色/圆角/阴影/焦点环的仓内实测值与 canon、`tw-animate-css`（`animate-in/out` 工具类的提供者）
在仓内**未安装**。最后：`radix-ui` / `class-variance-authority` / `clsx` / `tailwind-merge`
虽已写进 `apps/web/package.json`（#414），但**当前 checkout 的 node_modules 里一个都没有**，
迁移片开工前必须先 `pnpm install`。

## 1. 事实源与版本钉

| 对象 | 版本 / 位置 | 取法 |
|---|---|---|
| shadcn Dialog 生成源码 | `ui.shadcn.com/r/styles/new-york-v4/dialog.json`，deps = `cn` + `radix-ui` | agent-reach web 通道（jina reader） |
| shadcn AlertDialog 生成源码 | 同上 `/styles/new-york-v4/alert-dialog.json`，deps 同 | 同上 |
| 仓内 vendoring 口径验证 | `apps/web/src/components/ui/badge.tsx` 与 `new-york-v4/badge.json` 逐字 diff = 仅引号风格 + import 重写 | 本地 diff（见 §7 附注） |
| radix dialog 实现 | `@radix-ui/react-dialog@1.1.23`（`pnpm-lock.yaml:1395`）dist | unpkg via agent-reach |
| radix dismissable layer | `@radix-ui/react-dismissable-layer@1.1.19`（`pnpm-lock.yaml:1417`） | 同上 |
| radix focus scope | `@radix-ui/react-focus-scope@1.1.16`（`pnpm-lock.yaml:1452`） | 同上 |
| radix presence | `@radix-ui/react-presence`（`radix-ui@1.6.7` 依赖树） | 同上 |
| 仓内家族件 | `apps/web/src/overlays/dismiss.tsx`、`apps/web/src/overlay/use-esc.ts`、`apps/web/src/overlay/use-overlay-mount.ts`、`apps/web/src/ui/dialog-shell.tsx` + 19 个挂载点 | 本地读码 |
| 动画契约 | `apps/web/src/styles/motion.css`（`.overlay-mount` / `anim-*` / `data-overlay-state`） | 本地读码 |
| e2e 钉扎 | `apps/web/e2e/{overlay-focus,dialog-viewport,rerun-close-family,newtask-single-field,newtask-project-select,search-focus,hotkeys,machine-add-dialog,provider-add-dialog,secret-add-dialog,team-create-agent,chief-settings,chip-assign,dead-buttons,...}.spec.ts` | 本地读码 |

两条**当场撞到的事实**（与票面假设不符，施工期会卡）：

1. `apps/web/node_modules/radix-ui`、`node_modules/.pnpm/radix-ui@*`、`node_modules/.pnpm/@radix-ui+react-dialog@*`
   **全部不存在**；`apps/web/node_modules` 里连 `class-variance-authority` / `clsx` / `tailwind-merge` 都没有
   （20 个条目，均为 #414 之前的旧装）。票面「看 `apps/web/node_modules/radix-ui` 的 dist」这条路走不通，
   版本事实改以 unpkg 上同版本的 dist 为准（版本号由 `pnpm-lock.yaml` 钉死，与仓内声明一致）。
2. `apps/web/src/components/ui/` 目前只有 `badge/button/card` 三件，**没有 dialog**；
   仓内 shadcn 皮肤层 `apps/web/src/styles/shadcn.css` 也不含 `cn-dialog-*` 或任何 `animate-in/out` 定义。
3. shadcn 当前官网（2026-09）的 Dialog 文档页 API 引用已指向 **Base UI**（`base-ui.com/react/components/dialog`），
   而不是 radix。radix 变体仍由 `new-york-v4` registry 提供（下节取得的就是它），但
   `apps/v4/registry/bases/radix/ui/dialog.tsx`（main 分支）已经改成 `cn-dialog-overlay` /
   `cn-dialog-content` 这种「类名进主题 CSS」形态，skin 来源从组件内类串搬到主题变量层。
   仓内 `shadcn.css` 没有 `cn-*` 承接层 —— 若 CLI 后续切到该形态，皮肤会静默丢失
   （无 class 定义 = 无 scrim 色、无动画）。**迁移片开工前应先确认 CLI 4.21.0 生成的是哪一形态**
   （仓内 badge 与 new-york-v4 逐字一致 → 当前是 inline tailwind 形态）。

## 2. shadcn Dialog 开箱契约（逐条，附 radix 实现机制）

shadcn `new-york-v4/ui/dialog.tsx` 组成的件：`Dialog`(Root) / `DialogTrigger` / `DialogPortal` /
`DialogClose` / `DialogOverlay` / `DialogContent`（内部自带 Portal + Overlay + 关闭钮）/
`DialogHeader` / `DialogFooter` / `DialogTitle` / `DialogDescription`。
`DialogHeader/Footer` 是纯 `<div>`（无语义、无布局律）；`DialogTitle/Description` 只是 primitives 透传。

### 2.1 Esc 关

- 实现在 `dismissable-layer`：`onEscapeKeyDown` → `onDismiss()` → dialog 的 `context.onOpenChange(false)`
  （dist `@radix-ui/react-dialog@1.1.23` 第 289 行 `onDismiss: () => context.onOpenChange(false)`）。
- 监听形态：`ownerDocument.addEventListener('keydown', handleKeyDown, { capture: true })`，
  **只在 `isHighestLayer` 为真时注册**（dismissable-layer dist 第 128–145 行）；
  命中后 `event.preventDefault()` 再 `onDismiss()`（第 129–138 行）。
- 后果：**嵌套弹层一次 Esc 只关最顶层**，由 layer 栈自动保证，使用者无需写分层逻辑。

### 2.2 遮罩 / 外部点击关

- `DismissableLayer` 的 `usePointerDownOutside`：监听 **pointerdown**（不是 click），
  Content 传 `deferPointerDownOutside: true`（dialog dist 第 288 行）——
  内容里起手、拖到外面的交互不会立刻触发 dismiss（文本选择语义保护）。
- 模态额外保护（`DialogContentModal`，第 205–219 行）：右键 / ctrl+左键的 outside pointerdown
  `event.preventDefault()`（不关）；`onFocusOutside` 默认 `preventDefault()`（焦点跑到外面不关）。
- 面板内点击不关：dismissable layer 就是 Content 自身，不是独立遮罩元素。
- `disableOutsidePointerEvents: context.open`（第 204 行）→ dismissable-layer 在 open 期间把
  `document.body.style.pointerEvents = 'none'`（第 148–152 行），层自身 `pointerEvents: 'auto'`。
  **这是「遮罩吃点击」的机制**：不是铺一层透明元素，而是把 body 整个关掉命中。

### 2.3 焦点圈定（trap / Tab 环绕）

- `DialogContentImpl` 结构 = `FocusScope(asChild, loop: true, trapped: trapFocus)` 包 `DismissableLayer`
  （dialog dist 第 270–293 行）；模态路径 `trapFocus = context.open`（第 203 行）。
- FocusScope 提供：`focusin`/`focusout` 守卫（跑到容器外就 `focus(lastFocusedElement)` 拉回，
  focus-scope dist 第 72–110 行）、Tab 两端环绕（第 142–166 行，`loop` 时 `shift+Tab` 在首元素回末元素）、
  `MutationObserver` 兜底（容器内容被清空且焦点落 body 时拉回容器）。
- 另有 `useFocusGuards()`（dialog dist 第 269 行）在 body 首尾插守卫元素。
- **`trapFocus` 这个 prop 在模态模式下不可关**：`DialogContentModal` 展开顺序是
  `{...props, trapFocus: context.open, disableOutsidePointerEvents: context.open, ...}`，
  用户传的 `trapFocus` 被覆盖。想关 trap 只能 `Root modal={false}` 走 NonModal 路径 ——
  但那条路径**同时失去 Overlay（不渲染）、`aria-hidden` 兄弟隔离、body pointer-events 锁**。

### 2.4 开时焦点入层（autofocus）

- FocusScope 挂载时：`focusFirst(removeLinks(getTabbableCandidates(container)))` ——
  容器内**第一个可 Tab 元素**（`tabIndex >= 0` 且未 disabled/hidden，DOM 遍历序），
  全聚焦失败则聚焦容器本身（容器 `tabIndex: -1`）（focus-scope dist 第 111–126、170–176、185–196 行）。
- 覆写点 = `onOpenAutoFocus`（透传到 `FocusScope.onMountAutoFocus`，dialog dist 第 276 行）。

### 2.5 关闭后焦点回陷

- FocusScope 卸载回陷默认 `focus(previouslyFocusedElement ?? document.body)`，
  在 cleanup 的 `setTimeout(..., 0)` 里派发（focus-scope dist 第 127–139 行）。
- **dialog 模态路径覆盖了这个默认**（dialog dist 第 205–208 行）：
  `onCloseAutoFocus` → `event.preventDefault()` + `context.triggerRef.current?.focus()`。
  即**回陷目标是 `DialogTrigger`**；同一 Root 内没有渲染 DialogTrigger 时 `triggerRef.current` 为 null，
  **回陷失效，焦点落体**（body）。

### 2.6 aria 语义

- Content（`DialogContentImpl`，dialog dist 第 279–291 行）：`role="dialog"`、`id={contentId}`、
  有 `DialogTitle` 时 `aria-labelledby={titleId}`（`titlePresent` 由 Root 里 Title 的挂载计数决定）、
  有 `DialogDescription` 时 `aria-describedby={descriptionId}`、`data-state`。
- **没有 `aria-modal` 属性**（1.1.23 dist 内 `aria-modal` 出现 0 次）。模态隔离用
  `hideOthers(content)`（`aria-hidden` 包，第 196 行）把 body 里其它子树整体 `aria-hidden`，
  源码注释口径是「better supported equivalent to setting aria-modal」。
- Trigger：`aria-haspopup="dialog"`、`aria-expanded={open}`、`aria-controls={open ? contentId : undefined}`、
  `data-state`（第 127–130 行）。
- shadcn 的内置关闭钮：`DialogPrimitive.Close asChild` 包 Button，文案是 `<span className="sr-only">Close</span>`
  —— **硬编码英文，不参与仓内 i18n**。

### 2.7 受控 / 嵌套语义

- Root 全受控可用：`open` + `onOpenChange`（也可 `defaultOpen` 走非受控）；`DialogClose` 自身发 `onOpenChange(false)`。
- 嵌套 = dismissable-layer 的 context 集合：`layers`（栈序，决定 Esc 归属与 body pointer-events 回收）、
  `branches`（非 modal 子树，命中它不算 outside）、`dismissableSurfaces`（可接收 outside 点击的浮面）。
  → **仓内「Esc 分层」「外点只关内层」这两条定律在 radix 里是框架自带**。

### 2.8 动画钩子（data-state）

- `data-state="open"|"closed"` 出现在 Trigger / Overlay（第 170 行）/ Content（第 285 行）。
- 保挂载由 `Presence` 决定（presence dist 第 85–106 行）：关闭时若
  `getAnimationName(styles) === 'none'` 或 `display: none` → **立即卸载**；否则 `ANIMATION_OUT`，
  等 `animationend`/`animationcancel` 且动画名匹配才卸载（第 111–126 行），
  退出期间还会把 `animationFillMode` 置 `forwards`（动画结束后还原）。
- **关键限制：只认 CSS `animation`，不认 `transition`。**
- shadcn 用它做钩子：Overlay = `data-[state=closed]:animate-out data-[state=closed]:fade-out-0
  data-[state=open]:animate-in data-[state=open]:fade-in-0`；Content 额外 `zoom-out-95/zoom-in-95` + `duration-200`。
  这些 `animate-in/out`、`fade-in-0`、`zoom-in-95` 由 **`tw-animate-css`** 提供（shadcn 生态约定），
  仓内 **未安装该包，`shadcn.css` 也无任何定义**。[未验证：`duration-200` 是否经 tw-animate-css
  的 `--tw-duration` 转成 animation-duration —— 本报告未取 tw-animate-css 源码，仅登记 registry 源码里出现的类串。]

### 2.9 其它自带行为（易漏）

- **body 滚动锁**：`DialogOverlayImpl` 用 `react-remove-scroll` 包 Overlay，`shards: [context.contentRef]`
  （dialog dist 第 165–176 行）→ 弹层开着时页面不可滚。**仓内家族没有 scroll lock。**
- **Portal 到 body 末尾**（`DialogPortal` + `react-portal`，第 142–146 行）+ shadcn 的 `z-50` / `isolate`
  → 层序不依赖仓内那套 z 值表。
- `DialogContent` 皮：`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`、
  `max-w-[calc(100%-2rem)] sm:max-w-lg`、`grid gap-4 rounded-lg border bg-background p-6 shadow-lg outline-none`。
  **没有 max-height 封顶、没有 head/body/foot 三段 flex、没有 foot 钉底** ——
  滚动/胶囊头尾在官方文档里是「使用者自己写 sticky footer / scrollable content」（示例级，不入组件）。

## 3. 仓内家族实测清单

族的三块底座：

- `apps/web/src/overlays/dismiss.tsx`
  - `OverlayMount`：`useOverlayMount(open, exitMs)` 的保留挂载包裹层，`display: contents`，
    输出 `data-overlay-state="open|closed"` 与 `--exit-ms`。
  - `useEscapeClose(open, onClose)`：`window.addEventListener('keydown')`，**冒泡阶段、无 capture、
    无 preventDefault、无顶层判定、无 stopPropagation**；仅靠 `open` 作 enabled 闸。
  - `ClickCatcher`：`<button type="button" tabIndex={-1} aria-hidden="true">` 全屏透明层（`z-index: 29`）。
- `apps/web/src/overlay/use-esc.ts`：`useEscClose(onClose, enabled)` —— 形态同上（另一处重复实现）。
- `apps/web/src/overlay/use-overlay-mount.ts`：`OVERLAY_EXIT_MS=150` / `FADE_EXIT_MS=200` /
  `DRAWER_EXIT_MS=300`；保留挂载 = `setTimeout(exitMs)` 卸载，重开清定时器。
- `apps/web/src/styles/motion.css`：`.overlay-mount[data-overlay-state="closed"]` 翻 `visibility: hidden / pointer-events: none`；
  `anim-fade` / `anim-pop` / `anim-drawer` 是**进场 keyframe + 出场 transition** 的双轨写法
  （注记原文：「the keyframe does not rerun on a retained element」）。

挂载点实测（19 个文件，grep `OverlayMount|ClickCatcher|useEscapeClose` 计数）：

| 组 | 文件 | Esc | 遮罩 | role/aria |
|---|---|---|---|---|
| 共享壳 | `ui/dialog-shell.tsx`（14 个消费文件，见下） | 自带 `window` keydown effect | `.dlg-backdrop` + `target===currentTarget` | `role=dialog` + `aria-modal=true` + `aria-label={title}` |
| 模态自建 | `overlay/new-task-dialog.tsx`（含 3 内层：discard alertdialog / project listbox / mention picker） | 4 个 `useEscapeClose` + 1 个 `useEscClose`（`open && !projectOpen && !pickerOpen && !discardOpen`） | `.overlay-backdrop` button | `dialog` + `alertdialog` 各带 `aria-modal` |
| 模态自建 | `overlay/delete-confirm.tsx` / `delete-project-confirm.tsx` | 有 | backdrop | `alertdialog` + `aria-modal` |
| 模态自建 | `overlay/mention-picker.tsx` | 无（父层代管） | `ClickCatcher` | `dialog` + `aria-modal` |
| 模态自建 | `overlays/search-panel.tsx`（⌘K） | 无（`useSearchState` keydown 代管） | `.search-scrim` button | `role=dialog` + `aria-label`（**无 aria-modal**） |
| 模态自建 | `pages/schedules-page.tsx`（`.sched-form-overlay`） | 有 | backdrop | `dialog` + `aria-modal` |
| 模态自建 | `chief/chief-drawer.tsx`（抽屉） | `useEscapeClose`（内层线程 popover 先关） | 无 catcher | 无 role |
| 模态自建 | `pages/project-new-page.tsx` / `pages/project-page.tsx` / `routes/account-page.tsx` / `routes/todo-detail-page.tsx` | 各有 2–3 处 | catcher / mount 混用 | 无 |
| 锚定浮层 | `overlays/plan-dropdown.tsx` / `overlays/chip-popover.tsx` / `overlay/more-menu.tsx` / `detail/dhead.tsx` / `board/sidebar.tsx` / `resources/skills-page.tsx` / `chief/chief-model-select.tsx` | 有 | `ClickCatcher`（`chip-popover` 由 dhead 代管） | 仅 `chip-popover` 带 `role=dialog` |
| **手工壳** | `detail/overlays.tsx` 的 `Overlay`（rerun dialog / 复用方案 panel） | 自带 `window` keydown + `escMuted` 内层让位闸 | `.overlay` + `target===currentTarget` | **无 role / 无 aria-modal** |
| **手工壳** | `overlay/token-gate.tsx` | **无**（闸不可 Esc 关） | 无 | `dialog` + `aria-modal` |

`DialogShell` 消费文件（14，非 #193 spec 头注写的 10）：`chief/chief-agent-dialog.tsx`、
`chief/chief-settings.tsx`、`chief/edit-charter-dialog.tsx`、`detail/{accept,branch,review,stop-confirm}-dialog.tsx`、
`detail/overlays.tsx`、`resources/create-{machine,provider,secret}-dialog.tsx`、
`routes/{api-key-create,create-agent}-dialog.tsx`、`routes/team-page.tsx`。

> 票面「11 壳 + 1 手工壳」的口径在仓内文档里找不到定义（#409 体已随票关闭，#417 只给数字）。
> 上表是实测清单，迁移片分组建议按本表而非票面数字。

## 4. 对照矩阵

判定列：**等价** = shadcn 自带且仓内语义一致；**需接线** = shadcn 自带但语义/值不符，或需显式透传；**缺** = shadcn 有仓内无（迁移会带来行为变化）；**仓内特有** = shadcn 无法直接表达，必须保留。

| # | 行为 | shadcn / radix 1.1.23 | 仓内现状 | 判定 |
|---|---|---|---|---|
| 1 | Esc 关 | 层级栈，仅 topmost 挂 document capture 监听 + `preventDefault` | 每层各自 `window` keydown（冒泡），一次按键**所有开着**的监听都跑；分层靠 `enabled` 条件 / `escMuted` | **需接线**（且高风险）：迁移后必须删掉仓内 Esc 效应，否则一次 Esc 跨层关两层，`#318` 未保存闸被绕过 |
| 2 | 遮罩点击关 | pointerdown + `deferPointerDownOutside` + 右键豁免；机制 = body `pointer-events: none` | click + `target===currentTarget`（backdrop 面）/ 全屏透明 `ClickCatcher` button；机制 = z 序覆盖 | **等价**（行为同，机制不同）；radix 的「拖动不误关」是额外增益 |
| 3 | 面板内点击不关 | layer 即 Content | `target===currentTarget` 判定 | 等价 |
| 4 | body 滚动锁 | 自带（`react-remove-scroll`, shards=[content]） | **无** | **缺**（行为升级，需确认是否要保留旧观感） |
| 5 | 焦点圈定 / Tab 环绕 | 自带（`FocusScope trapped+loop` + focus guards），且 modal 下不可关 | **完全没有**（唯一相关物是 `ClickCatcher` 的 `tabIndex={-1}`） | **缺**（导入 trap 会改变背景可达性；当前 e2e 未钉 trap，**引入后不会有断言报警**，需补一条） |
| 6 | 开时焦点入层 | 默认容器内首个 tabbable；`onOpenAutoFocus` 可覆写 | 逐面手工 ref callback / effect：`new-task` 聚焦正文 textarea（**DOM 序里它在项目 chip / 关闭钮之后**）、`chief-drawer` 聚焦 composer、`search-panel` attachInput + `[open]` effect、`token-gate` effect + `getElementById` | **需接线**：默认首 tabbable ≠ 仓内目标元素，必须写 `onOpenAutoFocus` |
| 7 | 关闭后焦点回陷 | 回 `DialogTrigger`；无 Trigger → 落 body | 手工 `returnFocusRef`（`new-task-dialog.tsx` 记 `document.activeElement`，关闭同步归还 + effect 兜底；`#389` 硬化注释说明「effect 归还在负载下滞后于断言读」） | **需接线 + 仓内特有**：触发钮全在 dialog 树外（`.board-new-task`、`.res-new`、卡片分支图标…），radix 无 Trigger 可回；鱼与熊掌 = 保留仓内回陷 + `onCloseAutoFocus={e => e.preventDefault()}` 挡掉 radix 的空回陷 |
| 8 | `role` | `role="dialog"`（有 Title 时 `aria-labelledby`；有 Description 时 `aria-describedby`） | `role="dialog"` + `aria-label={标题字符串}`；confirm 家族用 `alertdialog`；手工壳 `detail/overlays` 无 role | **需接线**：仓内是 label 字符串，shadcn 是 Title 元素关联；两者并存时 labelledby 优先 → 迁移需二选一（渲染 `DialogTitle` 且 class 覆盖，或把 `aria-label` 透给 Content） |
| 9 | `aria-modal` | **不写**（用 `hideOthers` 把兄弟子树整体 aria-hidden 替代） | 显式 `aria-modal="true"`（dialog-shell / new-task / delete-confirm / mention-picker / token-gate / schedules） | **需接线**（语义等价物不同；实测**无 e2e 读该属性**，风险低但是迁移后「属性消失」的可见事实） |
| 10 | 受控语义 | `open`/`defaultOpen` + `onOpenChange`；`DialogClose` 自关 | `open` + `onClose` 回调；X 钮 = 手写 `<button onClick={onClose}>` | 等价（`DialogClose` 可替换手写 X 钮） |
| 11 | 嵌套 / 层序 | layer 栈自动（Esc 归属、branches、dismissableSurfaces） | 手工条件闸（`new-task` 4 层、`detail/overlays` `escMuted`） | **需接线**：仓内那套条件在迁移后应整体删除，改由 radix 承担 |
| 12 | 动画钩子 | `data-state` on Trigger/Overlay/Content；`Presence` 只认 **animation**（transition → 立即卸载）；shadcn 用 `animate-in/out` 类，**`tw-animate-css` 仓内未安装** | `data-overlay-state` on `.overlay-mount`；保留挂载 = JS 定时器（150/200/300ms）+ `visibility` 翻转；进场 keyframe / 出场 transition | **需接线（核心冲突）**：两套保挂载机制互斥。走 radix = 必须把退场改成 CSS animation 并装 `tw-animate-css`；走仓内 = 必须 `forceMount` 自控 open/exit（shadcn 只出皮肤）。**`data-overlay-state` 是仓内属性名，shadcn 是 `data-state` → `overlay-focus` 该条断言必改** |
| 13 | `#193` 矮视口封顶三段律 | 无（无 max-height、无 body 滚动区、无 foot 钉底；官方只给示例） | `.dlg { max-height: calc(100vh - 48px) }` + `.dlg-body { flex:1; min-height:0; overflow-y:auto }` + `.dlg-foot` 钉底 | **仓内特有 → 必须接线**（挂到 `DialogContent` 的 className 或保留 `.dlg` 作 Content 类） |
| 14 | 层序 / hit-test | Portal 到 body 尾 + `z-50` + isolate | 仓内 z 值表（scrim 20/29/40、面板 21/30/31/41；`#10` 修过「sched 弹层要盖过 sidebar z1」） | **需接线**：Portal 化会顶掉该表 → `overlay-focus` 的 `elementFromPoint` 覆盖断言需重钉 |
| 15 | 关闭三路径等效（X/Esc/backdrop） | 自带（`DialogClose` + DismissableLayer） | 手写三路（`#168` 家族律，见 `rerun-close-family.spec.ts` 头注） | 等价 |
| 16 | focus 环 canon | shadcn 关闭钮自带 `focus:ring-2 ring-ring ring-offset-2`（ring 家族） | 仓级 `#388` canon：`focus-visible` 2px **实线** `--card-button` + offset 2；且过渡必须窄写（`transition-all/colors` 含 `outline-color`，会把环「过渡吞掉」） | **需接线**：照 `#414` 第三段 commit 的 button 收编法改关闭钮/内部按钮 |
| 17 | 常亮互斥 `#137` | 无对应概念 | `:root[data-search-open]` 根标记驱动（`overlays.css` 尾部） | **仓内特有**：迁移后根标记契约须保留 |
| 18 | 遮罩色 / 圆角 / 阴影 | `bg-black/50` / `rounded-lg` / `shadow-lg` | `--overlay-scrim`（60% 黑，r7 采样）/ 12px / 仓内 shadow token | **需接线**：值逐条覆盖；注意仓内 token 记法 hex/rgb（e2e 值探针按 rgb 串解析，oklch 会被读错） |

## 5. 仓内特有契约：shadcn 无法直接表达、必须保留的清单

1. **`#389` 开时焦点入层 / 关时回还触发位**。入层要的是特定元素（正文 textarea / composer /
   ⌘K 输入），不是首 tabbable；回还要的是**触发钮**，而触发钮在 dialog 树外 —— radix 的
   `triggerRef` 拿不到。仓内已有同步归还（`returnFocusToInvoker`）+ effect 兜底两路，
   注释明说「effect 归还在负载下可滞后于紧随的断言读（overlay-focus 批跑实测 race）」。
   e2e 钉：`overlay-focus.spec.ts`（Esc 后读 `document.activeElement` 的环色，即断言焦点回了 `.board-new-task`）、
   `hotkeys.spec.ts`（`.new-task-spec` / `.chief-composer-input` `toBeFocused`）、
   `search-focus.spec.ts`（⌘K 输入已聚焦）、`newtask-single-field.spec.ts` 第 5 条。
2. **`#394` 弹窗族律（单字段正文 + 保存闸 + 四槽壳）**。业务形态与 shadcn 无冲突，
   但 `DialogShell` 的 `title` / `headerCenter` / `footer` / `width` 四槽是仓内命题
   （`headerCenter` = 居中分段 tab 且弃 title 与分隔线；`width` 有 448 家族律与 560 例外）。
   shadcn 的 `DialogHeader/Footer` 是裸 div、`DialogTitle` 只是 primitives 透传 →
   要么 class 覆盖，要么保留仓内 css 作 Content 皮肤。
3. **`#193` 矮视口封顶三段律**（见矩阵 13）。`dialog-viewport.spec.ts` 全 10 条钉它：
   `max-height = 100vh - 48px`、`.dlg-body` 真溢出（`scrollHeight > clientHeight`）、
   submit/cancel `toBeInViewport`、滚动到底不位移按钮、360 高视口下压封顶。
4. **`#318` Esc 分层 + 未保存闸**。`new-task-dialog` 4 层顺序（确认层 → 提及 picker → 项目 popover → dialog），
   且脏表单时 Esc 不关 dialog 只开确认层。radix 的 topmost 语义只解决「关哪一层」，
   「这一层该不该关」要挂 `onEscapeKeyDown` 才能接管。
   e2e 钉：`newtask-project-select.spec.ts` 第 4/5 条（层序 / 外点只关内层）、`dead-buttons.spec.ts`。
5. **`#137` 常亮互斥根标记**（`data-search-open`）与 **`#388` focus 环 canon**。
6. **遮罩的键盘可达性**：`.overlay-backdrop` 是带 `aria-label="关闭"` 的真 `<button>`，
   键盘用户能 Tab 到并 Enter 关；shadcn 的 Overlay 是纯 `<div>`（因为 radix 有 trap，不需要这条路径）。
   → **遮罩面不能半换**：只换遮罩不换 trap，会在无 trap 的旧面里丢掉这条键盘路径。
7. **类名钉扎**：19 个壳文件里的 `.dlg*` / `.overlay*` / `.new-task-*` / `.sched-form-*` 是
   spec 定位锚（`#409` 盘点：872/302 distinct 选择子）。shadcn 的 `data-slot` 不能替代 →
   `className` 透传保锚是硬约束。

## 6. `radix-ui` 统一包 Dialog vs shadcn 封装：还差什么

shadcn 相对裸 `radix-ui` 的 `Dialog` namespace **新增**：`data-slot` 锚点、tailwind 皮肤串、
`DialogContent` 内自带 `Portal + Overlay + 关闭钮`、`DialogHeader/Footer` 两个裸 div、
以及 `new-york-v4` 形态里**没有** `showCloseButton` prop（`bases/radix` 新形态才有 + `cn-*` 类）。

要表达仓内语义，必须从 radix 透传的 props：

| prop | 挂在哪 | 为什么仓内需要 |
|---|---|---|
| `modal` | Root | 仓内锚定浮层家族（plan-dropdown / chip-popover / more-menu / dhead / sidebar / skills-page / chief-model-select）要的是**非模态**行为；但 `DialogContent` 在 modal 下强渲染 Overlay 且 trap 不可关（见 2.3）——这类面更该走 Popover/DropdownMenu 而非 Dialog |
| `open` / `defaultOpen` / `onOpenChange` | Root | 受控；仓内 `open` + `onClose` 一对一映射 |
| `onOpenAutoFocus` | Content | `#389` 入层目标元素 |
| `onCloseAutoFocus` | Content | **必须 `preventDefault()`** 挡掉 radix 的 trigger 回陷，改由仓内 `returnFocusRef` 归还 |
| `onEscapeKeyDown` | Content | `#318` 闸（dirty 时 Esc 只开确认层）/ 需要保留的分层逻辑 |
| `onPointerDownOutside` / `onInteractOutside` | Content | 未保存闸的外点路径（`requestClose` 而非直接关）；radix 已自带右键/ctrl 豁免，覆写时别丢 |
| `onFocusOutside` | Content | radix 默认 `preventDefault()`；若仓内要靠焦点离开关层需显式改 |
| `forceMount` | Portal / Overlay / Content | 保留仓内 retained-mount 退场（与 Presence 二选一，见矩阵 12） |
| `container` | Portal | 决定 Portal 落点 → 决定层序与 `elementFromPoint` 断言面（矩阵 14） |
| `asChild` | Trigger / Close | 让仓内 `ui/Button` 直接当触发/关闭件（`#414` 已是 `Slot.Root` 形态） |
| ~~`trapFocus`~~ | Content | 类型上有，**1.1.23 模态路径硬覆盖为 `context.open`，不可关** |

仓内`alertdialog` 面（delete-confirm / delete-project-confirm / new-task-discard / token-gate 的告警语义）
对应另一个 registry 件 `alert-dialog`（已核实存在：`ui.shadcn.com/r/styles/new-york-v4/alert-dialog.json`，
deps 同为 `cn` + `radix-ui`）—— radix `AlertDialog` 与 `Dialog` 同构造，差别是 `role="alertdialog"` +
默认取消钮 + Escape/外点默认不关（需显式 `onEscapeKeyDown`/`onPointerDownOutside` 接管，与仓内
「确认层可 Esc/外点关」的现状相反，属接线项）。

## 7. 迁移必须的额外接线清单

1. **装依赖**：`radix-ui` / `class-variance-authority` / `clsx` / `tailwind-merge`
   已在 `apps/web/package.json` 但 **node_modules 未装**（当前 checkout 实测缺失）→ 本片前置 `pnpm install`。
2. **装/替代动画工具类**：`tw-animate-css`（`animate-in`/`animate-out`/`fade-in-0`/`zoom-in-95`）
   未安装且 `shadcn.css` 无定义 → 要么装，要么用仓内 keyframe 重写 `data-state` 规则。
   **注意 Presence 只认 animation**：写成 transition 会当场卸载，退场动画与 `data-overlay-state` 一起没。
3. **退场保挂载路线二选一**（矩阵 12）：(a) radix Presence —— 出场改 CSS animation；
   (b) 仓内 `OverlayMount` + `forceMount` —— 保住既有 `data-overlay-state` 断言。
   两条不能混（`forceMount` 与 Presence 并存会互相顶）。
4. **`#193` 三段律搬进 `DialogContent`**：`max-h-[calc(100vh-48px)]` + body `overflow-y:auto` +
   foot 钉底（shadcn 无默认）。
5. **`#389` 回陷**：`onCloseAutoFocus` preventDefault + 保留/迁移 `returnFocusRef`；
   或把触发钮 `DialogTrigger` 化（视图结构大改，涉及 19 个调用点）。
6. **Esc**：删掉 `useEscapeClose` / `useEscClose` / 内联 `window` keydown 效应；
   内层闸改挂 `onEscapeKeyDown`。
7. **aria**：`aria-modal` 消失（用 radix 的 aria-hidden 兄弟隔离）；标题改 `DialogTitle`
   （含 class 覆盖 / `asChild`）或 `aria-label` 透传；关闭钮文案本地化（sr-only `Close` → `t('关闭')`）。
8. **皮肤逐值覆盖**：`bg-black/50` → `--overlay-scrim`；`rounded-lg` → 12px；
   `shadow-lg` → 仓内 shadow token；focus 环按 `#388` canon 收编（照 `#414` button 第 3 段做法）。
9. **层序**：Portal 到 body 尾会顶掉仓内 z 表（含 `#10` 修过的 sidebar 覆盖断言）→ 接受重钉或 `container` 指定容器。
10. **类名锚**：`className` 透传保 `.dlg*` / `.overlay*` / `.new-task-*` 等 spec 定位锚。

### e2e 钉扎面（迁移改动会打到的断言）

| spec | 钉住的契约 |
|---|---|
| `overlay-focus.spec.ts` | `#15` focus 环 canon（`activeElement` 环色 + `:focus-visible` 正向堵洞）；`#10` `sched-form-overlay` 全视口 scrim（`elementFromPoint`）、Esc 关、背板点击关、`anim-fade` 类、`.overlay-mount` 的 `data-overlay-state="open"` |
| `dialog-viewport.spec.ts` | `#193` 全 10 条：封顶 `100vh-48`、`.dlg-body` 溢出、submit/cancel `toBeInViewport`、滚动不位移、360 高封顶 |
| `rerun-close-family.spec.ts` | `#168` 手工壳 `.overlay` 三关路径（X / Esc / backdrop 仅自身命中）+ back 回了 rerun 形 |
| `newtask-single-field.spec.ts` | `#394` 单字段结构 + 保存闸 + 派生标题 + autofocus 在 textarea |
| `newtask-project-select.spec.ts` | `#176` 锚定 popover 族律 + **Esc 层序** + 外点只关内层 |
| `search-focus.spec.ts` | `#137` ⌘K 输入已聚焦 + 常亮互斥（`::before` pill 色读 token） |
| `hotkeys.spec.ts` | `#389` N/Space 呼出 + 焦点入层（`toBeFocused`）+ 输入态负向 |
| `machine/provider/secret-add-dialog`、`team-create-agent`、`chief-settings` | DialogShell 家族关闭律（X / Esc / backdrop，panel 内点击存活） |
| `chip-assign`、`dead-buttons`、`sidebar-search-offboard`、`chief-panel` | 锚定浮层 / overlay 族 / ⌘K 面板 / 抽屉的开合与元素锚 |

**注**：`provider` 弹层另有 `#355` 无 footer 形态（38 行 picker 面仍封顶）—— 三段律不是「必须有 foot」。

## 8. Premortem（假设本片迁移已失败，3 个最可能死因 + 护栏）

1. **一次 Esc 关两层，绕过 `#318` 未保存闸**（仓内 `window` keydown 效应没删干净，
   与 radix 的 document capture 监听在同一按键上各关一层；radix 的 `preventDefault()`
   拦不住已注册的 window 冒泡监听）。
   护栏：迁移片**先只换一个壳**做试验面，把 Esc / 闸 / 回陷三条断言先跑红再转绿；
   仓内 Esc 效应全删后才接第二片。
2. **退场动画静默消失**（`tw-animate-css` 未装 → `animate-out` 类无定义 → `animationName === 'none'`
   → Presence 立即卸载；`data-overlay-state` 与视觉退场同时丢，`overlay-focus` 会红）。
   护栏：路线先定死（Presence 动画 vs `forceMount` 定时器），别混用；装包后逐条读
   `getComputedStyle().animationName` 实证，而不是看类名在不在。
3. **导入 focus trap 后「什么都没报警」**（trap 让背景不可 Tab，恰恰会让**依赖背景可达性的既有 spec
   静默失效**或旧 a11y 路径消失；当前 grep 未见任何 spec 钉 trap 或弹层内 Tab 语义）。
   护栏：新增一条 e2e 先列失败方式（Tab 在首元素 shift+Tab 应环绕到末元素；背景元素不可达；关闭后背景恢复可达），
   再动实现 —— 仓规「先列失败方式，再写代码」。

## 9. 未决 / 需另立决策

- **锚定浮层家族（7 处）要不要一起迁 Dialog**？它们要的是非模态 + ClickCatcher 语义，
  而 `DialogContent` 强渲染 Overlay 且 trap 不可关 → 更自然的是 radix 的 Popover / DropdownMenu
  （另一票，属「弹层族迁移设计」的范围划分问题）。
- **Portal 化后的定位基线**：仓内 anchored popover 的几何是 r7 位图实测（`.chip-popover` left -18 /
  top +3.5、`.plan-dropdown` right 对齐…），Portal 到 body 后这些 absolute 定位的包含块会变
  → 值探针与几何断言需重钉。
- **shadcn 双形态风险**（inline tailwind `new-york-v4` vs `cn-*` 主题类 `bases/radix`）：
  皮肤来源不同，本仓 `shadcn.css` 只承接了变量层，没有 `cn-*` 类层。
- **`#409`「弹层族 11 壳」口径**：仓内文档无定义，本次以实测 19 挂载点为准（§3 表）；
  建议在地图 #417 的迁移片票面用实测清单替换该数字，避免施工方按不存在的清单分工。

## 10. 事实源

- shadcn registry（radix 变体，CLI 4.21.0 同源）：
  `https://ui.shadcn.com/r/styles/new-york-v4/dialog.json`、`.../alert-dialog.json`、`.../badge.json`
- shadcn 文档（Dialog 页；**API Reference 现指向 Base UI**）：`https://ui.shadcn.com/docs/components/dialog`
- shadcn 仓库 `new-york-v4` 与 `bases/radix` 两形态对照：
  `repos/shadcn-ui/ui` → `apps/v4/registry/bases/radix/ui/dialog.tsx`（tag `shadcn@4.21.0` 与 main 一致）
- radix 实现（版本由 `pnpm-lock.yaml:1395/1417/1452` 钉）：
  `@radix-ui/react-dialog@1.1.23/dist/index.js`、
  `@radix-ui/react-dismissable-layer@1.1.19/dist/index.js`、
  `@radix-ui/react-focus-scope@1.1.16/dist/index.js`、
  `@radix-ui/react-presence@1.1.6/dist/index.js`（unpkg，agent-reach web 通道）
- 仓内：`apps/web/src/overlays/dismiss.tsx`、`apps/web/src/overlay/{use-esc.ts,use-overlay-mount.ts,overlay.css}`、
  `apps/web/src/ui/{dialog-shell.tsx,dialog.css,README.md}`、`apps/web/src/styles/{motion.css,shadcn.css}`、
  `apps/web/src/components/ui/*`、`apps/web/e2e/*.spec.ts`、`apps/web/package.json`、`pnpm-lock.yaml`
- 票面：`#417`（地图）、`#418`（本票）、`#389`、`#394`、`#193`、`#409`（已闭）