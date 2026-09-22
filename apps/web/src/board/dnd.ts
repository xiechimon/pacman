// Board drag & drop commit core (issue #73). The gesture itself rides the
// locked stack (01-stack-v2 §4.1: @dnd-kit/core + sortable); what a settled
// drop DOES to phase/order is pure here so it stays testable without a DOM.
//
// Drop semantics: onboarding P2 (r3 §3.10) — 「在桌面端可将卡片直接拖拽至目标列」
// = manual phase change; the card lands wherever the six-column fold puts
// its new phase (r5b §3.15). Within a column the drop is a pure reorder,
// persisted as `orderIndex` (02 §6.2 field, 01 §4.1 列内 orderIndex 排序).
// Batch drag and the preset-path start dialog (changelog 2026-09-12) are
// follow-ups, registered in the #73 ticket comment.
import type { TodoRecord } from '../fixtures/records.js';
import { COLUMNS } from './columns.js';

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
 * with a fresh phaseAt so the in-column relative time restarts. Dropping on
 * 待验收 clears awaitingReply — otherwise the fold (review+awaitingReply →
 * 执行中) would put the card right back where it came from. Every column's
 * view order is written back as sequential `orderIndex`.
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
  const placed: TodoRecord = crossed
    ? {
        ...moved,
        phase: column.dropPhase,
        phaseAt: now,
        awaitingReply: column.id === 'review' ? false : moved.awaitingReply,
      }
    : moved;
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
