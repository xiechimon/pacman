// Board drag & drop commit core (issue #73). The gesture itself rides the
// locked stack (01-stack-v2 §4.1: @dnd-kit/core + sortable); what a settled
// drop DOES to phase/order is pure here so it stays testable without a DOM.
//
// Drop semantics: onboarding P2 (r3 §3.10) — 「在桌面端可将卡片直接拖拽至目标列」
// = manual phase change; the card lands wherever the column fold puts its
// new phase. Within a column the drop is a pure reorder, persisted as
// `orderIndex` (02 §6.2 field, 01 §4.1 列内 orderIndex 排序). #351: 待处理
// carries no dropPhase — a cross-column drop into it commits nothing
// (gate/failed are system states, manual entry has no semantics), while
// reordering inside the column still lands.
import type { TodoRecord } from '../fixtures/records.js';
import { type BoardColumnDef, COLUMNS, sortColumnTodos } from './columns.js';

/** Pointer travel needed to tell a drag from a card click (CSS px) — the
 *  PointerSensor activation constraint; clicks keep navigating (r2 §4.2). */
export const DRAG_THRESHOLD_PX = 5;

export interface DropTarget {
  columnId: string;
  /** Final position inside the target column's view, dragged card excluded. */
  index: number;
}

/**
 * Commit a drop: reorder within the target column view, and when the column
 * changes, rewrite the phase to the column's canon (BoardColumnDef.dropPhase)
 * with a fresh phaseAt so the in-column relative time restarts. A column
 * without a dropPhase (#351: 待处理) rejects cross-column drops outright —
 * same-column reorders there still commit. Every column's view order is
 * written back as sequential `orderIndex`.
 */
export function moveTodo(
  todos: TodoRecord[],
  todoId: string,
  target: DropTarget,
  now: number,
): TodoRecord[] {
  const moved = todos.find((t) => t.id === todoId);
  if (moved == null) return todos;
  const column = COLUMNS.find((c) => c.id === target.columnId);
  if (column == null) return todos;
  const sourceColumn = COLUMNS.find((c) => c.accepts(moved));
  const crossed = sourceColumn?.id !== column.id;
  let placed = moved;
  if (crossed) {
    // 待处理无落点（#351）：跨列拖入无语义，原样返回；列内重排（未跨列）不受影响
    const dropPhase = column.dropPhase;
    if (dropPhase == null) return todos;
    placed = { ...moved, phase: dropPhase, phaseAt: now };
  }
  const rest = todos.filter((t) => t.id !== todoId);
  const view = rest.filter((t) => column.accepts(t));
  const index = Math.min(target.index, view.length);
  const anchor = index < view.length ? view[index] : null;
  const last = view[view.length - 1];
  let next: TodoRecord[];
  if (anchor != null) {
    const at = rest.indexOf(anchor);
    next = [...rest.slice(0, at), placed, ...rest.slice(at)];
  } else if (last != null) {
    const at = rest.indexOf(last);
    next = [...rest.slice(0, at + 1), placed, ...rest.slice(at + 1)];
  } else {
    next = [...rest, placed];
  }
  // 列内 orderIndex 排序 (01 §4.1): the committed view order IS the index
  next = next.map((t) => ({ ...t }));
  for (const col of COLUMNS) {
    next
      .filter((t) => col.accepts(t))
      .forEach((t, i) => {
        t.orderIndex = i;
      });
  }
  return next;
}

/** 筛选面拖拽落点翻译（#403）：筛选激活时拖拽视图是列的子集，视图内落点
 *  index 直传给 moveTodo 会被全集列视图错读（隐藏卡占着序位）。翻译规则 =
 *  锚卡映射：落点之后那张可见卡在全集列视图（排除被拖卡）中的位次；落在
 *  可见末尾 = 跟在最后一张可见卡之后（而非全集末尾）。无隐藏卡时与旧直传
 *  `list.indexOf(activeId)` 恒等（dnd.test.ts parity 钉）。
 *  orderedVisibleIds = 落位后的可见列视图（含被拖卡）。 */
export function columnDropIndex(
  column: BoardColumnDef,
  todos: TodoRecord[],
  orderedVisibleIds: string[],
  activeId: string,
): number {
  const rest = sortColumnTodos(column, todos.filter(column.accepts)).filter(
    (t) => t.id !== activeId,
  );
  const pos = orderedVisibleIds.indexOf(activeId);
  const afterId = pos >= 0 ? orderedVisibleIds[pos + 1] : undefined;
  if (afterId != null) {
    const at = rest.findIndex((t) => t.id === afterId);
    if (at >= 0) return at;
  }
  const beforeId = pos > 0 ? orderedVisibleIds[pos - 1] : undefined;
  if (beforeId != null) {
    const at = rest.findIndex((t) => t.id === beforeId);
    if (at >= 0) return at + 1;
  }
  // 可见集只余被拖卡 / 防御（activeId 不在视图）：落全集末尾。
  return rest.length;
}
