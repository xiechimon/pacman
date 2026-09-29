// Board surface (issue #54): topbar + 4-column grid + chief FAB. #351:
// the 6-column 278px fixed-pitch scroller became an even 4-column grid
// (repeat(4, minmax(0, 1fr)), gap 14 — geometry in board.css); the #147
// column-collapse family and the #58 scrollLeft persistence retired with
// the horizontal scroll they served. Header 37 with dot/name/count,
// empty-state copy centered (r7 captures).
// #73: drag & drop rides the locked stack (01-stack-v2 §4.1: @dnd-kit/core
// + sortable). Multi-container pattern: a per-column id list mirrors the
// committed todo set while a gesture is in flight (live preview), and the
// settled drop commits through dnd.ts moveTodo — phase rewrite on column
// change, orderIndex write-back. #351: 待处理 carries no dropPhase — the
// preview never enters it and a drop there commits nothing (same-column
// reorder still lands). Desktop-only like the official (changelog
// 2026-09-12: drag rows appear on desktop web only), so the sensor set is
// empty on coarse pointers.

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
import { type ReactNode, useCallback, useState } from 'react';
import type { FixtureSet, TodoRecord } from '../fixtures/records.js';
// #72: the 总管 FAB moved to the route (board-page.tsx) so the chief
// drawer/settings overlays sit beside it in one place.
import { useI18n } from '../i18n/provider.js';
import { Plus } from '../icons/index.js';
import { Button } from '../ui/button.js';
import { COLUMNS, sortColumnTodos } from './columns.js';
import { DRAG_THRESHOLD_PX, moveTodo } from './dnd.js';
import { SortableCard } from './sortable-card.js';
import { TodoCard } from './todo-card.js';
import './board.css';

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

/** #351: 待处理 carries no dropPhase — cross-column gestures into it get no
 *  highlight, no live preview and no commit (gate/failed are system states);
 *  reordering inside the column is unaffected. */
function acceptsDrop(columnId: string | null): boolean {
  if (columnId == null) return false;
  return COLUMNS.find((c) => c.id === columnId)?.dropPhase != null;
}

interface BoardProps {
  fixture: FixtureSet;
  /** #66: opens the new-task dialog from the topbar `+ 任务` button. */
  onNewTask?: () => void;
  /** Card callbacks (issue #68): the page owns the modal overlays. */
  onAction?: (todo: TodoRecord) => void;
  onBranch?: (todo: TodoRecord) => void;
  /** #73: committed drag drop — the page owns the todo list state. */
  onReorder?: (next: TodoRecord[]) => void;
  /** #114: the notification-permission strip between topbar and columns
   *  (r2 §1.3). The route owns the permission state and passes the
   *  rendered banner only while it should show. */
  banner?: ReactNode;
}

export function BoardSurface({
  fixture,
  onNewTask,
  onAction,
  onBranch,
  onReorder,
  banner,
}: BoardProps) {
  const { t } = useI18n();
  const [view, setView] = useState<ColumnView | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropColumnId, setDropColumnId] = useState<string | null>(null);
  // #351: cards went fluid-width with the even grid, so the DragOverlay
  // copies the source card's measured width (fixed-width columns used to
  // size it implicitly through the 262px card rule)
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  // changelog 2026-09-12: the drag affordance is desktop-web only
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: DRAG_THRESHOLD_PX },
    }),
  );
  const desktop =
    typeof window === 'undefined' ||
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const sweep = useCallback(() => {
    document.body.classList.remove('board-dragging');
    // changelog 2026-09-14: the highlight is swept again on teardown
    window.getSelection()?.removeAllRanges();
  }, []);

  const onDragStart = (event: DragStartEvent) => {
    setView(deriveView(fixture.todos));
    const id = String(event.active.id);
    setDragId(id);
    setDragWidth(
      document.querySelector(`.todo-card[data-todo-id="${id}"]`)?.getBoundingClientRect().width ??
        null,
    );
    document.body.classList.add('board-dragging');
    window.getSelection()?.removeAllRanges();
  };

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    const overColumnId =
      over == null
        ? null
        : COLUMN_IDS.has(String(over.id))
          ? String(over.id)
          : columnOf(view ?? {}, String(over.id));
    setDropColumnId(acceptsDrop(overColumnId) ? overColumnId : null);
    if (over == null) return;
    const overId = String(over.id);
    setView((prev) => {
      if (prev == null) return prev;
      const from = columnOf(prev, String(active.id));
      const to = COLUMN_IDS.has(overId) ? overId : columnOf(prev, overId);
      if (from == null || to == null || from === to) return prev;
      // 待处理无落点（#351）：live 预览也不进该列，松手即回源列
      if (!acceptsDrop(to)) return prev;
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
    setDragWidth(null);
    sweep();
    if (live == null || over == null || onReorder == null) return;
    const overId = String(over.id);
    // 待处理无落点（#351）：跨列松手在该列 = 不提交；列内重排照常落位
    const overColumnId = COLUMN_IDS.has(overId) ? overId : columnOf(live, overId);
    if (
      overColumnId != null &&
      !acceptsDrop(overColumnId) &&
      columnOf(live, String(active.id)) !== overColumnId
    ) {
      return;
    }
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
    setDragWidth(null);
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
    <div className={banner == null ? 'board-main' : 'board-main board-main--banner'}>
      <header className="board-topbar">
        <div className="board-topbar-title">{t('工作台')}</div>
        <div className="board-topbar-actions">
          {/* A3 收编：Button text 变体（compact 档）。board-new-task 是
              e2e 钉死的选择器别名，经 className 透传保留；59.5 宽 /
              11px 图标缝 / 14px 字号是原语表达不了的 per-face 实测值，
              留在 board.css。 */}
          <Button variant="text" size="compact" className="board-new-task" onClick={onNewTask}>
            <Plus width={13} height={13} />
            {t('任务')}
          </Button>
        </div>
      </header>

      {banner}

      <DndContext
        sensors={desktop ? sensors : []}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div className="board-scroller">
          {COLUMNS.map((column) => {
            const todos = viewTodos(column.id);
            return (
              <section
                key={column.id}
                className="board-column"
                aria-label={t(column.name)}
                data-column={column.id}
                data-drop={dropColumnId === column.id ? 'true' : undefined}
              >
                <header className="board-column-header">
                  <span className="board-column-dot" style={{ background: column.dot }} />
                  <span className="board-column-name">{t(column.name)}</span>
                  {/* count always renders, `0` included (r2 §4.1 计数 0/1;
                  r7 02/01b: digit present on empty columns, x = name+9) */}
                  <span className="board-column-count">{todos.length}</span>
                  {column.label && <span className="board-column-label">{t(column.label)}</span>}
                </header>
                <ColumnList columnId={column.id} empty={t(column.empty)} count={todos.length}>
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
                        projectName={fixture.projectNames?.[todo.projectId]}
                      />
                    ))}
                  </SortableContext>
                </ColumnList>
              </section>
            );
          })}
        </div>
        {/* #391: default drop animation — the overlay glides to the landing
            slot (250ms ease) instead of snapping out on pointer up */}
        <DragOverlay>
          {dragged != null && (
            <div
              className="board-drag-overlay"
              style={dragWidth == null ? undefined : { width: dragWidth }}
            >
              <TodoCard
                todo={dragged}
                now={fixture.now}
                projectName={fixture.projectNames?.[dragged.projectId]}
              />
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
