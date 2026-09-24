// Resource route shell (issue #69): the二级页 topbar of r2 §1.2 — back
// chevron at x252, centered page title (16px), right `+ 新建` indigo link —
// over a 768px centered content column (x456..1223 @1440, probed from r7
// 06–10), with the sidebar's matching 资源 subrow selected and the 总管 FAB
// pinned like on the detail route — waking the shared chief drawer (#129)
// over the shared AppSidebar (identical geometry on every route).
import type { ReactNode } from 'react';
import { AppSidebar } from '../board/app-sidebar.js';
import type { SidebarSelected } from '../board/sidebar.js';
import { ChiefWake } from '../chief/chief-wake.js';
import type { FixtureSet } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronLeft, Plus } from '../icons/index.js';
import './resources.css';

interface ResourceShellProps {
  /** Centered topbar title (`技能` / `MCP 服务器` / …). */
  title: string;
  /** This route's href (data-route). */
  href: string;
  /** Sidebar selected pill: resource hrefs, or 技能 on the import page
   *  (r8 79/80). Absent = 看板. */
  selected?: SidebarSelected;
  /** Back-chevron target: the board, or the skills list on the import page. */
  backHref: string;
  /** Href for the right `+ 新建` action; absent renders a bare button
   *  (dialog-opening actions land in a later ticket). */
  newHref?: string;
  /** The import page carries no `+ 新建` action (r2 08b/08c). */
  hideNew?: boolean;
  fixture: FixtureSet;
  children: ReactNode;
}

export function ResourceShell({
  title,
  href,
  selected,
  backHref,
  newHref,
  hideNew = false,
  fixture,
  children,
}: ResourceShellProps) {
  const { t } = useI18n();
  const newAction = hideNew ? null : newHref == null ? (
    <button type="button" className="res-new">
      <Plus width={13} height={13} />
      {t('新建')}
    </button>
  ) : (
    <a className="res-new" href={newHref}>
      <Plus width={13} height={13} />
      {t('新建')}
    </a>
  );

  return (
    <div className="res-shell" data-route={href}>
      <AppSidebar fixture={fixture} selected={selected} />
      <div className="res-main">
        <header className="res-topbar">
          <a className="res-back" href={backHref} aria-label={t('返回')}>
            <ChevronLeft width={16} height={16} />
          </a>
          <h1 className="res-title">{t(title)}</h1>
          {newAction}
        </header>
        <div className="res-col">{children}</div>
        <ChiefWake fixture={fixture} fabClassName="res-fab" />
      </div>
    </div>
  );
}
