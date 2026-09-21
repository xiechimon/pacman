import { useParams } from 'react-router';

// Todo detail full-page shell (issue #53): phase matrix and stream
// elements land in #56/#57, consuming the scenario-selected fixture set.
export function TodoDetailPage() {
  const { id } = useParams();
  return (
    <div className="h-full overflow-hidden bg-surface text-content" data-route="todo-detail">
      <div data-todo-id={id} />
    </div>
  );
}
