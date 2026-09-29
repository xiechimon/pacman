// Board surface (issue #54): topbar + horizontal 6-column scroller + chief
// FAB. Geometry from the r7 captures: scroller padding 12/17/13, column
// pitch 292 (278 body + 14 gap), radius 10, header 37 with dot/name/count,
// empty-state copy centered.
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
// #414 (shadcn 试点): 视觉层切 shadcn 组件 + B（neutral）token——列容器
// bg-column（shadcn.css 补位档）、卡片见 todo-card.tsx、按钮走
// components/ui/button。列几何/别名/data-* 钩子/dnd 逻辑全部原位；
// 阶段点语义色（column.dot）不随 B 换。

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
import { Button } from '../components/ui/button.js';
import type { FixtureSet, TodoRecord } from '../fixtures/records.js';
// #72: the 总管 FAB moved to the route (board-page.tsx) so the chief
// drawer/settings overlays sit beside it in one place.
import { useI18n } from '../i18n/provider.js';
import { Plus, UnfoldVertical } from '../icons/index.js';
import { COLUMNS, sortColumnTodos } from './columns.js';
import { DRAG_THRESHOLD_PX, moveTodo } from './dnd.js';
import { SortableCard } from './sortable-card.js';
import { TodoCard } from './todo-card.js';
import './board.css';

/** sessionStorage key for the board scroller's scrollLeft (#58 back-nav
 *  restore). [推断] key shape — the official key is unobservable; collision
 *  with a future real key is harmless (worst case: a stale offset). */
const BOARD_SCROLL_KEY = 'pacman.board-scroll-left';

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

/** #147: column-collapse persistence key ([推断] — r2 §4 / the 01d capture
 *  observed the collapse itself but never its storage key; brand slot in
 *  the same shape as the sidebar collapse keys, registered in the shared
 *  client-state table). Value = comma-joined column ids, empty = all open. */
const BOARD_COLLAPSED_COLUMNS_KEY = 'pacman.boardCollapsedColumns';

function readCollapsedColumns(storage: Storage): string[] {
  const stored = storage.getItem(BOARD_COLLAPSED_COLUMNS_KEY);
  if (stored == null) return [];
  // unknown ids (a retired column) drop out so a stale value can never
  // collapse a column that no longer exists
  return stored.split(',').filter((id) => COLUMN_IDS.has(id));
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
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<ColumnView | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropColumnId, setDropColumnId] = useState<string | null>(null);
  // #147: the six column collapses persist like the scroll offset; a
  // collapsed column renders as the narrow strip (r2 §4, 01d capture) and
  // carries no drop target, so cards can't land in a hidden list.
  const [collapsedColumns, setCollapsedColumns] = useState<string[]>(() =>
    readCollapsedColumns(localStorage),
  );
  const toggleColumn = useCallback((id: string) => {
    setCollapsedColumns((prev) => {
      const next = prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id];
      localStorage.setItem(BOARD_COLLAPSED_COLUMNS_KEY, next.join(','));
      return next;
    });
  }, []);
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
  // board jump. Fresh browser contexts carry an empty sessionStorage, so
  // this is a no-op there.
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
    <div
      className={`board-main relative flex min-w-0 flex-1 flex-col bg-background ${banner == null ? '' : 'board-main--banner'}`}
    >
      <header className="board-topbar relative flex h-11 flex-none items-center border-b border-border">
        <div className="board-topbar-title pointer-events-none absolute inset-x-0 text-center text-sm leading-[22px] font-medium text-foreground">
          {t('看板')}
        </div>
        <div className="board-topbar-actions ml-auto flex items-center pr-3">
          {/* board-new-task 是 e2e 钉死的选择器别名（className 透传保留）。
              #414: text 变体 → B 面 default（neutral 实底）；h-7 = 旧 compact
              28px 档。 */}
          <Button
            variant="default"
            size="sm"
            className="board-new-task h-7 gap-1.5 px-2.5 text-sm"
            onClick={onNewTask}
          >
            <Plus width={13} height={13} className="size-[13px]" />
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
        <div
          className={`board-scroller absolute inset-x-0 bottom-0 flex gap-3.5 overflow-x-auto overflow-y-hidden bg-background px-[17px] pt-3 pb-[13px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            banner == null ? 'top-11' : 'top-[121px]'
          }`}
          ref={scrollerRef}
          onScroll={(e) =>
            sessionStorage.setItem(BOARD_SCROLL_KEY, String(e.currentTarget.scrollLeft))
          }
        >
          {COLUMNS.map((column) => {
            const todos = viewTodos(column.id);
            const collapsed = collapsedColumns.includes(column.id);
            return (
              <section
                key={column.id}
                className={`board-column relative flex h-full flex-none flex-col rounded-xl border border-border bg-column ${
                  collapsed ? 'board-column--collapsed w-10' : 'w-[278px]'
                }`}
                aria-label={t(column.name)}
                data-column={column.id}
                data-collapsed={collapsed ? 'true' : undefined}
                data-drop={dropColumnId === column.id ? 'true' : undefined}
              >
                {collapsed ? (
                  // 01d: the collapse keeps the column box (top border,
                  // radius, fill) as a narrow strip — dot on top, live
                  // count under it; the strip itself is the expand trigger
                  <button
                    type="button"
                    className="board-column-strip flex h-full w-full cursor-pointer flex-col items-center border-none bg-transparent pt-[13.5px]"
                    // same aria convention as the header collapse button
                    // (r7 icons.json `aria:待开始` ×6)
                    aria-label={t(column.name)}
                    aria-expanded={false}
                    onClick={() => toggleColumn(column.id)}
                  >
                    <span
                      className="board-column-dot size-[7px] flex-none rounded-full"
                      style={{ background: column.dot }}
                    />
                    <span className="board-column-count mt-2 text-xs leading-4 text-muted-foreground/70">
                      {todos.length}
                    </span>
                  </button>
                ) : (
                  <>
                    <header className="board-column-header flex h-[37px] flex-none items-center px-[13px] pt-[3px]">
                      <span
                        className="board-column-dot size-[7px] flex-none rounded-full"
                        style={{ background: column.dot }}
                      />
                      <span className="board-column-name ml-2 text-xs leading-4 text-muted-foreground">
                        {t(column.name)}
                      </span>
                      {/* count always renders, `0` included (r2 §4.1 计数 0/1;
                      r7 02/01b: digit present on empty columns, x = name+9) */}
                      <span className="board-column-count ml-[9px] text-xs leading-4 text-muted-foreground/70">
                        {todos.length}
                      </span>
                      {column.label && (
                        <span className="board-column-label ml-2 text-xs leading-4 text-muted-foreground">
                          {t(column.label)}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="board-column-collapse mr-[-3.5px] ml-auto size-[25px] text-muted-foreground"
                        // aria-label = column name, r7 icons.json `aria:待开始` ×6
                        aria-label={t(column.name)}
                        aria-expanded={true}
                        onClick={() => toggleColumn(column.id)}
                      >
                        <UnfoldVertical className="size-[13px]" />
                      </Button>
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
                  </>
                )}
              </section>
            );
          })}
        </div>
        {/* #391: default drop animation — the overlay glides to the landing
            slot (250ms ease) instead of snapping out on pointer up; lift
            shadow = board.css 的 .board-drag-overlay 规则 */}
        <DragOverlay>
          {dragged != null && (
            <div className="board-drag-overlay">
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
    <div
      className="board-column-list relative flex min-h-0 flex-1 flex-col gap-2 px-[7.25px]"
      ref={setNodeRef}
      data-column-list={columnId}
    >
      {children}
      {count === 0 && (
        <div className="board-column-empty absolute inset-0 flex -translate-y-3 items-center justify-center text-xs leading-4 text-muted-foreground">
          {empty}
        </div>
      )}
    </div>
  );
}
