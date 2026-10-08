// FloatingShell 适配层（#425 B1）——**退役中（#1008，#983 判决）**：锚定
// 浮层族已按族拆回 registry 件（面板族 popover.tsx / 菜单族 dropdown-menu.tsx
// / 居中模态族 dialog.tsx，回消费点组合）。本文件唯一存量消费 = select.tsx
// （XMON-75 手写件，波 2 #1010 重建后本文件随之删除）；新面禁止再上。
//
// 机制 = Base UI Dialog（**非模态**：不圈焦点、无背板），Esc 走 Base UI 的
// layer 栈；定位由各面自己的 capture 坐标 CSS 承载，故不需要 Positioner/anchor。
// `container` prop 把 portal 挂回该面的锚 wrap（absolute 面的 containing
// block 保真）。`ClickCatcher`（透明全屏 button，overlays/dismiss.tsx）=
// 「外点只关浮层、不穿透」的旧家族律；registry 面的原生 outside-press 语义
// 与之差异留 #1008 原型实审裁决。
//
// 别名类原样输出（#411 别名优先政策）。

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import type { CSSProperties, ReactNode } from 'react';

/** 锚定 pop 族的退场 visibility 桥（#656；floating-shell.css 退役后机制即
 *  utility，#952）：面板退场由 group-data-closed/fshell:animate-out 承载，但
 *  Base UI 只在 Popup 本体有进行中动画时才延迟卸载（getAnimations 不看子树），
 *  故壳挂一条零视觉的 visibility 延迟过渡撑住卸载窗（--dur-fast = 150ms ≥
 *  面板 duration-100），让面板 animate-out 播完再卸。消费面经 FloatingShell
 *  className 叠上（opt-in：不带面板动画的面不需要桥）。 */
export const EXIT_BRIDGE_CLS =
  '[transition:visibility_0s_linear_var(--dur-fast)] data-[ending-style]:invisible';

/** 200ms 面（duration-200 的 fade 族：sched-form scrim / new-task discard，
 *  沿旧 --dur-overlay 时序）用本变体撑满退场窗——桥短于面板会把 fade 拦腰
 *  截断。自含整条机制，不与 EXIT_BRIDGE_CLS 叠用。 */
export const EXIT_BRIDGE_SLOW_CLS =
  '[transition:visibility_0s_linear_var(--dur-overlay)] data-[ending-style]:invisible';

/** 锚定 pop 族的进出场（V2 覆写，base-ui-theme §1.2/原型 L371：scale .98 +
 *  fade、100ms ease-out、origin 随锚位——替代 ADR 0009 D3 的 slide -8px。
 *  zoom-in-98/out-98 是 tw-animate-css 的 functional utility（任意数值直通
 *  scale），与 animate-in/out 同机制，单面单机制（F5）。挂在**内层面板**上、
 *  经壳的具名 group 读 Base UI 的 data-open/data-closed——transform 不能上
 *  Popup：本族面板是 fixed/absolute 子级，Popup 带 transform 会把它们的
 *  containing block 拽走（#656）。
 *  group-data-closed/fshell:fill-mode-forwards：tw 的 exit keyframe 缺省
 *  fill=none，面板动画（100ms）先于壳 visibility 桥（150ms）结束时会在残余
 *  窗口闪回不透明——forwards 把退场终帧钉住直到卸载。只在 closed 态挂：
 *  静息/入场后的 computed transform 回到 none（#448 的「居中不借 transform」
 *  字面钉照旧成立）。 */
export const FLOATING_POP_ANIM =
  'duration-100 ease-out group-data-closed/fshell:fill-mode-forwards group-data-open/fshell:animate-in group-data-open/fshell:fade-in-0 group-data-open/fshell:zoom-in-98 group-data-closed/fshell:animate-out group-data-closed/fshell:fade-out-0 group-data-closed/fshell:zoom-out-98';

interface FloatingShellProps {
  /** #73: retained-mount open flag. */
  open: boolean;
  onClose: () => void;
  /** 面类名（别名锚）+ 该面的固定定位/几何类。 */
  className?: string;
  /** 面级样式位（z-index 等；仓内浮层阶梯由各面自持）。 */
  style?: CSSProperties;
  /** Portal 目标（缺省 body）。本族大多是 fixed 坐标，portal 去哪都一样；
   *  唯一例外是相对触发位 absolute 锚定的面（plan-dropdown 之于
   *  .doc-select-wrap）——把 portal 指回触发容器，DOM 树位与 containing
   *  block 都不变，几何逐像素保。 */
  container?: HTMLElement | null;
  /** Base UI Popup 初始焦点直通（缺省 = Base UI 缺省：开面即把焦点移进
   *  弹层）。false = 焦点留在触发位——toggle 型触发面（chip popover，#666）
   *  的键盘契约是「同一个键再按一次关面」，焦点被弹层抢走后第二次 Enter
   *  落在弹层内部件上（时序竞态：e2e H2 flake + 键盘用户随机开分配弹窗）。
   *  Esc 关面不受影响：useDismiss 的 escapeKey 不走 pointer 面。 */
  initialFocus?: boolean;
  /** 关掉 Base UI 原生 outside-press 关面（直通 Dialog Root 同名 prop）。
   *  家族律里外点归 ClickCatcher（全屏透明钮，弹层子树内——Base UI 判
   *  isInside 不触发原生 dismiss）；原生 outsidePress 实际只会接住键盘合成
   *  click（焦点在触发钮上按 Enter，事件目标是弹层外的钮）——与触发钮自身
   *  的 toggle onClick 双写同一 state（capture dismiss 先置 false、React
   *  onClick 后 !v 翻回 true），toggle 面于是「关不掉」。#666 实测。 */
  disablePointerDismissal?: boolean;
  children: ReactNode;
}

export function FloatingShell({
  open,
  onClose,
  className,
  style,
  container,
  initialFocus,
  disablePointerDismissal,
  children,
}: FloatingShellProps) {
  return (
    <DialogPrimitive.Root
      open={open}
      modal={false}
      // undefined = Base UI 缺省（编译面对 undefined 与缺省同判）
      disablePointerDismissal={disablePointerDismissal}
      onOpenChange={(next: boolean) => {
        if (!next) onClose();
      }}
    >
      <DialogPrimitive.Portal container={container}>
        <DialogPrimitive.Popup
          data-slot="floating-layer"
          // 具名 group：内层面板经 group-data-open/closed/fshell 读本 Popup 的
          // Base UI 开闭态（FLOATING_POP_ANIM）；不消费该 group 的面零影响。
          className={`group/fshell${className != null ? ` ${className}` : ''}`}
          style={style}
          // 非模态面不做 aria-modal；语义靠 role 与面自身 aria 承载
          role="dialog"
          // undefined = Base UI 缺省（其编译面对 undefined 与缺省同判）
          initialFocus={initialFocus}
        >
          {children}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
