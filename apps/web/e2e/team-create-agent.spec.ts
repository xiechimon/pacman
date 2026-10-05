import { expect, type Page, test } from '@playwright/test';

// Issue #170: the team-page 创建 Agent slot joins the dialog family. The
// dialog rides DialogShell (#68 family law: X / Esc / backdrop close), the
// form is name-first (r2 §8.1 capture 20: 标题/头像行/名称/服务商告警+
// 配置链接/创建), and fixture submission follows the accept-dialog
// precedent (#148: close-on-submit, no backend). Each test pins one
// failure mode:
// 1. the slot button opens the dialog (current state: dead button)
// 2. family-law close: X / Esc / backdrop, panel clicks survive
// 3. empty name keeps 创建 disabled; typing lifts it (r2 07 muted indigo)
// 4. fixture submit closes the dialog
// 5. chart layout drops the grid slot for the org chart's own dashed create
//    node (r2 §8.1 17c + #490)
// 6. 配置服务商 SPA-navigates to the providers route, scenario rides
//    along (#121 Link discipline)

const TEAM = '/app/team?scenario=12';

async function openDialog(page: Page) {
  await page.goto(TEAM);
  await page.getByRole('button', { name: '创建 Agent' }).click();
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  return dialog;
}

test('the 创建 Agent slot opens the dialog', async ({ page }) => {
  const dialog = await openDialog(page);
  await expect(dialog.locator('.dlg-title')).toHaveText('创建 agent');
  await expect(dialog.locator('#dlg-agent-name')).toBeVisible();
  await expect(dialog.locator('.dlg-agent-warn')).toBeVisible();
});

test('family law: X, Escape and backdrop dismiss; panel clicks do not', async ({ page }) => {
  let dialog = await openDialog(page);
  await dialog.locator('.dlg-close').click();
  await expect(page.locator('.dlg')).toBeHidden();

  dialog = await openDialog(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.dlg')).toBeHidden();

  dialog = await openDialog(page);
  await dialog.locator('.dlg-title').click();
  await expect(page.locator('.dlg')).toBeVisible();
  await page.mouse.click(20, 20);
  await expect(page.locator('.dlg')).toBeHidden();
});

test('empty name keeps 创建 disabled; typing lifts it; fixture submit closes', async ({ page }) => {
  const dialog = await openDialog(page);
  const create = dialog.locator('.dlg-agent-create');
  await expect(create).toBeDisabled();
  await dialog.locator('#dlg-agent-name').fill('r7 probe agent');
  await expect(create).toBeEnabled();
  await create.click();
  await expect(page.locator('.dlg')).toBeHidden();
});

test('chart layout drops the grid 创建 Agent slot for the org chart', async ({ page }) => {
  await page.goto(TEAM);
  await page.getByRole('tab', { name: 'chart' }).click();
  // scenario 12 的团队有 1 个成员 —— chart 出组织图（#490），不再是恒定的
  // 暂无成员。grid 的 创建 Agent 槽位在 chart 下不渲染（整格退场 =
  // team-agent-grid 容器 0 计），创建位改由组织图子列末位的虚线节点承接
  // （同名 创建 Agent 钮，#947/#910 载体）。
  await expect(page.getByTestId('team-chart-node')).toHaveCount(1);
  await expect(page.getByText('暂无成员')).toHaveCount(0);
  await expect(page.getByTestId('team-agent-grid')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '创建 Agent' })).toBeVisible();
});

test('配置服务商 SPA-navigates to the providers route, scenario rides along', async ({ page }) => {
  const dialog = await openDialog(page);
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__spaMarker = 'alive';
  });
  await dialog.locator('.dlg-agent-configure').click();
  await expect(page).toHaveURL('/app/resources/providers?scenario=12');
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__spaMarker)).toBe(
    'alive',
  );
});
