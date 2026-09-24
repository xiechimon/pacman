import { expect, test } from '@playwright/test';

// Issue #147 acceptance: both collapse families are live and persist. The
// sidebar 项目 / 资源 GroupHeaders hide their sub-rows (r2 §1.1) and flip
// their aria to 展开… (r6), in the expanded sidebar and in the rail alike;
// the board's six column collapse buttons shrink their column to the narrow
// dot+count strip (r2 §4, 01d capture) and the strip expands it again.
// Every collapse survives a reload through its localStorage key — the project
// group rides the observed original key shape (pacman.sidebarProjectsCollapsed,
// r2 §1.5), the resource group and the column set the [推断] twins.

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

test('board column collapse shrinks to the strip, keeps the count, survives reload', async ({
  page,
}) => {
  await page.goto('/app?scenario=01');

  const open = page.locator('.board-column[data-column="planning"]');
  await expect(open).toBeVisible();
  const openWidth = (await open.boundingBox())?.width ?? 0;
  expect(openWidth).toBeGreaterThan(200);

  await open.locator('.board-column-collapse').click();

  const collapsed = page.locator('.board-column--collapsed[data-column="planning"]');
  await expect(collapsed).toBeVisible();
  const box = await collapsed.boundingBox();
  expect(box?.width).toBe(40);
  // the strip carries the live count and is the expand trigger
  await expect(collapsed.locator('.board-column-strip')).toHaveAttribute('aria-label', '规划中');
  await expect(collapsed.locator('.board-column-count')).toHaveText(/\d+/);
  // the collapsed column drops out of the drop-target set
  await expect(collapsed.locator('[data-column-list="planning"]')).toHaveCount(0);

  await page.reload();
  await expect(page.locator('.board-column--collapsed[data-column="planning"]')).toBeVisible();

  // the strip expands again, and that sticks too
  await page.locator('.board-column--collapsed[data-column="planning"] .board-column-strip').click();
  await expect(page.locator('.board-column[data-column="planning"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('.board-column--collapsed[data-column="planning"]')).toHaveCount(0);
});

test('both families persist side by side', async ({ page }) => {
  await page.goto('/app?scenario=01');
  await page.locator('.sidebar-group', { hasText: '资源' }).click();
  await page.locator('.board-column[data-column="done"] .board-column-collapse').click();

  await page.reload();
  await expect(page.locator('.sidebar-subrow', { hasText: '技能' })).toHaveCount(0);
  await expect(page.locator('.board-column--collapsed[data-column="done"]')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('pacman.sidebarResourcesCollapsed'))).toBe(
    '1',
  );
  expect(await page.evaluate(() => localStorage.getItem('pacman.boardCollapsedColumns'))).toBe(
    'done',
  );
});
