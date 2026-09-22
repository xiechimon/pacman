// Board route (issue #54): app shell = sidebar + board surface, content
// picked by the scenario fixture (issue #52 mechanism). #55: the sidebar
// collapse toggle is real state, persisted beside the theme; the exact key
// is [推断] (r2 §1.1 only documents `tds.sidebarProjectsCollapsed` for the
// project-group fold), and the parity harness injects it like the theme
// key so the rail capture stays deterministic.
import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router';
import { BoardSurface } from '../board/board.js';
import { BoardSidebar } from '../board/sidebar.js';
import { resolveScenario } from '../fixtures/scenario.js';

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
  return (
    <div className="board-shell h-full" data-route="board">
      <BoardSidebar collapsed={collapsed} onToggle={toggle} />
      <BoardSurface fixture={fixture} />
    </div>
  );
}
