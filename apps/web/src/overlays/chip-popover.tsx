// Status-chip popover (issue #67, r7 19 / 29): 298×193 panel anchored under
// the detail-header chip (left = chip − 18, top = chip bottom + 3.5, r7
// §3.5 @ (287,34.5)). Structure verbatim from the captures: project head
// (12px avatar + name + #seq), two-line title, divider, 任务 section
// (assignee row), the selected 执行对话 section (agent row + indigo check,
// the highlight covering label and row), divider, 编辑分配 row.

import {
  AGENT_MODEL_LINE,
  PROJECT_INITIAL,
  PROJECT_NAME,
  USER_NAME,
} from '../fixtures/fixtures.js';
import type { TodoRecord } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { Check, Settings } from '../icons/index.js';
import './overlays.css';

interface ChipPopoverProps {
  todo: TodoRecord;
  /** #209「编辑分配」接线:点击开 agent 选择弹层(#182 家族形态);弹层挂
   *  在页层(popover 关即卸载,挂内层会被带走)。 */
  onEditAssign?: () => void;
}

export function ChipPopover({ todo, onEditAssign }: ChipPopoverProps) {
  const { t } = useI18n();
  return (
    <div className="chip-popover" role="dialog" aria-label={t('任务分配')}>
      <div className="chip-popover-head">
        <span className="chip-popover-avatar">{PROJECT_INITIAL}</span>
        <span className="chip-popover-project">{PROJECT_NAME}</span>
        <span className="chip-popover-seq">#{todo.seqNum}</span>
      </div>
      <div className="chip-popover-title">{todo.title}</div>
      <div className="chip-popover-divider" />
      <div className="chip-popover-section">
        <div className="chip-popover-label">{t('任务')}</div>
        <div className="chip-popover-row">
          <img src="/avatar-user.png" alt="" />
          {USER_NAME}
        </div>
      </div>
      <div className="chip-popover-section chip-popover-section--selected">
        <div className="chip-popover-label">{t('执行对话')}</div>
        <div className="chip-popover-row">
          <img src="/avatar-robot-1.svg" alt="" />
          {/* 未指派 fallback is [推断]: every capture shows an assigned agent */}
          {todo.agent?.displayName ?? t('未指派')} · {AGENT_MODEL_LINE}
          <span className="chip-popover-check">
            <Check width={14} height={14} />
          </span>
        </div>
      </div>
      <div className="chip-popover-divider" />
      <button type="button" className="chip-popover-edit" onClick={onEditAssign}>
        <Settings width={14} height={14} />
        {t('编辑分配')}
      </button>
    </div>
  );
}
