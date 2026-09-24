import { expect, type Page, test } from '@playwright/test';

// Wayfinder ticket #176: the new-task dialog's project chip joins the
// anchored-popover family (#67/#127 law: OverlayMount + ClickCatcher +
// Escape; dhead chip-popover / account lang-dropdown precedents). The
// listbox rows come from the project set — live = useProjects truth,
// fixture = the scenario's projectNames (scenario newtask-projects
// carries the r2 session's two projects; scenario 01 has none and falls
// back to the canon default). Selection is pure form state: it backfills
// the chip and rides the submit's projectId, no mutation on its own.
// Each test pins one failure mode:
// 1. the chip opens the project listbox (current state: dead button)
// 2. row click selects, backfills the chip, check moves on reopen
// 3. the no-projectNames scenario falls back to the canon default row
// 4. Escape closes the popover layer first, then the dialog (layer order)
// 5. outside click closes the popover layer only

const PICKER = '/app?scenario=newtask-projects';
const DEFAULT = '/app?scenario=01';

async function openDialog(page: Page, route: string) {
  await page.goto(route);
  await page.locator('.board-new-task').click();
  const dialog = page.locator('.new-task-dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

async function openPopover(page: Page, route: string) {
  const dialog = await openDialog(page, route);
  await dialog.locator('.new-task-project').click();
  const menu = page.locator('.new-task-project-menu');
  await expect(menu).toBeVisible();
  return menu;
}

test('the project chip opens the project listbox with the scenario rows', async ({ page }) => {
  const menu = await openPopover(page, PICKER);
  await expect(menu.locator('.new-task-project-row')).toHaveCount(2);
  await expect(menu.locator('.new-task-project-row').first()).toContainText('r3-lifecycle');
  await expect(menu.locator('.new-task-project-row').nth(1)).toContainText('r2-inventory');
});

test('row click selects and backfills the chip; the check moves on reopen', async ({ page }) => {
  const menu = await openPopover(page, PICKER);
  await menu.locator('.new-task-project-row', { hasText: 'r2-inventory' }).click();
  await expect(page.locator('.new-task-project-menu')).toBeHidden();
  await expect(page.locator('.new-task-project-name')).toHaveText('r2-inventory');

  // reopening shows the selection state: the r2-inventory row carries
  // aria-selected, the canon default row does not
  await page.locator('.new-task-project').click();
  const reopened = page.locator('.new-task-project-menu');
  await expect(reopened).toBeVisible();
  await expect(reopened.locator('.new-task-project-row', { hasText: 'r2-inventory' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(reopened.locator('.new-task-project-row').first()).toHaveAttribute(
    'aria-selected',
    'false',
  );
});

test('a scenario without projectNames falls back to the canon default row', async ({ page }) => {
  const menu = await openPopover(page, DEFAULT);
  const rows = menu.locator('.new-task-project-row');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('r3-lifecycle');
  await expect(rows.first()).toHaveAttribute('aria-selected', 'true');
});

test('Escape closes the popover layer first, then the dialog', async ({ page }) => {
  const menu = await openPopover(page, PICKER);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(page.locator('.new-task-dialog')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('.new-task-dialog')).toBeHidden();
});

test('outside click closes the popover layer only', async ({ page }) => {
  const menu = await openPopover(page, PICKER);
  await page.mouse.click(20, 20);
  await expect(menu).toBeHidden();
  await expect(page.locator('.new-task-dialog')).toBeVisible();
});
