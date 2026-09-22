// Detail header (issue #56, r7 §3.3): back button, #seq, status chip,
// centered 文档|聊天 tab group, right icon group (更多/分支与 PR/Token
// 用量/运行历史 @ pitch 33) and the 50.5×28 primary button.
// #58: the back button carries the current search string home so the
// dev/parity ?scenario= selection survives the round trip; the board
// scroll position is restored by BoardSurface from sessionStorage.

import { Link, useLocation } from 'react-router';
import type { TodoRecord } from '../fixtures/records.js';
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
import { PHASE_UI } from '../phase.js';

interface DetailHeadProps {
  todo: TodoRecord;
  tab: 'doc' | 'chat';
  onTab: (tab: 'doc' | 'chat') => void;
  /** #66: opens the 更多 menu popover. */
  onMore?: () => void;
}

export function DetailHead({ todo, tab, onTab, onMore }: DetailHeadProps) {
  const ui = PHASE_UI[todo.phase];
  const { search } = useLocation();
  return (
    <header className="detail-head">
      <Link className="detail-back" to={{ pathname: '/app', search }} aria-label="返回">
        <ChevronLeft />
      </Link>
      <span className="detail-seq">#{todo.seqNum}</span>
      <span className={`detail-chip detail-chip--${ui.tone}`}>
        {ui.chip}
        <ChevronDown width={12} height={12} />
      </span>

      {ui.tabs && (
        <div className="detail-tabs">
          <div className="detail-tabs-group">
            <button
              type="button"
              className={`detail-tab${tab === 'doc' ? ' detail-tab--active' : ''}`}
              aria-label="文档"
              onClick={() => onTab('doc')}
            >
              <FileTab width={14} height={14} />
            </button>
            <button
              type="button"
              className={`detail-tab${tab === 'chat' ? ' detail-tab--active' : ''}`}
              aria-label="聊天"
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
          aria-label="更多"
          onClick={onMore}
        >
          <EllipsisVertical />
        </button>
        <button type="button" className="detail-head-icon" aria-label="分支与 PR">
          <Download width={15} height={15} />
        </button>
        <button type="button" className="detail-head-icon" aria-label="Token 用量">
          <BarChart3 />
        </button>
        <button type="button" className="detail-head-icon" aria-label="运行历史">
          <History />
        </button>
        {ui.action != null && (
          <button type="button" className="detail-head-action">
            {ui.action}
          </button>
        )}
      </div>
    </header>
  );
}
