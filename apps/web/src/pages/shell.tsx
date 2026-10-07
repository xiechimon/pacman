// Secondary-route shell (issue #71): sidebar + 44px topbar with a back
// chevron, a centered title or centered text-tab group, an optional
// left title (project name, r2 24b) and an optional right action (the
// indigo + 新建 on schedules, r7 11). Geometry from the r7 11 probes
// (topbar 43 + 1px border, back 28×28 @ x252, title centered on the
// content area) and r2 24b/24c for the name + tab-group variants.
// The 总管 FAB rides the shell (r7 11 shows it on every secondary route)
// and wakes the shared chief drawer (#129); the sidebar is the shared
// AppSidebar, so its geometry/behavior matches the board's exactly.
// #946: pages.css 清零——本壳的全部几何/配色迁为 token utility（值 =
// 原规则等值迁移）；page-shell/page-main(-col)/page-topbar/page-fab/
// page-tab(s-group) 类名留存 DOM：chief-drawer 的 DOCK_ROWS 以 page-main
// 作停靠行钩子（功能位），其余是跨域 spec 的既有定位别名（#910 裁定 1
// 两级制下 spec 载体已迁语义位，类名摘除归 #952/#953 终账）。
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { AppSidebar } from '../board/app-sidebar.js';
import type { SidebarSelected } from '../board/sidebar.js';
import { ChiefWake } from '../chief/chief-wake.js';
import { Button } from '../components/ui/button.js';
import type { FixtureSet } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronLeft } from '../icons/index.js';
import {
  GHOST_SEG_BTN_CLS,
  SEG_GROUP_CLS,
  SEG_TAB_ACTIVE_CLS,
  SEG_TAB_CLS,
  SEG_TAB_DISABLED_CLS,
  SEG_TAB_IDLE_CLS,
} from './parts.js';

export interface PageTab {
  id: string;
  label: string;
  /** 禁用位（spec 12 G2-T2 v1：local 项目的 文件 tab）——钮不可点，
   *  内容面由页面给占位文案。 */
  disabled?: boolean;
}

/** 总管 FAB 配方（原 .page-fab，r7 §3.4: 48×48 @ right 16 / bottom 16；
 *  bg = page surface，投影 --fab-shadow）。ghost 件配方的涂底通道按七通道
 *  律压回 surface（含 dark:）；hover 墨色不中和——旧面 per-face 无 color
 *  声明，ghost 的 hover:text-foreground 本就生效，等值保留。 */
export const PAGE_FAB_CLS =
  'absolute bottom-4 right-4 size-12 cursor-pointer rounded-full border-none bg-(--card) shadow-(--fab-shadow) hover:bg-(--card) dark:hover:bg-(--card)';

/** Text-tab pill group (任务|文件 in the topbar, 基本信息|仓库|标签 in the
 *  settings column — r2 24b/24c share one markup). #946: role=tablist/tab +
 *  aria-selected 为选中态一级载体（#910 裁定 3：状态类断言归行为、载体改
 *  aria-*）；page-tab(s-group)/--active 类名留存（segmented-controls.spec
 *  跨域别名，皮肤已迁 SEG_* 配方）。 */
export function TabGroup({
  tabs,
  tab,
  onTab,
}: {
  tabs: PageTab[];
  tab: string;
  onTab?: (id: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div className={`page-tabs-group ${SEG_GROUP_CLS} pointer-events-auto`} role="tablist">
      {tabs.map((item) => {
        const active = tab === item.id;
        const disabled = item.disabled === true;
        return (
          <Button
            key={item.id}
            variant="ghost"
            role="tab"
            aria-selected={active}
            className={`page-tab ${SEG_TAB_CLS} ${GHOST_SEG_BTN_CLS} disabled:pointer-events-auto ${
              active
                ? `page-tab--active ${SEG_TAB_ACTIVE_CLS}`
                : disabled
                  ? SEG_TAB_DISABLED_CLS
                  : SEG_TAB_IDLE_CLS
            }`}
            disabled={disabled}
            onClick={() => onTab?.(item.id)}
          >
            {t(item.label)}
          </Button>
        );
      })}
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
  /** #389: 页面自有新建 dialog 的 opener（project 页——保存锚路由项目）；
   *  缺省 = 侧栏内部全局 dialog。 */
  onNewTask?: () => void;
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
  onNewTask,
  children,
}: PageShellProps) {
  const { t } = useI18n();
  const { search } = useLocation();
  return (
    <div className="page-shell flex h-full overflow-hidden">
      <AppSidebar fixture={fixture} selected={selected} onNewTask={onNewTask} />
      {/* #447 (ADR 0004 D2/D6): the main column is the docking row —
          [page-main-col (flex:1 min-width:0), chief panel (flex:none 418)].
          The wake pair stays the row's last child: its FAB rides the
          page-main absolute anchor while the docked panel takes the flex
          slot, so the content column yields by exactly the panel width. */}
      <div className="page-main relative flex min-w-0 flex-1 bg-(--card)">
        <div className="page-main-col flex min-w-0 flex-1 flex-col">
          <header className="page-topbar relative flex h-11 flex-none items-center border-b border-(--border) pl-3">
            <Link
              className="flex size-7 flex-none items-center justify-center text-(--text-tertiary) no-underline"
              to={{ pathname: '/app', search }}
              aria-label={t('返回')}
            >
              <ChevronLeft />
            </Link>
            {leftTitle != null && (
              <span className="ml-1 min-w-0 truncate text-sm font-medium leading-[22px] text-(--foreground)">
                {leftTitle}
              </span>
            )}
            {title != null && (
              <div className="pointer-events-none absolute inset-x-0 text-center text-sm font-medium leading-[22px] text-(--foreground)">
                {t(title)}
              </div>
            )}
            {tabs != null && tab != null && (
              <div className="pointer-events-none absolute inset-x-0 flex justify-center">
                <TabGroup tabs={tabs} tab={tab} onTab={onTab} />
              </div>
            )}
            {action != null && <div className="ml-auto flex items-center pr-5">{action}</div>}
          </header>
          {children}
        </div>
        <ChiefWake fixture={fixture} fabClassName={`page-fab ${PAGE_FAB_CLS}`} />
      </div>
    </div>
  );
}
