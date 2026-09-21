// Board sidebar (issue #54): 240px expanded rail, structure and copy from
// r6 §3.1 / r2 §1.1, geometry from r7 01 pixel probes (row pitch 36, level-1
// icons at x16, group chevrons at x20, sub-rows at x36, bottom 安装 App
// accent row + user chip). All rows render; interactivity lands with the
// routes they point at in later tickets.

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
  Plus,
  Puzzle,
  Search,
  Server,
  Smartphone,
  Users,
} from '../icons/index.js';
import './sidebar.css';

export function BoardSidebar() {
  return (
    <aside className="board-sidebar">
      <div className="sidebar-team-row">
        <span className="sidebar-row-icon">
          <Users />
        </span>
        <span className="sidebar-team-name">{TEAM_NAME}</span>
        <button type="button" className="sidebar-team-collapse" aria-label="收起侧边栏">
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
        </a>
        <a className="sidebar-row" href="/app/schedules">
          <span className="sidebar-row-icon">
            <Clock />
          </span>
          <span className="sidebar-row-label">定时</span>
        </a>

        <button type="button" className="sidebar-group" aria-label="收起项目">
          <span className="sidebar-group-chevron">
            <ChevronDown />
          </span>
          <span className="sidebar-group-label">项目</span>
        </button>
        <a className="sidebar-subrow sidebar-new-project" href="/app/project/new">
          <span className="sidebar-row-icon">
            <Plus />
          </span>
          <span className="sidebar-subrow-label">新建项目</span>
        </a>
        <a className="sidebar-subrow" href={`/app/project/${PROJECT_ID}`}>
          <span className="project-avatar">{PROJECT_INITIAL}</span>
          <span className="sidebar-subrow-label">{PROJECT_NAME}</span>
        </a>

        <button type="button" className="sidebar-group" aria-label="收起资源">
          <span className="sidebar-group-chevron">
            <ChevronDown />
          </span>
          <span className="sidebar-group-label">资源</span>
        </button>
        <a className="sidebar-subrow" href="/app/resources/skills">
          <span className="sidebar-row-icon">
            <Puzzle />
          </span>
          <span className="sidebar-subrow-label">技能</span>
        </a>
        <a className="sidebar-subrow" href="/app/resources/mcp-servers">
          <span className="sidebar-row-icon">
            <Network />
          </span>
          <span className="sidebar-subrow-label">MCP</span>
        </a>
        <a className="sidebar-subrow" href="/app/resources/secrets">
          <span className="sidebar-row-icon">
            <Key />
          </span>
          <span className="sidebar-subrow-label">密钥</span>
        </a>
        <a className="sidebar-subrow" href="/app/resources/machines">
          <span className="sidebar-row-icon">
            <Server />
          </span>
          <span className="sidebar-subrow-label">机器</span>
        </a>
        <a className="sidebar-subrow" href="/app/resources/providers">
          <span className="sidebar-row-icon">
            <Layers />
          </span>
          <span className="sidebar-subrow-label">模型服务</span>
        </a>
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
