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
import {
  CheckWhite,
  Download,
  FileText,
  GitCommit,
  SearchWhite,
  UserCircle,
} from '../icons/index.js';
import { cardAction } from './columns.js';
import { relativeTime } from './rel-time.js';

interface TodoCardProps {
  todo: TodoRecord;
  now: number;
}

/** Badge on the agent avatar: amber magnifier while the run is waiting on
 *  the user (待确认 02 #9, 待验收 33 #9, 等待回复 01 #1), green check once
 *  done (r7 01b #2, 35 #9). Fresh cards carry a gray idle badge with the
 *  same magnifier glyph (r7 22/22d — badge shape pixel-matches the amber
 *  one at gray #9ea3ae). */
function badgeFor(todo: TodoRecord): 'idle' | 'attention' | 'done' | null {
  if (todo.phase === 'done') return 'done';
  if (todo.phase === 'confirm' || todo.phase === 'review' || todo.awaitingReply === true) {
    return 'attention';
  }
  if (todo.phase === 'todo' || todo.phase === 'queued') return 'idle';
  return null;
}

export function TodoCard({ todo, now }: TodoCardProps) {
  const action = cardAction(todo);
  const badge = badgeFor(todo);
  const fresh = badge === 'idle';
  const { search } = useLocation();
  return (
    <article className="todo-card">
      <div className="todo-card-row1">
        <span className="project-avatar">{PROJECT_INITIAL}</span>
        <span className="todo-project-name">{PROJECT_NAME}</span>
        <span className="todo-card-seq">#{todo.seqNum}</span>
        <button type="button" className="todo-card-branch" aria-label="分支与 PR">
          <Download />
        </button>
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
        </span>
        <span className="todo-card-time">{relativeTime(todo.phaseAt, now)}</span>
        {todo.hasPlan && (
          <span className="todo-card-metric" role="img" aria-label="方案">
            <FileText />
          </span>
        )}
        {todo.hasChanges && (
          <span className="todo-card-metric" role="img" aria-label="变更">
            <GitCommit />
          </span>
        )}
        <span className="todo-card-spacer" />
        {action?.kind === 'primary' && (
          <button type="button" className="todo-card-action todo-card-action--primary">
            {action.label}
          </button>
        )}
        {action?.kind === 'ghost' && (
          <button type="button" className="todo-card-action todo-card-action--ghost">
            {action.label}
          </button>
        )}
      </div>
    </article>
  );
}
