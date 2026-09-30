import { expect, type Page, test } from '@playwright/test';

// #452（ADR 0006 写向）详情页「来源 issue」行真用户路径——live build +
// route stub（project-github-issues 先例；GitHub 真链路归 server
// test/github-writeback.test.ts 注入 mock 面，e2e 不打真 GitHub）。
// Each test pins one failure mode:
// 1. 已建成且一致 → 回显行显示 issue 号/状态/标题，无漂移提示（D1）
// 2. 不一致 → 中性提示出现，本地标题不被覆盖（D2/D5）
// 3. 拉不到（echo 404）→ 整行隐藏，页面无错误态（D3/D6）
// 4. 未建成 → 状态 + 重试入口；重试成功 → 行升级为回显态（AC3）

const LOCAL_TITLE = '登录偶发 500：重试风暴';

function selfRecord(sourceRef: string | null) {
  return {
    id: 'todo-self-1',
    teamId: 'team-1',
    projectId: 'proj-gh',
    title: LOCAL_TITLE,
    spec: '复现步骤：会话过期后连点重试。',
    phase: 'todo',
    phaseAt: 0,
    seqNum: 1,
    orderIndex: 0,
    tagIds: [],
    assignment: null,
    agent: null,
    latestBuildId: null,
    lastRunAt: null,
    hasChanges: false,
    hasPlan: false,
    buildHistory: [],
    sourceTodo: null,
    v: sourceRef === null ? 1 : 2,
    createdBy: 'user-1',
    ownerId: 'user-1',
    sourceBuildId: null,
    sourceKind: 'github-issue-self',
    sourceRef,
  };
}

/** live 面全量 stub（project-github-issues.stubWorld 同律）：未配置路径 =
 * 500。echo 三态与重试升级由 opts 编程。 */
async function stubWorld(
  page: Page,
  opts: {
    /** 初始记录的 sourceRef（null = 未建成态）。 */
    sourceRef: string | null;
    /** echo 端点行为：ok = 200 带标题；gone = 404（issue 被删/拉不到）。 */
    echo: { mode: 'ok'; title: string; state?: 'open' | 'closed' } | { mode: 'gone' };
  },
) {
  let record = selfRecord(opts.sourceRef);
  let retryHits = 0;
  let echoHits = 0;
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
      if (path === '/api/projects') {
        return route.fulfill(
          json([
            {
              id: 'proj-gh',
              name: 'alpha',
              teamId: 'team-1',
              repoKind: 'github',
              githubRepo: 'octo/alpha',
            },
          ]),
        );
      }
      if (path === '/api/todos') return route.fulfill(json([record]));
      if (path === '/api/todos/todo-self-1') return route.fulfill(json(record));
      if (path === '/api/todos/todo-self-1/github-issue') {
        echoHits += 1;
        if (opts.echo.mode === 'gone') {
          return route.fulfill(json({ error: 'source issue' }, 404));
        }
        return route.fulfill(
          json({ number: 101, title: opts.echo.title, state: opts.echo.state ?? 'open' }),
        );
      }
      return route.fulfill(json({ error: 'e2e stub: not the surface under test' }, 500));
    }
    if (request.method() === 'POST' && path === '/api/todos/todo-self-1/github-issue/retry') {
      retryHits += 1;
      // 重试成功：来源补上（server retrySelfIssueCreate 200 全 TodoRecord）
      record = { ...record, sourceRef: 'github:octo/alpha#101', v: record.v + 1 };
      return route.fulfill(json(record));
    }
    return route.fulfill(json({ error: 'e2e stub: not the surface under test' }, 500));
  });
  return {
    get retryHits() {
      return retryHits;
    },
    get echoHits() {
      return echoHits;
    },
  };
}

test('1. 已建成且一致：回显行 = 号 + 状态 + 上游标题，无漂移提示', async ({ page }) => {
  await stubWorld(page, {
    sourceRef: 'github:octo/alpha#101',
    echo: { mode: 'ok', title: LOCAL_TITLE },
  });
  await page.goto('/app/todo/todo-self-1');
  const row = page.locator('[data-testid="source-issue-echo"]');
  await expect(row).toBeVisible();
  await expect(row).toContainText('#101');
  await expect(row).toContainText('打开');
  await expect(row).toContainText(LOCAL_TITLE);
  await expect(page.locator('[data-testid="source-issue-drift"]')).toHaveCount(0);
});

test('2. 不一致：中性提示出现，本地标题不被覆盖（D5 只提示不覆盖）', async ({ page }) => {
  await stubWorld(page, {
    sourceRef: 'github:octo/alpha#101',
    echo: { mode: 'ok', title: '仓库侧改过的标题', state: 'closed' },
  });
  await page.goto('/app/todo/todo-self-1');
  const row = page.locator('[data-testid="source-issue-echo"]');
  await expect(row).toBeVisible();
  await expect(row).toContainText('已关闭');
  await expect(row).toContainText('仓库侧改过的标题');
  await expect(page.locator('[data-testid="source-issue-drift"]')).toHaveText(
    '与本地标题不一致',
  );
  // 本地标题原值不动（无任何覆盖行为）
  await expect(page.locator('.fresh-title')).toHaveText(LOCAL_TITLE);
});

test('3. 拉不到（echo 404）：整行隐藏，页面无错误态', async ({ page }) => {
  await stubWorld(page, { sourceRef: 'github:octo/alpha#101', echo: { mode: 'gone' } });
  await page.goto('/app/todo/todo-self-1');
  // 页面本体正常渲染（标题/描述都在），来源行整行隐藏
  await expect(page.locator('.fresh-title')).toHaveText(LOCAL_TITLE);
  await expect(page.locator('.spec-block')).toContainText('复现步骤');
  await expect(page.locator('[data-testid="source-issue-echo"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="source-issue-pending"]')).toHaveCount(0);
});

test('4. 未建成：状态行 + 重试入口；重试成功 → 行升级为回显态（AC3）', async ({ page }) => {
  const world = await stubWorld(page, {
    sourceRef: null,
    echo: { mode: 'ok', title: LOCAL_TITLE },
  });
  await page.goto('/app/todo/todo-self-1');
  const pending = page.locator('[data-testid="source-issue-pending"]');
  await expect(pending).toBeVisible();
  await expect(pending).toContainText('GitHub issue 未建成');
  // 未建成态不发 echo 请求（进入时拉一次的面只在 sourceRef 已落时开）
  expect(world.echoHits).toBe(0);
  await page.locator('[data-testid="source-issue-retry"]').click();
  const row = page.locator('[data-testid="source-issue-echo"]');
  await expect(row).toBeVisible();
  await expect(row).toContainText('#101');
  expect(world.retryHits).toBe(1);
  await expect(pending).toHaveCount(0);
});
