// Board surface (issue #54): topbar + 4-column grid + chief FAB. #351:
// the 6-column 278px fixed-pitch scroller became an even 4-column grid
// (repeat(4, minmax(0, 1fr)), gap 14); the #147 column-collapse family and
// the #58 scrollLeft persistence retired with the horizontal scroll they
// served. Header 37 with dot/name/count, empty-state copy centered (r7).
// #73: drag & drop rides the locked stack (01-stack-v2 §4.1: @dnd-kit/core
// + sortable). Multi-container pattern: a per-column id list mirrors the
// committed todo set while a gesture is in flight (live preview), and the
// settled drop commits through dnd.ts moveTodo — phase rewrite on column
// change, orderIndex write-back. #351: 待处理 carries no dropPhase — the
// preview never enters it and a drop there commits nothing (same-column
// reorder still lands). Desktop-only like the official (changelog
// 2026-09-12: drag rows appear on desktop web only), so the sensor set is
// empty on coarse pointers.
// #414 (shadcn 试点): 视觉层切 shadcn 组件 + B（neutral）token——网格/列/头
// 部布局走 tailwind 工具类（几何与 #351 的 board.css 规则逐条对齐），按钮走
// components/ui/button；data-* 钩子、类别名锚点、dnd 逻辑全部原位。阶段点
// 语义色（column.dot）不随 B 换。
// #445 顶栏重排：左侧 = 仓库（项目）筛选 chip 组（repo-filter.tsx），右侧
// 动作区恰好一钮 = 无底色类型过滤 popover 钮（tag-filter.tsx）；「+ 任务」
// 撤除（与侧栏「新任务」行 + N 热键同 opener，第三入口退役）。任务卡渲染
// 自己的标签 chip（tagsById 解析图 → cardTag，渲染上限 1）。

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
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Button } from '../components/ui/button.js';
import type { TagChipData } from '../components/ui/tag-chip.js';
import type { FixtureSet, TodoRecord } from '../fixtures/records.js';
// #72: the 总管 FAB moved to the route (board-page.tsx) so the chief
// drawer/settings overlays sit beside it in one place.
import { useI18n } from '../i18n/provider.js';
import { COLUMNS, sortColumnTodos } from './columns.js';
import { columnDropIndex, DRAG_THRESHOLD_PX, moveTodo } from './dnd.js';
import { RepoFilterBar, type RepoOption } from './repo-filter.js';
import { SortableCard } from './sortable-card.js';
import { cardTag, TypeFilterButton } from './tag-filter.js';
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

/** Settled-drop commit math, pure so onDragEnd keeps its ordering legible:
 *  #351 待处理 rejection, landing column = wherever the live preview left the
 *  card, same-column reorder via arrayMove, #403 visible-view → full-set rank
 *  through columnDropIndex. null = commit nothing. */
function commitDrop(
  live: ColumnView,
  todos: TodoRecord[],
  activeId: string,
  overId: string,
  now: number,
): TodoRecord[] | null {
  // 待处理无落点（#351）：跨列松手在该列 = 不提交；列内重排照常落位
  const overColumnId = COLUMN_IDS.has(overId) ? overId : columnOf(live, overId);
  if (
    overColumnId != null &&
    !acceptsDrop(overColumnId) &&
    columnOf(live, activeId) !== overColumnId
  ) {
    return null;
  }
  const columnId = columnOf(live, activeId) ?? (COLUMN_IDS.has(overId) ? overId : null);
  if (columnId == null) return null;
  const liveList = live[columnId];
  if (liveList == null) return null;
  const from = liveList.indexOf(activeId);
  const overIndex = liveList.indexOf(overId);
  const list =
    overId !== activeId && overIndex >= 0 ? arrayMove(liveList, from, overIndex) : liveList;
  // #403：liveList 是筛选后的可见视图——落点经 columnDropIndex 锚卡翻译
  // 回全集列视图位次再落（隐藏卡占序，直传可见 index 会插错位）。
  const column = COLUMNS.find((c) => c.id === columnId);
  if (column == null) return null;
  return moveTodo(
    todos,
    activeId,
    { columnId, index: columnDropIndex(column, todos, list, activeId) },
    now,
  );
}

/** #403 建轴 / #445 双轴化：看板筛选面——board-page 持有 URL 态与数据源，
 *  本面只消费现成谓词与回调（fixture/live 分支不渗进渲染层）。命中判定与
 *  URL 规范化单源在 repo-filter.tsx / tag-filter.tsx，此处不写第二份。 */
export interface BoardFilters {
  /** 仓库轴（#445）：absent = 无项目数据源，chip 组不渲染（旧 fixture
   *  场景保持 r7 基线零漂移）。 */
  repo?: {
    options: RepoOption[];
    /** 选中项目 id（字典序规范序）；空 = 全部态。 */
    selected: string[];
    onToggle: (id: string) => void;
    /** 「全部」复位 = 只清仓库轴。 */
    onClear: () => void;
  };
  /** 类型轴：固定词表 popover（恒渲染——右动作区「恰好一钮」钉扎）。 */
  type: {
    /** 选中词表名（FIXED_TAGS 规范序）；空 = 无收窄。 */
    selected: string[];
    onToggle: (name: string) => void;
  };
  /** true = 任一轴收窄生效（类型轴 live 首载未完时不激活，防 tagged 卡
   *  闪隐；仓库轴无异步依赖恒即态）。驱动空结果态门。 */
  active: boolean;
  /** 组合命中判定（仓库 AND 类型；谓词各自单源）。 */
  matches: (todo: TodoRecord) => boolean;
  /** 板级空结果态的清除钮 = 双轴一起复位。 */
  onClear: () => void;
}

interface BoardProps {
  fixture: FixtureSet;
  /** Card callbacks (issue #68): the page owns the modal overlays. */
  onAction?: (todo: TodoRecord) => void;
  onBranch?: (todo: TodoRecord) => void;
  /** #73: committed drag drop — the page owns the todo list state. */
  onReorder?: (next: TodoRecord[]) => void;
  /** #114: the notification-permission strip between topbar and columns
   *  (r2 §1.3). The route owns the permission state and passes the
   *  rendered banner only while it should show. */
  banner?: ReactNode;
  /** #445: 双轴筛选面（仓库 chip 组 + 类型 popover 钮）。 */
  filters: BoardFilters;
  /** #445: 卡片标签解析图（tagId → TagChipData；live = 全项目并查，
   *  fixture = scenario.tags）。absent/空图 = 卡不渲染标签。 */
  tagsById?: ReadonlyMap<string, TagChipData>;
}

export function BoardSurface({
  fixture,
  onAction,
  onBranch,
  onReorder,
  banner,
  filters,
  tagsById,
}: BoardProps) {
  const { t } = useI18n();
  const [view, setView] = useState<ColumnView | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropColumnId, setDropColumnId] = useState<string | null>(null);
  // #351: cards went fluid-width with the even grid, so the DragOverlay
  // copies the source card's measured width (fixed-width columns used to
  // size it implicitly through the 262px card rule)
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  /** Drop settle: the retained live preview (view) of an in-flight commit,
   *  cleared by the effect below once the rendered data carries the landing. */
  const [settling, setSettling] = useState<{ id: string; columnId: string } | null>(null);
  // changelog 2026-09-12: the drag affordance is desktop-web only
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: DRAG_THRESHOLD_PX },
    }),
  );
  const desktop =
    typeof window === 'undefined' ||
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // #403 筛选面（#445 双轴化）：渲染/拖拽视图消费收窄后的可见集；moveTodo
  // 落位仍走全集（fixture.todos）+ columnDropIndex 锚卡翻译——隐藏卡的
  // orderIndex 序位不被筛选视图的重排错读。
  const visibleTodos = filters.active ? fixture.todos.filter(filters.matches) : fixture.todos;
  // 空结果态 = 任一轴收窄生效且收窄后无卡占任何列（closed 不占列，不计入）。
  const showFilterEmpty =
    filters.active && COLUMNS.every((c) => !visibleTodos.some((todo) => c.accepts(todo)));

  const sweep = useCallback(() => {
    document.body.classList.remove('board-dragging');
    // changelog 2026-09-14: the highlight is swept again on teardown
    window.getSelection()?.removeAllRanges();
  }, []);

  const onDragStart = (event: DragStartEvent) => {
    setSettling(null);
    setView(deriveView(visibleTodos));
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
    let retained = false;
    if (live != null && over != null && onReorder != null) {
      const next = commitDrop(live, fixture.todos, String(active.id), String(over.id), fixture.now);
      if (next != null) {
        onReorder(next);
        // 保留 live 预览直到数据追上提交：预览序即提交序（probe dnd-live
        // D 钉证），留住它 = 落位布局留在屏上——既无源列陈旧帧，dnd-kit 量
        // drop-glide 终点时也量到落点槽。此处若清 view，live 面会拿尚未通知
        // 的 query cache 渲染一帧（TanStack observer 通知晚本批一个 pass）：
        // 卡画回源列、glide 跟着飞回——用户视角的「弹回去」。
        const overId = String(over.id);
        const columnId =
          columnOf(live, String(active.id)) ?? (COLUMN_IDS.has(overId) ? overId : null);
        if (columnId != null) {
          setSettling({ id: String(active.id), columnId });
          retained = true;
        }
      }
    }
    if (!retained) setView(null);
    setDragId(null);
    setDropColumnId(null);
    setDragWidth(null);
    sweep();
  };

  // Drop settle teardown: clear the retained preview once the rendered data
  // carries the landing (fixture: same tick; live: optimistic write or the
  // PATCH-round refetch). The deadline covers a failed commit — data never
  // catches up, so the gesture tears down to server truth instead of freezing
  // the preview (same end state as the pre-settle onError invalidate).
  useEffect(() => {
    if (settling == null) return;
    const card = fixture.todos.find((todo) => todo.id === settling.id);
    const dataColumn = card == null ? null : (COLUMNS.find((c) => c.accepts(card))?.id ?? null);
    if (dataColumn === settling.columnId) {
      setSettling(null);
      setView(null);
      return;
    }
    const timer = setTimeout(() => {
      setSettling(null);
      setView(null);
    }, 1200);
    return () => clearTimeout(timer);
  }, [settling, fixture.todos]);

  const onDragCancel = () => {
    setSettling(null);
    setView(null);
    setDragId(null);
    setDropColumnId(null);
    setDragWidth(null);
    sweep();
  };

  const viewTodos = (columnId: string): TodoRecord[] => {
    const column = COLUMNS.find((c) => c.id === columnId);
    if (column == null) return [];
    if (view == null) return sortColumnTodos(column, visibleTodos.filter(column.accepts));
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
      <header className="board-topbar relative flex h-11 flex-none items-center border-b border-[var(--border-default)]">
        <div className="board-topbar-title pointer-events-none absolute inset-x-0 text-center text-sm leading-[22px] font-medium text-foreground">
          {t('工作台')}
        </div>
        {/* #445 仓库筛选：顶栏左侧独立容器——不进 board-topbar-actions
            （dead-buttons 钉死右动作区恰好一钮）；标题带 absolute +
            pointer-events-none，hit-test 不拦截 chip。 */}
        {filters.repo != null && (
          <RepoFilterBar
            options={filters.repo.options}
            selected={filters.repo.selected}
            onToggle={filters.repo.onToggle}
            onClear={filters.repo.onClear}
          />
        )}
        <div className="board-topbar-actions ml-auto flex items-center pr-3">
          {/* #445：恰好一钮 = 无底色类型过滤钮（board-type-filter 是 e2e
              钉死的选择器别名）。「+ 任务」已撤——新建入口 = 侧栏
              「新任务」行（sidebar-new-task）+ N 热键。 */}
          <TypeFilterButton selected={filters.type.selected} onToggle={filters.type.onToggle} />
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
          className={`board-scroller absolute inset-x-0 bottom-0 grid grid-cols-4 grid-rows-[minmax(0,1fr)] gap-3.5 overflow-x-auto overflow-y-hidden bg-background px-[17px] pt-3 pb-[13px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            banner == null ? 'top-11' : 'top-[121px]'
          }`}
        >
          {/* #403 空结果态（#445 双轴化）：任一轴收窄且零卡 = 板级明示
              文案 + 清除钮（不是四列各背一条误导性列空文案，更不是空白
              看板）；清除 = 双轴一起复位。 */}
          {showFilterEmpty && (
            <div className="board-filter-empty col-span-4 flex h-full flex-col items-center justify-center gap-3">
              <span className="text-sm text-muted-foreground">{t('没有匹配筛选条件的任务')}</span>
              <Button
                variant="outline"
                size="sm"
                className="board-filter-clear"
                onClick={filters.onClear}
              >
                {t('清除筛选')}
              </Button>
            </div>
          )}
          {!showFilterEmpty &&
            COLUMNS.map((column) => {
              const todos = viewTodos(column.id);
              return (
                <section
                  key={column.id}
                  className="board-column relative flex h-full flex-col rounded-[12px] border border-border bg-column"
                  aria-label={t(column.name)}
                  data-column={column.id}
                  data-drop={dropColumnId === column.id ? 'true' : undefined}
                >
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
                          tag={tagsById == null ? null : cardTag(todo, tagsById)}
                        />
                      ))}
                    </SortableContext>
                  </ColumnList>
                </section>
              );
            })}
        </div>
        {/* #391: default drop animation — the overlay glides to the landing
            slot (250ms ease) instead of snapping out on pointer up; lift
            shadow = board.css 的 .board-drag-overlay 规则 */}
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
                tag={tagsById == null ? null : cardTag(dragged, tagsById)}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

/** The list area doubles as the column's drop target so empty columns
 *  accept drops (useDroppable id = column id). #504: the list is the
 *  column's scroll surface — the 37px header stays fixed while cards
 *  overflow (overflow-y rides the same native-scrollbar convention as
 *  .secondary-body / .res-body). XMON-42: the 1px block padding is load
 *  bearing — a scroll container clips at its padding box while the card's
 *  ring is a box-shadow drawn outside the border box, so with a zero block
 *  inset the topmost card (and, scrolled to the end, the bottommost one)
 *  loses that edge; the inline axis already carries 7.25px of inset. */
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
      className="board-column-list relative flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-[7.25px] py-px"
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
