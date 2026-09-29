// FloatingShell 适配层（#425 B1）：锚定浮层族（plan-dropdown / chip-popover /
// more-menu / 侧栏用户菜单 / skills-page 排序 / chief-model-select /
// mention-picker）的共用底座。
//
// 机制换 Base UI Dialog（**非模态**：不圈焦点、无背板），Esc 走 Base UI 的
// layer 栈；定位仍由各面自己的 capture 固定坐标 CSS 承载（这族是 fixed 坐标
// 而非动态锚定，见 #409 盘点），故不需要 Positioner/anchor。
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
  children: ReactNode;
}

export function FloatingShell({
  open,
  onClose,
  className,
  style,
  container,
  children,
}: FloatingShellProps) {
  return (
    <DialogPrimitive.Root
      open={open}
      modal={false}
      onOpenChange={(next: boolean) => {
        if (!next) onClose();
      }}
    >
      <DialogPrimitive.Portal container={container}>
        <DialogPrimitive.Popup
          data-slot="floating-layer"
          className={className}
          style={style}
          // 非模态面不做 aria-modal；语义靠 role 与面自身 aria 承载
          role="dialog"
        >
          {children}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
