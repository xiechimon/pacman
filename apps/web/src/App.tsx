import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { MACHINES_HREF, MachinesPage } from './resources/machines-page.js';
import { MCP_HREF, McpServersPage } from './resources/mcp-servers-page.js';
import { PROVIDERS_HREF, ProvidersPage } from './resources/providers-page.js';
import { SECRETS_HREF, SecretsPage } from './resources/secrets-page.js';
import { SKILLS_IMPORT_HREF, SkillsImportPage } from './resources/skills-import-page.js';
import { SKILLS_HREF, SkillsPage } from './resources/skills-page.js';
import { BoardPage } from './routes/board-page.js';
import { TodoDetailPage } from './routes/todo-detail-page.js';

// Hand-written route table (issue #52): board + todo detail full page;
// #69 adds the resources batch A (six pixel surfaces, r2 §2 route table).
// Unmatched paths redirect to /app (01-stack §4.1 i18n row, [设计]).
export const router = createBrowserRouter([
  { path: '/app', element: <BoardPage /> },
  { path: '/app/todo/:id', element: <TodoDetailPage /> },
  { path: SKILLS_HREF, element: <SkillsPage /> },
  { path: SKILLS_IMPORT_HREF, element: <SkillsImportPage /> },
  { path: MCP_HREF, element: <McpServersPage /> },
  { path: SECRETS_HREF, element: <SecretsPage /> },
  { path: MACHINES_HREF, element: <MachinesPage /> },
  { path: PROVIDERS_HREF, element: <ProvidersPage /> },
  { path: '*', element: <Navigate to="/app" replace /> },
]);

export function App() {
  return <RouterProvider router={router} />;
}
