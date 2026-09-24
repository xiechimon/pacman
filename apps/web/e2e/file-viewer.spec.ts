import { expect, test } from '@playwright/test';

// Issue #202: 项目页文件查看器接线(点行 → viewer 出内容)。数据双面:
// fixture 面 = ProjectContent.fileContents 供肉(records.ts/fixtures.ts);
// live 面 = GET /api/projects/{id}/file?path=&ref=(routes.ts:442,
// INFERRED_ROUTES 已登记,本票 server 零改动)。钉死的失败方式:
// 1. 点行无反应 — 行必须带 --active 选中态、viewer 必须出 fixture 内容;
// 2. 选中后占位文案必须隐去(占位/内容两态互斥);
// 3. 文件|历史 seg 往返 — 选中态与内容必须保持(state 由 ProjectPage 持有);
// 4. 未选中初态 — 占位文案在、无 --active 行(dead-buttons 行可见性同存)。

const PROJ = '/app/project/ZAQczKCu0MOAzC1ZqcFlX?scenario=r2-24';

test('viewer opens with the placeholder and no selected row', async ({ page }) => {
  await page.goto(PROJ);
  await expect(page.locator('.prj-file-row').first()).toBeVisible();
  await expect(page.locator('.prj-files-viewer')).toContainText('请选择一个文件查看');
  await expect(page.locator('.prj-file-row--active')).toHaveCount(0);
});

test('clicking a file row selects it and renders the file content', async ({ page }) => {
  await page.goto(PROJ);
  const row = page.locator('.prj-file-row', { hasText: 'README.md' });
  await row.click();
  await expect(row).toHaveClass(/prj-file-row--active/);
  const viewer = page.locator('.prj-files-viewer');
  await expect(viewer.locator('.prj-file-content')).toBeVisible();
  await expect(viewer).toContainText('托管演示仓');
  await expect(viewer).not.toContainText('请选择一个文件查看');
});

test('selection survives a files/history seg round-trip', async ({ page }) => {
  await page.goto(PROJ);
  const row = page.locator('.prj-file-row', { hasText: 'README.md' });
  await row.click();
  await expect(page.locator('.prj-file-content')).toContainText('托管演示仓');
  await page.locator('.prj-files-seg-tab', { hasText: '历史' }).click();
  await expect(page.locator('.prj-history-row').first()).toBeVisible();
  await page.locator('.prj-files-seg-tab', { hasText: '文件' }).click();
  await expect(row).toHaveClass(/prj-file-row--active/);
  await expect(page.locator('.prj-file-content')).toContainText('托管演示仓');
});
