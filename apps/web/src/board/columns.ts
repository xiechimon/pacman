// Board column model (issue #54): the 6 kanban columns are the folded view
// of the nine-value phase enum (02-架构平价 §4.1). Column names, dot colors
// and empty-state copy are canon (r2 §4.1, colors re-sampled from r7).
// `review` + awaitingReply folds into 执行中 (r5b §3.15 / r7 01 observed),
// `failed` pins to 执行中 (changelog wording, 02 §4.1). Card order inside a
// column = manual order from drag drops (#73), pinned group first in 执行中
// (changelog 2026-09-12: failed / review-awaiting stay pinned to the top).

import type { Phase } from '@pacman/shared';
import type { TodoRecord } from '../fixtures/records.js';
import { PHASE_UI } from '../phase.js';

export interface BoardColumnDef {
  id: string;
  name: string;
  /** CSS var for the header dot fill. */
  dot: string;
  /** Verbatim empty-state copy (r2 §4.1). */
  empty: string;
  /** Extra header label, 已完成 only. */
  label?: string;
  /** Phase a cross-column drop writes (issue #73 manual 改相). */
  dropPhase: Phase;
  /** Which todos land in this column. */
  accepts: (todo: TodoRecord) => boolean;
}

/** The 执行中 fold's pinned group (changelog 2026-09-12: "stays pinned to
 *  the top of the Building column") — single source for both the column's
 *  accepts() and its render order. */
export function isPinnedBuilding(todo: TodoRecord): boolean {
  return todo.phase === 'failed' || (todo.phase === 'review' && todo.awaitingReply === true);
}

/** Column view order: pinned group first in 执行中, then the committed
 *  manual order (`orderIndex`, 01 §4.1); Array.sort is stable, so the
 *  all-zero fixture indices keep capture order untouched. */
export function sortColumnTodos(column: BoardColumnDef, todos: TodoRecord[]): TodoRecord[] {
  const pinnedRank = (t: TodoRecord) => (column.id === 'building' && isPinnedBuilding(t) ? 0 : 1);
  return [...todos].sort((x, y) => pinnedRank(x) - pinnedRank(y) || x.orderIndex - y.orderIndex);
}

export const COLUMNS: BoardColumnDef[] = [
  {
    id: 'todo',
    dropPhase: 'todo',
    name: '待开始',
    dot: 'var(--col-dot-idle)',
    empty: '没有等待开始的任务',
    accepts: (t) => t.phase === 'todo' || t.phase === 'queued',
  },
  {
    id: 'planning',
    dropPhase: 'planning',
    name: '规划中',
    dot: 'var(--col-dot-planning)',
    empty: '没有规划中的任务',
    accepts: (t) => t.phase === 'planning',
  },
  {
    id: 'confirm',
    dropPhase: 'confirm',
    name: '待确认',
    dot: 'var(--col-dot-confirm)',
    empty: '没有等你确认的方案',
    accepts: (t) => t.phase === 'confirm',
  },
  {
    id: 'building',
    dropPhase: 'building',
    name: '执行中',
    dot: 'var(--col-dot-building)',
    empty: '没有执行中的任务',
    accepts: (t) => t.phase === 'building' || isPinnedBuilding(t),
  },
  {
    id: 'review',
    dropPhase: 'review',
    name: '待验收',
    dot: 'var(--col-dot-review)',
    empty: '没有等你验收的任务',
    accepts: (t) => t.phase === 'review' && !t.awaitingReply,
  },
  {
    id: 'done',
    dropPhase: 'done',
    name: '已完成',
    dot: 'var(--col-dot-done)',
    empty: '最近 7 天没有完成的任务',
    label: '最近 7 天',
    accepts: (t) => t.phase === 'done',
  },
];

/** Phase → primary card action, copy from the shared PHASE_UI table.
 *  Waiting-on-user todos get the ghost 回复 button (r3 §3.0 引导 P2 词表 +
 *  r5b §3.15). Done cards carry no button: 重开 lives only in the detail
 *  header (r7 §3.3) — the 01b/05b board captures show zero indigo pixels
 *  in the 已完成 column, so PHASE_UI[done].action must not leak here. */
export function cardAction(todo: TodoRecord): { kind: 'primary' | 'ghost'; label: string } | null {
  if (todo.awaitingReply === true) return { kind: 'ghost', label: '回复' };
  if (todo.phase === 'done') return null;
  const label = PHASE_UI[todo.phase].action;
  return label == null ? null : { kind: 'primary', label };
}

/** Todos waiting on confirmation — the 看板 nav badge (r7 02/17 show `1`
 *  while probe #9 sits in 待确认). */
export function attentionCount(todos: TodoRecord[]): number {
  return todos.filter((t) => t.phase === 'confirm').length;
}
