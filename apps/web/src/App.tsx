import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { ProjectNewPage } from './pages/project-new-page.js';
import { ProjectPage } from './pages/project-page.js';
import { ProjectSettingsPage } from './pages/project-settings-page.js';
import { SchedulesPage } from './pages/schedules-page.js';
import { BoardPage } from './routes/board-page.js';
import { TodoDetailPage } from './routes/todo-detail-page.js';

// Hand-written route table (issue #52): board + todo detail full page.
// #71 adds the schedules + project surfaces (r2 §2 route table; /new
// precedes :id so the literal wins). Unmatched paths redirect to /app
// (01-stack §4.1 i18n row, [设计]).
export const router = createBrowserRouter([
  { path: '/app', element: <BoardPage /> },
  { path: '/app/todo/:id', element: <TodoDetailPage /> },
  { path: '/app/schedules', element: <SchedulesPage /> },
  { path: '/app/project/new', element: <ProjectNewPage /> },
  { path: '/app/project/:id', element: <ProjectPage /> },
  { path: '/app/project/:id/settings', element: <ProjectSettingsPage /> },
  { path: '*', element: <Navigate to="/app" replace /> },
]);

export function App() {
  return <RouterProvider router={router} />;
}
