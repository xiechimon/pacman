// Board surface (issue #54): topbar + horizontal 6-column scroller + chief
// FAB. Geometry from the r7 captures: scroller padding 12/17/13, column
// pitch 292 (278 body + 14 gap), radius 10, header 37 with dot/name/count,
// empty-state copy centered. The scroller carries [data-parity-scroll] for
// the parity harness scrollLeft driving.
// #58: the scroller's scrollLeft is mirrored to sessionStorage on scroll
// and restored on mount, so 详情 → 返回 lands on the same board scroll
// position (module key below; per-tab storage, cleared with the tab).
// #73: drag & drop rides the locked stack (01-stack-v2 §4.1: @dnd-kit/core
// + sortable). Multi-container pattern: a per-column id list mirrors the
// committed todo set while a gesture is in flight (live preview), and the
// settled drop commits through dnd.ts moveTodo — phase rewrite on column
// change, orderIndex write-back, fold/awaitingReply handling. Desktop-only
// like the official (changelog 2026-09-12: drag rows appear on desktop web
// only), so the sensor set is empty on coarse pointers.

import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { FixtureSet, TodoRecord } from '../fixtures/records.js';
// #72: the 总管 FAB moved to the route (board-page.tsx) so the chief
// drawer/settings overlays sit beside it in one place.
import { HelpCircle, Plus, UnfoldVertical } from '../icons/index.js';
import { COLUMNS, sortColumnTodos } from './columns.js';
import { DRAG_THRESHOLD_PX, moveTodo } from './dnd.js';
import { SortableCard } from './sortable-card.js';
import { TodoCard } from './todo-card.js';
import './board.css';

/** sessionStorage key for the board scroller's scrollLeft (#58 back-nav
 *  restore). [推断] key shape — the official key is unobservable; collision
 *  with a future real key is harmless (worst case: a stale offset). */
const BOARD_SCROLL_KEY = 'tds.board-scroll-left';

/** column id → todo ids in view order; the live-preview mirror while a
 *  drag is in flight (null = no gesture, render straight from the todos) */
type ColumnView = Record<string, string[]>;

function deriveView(todos: TodoRecord[]): ColumnView {
  const view: ColumnView = {};
  for (const column of COLUMNS) {
    view[column.id] = sortColumnTodos(column, todos.filter(column.accepts)).map((t) => t.id);
  }
  return view;
}

function columnOf(view: ColumnView, id: string): string | null {
  return COLUMNS.find((c) => view[c.id]?.includes(id))?.id ?? null;
}

const COLUMN_IDS = new Set(COLUMNS.map((c) => c.id));

interface BoardProps {
  fixture: FixtureSet;
  /** #66: opens the new-task dialog from the topbar `+ 任务` button. */
  onNewTask?: () => void;
  /** Card callbacks (issue #68): the page owns the modal overlays. */
  onAction?: (todo: TodoRecord) => void;
  onBranch?: (todo: TodoRecord) => void;
  /** #73: committed drag drop — the page owns the todo list state. */
  onReorder?: (next: TodoRecord[]) => void;
}

export function BoardSurface({ fixture, onNewTask, onAction, onBranch, onReorder }: BoardProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<ColumnView | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropColumnId, setDropColumnId] = useState<string | null>(null);
  // changelog 2026-09-12: the drag affordance is desktop-web only
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: DRAG_THRESHOLD_PX },
    }),
  );
  const desktop =
    typeof window === 'undefined' ||
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Restore after mount, before paint — a returning user never sees the
  // board jump. The parity harness drives scrollLeft itself after load, so
  // this is a no-op under fresh browser contexts (empty sessionStorage).
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (el == null) return;
    const saved = sessionStorage.getItem(BOARD_SCROLL_KEY);
    if (saved != null) el.scrollLeft = Number(saved);
  }, []);

  const sweep = useCallback(() => {
    document.body.classList.remove('board-dragging');
    // changelog 2026-09-14: the highlight is swept again on teardown
    window.getSelection()?.removeAllRanges();
  }, []);

  const onDragStart = (event: DragStartEvent) => {
    setView(deriveView(fixture.todos));
    setDragId(String(event.active.id));
    document.body.classList.add('board-dragging');
    window.getSelection()?.removeAllRanges();
  };

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    setDropColumnId(
      over == null
        ? null
        : COLUMN_IDS.has(String(over.id))
          ? String(over.id)
          : columnOf(view ?? {}, String(over.id)),
    );
    if (over == null) return;
    const overId = String(over.id);
    setView((prev) => {
      if (prev == null) return prev;
      const from = columnOf(prev, String(active.id));
      const to = COLUMN_IDS.has(overId) ? overId : columnOf(prev, overId);
      if (from == null || to == null || from === to) return prev;
      const fromIds = prev[from];
      const toIds = prev[to];
      if (fromIds == null || toIds == null) return prev;
      const fromList = fromIds.filter((id) => id !== String(active.id));
      const toList = toIds.filter((id) => id !== String(active.id));
      const overIndex = toList.indexOf(overId);
      toList.splice(overIndex >= 0 ? overIndex : toList.length, 0, String(active.id));
      return { ...prev, [from]: fromList, [to]: toList };
    });
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const live = view;
    setView(null);
    setDragId(null);
    setDropColumnId(null);
    sweep();
    if (live == null || over == null || onReorder == null) return;
    const overId = String(over.id);
    const columnId = columnOf(live, String(active.id)) ?? (COLUMN_IDS.has(overId) ? overId : null);
    if (columnId == null) return;
    const liveList = live[columnId];
    if (liveList == null) return;
    const from = liveList.indexOf(String(active.id));
    const overIndex = liveList.indexOf(overId);
    const list =
      overId !== String(active.id) && overIndex >= 0
        ? arrayMove(liveList, from, overIndex)
        : liveList;
    onReorder(
      moveTodo(
        fixture.todos,
        String(active.id),
        { columnId, index: list.indexOf(String(active.id)) },
        fixture.now,
      ),
    );
  };

  const onDragCancel = () => {
    setView(null);
    setDragId(null);
    setDropColumnId(null);
    sweep();
  };

  const viewTodos = (columnId: string): TodoRecord[] => {
    const column = COLUMNS.find((c) => c.id === columnId);
    if (column == null) return [];
    if (view == null) return sortColumnTodos(column, fixture.todos.filter(column.accepts));
    const byId = new Map(fixture.todos.map((t) => [t.id, t]));
    return (view[columnId] ?? [])
      .map((id) => byId.get(id))
      .filter((t): t is TodoRecord => t != null);
  };

  const dragged = dragId == null ? null : (fixture.todos.find((t) => t.id === dragId) ?? null);

  return (
    <div className="board-main">
      <header className="board-topbar">
        <div className="board-topbar-title">看板</div>
        <div className="board-topbar-actions">
          <button type="button" className="board-new-task" onClick={onNewTask}>
            <Plus width={13} height={13} />
            任务
          </button>
          <button type="button" className="board-guide" aria-label="看板指南">
            <HelpCircle />
          </button>
        </div>
      </header>

      <DndContext
        sensors={desktop ? sensors : []}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div
          className="board-scroller"
          data-parity-scroll=""
          ref={scrollerRef}
          onScroll={(e) =>
            sessionStorage.setItem(BOARD_SCROLL_KEY, String(e.currentTarget.scrollLeft))
          }
        >
          {COLUMNS.map((column) => {
            const todos = viewTodos(column.id);
            return (
              <section
                key={column.id}
                className="board-column"
                aria-label={column.name}
                data-column={column.id}
                data-drop={dropColumnId === column.id ? 'true' : undefined}
              >
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
                <ColumnList columnId={column.id} empty={column.empty} count={todos.length}>
                  <SortableContext
                    items={todos.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {todos.map((todo) => (
                      <SortableCard
                        key={todo.id}
                        todo={todo}
                        now={fixture.now}
                        onAction={onAction}
                        onBranch={onBranch}
                        dragSource={dragId === todo.id}
                      />
                    ))}
                  </SortableContext>
                </ColumnList>
              </section>
            );
          })}
        </div>
        <DragOverlay dropAnimation={null}>
          {dragged != null && (
            <div className="board-drag-overlay">
              <TodoCard todo={dragged} now={fixture.now} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

/** The list area doubles as the column's drop target so empty columns
 *  accept drops (useDroppable id = column id). */
function ColumnList({
  columnId,
  empty,
  count,
  children,
}: {
  columnId: string;
  empty: string;
  count: number;
  children: ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: columnId });
  return (
    <div className="board-column-list" ref={setNodeRef} data-column-list={columnId}>
      {children}
      {count === 0 && <div className="board-column-empty">{empty}</div>}
    </div>
  );
}
