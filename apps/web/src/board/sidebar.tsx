// Board sidebar (issue #54): 240px expanded rail, structure and copy from
// r6 §3.1 / r2 §1.1, geometry from r7 01 pixel probes (row pitch 36, level-1
// icons at x16, group chevrons at x20, sub-rows at x36, user chip at the
// bottom). #55 adds the collapsed rail: 40px wide, icon-only rows (r2 §1.1
// 收起态 order: 展开侧栏/搜索/看板/定时/项目▾/项目头像/资源▾/技能/MCP/密钥/
// 机器/模型服务), 32px row pitch with a 24px selected pill and the user
// avatar chip at the bottom — geometry from the r7 03 pixel probes. All rows
// render; the collapse toggle persists like the theme (storage key is
// [推断] — r2 §1.1 only documents `tds.sidebarProjectsCollapsed` for the
// group fold). #121: the nav rows
// (rail + expanded, team name and 新建项目 included) are react-router
// Links — SPA hops with no document reload — carrying the live ?search=
// along (fixture-scenario convention, same as the todo-card and page-back
// links); the selected pill and aria-current stay prop-driven off
// `selected`, and the row hover pill lives in sidebar.css. #127: the
// avatar chips (rail + expanded) toggle the user-menu popover — the
// anchored-overlay family wiring (OverlayMount + ClickCatcher + Esc, same
// as the detail chip popover in dhead.tsx) over the capture-frozen
// 224-wide @ (8,410) geometry (r7 17/16d, §3.5; 244 high since #149
// dropped the 反馈 row).

import { type ComponentType, type SVGProps, useCallback, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { UserMenu } from '../detail/user-menu.js';
import { isDeleted } from '../fixtures/deletions.js';
import {
  PROJECT_ID,
  PROJECT_INITIAL,
  PROJECT_NAME,
  TEAM_NAME,
  USER_NAME,
} from '../fixtures/fixtures.js';
import { useI18n } from '../i18n/provider.js';
import type { TFunc } from '../i18n/translate.js';
import {
  BarChart3,
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
  Users,
} from '../icons/index.js';
import { ClickCatcher, OverlayMount, useEscapeClose } from '../overlays/dismiss.js';
import { readStoredTheme } from '../theme.js';
import './sidebar.css';

/** Which sidebar row carries the active pill: a nav row (看板 / 定时 /
 *  the project row — r7 01/11, r2 07e/24b/24c), the team head row on
 *  team/account (r7 12/13), a 资源 subrow by href (issue #69, r7 06–10),
 *  or none (/app/project/new r2 07, and the user-menu-only routes
 *  r2 19/32). */
export type SidebarSelected =
  | 'board'
  | 'schedules'
  | 'project'
  | 'team'
  | 'none'
  | '/app/resources/skills'
  | '/app/resources/mcp-servers'
  | '/app/resources/secrets'
  | '/app/resources/machines'
  | '/app/resources/providers';

interface BoardSidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  /** Todos waiting on confirmation — the 看板 nav badge (r7 02/17). */
  attention?: number;
  /** Opens the ⌘K search panel (issue #67); the 搜索 rows are triggers. */
  onSearch?: () => void;
  /** Render the 用量 nav row (present from the 05b capture day on). */
  usageNav?: boolean;
  /** Route carrying the selected pill: #71 named slots, #69 resource
   *  hrefs (r7 06–10), 'none' = no pill. */
  selected?: SidebarSelected;
  /** Indigo dot right of the 机器 row (r5 100/101/114/116: machine online). */
  machineOnline?: boolean;
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

/** 用量 nav row — the live site grew it between the r7 captures and the
 *  #67 05b capture, so it renders only for scenarios that set usageNav. */
const USAGE_ROW = { label: '用量', href: '/app/usage', Icon: BarChart3 };

const PROJECT_HREF = `/app/project/${PROJECT_ID}`;

/** Selected-pill class pair for a nav row (expanded + rail variants). */
const rowClass = (base: string, selected: boolean) =>
  selected ? `${base} ${base}--selected` : base;

/** Group-collapse storage keys (#147): the 项目 key is the brand-slot twin
 *  of the observed original `tds.sidebarProjectsCollapsed` (r2 §1.1/§1.5,
 *  measured value "1", registered in the shared client-state table); the
 *  资源 twin is [推断] in the same shape. Values follow the sidebar
 *  collapse key: "1" collapsed, "0"/absent open. */
export const GROUP_STORAGE_KEYS = {
  project: 'pacman.sidebarProjectsCollapsed',
  resource: 'pacman.sidebarResourcesCollapsed',
} as const;

type GroupId = keyof typeof GROUP_STORAGE_KEYS;

function readGroupCollapsed(storage: Storage): Record<GroupId, boolean> {
  return {
    project: storage.getItem(GROUP_STORAGE_KEYS.project) === '1',
    resource: storage.getItem(GROUP_STORAGE_KEYS.resource) === '1',
  };
}

/** Group-header aria (r6): the label tracks the collapse in both
 *  directions — 收起… open, 展开… collapsed — shared by the expanded and
 *  rail headers. */
const groupAria = (t: TFunc, label: string, collapsed: boolean) =>
  t(collapsed ? '展开{label}' : '收起{label}', { label: t(label) });

function GroupHeader({
  label,
  collapsed,
  onToggle,
}: {
  label: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className={collapsed ? 'sidebar-group sidebar-group--collapsed' : 'sidebar-group'}
      aria-label={groupAria(t, label, collapsed)}
      aria-expanded={!collapsed}
      onClick={onToggle}
    >
      <span className="sidebar-group-chevron">
        <ChevronDown />
      </span>
      <span className="sidebar-group-label">{t(label)}</span>
    </button>
  );
}

/** Rail twin of GroupHeader (#147): same collapse state, same aria. Hiding
 *  the rail member rows while collapsed is [推断] — the captured original
 *  rail (r7 03) only ever shows the open-group state, and the rail chevron
 *  is the same dead 收起{label} button family the ticket revives. */
function RailGroupChevron({
  label,
  collapsed,
  onToggle,
}: {
  label: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className={collapsed ? 'rail-row rail-group rail-group--collapsed' : 'rail-row rail-group'}
      aria-label={groupAria(t, label, collapsed)}
      aria-expanded={!collapsed}
      onClick={onToggle}
    >
      <ChevronDown />
    </button>
  );
}

export function BoardSidebar({
  collapsed = false,
  onToggle,
  attention = 0,
  onSearch,
  usageNav = false,
  selected = 'board',
  machineOnline = false,
}: BoardSidebarProps) {
  const { t } = useI18n();
  // Links carry the live query string across hops so the fixture scenario
  // survives client-side navigation (todo-card / page-back convention).
  const { search } = useLocation();
  const resourceRows = usageNav
    ? [...RESOURCE_ROWS.slice(0, 4), USAGE_ROW, ...RESOURCE_ROWS.slice(4)]
    : RESOURCE_ROWS;
  // #127: the avatar chips toggle the user-menu popover — click catcher +
  // Esc close it like the rest of the anchored-overlay family; the stored
  // theme at open time seeds the 外观 segment (#122).
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  // #147: the 项目 / 资源 group collapses are real state persisted beside
  // the sidebar collapse key; both sidebar shapes (rail + expanded) read
  // the same pair so a collapse survives the rail toggle and the reload.
  const [groupCollapsed, setGroupCollapsed] = useState(() => readGroupCollapsed(localStorage));
  const toggleGroup = useCallback((id: GroupId) => {
    setGroupCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(GROUP_STORAGE_KEYS[id], next[id] ? '1' : '0');
      return next;
    });
  }, []);
  const toggleProjectGroup = useCallback(() => toggleGroup('project'), [toggleGroup]);
  const toggleResourceGroup = useCallback(() => toggleGroup('resource'), [toggleGroup]);
  const closeUserMenu = useCallback(() => setUserMenuOpen(false), []);
  const toggleUserMenu = useCallback(() => setUserMenuOpen((open) => !open), []);
  useEscapeClose(userMenuOpen, closeUserMenu);
  const userMenuPopover = (
    <OverlayMount open={userMenuOpen}>
      <ClickCatcher onClose={closeUserMenu} />
      <UserMenu floating theme={readStoredTheme(localStorage)} />
    </OverlayMount>
  );
  if (collapsed) {
    return (
      <aside className="board-sidebar board-sidebar--collapsed">
        <button
          type="button"
          className="rail-toggle"
          aria-label={t('展开侧边栏')}
          onClick={onToggle}
        >
          <PanelLeftOpen />
        </button>
        <nav className="rail-nav">
          <button type="button" className="rail-row" aria-label={t('搜索')} onClick={onSearch}>
            <Search />
          </button>
          <Link
            className={rowClass('rail-row', selected === 'board')}
            to={{ pathname: '/app', search }}
            aria-current={selected === 'board' ? 'page' : undefined}
            aria-label={t('看板')}
          >
            <Kanban />
          </Link>
          <Link
            className={rowClass('rail-row', selected === 'schedules')}
            to={{ pathname: '/app/schedules', search }}
            aria-current={selected === 'schedules' ? 'page' : undefined}
            aria-label={t('定时')}
          >
            <Clock />
          </Link>
          <RailGroupChevron
            label="项目"
            collapsed={groupCollapsed.project}
            onToggle={toggleProjectGroup}
          />
          {!groupCollapsed.project && !isDeleted(PROJECT_ID) && (
            <Link
              className={rowClass('rail-row', selected === 'project')}
              to={{ pathname: PROJECT_HREF, search }}
              aria-current={selected === 'project' ? 'page' : undefined}
              aria-label={PROJECT_NAME}
            >
              <span className="project-avatar">{PROJECT_INITIAL}</span>
            </Link>
          )}
          <RailGroupChevron
            label="资源"
            collapsed={groupCollapsed.resource}
            onToggle={toggleResourceGroup}
          />
          {!groupCollapsed.resource &&
            resourceRows.map(({ label, href, Icon }) => (
              <Link
                key={href}
                className={rowClass('rail-row', selected === href)}
                to={{ pathname: href, search }}
                aria-current={selected === href ? 'page' : undefined}
                aria-label={t(label)}
              >
                <Icon />
              </Link>
            ))}
        </nav>
        <div className="sidebar-spacer" />
        <button
          type="button"
          className="rail-user"
          aria-label={USER_NAME}
          aria-expanded={userMenuOpen}
          onClick={toggleUserMenu}
        >
          <img src="/avatar-user.png" alt="" />
        </button>
        {userMenuPopover}
      </aside>
    );
  }

  return (
    <aside className="board-sidebar">
      <div className={`sidebar-team-row${selected === 'team' ? ' sidebar-team-row--active' : ''}`}>
        <span className="sidebar-row-icon">
          <Users />
        </span>
        {/* r2 §1.1: clicking the team name navigates to /app/team */}
        <Link className="sidebar-team-name" to={{ pathname: '/app/team', search }}>
          {TEAM_NAME}
        </Link>
        <button
          type="button"
          className="sidebar-team-collapse"
          aria-label={t('收起侧边栏')}
          onClick={onToggle}
        >
          <PanelLeftClose />
        </button>
      </div>

      <nav className="sidebar-nav">
        <button type="button" className="sidebar-row" onClick={onSearch}>
          <span className="sidebar-row-icon">
            <Search />
          </span>
          <span className="sidebar-row-label">{t('搜索')}</span>
          <span className="sidebar-kbd">⌘K</span>
        </button>
        <Link
          className={rowClass('sidebar-row', selected === 'board')}
          to={{ pathname: '/app', search }}
          aria-current={selected === 'board' ? 'page' : undefined}
        >
          <span className="sidebar-row-icon">
            <Kanban />
          </span>
          <span className="sidebar-row-label">{t('看板')}</span>
          {attention > 0 && <span className="sidebar-badge">{attention}</span>}
        </Link>
        <Link
          className={selected === 'schedules' ? 'sidebar-row sidebar-row--selected' : 'sidebar-row'}
          to={{ pathname: '/app/schedules', search }}
          aria-current={selected === 'schedules' ? 'page' : undefined}
        >
          <span className="sidebar-row-icon">
            <Clock />
          </span>
          <span className="sidebar-row-label">{t('定时')}</span>
        </Link>

        <GroupHeader
          label="项目"
          collapsed={groupCollapsed.project}
          onToggle={toggleProjectGroup}
        />
        {/* r2 §1.1: the fold hides the group's sub-rows, header stays */}
        {!groupCollapsed.project && (
          <>
            <Link
              className="sidebar-subrow sidebar-new-project"
              to={{ pathname: '/app/project/new', search }}
            >
              <span className="sidebar-row-icon">
                <Plus />
              </span>
              <span className="sidebar-subrow-label">{t('新建项目')}</span>
            </Link>
            {/* #207: 项目行随 fixture 删除覆面隐去(#66 deletions 同律)——
                设置页删除确认后跳 /app,项目组即本面项目列表。 */}
            {!isDeleted(PROJECT_ID) && (
              <Link
                className={rowClass('sidebar-subrow', selected === 'project')}
                to={{ pathname: PROJECT_HREF, search }}
                aria-current={selected === 'project' ? 'page' : undefined}
              >
                <span className="project-avatar">{PROJECT_INITIAL}</span>
                <span className="sidebar-subrow-label">{PROJECT_NAME}</span>
              </Link>
            )}
          </>
        )}

        <GroupHeader
          label="资源"
          collapsed={groupCollapsed.resource}
          onToggle={toggleResourceGroup}
        />
        {!groupCollapsed.resource &&
          resourceRows.map(({ label, href, Icon }) => (
            <Link
              key={href}
              className={rowClass('sidebar-subrow', selected === href)}
              to={{ pathname: href, search }}
              aria-current={selected === href ? 'page' : undefined}
            >
              <span className="sidebar-row-icon">
                <Icon />
              </span>
              <span className="sidebar-subrow-label">{t(label)}</span>
              {machineOnline && label === '机器' && <span className="sidebar-online-dot" />}
            </Link>
          ))}
      </nav>

      <div className="sidebar-spacer" />

      <button
        type="button"
        className="sidebar-user"
        aria-label={USER_NAME}
        aria-expanded={userMenuOpen}
        onClick={toggleUserMenu}
      >
        <img src="/avatar-user.png" alt="" />
        <span className="sidebar-user-name">{USER_NAME}</span>
        <span className="sidebar-user-more">
          <EllipsisVertical />
        </span>
      </button>
      {userMenuPopover}
    </aside>
  );
}
