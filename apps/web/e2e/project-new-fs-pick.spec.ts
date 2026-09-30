import { expect, type Page, test } from '@playwright/test';

// Issue #440 (ADR 0003 本地文件夹系统原生选取对话框): local 选态的浏览钮经
// POST /api/fs/pick 由 server 代弹 macOS 原生 choose folder。原生对话框不可被
// playwright 驱动——本 spec 钉 web 侧契约面（live build + stubbed network，
// project-new-repo.spec stubBoot 先例）：
//
// 1. 浏览钮只在 local 选态在场（none/github 面不渲染）
// 2. 选取成功 → 路径回填输入框（含空格路径）+ basename→项目名回填律联动
// 3. 取消（{path:null}，正常结局非错误）→ 静默 no-op：输入不动、无错误/提示行
// 4. unavailable 422（reason code，#386 三端单源模式）→ 中性提示行（非 danger
//    错误行），输入面仍可用，编辑路径即撤提示（陈旧提示不残留律）
// 5. 在飞期按钮 disabled + 双击单发（web busy 态与 server 单飞 D7 双保险）
// 6. pick 结果覆盖对话框期间的手改路径（S11 最后动作赢，失败方式清单见 #440）
//
// 原生真路径（探测两态 / 对话框回填 / 取消退出码）走 verify-pacman 人工面。

const NEW_PROJECT_LIVE = '/app/project/new';

/** Live-face boot stub（project-new-repo.spec stubBoot 同款）：seed team +
 *  session succeed，其余 GET 500（shell 容忍）。注册序 = 匹配反序。 */
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

/** POST /api/fs/pick 可编程 stub；返回 POST 计数读取器（双击单发面用）。 */
async function stubPick(
  page: Page,
  handler: () => { status?: number; json: unknown; delayMs?: number },
): Promise<() => number> {
  let posts = 0;
  await page.route('**/api/fs/pick', async (route, request) => {
    if (request.method() !== 'POST') return route.fallback();
    posts += 1;
    const result = handler();
    if (result.delayMs !== undefined) {
      await new Promise((resolve) => setTimeout(resolve, result.delayMs));
    }
    return route.fulfill({
      status: result.status ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(result.json),
    });
  });
  return () => posts;
}

async function openLocalFace(page: Page) {
  await page.goto(NEW_PROJECT_LIVE);
  await page.locator('#prj-new-repo').click();
  await page
    .locator('.prj-new-repo-menu-row', { hasText: '本地文件夹' })
    .click();
  await expect(page.locator('.prj-new-repo-menu')).not.toBeVisible();
  return page.locator('input[aria-label="本地文件夹"]');
}

test('浏览钮只在 local 选态在场', async ({ page }) => {
  await stubBoot(page);
  await page.goto(NEW_PROJECT_LIVE);
  await expect(page.locator('.prj-new-browse')).toHaveCount(0);
  const input = await openLocalFace(page);
  await expect(input).toBeVisible();
  await expect(page.locator('.prj-new-browse')).toHaveCount(1);
});

test('选取成功：路径回填（含空格）+ basename 项目名回填律联动', async ({ page }) => {
  await stubBoot(page);
  await stubPick(page, () => ({ json: { path: '/Users/e2e/demo repo' } }));
  const input = await openLocalFace(page);
  await page.locator('.prj-new-browse').click();
  await expect(input).toHaveValue('/Users/e2e/demo repo');
  await expect(page.locator('#prj-new-name')).toHaveValue('demo repo');
});

test('取消 = 静默 no-op：输入不动、无错误/提示行', async ({ page }) => {
  await stubBoot(page);
  await stubPick(page, () => ({ json: { path: null } }));
  const input = await openLocalFace(page);
  await input.fill('/x/y');
  await page.locator('.prj-new-browse').click();
  // 请求完成（mutation settled）后按钮恢复可用 = 取消已处理的完成信号。
  await expect(page.locator('.prj-new-browse')).toBeEnabled();
  await expect(input).toHaveValue('/x/y');
  await expect(page.locator('.prj-new-error')).toHaveCount(0);
  await expect(page.locator('.prj-new-hint')).toHaveCount(0);
});

test('unavailable 422：提示行 + 自动开应用内浏览器兜底；关闭后提示仍在，编辑即撤', async ({
  page,
}) => {
  await stubBoot(page);
  await stubPick(page, () => ({
    status: 422,
    json: { error: 'folder picker unavailable: requires macOS with a GUI session', reason: 'unavailable' },
  }));
  const input = await openLocalFace(page);
  await page.locator('.prj-new-browse').click();
  const hint = page.locator('.prj-new-hint');
  await expect(hint).toBeVisible();
  await expect(hint).toContainText('请直接输入路径');
  // 提示非错误级：danger 错误行不出现。
  await expect(page.locator('.prj-new-error')).toHaveCount(0);
  // #441：unavailable = remote/headless 形态 → 自动打开应用内目录浏览器兜底。
  await expect(page.locator('.dir-browser')).toBeVisible();
  // 关闭 overlay（Escape）：提示行仍在（W12，不随 overlay 退场）。
  await page.keyboard.press('Escape');
  await expect(page.locator('.dir-browser')).not.toBeVisible();
  await expect(hint).toBeVisible();
  // 输入面仍可用 + 编辑即撤（陈旧提示不残留律）。
  await input.fill('/still/usable');
  await expect(input).toHaveValue('/still/usable');
  await expect(hint).toHaveCount(0);
});

test('在飞期按钮 disabled，双击单发', async ({ page }) => {
  await stubBoot(page);
  const postCount = await stubPick(page, () => ({ json: { path: '/tmp/one' }, delayMs: 600 }));
  const input = await openLocalFace(page);
  const browse = page.locator('.prj-new-browse');
  await browse.click();
  await expect(browse).toBeDisabled();
  // disabled 钮上 force click：浏览器抑制 disabled 按钮的 click 事件 = 无第二发。
  await browse.click({ force: true });
  await expect(input).toHaveValue('/tmp/one');
  expect(postCount()).toBe(1);
});

test('pick 结果覆盖对话框期间的手改路径（最后动作赢）', async ({ page }) => {
  await stubBoot(page);
  await stubPick(page, () => ({ json: { path: '/a/b' }, delayMs: 300 }));
  const input = await openLocalFace(page);
  await page.locator('.prj-new-browse').click();
  // 对话框在飞期间手改输入（busy 只锁按钮不锁输入面）。
  await input.fill('/manual/edit');
  await expect(input).toHaveValue('/a/b');
});
