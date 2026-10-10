import { expect, type Page, test } from '@playwright/test';

// #1170 技能导入通道：技能页 topbar「导入」钮开 SkillImportDialog（localPath
// / url 两字段二选一）→ POST /api/teams/{id}/skills/import。每条钉一个失败
// 方式：
// 1. fixture 面：导入弹窗字段集 + xor 提交闸（双空/双填禁用 + 双填提示）+
//    accept 律提交即关（fixture 不发请求）；
// 2. live 导入：POST 201 → 弹窗关 → 列表失效重取即现；请求体 = 所填单字段
//    （trim 后）逐字对拍；
// 3. live 导入 400：弹窗不关，错误行 headline 中文 + server 原文 detail；
// 4. live 导入 409 同名：headline 分译可读；
// 5. 空列表可达性：topbar 导入钮不随空态消失（空态替换的是搜索行，不是
//    topbar）——空库首导路径不断。
// 载体沿用 skills-write.spec 家族（stubBoot 纪律 + route 匹配序 = 注册逆序：
// catch-all 先注册，具体路由后注册才生效）。

const SKILLS = '/app/resources/skills';

/** live 启动面打桩（承 skills-write.spec 的 stubBoot 纪律）。 */
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

interface SkillRow {
  id: string;
  teamId: string;
  name: string;
  description: string | null;
}

/** live 技能面 + 导入面打桩：GET /api/skills 现扫 store；POST
 * .../skills/import 按预设 status 应答并捕获请求体。 */
async function stubImport(page: Page, seed: SkillRow[] = []) {
  const store = [...seed];
  const importCalls: { url: string; body?: unknown }[] = [];
  let importStatus = 201;
  let importError = 'skill directory deploy already exists';
  await page.route('**/api/skills*', (route, request) => {
    if (request.method() !== 'GET') return route.fallback();
    return route.fulfill({ json: store });
  });
  // 导入端点（具体路由，后注册先生效——注册序在泛 skills/* 之前落位）。
  await page.route('**/api/teams/*/skills/import', (route, request) => {
    importCalls.push({ url: request.url(), body: request.postDataJSON() });
    if (importStatus === 201) {
      const body = request.postDataJSON() as { localPath?: string; url?: string };
      const name = body.localPath !== undefined ? 'from-path' : 'from-url';
      const rec: SkillRow = {
        id: name,
        teamId: 'team-1',
        name,
        description: '导入的技能',
      };
      store.push(rec);
      return route.fulfill({ status: 201, json: rec });
    }
    return route.fulfill({ status: importStatus, json: { error: importError } });
  });
  return {
    store,
    importCalls,
    setImportError: (status: number, error: string) => {
      importStatus = status;
      importError = error;
    },
  };
}

test('fixture 导入弹窗：字段集 + xor 提交闸 + accept 律提交即关', async ({ page }) => {
  await page.goto(`${SKILLS}?scenario=01`);
  // topbar 导入钮在空态（fixture 01 无技能行）同样可达。
  await page.getByTestId('resource-import').click();
  const dialog = page.getByRole('dialog', { name: '导入技能' });
  await expect(dialog).toHaveAccessibleName('导入技能');
  await expect(dialog.locator('#dlg-skill-import-path')).toBeVisible();
  await expect(dialog.locator('#dlg-skill-import-url')).toBeVisible();

  const submit = dialog.getByRole('button', { name: '导入', exact: true });
  await expect(submit).toBeDisabled(); // 双空
  await dialog.locator('#dlg-skill-import-path').fill('/tmp/some-skill');
  await expect(submit).toBeEnabled(); // 恰一填
  await dialog.locator('#dlg-skill-import-url').fill('https://github.com/acme/repo');
  await expect(submit).toBeDisabled(); // 双填
  await expect(dialog.getByRole('alert')).toContainText('二选一');

  await dialog.locator('#dlg-skill-import-path').fill('');
  await expect(submit).toBeEnabled(); // 回到恰一填（url）
  await submit.click();
  await expect(page.getByRole('dialog', { name: '导入技能' })).toBeHidden(); // fixture accept 律
});

test('live 导入：201 后弹窗关、列表即现，请求体 = 所填单字段逐字', async ({ page }) => {
  await stubBoot(page);
  const { importCalls } = await stubImport(page);
  await page.goto(SKILLS);
  await expect(page.getByTestId('resource-empty')).toBeVisible(); // 空库首导路径
  await page.getByTestId('resource-import').click();
  const dialog = page.getByRole('dialog', { name: '导入技能' });
  await dialog.locator('#dlg-skill-import-path').fill('  /Users/you/skills/deploy-to-prod  ');
  await dialog.getByRole('button', { name: '导入', exact: true }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('resource-row')).toHaveCount(1); // 失效重取即现
  await expect(page.getByTestId('resource-row').first()).toContainText('from-path');

  expect(importCalls).toHaveLength(1);
  expect(importCalls[0].url).toContain('/api/teams/team-1/skills/import');
  expect(importCalls[0].body).toEqual({ localPath: '/Users/you/skills/deploy-to-prod' }); // trim 后单字段
});

test('live 导入 400：弹窗不关，错误行 headline + server 原文 detail', async ({ page }) => {
  await stubBoot(page);
  const { setImportError } = await stubImport(page);
  setImportError(400, 'invalid source: no SKILL.md found in directory /Users/you/skills/broken');
  await page.goto(SKILLS);
  await page.getByTestId('resource-import').click();
  const dialog = page.getByRole('dialog', { name: '导入技能' });
  await dialog.locator('#dlg-skill-import-path').fill('/Users/you/skills/broken');
  await dialog.getByRole('button', { name: '导入', exact: true }).click();

  await expect(dialog).toBeVisible(); // 弹窗不关
  const error = dialog.getByRole('alert');
  await expect(error).toContainText('来源未通过校验');
  await expect(error.locator('span')).toContainText('no SKILL.md found');
  await expect(page.getByTestId('resource-row')).toHaveCount(0); // 列表不添行
});

test('live 导入 409 同名：headline 分译可读', async ({ page }) => {
  await stubBoot(page);
  const { setImportError } = await stubImport(page);
  setImportError(409, 'skill directory deploy already exists');
  await page.goto(SKILLS);
  await page.getByTestId('resource-import').click();
  const dialog = page.getByRole('dialog', { name: '导入技能' });
  await dialog.locator('#dlg-skill-import-url').fill('https://github.com/acme/repo');
  await dialog.getByRole('button', { name: '导入', exact: true }).click();

  await expect(dialog).toBeVisible();
  const error = dialog.getByRole('alert');
  await expect(error).toContainText('同名技能已存在');
  await expect(error.locator('span')).toContainText('already exists');
});
