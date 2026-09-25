// Shared app sidebar (issue #129): the single BoardSidebar call site every
// route family renders, so the rail keeps identical geometry and behavior
// across /app ↔ /app/team ↔ resources ↔ detail hops — the collapse state
// (storage-backed, formerly board-only), the 用量 nav row, the machine-
// online dot, the attention badge and the ⌘K search row all derive the
// same way everywhere. Routes that mount their own SearchPanel (board and
// detail: their fixture ui.searchOpen open states drive the parity rows)
// pass searchPanel={false} + their own onSearch opener; every other shell
// rides the internal panel, which renders nothing while closed.

import { useCallback, useState } from 'react';
import { useMachines, useSearchResults, useTodos } from '../api/hooks.js';
import { toDisplayTodo } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import type { FixtureSet, TodoRecord } from '../fixtures/records.js';
import { SearchPanel, useSearchState } from '../overlays/search-panel.js';
import { attentionCount } from './columns.js';
import { BoardSidebar, type SidebarSelected } from './sidebar.js';

export const SIDEBAR_STORAGE_KEY = 'pacman.sidebar-collapsed'; // mirrored in parity/run.mjs

function readCollapsed(storage: Storage): boolean {
  return storage.getItem(SIDEBAR_STORAGE_KEY) === '1';
}

export interface AppSidebarProps {
  fixture: FixtureSet;
  /** Sidebar pill owner (BoardSidebar's slot); defaults to 看板. */
  selected?: SidebarSelected;
  /** The route's merged todo list — board/detail keep local create/delete
   *  sets; absent = the live query or fixture.todos. */
  todos?: TodoRecord[];
  /** False on routes that mount their own ⌘K panel (board/detail). */
  searchPanel?: boolean;
  /** Search-row opener; defaults to the internal panel. */
  onSearch?: () => void;
}

export function AppSidebar({
  fixture,
  selected = 'board',
  todos,
  searchPanel = true,
  onSearch,
}: AppSidebarProps) {
  // 侧栏待办徽标 / 面板内容走真 todos（live，TQ 同键去重）或 fixture。
  const { live, teamId } = useLiveData();
  const todosQ = useTodos(teamId, live);
  const machinesQ = useMachines(teamId, live);
  const search = useSearchState(false, '');
  // W4 #286：live 面服务端搜索（fixture/parity 面不经此钩）。
  const searchResults = useSearchResults(search.query, live && search.open);
  // #55: the collapse toggle is real state, persisted beside the theme; the
  // exact key is [推断] (r2 §1.1 only documents `tds.sidebarProjectsCollapsed`
  // for the project-group fold), and the parity harness injects it like the
  // theme key so the rail capture stays deterministic.
  const [collapsed, setCollapsed] = useState(() => readCollapsed(localStorage));
  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0');
      return next;
    });
  }, []);
  const resolvedTodos = todos ?? (live ? (todosQ.data ?? []).map(toDisplayTodo) : fixture.todos);
  const machineOnline = live ? (machinesQ.data ?? []).some((m) => m.online) : fixture.chief != null;
  return (
    <>
      <BoardSidebar
        collapsed={collapsed}
        onToggle={toggle}
        attention={attentionCount(resolvedTodos)}
        onSearch={onSearch ?? (() => search.setOpen(true))}
        usageNav={fixture.usageNav === true}
        selected={selected}
        machineOnline={machineOnline}
      />
      {searchPanel && (
        <SearchPanel
          open={search.open}
          fixture={live ? { ...fixture, todos: resolvedTodos, now: Date.now() } : fixture}
          query={search.query}
          onQuery={search.setQuery}
          onClose={() => search.setOpen(false)}
          server={live ? searchResults.data : undefined}
        />
      )}
    </>
  );
}
