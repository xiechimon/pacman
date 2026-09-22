// Board route (issue #54): app shell = sidebar + board surface, content
// picked by the scenario fixture (issue #52 mechanism). #55: the sidebar
// collapse toggle is real state, persisted beside the theme; the exact key
// is [推断] (r2 §1.1 only documents `tds.sidebarProjectsCollapsed` for the
// project-group fold), and the parity harness injects it like the theme
// key so the rail capture stays deterministic.
import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router';
import { BoardSurface } from '../board/board.js';
import { attentionCount } from '../board/columns.js';
import { BoardSidebar } from '../board/sidebar.js';
import { AcceptDialog } from '../detail/accept-dialog.js';
import { BranchDialog } from '../detail/branch-dialog.js';
import { overlayContent } from '../fixtures/fixtures.js';
import type { OverlayState, TodoRecord } from '../fixtures/records.js';
import { resolveScenario } from '../fixtures/scenario.js';

export const SIDEBAR_STORAGE_KEY = 'tds.sidebar-collapsed'; // mirrored in parity/run.mjs

function readCollapsed(storage: Storage): boolean {
  return storage.getItem(SIDEBAR_STORAGE_KEY) === '1';
}

export function BoardPage() {
  const [searchParams] = useSearchParams();
  const [collapsed, setCollapsed] = useState(() => readCollapsed(localStorage));
  const fixture = resolveScenario(searchParams);
  // Modal overlays over the board (issue #68): the accept dialog opens from
  // the review card's 完成 button (r7 34) or the scenario fixture; the
  // branch dialog from the card's branch icon.
  const [overlay, setOverlay] = useState<OverlayState | null>(fixture.overlay ?? null);
  const [overlayTodo, setOverlayTodo] = useState<TodoRecord | null>(null);
  const closeOverlay = useCallback(() => setOverlay(null), []);
  const openFor = (todo: TodoRecord, kind: OverlayState['kind']) => {
    setOverlayTodo(todo);
    setOverlay({ kind });
  };
  const toggle = useCallback(() => {
    const next = !collapsed;
    localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0');
    setCollapsed(next);
  }, [collapsed]);
  const content = overlayTodo != null ? overlayContent(overlayTodo.id) : null;
  return (
    <div className="board-shell h-full" data-route="board">
      <BoardSidebar
        collapsed={collapsed}
        onToggle={toggle}
        attention={attentionCount(fixture.todos)}
      />
      <BoardSurface
        fixture={fixture}
        onAction={(todo) => {
          // r7 34: review-phase 完成 opens the accept dialog; 回复/确认
          // stay inert until their own tickets
          if (todo.phase === 'review' && todo.awaitingReply !== true) openFor(todo, 'accept');
        }}
        onBranch={(todo) => openFor(todo, 'branch')}
      />
      {overlay?.kind === 'accept' && <AcceptDialog onClose={closeOverlay} />}
      {overlay?.kind === 'branch' && content != null && (
        <BranchDialog info={content.branch} onClose={closeOverlay} />
      )}
    </div>
  );
}
