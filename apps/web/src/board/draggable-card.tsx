// Draggable wrapper around the presentational TodoCard (#616, 对齐 todos.dev
// 2026-10-02 live 实测；前身 = #73 的 sortable-card）。参考站的拖拽没有列内
// 重排：手势中兄弟卡零位移、同列落位零提交——所以 wrapper 从 useSortable
// 换成 useDraggable，且**从不**把 transform 写回列表项（卡片钉在原槽）。
// 源卡淡出 0.4（参考站内联 opacity 实测值；旧 0.35 随正典更替）。传感器仍住
// wrapper：卡内 stretched title link 的点击导航保持可用（PointerSensor 的
// distance 阈值吞掉未移动的按压，dnd-kit 抑制完成拖拽后的 click）。
// `draggable=false` 的列（待处理/已完成——参考站实测不可拖）连 listener 都
// 不武装：useDraggable disabled 后按压直通卡内链接。
import { useDraggable } from '@dnd-kit/core';
import type { TagChipData } from '../components/ui/tag-chip.js';
import type { TodoRecord } from '../fixtures/records.js';
import { TodoCard } from './todo-card.js';

interface DraggableCardProps {
  todo: TodoRecord;
  now: number;
  onAction?: (todo: TodoRecord) => void;
  onBranch?: (todo: TodoRecord) => void;
  /** 参考站可拖面 = 待开始（+ 执行中沿用本仓既有语义，见 board.tsx 注）。 */
  draggable: boolean;
  /** M5 live：项目 chip 真名（TodoCard 透传位）。 */
  projectName?: string;
  /** #445：卡片标签行（cardTag 解析结果；null = 不渲染占位）。 */
  tag?: TagChipData | null;
}

export function DraggableCard({
  todo,
  now,
  onAction,
  onBranch,
  draggable,
  projectName,
  tag,
}: DraggableCardProps) {
  const { listeners, setNodeRef, isDragging } = useDraggable({
    id: todo.id,
    disabled: !draggable,
  });
  const style = { opacity: isDragging ? 0.4 : undefined };
  return (
    <div ref={setNodeRef} style={style} {...listeners}>
      <TodoCard
        todo={todo}
        now={now}
        onAction={onAction}
        onBranch={onBranch}
        projectName={projectName}
        tag={tag}
      />
    </div>
  );
}
