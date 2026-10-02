// Board drag & drop commit core (issue #73, re-cut by #616). The gesture
// itself rides the locked stack (01-stack-v2 §4.1: @dnd-kit/core); what a
// settled drop DOES to phase/order is pure here so it stays testable
// without a DOM.
//
// Drop semantics (#616, todos.dev 2026-10-02 live 实测): the drag is a pure
// cross-column phase vehicle — 「在桌面端可将卡片直接拖拽至目标列」= manual
// phase change, landing at the END of the target column's view. The
// reference has no in-column reordering at all (siblings never shift
// mid-gesture; a same-column drop commits nothing), so the #73/#403 reorder
// index math and its filter-view anchor translation retired — moveTodo now
// answers same-column calls with the identity. `orderIndex` write-back
// stays: every column's committed view order is re-sequenced so the manual
// order remains the persisted truth (02 §6.2). #351: 待处理 carries no
// dropPhase — a cross-column drop into it commits nothing (gate/failed are
// system states). 执行中 does not route through here at all — its drop
// opens the 开始任务 dialog and only a confirmed start writes the phase
// (columns.ts startGate).
import type { TodoRecord } from '../fixtures/records.js';
import { COLUMNS } from './columns.js';

/** Pointer travel needed to tell a drag from a card click (CSS px) — the
 *  PointerSensor activation constraint; clicks keep navigating (r2 §4.2). */
export const DRAG_THRESHOLD_PX = 5;

/**
 * Commit a cross-column drop: rewrite the phase to the target column's
 * canon (BoardColumnDef.dropPhase) with a fresh phaseAt so the in-column
 * relative time restarts, landing the card at the END of the target
 * column's view (#616: the reference keeps no manual in-column rank —
 * done 列是时间序，改相卡落尾即「最新」). Identity returns: unknown
 * todo/column, same-column (no in-column semantics), and 待处理 (#351 —
 * no dropPhase, manual entry carries no meaning). Every column's view
 * order is written back as sequential `orderIndex`.
 */
export function moveTodo(
  todos: TodoRecord[],
  todoId: string,
  columnId: string,
  now: number,
): TodoRecord[] {
  const moved = todos.find((t) => t.id === todoId);
  if (moved == null) return todos;
  const column = COLUMNS.find((c) => c.id === columnId);
  if (column == null) return todos;
  const sourceColumn = COLUMNS.find((c) => c.accepts(moved));
  if (sourceColumn?.id === column.id) return todos;
  // 待处理无落点（#351）：跨列拖入无语义，原样返回
  const dropPhase = column.dropPhase;
  if (dropPhase == null) return todos;
  const placed = { ...moved, phase: dropPhase, phaseAt: now };
  const rest = todos.filter((t) => t.id !== todoId);
  const view = rest.filter((t) => column.accepts(t));
  const last = view[view.length - 1];
  let next: TodoRecord[];
  if (last != null) {
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
