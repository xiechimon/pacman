// Secondary-route shell (issue #71): sidebar + 44px topbar with a back
// chevron, a centered title or centered text-tab group, an optional
// left title (project name, r2 24b) and an optional right action (the
// indigo + 新建 on schedules, r7 11). Geometry from the r7 11 probes
// (topbar 43 + 1px border, back 28×28 @ x252, title centered on the
// content area) and r2 24b/24c for the name + tab-group variants.
// The 总管 FAB rides the shell (r7 11 shows it on every secondary route).
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { attentionCount } from '../board/columns.js';
import { BoardSidebar, type SidebarSelected } from '../board/sidebar.js';
import type { FixtureSet } from '../fixtures/records.js';
import { ChevronLeft, ChiefFab } from '../icons/index.js';

export interface PageTab {
  id: string;
  label: string;
}

/** Text-tab pill group (任务|文件 in the topbar, 基本信息|仓库|标签 in the
 *  settings column — r2 24b/24c share one markup). */
export function TabGroup({
  tabs,
  tab,
  onTab,
}: {
  tabs: PageTab[];
  tab: string;
  onTab?: (id: string) => void;
}) {
  return (
    <div className="page-tabs-group">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`page-tab${tab === t.id ? ' page-tab--active' : ''}`}
          onClick={() => onTab?.(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

interface PageShellProps {
  fixture: FixtureSet;
  selected: SidebarSelected;
  /** Centered topbar title (定时 / 新建项目 / 设置). */
  title?: string;
  /** Left-aligned title right after the back chevron (project name). */
  leftTitle?: string;
  /** Centered topbar tab group (任务|文件). */
  tabs?: PageTab[];
  tab?: string;
  onTab?: (id: string) => void;
  /** Right-edge action slot (indigo text button on schedules). */
  action?: ReactNode;
  children: ReactNode;
}

export function PageShell({
  fixture,
  selected,
  title,
  leftTitle,
  tabs,
  tab,
  onTab,
  action,
  children,
}: PageShellProps) {
  const { search } = useLocation();
  return (
    <div className="page-shell">
      <BoardSidebar attention={attentionCount(fixture.todos)} selected={selected} />
      <div className="page-main">
        <header className="page-topbar">
          <Link className="page-back" to={{ pathname: '/app', search }} aria-label="返回">
            <ChevronLeft />
          </Link>
          {leftTitle != null && <span className="page-left-title">{leftTitle}</span>}
          {title != null && <div className="page-topbar-title">{title}</div>}
          {tabs != null && tab != null && (
            <div className="page-tabs">
              <TabGroup tabs={tabs} tab={tab} onTab={onTab} />
            </div>
          )}
          {action != null && <div className="page-topbar-actions">{action}</div>}
        </header>
        {children}
        <button type="button" className="page-fab" aria-label="总管">
          <ChiefFab />
        </button>
      </div>
    </div>
  );
}
