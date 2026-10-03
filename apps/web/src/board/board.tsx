// Board surface (issue #54): topbar + 4-column grid + chief FAB. #351:
// the 6-column 278px fixed-pitch scroller became an even 4-column grid
// (repeat(4, minmax(0, 1fr)), gap 14); the #147 column-collapse family and
// the #58 scrollLeft persistence retired with the horizontal scroll they
// served. Header 37 with dot/name/count, empty-state copy centered (r7).
// #692: 列宽单源下限——轨道规则移进 board.css（minmax(var(--board-col-min),
// 1fr)，280px = 参考站 2026-10-03 实测固定节距），⌘J 停靠 / 窄窗放不下时
// 横滚回归且滚动条不再隐藏（旧 240px 开态护栏在 1440 停靠态把第四列裁成
// ~3px 残边、无可滚线索 = #692 病灶）。
// #73→#616→#753: drag & drop rides the locked stack's core piece only
// (01-stack-v2 §4.1: @dnd-kit/core) — the reference product (todos.dev,
// live 实测; matrix re-cut 2026-10-03/04 for #753) has NO in-column
// reordering: siblings never shift during a gesture, an in-column drop
// commits nothing, and the sortable live-preview mirror (#73
// multi-container) retired with it. The gesture is a pure cross-column
// phase vehicle: EVERY card lifts (#753 推翻 2026-10-02 旧测「待处理/已完成
// 不可拖」— compact DragCard clone, 2° tilt), valid targets tint indigo
// per the source-card matrix (columns.ts canDropOnColumn 单源；base 5% /
// hovered 10%，源列与非法对恒素面), and the drop routes by column — 执行中
// hands the todo to the page's start path (#640 直发编排，phase NOT written
// locally；2026-10-04 实测参考站该落位开 开始任务 dialog，差异归后续票),
// 待开始/待处理/已完成 commit the phase silently (dnd.ts moveTodo；待处理 =
// 已完成有变更卡的重开落位，写 review)。Same-column and invalid-pair drops
// do nothing (参考站实测：非法落位 = 静默无操作，overlay 同帧卸载无拒绝动
// 画). Desktop-only like the official (changelog 2026-09-12), so the sensor
// set is empty on coarse pointers.
// #414 (shadcn 试点): 视觉层切 shadcn 组件 + B（neutral）token——网格/列/头
// 部布局走 tailwind 工具类（几何与 #351 的 board.css 规则逐条对齐），按钮走
// components/ui/button；data-* 钩子、类别名锚点、dnd 逻辑全部原位。阶段点
// 语义色（column.dot）不随 B 换。
// #445 顶栏重排 / XMON-57 收敛：左侧 = 生效筛选条（一条一维度，点即清该
// 维度），右侧动作区恰好一钮 = 无底色筛选面板钮（filter-panel.tsx，仓库 +
// 类型两段）；「+ 任务」撤除（与侧栏「新任务」行 + C 热键同 opener，第三
// 入口退役）。任务卡渲染自己的标签 chip（tagsById 解析图 → cardTag，渲染
// 上限 1）。

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
import { type ReactNode, useCallback, useState } from 'react';
import { Button } from '../components/ui/button.js';
import type { TagChipData } from '../components/ui/tag-chip.js';
import type { FixtureSet, TodoRecord } from '../fixtures/records.js';
// #72: the 总管 FAB moved to the route (board-page.tsx) so the chief
// drawer/settings overlays sit beside it in one place.
import { useI18n } from '../i18n/provider.js';
import { COLUMNS, canDropOnColumn, sortColumnTodos } from './columns.js';
import { DRAG_THRESHOLD_PX } from './dnd.js';
import { DragCard } from './drag-card.js';
import { DraggableCard } from './draggable-card.js';
import { type FilterChip, FilterChips, type FilterDimension, FilterPanel } from './filter-panel.js';
import { cardTag } from './tag-filter.js';
import './board.css';

/** #403 建轴 / #445 双轴化：看板筛选面——board-page 持有 URL 态与数据源，
 *  本面只消费现成谓词与回调（fixture/live 分支不渗进渲染层）。命中判定与
 *  URL 规范化单源在 repo-filter.tsx / tag-filter.tsx，此处不写第二份。 */
export interface BoardFilters {
  /** XMON-57 统一筛选面板的两个维度（仓库 / 类型）。恒两段——作用域里没有
   *  可选项时该段渲染空态行而非消失，面板形状跨场景稳定。 */
  dimensions: readonly FilterDimension[];
  /** 顶栏左侧生效筛选条：一条一维度，点即清该维度；空数组 = 无条可摘。 */
  chips: readonly FilterChip[];
  /** 两轴选中值总数（触发钮角标：收起态也读得出筛选在生效）。 */
  totalSelected: number;
  /** true = 任一轴收窄生效（类型轴 live 首载未完时不激活，防 tagged 卡
   *  闪隐；仓库轴无异步依赖恒即态）。驱动空结果态门。 */
  active: boolean;
  /** 组合命中判定（仓库 AND 类型；谓词各自单源）。 */
  matches: (todo: TodoRecord) => boolean;
  /** 板级空结果态的清除钮 = 双轴一起复位。 */
  onClear: () => void;
  /** 空结果态里的生效筛选具名（「卡是被筛选藏起来的，不是没有」）。 */
  summary: string;
}

interface BoardProps {
  fixture: FixtureSet;
  /** Card callbacks (issue #68): the page owns the modal overlays. */
  onAction?: (todo: TodoRecord) => void;
  onBranch?: (todo: TodoRecord) => void;
  /** #616: silent phase-commit drop (待开始/已完成 targets) — the page owns
   *  the write path (fixture 本地集 / live 乐观 PATCH)。 */
  onPhaseDrop?: (todo: TodoRecord, columnId: string) => void;
  /** #616: 执行中 drop = 开始意图——page 开 开始任务 dialog（#318 统一面），
   *  确认前相位不写（参考站 2026-10-02 实测：dialog 是落位与提交之间的闸）。 */
  onStartIntent?: (todo: TodoRecord) => void;
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
  onPhaseDrop,
  onStartIntent,
  banner,
  filters,
  tagsById,
}: BoardProps) {
  const { t } = useI18n();
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

  // #403 筛选面（#445 双轴化）：渲染视图消费收窄后的可见集；落位提交走全集
  // （page 侧 moveTodo）——#616 后手势不产生列内位次，锚卡翻译随
  // columnDropIndex 一并退役。
  const narrow = useCallback(
    (todos: TodoRecord[]) => (filters.active ? todos.filter(filters.matches) : todos),
    [filters.active, filters.matches],
  );
  const visibleTodos = narrow(fixture.todos);
  // 空结果态 = 任一轴收窄生效且收窄后无卡占任何列（closed 不占列，不计入）。
  const showFilterEmpty =
    filters.active && COLUMNS.every((c) => !visibleTodos.some((todo) => c.accepts(todo)));

  const sweep = useCallback(() => {
    document.body.classList.remove('board-dragging');
    // changelog 2026-09-14: the highlight is swept again on teardown
    window.getSelection()?.removeAllRanges();
  }, []);

  const dragged = dragId == null ? null : (fixture.todos.find((t) => t.id === dragId) ?? null);
  // #753：合法目标 = per-source 卡面矩阵（columns.ts canDropOnColumn 单源，
  // 源列排除/同列无操作都在判据内）；#616 落点面不变——卡片不注 droppable，
  // over.id 恒为列 id。
  const isValidDropTarget = (columnId: string | null): boolean =>
    dragged != null && columnId != null && canDropOnColumn(dragged, columnId);

  const onDragStart = (event: DragStartEvent) => {
    setDragId(String(event.active.id));
    document.body.classList.add('board-dragging');
    window.getSelection()?.removeAllRanges();
  };

  const onDragOver = (event: DragOverEvent) => {
    const { over } = event;
    const overColumnId = over == null ? null : String(over.id);
    setDropColumnId(isValidDropTarget(overColumnId) ? overColumnId : null);
  };

  // #616→#753 落位路由（参考站实测）：执行中 = 开始意图（#640 直发编排，
  // 本地不写相位；唯一合法源 = 待开始）；待开始/待处理/已完成 = 静默改相
  // 提交（待处理 = 已完成有变更卡的重开，写 review）；非法对/源列/列外 =
  // 无操作（实测：静默无拒绝动画），overlay 随指针松开同帧卸载（无 drop
  // 动画——dropAnimation={null}）。
  const onDragEnd = (event: DragEndEvent) => {
    const { over } = event;
    const overColumnId = over == null ? null : String(over.id);
    if (dragged != null && isValidDropTarget(overColumnId)) {
      const column = COLUMNS.find((c) => c.id === overColumnId);
      if (column?.startGate === true) onStartIntent?.(dragged);
      else if (overColumnId != null) onPhaseDrop?.(dragged, overColumnId);
    }
    setDragId(null);
    setDropColumnId(null);
    sweep();
  };

  const onDragCancel = () => {
    setDragId(null);
    setDropColumnId(null);
    sweep();
  };

  const viewTodos = (columnId: string): TodoRecord[] => {
    const column = COLUMNS.find((c) => c.id === columnId);
    if (column == null) return [];
    return sortColumnTodos(column, visibleTodos.filter(column.accepts));
  };

  return (
    <div
      className={`board-main relative flex min-w-0 flex-1 flex-col bg-background ${banner == null ? '' : 'board-main--banner'}`}
    >
      <header className="board-topbar relative flex h-11 flex-none items-center border-b border-[var(--border-default)]">
        <div className="board-topbar-title pointer-events-none absolute inset-x-0 text-center text-sm leading-[22px] font-medium text-foreground">
          {t('工作台')}
        </div>
        {/* XMON-57 生效筛选条：顶栏左侧独立容器——不进 board-topbar-actions
            （dead-buttons 钉死右动作区恰好一钮）；标题带 absolute +
            pointer-events-none，hit-test 不拦截条。 */}
        <FilterChips chips={filters.chips} onClearAll={filters.onClear} />
        <div className="board-topbar-actions ml-auto flex items-center pr-3">
          {/* 恰好一钮 = 无底色筛选钮（board-type-filter 是 e2e 钉死的选择器
              别名，语义已从「类型轴」扩到「全轴筛选」，名字按 #411 别名
              优先保留）。「+ 任务」已撤——新建入口 = 侧栏「新任务」行
              （sidebar-new-task）+ C 热键。 */}
          <FilterPanel
            dimensions={filters.dimensions}
            totalSelected={filters.totalSelected}
            onClearAll={filters.onClear}
          />
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
          className={`board-scroller absolute inset-x-0 bottom-0 grid grid-rows-[minmax(0,1fr)] gap-3.5 overflow-x-auto overflow-y-hidden bg-background px-[17px] pt-3 pb-[13px] ${
            banner == null ? 'top-11' : 'top-[121px]'
          }`}
        >
          {/* #403 空结果态（#445 双轴化）：任一轴收窄且零卡 = 板级明示
              文案 + 清除钮（不是四列各背一条误导性列空文案，更不是空白
              看板）；清除 = 双轴一起复位。 */}
          {showFilterEmpty && (
            <div className="board-filter-empty col-span-4 flex h-full flex-col items-center justify-center gap-3">
              <span className="text-sm text-muted-foreground">{t('没有匹配筛选条件的任务')}</span>
              {/* 具名生效筛选：空态要回答「我的卡去哪了」，只说「没有匹配」
                  会读成「这些卡不存在」。 */}
              {filters.summary !== '' && (
                <span className="board-filter-empty-summary text-xs text-muted-foreground">
                  {t('筛选生效：{summary}', { summary: filters.summary })}
                </span>
              )}
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
                  /* #616 两级染色：手势在飞时全部合法目标列戴 base 档
                     （data-drop-valid），指针悬停列升 hover 档（data-drop）。
                     #753：合法集 = 被拖卡的 per-source 矩阵。 */
                  data-drop-valid={isValidDropTarget(column.id) ? 'true' : undefined}
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
                    {/* #753 可拖面（todos.dev 2026-10-03/04 live 重测）：
                        每列的卡都武装传感器——旧「待处理/已完成不可拖」是
                        2026-10-02 旧测误判，已推翻；点击导航由 PointerSensor
                        的 distance 阈值保住（未移动的按压直通卡内链接）。 */}
                    {todos.map((todo) => (
                      <DraggableCard
                        key={todo.id}
                        todo={todo}
                        now={fixture.now}
                        onAction={onAction}
                        onBranch={onBranch}
                        projectName={fixture.projectNames?.[todo.projectId]}
                        tag={tagsById == null ? null : cardTag(todo, tagsById)}
                      />
                    ))}
                  </ColumnList>
                </section>
              );
            })}
        </div>
        {/* #616（对齐 todos.dev 2026-10-02 实测）：
            - dropAnimation={null}——参考站 overlay 随 pointerup 同帧卸载
              （getAnimations 全程为空、无滑翔）；卡片落位由提交数据直接
              呈现。#391 的 250ms glide 是本仓发明，随正典更替退役。
            - style.willChange 留在 dnd-kit 的 fixed wrapper（transform 持
              有者）上：位移由主线程逐 pointermove 提交，无动画提示时
              Chromium 把每个新位置当静态位置重栅格（实测 115-120 个
              RasterTask/手势）；will-change: transform 减半（57-62，n=3）。
              层仅手势期存活，无长驻 GPU 内存代价。参考站内联配方是
              translate+rotate 同一 transform（自建 overlay），这里
              translate 归 wrapper、rotate 归 .board-drag-card——合成同形。
            - overlay 宽度 = 源卡宽（PositionedOverlay 以 activeNodeRect
              设 wrapper 宽度，core 6.3.1；#616 摘除应用层冗余自测）。
            - 抬升面 = 紧凑 DragCard（身份行 + 两行标题），不是板面卡复刻。 */}
        <DragOverlay dropAnimation={null} style={{ willChange: 'transform' }}>
          {dragged != null && (
            <div className="board-drag-overlay">
              <DragCard todo={dragged} projectName={fixture.projectNames?.[dragged.projectId]} />
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
