// Board column model (issue #54): the 6 kanban columns are the folded view
// of the nine-value phase enum (02-架构平价 §4.1). Column names, dot colors
// and empty-state copy are canon (r2 §4.1, colors re-sampled from r7).
// `review` + awaitingReply folds into 执行中 (r5b §3.15 / r7 01 observed),
// `failed` pins to 执行中 (changelog wording, 02 §4.1); card ordering inside
// a column is not modelled yet — cards render in fixture order.

import type { TodoRecord } from '../fixtures/records.js';

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

/** Phase → primary card action. Waiting-on-user todos get the ghost
 *  回复 button (r3 §3.0 引导 P2 词表 + r5b §3.15). */
export function cardAction(todo: TodoRecord): { kind: 'primary' | 'ghost'; label: string } | null {
  if (todo.awaitingReply === true) return { kind: 'ghost', label: '回复' };
  switch (todo.phase) {
    case 'todo':
    case 'queued':
      return { kind: 'primary', label: '开始' };
    case 'confirm':
      return { kind: 'primary', label: '确认' };
    case 'review':
      return { kind: 'primary', label: '完成' };
    default:
      return null;
  }
}
