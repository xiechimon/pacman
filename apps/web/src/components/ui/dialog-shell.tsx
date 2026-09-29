// DialogShell 适配层（#425 B1）：对外 API 与 `ui/dialog-shell.tsx` 逐字相同，
// 内部换成 shadcn/Base UI Dialog——11 个消费点只改 import 路径，调用点零改动。
//
// 换掉的机制（#418 对照矩阵）：Esc 分层（Base UI layer 栈，只关最顶层）、
// 遮罩外点、焦点圈定、退场（data-open/data-closed + tw-animate-css 的
// animate-out，替代仓内 JS 定时器 + transition）、body 滚动锁。
//
// 保住的契约：
// - #193 三段律：panel = 封顶 flex 列（head 固定 / body 自滚 / foot 钉底），
//   高表单挤不出提交钮——几何与旧壳逐值对齐（max-h = 100vh - 48px）；
// - #389 焦点回陷：开时记住触发位，关时归还（finalFocus），不经 Base UI 的
//   trigger 推定（仓内触发钮多在 dialog 树外）；
// - 壳类别名（.dlg / .dlg-backdrop / .dlg-head / .dlg-title / .dlg-close /
//   .dlg-body / .dlg-foot）原样输出——三面钉扎零改动（#411 别名优先政策）；
// - per-face 类（.dlg-secret-create 等）经 className 透传，规则仍在 dialog.css。

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { type ReactNode, useCallback, useEffect, useRef } from 'react';
import { useI18n } from '../../i18n/provider.js';
import { X } from '../../icons/index.js';
// 表单族（.dlg-form-* 等 per-face 规则）仍在 dialog.css；壳级规则已随本适配层退役
import '../../ui/dialog.css';

interface DialogShellProps {
  /** Left header title; absent when `headerCenter` renders instead. */
  title?: string;
  /** Centered header content (segmented tabs, r7 31). */
  headerCenter?: ReactNode;
  /** #73 retained-mount open flag; the exit fade outlives the close. */
  open?: boolean;
  onClose: () => void;
  children: ReactNode;
  /** #193: pinned below the body scroll region — submit/cancel rides here so
   *  a tall form scrolls the fields, never the buttons. */
  footer?: ReactNode;
  /** #309: face class on the .dlg panel — per-face geometry/CSS and the
   *  class-locator discipline (e2e pins) without touching the family base. */
  className?: string;
  /** Panel width in px (defaults to 448 = family law #68); M7 #312 review
   *  dialog uses 560. */
  width?: number;
}

/** 触发位记忆（#389 回陷契约）：关闭态持续记住"最后一个对话框之外的活动元素"，
 *  关闭时归还。开态不记（那时的 activeElement 已在层内）；也不经 Base UI 的
 *  trigger 推定——仓内触发钮多在 dialog 树外。 */
function useReturnFocus(open: boolean) {
  const origin = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) return;
    const el = document.activeElement;
    if (el instanceof HTMLElement && el.closest('[data-slot="dialog-content"]') == null) {
      origin.current = el;
    }
  });
  const restore = useCallback(() => {
    origin.current?.focus();
  }, []);
  return { restore };
}

export function DialogShell({
  title,
  headerCenter,
  open = true,
  onClose,
  children,
  footer,
  className,
  width = 448,
}: DialogShellProps) {
  const { t } = useI18n();
  const { restore } = useReturnFocus(open);

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next: boolean) => {
        if (!next) onClose();
      }}
      modal
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          data-slot="dialog-overlay"
          className="dlg-backdrop fixed inset-0 z-40 flex items-center justify-center bg-black/60 duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          // #389：关闭后归还触发位（Base UI 的 finalFocus），不经 trigger 推定
          finalFocus={restore}
          className={`dlg${className != null ? ` ${className}` : ''} fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100vh-48px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[12px] bg-popover text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none duration-200 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95`}
          style={{ width }}
          aria-label={title}
        >
          <div
            className={`dlg-head relative flex h-12 flex-none items-center border-b border-border px-4${
              headerCenter != null ? ' dlg-head--plain justify-center border-b-0' : ''
            }`}
          >
            {title != null && (
              <span className="dlg-title text-sm font-medium text-foreground">{title}</span>
            )}
            {headerCenter}
            <DialogPrimitive.Close
              className="dlg-close absolute right-3 flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
              aria-label={t('关闭')}
              onClick={onClose}
            >
              <X width={16} height={16} />
            </DialogPrimitive.Close>
          </div>
          <div className="dlg-body min-h-0 flex-1 overflow-y-auto">{children}</div>
          {footer != null && <div className="dlg-foot flex-none">{footer}</div>}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
