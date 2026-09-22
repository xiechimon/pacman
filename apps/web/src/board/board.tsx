// Board surface (issue #54): topbar + horizontal 6-column scroller + chief
// FAB. Geometry from the r7 captures: scroller padding 12/17/13, column
// pitch 292 (278 body + 14 gap), radius 10, header 37 with dot/name/count,
// empty-state copy centered. The scroller carries [data-parity-scroll] for
// the parity harness scrollLeft driving.
// #58: the scroller's scrollLeft is mirrored to sessionStorage on scroll
// and restored on mount, so 详情 → 返回 lands on the same board scroll
// position (module key below; per-tab storage, cleared with the tab).

import { useLayoutEffect, useRef } from 'react';
import type { FixtureSet, TodoRecord } from '../fixtures/records.js';
// #72: the 总管 FAB moved to the route (board-page.tsx) so the chief
// drawer/settings overlays sit beside it in one place.
import { useI18n } from '../i18n/provider.js';
import { HelpCircle, Plus, UnfoldVertical } from '../icons/index.js';
import { COLUMNS } from './columns.js';
import { TodoCard } from './todo-card.js';
import './board.css';

/** sessionStorage key for the board scroller's scrollLeft (#58 back-nav
 *  restore). [推断] key shape — the official key is unobservable; collision
 *  with a future real key is harmless (worst case: a stale offset). */
const BOARD_SCROLL_KEY = 'tds.board-scroll-left';

interface BoardProps {
  fixture: FixtureSet;
  /** #66: opens the new-task dialog from the topbar `+ 任务` button. */
  onNewTask?: () => void;
  /** Card callbacks (issue #68): the page owns the modal overlays. */
  onAction?: (todo: TodoRecord) => void;
  onBranch?: (todo: TodoRecord) => void;
}

export function BoardSurface({ fixture, onNewTask, onAction, onBranch }: BoardProps) {
  const { t } = useI18n();
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Restore after mount, before paint — a returning user never sees the
  // board jump. The parity harness drives scrollLeft itself after load, so
  // this is a no-op under fresh browser contexts (empty sessionStorage).
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (el == null) return;
    const saved = sessionStorage.getItem(BOARD_SCROLL_KEY);
    if (saved != null) el.scrollLeft = Number(saved);
  }, []);

  return (
    <div className="board-main">
      <header className="board-topbar">
        <div className="board-topbar-title">{t('看板')}</div>
        <div className="board-topbar-actions">
          <button type="button" className="board-new-task" onClick={onNewTask}>
            <Plus width={13} height={13} />
            {t('任务')}
          </button>
          <button type="button" className="board-guide" aria-label={t('看板指南')}>
            <HelpCircle />
          </button>
        </div>
      </header>

      <div
        className="board-scroller"
        data-parity-scroll=""
        ref={scrollerRef}
        onScroll={(e) =>
          sessionStorage.setItem(BOARD_SCROLL_KEY, String(e.currentTarget.scrollLeft))
        }
      >
        {COLUMNS.map((column) => {
          const todos = fixture.todos.filter(column.accepts);
          return (
            <section key={column.id} className="board-column" aria-label={t(column.name)}>
              <header className="board-column-header">
                <span className="board-column-dot" style={{ background: column.dot }} />
                <span className="board-column-name">{t(column.name)}</span>
                {/* count always renders, `0` included (r2 §4.1 计数 0/1;
                    r7 02/01b: digit present on empty columns, x = name+9) */}
                <span className="board-column-count">{todos.length}</span>
                {column.label && <span className="board-column-label">{t(column.label)}</span>}
                <button
                  type="button"
                  className="board-column-collapse"
                  // aria-label = column name, r7 icons.json `aria:待开始` ×6
                  aria-label={t(column.name)}
                >
                  <UnfoldVertical />
                </button>
              </header>
              <div className="board-column-list">
                {todos.length === 0 ? (
                  <div className="board-column-empty">{t(column.empty)}</div>
                ) : (
                  todos.map((todo) => (
                    <TodoCard
                      key={todo.id}
                      todo={todo}
                      now={fixture.now}
                      onAction={onAction}
                      onBranch={onBranch}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
