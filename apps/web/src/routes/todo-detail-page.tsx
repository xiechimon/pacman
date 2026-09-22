// Todo detail route (issue #56): app shell sidebar + dhead + phase-driven
// body — fresh block (23/23d) or doc pane + chat column (16/17 family) —
// plus composer, 总管 FAB and the capture-frozen user-menu popover.
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Composer } from '../detail/composer.js';
import { DetailHead } from '../detail/dhead.js';
import { DocPane } from '../detail/docpane.js';
import { FreshBlock } from '../detail/fresh-block.js';
import { Transcript } from '../detail/transcript.js';
import { UserMenu } from '../detail/user-menu.js';
import { DeleteConfirm } from '../overlay/delete-confirm.js';
import { MoreMenu } from '../overlay/more-menu.js';
import { PHASE_UI } from '../phase.js';
import '../detail/detail.css';
import { attentionCount } from '../board/columns.js';
import { BoardSidebar } from '../board/sidebar.js';
import { markDeleted, withoutDeleted } from '../fixtures/deletions.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { ChiefFab } from '../icons/index.js';
import { readStoredTheme } from '../theme.js';

export function TodoDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // 文档|聊天 tabs (issue #56): 文档 = doc pane + chat column, 聊天 = chat
  // column alone. Pure render state — the captures all sit on 文档.
  const [tab, setTab] = useState<'doc' | 'chat'>('doc');
  // 更多 menu + delete confirm (#66): confirming a delete marks the todo
  // in the deletions overlay and returns to /app (r2 §5.4) — the board
  // route then renders without it; the fixture phase has no backend.
  const [moreOpen, setMoreOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const fixture = resolveScenario(searchParams);
  const todos = withoutDeleted(fixture.todos);
  const todo = todos.find((t) => t.id === id) ?? todos[0];
  if (todo == null) return null;
  const ui = PHASE_UI[todo.phase];
  const detail = fixture.detail;
  const streaming = detail?.transcript.some((item) => item.kind === 'streaming') ?? false;
  // The doc pane flips to the 变更 surface once a run produced changes
  // (r7 27/36); the plan surface serves todo→building (r7 16/17/26).
  const docMode = todo.phase === 'review' || todo.phase === 'done' ? 'changes' : 'plan';

  return (
    <div className="detail-shell" data-route="todo-detail" data-todo-id={id}>
      <BoardSidebar attention={attentionCount(todos)} />
      <div className="detail-main">
        <DetailHead todo={todo} tab={tab} onTab={setTab} onMore={() => setMoreOpen(true)} />
        {detail == null ? (
          <div className="detail-body detail-body--single">
            <FreshBlock todo={todo} />
          </div>
        ) : (
          <div className="detail-body">
            {tab === 'doc' && <DocPane mode={docMode} doc={detail.doc} changes={detail.changes} />}
            <div className="chat-col">
              <Transcript transcript={detail.transcript} />
            </div>
          </div>
        )}
        {ui.placeholder != null && (
          <Composer
            placeholder={ui.placeholder}
            aiReview={
              // r7 §4.1: the AI 审核 button only shows on writable
              // confirm/review surfaces; the waiting-on-user legacy card
              // (r7 38) renders the toolbar without it
              (todo.phase === 'confirm' || todo.phase === 'review') && !todo.awaitingReply
            }
            streaming={streaming}
          />
        )}
        <button type="button" className="detail-fab" aria-label="总管">
          <ChiefFab />
        </button>
      </div>
      {detail?.userMenuOpen === true && <UserMenu theme={readStoredTheme(localStorage)} />}
      {moreOpen && (
        <MoreMenu
          onClose={() => setMoreOpen(false)}
          onDelete={() => {
            setMoreOpen(false);
            setDeleteOpen(true);
          }}
        />
      )}
      {deleteOpen && (
        <DeleteConfirm
          todo={todo}
          onClose={() => setDeleteOpen(false)}
          onConfirm={() => {
            setDeleteOpen(false);
            markDeleted(todo.id);
            navigate('/app');
          }}
        />
      )}
    </div>
  );
}
