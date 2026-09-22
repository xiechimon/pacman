// Sortable wrapper around the presentational TodoCard (issue #73, locked
// stack 01-stack-v2 §4.1). The sensor lives on the wrapper so the card's
// stretched title link keeps its click navigation: the PointerSensor's
// distance constraint swallows presses that never travel, and dnd-kit
// suppresses the click that follows a completed drag.
import { useSortable } from '@dnd-kit/sortable';
import type { TodoRecord } from '../fixtures/records.js';
import { TodoCard } from './todo-card.js';

interface SortableCardProps {
  todo: TodoRecord;
  now: number;
  onAction?: (todo: TodoRecord) => void;
  onBranch?: (todo: TodoRecord) => void;
  /** this card is the drag source; the DragOverlay carries the visual */
  dragSource: boolean;
}

export function SortableCard({ todo, now, onAction, onBranch, dragSource }: SortableCardProps) {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id,
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
      <TodoCard todo={todo} now={now} onAction={onAction} onBranch={onBranch} />
    </div>
  );
}
