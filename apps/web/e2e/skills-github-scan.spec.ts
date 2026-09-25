import { expect, type Page, test } from '@playwright/test';

// Issue #235: skills 导入面 GitHub tab「扫描」钮接线(live 半)——web 消费
// #223 的 POST /api/skills/scan 双模式端点:扫描(候选发现)→ 结果列表 →
// 选中候选(fetch 模式取文件集)→ 既有 POST /api/skills 文件集导入(#195
// 语义链)→ 回技能列表。
// 本 spec 是仓内首个 page.route 网络桩 e2e:parity build 不带 ?scenario=
// 即 live 模式(api/mode.ts isFixtureMode 律),全 API 面打桩后确定性钉
// web → 端点消费链;真 GitHub 出站链归 live 真机验(票坐标)。fixture 面
// DOM 零变化由 parity 矩阵(scenario 80)守,本 spec 不重复钉。
// 钉住的失败方式:空 repo 不发请求 / 扫描 4xx·5xx 显示错误 / 空候选空态 /
// 截断提示 / 导入链失败不导航 / 导入中防重。

const IMPORT = '/app/resources/skills/import';
const SKILLS = '/app/resources/skills';

/** live 启动面打桩:teams/session 是 teamId 来源必须成功;其余 GET 一律
 *  500——启动面查询失败 = 应用既有 isError 耐受(data ?? [] 族),而喂错误
 *  形状的空集会让消费方渲染期抛错(实测 useChief 期望对象,[] 触发重挂载
 *  循环)。本 spec 测扫描链,不测启动面查询集。
 *  page.route 匹配序 = 注册逆序:catch-all 必须先注册,具体路由后注册才生效。 */
async function stubBoot(page: Page) {
  await page.route('**/api/**', (route, request) => {
    if (request.method() !== 'GET') return route.fallback();
    return route.fulfill({ status: 500, json: { error: 'e2e stub: not the surface under test' } });
  });
  await page.route('**/api/teams', (route) =>
    route.fulfill({
      json: [{ id: 'team-1', name: 'Team', createdAt: 0, plan: 'free', avatarStyle: null }],
    }),
  );
  await page.route('**/api/user/me', (route) =>
    route.fulfill({ json: { id: 'user-1', displayName: '我', avatarUrl: null } }),
  );
}

/** scan 端点可编程桩;返回请求体记录仪(scan/fetch 双模式同端点)。 */
async function stubScan(
  page: Page,
  handler: (body: Record<string, unknown>) => { status?: number; json: unknown },
) {
  const bodies: Record<string, unknown>[] = [];
  await page.route('**/api/skills/scan', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    bodies.push(body);
    const res = handler(body);
    await route.fulfill({ status: res.status ?? 200, json: res.json });
  });
  return bodies;
}

const TWO_CANDIDATES = {
  repo: 'xiechimon/pacman',
  defaultBranch: 'main',
  candidates: [
    { path: 'skills/deploy', name: 'deploy', description: '部署流程手册' },
    { path: '', name: 'pacman', description: null },
  ],
  truncated: false,
};

test('扫描成功:候选列表渲染,scan 请求体为发现模式(无 path)', async ({ page }) => {
  await stubBoot(page);
  const bodies = await stubScan(page, () => ({ json: TWO_CANDIDATES }));
  await page.goto(IMPORT);
  // 等 teamId 解析后的首轮查询(todos/machines 带 teamId 才发),钉死请求体
  // 全形(teamId 随行 = hooks 族律);裸 waitForResponse('/api/teams') 与
  // React 重渲染之间有竞态。
  await page.waitForResponse('**/api/todos*');
  await page.getByRole('tab', { name: '从 GitHub' }).click();

  await page.locator('#skill-repo').fill('xiechimon/pacman');
  await page.getByRole('button', { name: '扫描', exact: true }).click();

  await expect(page.locator('.res-cand')).toHaveCount(2);
  await expect(page.locator('.res-cand-name').nth(0)).toHaveText('deploy');
  await expect(page.locator('.res-cand').nth(0)).toContainText('部署流程手册');
  // 非根候选带路径消歧行;根候选(path='')不渲染路径行
  await expect(page.locator('.res-cand').nth(0)).toContainText('skills/deploy');
  await expect(page.locator('.res-cand-name').nth(1)).toHaveText('pacman');
  expect(bodies).toEqual([{ repo: 'xiechimon/pacman', teamId: 'team-1' }]);
});

/** scan 成功 + fetch 模式可编程(导入链两例共用):发现模式回双候选,fetch
 *  模式按 fetchHandler 应答(默认成功回文件集)。 */
async function stubScanChain(
  page: Page,
  fetchHandler: (path: unknown) => { status?: number; json: unknown } = (path) => ({
    json: {
      repo: 'xiechimon/pacman',
      path,
      files: { 'SKILL.md': '---\nname: deploy\n---\n# deploy', 'scripts/run.sh': '#!/bin/sh' },
    },
  }),
) {
  await stubScan(page, (body) =>
    body.path === undefined ? { json: TWO_CANDIDATES } : fetchHandler(body.path),
  );
}

/** 从导入面起跑:boot 桩 + GitHub tab + 填 repo + 点扫描,等候选列表落地。 */
async function scanToCandidates(page: Page, repo = 'xiechimon/pacman') {
  await stubBoot(page);
  await page.goto(IMPORT);
  await page.waitForResponse('**/api/todos*');
  await page.getByRole('tab', { name: '从 GitHub' }).click();
  await page.locator('#skill-repo').fill(repo);
  await page.getByRole('button', { name: '扫描', exact: true }).click();
  await expect(page.locator('.res-cand').first()).toBeVisible();
}

test('选中候选:fetch 模式取文件集 → POST /api/skills 文件集导入 → 回技能列表', async ({
  page,
}) => {
  await stubScanChain(page);
  const creates: Record<string, unknown>[] = [];
  await page.route('**/api/skills', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    creates.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: 201,
      json: { id: 'skill-1', teamId: 'team-1', name: 'deploy', description: '部署流程手册' },
    });
  });
  await scanToCandidates(page, 'https://github.com/xiechimon/pacman');

  await page.locator('.res-cand', { hasText: 'deploy' }).click();

  // fetch 模式:同端点带 path;导入 = 文件集同形喂 POST /api/skills
  await expect.poll(() => creates.length).toBe(1);
  expect(creates[0]).toEqual({
    teamId: 'team-1',
    name: 'deploy',
    description: '部署流程手册',
    files: { 'SKILL.md': '---\nname: deploy\n---\n# deploy', 'scripts/run.sh': '#!/bin/sh' },
  });
  await expect(page).toHaveURL(SKILLS);
});

test('扫描失败(429 限流):错误行显示,不渲染候选', async ({ page }) => {
  await stubBoot(page);
  await stubScan(page, () => ({
    status: 429,
    json: { error: 'github api rate limit exceeded (unauthenticated 60 req/h per IP); retry later' },
  }));
  await page.goto(IMPORT);
  await page.getByRole('tab', { name: '从 GitHub' }).click();
  await page.locator('#skill-repo').fill('xiechimon/pacman');
  await page.getByRole('button', { name: '扫描', exact: true }).click();

  await expect(page.locator('.res-form .res-error')).toContainText('扫描失败');
  await expect(page.locator('.res-form .res-error')).toContainText('rate limit');
  await expect(page.locator('.res-cand')).toHaveCount(0);
});

test('空候选 + 截断标志:空态文案与截断提示分行', async ({ page }) => {
  await stubBoot(page);
  await stubScan(page, () => ({
    json: { repo: 'xiechimon/pacman', defaultBranch: 'main', candidates: [], truncated: true },
  }));
  await page.goto(IMPORT);
  await page.getByRole('tab', { name: '从 GitHub' }).click();
  await page.locator('#skill-repo').fill('xiechimon/pacman');
  await page.getByRole('button', { name: '扫描', exact: true }).click();

  await expect(page.locator('.res-candlist')).toContainText('未发现技能');
  await expect(page.locator('.res-candlist')).toContainText('结果已截断');
});

test('repo 为空:扫描钮 disabled,不发请求', async ({ page }) => {
  await stubBoot(page);
  const bodies = await stubScan(page, () => ({ json: TWO_CANDIDATES }));
  await page.goto(IMPORT);
  await page.getByRole('tab', { name: '从 GitHub' }).click();

  const scanBtn = page.getByRole('button', { name: '扫描', exact: true });
  await expect(scanBtn).toBeDisabled();
  await page.locator('#skill-repo').fill('   ');
  await expect(scanBtn).toBeDisabled();
  expect(bodies).toEqual([]);
});

test('导入链失败(create 500):错误行显示,停留在导入面', async ({ page }) => {
  await stubScanChain(page);
  await page.route('**/api/skills', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await route.fulfill({ status: 500, json: { error: 'db exploded' } });
  });
  await scanToCandidates(page);
  await page.locator('.res-cand', { hasText: 'deploy' }).click();

  await expect(page.locator('.res-form .res-error')).toContainText('导入失败');
  await expect(page).toHaveURL(IMPORT);
});

test('导入链失败(fetch 模式 502):错误行显示,候选行解禁,不导航', async ({ page }) => {
  await stubScanChain(page, () => ({
    status: 502,
    json: { error: 'github raw vanished mid-scan: skills/deploy/SKILL.md' },
  }));
  await scanToCandidates(page);
  await page.locator('.res-cand', { hasText: 'deploy' }).click();

  await expect(page.locator('.res-form .res-error')).toContainText('导入失败');
  await expect(page.locator('.res-form .res-error')).toContainText('raw vanished');
  await expect(page.locator('.res-cand').first()).toBeEnabled();
  await expect(page).toHaveURL(IMPORT);
});
