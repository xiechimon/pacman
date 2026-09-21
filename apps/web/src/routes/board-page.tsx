// Board route (issue #54): app shell = sidebar + board surface, content
// picked by the scenario fixture (issue #52 mechanism).
import { useSearchParams } from 'react-router';
import { BoardSurface } from '../board/board.js';
import { BoardSidebar } from '../board/sidebar.js';
import { resolveScenario } from '../fixtures/scenario.js';

export function BoardPage() {
  const [searchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);
  return (
    <div className="board-shell h-full" data-route="board">
      <BoardSidebar />
      <BoardSurface fixture={fixture} />
    </div>
  );
}
