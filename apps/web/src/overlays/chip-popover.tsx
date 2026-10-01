// Status-chip popover (issue #67, r7 19 / 29): 298×193 panel anchored under
// the detail-header chip (left = chip − 18, top = chip bottom + 3.5, r7
// §3.5 @ (287,34.5)). Structure verbatim from the captures: project head
// (12px avatar + name + #seq), two-line title, divider, 任务 section
// (assignee row), the selected 执行对话 section (agent row + indigo check,
// the highlight covering label and row), divider, 编辑分配 row.

import { useAgentAvatarUrlById, useLiveData } from '../api/provider.js';
import { Button } from '../components/ui/button.js';
import { SeededAvatar } from '../components/ui/seeded-avatar.js';
import { AGENT_MODEL_LINE, PROJECT_INITIAL, PROJECT_NAME } from '../fixtures/fixtures.js';
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
  // XMON-105: the 任务 (owner) row shows the logged-in user's own identity
  // avatar — single source, same face as the sidebar chip / account head.
  const { user } = useLiveData();
  const agentAvatarUrl = useAgentAvatarUrlById();
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
          <SeededAvatar name={user.displayName} src={user.avatarUrl} fallback="/avatar-user.png" />
          {user.displayName}
        </div>
      </div>
      <div className="chip-popover-section chip-popover-section--selected">
        <div className="chip-popover-label">{t('执行对话')}</div>
        <div className="chip-popover-row">
          <SeededAvatar
            name={todo.agent?.displayName}
            src={todo.agent ? (agentAvatarUrl.get(todo.agent.id) ?? null) : null}
            fallback="/avatar-robot-1.svg"
          />
          {/* 未指派 fallback is [推断]: every capture shows an assigned agent */}
          {todo.agent?.displayName ?? t('未指派')} · {AGENT_MODEL_LINE}
          <span className="chip-popover-check">
            <Check width={14} height={14} />
          </span>
        </div>
      </div>
      <div className="chip-popover-divider" />
      <Button
        variant="ghost"
        size="default"
        className="chip-popover-edit h-auto rounded-none justify-start gap-0 active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
        onClick={onEditAssign}
      >
        <Settings width={14} height={14} />
        {t('编辑分配')}
      </Button>
    </div>
  );
}
