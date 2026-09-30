# #430 弹层行为契约对照（Base UI 代数）

> 地图 #417（全站铺开 shadcn/ui）的研究子票。`#410` 裁 primitives = **Base UI**，
> 而 `#418` 的弹层契约矩阵（`docs/research/418-dialog-contract-matrix.md`，分支
> `research/dialog-contract`）是按 **radix Dialog 语义**成稿的。本票以 Base UI 一手源码
> 重查同一组问题，产出 B1（`#425`）可执行的机制对照与接线清单。
>
> 判定列：**等价** = Base UI 自带且仓内语义一致；**需接线** = Base UI 自带但语义不符，
> 或需显式透传；**缺** = Base UI 有仓内无（迁移带来行为变化）；**仓内特有** = Base UI
> 无法直接表达，必须保留。
>
> 证据格式 `文件:行`。未核实项标 `[未核实]`。
> 包版本：`@base-ui/react` **1.8.0**（`apps/web/package.json:19`，`pnpm-lock.yaml:579`）。
> 对照基准：`docs/research/418-dialog-contract-matrix.md`（radix 语义）。

## TL;DR

- **退场保挂载**：Base UI 不用 radix 的 `Presence`。卸载由 `useOpenStateTransitions`
  （`utils/popups/popupStoreUtils.mjs:404-444`）+ `useOpenChangeComplete`
  （`internals/useOpenChangeComplete.mjs:19`）+ `useTransitionStatus`
  （`internals/useTransitionStatus.mjs:15`）三件套驱动，判定依据是
  **`Element.getAnimations()`**（`internals/useAnimationsFinished.mjs:74,79`）——
  animation 与 transition **都认**，radix「只认 animation」的限制不存在。
  公开回调 `onOpenChangeComplete(open)`，开/关两向都触发，无动画也触发。
  仓内「退场期不卸载」不需要额外接线：Base UI 自带保留挂载；仓内只需让 popup
  自持一个 transition 撑住卸载窗（`ui/dialog.css:207-217`）。
- **Esc 分层**：监听在 **document 冒泡阶段**（`floating-ui-react/hooks/useDismiss.mjs:458`），
  但 Dialog 家族用一个更简单的闸——**只有最内层才注册监听**（`escapeKey: isTopmost`，
  `dialog/root/useDialogRoot.mjs:21,71`）。效果与 radix 的 layer 栈同为 innermost-first，
  但**没有 `bubbles` 公开 prop**（`hasBlockingChild` 是 Menu 族路径，不是 Dialog 族）。
  radix 的 `onEscapeKeyDown` 无对应物：拦截改走 `onOpenChange` 第二参
  `eventDetails.cancel()` / `allowPropagation()`。
- **焦点回陷**：`Dialog.Popup` 只吃 `initialFocus` / `finalFocus`
  （`dialog/popup/DialogPopup.d.ts`），**没有 `initialFocusRef` / `finalFocusRef`**。
  Base UI 默认**自动回 trigger，不需要 ref**（`FloatingFocusManager.mjs:458-479`）；
  仓内触发钮在 dialog 树外，改由 `finalFocus` 传函数、函数自己 `focus()` 并返回
  `void` 接管（`dialog-shell.tsx:81-94,147`）——比 radix 的
  `onCloseAutoFocus` + `preventDefault()` 更简单，**不需要挡默认行为**。
- **等价面**：遮罩/外点/受控/关闭三路径/嵌套层序大多可直接切；**body 滚动锁与焦点圈定
  从 #418 判定的「缺」反转为「Base UI 自带」**（modal 下 `useScrollLock` +
  `FloatingFocusManager` trap）。须额外接线见 §四.3。
- **`tw-animate-css` 不是必需件，且当前根本没有接线**：它在 `apps/web/package.json:30`
  与 `pnpm-lock.yaml:2870`，但仓内**没有任何 `@import "tw-animate-css"`**；而
  `animate-in` / `animate-out` / `fade-in-0` / `zoom-in-95` **不是 Tailwind v4 核心工具类**
  （实测 Tailwind 4.3.3 零输出，见 §五）。6 个文件的 `data-open:animate-in …` 类串是
  **惰性**的，退场动画实际由仓内自有 CSS 承担。二选一：删依赖，或接线 import。

## 一、退场保挂载

### 1.1 机制对照

| 维度 | radix（#418 结论） | Base UI 1.8.0 | 证据 |
|---|---|---|---|
| 卸载驱动 | `Presence` | `useOpenStateTransitions` + `useOpenChangeComplete` + `useTransitionStatus` | `utils/popups/popupStoreUtils.mjs:404-444`；`internals/useOpenChangeComplete.mjs:19`；`internals/useTransitionStatus.mjs:15` |
| 判定依据 | 读 `getComputedStyle().animationName`，**只认 animation** | `Element.getAnimations()`，**animation + transition 通吃** | `internals/useAnimationsFinished.mjs:74,79` |
| 完成回调 | 内部 `onAnimationComplete`（无公开口） | 公开 `onOpenChangeComplete: (open: boolean) => void` | `dialog/root/DialogRoot.d.ts:44`；`popover/root/PopoverRoot.d.ts:33`；`menu/root/MenuRoot.d.ts:56` |
| 触发时机 | 退场动画结束 | **开、关两向都触发**；**无动画也触发** | open：`dialog/popup/DialogPopup.mjs:49-53`；close：`utils/popups/popupStoreUtils.mjs:428`；无动画保证：`internals/useOpenChangeComplete.d.ts:27` 原话 "or there is no animation" + `useAnimationsFinished.mjs:74-77` |
| 数据属性 | `data-state="open\|closed"` | `data-open` / `data-closed` / `data-starting-style` / `data-ending-style` | 名字正本 `utils/CommonPopupDataAttributes.mjs:6,11,16,21`；映射 `internals/stateAttributesMapping.mjs:9-19` |
| 强制保挂载 | `forceMount`（在 Portal / Overlay / Content） | `Portal.keepMounted`（默认 false）；命令式 `actionsRef.unmount()`；`eventDetails.preventUnmountOnClose()` | `dialog/portal/DialogPortal.d.ts:17-21`、`.mjs:20,27,28`；`dialog/root/useRenderDialogRoot.mjs:63-66`；`dialog/store/DialogStore.mjs:31-34` |

三条保挂载路径各自的语义（本仓都**不需要**，登记备查）：

- `Portal.keepMounted`：关掉后节点留在 DOM，由 `hidden={!mounted}` 隐藏（`dialog/popup/DialogPopup.mjs:72`）。
- `actionsRef.current.unmount()`：`dialog/root/DialogRoot.d.ts:51-57`，注释要求「外部控制的关闭动画结束后再调」。
- `eventDetails.preventUnmountOnClose()`：在 `onOpenChange` 里调，使 `useOpenStateTransitions` 的
  `enabled` 条件落空 → `forceUnmount` 不跑 → `mounted` 保持 true
  （`utils/popups/popupStoreUtils.mjs:430-431`）。此时 `onOpenChangeComplete(false)` **不会触发**。

注意：Dialog / Popover / Menu 的 **Root 上没有 `keepMounted` prop**，该名只属于各自的 `Portal`。
`keepMounted` 在 `Tabs.Panel` / `Accordion.Panel` / `Menu.RadioItemIndicator` 上另有同名 prop
（`tabs/panel/TabsPanel.d.ts:36` 等），不属弹层族。

### 1.2 「退场期不卸载」在仓内怎么落地

Base UI 自带保留挂载，所以仓内**不再需要** `useOverlayMount` 那套 JS 定时器（未迁面除外）。
已迁面的配方是三件事（`ui/dialog.css:207-217`）：

```css
.dlg-shell { transition: visibility 0s linear var(--dur-overlay); }  /* 撑卸载窗 */
.dlg-shell[data-ending-style] { visibility: hidden; }                /* 翻终态 */
.dlg-shell[data-ending-style] .anim-fade { opacity: 0; }             /* 子级退场视觉 */
```

**关键事实：`getAnimations()` 默认不带 `subtree`，只看 popup 元素自身的动画。**
子树里的退场过渡 Base UI 看不见（`ui/dialog.css:228-229` 的注释已记录此点）。
所以「撑住卸载窗」必须由 popup 自身带一个 transition 或 animation —— 仓内 `.dlg-shell`
那条 `visibility 0s linear var(--dur-overlay)` 就是这个角色：属性从 `visible` 翻 `hidden`
时按 CSS 过渡规范创建 CSSTransition（有非零 delay），Base UI 等它 `finished` 才 `forceUnmount`。

`--dur-overlay` = **200ms**（`styles/tokens.css:19`），与 `#425` 实测卸载时刻 209ms 吻合。

同一配方的已迁面（逐个对应写死的类名）：

| 面 | 撑窗过渡 + `[data-ending-style]` 终态 | 文件 |
|---|---|---|
| `DialogShell` 默认态 | `.dlg-shell` | `ui/dialog.css:207-217` |
| `DialogShell` 视口根态（⌘K） | `.dlg-viewport` | `ui/dialog.css:230-248` |
| `search-panel` 遮罩 | `.search-scrim` | `overlays/overlays.css:26` |
| `more-menu` | `.more-menu-shell` | `overlay/overlay.css:446,452,456` |
| `mention-picker` | `.mention-picker-shell` | `overlay/mention-picker.css:275,279` |
| `chief-model-select` | `.chief-model-shell` | `chief/chief.css:611,615` |

`AlertDialogShell`（`alert-dialog-shell.tsx:60,67`）与 `FloatingShell` 各面沿用各自面的
`anim-fade` / `anim-pop` 终态规则。**新面必须照这套三件套写**，否则退场瞬间消失且无报错（见 §八）。

### 1.3 未迁面

仍走旧栈的 12 个文件用 `useOverlayMount` + `motion.css:52-56` 的
`[data-overlay-state="closed"]` + `setTimeout(exitMs)`（`overlay/use-overlay-mount.ts:22-52`）。
两套机制按 DOM 子树隔离，不冲突。逐面清单见 §四.4。

## 二、Esc 分层

### 2.1 机制对照

| 维度 | radix（#418 结论） | Base UI 1.8.0 | 证据 |
|---|---|---|---|
| 监听位置 | `ownerDocument` **capture** 阶段 | `ownerDocument` **冒泡**阶段 | `floating-ui-react/hooks/useDismiss.mjs:458`（`addEventListener(doc, 'keydown', …)` 无第三参；同函数里 outside-press 全部带 `capture: true`） |
| 谁注册 | layer 栈：只有 `isHighestLayer` 注册 | Dialog 家族：**外层根本不注册**（`escapeKey` 为假则连监听都不挂） | `dialog/root/useDialogRoot.mjs:21`（`isTopmost = ownNestedOpenDialogs === 0`）、`:71`（`escapeKey: isTopmost`）；`useDismiss.mjs:458` 的 `escapeKey && …` |
| 嵌套层序 | layer 栈自动 | innermost-first，同上闸 | 计数维护 `dialog/root/useDialogRoot.mjs:19-20,77-96` |
| 事件传播 | 命中后 `preventDefault()` | 命中后 `preventDefault()`；**默认还会 `stopPropagation()`** | `useDismiss.mjs:106-109` |
| 拦截钩子 | `onEscapeKeyDown` | **无对应 prop**；用 `onOpenChange(open, eventDetails)` 的 `eventDetails.cancel()` | 全包 `onEscapeKeyDown` 0 命中；`internals/createBaseUIEventDetails.mjs:20-43`、`.d.ts:41-63`；消费顺序 `dialog/store/DialogStore.mjs:40-43` |
| `bubbles` prop | 无此概念 | **不是公开 prop**，只在 `useDismiss` 内部；Menu 由 `closeParentOnEsc` 推导 | `useDismiss.mjs:22-27,55-58`；`menu/root/MenuRoot.mjs:343-347`、`:45`；`menu/root/MenuRoot.d.ts:72-77` |

Menu 家族另有一套分层：`hasBlockingChild('__escapeKeyBubbles')`
（`useDismiss.mjs:75-79,99`）+ `FloatingTree`（`useDismiss.mjs:50`，
`floating-ui-react/components/FloatingTree.mjs:74`）。**Dialog 家族不走这条**，
`#418` 若按 `hasBlockingChild` 描述 Dialog 嵌套属误植。

### 2.2 仓内怎么对齐 #318

`#318` 的语义是「Esc 先关最内层；脏表单时 dialog 层不关，只开确认层」。Base UI 解决前者，
后者要仓内自己接管。落点在 `dialog-shell.tsx:122-134`：

```tsx
onOpenChange={(next, details) => {
  if (next) return;
  if (details?.reason === 'escape-key' && onEscapeWhileNested != null) {
    onEscapeWhileNested();          // 内层优先：转交消费者决定关哪层
    return;
  }
  if (onEscapeWhileNested != null && details?.reason === 'outside-press') {
    return;                          // 内层开着时外点也不关自己
  }
  onClose();
}}
```

**跨代数混搭是这条闸存在的唯一理由**：Base UI 在 document 冒泡阶段 `stopPropagation()`
（`useDismiss.mjs:106-109`），而 `window` 是冒泡路径的最后一站，所以
**未迁面挂在 `window` 上的 `useEscapeClose` 监听收不到那次按键**
（`dialog-shell.tsx:61-64` 的注释记录了这条）。内层若还是旧栈，必须由壳经
`onEscapeWhileNested` 代收。

反过来说：**已迁面之间**（`DialogShell` ↔ `FloatingShell`）的嵌套由 Base UI 的
`isTopmost` 自动分层，无需仓内任何代码。`#418` 判定「迁移后必须删掉仓内 Esc 效应，
否则一次 Esc 跨层关两层」——该风险对**全已迁**组合不成立，对**混搭**组合依然成立（见 §八.1）。

`newtask-project-select.spec.ts:74-82`（分层 Esc：第一下关 popover、第二下关 dialog）
与 `:84-89`（外点只关内层）是这条契约的 e2e 正本，`#425` 复跑绿。

### 2.3 Esc 相关的 reason 字面量

`onOpenChange` 第二参是 `eventDetails`（含 `reason`），**不是** radix 那种独立 `reason` 字符串。

| 组件 | 声明位置 | 成员 |
|---|---|---|
| Dialog | `dialog/root/DialogRoot.d.ts:85` | `trigger-press` \| `outside-press` \| `escape-key` \| `close-press` \| `focus-out` \| `imperative-action` \| `none` |
| Popover | `popover/root/PopoverRoot.d.ts:84` | 上列 + `trigger-hover` \| `trigger-focus` |
| Menu | `menu/root/MenuRoot.d.ts:111` | 13 项，含 `list-navigation` / `item-press` / `sibling-open` / `cancel-open` |
| AlertDialog | `alert-dialog/root/AlertDialogRoot.d.ts:33` | `= DialogRoot.ChangeEventReason`（直接别名） |

字面量正本 `internals/reason-parts.mjs`；reason → 原生事件类型映射
`internals/createBaseUIEventDetails.d.ts:3-37`（`escape-key: KeyboardEvent` 在 `:27`）。
`eventDetails` 另带 `cancel()` / `allowPropagation()` / `isCanceled` /
`isPropagationAllowed` / `trigger`，Dialog/Popover/Menu/AlertDialog/Tooltip 再加
`preventUnmountOnClose()`。

## 三、焦点回陷

### 3.1 入层：`initialFocus`

`Dialog.Popup` 只吃两个焦点 prop（`dialog/popup/DialogPopup.d.ts`）：

```ts
initialFocus?: boolean | React.RefObject<HTMLElement | null>
             | ((openType: InteractionType) => boolean | HTMLElement | null | void);
finalFocus?:   boolean | React.RefObject<HTMLElement | null>
             | ((closeType: InteractionType) => boolean | HTMLElement | null | void);
```

**prop 名里没有 `initialFocusRef` / `finalFocusRef`**——ref 直接喂给 `initialFocus` / `finalFocus`。
（`initialFocusRef` / `finalFocusRef` 这两个标识符在包内只作为官方文档示例的局部变量出现，
见 `docs/react/components/dialog.md:1500-1513`：`initialFocus={initialFocusRef}`。）
`InteractionType` = `mouse | touch | pen | keyboard`。

默认值：`interactionType === 'touch' ? popupRef.current : true`
（`utils/popups/popupStoreUtils.mjs:27-29`；Dialog 侧解析 `dialog/popup/DialogPopup.mjs:55`）——
触摸打开时聚焦 popup 自身以避开软键盘，其余走「popup 内首个 tabbable」。

`Popover.Popup` 同形（`popover/popup/PopoverPopup.d.ts`）。
`Menu.Popup` **无公开 `initialFocus` prop**：它按 `parent.type !== 'menu'` 内部算
（`menu/popup/MenuPopup.mjs:110`），解构出的公开 props 只有 `finalFocus`（`:24-30`）。

**仓内现状：未接 `initialFocus`。** 入层目标由 Base UI 的「popup 内首个 tabbable」推定。
`newtask-single-field.spec.ts:65`（`.new-task-spec` `toBeFocused`）与
`hotkeys.spec.ts:121` 实测命中，`#425` 绿。这是一条**隐式契约**：依赖面板的 DOM 序，
改结构（或给面板前置一个 tabbable）会静默换掉入层目标，且不会有断言报警。
`#418` 判定的「默认首 tabbable ≠ 仓内目标元素，必须写 `onOpenAutoFocus`」——
在 Base UI 下的对应动作是接 `initialFocus`；仓内以「不接、让默认恰好命中」的方式通过了 e2e。

### 3.2 回陷：`finalFocus`

`finalFocus` 直接透传给 `FloatingFocusManager` 的 `returnFocus`
（`dialog/popup/DialogPopup.mjs:91`）。解析实现在
`floating-ui-react/components/FloatingFocusManager.mjs:458-479`：

- `false` → 不动焦点；`undefined` → 返回 `null`，**不移动焦点**
- `null` → 回落默认
- `true` / 布尔 → 回默认元素（**trigger 或打开前聚焦的元素**）
- `RefObject` → `resolveRef` 后聚焦
- 函数 → 以 `closeType` 调用，返回值同上解析

**默认自动回 trigger，不需要显式 ref**：`domReference`（`FloatingFocusManager.mjs:131`）由
`activeTriggerElement` 同步而来（`floating-ui-react/hooks/useSyncedFloatingRootContext.mjs:27,54-56`），
`getReturnElement`（`FloatingFocusManager.mjs:458-479`）在 `returnFocus === true` 时取
`domReference?.isConnected ? domReference : null`。
radix「无 Trigger 则回陷失效、焦点落 body」的问题在 Base UI 里被
`elementFocusedBeforeOpen` / `getPreviouslyFocusedElement()` 两级兜底缓和（同函数内）。

**trigger 在 React 树外**的官方表达是 `Dialog.createHandle()`：把 `<Dialog.Trigger>`
渲染在 Root 之外，两端传同一个 `handle`（`dialog/store/DialogHandle.d.ts:4-8`；
文档示例见包内 `docs/react/components/dialog.md:3442` 起）。
**没有「传一个任意外部 DOM 元素当 trigger」的 prop**
`[未核实: 找过 handle / attachStore / triggerElements，未见把任意 Element 直接注入的公开入口]`。

### 3.3 仓内做法

触发钮全在 dialog 树外（`.sidebar-new-task`、卡片分支图标…），所以仓内不依赖 Base UI 的
trigger 推定，而是用 `finalFocus` 传函数自己聚焦（`dialog-shell.tsx:81-94,147`）：

```tsx
function useReturnFocus(open: boolean) {
  const origin = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) return;
    const el = document.activeElement;
    if (el instanceof HTMLElement && el.closest('[data-slot="dialog-content"]') == null) {
      origin.current = el;          // 关闭态持续记「层外最后一个活动元素」
    }
  });
  const restore = useCallback(() => { origin.current?.focus(); }, []);
  return { restore };
}
// <DialogPrimitive.Popup finalFocus={restore} …>
```

`restore` 是**返回 `void` 的函数**——按 §3.2 的解析规则，`undefined` 即「不移动焦点」，
焦点移动完全由仓内函数自己完成。**因此不需要 radix 那套
`onCloseAutoFocus={e => e.preventDefault()}` 来挡默认行为**：Base UI 这边根本没有默认行为
被触发。这是三处机制里换代后**变简单**的一处。

e2e 正本：`newtask-single-field.spec.ts:74`（Esc 后 `.sidebar-new-task` `toBeFocused`）、
`overlay-focus.spec.ts:38-63`（Esc 后读 `document.activeElement` 的聚焦环色）、
`hotkeys.spec.ts:121`。契约陈述在 `overlay-focus.spec.ts:42`：
「#389: 家族律 = 开时焦点入层、关时回还触发位」。

`new-task-dialog.tsx:129-136,167-177` 另有一路同步归还 + effect 兜底
（注释：effect 归还在负载下可滞后于紧随的断言读）。

### 3.4 焦点圈定与滚动锁

配置入口是 `FloatingFocusManager`（`floating-ui-react/components/FloatingFocusManager.d.ts`）：
`disabled` / `initialFocus` / `returnFocus` / `restoreFocus` / `modal` / `closeOnFocusOut`。
默认值 `initialFocus = true, returnFocus = true, restoreFocus = false, modal = true,
closeOnFocusOut = true`（`FloatingFocusManager.mjs:114-122`）。

逐壳实参：

| 壳 | modal | 结果 |
|---|---|---|
| `DialogShell`（`dialog-shell.tsx:135` 传 `modal`） | `true` | trap 开、滚动锁开、背景 aria-hidden |
| `FloatingShell`（`floating-shell.tsx:52` 传 `modal={false}`） | `false` | 不圈焦点、无背板、不锁滚动 |
| `AlertDialogShell` | Base UI 强制 `true`（`dialog/root/useRenderDialogRoot.mjs:27`） | 同 DialogShell |

- trap 与背景隔离用 focus guard + `markOthers`（aria-hidden / inert）：
  `FloatingFocusManager.mjs:338-349,557-590`。
- 滚动锁：`dialog/root/useDialogRoot.mjs:73` `useScrollLock(open && modal === true, popupElement)`。
- `modal: 'trap-focus'` 是第三种档位：圈焦点但不锁滚动、不禁外点指针
  （`dialog/root/DialogRoot.d.ts:29-36`）。

## 四、等价面与须额外接线清单

### 4.1 对照矩阵

| # | 行为 | Base UI 1.8.0 | 仓内现状 | 判定 |
|---|---|---|---|---|
| 1 | Esc 关 / 分层 | Dialog 家族 `escapeKey: isTopmost`（`dialog/root/useDialogRoot.mjs:21,71`），innermost-first 自动 | 已迁面之间自动；跨代数混搭由壳经 `onEscapeWhileNested` 代收（`dialog-shell.tsx:126-129`） | **等价**（全已迁）/ **需接线**（混搭） |
| 2 | 遮罩点击关 | `outside-press` 自带；reason `outside-press`；可关性由 `disablePointerDismissal` 控制（默认 false） | 壳另挂 Backdrop `onClick={onBackdropClick ?? onClose}`（`dialog-shell.tsx:142`） | **等价**（行为同）；**双通道**需注意（见 §4.2） |
| 3 | 面板内点击不关 | 自带 | 同 | **等价** |
| 4 | body 滚动锁 | **自带**：`useScrollLock(open && modal === true, …)`（`dialog/root/useDialogRoot.mjs:73`） | DialogShell/AlertDialogShell 开；FloatingShell（`modal={false}`）不开 | **缺 → 反转为自带**（`#418` 判「缺」已作废） |
| 5 | 焦点圈定 / Tab 环绕 | **自带**：`FloatingFocusManager` trap + guards（`modal=true` 时） | DialogShell/AlertDialogShell 开；FloatingShell 不开 | **缺 → 反转为自带**（`#418` 判「缺」已作废） |
| 6 | 开时焦点入层 | 默认 popup 内首个 tabbable；touch 时聚焦 popup 自身 | **未接 `initialFocus`**，靠默认恰好命中（e2e 绿） | **需接线**（隐式契约，见 §3.1） |
| 7 | 关闭后焦点回陷 | 默认自动回 trigger（`FloatingFocusManager.mjs:458-479`） | 显式 `finalFocus={restore}` 函数接管（`dialog-shell.tsx:147`） | **等价**（且比 radix 少一步 `preventDefault`） |
| 8 | `role` / aria-label | 默认 `role='dialog'`（store 值） | `:161` 显式给 `role`（viewportRoot 时 `presentation`）、`:162` `aria-label={title}`。`:158-160` 注释说明为何两态各给实值（`mergeProps` 的 `for...in` 会把 `undefined` 覆盖掉 store 默认） | **等价** |
| 9 | `aria-modal` | **全包不写该属性**（唯二命中在 `toast/root/ToastRoot.mjs:419` 写 `'aria-modal': false`）。背景隔离改用 `markOthers` 的 aria-hidden | 旧壳曾显式写 `aria-modal="true"`；已迁面**该属性已消失** | **需接线**（语义由 aria-hidden 承担） |
| 10 | 受控语义 | `open` / `defaultOpen` + `onOpenChange(open, eventDetails)`（`dialog/root/DialogRoot.d.ts:14-25,40`） | `open` + `onClose` 一对一映射（`dialog-shell.tsx:120-134`、`floating-shell.tsx:50-55`） | **等价** |
| 11 | 嵌套层序 | `isTopmost`（Dialog）/ `FloatingTree` + `closeParentOnEsc`（Menu） | 同 1 | **等价** |
| 12 | 动画钩子 | `data-open` / `data-closed` / `data-starting-style` / `data-ending-style`（`utils/CommonPopupDataAttributes.mjs:6,11,16,21`）；另有 `data-nested` / `data-nested-dialog-open`（`dialog/popup/DialogPopupDataAttributes.mjs:22,26`）、Popover/Menu 的 `data-instant` | 原始 CSS 只用 `[data-ending-style]`（§1.2 六处）；Tailwind 变体类串 `data-open:animate-in …` 是**惰性**的（§五） | **需接线**（配方见 §1.2） |
| 13 | `#193` 矮视口封顶三段律 | 无对应（Base UI 不管几何） | `dialog-shell.tsx:151` 的 `max-h-[calc(100vh-48px)]` + `.dlg-body` 自滚 + `.dlg-foot` | **仓内特有** |
| 14 | 层序 / hit-test | `Portal` 落点决定 containing block | 壳用 `zIndex` 入参（`dialog-shell.tsx:140,154`）；`FloatingShell` 用 `container` 把 portal 挂回锚 wrap 保 `position:absolute` 包含块（`floating-shell.tsx:37,57`） | **需接线**（已接线） |
| 15 | 关闭三路径（X / Esc / backdrop） | `Dialog.Close`（`dialog/close/DialogClose.mjs:39`）+ outside-press + escape | X = `DialogPrimitive.Close` + `onClick={onClose}`（`dialog-shell.tsx:177-183`） | **等价** |
| 16 | `AlertDialog` 语义 | **不是独立实现**，是 Dialog 的一个 mode：强制 `modal=true`、强制 `disablePointerDismissal=true`、`role='alertdialog'`（三行，`dialog/root/useRenderDialogRoot.mjs:26-29`）。**Esc 并未被屏蔽** | `alert-dialog-shell.tsx:49,62` 把 Esc 与背板**接回来**（旧壳确认面契约是三路径可关） | **等价**（须显式接线，已接线） |
| 17 | focus 环 canon | 无（Base UI 不管皮肤） | 仓内 `#388` canon，由 className 承载 | **仓内特有** |
| 18 | 遮罩色 / 圆角 / 阴影 | 无 | `--overlay-scrim` / 12px / 仓内 shadow token | **仓内特有** |

### 4.2 两条需要点名的行为差异

**(a) 背板关闭是双通道。** 壳同时有 Base UI 的 outside-press 与
`Backdrop onClick={onBackdropClick ?? onClose}`（`dialog-shell.tsx:142`）。
两条通道在「点背板」这一次交互上都会开火：Base UI 走 `onOpenChange` 的
`reason === 'outside-press'` 分支，React 的 `onClick` 走 `onBackdropClick ?? onClose`。
壳用「有嵌套时吞掉 `outside-press`」把两者对齐（`dialog-shell.tsx:130-132`），
但**没有嵌套时 `onClose` 会被调到两次**——昏迷的重复调用对幂等的 `setOpen(false)` 无害，
却会让「`onClose` 里带副作用」的新消费点出问题。登记为已知形态。

**(b) `AlertDialog` 不屏蔽 Esc。** 常见假设是「AlertDialog 默认 Esc / 外点都不关」。
源码事实：它只强制 `disablePointerDismissal = true`
（`dialog/root/useRenderDialogRoot.mjs:28`），Esc 开关走 `escapeKey: isTopmost`
（`dialog/root/useDialogRoot.mjs:71`），与 `disablePointerDismissal` 无关。
包内文档亦把 Esc 列为关闭路径（`docs/react/components/alert-dialog.md:687`）。
仓内 `alert-dialog-shell.tsx:49` 显式接 `useEscClose` 是**冗余但无害**的加固
（旧栈语义要求，保留即保行为）。

### 4.3 须额外接线清单

与 `#418` §7 的 10 条逐条对照（**作废**项标出）：

1. ~~装 `radix-ui` / `class-variance-authority` / `clsx` / `tailwind-merge`~~ —— **作废**。
   现装 `@base-ui/react` 1.8.0（`apps/web/package.json:19`）。新 worktree 开工前仍需
   `pnpm install`（本仓 `node_modules` 不入库）。
2. ~~装 `tw-animate-css` 并改 CSS animation~~ —— **作废**。Base UI 的 `getAnimations()`
   同时认 transition；且仓内当前根本没接线该包（§五）。
3. **退场保挂载**：Base UI 自带，不需 `forceMount`。仓内只需保证 popup 自身带一个
   transition / animation 撑卸载窗（§1.2 三件套）。新面照抄。
4. **`#193` 三段律**：由 className 承载（`dialog-shell.tsx:151`、`ui/dialog.css`）。
5. **`#389` 回陷**：`finalFocus` 传函数（自 `focus()`、返回 `void`）；入层若要钉目标，
   接 `initialFocus`（当前未接）。
6. ~~`onEscapeKeyDown`~~ —— 用 `onOpenChange` 的 `eventDetails.cancel()` /
   `allowPropagation()`。
7. **aria**：`aria-modal` 在已迁面消失，语义由 `markOthers` 的 aria-hidden 承担；
   标题仍走 `aria-label={title}`（`dialog-shell.tsx:162`）。
8. **皮肤逐值覆盖**：由 className / `ui/dialog.css` 承载。
9. **层序**：`zIndex` 入参 + `Portal container`（`floating-shell.tsx:37`）。
10. **类名锚**：`className` 透传保 `.dlg*` / `.overlay*` / `.new-task-*` 等 spec 定位锚。
11. **跨代数混搭**（`#418` 未列）：旧栈面的 Esc / 外点必须经壳的
    `onEscapeWhileNested` 代收（§2.2）。
12. **清理项**（`#418` 未列）：
    - `--exit-ms` 是**孤儿变量**：`overlays/dismiss.tsx:31` 每个旧栈挂载点都写内联
      `--exit-ms`，但**零 CSS 读取**（`motion.css:55` 读的是 `var(--dur-fast)`）。
    - `overlay/new-task-dialog.tsx:34` import 了 `useEscapeClose` 但**全文无调用**（死 import）。

### 4.4 未迁面清单（12 文件）

旧栈三件套 **全部存活**，不是死代码（`overlays/dismiss.tsx:16,51,66`）：

| 原语 | 活消费点 |
|---|---|
| `OverlayMount` | 8 文件 / 10 处：`board/tag-filter.tsx:102`、`board/sidebar.tsx:263`、`pages/schedules-page.tsx:149,208`、`pages/dir-browser.tsx:118`、`pages/project-page.tsx:292`、`pages/project-new-page.tsx:408,454`、`chief/chief-drawer.tsx:148`、`overlay/new-task-dialog.tsx:279,398` |
| `useEscapeClose` | 8 文件 / 9 调用 |
| `ClickCatcher` | 14 文件 / 16 处 |
| `useEscClose`（`overlay/use-esc.ts:13`） | 1 处：`components/ui/alert-dialog-shell.tsx:49` |

仍全手搓的两个面：`detail/overlays.tsx:57`（rerun dialog / 复用方案 panel，自带
`.overlay` + `window` keydown + `escMuted` 内层让位闸）与 `overlay/token-gate.tsx:62`
（`.token-gate-backdrop` + `Card`，**无 Esc**，闸不可关）。

## 五、皮肤与动画依赖：`tw-animate-css` 是否仍是必需件

**结论：不是必需件，而且当前根本没有接线。**

### 5.1 证据链

1. 声明存在：`apps/web/package.json:30` `"tw-animate-css": "^1.4.0"`，`pnpm-lock.yaml:2870`。
2. **无 import**：`grep -rn '^@import' apps/web/src --include=*.css` 只有两条——
   `styles/app.css:1` `@import "tailwindcss"` 与 `:5` `@import "./shadcn.css"`。
   全仓（除 `package.json` / `pnpm-lock.yaml` / 一处注释）无 `tw-animate-css` 字样。
3. **这些不是核心工具类**：实测（Tailwind **4.3.3**，与 `pnpm-workspace.yaml:27` 同版本）
   对 `<div class="flex animate-in animate-out fade-in-0 zoom-in-95 data-open:animate-in">`
   编译，输出只有 `.flex { display: flex }`；`animate-in` / `animate-out` /
   `fade-in-0` / `zoom-in-95` **零输出**。
4. 仓内也没有等价定义：`apps/web/src/styles/` 无 `--animate-*` 主题键，
   `@keyframes` 只有 `overlay-fade` / `overlay-pop` / `drawer-in` / `spinner-reel`
   （`motion.css:17,26,37,103`）。

### 5.2 后果

引用这批类串的 **11 处 / 6 文件**（`dialog-shell.tsx:118,151`、
`alert-dialog-shell.tsx:60,67`、`dialog.tsx:28,50`、`alert-dialog.tsx:26,48`、
`popover.tsx`、`dropdown-menu.tsx`）**产出零 CSS**。类名是惰性的。

退场动画实际来自仓内自有配方（§1.2）：`motion.css:67-70` 的
`.anim-fade { animation: overlay-fade var(--dur-overlay); transition: opacity var(--dur-overlay) }`
配 `ui/dialog.css:215-217` 的 `[data-ending-style] .anim-fade { opacity: 0 }`。
Base UI 的 `getAnimations()` 认 transition，所以这条配方成立——**不依赖任何动画库**。

### 5.3 二选一

- **(a) 删依赖**：摘 `apps/web/package.json:30` + `pnpm-lock.yaml`，并删掉那 11 处惰性类串
  （纯噪声，误导读者以为动画由它们提供）。退场行为零变化。
- **(b) 接线**：在 `styles/app.css` 加 `@import "tw-animate-css";`，让 base-nova 官方形态的
  动画真正生效。**注意这会让已有的 `[data-ending-style]` 配方与 tw-animate-css 的
  `animate-out` 叠加**，两套动画同时跑，卸载窗取两者较长的那个。

维持现状（声明了但没接）是唯一不推荐的选项——它让「动画从哪来」这个问题在代码里无解。

## 六、`#418` 矩阵随代数作废的行

改 `#410` 裁 Base UI 后，`#418` 的下述结论**不可直接执行**，以本票为准：

| `#418` 行/节 | `#418` 的说法 | Base UI 事实 |
|---|---|---|
| §2.1 / 矩阵 1 | Esc 靠 layer 栈，只给 topmost 挂 **document capture** 监听 | document **冒泡**（`useDismiss.mjs:458`）；Dialog 家族靠 `escapeKey: isTopmost` 让外层**不注册**（`dialog/root/useDialogRoot.mjs:21,71`） |
| §2.3 / 矩阵 5 | 焦点圈定「缺」，需确认是否引入 | **自带**（`FloatingFocusManager` trap） |
| §2.4 / 矩阵 6 | 覆写点 = `onOpenAutoFocus` | `initialFocus`（`dialog/popup/DialogPopup.d.ts`） |
| §2.5 / 矩阵 7 | `onCloseAutoFocus` + `preventDefault()` 挡 radix 的空回陷 | `finalFocus`；返回 `void` 的函数即「不移动焦点」，**不需要挡** |
| §2.8 / 矩阵 12 | `Presence` **只认 CSS animation**，transition 一律立即卸载 | `getAnimations()` **animation + transition 都认**（`useAnimationsFinished.mjs:74,79`）；属性名 `data-state` → `data-open`/`data-closed`/`data-starting-style`/`data-ending-style` |
| §2.9 / 矩阵 4 | body 滚动锁「缺」 | **自带**（`useScrollLock`，`dialog/root/useDialogRoot.mjs:73`） |
| §6 props 表 | `onEscapeKeyDown` / `onPointerDownOutside` / `onInteractOutside` / `onFocusOutside` / `asChild` / `forceMount` / `container` | 分别对应：**无**（用 `eventDetails.cancel()`）/ `disablePointerDismissal` / 同左 / `closeOnFocusOut` / `render` / `Portal.keepMounted` / `Portal container` |
| §6 末段 | AlertDialog「Escape / 外点默认不关」 | 只屏蔽外点；**Esc 不屏蔽**（`dialog/root/useRenderDialogRoot.mjs:27-29`） |
| §7 条 1、2 | 装 `radix-ui`、装 `tw-animate-css` | 均作废（§4.3、§五） |
| §8 Premortem 1 | 「一次 Esc 关两层」因仓内 window 效应没删干净 | 对**全已迁**组合不成立；对**混搭**组合成立（§2.2） |
| §8 Premortem 2 | 「`tw-animate-css` 未装 → `animationName === 'none'` → Presence 立即卸载」 | 机制名与因果都变：Base UI 看 `getAnimations()`，且 tw-animate-css 本就没接线 |

**结论不变的行**：矩阵 2（遮罩点击关）、3（面板内点击不关）、10（受控语义）、
15（关闭三路径）、13（`#193` 仓内特有）、16（focus 环 canon）、17（`#137` 根标记）、
18（遮罩色/圆角/阴影）；§5「仓内特有必须保留」7 条除第 6 条（遮罩键盘可达性）外均不变，
第 6 条见 §4.2(a)。

## 七、e2e 钉扎面

| spec | 钉住的契约 | 换代后状态 |
|---|---|---|
| `overlay-focus.spec.ts:124-127` | `.overlay-mount:has(.sched-form-overlay)` 的 `data-overlay-state='open'` | **仍是旧栈面**（`schedules-page` 未迁）→ 今天有效；**该面迁移时必须同步重钉** |
| `overlay-focus.spec.ts:104-109` | `elementFromPoint(100,400)` 落在 `.sched-form-overlay` 内（scrim 盖全视口） | 同上 |
| `overlay-focus.spec.ts:38-63` | `#389` 焦点回陷（Esc 后 `document.activeElement` 的聚焦环色） | 已迁面通过（`finalFocus`） |
| `dialog-viewport.spec.ts:20-38,120-130` | `#193`：`CAP = 500-48`、`.dlg-body` 真溢出、按钮 `toBeInViewport`、滚到底不位移、360 高视口封顶 | 已迁面通过（className 承载几何） |
| `rerun-close-family.spec.ts:22-56` | `#168` 手搓 `.overlay` 三关路径 + back 回 rerun | **仍是全手搓面**（`detail/overlays.tsx`） |
| `newtask-single-field.spec.ts:65,74` | `#394` + `#389`：入层 `.new-task-spec`、回陷 `.sidebar-new-task` | 通过（入层靠默认、回陷靠 `finalFocus`） |
| `newtask-project-select.spec.ts:74-89` | 分层 Esc（内层先关）+ 外点只关内层 | 通过（Base UI `isTopmost` + `onEscapeWhileNested`） |
| `hotkeys.spec.ts:121` | `#389` 焦点入层（`.new-task-spec` `toBeFocused`） | 通过 |
| `search-focus.spec.ts` | `#137` ⌘K 输入已聚焦 + 常亮互斥 | 通过（`viewportRoot`） |
| `team-create-agent` / `machine-add-dialog` / `provider-add-dialog` / `provider-oauth` / `secret-add-dialog` / `dialog-viewport` | DialogShell 家族关闭律（X / Esc / backdrop，panel 内点击存活） | 通过 |
| `chip-assign` / `mention-picker-center` / `project-tasks-toolbar` / `board-filter` | 锚定浮层族（FloatingShell）开合与元素锚 | 通过 |
| `integration/test/m5-web-e2e.test.ts:268`、`m7-branch-dialog-e2e.test.ts:99-114`、`task-meta-e2e.test.ts:85` | `.dlg-accept-done` / `.dlg-machine-picker` / `.new-task-dialog` 类锚 | 通过（className 透传） |

`#425` 复跑记录：全量 e2e 336/336，33 个相关 spec **断言零改动**。

## 八、Premortem（假设后续迁移片已失败，3 个最可能死因 + 护栏）

1. **跨代数混搭吃掉内层 Esc**。把一个仍挂 `useEscapeClose`（`window` keydown）的面搬进
   已迁壳内：Base UI 在 document 冒泡阶段 `stopPropagation()`（`useDismiss.mjs:106-109`），
   `window` 收不到那次按键 → 内层关不掉，表现为「Esc 关掉了外层，内层还开着」。
   护栏：内层关闭一律经壳的 `onEscapeWhileNested` 代收；每次混搭迁移后**先跑**
   `newtask-project-select.spec.ts:74-89` 两条分层断言，再跑全量。
2. **惰性动画类串被当成生效**。给新面写 `data-closed:animate-out` 期望有退场，实际零 CSS
   （§五）→ 面**立即卸载**，视觉上是硬切，**且无任何报错**。
   护栏：退场配方照 `ui/dialog.css:207-217` 三件套（popup 自持 `visibility` 延迟过渡 +
   `[data-ending-style]` 终态 + 子级 `anim-*` 终态）；改动画后读 `getAnimations()` 实证，
   不看类名在不在。
3. **未迁面的退场断言在迁移时被漏改**。`overlay-focus.spec.ts:124-127` 钉的是
   `schedules-page` 的 `data-overlay-state`；该面迁移后此属性不再存在，漏改即 CI 红。
   反向同样致命：先删 `motion.css` 的 `.overlay-mount[data-overlay-state="closed"]` 规则
   而面未迁，退场静默消失。

## 九、未决 / 需另立决策

- **`FloatingShell` 的 `ClickCatcher` 去留**：`floating-shell.tsx:14-17` 明说有意保留
  「外点只关浮层、不穿透触发下层元素」的仓内 UX 决策，与 Base UI 原生 outside-press 语义
  不同；`#425` 车道书记为该族唯一待定项。换它是 UX 变更，不是机械迁移。
- **未迁 12 文件的批次划分**：`#425` 缺口声明里的 `chief-drawer`（随 B4）、
  `search-panel`（`#453`）、mention-picker 构建产物居中 bug（`#448`）与 §4.4 的清单需对齐。
- **惰性类串的处置**（§5.3 二选一）：删 `tw-animate-css` 依赖，还是接线 import。
- **入层目标的显式化**：是否给各面接 `initialFocus`，把 §3.1 的隐式契约变成显式契约。
- **背板双通道**（§4.2a）：无嵌套时 `onClose` 被调两次，是否需要去重。

## 十、事实源

- Base UI 源码：npm tarball `@base-ui/react@1.8.0`（3269 文件）解包，本票所有包内
  `path:line` 均相对包根；运行时以 `.mjs` 为准，类型以 `.d.ts` 为准。
- Base UI 官方文档（registry item 的 `meta.links.api` 指向的 `.md` 版）：
  `https://base-ui.com/react/components/dialog.md`、`.../alert-dialog.md`、
  `.../popover.md`、`.../menu.md`
- shadcn `base-nova` registry JSON（4 件，均 `type: registry:ui`，各 1 文件，
  **均无 `dependencies` 字段**，均无 `data-[starting-style]` / `data-[ending-style]`）：
  `https://ui.shadcn.com/r/styles/base-nova/dialog.json`（import `@base-ui/react/dialog`，
  registryDeps `[button]`）、`.../alert-dialog.json`（`@base-ui/react/alert-dialog`）、
  `.../popover.json`（`@base-ui/react/popover`）、`.../dropdown-menu.json`
  （import **`@base-ui/react/menu`**，组件名与 primitive 名不同）
- 对照基准：`docs/research/418-dialog-contract-matrix.md`（分支 `research/dialog-contract`，commit `2246789`）
- 仓内：`apps/web/src/components/ui/{dialog,alert-dialog,dialog-shell,alert-dialog-shell,floating-shell,popover,dropdown-menu}.tsx`、
  `apps/web/src/{overlay,overlays}/*`、`apps/web/src/ui/dialog.css`、
  `apps/web/src/styles/{motion.css,app.css,shadcn.css,tokens.css}`、
  `apps/web/e2e/*.spec.ts`、`apps/web/package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`
- 版本钉：`@base-ui/react` 1.8.0（`apps/web/package.json:19`、`pnpm-lock.yaml:579`）；
  `tailwindcss` 4.3.3（`pnpm-workspace.yaml:27`）；`tw-animate-css` 1.4.0（`apps/web/package.json:30`）