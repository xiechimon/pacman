// 更多 menu (issue #66, r7 18/24): 220×165 popover anchored under the
// detail header's 更多 button (right edge 1272.5, top 39.5). Four items
// 完成 / 复制链接 / 关闭 / 删除 with per-row separators; 删除 is the
// danger row (r5b §05d, r6 §4.2). No backdrop — a transparent catcher
// closes it on outside click (r7 §4.1.4 keeps popovers above the page).
// 复制链接 copies the route URL (r2 §5.3); 完成/关闭 lifecycle mutations
// land with the backend line (03 §M2+), so they only dismiss the menu.

import { Ban, Check, Copy, Trash2 } from '../icons/index.js';
import { useEscClose } from './use-esc.js';
import './overlay.css';

interface MoreMenuProps {
  onClose: () => void;
  onDelete: () => void;
}

export function MoreMenu({ onClose, onDelete }: MoreMenuProps) {
  useEscClose(onClose);
  const copyLink = () => {
    void navigator.clipboard?.writeText(window.location.href);
    onClose();
  };
  return (
    <>
      <button type="button" className="more-menu-catcher" aria-label="关闭菜单" onClick={onClose} />
      <div className="more-menu" role="menu" aria-label="更多">
        <button type="button" role="menuitem" className="more-menu-item" onClick={onClose}>
          <Check />
          完成
        </button>
        <button type="button" role="menuitem" className="more-menu-item" onClick={copyLink}>
          <Copy />
          复制链接
        </button>
        <button type="button" role="menuitem" className="more-menu-item" onClick={onClose}>
          <Ban />
          关闭
        </button>
        <button
          type="button"
          role="menuitem"
          className="more-menu-item"
          data-action="delete"
          onClick={onDelete}
        >
          <Trash2 />
          删除
        </button>
      </div>
    </>
  );
}
