// Board surface (issue #54): topbar + horizontal 6-column scroller + chief
// FAB. Geometry from the r7 captures: scroller padding 12/17/13, column
// pitch 292 (278 body + 14 gap), radius 10, header 37 with dot/name/count,
// empty-state copy centered. The scroller carries [data-parity-scroll] for
// the parity harness scrollLeft driving.

import type { FixtureSet } from '../fixtures/records.js';
import { ChiefFab, HelpCircle, Plus, UnfoldVertical } from '../icons/index.js';
import { COLUMNS } from './columns.js';
import { TodoCard } from './todo-card.js';
import './board.css';

interface BoardProps {
  fixture: FixtureSet;
}

export function BoardSurface({ fixture }: BoardProps) {
  return (
    <div className="board-main">
      <header className="board-topbar">
        <div className="board-topbar-title">看板</div>
        <div className="board-topbar-actions">
          <button type="button" className="board-new-task">
            <Plus width={13} height={13} />
            任务
          </button>
          <button type="button" className="board-guide" aria-label="看板指南">
            <HelpCircle />
          </button>
        </div>
      </header>

      <div className="board-scroller" data-parity-scroll="">
        {COLUMNS.map((column) => {
          const todos = fixture.todos.filter(column.accepts);
          return (
            <section key={column.id} className="board-column" aria-label={column.name}>
              <header className="board-column-header">
                <span className="board-column-dot" style={{ background: column.dot }} />
                <span className="board-column-name">{column.name}</span>
                {/* count always renders, `0` included (r2 §4.1 计数 0/1;
                    r7 02/01b: digit present on empty columns, x = name+9) */}
                <span className="board-column-count">{todos.length}</span>
                {column.label && <span className="board-column-label">{column.label}</span>}
                <button
                  type="button"
                  className="board-column-collapse"
                  // aria-label = column name, r7 icons.json `aria:待开始` ×6
                  aria-label={column.name}
                >
                  <UnfoldVertical />
                </button>
              </header>
              <div className="board-column-list">
                {todos.length === 0 ? (
                  <div className="board-column-empty">{column.empty}</div>
                ) : (
                  todos.map((todo) => <TodoCard key={todo.id} todo={todo} now={fixture.now} />)
                )}
              </div>
            </section>
          );
        })}
      </div>

      <button type="button" className="chief-fab" aria-label="总管">
        <ChiefFab />
      </button>
    </div>
  );
}
