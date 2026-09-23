// Resource route shell (issue #69): the二级页 topbar of r2 §1.2 — back
// chevron at x252, centered page title (16px), right `+ 新建` indigo link —
// over a 768px centered content column (x456..1223 @1440, probed from r7
// 06–10), with the sidebar's matching 资源 subrow selected and the 总管 FAB
// pinned like on the detail route.
import type { ReactNode } from 'react';
import { useTodos } from '../api/hooks.js';
import { toDisplayTodo } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import { attentionCount } from '../board/columns.js';
import { BoardSidebar, type SidebarSelected } from '../board/sidebar.js';
import type { FixtureSet } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronLeft, ChiefFab, Plus } from '../icons/index.js';
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
  // M5 live：侧栏待办徽标走真 todos（TQ 同键去重，页面级查询共缓存）。
  const { live, teamId } = useLiveData();
  const todosQ = useTodos(teamId, live);
  const attention = attentionCount(live ? (todosQ.data ?? []).map(toDisplayTodo) : fixture.todos);
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
      <BoardSidebar selected={selected} attention={attention} />
      <div className="res-main">
        <header className="res-topbar">
          <a className="res-back" href={backHref} aria-label={t('返回')}>
            <ChevronLeft width={16} height={16} />
          </a>
          <h1 className="res-title">{t(title)}</h1>
          {newAction}
        </header>
        <div className="res-col">{children}</div>
        <button type="button" className="res-fab" aria-label={t('总管')}>
          <ChiefFab />
        </button>
      </div>
    </div>
  );
}
