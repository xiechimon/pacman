import { expect, type Page, test } from '@playwright/test';

// #446（ADR 0005 读向）「从 GitHub issue 建任务」真用户路径——live build +
// route stub（skills-readonly / project-new-repo 先例；GitHub 真链路归
// server test/github-issues.test.ts 的注入 mock 面，e2e 不打真 GitHub）。
// Each test pins one failure mode:
// 1. 已连接 github 项目页 → 入口出现 → 弹层列 issue（label chips）→ 点选
//    导入（POST body {number}）→ 导航详情 → issue 标题 + 全部标签 + 正文
// 2. local 项目 → 入口不渲染（形态门）
// 3. 未连接 github 项目 → 入口不渲染，任务面正常（不报错不空白）
// 4. 状态过滤与分页参数直达请求面；hasMore=false → 下一页禁用

const PROJECTS = [
  {
    id: 'proj-gh',
    name: 'alpha',
    teamId: 'team-1',
    repoKind: 'github',
    githubRepo: 'octo/alpha',
  },
  {
    id: 'proj-local',
    name: 'local-thing',
    teamId: 'team-1',
    repoKind: 'local',
    localPath: '/tmp/local-thing',
  },
];

const TAGS = [
  { id: 'tag-bug', projectId: 'proj-gh', name: 'bug', color: '#d73a4a', createdAt: 0, v: 1 },
  {
    id: 'tag-auth',
    projectId: 'proj-gh',
    name: 'area:auth',
    color: '#0075ca',
    createdAt: 0,
    v: 1,
  },
];

const ISSUE_TITLE = '登录偶发 500：重试风暴';

const IMPORTED_RECORD = {
  id: 'todo-gh-1',
  teamId: 'team-1',
  projectId: 'proj-gh',
  title: ISSUE_TITLE,
  spec: '复现步骤：会话过期后连点重试。',
  phase: 'todo',
  phaseAt: 0,
  seqNum: 1,
  orderIndex: 0,
  tagIds: ['tag-bug', 'tag-auth'],
  assignment: null,
  agent: null,
  latestBuildId: null,
  lastRunAt: null,
  hasChanges: false,
  hasPlan: false,
  buildHistory: [],
  sourceTodo: null,
  v: 1,
  createdBy: 'user-1',
  ownerId: 'user-1',
  sourceBuildId: null,
  sourceKind: 'github-issue',
  sourceRef: 'github:octo/alpha#7',
};

const ISSUES_PAGE_1 = {
  issues: [
    {
      number: 7,
      title: ISSUE_TITLE,
      state: 'open',
      labels: [
        { name: 'bug', color: '#d73a4a' },
        { name: 'area:auth', color: '#0075ca' },
      ],
    },
    { number: 9, title: 'second issue', state: 'open', labels: [{ name: 'bug', color: '#d73a4a' }] },
  ],
  page: 1,
  hasMore: true,
};

const ISSUES_PAGE_2 = {
  issues: [{ number: 11, title: 'third issue', state: 'open', labels: [] }],
  page: 2,
  hasMore: false,
};

const ISSUES_CLOSED = {
  issues: [
    { number: 12, title: 'closed issue', state: 'closed', labels: [{ name: 'bug', color: '#d73a4a' }] },
  ],
  page: 1,
  hasMore: false,
};

/** live 面全量 stub：单 handler 按 method+pathname 分发（glob `?` 语义陷阱
 * 的规避面）；未配置路径 = 500（skills-readonly.stubBoot 容忍律）。返回
 * issue 查询串与导入 body 的记录器供参数断言。 */
async function stubWorld(page: Page, opts: { connected?: boolean } = {}) {
  const issueQueries: string[] = [];
  const importBodies: unknown[] = [];
  const json = (body: unknown, status = 200) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
  await page.route('**/api/**', (route, request) => {
    const url = new URL(request.url());
    const path = url.pathname;
    if (request.method() === 'GET') {
      if (path === '/api/teams') {
        return route.fulfill(
          json([{ id: 'team-1', name: 'Team', createdAt: 0, plan: 'free', avatarStyle: null }]),
        );
      }
      if (path === '/api/user/me') {
        return route.fulfill(json({ id: 'user-1', displayName: '我', avatarUrl: null }));
      }
      if (path === '/api/projects') return route.fulfill(json(PROJECTS));
      if (path === '/api/todos') return route.fulfill(json([]));
      if (path === '/api/todos/todo-gh-1') return route.fulfill(json(IMPORTED_RECORD));
      if (path === '/api/teams/team-1/github/connection') {
        return route.fulfill(
          json(
            (opts.connected ?? true) === true
              ? { connected: true, login: 'octo', scope: 'repo' }
              : { connected: false },
          ),
        );
      }
      if (path === '/api/projects/proj-gh/tags') return route.fulfill(json(TAGS));
      if (path === '/api/projects/proj-gh/github/issues') {
        const state = url.searchParams.get('state') ?? 'open';
        const pageParam = url.searchParams.get('page') ?? '1';
        issueQueries.push(`state=${state}&page=${pageParam}`);
        if (state === 'closed') return route.fulfill(json(ISSUES_CLOSED));
        if (pageParam === '2') return route.fulfill(json(ISSUES_PAGE_2));
        return route.fulfill(json(ISSUES_PAGE_1));
      }
      return route.fulfill(json({ error: 'e2e stub: not the surface under test' }, 500));
    }
    if (
      request.method() === 'POST' &&
      path === '/api/projects/proj-gh/github/issues/import'
    ) {
      importBodies.push(JSON.parse(request.postData() ?? '{}'));
      return route.fulfill(json(IMPORTED_RECORD, 201));
    }
    return route.fulfill(json({ error: 'e2e stub: not the surface under test' }, 500));
  });
  return { issueQueries, importBodies };
}

async function openDialog(page: Page) {
  await page.goto('/app/project/proj-gh?tab=tasks');
  const entry = page.locator('.prj-issues-entry');
  await expect(entry).toBeVisible();
  await entry.click();
  const dialog = page.locator('.dlg-ghissues');
  await expect(dialog).toBeVisible();
  return dialog;
}

test('1. 已连接 github 项目：入口 → 弹层 → 点选导入 → 详情见 issue 标题与全部标签', async ({
  page,
}) => {
  const { importBodies } = await stubWorld(page);
  const dialog = await openDialog(page);
  // 列表面：两行 issue，label chips 全渲染（#7 两枚 + #9 一枚）
  await expect(dialog.locator('.prj-issues-row')).toHaveCount(2);
  await expect(dialog.locator('.prj-issues-tag')).toHaveText(['bug', 'area:auth', 'bug']);
  // 点选导入 → POST body {number} → 导航任务详情
  await dialog.locator('.prj-issues-row', { hasText: ISSUE_TITLE }).click();
  await expect(page).toHaveURL(/\/app\/todo\/todo-gh-1/);
  await expect(page.locator('.fresh-title')).toHaveText(ISSUE_TITLE);
  await expect(page.locator('.fresh-tag-chip')).toHaveText(['bug', 'area:auth']);
  await expect(page.locator('.spec-block')).toContainText('复现步骤');
  expect(importBodies).toEqual([{ number: 7 }]);
});

test('2. local 项目：入口不渲染', async ({ page }) => {
  await stubWorld(page);
  await page.goto('/app/project/proj-local?tab=tasks');
  await expect(page.locator('.prj-tasks-toolbar')).toBeVisible();
  await expect(page.locator('.prj-issues-entry')).toHaveCount(0);
});

test('3. 未连接 github 项目：入口不渲染，任务面正常不空白', async ({ page }) => {
  await stubWorld(page, { connected: false });
  await page.goto('/app/project/proj-gh?tab=tasks');
  await expect(page.locator('.prj-tasks-toolbar')).toBeVisible();
  await expect(page.locator('.prj-issues-entry')).toHaveCount(0);
  await expect(page.locator('.dlg-ghissues')).toHaveCount(0);
});

test('4. 状态过滤与分页参数直达请求面；hasMore=false 下一页禁用', async ({ page }) => {
  const { issueQueries } = await stubWorld(page);
  const dialog = await openDialog(page);
  expect(issueQueries).toEqual(['state=open&page=1']);
  await expect(dialog.locator('.prj-issues-next')).toBeEnabled();
  // 已关闭过滤：state=closed 直达；hasMore=false → 下一页禁用
  await dialog.locator('.prj-issues-filter', { hasText: '已关闭' }).click();
  await expect(dialog.locator('.prj-issues-row')).toHaveCount(1);
  await expect(dialog.locator('.prj-issues-row')).toContainText('closed issue');
  expect(issueQueries).toEqual(['state=open&page=1', 'state=closed&page=1']);
  await expect(dialog.locator('.prj-issues-next')).toBeDisabled();
  // 回「打开」翻到第 2 页：page=2 直达，行集换页。回切「打开」不重发
  // open&page=1（TanStack staleTime 缓存命中，键含 state/page）。
  await dialog.locator('.prj-issues-filter', { hasText: '打开' }).click();
  await dialog.locator('.prj-issues-next').click();
  await expect(dialog.locator('.prj-issues-row')).toHaveCount(1);
  await expect(dialog.locator('.prj-issues-row')).toContainText('third issue');
  expect(issueQueries).toEqual([
    'state=open&page=1',
    'state=closed&page=1',
    'state=open&page=2',
  ]);
  await expect(dialog.locator('.prj-issues-page')).toHaveText('第 2 页');
  await expect(dialog.locator('.prj-issues-next')).toBeDisabled();
});
