// Board todo card (issue #54): 262×114.5 base-state card from the r7 01/02
// captures — project chip row, two-line 14px title, bottom row with agent
// avatar + status badge, relative time, 方案/变更 metric icons and the
// phase-driven action button (确认/完成 indigo, 回复 ghost).
// #55 adds the variant matrix: fresh cards swap the robot for the owner
// placeholder (UserCircle + gray idle badge + 开始 primary — r7 22/22d),
// review cards gain the amber attention badge (r7 33) on top of the #54
// states.
// #58: card click opens `/app/todo/:id` — a stretched link on the title
// (real <a>, ::after overlay covers the card) so the nested branch/action
// buttons stay valid independent controls; the current search string rides
// along so the dev/parity ?scenario= selection survives the navigation.

import { Link, useLocation } from 'react-router';
import { PROJECT_INITIAL, PROJECT_NAME } from '../fixtures/fixtures.js';
import type { TodoRecord } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import {
  CheckWhite,
  Download,
  FileText,
  GitCommit,
  SearchWhite,
  UserCircle,
} from '../icons/index.js';
import { Button } from '../ui/button.js';
import { cardAction } from './columns.js';
import { relativeTime } from './rel-time.js';

interface TodoCardProps {
  todo: TodoRecord;
  now: number;
  /** Card action button (确认/完成/回复); the page decides what it does
   *  (issue #68: review-phase 完成 opens the accept dialog). */
  onAction?: (todo: TodoRecord) => void;
  /** Card branch icon (issue #68): opens the 分支与 PR dialog. */
  onBranch?: (todo: TodoRecord) => void;
  /** M5 live：项目 chip 真名（fixture.projectNames 位）；缺省 = capture
   *  canon 常量（r7 22 `r3-lifecycle`）。 */
  projectName?: string;
}

/** Badge on the agent avatar: amber magnifier while the run is waiting on
 *  the user (待确认 02 #9, 待验收 33 #9, 等待回复 01 #1), green check once
 *  done (r7 01b #2, 35 #9). Fresh cards carry a gray idle badge with the
 *  same magnifier glyph (r7 22/22d — badge shape pixel-matches the amber
 *  one at gray #9ea3ae). */
function badgeFor(todo: TodoRecord): 'idle' | 'attention' | 'done' | 'failed' | null {
  if (todo.phase === 'done') return 'done';
  // r8 55: the failed card's avatar carries the red `!` badge
  if (todo.phase === 'failed') return 'failed';
  if (todo.phase === 'confirm' || todo.phase === 'review' || todo.awaitingReply === true) {
    return 'attention';
  }
  if (todo.phase === 'todo' || todo.phase === 'queued') return 'idle';
  return null;
}

export function TodoCard({ todo, now, onAction, onBranch, projectName }: TodoCardProps) {
  const chipName = projectName ?? PROJECT_NAME;
  const chipInitial = projectName ? projectName.charAt(0).toLowerCase() : PROJECT_INITIAL;
  const { t } = useI18n();
  const action = cardAction(todo);
  const badge = badgeFor(todo);
  const fresh = badge === 'idle';
  const { search } = useLocation();
  return (
    <article className="todo-card" data-todo-id={todo.id}>
      <div className="todo-card-row1">
        <span className="project-avatar">{chipInitial}</span>
        <span className="todo-project-name">{chipName}</span>
        <span className="todo-card-seq">#{todo.seqNum}</span>
        {/* A4-deep 收编：icon 变体皮肤；13×16 几何与 dim 墨 per-face 留
            board.css（.btn.todo-card-branch） */}
        <Button
          variant="icon"
          className="todo-card-branch"
          aria-label={t('分支与 PR')}
          onClick={() => onBranch?.(todo)}
        >
          <Download />
        </Button>
      </div>

      <h3 className="todo-card-title">
        <Link className="todo-card-link" to={{ pathname: `/app/todo/${todo.id}`, search }}>
          {todo.title}
        </Link>
      </h3>

      <div className="todo-card-bottom">
        <span className="todo-agent-avatar">
          {fresh ? (
            // owner placeholder while no agent run exists (r7 22/22d)
            <UserCircle width={20} height={20} />
          ) : (
            <img src="/avatar-robot-1.svg" alt="" />
          )}
          {badge === 'idle' && (
            <span className="todo-agent-badge todo-agent-badge--idle">
              <SearchWhite width={9} height={9} />
            </span>
          )}
          {badge === 'attention' && (
            <span className="todo-agent-badge todo-agent-badge--attention">
              <SearchWhite width={9} height={9} />
            </span>
          )}
          {badge === 'done' && (
            <span className="todo-agent-badge todo-agent-badge--done">
              <CheckWhite width={9} height={9} />
            </span>
          )}
          {badge === 'failed' && (
            <span className="todo-agent-badge todo-agent-badge--failed" aria-hidden="true">
              !
            </span>
          )}
        </span>
        <span className="todo-card-time">{relativeTime(todo.phaseAt, now, t)}</span>
        {todo.hasPlan && (
          <span className="todo-card-metric" role="img" aria-label={t('方案')}>
            <FileText />
          </span>
        )}
        {todo.hasChanges && (
          <span className="todo-card-metric" role="img" aria-label={t('变更')}>
            <GitCommit />
          </span>
        )}
        <span className="todo-card-spacer" />
        {/* A3 收编：Button primary/ghost 的 card 26 档；kind 直接映射
            variant（columns.ts cardAction 单源）。todo-card-action 系列是
            e2e(board-dnd 钉 --ghost) 选择器别名，经 className 透传保留。 */}
        {action != null && (
          <Button
            variant={action.kind}
            size="card"
            className={`todo-card-action todo-card-action--${action.kind}`}
            onClick={() => onAction?.(todo)}
          >
            {t(action.label)}
          </Button>
        )}
      </div>
    </article>
  );
}
