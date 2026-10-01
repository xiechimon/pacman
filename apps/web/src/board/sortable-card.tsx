// Sortable wrapper around the presentational TodoCard (issue #73, locked
// stack 01-stack-v2 §4.1). The sensor lives on the wrapper so the card's
// stretched title link keeps its click navigation: the PointerSensor's
// distance constraint swallows presses that never travel, and dnd-kit
// suppresses the click that follows a completed drag.
import { useSortable } from '@dnd-kit/sortable';
import type { TagChipData } from '../components/ui/tag-chip.js';
import type { TodoRecord } from '../fixtures/records.js';
import { TodoCard } from './todo-card.js';

interface SortableCardProps {
  todo: TodoRecord;
  now: number;
  onAction?: (todo: TodoRecord) => void;
  onBranch?: (todo: TodoRecord) => void;
  /** this card is the drag source; the DragOverlay carries the visual */
  dragSource: boolean;
  /** M5 live：项目 chip 真名（TodoCard 透传位）。 */
  projectName?: string;
  /** #445：卡片标签行（cardTag 解析结果；null = 不渲染占位）。 */
  tag?: TagChipData | null;
}

export function SortableCard({
  todo,
  now,
  onAction,
  onBranch,
  dragSource,
  projectName,
  tag,
}: SortableCardProps) {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id,
    // #616: 让位卡片过渡——时长保持 dnd-kit 默认 200ms，曲线从默认 ease
    // 换成正典 --ease-pop（motion.css cubic-bezier(.22,1,.36,1)）：指针越
    // 过的瞬间让位卡即时起步（ease 的慢起步在快速手势里读作迟钝），再减
    // 速入位。transition 可中断重定向（CSS transition 特性），来回跨越时
    // 从当前位置反向，不重启。
    transition: { duration: 200, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  });
  const style = {
    // dnd-kit utilities' CSS.Transform inlined (utilities is a transitive
    // dep of the locked pair, not a declared one)
    transform:
      transform != null
        ? `translate3d(${transform.x}px, ${transform.y}px, 0) scaleX(${transform.scaleX}) scaleY(${transform.scaleY})`
        : undefined,
    transition,
    opacity: isDragging || dragSource ? 0.35 : undefined,
  };
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
