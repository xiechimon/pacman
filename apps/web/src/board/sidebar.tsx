// Board sidebar (issue #54): 240px expanded rail, structure and copy from
// r6 §3.1 / r2 §1.1, geometry from r7 01 pixel probes (row pitch 36, level-1
// icons at x16, group chevrons at x20, sub-rows at x36, user chip at the
// bottom). #55 adds the collapsed rail: 40px wide, icon-only rows, 32px row
// pitch with a 24px selected pill and the user avatar chip at the bottom.
// All rows render; the collapse toggle persists like the theme.
// #121: the nav rows (rail + expanded, team name and 新建项目 included) are
// react-router Links — SPA hops carrying the live ?search= along.
// #127: the avatar chips toggle the user-menu popover (FloatingShell +
// ClickCatcher; Esc rides the Base UI layer stack since #656). #389: 新任务 row joins 搜索, sharing the global C
// hotkey opener.
// #414 (shadcn 试点): 视觉层切 B（neutral）token + tailwind 工具类，
// sidebar.css 随之整件退役——行 pill 的 ::before 层译成 before: 工具类，
// 行高/内距/轨道宽全部按 r7 实测原值保留。类别名（sidebar-row/rail-row/
// sidebar-kbd…）原位保留作 e2e 锚点；brand mark 的 mask 是唯一工具类
// 表达不了的规则，落 inline style。选中态/hover 的语义色不变，墨色走
// muted-foreground 族。

import { BRAND } from '@pacman/shared';
import { type ComponentType, type SVGProps, useCallback, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useLiveData } from '../api/provider.js';
import { FloatingShell } from '../components/ui/floating-shell.js';
import { KbdHint } from '../components/ui/kbd-hint.js';
import { SeededAvatar } from '../components/ui/seeded-avatar.js';
import { UserMenu } from '../detail/user-menu.js';
import { isDeleted } from '../fixtures/deletions.js';
import { PROJECT_ID, PROJECT_NAME } from '../fixtures/fixtures.js';
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
} from '../icons/index.js';
import { ClickCatcher } from '../overlays/dismiss.js';
import { readStoredTheme } from '../theme.js';

/** Which sidebar row carries the active pill: a nav row (工作台 / 定时 /
 *  the team head row on team/account — r7 01/11, r2 07e/24b/24c, r7 12/13),
 *  a 资源 subrow by href (issue #69, r7 06–10), or none (/app/project/new
 *  r2 07, and the user-menu-only routes r2 19/32). Project rows are not a
 *  named slot — the pill matches the live row by pathname (侧栏 live 收编). */
export type SidebarSelected =
  | 'board'
  | 'schedules'
  | 'team'
  | 'none'
  | '/app/resources/skills'
  | '/app/resources/mcp-servers'
  | '/app/resources/secrets'
  | '/app/resources/machines'
  | '/app/resources/providers';

/** Sidebar project row (live 收编)：id + name 投影自 live projectsQ 或
 *  fixture projectNames；undefined = 数据未决/场景缺省 → 回退 canon 单行。
 *  行 href = /app/project/<id>，头像首字母 = 名称首字符小写（todo-card 同律）。 */
export interface SidebarProject {
  id: string;
  name: string;
}

/** canon 回退行：fixture 场景缺省（capture 面只有这一个项目）与 live 查询
 *  在途共用，行形与旧钉死面字节一致。 */
const CANON_PROJECT: SidebarProject = { id: PROJECT_ID, name: PROJECT_NAME };

interface BoardSidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  /** Todos waiting on the user — the 工作台 nav badge (#351: 待处理列计数). */
  attention?: number;
  /** Opens the ⌘K search panel (issue #67); the 搜索 rows are triggers. */
  onSearch?: () => void;
  /** Opens the new-task dialog (issue #389); the 新任务 row + C hotkey share
   *  this opener (AppSidebar resolves own-dialog routes vs the global one). */
  onNewTask: () => void;
  /** Render the 用量 nav row (present from the 05b capture day on). */
  usageNav?: boolean;
  /** Route carrying the selected pill: #71 named slots, #69 resource
   *  hrefs (r7 06–10), 'none' = no pill. */
  selected?: SidebarSelected;
  /** Indigo dot right of the 机器 row (r5 100/101/114/116: machine online). */
  machineOnline?: boolean;
  /** 项目组行数据位：live = projectsQ 投影（在途/空 = []，不闪 canon 幻影）；
   *  fixture = scenario projectNames 投影；缺省 = canon 单行回退。 */
  projects?: SidebarProject[];
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

/** 行形公共件（#414）：展开态 36px 行的 pill 层 + hover/selected 梯子。
 *  ::before 层 → before: 工具类直译；行内容（>span）抬到 pill 之上。
 *  抬层排除 absolute 定位件（kbd 角标/online 点）——子代选择器的相对化
 *  会压过它们自身的 absolute（特异性 0-1-1 > 0-1-0，旧 css 同款战争的
 *  工具类版），不排掉会把角标拉回文档流。
 *  B 面 hover/selected = --sidebar-hover/--sidebar-active（neutral alpha 梯）。
 *  focus 环走 B 的 ring（全局 indigo outline 在 app.css，本族显式覆盖）。 */
const ROW_BASE =
  'relative flex w-full flex-none items-center text-left text-[13px] leading-4 text-muted-foreground no-underline outline-none before:absolute before:inset-x-2 before:inset-y-[2px] before:rounded-[6px] before:content-[""] focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:outline-offset-2 [&>span:not(.sidebar-kbd):not(.sidebar-online-dot)]:relative';
/** hover 与 selected 互斥挂在行上（旧 css 的 :not(--selected):hover 闸）：
   选中行悬停保持深 pill，不被 hover 梯洗浅。 */
const ROW_HOVER = 'hover:before:bg-sidebar-hover';
const ROW_SELECTED = 'text-foreground before:bg-sidebar-active';

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
      className={`sidebar-group group ${ROW_BASE} ${ROW_HOVER} h-9 cursor-pointer border-none bg-transparent pl-[19px] ${
        collapsed ? 'sidebar-group--collapsed' : ''
      }`}
      aria-label={groupAria(t, label, collapsed)}
      aria-expanded={!collapsed}
      onClick={onToggle}
    >
      <span className="sidebar-group-chevron flex-none text-muted-foreground transition-transform duration-150 group-[.sidebar-group--collapsed]:[transform:rotate(-90deg)]">
        <ChevronDown />
      </span>
      <span className="sidebar-group-label ml-[11px] text-[13px] leading-4 text-muted-foreground">
        {t(label)}
      </span>
    </button>
  );
}

/** Rail twin of GroupHeader (#147): same collapse state, same aria. Hiding
 *  the rail member rows while collapsed is [推断] — the captured original
 *  rail (r7 03) only ever shows the open-group state. */
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
      className={`rail-row rail-group group relative flex h-8 w-10 flex-none cursor-pointer items-center justify-center border-none bg-transparent text-muted-foreground focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:outline-offset-2 ${
        collapsed ? 'rail-group--collapsed' : ''
      }`}
      aria-label={groupAria(t, label, collapsed)}
      aria-expanded={!collapsed}
      onClick={onToggle}
    >
      <span className="transition-transform duration-150 group-[.rail-group--collapsed]:[transform:rotate(-90deg)]">
        <ChevronDown />
      </span>
    </button>
  );
}

/** Rail 行公共件：32px 轨道行 + 24px pill（inset 8/4）。 */
const RAIL_ROW =
  'rail-row relative flex h-8 w-10 flex-none items-center justify-center text-muted-foreground no-underline outline-none before:absolute before:inset-x-2 before:inset-y-1 before:rounded-[6px] before:content-[""] hover:before:bg-sidebar-hover focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:outline-offset-2 [&>svg]:relative [&>.project-avatar]:relative';
const RAIL_SELECTED = 'rail-row--selected text-foreground before:bg-sidebar-active';

/** #656 用户菜单进出场：同 FLOATING_POP_ANIM 的 V2 配方（base-ui-theme §1.2：
 *  duration-100 + ease-out + fade + zoom-98，无 slide），方向翻成 bottom——
 *  面板底锚在头像 chip 上方（#163 锚定律），origin 落底边。挂在 .user-menu
 *  面板本体（fixed 定位元素自身吃 keyframe transform 不换包含块；挂祖先
 *  才会）。 */
const USER_MENU_POP_ANIM =
  'duration-100 ease-out origin-bottom group-data-closed/fshell:fill-mode-forwards group-data-open/fshell:animate-in group-data-open/fshell:fade-in-0 group-data-open/fshell:zoom-in-98 group-data-closed/fshell:animate-out group-data-closed/fshell:fade-out-0 group-data-closed/fshell:zoom-out-98';

export function BoardSidebar({
  collapsed = false,
  onToggle,
  attention = 0,
  onSearch,
  onNewTask,
  usageNav = false,
  selected = 'board',
  machineOnline = false,
  projects,
}: BoardSidebarProps) {
  const { t } = useI18n();
  // XMON-105: user chip identity single source (live = /api/user/me).
  const { user } = useLiveData();
  // Links carry the live query string across hops so the fixture scenario
  // survives client-side navigation (todo-card / page-back convention).
  const { search, pathname } = useLocation();
  // 项目行 = 调用面投影（app-sidebar：live projectsQ / fixture projectNames）；
  // 缺省回退 canon 单行（capture 面）。pill 不再吃 'project' 具名槽——按当前
  // 路径匹配行 href，多项目下选中的是真实所在行。
  const projectRows = useMemo(() => projects ?? [CANON_PROJECT], [projects]);
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
  // #656：OverlayMount/useEscapeClose → FloatingShell（Esc 归 Base UI layer 栈）。
  // Portal container 指回 aside 本体：`.board-sidebar--collapsed
  // .user-menu--floating` 的 53px 底边覆写靠后代选择器命中，portal 到 body
  // 会丢这条几何；挂回原位则 DOM 树位与包含块都不变（fixed 面板不受 aside
  // overflow 影响，#127 律原样成立）。
  const dockRef = useRef<HTMLElement | null>(null);
  const userMenuPopover = (
    <FloatingShell
      open={userMenuOpen}
      onClose={closeUserMenu}
      container={dockRef.current}
      className="anchored-pop-shell"
      // #666 律：toggle 面（头像 chip aria-expanded）焦点留触发位 + 外点归
      // ClickCatcher（原生 outsidePress 只接得住键盘合成 click，与 toggle
      // onClick 双写会把面「关不掉」）。
      initialFocus={false}
      disablePointerDismissal
    >
      <ClickCatcher onClose={closeUserMenu} />
      <UserMenu floating className={USER_MENU_POP_ANIM} theme={readStoredTheme(localStorage)} />
    </FloatingShell>
  );
  if (collapsed) {
    return (
      <aside
        ref={dockRef}
        className="board-sidebar board-sidebar--collapsed relative z-(--z-docked) flex w-10 flex-none flex-col border-r border-[var(--border-default)] bg-background"
      >
        {/* 展开钮的 hover 面是它骑 seam 行的本分（见展开态注释）；按压面与
            展开态折叠钮同律禁掉——同一个控件折叠前后的两张脸，按下去都只
            该是图标本身（XMON-69，律在 motion.css 的 sidebar toggles 段）。 */}
        <button
          type="button"
          className="rail-toggle flex h-11 w-10 flex-none cursor-pointer items-center justify-center border-0 border-b border-[var(--border-default)] bg-transparent text-muted-foreground hover:bg-sidebar-hover focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:outline-offset-2"
          aria-label={t('展开侧边栏')}
          onClick={onToggle}
        >
          <PanelLeftOpen />
        </button>
        <nav className="rail-nav flex flex-none flex-col pt-1">
          <button type="button" className={RAIL_ROW} aria-label={t('搜索')} onClick={onSearch}>
            <Search />
            {/* #468: rail 态没有常亮 badge 位，悬浮浮出 ⌘K 提示（展开态
                行的 sidebar-kbd 角标不动）。 */}
            <KbdHint label="⌘K" placement="right" />
          </button>
          <Link
            className={`${RAIL_ROW} ${selected === 'board' ? RAIL_SELECTED : ''}`}
            to={{ pathname: '/app', search }}
            aria-current={selected === 'board' ? 'page' : undefined}
            aria-label={t('工作台')}
          >
            <Kanban />
          </Link>
          <Link
            className={`${RAIL_ROW} ${selected === 'schedules' ? RAIL_SELECTED : ''}`}
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
          {!groupCollapsed.project &&
            projectRows.map((row) => {
              const href = `/app/project/${row.id}`;
              if (isDeleted(row.id)) return null;
              return (
                <Link
                  key={row.id}
                  className={`${RAIL_ROW} ${pathname === href ? RAIL_SELECTED : ''}`}
                  to={{ pathname: href, search }}
                  aria-current={pathname === href ? 'page' : undefined}
                  aria-label={row.name}
                >
                  <span className="project-avatar">{row.name.charAt(0).toLowerCase()}</span>
                </Link>
              );
            })}
          <RailGroupChevron
            label="资源"
            collapsed={groupCollapsed.resource}
            onToggle={toggleResourceGroup}
          />
          {!groupCollapsed.resource &&
            resourceRows.map(({ label, href, Icon }) => (
              <Link
                key={href}
                className={`${RAIL_ROW} ${selected === href ? RAIL_SELECTED : ''}`}
                to={{ pathname: href, search }}
                aria-current={selected === href ? 'page' : undefined}
                aria-label={t(label)}
              >
                <Icon />
              </Link>
            ))}
        </nav>
        <div className="sidebar-spacer flex-1" />
        <button
          type="button"
          className="rail-user mb-[11px] flex h-[38px] w-10 flex-none cursor-pointer items-center justify-center border-none bg-transparent outline-none hover:rounded-md hover:bg-sidebar-hover focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:outline-offset-2 [&_img]:block [&_img]:size-6 [&_img]:rounded-full"
          aria-label={user.displayName}
          aria-expanded={userMenuOpen}
          onClick={toggleUserMenu}
        >
          <SeededAvatar name={user.displayName} src={user.avatarUrl} fallback="/avatar-user.png" />
        </button>
        {userMenuPopover}
      </aside>
    );
  }

  return (
    <aside
      ref={dockRef}
      className="board-sidebar relative z-(--z-docked) flex w-60 flex-none flex-col overflow-hidden border-r border-[var(--border-default)] bg-background"
    >
      {/* 头部几何与选中态无关（dogfood 2026-09-30）：--active 只换底色，不搬
          内容。pill 的 mx-2 内缩 8px，pl 补 11 让图标仍落在 x19——与非选中态
          pl-[19px] 同一条线；名字间距恒 11px。r7 12 探针钉的是 pill 盒子
          （x8 y6 w223 h32，sidebar-seam.spec.ts），盒子不动，盒内内容也不该
          动——否则点品牌进 /app/team 时图标右移 3px、名字左移 2px，读作收紧。
          右端同律（XMON-69）：折叠钮是 ml-auto，x 由行的右边界减自身 margin
          定；pill 内缩 8px 后钮若不把这 8px 还回来，就往左走 8px——展开态折叠
          钮是全头部最右的墨，那一跳读作图标回缩。故选中态 mr 取 6（8+6=14，
          与非选中态 mr-[14px] 同一条右边界线）。 */}
      <div
        className={`sidebar-team-row flex flex-none items-center text-foreground ${
          selected === 'team'
            ? 'sidebar-team-row--active mx-2 mt-1.5 mb-[5px] h-8 rounded-lg bg-sidebar-active pl-[11px]'
            : 'h-[43px] pl-[19px]'
        }`}
      >
        <span className="sidebar-row-icon flex size-4 flex-none items-center justify-center">
          {/* 品牌槽（#390）：mark = logo.svg 真资产 alpha mask，随
              currentColor 取行墨——工具类表达不了 mask url，inline 承载 */}
          <span
            className="sidebar-brand-mark block size-4"
            aria-hidden="true"
            style={{
              backgroundColor: 'currentColor',
              WebkitMask: 'url("/logo.svg") center / 125% no-repeat',
              mask: 'url("/logo.svg") center / 125% no-repeat',
            }}
          />
        </span>
        {/* r2 §1.1: clicking the head name navigates to /app/team */}
        <Link
          className="sidebar-team-name relative top-px ml-[11px] truncate text-sm leading-6 text-foreground no-underline"
          to={{ pathname: '/app/team', search }}
        >
          {BRAND.manifestName}
        </Link>
        {/* 展开态折叠钮不给自己加面（dogfood 2026-09-30）：无 hover 底色、
            无阴影。它坐在头部行自己的底上，而那层底（选中 pill / 行本身）
            已经是分离信号；再叠 5% 灰底（--sidebar-hover 浅色 =
            rgb(28 25 23 / 0.05)）在行内的深色 pill 上读成阴影。focus 环保留
            ——键盘模态仍需可见（app.css 全局 :focus-visible 律）。
            rail 顶部的展开钮不在此列：它骑在自己的 seam 行上，hover 面照旧。
            按压面两钮一并禁（XMON-69）：motion.css 的全局 button:active 降
            到 .85，落在 14px 裸图标上读作图标自己缩了一下；律在 motion.css
            的 sidebar toggles 段，不在这里。 */}
        <button
          type="button"
          className={`sidebar-team-collapse ml-auto flex size-7 cursor-pointer items-center justify-center rounded-md border-none bg-transparent p-0 text-muted-foreground focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:outline-offset-2 ${
            selected === 'team' ? 'mr-[6px]' : 'mr-[14px]'
          }`}
          aria-label={t('收起侧边栏')}
          onClick={onToggle}
        >
          <PanelLeftClose />
        </button>
      </div>

      <nav className="sidebar-nav flex min-h-0 flex-[0_1_auto] flex-col overflow-y-auto border-t border-[var(--border-default)] pt-[9.5px]">
        <button
          type="button"
          className={`sidebar-row ${ROW_BASE} ${ROW_HOVER} h-9 pl-[18px]`}
          onClick={onSearch}
        >
          <span className="sidebar-row-icon flex size-4 flex-none items-center justify-center">
            <Search />
          </span>
          <span className="sidebar-row-label ml-3 truncate">{t('搜索')}</span>
          <span className="sidebar-kbd absolute top-1/2 right-[17px] -translate-y-1/2 rounded-[3px] border border-border px-[3px] py-px text-[11px] leading-4 text-muted-foreground">
            ⌘K
          </span>
        </button>
        {/* #389: 新任务行动作行——点击与全局 C 热键同一 opener；行序钉在
            搜索 之后（sidebar-visual 的 .sidebar-kbd 单数探针吃首枚 ⌘K）。
            #445: sidebar-new-task = 可钉别名（顶栏「+ 任务」撤除后，本行是
            新建入口的唯一点击面——e2e/integration 的 opener 与焦点回落断言
            全部指这里）。 */}
        <button
          type="button"
          className={`sidebar-row sidebar-new-task ${ROW_BASE} ${ROW_HOVER} h-9 pl-[18px]`}
          onClick={onNewTask}
        >
          <span className="sidebar-row-icon flex size-4 flex-none items-center justify-center">
            <Plus />
          </span>
          <span className="sidebar-row-label ml-3 truncate">{t('新任务')}</span>
          <span className="sidebar-kbd absolute top-1/2 right-[17px] -translate-y-1/2 rounded-[3px] border border-border px-[3px] py-px text-[11px] leading-4 text-muted-foreground">
            C
          </span>
        </button>
        <Link
          className={`sidebar-row ${ROW_BASE} h-9 pl-[18px] ${selected === 'board' ? `sidebar-row--selected ${ROW_SELECTED}` : ROW_HOVER}`}
          to={{ pathname: '/app', search }}
          aria-current={selected === 'board' ? 'page' : undefined}
        >
          <span className="sidebar-row-icon flex size-4 flex-none items-center justify-center">
            <Kanban />
          </span>
          <span className="sidebar-row-label ml-3 truncate">{t('工作台')}</span>
          {attention > 0 && (
            <span className="sidebar-badge mr-[18px] ml-auto h-4 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 text-primary-foreground">
              {attention}
            </span>
          )}
        </Link>
        <Link
          className={`sidebar-row ${ROW_BASE} h-9 pl-[18px] ${selected === 'schedules' ? `sidebar-row--selected ${ROW_SELECTED}` : ROW_HOVER}`}
          to={{ pathname: '/app/schedules', search }}
          aria-current={selected === 'schedules' ? 'page' : undefined}
        >
          <span className="sidebar-row-icon flex size-4 flex-none items-center justify-center">
            <Clock />
          </span>
          <span className="sidebar-row-label ml-3 truncate">{t('定时')}</span>
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
              className={`sidebar-subrow sidebar-new-project ${ROW_BASE} ${ROW_HOVER} h-9 pl-[34px]`}
              to={{ pathname: '/app/project/new', search }}
            >
              <span className="sidebar-row-icon flex size-4 flex-none items-center justify-center">
                <Plus />
              </span>
              <span className="sidebar-subrow-label ml-3 truncate">{t('新建项目')}</span>
            </Link>
            {/* #207 + 侧栏 live 收编:项目行 = 调用面投影多行渲染,行随
                fixture 删除覆面隐去(#66 deletions 同律);pill 按路径匹配。 */}
            {projectRows.map((row) => {
              const href = `/app/project/${row.id}`;
              if (isDeleted(row.id)) return null;
              return (
                <Link
                  key={row.id}
                  className={`sidebar-subrow ${ROW_BASE} h-9 pl-[34px] ${pathname === href ? `sidebar-subrow--selected ${ROW_SELECTED}` : ROW_HOVER}`}
                  to={{ pathname: href, search }}
                  aria-current={pathname === href ? 'page' : undefined}
                >
                  <span className="project-avatar">{row.name.charAt(0).toLowerCase()}</span>
                  <span className="sidebar-subrow-label ml-3 truncate">{row.name}</span>
                </Link>
              );
            })}
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
              className={`sidebar-subrow ${ROW_BASE} h-9 pl-[34px] ${selected === href ? `sidebar-subrow--selected ${ROW_SELECTED}` : ROW_HOVER}`}
              to={{ pathname: href, search }}
              aria-current={selected === href ? 'page' : undefined}
            >
              <span className="sidebar-row-icon flex size-4 flex-none items-center justify-center">
                <Icon />
              </span>
              <span className="sidebar-subrow-label ml-3 truncate">{t(label)}</span>
              {machineOnline && label === '机器' && (
                <span className="sidebar-online-dot absolute top-1/2 right-4 size-[5px] -translate-y-1/2 rounded-full bg-primary" />
              )}
            </Link>
          ))}
      </nav>

      <div className="sidebar-spacer flex-1" />

      <button
        type="button"
        className="sidebar-user flex h-11 flex-none cursor-pointer items-center border-0 border-t border-[var(--border-default)] bg-transparent px-2 hover:bg-sidebar-hover focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:outline-offset-2 [&_img]:block [&_img]:size-6 [&_img]:rounded-full"
        aria-label={user.displayName}
        aria-expanded={userMenuOpen}
        onClick={toggleUserMenu}
      >
        <SeededAvatar name={user.displayName} src={user.avatarUrl} fallback="/avatar-user.png" />
        <span className="sidebar-user-name relative -top-px ml-[9px] text-sm leading-[14px] whitespace-nowrap text-muted-foreground">
          {user.displayName}
        </span>
        <span className="sidebar-user-more ml-auto flex size-6 items-center justify-center text-muted-foreground">
          <EllipsisVertical />
        </span>
      </button>
      {userMenuPopover}
    </aside>
  );
}
