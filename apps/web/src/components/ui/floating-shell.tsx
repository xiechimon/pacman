// FloatingShell 适配层（#425 B1）：锚定浮层族（plan-dropdown / chip-popover /
// more-menu / 侧栏用户菜单 / skills-page 排序 / chief-model-select /
// mention-picker）的共用底座。
//
// 机制换 Base UI Dialog（**非模态**：不圈焦点、无背板），Esc 走 Base UI 的
// layer 栈；定位仍由各面自己的 capture 坐标 CSS 承载，故不需要 Positioner/anchor。
//
// **定位的事实（两条车道独立实测后修正）**：这族**多数是 `position:absolute`
// 相对各自锚 wrap**（plan-dropdown / chip-popover / chief-model-select /
// skills 排序），不是 fixed 坐标——portal 到 body 会换掉 containing block 把面
// 甩出视口。故底座提供 `container` prop：把 portal 挂回该面的锚 wrap，DOM 树位
// 与几何不变（对 fixed 坐标的面（more-menu / mention-picker）保持缺省 body）。
//
// **有意保留**：`ClickCatcher`（透明全屏 button）语义原样——它是「外点只关
// 浮层、不穿透触发下层元素」的仓内 UX 决策，与 Base UI 原生 outside-press
// 语义不同。换它是 UX 变更，不是机械迁移，故不在本片混做（已在 #425 车道书
// 记为该族唯一的待定项）。
//
// 别名类原样输出（.plan-dropdown / .chip-popover / .more-menu / .overlay-mount
// 等由各面 className 透传），三面钉扎零改动（#411 别名优先政策）。

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import type { CSSProperties, ReactNode } from 'react';
import './floating-shell.css';

/** 锚定 pop 族的进出场（shadcn 默认档，ADR 0009 D3：duration-100 + fade + zoom-95
 *  + slide -8px）。挂在**内层面板**上、经壳的具名 group 读 Base UI 的
 *  data-open/data-closed——transform 不能上 Popup：本族面板是 fixed/absolute
 *  子级，Popup 带 transform 会把它们的 containing block 拽走（#656）。 */
export const FLOATING_POP_ANIM =
  'duration-100 group-data-open/fshell:animate-in group-data-open/fshell:fade-in-0 group-data-open/fshell:zoom-in-95 group-data-open/fshell:slide-in-from-top-2 group-data-closed/fshell:animate-out group-data-closed/fshell:fade-out-0 group-data-closed/fshell:zoom-out-95 group-data-closed/fshell:slide-out-to-top-2';

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
