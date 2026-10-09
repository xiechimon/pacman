import { expect, test } from '@playwright/test';

// Issue #202: 项目页文件查看器接线(点行 → viewer 出内容)。数据双面:
// fixture 面 = ProjectContent.fileContents 供肉(records.ts/fixtures.ts);
// live 面 = GET /api/projects/{id}/file?path=&ref=(routes.ts:442,
// INFERRED_ROUTES 已登记,本票 server 零改动)。钉死的失败方式:
// 1. 点行无反应 — 行必须带选中态(载体 aria-current,#910 裁定 3)、viewer
//    必须出 fixture 内容;
// 2. 选中后占位文案必须隐去(占位/内容两态互斥);
// 3. 文件|历史 seg 往返 — 选中态与内容必须保持(state 由 ProjectPage 持有);
// 4. 未选中初态 — 占位文案在、无选中行(dead-buttons 行可见性同存)。
// #946/#910 载体:文件行 = role=button+文件名精确名(topbar 任务|文件 是
// role=tab,不撞);内容 = pre 一级 text;历史行 = role=listitem;seg =
// role=button+文案。

const PROJ = '/app/project/ZAQczKCu0MOAzC1ZqcFlX?scenario=r2-24';

test('viewer opens with the placeholder and no selected row', async ({ page }) => {
  await page.goto(PROJ);
  const row = page.getByRole('button', { name: 'README.md', exact: true });
  await expect(row).toBeVisible();
  await expect(page.getByText('请选择一个文件查看')).toBeVisible();
  await expect(row).not.toHaveAttribute('aria-current', 'true');
});

test('clicking a file row selects it and renders the file content', async ({ page }) => {
  await page.goto(PROJ);
  const row = page.getByRole('button', { name: 'README.md', exact: true });
  await row.click();
  await expect(row).toHaveAttribute('aria-current', 'true');
  await expect(page.getByText('托管演示仓')).toBeVisible();
  await expect(page.getByText('请选择一个文件查看')).toHaveCount(0);
});

test('selection survives a files/history seg round-trip', async ({ page }) => {
  await page.goto(PROJ);
  const row = page.getByRole('button', { name: 'README.md', exact: true });
  await row.click();
  await expect(page.getByText('托管演示仓')).toBeVisible();
  await page.locator('.prj-files').getByRole('tab', { name: '历史', exact: true }).click();
  await expect(page.getByRole('listitem').first()).toBeVisible();
  await page.locator('.prj-files').getByRole('tab', { name: '文件', exact: true }).click();
  await expect(row).toHaveAttribute('aria-current', 'true');
  await expect(page.getByText('托管演示仓')).toBeVisible();
});
