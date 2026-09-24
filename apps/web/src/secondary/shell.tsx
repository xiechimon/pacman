// Secondary-route shell (issue #70): sidebar + 44px head with the back
// chevron, a centered title slot and an optional right slot (r2 §1.2
// 二级页 geometry, r7 12/13 probes: back 28×28 at main-left 12, title
// centered on the content area, right slot at right-20 per the r7 12
// 设置 ink), wrapping the
// centered 766px content column shared by the team/account/resources/
// api-keys surfaces (r7 08/12/13: column x457..1223 @1440).
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { AppSidebar } from '../board/app-sidebar.js';
import type { SidebarSelected } from '../board/sidebar.js';
import { ChiefWake } from '../chief/chief-wake.js';
import type { FixtureSet } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronLeft } from '../icons/index.js';
import './secondary.css';

interface SecondaryShellProps {
  /** data-route value, keeps parity/debug selectors per page. */
  route: string;
  fixture: FixtureSet;
  /** Centered head content — plain text or a dropdown trigger (team). */
  title: ReactNode;
  /** Head right slot (team `设置` link); absent on the other pages. */
  right?: ReactNode;
  /** Sidebar pill owner: team/account = team row, the rest none. */
  sidebarSelected?: SidebarSelected;
  children: ReactNode;
}

export function SecondaryShell({
  route,
  fixture,
  title,
  right,
  sidebarSelected = 'none',
  children,
}: SecondaryShellProps) {
  const { t } = useI18n();
  // the back chevron carries the scenario string home like dhead (#58)
  const { search } = useLocation();
  return (
    <div className="secondary-shell" data-route={route}>
      <AppSidebar fixture={fixture} selected={sidebarSelected} />
      <div className="secondary-main">
        <header className="secondary-head">
          <Link className="secondary-back" to={{ pathname: '/app', search }} aria-label={t('返回')}>
            <ChevronLeft />
          </Link>
          <div className="secondary-title">{title}</div>
          {right != null && <div className="secondary-head-right">{right}</div>}
        </header>
        <div className="secondary-body">
          <div className="secondary-col">{children}</div>
        </div>
        {/* 总管 FAB rides every surface (r7 12/13 bottom-right circle) and
            wakes the shared chief drawer (#129) */}
        <ChiefWake fixture={fixture} fabClassName="secondary-fab" />
      </div>
    </div>
  );
}
