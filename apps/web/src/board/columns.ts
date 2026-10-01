// Board column model (issues #54 / #351): the 4 kanban columns are the
// folded view of the nine-value phase enum (02-架构平价 §4.1; 6→4 收敛 #351).
// Column names, dot colors and empty-state copy are canon (r2 §4.1, colors
// re-sampled from r7); 待处理 merges the old 待确认/待验收 gate columns plus
// failed — 方案确认、变更验收、失败重试都是等用户处理的事. `review` +
// awaitingReply folds into 待处理 too (r5b §3.15 / r7 01 observed), and the
// pinned group (failed / review-awaiting) rides its top (changelog
// 2026-09-12 pinning, rebound to 待处理 by #351). Card order inside a column
// = manual order from drag drops (#73), pinned group first in 待处理.

import type { Phase } from '@pacman/shared';
import type { TodoRecord } from '../fixtures/records.js';
import { isInFlightPhase, PHASE_UI } from '../phase.js';

export interface BoardColumnDef {
  id: string;
  name: string;
  /** CSS var for the header dot fill. */
  dot: string;
  /** Verbatim empty-state copy (r2 §4.1; 待处理 row = #351). */
  empty: string;
  /** Extra header label, 已完成 only. */
  label?: string;
  /** Phase a cross-column drop writes (issue #73 manual 改相). Absent = the
   *  column is not a drop target (#351: 待处理 — gate/failed are system
   *  states, a manual drop-in carries no semantics). */
  dropPhase?: Phase;
  /** Which todos land in this column. */
  accepts: (todo: TodoRecord) => boolean;
}

/** The pinned group (changelog 2026-09-12: failed / review-awaiting "stays
 *  pinned to the top") — single source for the 待处理 column's accepts()
 *  and its render order (#351: rebound from 执行中 to 待处理). */
export function isPinnedBuilding(todo: TodoRecord): boolean {
  return todo.phase === 'failed' || (todo.phase === 'review' && todo.awaitingReply === true);
}

/** Column view order: pinned group first in 待处理, then the committed
 *  manual order (`orderIndex`, 01 §4.1); Array.sort is stable, so the
 *  all-zero fixture indices keep capture order untouched. */
export function sortColumnTodos(column: BoardColumnDef, todos: TodoRecord[]): TodoRecord[] {
  const pinnedRank = (t: TodoRecord) => (column.id === 'pending' && isPinnedBuilding(t) ? 0 : 1);
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
    id: 'building',
    dropPhase: 'building',
    name: '执行中',
    dot: 'var(--col-dot-building)',
    empty: '没有执行中的任务',
    accepts: (t) => isInFlightPhase(t.phase),
  },
  {
    id: 'pending',
    name: '待处理',
    dot: 'var(--col-dot-confirm)',
    empty: '没有等你处理的任务',
    accepts: (t) => t.phase === 'confirm' || t.phase === 'review' || t.phase === 'failed',
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
 *  in the 已完成 column, so PHASE_UI[done].action must not leak here.
 *  Failed cards read `重试` while the detail header reads `重跑` (r8 §2.2
 *  vs §2.1 — a new instance of the CONTEXT.md two-word-list pattern:
 *  board card copy ≠ detail chip copy). */
export function cardAction(todo: TodoRecord): { kind: 'primary' | 'ghost'; label: string } | null {
  if (todo.awaitingReply === true) return { kind: 'ghost', label: '回复' };
  if (todo.phase === 'done') return null;
  // r8 §2.2 prose reads the card chip as a ghost button, but the 55
  // bitmap samples a solid #4e47dd fill with white ink — pixels win (04 A1)
  if (todo.phase === 'failed') return { kind: 'primary', label: '重试' };
  const label = PHASE_UI[todo.phase].action;
  return label == null ? null : { kind: 'primary', label };
}

/** Todos waiting on the user — the 工作台 nav badge. #351: the badge IS the
 *  待处理 column count, same accepts() predicate as the single source (so
 *  review+awaitingReply cards count too — the old badge skipped them while
 *  the fold parked them in 执行中, r8 55/57). */
export function attentionCount(todos: TodoRecord[]): number {
  const pending = COLUMNS.find((c) => c.id === 'pending');
  return pending == null ? 0 : todos.filter(pending.accepts).length;
}
