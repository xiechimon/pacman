import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { ApiProvider, LiveDataBridge } from './api/provider.js';
import { I18nProvider } from './i18n/provider.js';
import { TokenGate } from './overlay/token-gate.js';
import { ProjectNewPage } from './pages/project-new-page.js';
import { ProjectPage } from './pages/project-page.js';
import { ProjectSettingsPage } from './pages/project-settings-page.js';
import { SchedulesPage } from './pages/schedules-page.js';
import { PwaBridge } from './pwa/register.js';
import { MACHINES_HREF, MachinesPage } from './resources/machines-page.js';
import { MCP_HREF, McpServersPage } from './resources/mcp-servers-page.js';
import { PROVIDERS_HREF, ProvidersPage } from './resources/providers-page.js';
import { SECRETS_HREF, SecretsPage } from './resources/secrets-page.js';
import { SKILLS_IMPORT_HREF, SkillsImportPage } from './resources/skills-import-page.js';
import { SKILLS_HREF, SkillsPage } from './resources/skills-page.js';
import { AccountPage } from './routes/account-page.js';
import { ApiKeysPage } from './routes/api-keys-page.js';
import { BoardPage } from './routes/board-page.js';
import { TeamPage } from './routes/team-page.js';
import { TodoDetailPage } from './routes/todo-detail-page.js';

// Hand-written route table (issue #52): board + todo detail full page.
// #71 adds the schedules + project surfaces (r2 §2 route table; /new
// precedes :id so the literal wins); #70 the secondary batch B
// (team / account / api-keys); #69 the resources batch A. The feedback
// route is removed outright (#149 local-first 裁决，#129 先例）— the old
// path falls through to the catch-all redirect.
// Unmatched paths redirect to /app (01-stack §4.1 i18n row, [设计]).
// #74: every route rides the pathless PwaBridge layout (sw registration +
// notification-click deep links) and the app-level I18nProvider.
// #83 (M5): the LiveDataBridge pathless layout sits above PwaBridge — it
// resolves fixture-vs-live mode, the seed team/user and the global team
// stream; fully inert in fixture (parity/dev-scenario) mode.
export const router = createBrowserRouter([
  {
    element: <LiveDataBridge />,
    children: [
      {
        element: <PwaBridge />,
        children: [
          { path: '/app', element: <BoardPage /> },
          { path: '/app/todo/:id', element: <TodoDetailPage /> },
          { path: '/app/schedules', element: <SchedulesPage /> },
          { path: '/app/project/new', element: <ProjectNewPage /> },
          { path: '/app/project/:id', element: <ProjectPage /> },
          { path: '/app/project/:id/settings', element: <ProjectSettingsPage /> },
          { path: '/app/team', element: <TeamPage /> },
          { path: '/app/account', element: <AccountPage /> },
          { path: '/app/api-keys', element: <ApiKeysPage /> },
          { path: SKILLS_HREF, element: <SkillsPage /> },
          { path: SKILLS_IMPORT_HREF, element: <SkillsImportPage /> },
          { path: MCP_HREF, element: <McpServersPage /> },
          { path: SECRETS_HREF, element: <SecretsPage /> },
          { path: MACHINES_HREF, element: <MachinesPage /> },
          { path: PROVIDERS_HREF, element: <ProvidersPage /> },
          { path: '*', element: <Navigate to="/app" replace /> },
        ],
      },
    ],
  },
]);

export function App() {
  return (
    <ApiProvider>
      <I18nProvider>
        <RouterProvider router={router} />
        {/* #253 token 门页：401 触发的全屏唯一面，鉴权关时恒不可见 */}
        <TokenGate />
      </I18nProvider>
    </ApiProvider>
  );
}
