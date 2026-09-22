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
import { chiefDefault } from '../fixtures/fixtures.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { ChiefFab } from '../icons/index.js';
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
  const toggle = useCallback(() => {
    const next = !collapsed;
    localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0');
    setCollapsed(next);
  }, [collapsed]);
  const chief = fixture.chief;
  // one three-state view: drawer and settings are mutually exclusive by
  // construction (r5: the gear swaps the drawer for the full-content view)
  const [chiefView, setChiefView] = useState<'none' | 'drawer' | 'settings'>(chief?.view ?? 'none');
  const chiefData = chief ?? chiefDefault;
  return (
    <div className="board-shell h-full" data-route="board">
      <BoardSidebar
        collapsed={collapsed}
        onToggle={toggle}
        attention={attentionCount(fixture.todos)}
        selected={chiefView === 'settings' ? 'none' : 'board'}
        machineOnline={chief != null}
      />
      {chiefView === 'settings' ? (
        <ChiefSettings chief={chiefData} onBack={() => setChiefView('drawer')} />
      ) : (
        <BoardSurface fixture={fixture} />
      )}
      {chiefView === 'drawer' && (
        <ChiefDrawer
          chief={chiefData}
          onSettings={() => setChiefView('settings')}
          onClose={() => setChiefView('none')}
        />
      )}
      <button
        type="button"
        className="chief-fab"
        aria-label="总管"
        onClick={() => setChiefView('drawer')}
      >
        <ChiefFab />
      </button>
    </div>
  );
}
