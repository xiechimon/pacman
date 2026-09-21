import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { BoardPage } from './routes/board-page.js';
import { TodoDetailPage } from './routes/todo-detail-page.js';

// Hand-written route table (issue #52): board + todo detail full page.
// Unmatched paths redirect to /app (01-stack §4.1 i18n row, [设计]).
export const router = createBrowserRouter([
  { path: '/app', element: <BoardPage /> },
  { path: '/app/todo/:id', element: <TodoDetailPage /> },
  { path: '*', element: <Navigate to="/app" replace /> },
]);

export function App() {
  return <RouterProvider router={router} />;
}
