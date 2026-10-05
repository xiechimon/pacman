// Drag overlay face (#616, 对齐 todos.dev 2026-10-02 live 实测): the lifted
// clone is NOT the board card — the reference mounts a purpose-built compact
// card (identity row + 2-line clamped title, no bottom row: agent avatar /
// rel-time / metrics / action button all stay out of the flight face).
// Geometry from the captured overlay DOM: 14px/3px project tile with a 7px
// initial, 11px project name (flex-1, truncated), 10px tabular seq, title at
// text-sm medium leading-snug clamped to 2 lines; padding 10px 12px, gap 6px,
// 方角 + 1px --border-default 实描边, bg --card-bg.
// #616 抬升态配方（原 board.css .board-drag-card，#943 迁工具类）：2° 倾角 +
// 0.92 不透明度 + 宽软影（--drag-shadow）。参考站把整套配方写在 overlay 根的
// 内联 style 上（rotate 与 translate 同一 transform）；这里 translate 归
// dnd-kit 的 fixed wrapper，倾角/影/透明度落在本卡上——合成结果逐像素同形。
// #391 的 --lift-shadow 四边墨配方随正典更替退役（值与理由见 tokens.css
// --drag-shadow 注释）。

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
    <div
      className="board-drag-card flex flex-col gap-1.5 rounded-none border border-(--border-default) bg-(--card-bg) py-2.5 px-3 opacity-[0.92] rotate-2 [box-shadow:var(--drag-shadow)]"
      data-todo-id={todo.id}
    >
      <div className="board-drag-card-row1 flex items-center gap-1.5">
        {/* 身份行项目徽标 = .project-avatar 配方的紧凑档（参考站 14px/3px
            圆角/7px 字号，对 16px/4px/10px 的板面档）——原 board.css 的
            后代选择器覆写，#943 起直接以紧凑值落工具类。 */}
        <span className="project-avatar flex-none rounded-[3px] bg-(--project-avatar-bg) text-center text-[7px] leading-[14px] font-medium text-(--project-avatar-fg) size-3.5">
          {initial}
        </span>
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
