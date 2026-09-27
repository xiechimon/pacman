// Detail header (issue #56, r7 §3.3): back button, #seq, status chip,
// centered 文档|聊天 tab group, right icon group (更多/分支与 PR/Token
// 用量/运行历史 @ pitch 33) and the 50.5×28 primary button.
// #58: the back button carries the current search string home so the
// dev/parity ?scenario= selection survives the round trip; the board
// scroll position is restored by BoardSurface from sessionStorage.
// #67: the chip is a real button — it toggles the status popover (r7
// 19/29), and the chevron rides outside the pill (r7 17 measure).

import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import type { TodoRecord } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import {
  BarChart3,
  ChevronDown,
  ChevronLeft,
  Download,
  EllipsisVertical,
  FileTab,
  History,
  MessageSquare,
} from '../icons/index.js';
import { ChipPopover } from '../overlays/chip-popover.js';
import { ClickCatcher, OverlayMount, useEscapeClose } from '../overlays/dismiss.js';
import { PHASE_UI } from '../phase.js';
import { Button } from '../ui/button.js';
import { Chip } from '../ui/chip.js';

/** Header icon overlays the right icon group opens (issue #68). */
export type HeadOverlay = 'branch' | 'token' | 'history';

interface DetailHeadProps {
  todo: TodoRecord;
  /** Rendered phase; the reject chain overrides the record's phase
   *  (replan streaming / building rounds, issue #75). */
  phase?: TodoRecord['phase'];
  tab: 'doc' | 'chat';
  onTab: (tab: 'doc' | 'chat') => void;
  /** #66: opens the 更多 menu popover. */
  onMore?: () => void;
  /** Right icon group (issue #68): 分支与PR / Token 用量 / 运行历史. */
  onOverlay: (kind: HeadOverlay) => void;
  /** Primary button (开始/确认/完成/重开/重跑); the page decides what it
   *  does — the reject chain's 确认 step, the failed 重跑 dialog (#75). */
  onAction: () => void;
  /** Scenario-frozen initial open state of the chip popover (#67). */
  chipPopoverOpen?: boolean;
  /** #209: chip popover「编辑分配」入口——关 popover 后由页层开 agent 选择
   *  弹层(弹层挂页层:popover 关即卸载,挂内层会被带走)。 */
  onEditAssign?: () => void;
  /** M7 #312 / r8 §3.1：审核中态旗标——chip 改「审核中」、composer placeholder
   * 改「AI 审核进行中…」、期间显示停止钮（复用 #308）。 */
  reviewActive?: boolean;
}

export function DetailHead({
  todo,
  phase,
  tab,
  onTab,
  onMore,
  onOverlay,
  onAction,
  chipPopoverOpen,
  onEditAssign,
  reviewActive,
}: DetailHeadProps) {
  const { t } = useI18n();
  // AI 审核中态（M7 #312，r8 §3.1）：chip 文案与 phase 解耦——「审核中」字面
  // 反映活动步 kind 而非 phase（review 步是额外 agent 步，phase 留 confirm/
  // review）。tone 用 confirm（同色与待确认期一致，不引入新色）。
  const ui = reviewActive
    ? { ...PHASE_UI[phase ?? todo.phase], chip: '审核中' }
    : PHASE_UI[phase ?? todo.phase];
  const { search } = useLocation();
  const [popover, setPopover] = useState(chipPopoverOpen === true);
  useEscapeClose(popover, () => setPopover(false));
  return (
    <header className="detail-head">
      <Link className="detail-back" to={{ pathname: '/app', search }} aria-label={t('返回')}>
        <ChevronLeft />
      </Link>
      <span className="detail-seq">#{todo.seqNum}</span>
      <span className="detail-chipwrap">
        {/* A3: 五态 pill 视觉收编 Chip 原语（variant 同名映射）；detail-chip
            基类与 detail-chip--<tone> 别名保留——e2e 按 .detail-chip 定位点击。 */}
        <button
          type="button"
          className="detail-chip"
          aria-expanded={popover}
          onClick={() => setPopover((value) => !value)}
        >
          <Chip variant={ui.tone} className={`detail-chip--${ui.tone}`}>
            {t(ui.chip)}
          </Chip>
        </button>
        <span className="detail-chip-chevron">
          <ChevronDown width={12} height={12} />
        </span>
        <OverlayMount open={popover}>
          <ClickCatcher onClose={() => setPopover(false)} />
          <ChipPopover
            todo={todo}
            onEditAssign={
              onEditAssign == null
                ? undefined
                : () => {
                    // 先关 popover 再开弹层:两 overlay 不叠(家族律单实例)。
                    setPopover(false);
                    onEditAssign();
                  }
            }
          />
        </OverlayMount>
      </span>

      {ui.tabs && (
        <div className="detail-tabs">
          <div className="detail-tabs-group">
            <button
              type="button"
              className={`detail-tab${tab === 'doc' ? ' detail-tab--active' : ''}`}
              aria-label={t('文档')}
              onClick={() => onTab('doc')}
            >
              <FileTab width={14} height={14} />
            </button>
            <button
              type="button"
              className={`detail-tab${tab === 'chat' ? ' detail-tab--active' : ''}`}
              aria-label={t('聊天')}
              onClick={() => onTab('chat')}
            >
              <MessageSquare width={14} height={14} />
            </button>
          </div>
        </div>
      )}

      <div className="detail-head-actions">
        <button
          type="button"
          className="detail-head-icon detail-head-icon--more"
          aria-label={t('更多')}
          onClick={onMore}
        >
          <EllipsisVertical />
        </button>
        <button
          type="button"
          className="detail-head-icon"
          aria-label={t('分支与 PR')}
          onClick={() => onOverlay('branch')}
        >
          <Download width={15} height={15} />
        </button>
        <button
          type="button"
          className="detail-head-icon"
          aria-label={t('Token 用量')}
          onClick={() => onOverlay('token')}
        >
          <BarChart3 />
        </button>
        <button
          type="button"
          className="detail-head-icon"
          aria-label={t('运行历史')}
          onClick={() => onOverlay('history')}
        >
          <History />
        </button>
        {ui.action != null && (
          <Button
            variant="primary"
            size="compact"
            className="detail-head-action"
            onClick={onAction}
          >
            {t(ui.action)}
          </Button>
        )}
      </div>
    </header>
  );
}
