// 更多 menu (issue #66, r7 18/24): 220×165 popover anchored under the
// detail header's 更多 button (right edge 1272.5, top 39.5). Four items
// 完成 / 复制链接 / 关闭 / 删除 with per-row separators; 删除 is the
// danger row (r5b §05d, r6 §4.2). No backdrop — a transparent catcher
// closes it on outside click (r7 §4.1.4 keeps popovers above the page).
// 复制链接 copies the route URL (r2 §5.3).
// #318: 完成/关闭 接真(r1 changelog 09-16「菜单项按当前 phase 出:Complete
// 走看板自带 confirm-and-merge、Close 关闭语义」)——完成 = 相位适配动作
// (confirm 关口确认 / review 验收弹层→merge 链,调用位裁定),关闭 = 关闭
// 语义落 closed。无该相位语义的行渲染 disabled(原站按相位出项,pacman
// 保持四行恒定 = 捕获几何;运行中禁用同 r1 Delete-in-turn 先例)。r1 的
// 延迟 Undo 窗口不落地([设计] 票内裁量 wontfix:关闭即刻生效,重开走
// closed→todo reopen 面)。

import { useI18n } from '../i18n/provider.js';
import { Ban, Check, Copy, Trash2 } from '../icons/index.js';
import { OverlayMount } from '../overlays/dismiss.js';
import { useEscClose } from './use-esc.js';
import './overlay.css';

interface MoreMenuProps {
  /** #73: retained-mount open flag — the exit pop outlives the close. */
  open: boolean;
  onClose: () => void;
  onDelete: () => void;
  /** #318: 完成 = 相位适配动作(confirm/review);其余相位 disabled。 */
  onComplete: () => void;
  canComplete: boolean;
  /** #318: 关闭 = phase closed 落账;server 漏斗现有边(todo/failed)外
   *  disabled(review/confirm/done→closed 边归 W3 server 票,#318 注记)。 */
  onCloseTask: () => void;
  canClose: boolean;
}

export function MoreMenu({
  open,
  onClose,
  onDelete,
  onComplete,
  canComplete,
  onCloseTask,
  canClose,
}: MoreMenuProps) {
  const { t } = useI18n();
  useEscClose(onClose, open);
  const copyLink = () => {
    void navigator.clipboard?.writeText(window.location.href);
    onClose();
  };
  return (
    <OverlayMount open={open}>
      <button
        type="button"
        className="more-menu-catcher anim-fade"
        aria-label={t('关闭菜单')}
        onClick={onClose}
      />
      <div className="more-menu anim-pop" role="menu" aria-label={t('更多')}>
        <button
          type="button"
          role="menuitem"
          className="more-menu-item"
          disabled={!canComplete}
          onClick={onComplete}
        >
          <Check />
          {t('完成')}
        </button>
        <button type="button" role="menuitem" className="more-menu-item" onClick={copyLink}>
          <Copy />
          {t('复制链接')}
        </button>
        <button
          type="button"
          role="menuitem"
          className="more-menu-item"
          disabled={!canClose}
          onClick={onCloseTask}
        >
          <Ban />
          {t('关闭')}
        </button>
        <button
          type="button"
          role="menuitem"
          className="more-menu-item"
          data-action="delete"
          onClick={onDelete}
        >
          <Trash2 />
          {t('删除')}
        </button>
      </div>
    </OverlayMount>
  );
}
