// Resource route shell (issue #69): the二级页 topbar of r2 §1.2 — back
// chevron at x252, centered page title (16px), right `+ 新建` indigo link —
// over a 768px centered content column (x456..1223 @1440, probed from r7
// 06–10), with the sidebar's matching 资源 subrow selected and the 总管 FAB
// pinned like on the detail route.
import type { ReactNode } from 'react';
import { attentionCount } from '../board/columns.js';
import { BoardSidebar } from '../board/sidebar.js';
import type { FixtureSet } from '../fixtures/records.js';
import { ChevronLeft, ChiefFab, Plus } from '../icons/index.js';
import './resources.css';

interface ResourceShellProps {
  /** Centered topbar title (`技能` / `MCP 服务器` / …). */
  title: string;
  /** This route's href (data-route + default selected pill carrier). */
  href: string;
  /** Sidebar pill override: the import page keeps 技能 selected (r8 69/70). */
  selectedHref?: string;
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
  selectedHref,
  backHref,
  newHref,
  hideNew = false,
  fixture,
  children,
}: ResourceShellProps) {
  const newAction = hideNew ? null : newHref == null ? (
    <button type="button" className="res-new">
      <Plus width={13} height={13} />
      新建
    </button>
  ) : (
    <a className="res-new" href={newHref}>
      <Plus width={13} height={13} />
      新建
    </a>
  );

  return (
    <div className="res-shell" data-route={href}>
      <BoardSidebar selected={selectedHref ?? href} attention={attentionCount(fixture.todos)} />
      <div className="res-main">
        <header className="res-topbar">
          <a className="res-back" href={backHref} aria-label="返回">
            <ChevronLeft width={16} height={16} />
          </a>
          <h1 className="res-title">{title}</h1>
          {newAction}
        </header>
        <div className="res-col">{children}</div>
        <button type="button" className="res-fab" aria-label="总管">
          <ChiefFab />
        </button>
      </div>
    </div>
  );
}
