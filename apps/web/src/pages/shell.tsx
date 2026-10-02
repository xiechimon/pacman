// Secondary-route shell (issue #71): sidebar + 44px topbar with a back
// chevron, a centered title or centered text-tab group, an optional
// left title (project name, r2 24b) and an optional right action (the
// indigo + 新建 on schedules, r7 11). Geometry from the r7 11 probes
// (topbar 43 + 1px border, back 28×28 @ x252, title centered on the
// content area) and r2 24b/24c for the name + tab-group variants.
// The 总管 FAB rides the shell (r7 11 shows it on every secondary route)
// and wakes the shared chief drawer (#129); the sidebar is the shared
// AppSidebar, so its geometry/behavior matches the board's exactly.
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { AppSidebar } from '../board/app-sidebar.js';
import type { SidebarSelected } from '../board/sidebar.js';
import { ChiefWake } from '../chief/chief-wake.js';
import { Button } from '../components/ui/button.js';
import type { FixtureSet } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronLeft } from '../icons/index.js';

export interface PageTab {
  id: string;
  label: string;
  /** 禁用位（spec 12 G2-T2 v1：local 项目的 文件 tab）——钮不可点，
   *  内容面由页面给占位文案。 */
  disabled?: boolean;
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
  const { t } = useI18n();
  return (
    <div className="page-tabs-group">
      {tabs.map((item) => (
        // XMON-25 收编：ghost 变体承载交互皮肤，几何/墨色正本仍在 per-face
        // （.page-tab 的 bg 简写压掉 ghost hover；seg-hover 媒体块 unlayered
        // 恒胜）。中和位：font-normal（正文 400 基线）、active 位移清零、
        // disabled 保 pointer-events（禁用 tab 的 hover 微光是现行为）。
        <Button
          key={item.id}
          variant="ghost"
          className={`page-tab font-normal active:not-aria-[haspopup]:translate-y-0 disabled:pointer-events-auto${
            tab === item.id ? ' page-tab--active' : ''
          }${item.disabled === true ? ' page-tab--disabled' : ''}`}
          disabled={item.disabled === true}
          onClick={() => onTab?.(item.id)}
        >
          {t(item.label)}
        </Button>
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
    <div className="page-shell">
      <AppSidebar fixture={fixture} selected={selected} onNewTask={onNewTask} />
      {/* #447 (ADR 0004 D2/D6): the main column is the docking row —
          [page-main-col (flex:1 min-width:0), chief panel (flex:none 418)].
          The wake pair stays the row's last child: its FAB rides the
          page-main absolute anchor while the docked panel takes the flex
          slot, so the content column yields by exactly the panel width. */}
      <div className="page-main">
        <div className="page-main-col">
          <header className="page-topbar">
            <Link className="page-back" to={{ pathname: '/app', search }} aria-label={t('返回')}>
              <ChevronLeft />
            </Link>
            {leftTitle != null && <span className="page-left-title">{leftTitle}</span>}
            {title != null && <div className="page-topbar-title">{t(title)}</div>}
            {tabs != null && tab != null && (
              <div className="page-tabs">
                <TabGroup tabs={tabs} tab={tab} onTab={onTab} />
              </div>
            )}
            {action != null && <div className="page-topbar-actions">{action}</div>}
          </header>
          {children}
        </div>
        <ChiefWake fixture={fixture} fabClassName="page-fab" />
      </div>
    </div>
  );
}
