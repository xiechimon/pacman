// Board sidebar (issue #54): 240px expanded rail, structure and copy from
// r6 §3.1 / r2 §1.1, geometry from r7 01 pixel probes (row pitch 36, level-1
// icons at x16, group chevrons at x20, sub-rows at x36, bottom 安装 App
// accent row + user chip). #55 adds the collapsed rail: 40px wide, icon-only
// rows (r2 §1.1 收起态 order: 展开侧栏/搜索/看板/定时/项目▾/项目头像/资源▾/
// 技能/MCP/密钥/机器/模型服务), 32px row pitch with a 24px selected pill,
// 安装 App icon and the user avatar chip at the bottom — geometry from the
// r7 03 pixel probes. All rows render; interactivity is the collapse toggle
// only, persisted like the theme (storage key is [推断] — r2 §1.1 only
// documents `tds.sidebarProjectsCollapsed` for the group fold).

import type { ComponentType, SVGProps } from 'react';
import {
  PROJECT_ID,
  PROJECT_INITIAL,
  PROJECT_NAME,
  TEAM_NAME,
  USER_NAME,
} from '../fixtures/fixtures.js';
import {
  ChevronDown,
  Clock,
  EllipsisVertical,
  Kanban,
  Key,
  Layers,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Puzzle,
  Search,
  Server,
  Smartphone,
  Users,
} from '../icons/index.js';
import './sidebar.css';

interface BoardSidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  /** Todos waiting on confirmation — the 看板 nav badge (r7 02/17). */
  attention?: number;
}

/** Leaf nav rows shared by both sidebar states — each renders full in the
 *  expanded sidebar (icon + label + route) and icon-only in the rail. */
const RESOURCE_ROWS: {
  label: string;
  href: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}[] = [
  { label: '技能', href: '/app/resources/skills', Icon: Puzzle },
  { label: 'MCP', href: '/app/resources/mcp-servers', Icon: Network },
  { label: '密钥', href: '/app/resources/secrets', Icon: Key },
  { label: '机器', href: '/app/resources/machines', Icon: Server },
  { label: '模型服务', href: '/app/resources/providers', Icon: Layers },
];

const PROJECT_HREF = `/app/project/${PROJECT_ID}`;

function GroupHeader({ label }: { label: string }) {
  return (
    <button type="button" className="sidebar-group" aria-label={`收起${label}`}>
      <span className="sidebar-group-chevron">
        <ChevronDown />
      </span>
      <span className="sidebar-group-label">{label}</span>
    </button>
  );
}

function RailGroupChevron({ label }: { label: string }) {
  return (
    <button type="button" className="rail-row" aria-label={`收起${label}`}>
      <ChevronDown />
    </button>
  );
}

export function BoardSidebar({ collapsed = false, onToggle, attention = 0 }: BoardSidebarProps) {
  if (collapsed) {
    return (
      <aside className="board-sidebar board-sidebar--collapsed">
        <button type="button" className="rail-toggle" aria-label="展开侧边栏" onClick={onToggle}>
          <PanelLeftOpen />
        </button>
        <nav className="rail-nav">
          <a className="rail-row" href="/app" aria-label="搜索">
            <Search />
          </a>
          <a
            className="rail-row rail-row--selected"
            href="/app"
            aria-current="page"
            aria-label="看板"
          >
            <Kanban />
          </a>
          <a className="rail-row" href="/app/schedules" aria-label="定时">
            <Clock />
          </a>
          <RailGroupChevron label="项目" />
          <a className="rail-row" href={PROJECT_HREF} aria-label={PROJECT_NAME}>
            <span className="project-avatar">{PROJECT_INITIAL}</span>
          </a>
          <RailGroupChevron label="资源" />
          {RESOURCE_ROWS.map(({ label, href, Icon }) => (
            <a key={href} className="rail-row" href={href} aria-label={label}>
              <Icon />
            </a>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <a className="rail-install" href="/zh/install" aria-label="安装 App">
          <Smartphone />
        </a>
        <button type="button" className="rail-user" aria-label={USER_NAME}>
          <img src="/avatar-user.png" alt="" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="board-sidebar">
      <div className="sidebar-team-row">
        <span className="sidebar-row-icon">
          <Users />
        </span>
        <span className="sidebar-team-name">{TEAM_NAME}</span>
        <button
          type="button"
          className="sidebar-team-collapse"
          aria-label="收起侧边栏"
          onClick={onToggle}
        >
          <PanelLeftClose />
        </button>
      </div>

      <nav className="sidebar-nav">
        <a className="sidebar-row" href="/app">
          <span className="sidebar-row-icon">
            <Search />
          </span>
          <span className="sidebar-row-label">搜索</span>
          <span className="sidebar-kbd">⌘K</span>
        </a>
        <a className="sidebar-row sidebar-row--selected" href="/app" aria-current="page">
          <span className="sidebar-row-icon">
            <Kanban />
          </span>
          <span className="sidebar-row-label">看板</span>
          {attention > 0 && <span className="sidebar-badge">{attention}</span>}
        </a>
        <a className="sidebar-row" href="/app/schedules">
          <span className="sidebar-row-icon">
            <Clock />
          </span>
          <span className="sidebar-row-label">定时</span>
        </a>

        <GroupHeader label="项目" />
        <a className="sidebar-subrow sidebar-new-project" href="/app/project/new">
          <span className="sidebar-row-icon">
            <Plus />
          </span>
          <span className="sidebar-subrow-label">新建项目</span>
        </a>
        <a className="sidebar-subrow" href={PROJECT_HREF}>
          <span className="project-avatar">{PROJECT_INITIAL}</span>
          <span className="sidebar-subrow-label">{PROJECT_NAME}</span>
        </a>

        <GroupHeader label="资源" />
        {RESOURCE_ROWS.map(({ label, href, Icon }) => (
          <a key={href} className="sidebar-subrow" href={href}>
            <span className="sidebar-row-icon">
              <Icon />
            </span>
            <span className="sidebar-subrow-label">{label}</span>
          </a>
        ))}
      </nav>

      <div className="sidebar-spacer" />

      <a className="sidebar-install" href="/zh/install">
        <Smartphone />
        <span className="sidebar-install-label">安装 App</span>
      </a>
      <button type="button" className="sidebar-user" aria-label={USER_NAME}>
        <img src="/avatar-user.png" alt="" />
        <span className="sidebar-user-name">{USER_NAME}</span>
        <span className="sidebar-user-more">
          <EllipsisVertical />
        </span>
      </button>
    </aside>
  );
}
