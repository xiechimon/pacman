import { expect, test } from '@playwright/test';

// Issue #147 acceptance: the sidebar collapse family is live and persists.
// The 项目 / 资源 GroupHeaders hide their sub-rows (r2 §1.1) and flip their
// aria to 展开… (r6), in the expanded sidebar and in the rail alike. Every
// collapse survives a reload through its localStorage key — the project
// group rides the observed original key shape (pacman.sidebarProjectsCollapsed,
// r2 §1.5), the resource group the [推断] twin.
// (#351 裁定：看板列收起全家随 6→4 列收敛删除——列收起钮/窄条/持久键
// 不复存在，本 spec 只保留侧栏族。)

test('sidebar group collapse hides sub-rows, flips aria, survives reload', async ({ page }) => {
  await page.goto('/app?scenario=01');

  const header = page.locator('.sidebar-group', { hasText: '项目' });
  const newProject = page.locator('.sidebar-subrow', { hasText: '新建项目' });
  await expect(header).toHaveAttribute('aria-label', '收起项目');
  await expect(newProject).toBeVisible();

  await header.click();
  await expect(header).toHaveAttribute('aria-label', '展开项目');
  await expect(header).toHaveAttribute('aria-expanded', 'false');
  await expect(newProject).toHaveCount(0);
  // chevron tracks the collapse: down open, right collapsed
  await expect
    .poll(() =>
      page
        .locator('.sidebar-group--collapsed .sidebar-group-chevron')
        .evaluate((el) => getComputedStyle(el).transform),
    )
    .toBe('matrix(0, -1, 1, 0, 0, 0)');
  // the 资源 group stays open — the collapses are per-group
  await expect(page.locator('.sidebar-subrow', { hasText: '技能' })).toBeVisible();

  await page.reload();
  await expect(page.locator('.sidebar-group', { hasText: '项目' })).toHaveAttribute(
    'aria-label',
    '展开项目',
  );
  await expect(page.locator('.sidebar-subrow', { hasText: '新建项目' })).toHaveCount(0);

  // expand again and that sticks too
  await page.locator('.sidebar-group', { hasText: '项目' }).click();
  await page.reload();
  await expect(page.locator('.sidebar-subrow', { hasText: '新建项目' })).toBeVisible();
});

test('rail group collapse hides member rows and survives reload', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pacman.sidebar-collapsed', '1'));
  await page.goto('/app?scenario=03');

  const chevron = page.locator('.rail-group[aria-label="收起资源"]');
  await expect(page.locator('.rail-row[aria-label="技能"]')).toBeVisible();

  await chevron.click();
  await expect(page.locator('.rail-group[aria-label="展开资源"]')).toBeVisible();
  await expect(page.locator('.rail-row[aria-label="技能"]')).toHaveCount(0);
  // the 项目 member row is untouched
  await expect(page.locator('.rail-row .project-avatar')).toBeVisible();

  await page.reload();
  await expect(page.locator('.rail-group[aria-label="展开资源"]')).toBeVisible();
  await expect(page.locator('.rail-row[aria-label="技能"]')).toHaveCount(0);
});

test('both sidebar groups persist side by side', async ({ page }) => {
  await page.goto('/app?scenario=01');
  await page.locator('.sidebar-group', { hasText: '资源' }).click();
  await page.locator('.sidebar-group', { hasText: '项目' }).click();

  await page.reload();
  await expect(page.locator('.sidebar-subrow', { hasText: '技能' })).toHaveCount(0);
  await expect(page.locator('.sidebar-subrow', { hasText: '新建项目' })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('pacman.sidebarResourcesCollapsed'))).toBe(
    '1',
  );
  expect(await page.evaluate(() => localStorage.getItem('pacman.sidebarProjectsCollapsed'))).toBe(
    '1',
  );
});
