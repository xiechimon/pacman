// Drag overlay face (#616, 对齐 todos.dev 2026-10-02 live 实测): the lifted
// clone is NOT the board card — the reference mounts a purpose-built compact
// card (identity row + 2-line clamped title, no bottom row: agent avatar /
// rel-time / metrics / action button all stay out of the flight face).
// Geometry from the captured overlay DOM: 14px/3px project tile with a 7px
// initial, 11px project name (flex-1, truncated), 10px tabular seq, title at
// text-sm medium leading-snug clamped to 2 lines; padding 10px 12px, gap 6px,
// 8px radius, 1px --border-default, bg --card-bg. The tilt/shadow/opacity
// recipe lives in board.css (.board-drag-card) with its provenance comment.

import { PROJECT_INITIAL, PROJECT_NAME } from '../fixtures/fixtures.js';
import type { TodoRecord } from '../fixtures/records.js';

interface DragCardProps {
  todo: TodoRecord;
  /** M5 live：项目 chip 真名（板面卡同位透传）；缺省 = capture canon 常量。 */
  projectName?: string;
}

export function DragCard({ todo, projectName }: DragCardProps) {
  const name = projectName ?? PROJECT_NAME;
  const initial = projectName ? projectName.charAt(0).toLowerCase() : PROJECT_INITIAL;
  return (
    <div className="board-drag-card" data-todo-id={todo.id}>
      <div className="board-drag-card-row1 flex items-center gap-1.5">
        <span className="project-avatar">{initial}</span>
        <span className="board-drag-card-project min-w-0 flex-1 truncate text-[11px] leading-4 text-muted-foreground">
          {name}
        </span>
        <span className="board-drag-card-seq flex-none text-[10px] leading-4 text-muted-foreground/70 tabular-nums">
          #{todo.seqNum}
        </span>
      </div>
      <div className="board-drag-card-title line-clamp-2 text-sm leading-snug font-medium text-card-foreground">
        {todo.title}
      </div>
    </div>
  );
}
