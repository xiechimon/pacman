// Board route (issue #54): app shell = sidebar + board surface, content
// picked by the scenario fixture (issue #52 mechanism). #55: the sidebar
// collapse toggle is real state, persisted beside the theme; the exact key
// is [推断] (r2 §1.1 only documents `tds.sidebarProjectsCollapsed` for the
// project-group fold), and the parity harness injects it like the theme
// key so the rail capture stays deterministic.
// #72: the chief surfaces ride this route — the drawer overlays the board
// (r5 100/111/114/116) and the 总管设置 gear swaps the content area to the
// settings view (r5 101–104). Both open states are fixture-driven for
// parity; the FAB/gear/back/close buttons make them reachable in dev.
import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router';
import { BoardSurface } from '../board/board.js';
import { attentionCount } from '../board/columns.js';
import { BoardSidebar } from '../board/sidebar.js';
import { ChiefDrawer } from '../chief/chief-drawer.js';
import { ChiefSettings } from '../chief/chief-settings.js';
import { AcceptDialog } from '../detail/accept-dialog.js';
import { BranchDialog } from '../detail/branch-dialog.js';
import { withoutDeleted } from '../fixtures/deletions.js';
import { chiefDefault, localTodo, overlayContent } from '../fixtures/fixtures.js';
import type { FixtureSet, OverlayState, TodoRecord } from '../fixtures/records.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { ChiefFab } from '../icons/index.js';
import { NewTaskDialog } from '../overlay/new-task-dialog.js';
import { SearchPanel, useSearchState } from '../overlays/search-panel.js';
// shell styles live with the board surface; the settings view (101–104)
// unmounts BoardSurface but keeps the shell, so the route imports them too
import '../board/board.css';

export const SIDEBAR_STORAGE_KEY = 'tds.sidebar-collapsed'; // mirrored in parity/run.mjs

function readCollapsed(storage: Storage): boolean {
  return storage.getItem(SIDEBAR_STORAGE_KEY) === '1';
}

export function BoardPage() {
  const [searchParams] = useSearchParams();
  const [collapsed, setCollapsed] = useState(() => readCollapsed(localStorage));
  const fixture = resolveScenario(searchParams);
  // New-task dialog (#66): fixture phase has no backend, so a saved task
  // lives in this client-side set — the card lands in 待开始 with the
  // 刚刚 label and the column count couples (r2 §4.2/§5.2). Deletions
  // made on the detail route ride along via the deletions overlay.
  const [todos, setTodos] = useState<TodoRecord[]>(() => withoutDeleted(fixture.todos));
  const [newTaskOpen, setNewTaskOpen] = useState(false);
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
  const search = useSearchState(fixture.ui?.searchOpen === true, fixture.ui?.searchQuery ?? '');
  const toggle = useCallback(() => {
    const next = !collapsed;
    localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0');
    setCollapsed(next);
  }, [collapsed]);
  const createTodo = useCallback(
    (title: string) => {
      setTodos((prev) => [
        ...prev,
        // fixture.now is the session's reference instant, so the fresh
        // card reads 刚刚 against the same clock as the frozen labels
        localTodo(prev.reduce((max, t) => Math.max(max, t.seqNum), 0) + 1, title, fixture.now),
      ]);
      setNewTaskOpen(false);
    },
    [fixture],
  );
  const content = overlayTodo != null ? overlayContent(overlayTodo.id) : null;
  const chief = fixture.chief;
  // one three-state view: drawer and settings are mutually exclusive by
  // construction (r5: the gear swaps the drawer for the full-content view)
  const [chiefView, setChiefView] = useState<'none' | 'drawer' | 'settings'>(chief?.view ?? 'none');
  const chiefData = chief ?? chiefDefault;
  const fixtureWithTodos: FixtureSet = { ...fixture, todos };
  return (
    <div className="board-shell h-full" data-route="board">
      <BoardSidebar
        collapsed={collapsed}
        onToggle={toggle}
        attention={attentionCount(todos)}
        onSearch={() => search.setOpen(true)}
        usageNav={fixture.usageNav === true}
        selected={chiefView === 'settings' ? 'none' : 'board'}
        machineOnline={chief != null}
      />
      {chiefView === 'settings' ? (
        <ChiefSettings chief={chiefData} onBack={() => setChiefView('drawer')} />
      ) : (
        <BoardSurface
          fixture={fixtureWithTodos}
          onNewTask={() => setNewTaskOpen(true)}
          onAction={(todo) => {
            // r7 34: review-phase 完成 opens the accept dialog; 回复/确认
            // stay inert until their own tickets
            if (todo.phase === 'review' && todo.awaitingReply !== true) openFor(todo, 'accept');
          }}
          onBranch={(todo) => openFor(todo, 'branch')}
          // #73: drag drops commit into the same client-side todo set as
          // create/delete — column counts and folds re-derive from it
          onReorder={(next) => setTodos(next)}
        />
      )}
      <SearchPanel
        open={search.open}
        fixture={fixture}
        query={search.query}
        onQuery={search.setQuery}
        onClose={() => search.setOpen(false)}
      />
      <ChiefDrawer
        open={chiefView === 'drawer'}
        chief={chiefData}
        onSettings={() => setChiefView('settings')}
        onClose={() => setChiefView('none')}
      />
      <NewTaskDialog open={newTaskOpen} onClose={() => setNewTaskOpen(false)} onSave={createTodo} />
      <button
        type="button"
        className="chief-fab"
        aria-label="总管"
        onClick={() => setChiefView('drawer')}
      >
        <ChiefFab />
        {fixture.chiefUnread != null && fixture.chiefUnread > 0 && (
          <span className="fab-badge">{fixture.chiefUnread}</span>
        )}
      </button>
      <AcceptDialog open={overlay?.kind === 'accept'} onClose={closeOverlay} />
      {content != null && (
        <BranchDialog
          open={overlay?.kind === 'branch'}
          info={content.branch}
          onClose={closeOverlay}
        />
      )}
    </div>
  );
}
