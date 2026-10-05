// 项目首字母徽标（原 board.css .project-avatar 规则族，#943 随文件清零迁
// 工具类）：板面档 16px 方 tile、4px 圆角、10px 首字母，色走
// --project-avatar-bg/fg 槽（亮暗双模镜像在 shadcn.css）。消费面全在本域：
// sidebar 两态项目行、todo-card 身份行、drag-card 紧凑档（14px/3px/7px，
// className 逐组覆写——TagChip row-flush 档同手法）。类名原位保留：
// sidebar RAIL_ROW 的 [&>.project-avatar]:relative 抬层选择器仍消费它。
// overlay 的 new-task 项目 picker 走自己的 .new-task-project-avatar
// （overlay.css，#948 面），不吃本件。

import { cn } from 'cn';

export function ProjectAvatar({ char, className }: { char: string; className?: string }) {
  return (
    <span
      className={cn(
        'project-avatar flex-none size-4 rounded-[4px] bg-(--project-avatar-bg) text-center text-[10px] leading-4 font-medium text-(--project-avatar-fg)',
        className,
      )}
    >
      {char}
    </span>
  );
}
