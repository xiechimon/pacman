// Board column model (issue #54): the 6 kanban columns are the folded view
// of the nine-value phase enum (02-架构平价 §4.1). Column names, dot colors
// and empty-state copy are canon (r2 §4.1, colors re-sampled from r7).
// `review` + awaitingReply folds into 执行中 (r5b §3.15 / r7 01 observed),
// `failed` pins to 执行中 (changelog wording, 02 §4.1); card ordering inside
// a column is not modelled yet — cards render in fixture order.

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
  /** Which todos land in this column. */
  accepts: (todo: TodoRecord) => boolean;
}

export const COLUMNS: BoardColumnDef[] = [
  {
    id: 'todo',
    name: '待开始',
    dot: 'var(--col-dot-idle)',
    empty: '没有等待开始的任务',
    accepts: (t) => t.phase === 'todo' || t.phase === 'queued',
  },
  {
    id: 'planning',
    name: '规划中',
    dot: 'var(--col-dot-planning)',
    empty: '没有规划中的任务',
    accepts: (t) => t.phase === 'planning',
  },
  {
    id: 'confirm',
    name: '待确认',
    dot: 'var(--col-dot-confirm)',
    empty: '没有等你确认的方案',
    accepts: (t) => t.phase === 'confirm',
  },
  {
    id: 'building',
    name: '执行中',
    dot: 'var(--col-dot-building)',
    empty: '没有执行中的任务',
    accepts: (t) =>
      t.phase === 'building' ||
      t.phase === 'failed' ||
      (t.phase === 'review' && t.awaitingReply === true),
  },
  {
    id: 'review',
    name: '待验收',
    dot: 'var(--col-dot-review)',
    empty: '没有等你验收的任务',
    accepts: (t) => t.phase === 'review' && !t.awaitingReply,
  },
  {
    id: 'done',
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

/** Todos waiting on the user — the 看板 nav badge (r7 02/17 show `1`
 *  while probe #9 sits in 待确认; r8 55/57 show failed todos and
 *  non-waiting review todos counted too, awaiting-reply cards not). */
export function attentionCount(todos: TodoRecord[]): number {
  return todos.filter(
    (t) =>
      t.phase === 'confirm' || t.phase === 'failed' || (t.phase === 'review' && !t.awaitingReply),
  ).length;
}
