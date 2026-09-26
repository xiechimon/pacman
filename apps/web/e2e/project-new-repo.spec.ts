import { expect, type Page, test } from '@playwright/test';

// Issue #305 (M7-W2 档 1): the 新建项目 page's 「选择仓库」 row was a
// rendered-dead placeholder (M7 ledger; the M5 note deferred it to this
// ticket). It now opens an anchored repo-selection popover (family law
// #67/#127: OverlayMount + ClickCatcher + Escape, #176 chip-popover /
// TasksMenuButton precedents). Rows = the two repo forms the create
// endpoint accepts (02 §3): 新的 Todos 托管仓库 (hosted, the effective
// default an untouched form submits) and GitHub 仓库 (owner/repo input
// where the trigger row becomes an editable field). Selection is pure
// form state (live submit carries it: hosted → repoKind hosted,
// github → repoKind github + githubRepo — pinned on the live stack by
// verify-pacman, not here). Each test pins one failure mode:
// 1. the trigger opens the repo listbox (current state: dead button)
// 2. the hosted row selects and backfills the trigger label
// 3. the GitHub row swaps the trigger for the owner/repo input
// 4. the swap button reopens the listbox; returning to hosted drops the
//    input (no stale github state rides the submit)
// 5. Escape closes the popover

const NEW_PROJECT = '/app/project/new?scenario=01';

async function openMenu(page: Page) {
  await page.goto(NEW_PROJECT);
  await page.locator('#prj-new-repo').click();
  const menu = page.locator('.prj-new-repo-menu');
  await expect(menu).toBeVisible();
  return menu;
}

test('the 选择仓库 trigger opens the repo listbox with both forms', async ({ page }) => {
  const menu = await openMenu(page);
  const rows = menu.locator('.prj-new-repo-menu-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('新的 Todos 托管仓库');
  await expect(rows.nth(1)).toContainText('GitHub 仓库');
  // untouched = no row selected (aria-selected ≡ check rendering mirrors the
  // user's act; the untouched form's hosted submit default is body-layer
  // behavior, not selection state)
  await expect(rows.first()).toHaveAttribute('aria-selected', 'false');
  await expect(rows.nth(1)).toHaveAttribute('aria-selected', 'false');
});

test('the hosted row selects and backfills the trigger label', async ({ page }) => {
  const menu = await openMenu(page);
  await menu.locator('.prj-new-repo-menu-row', { hasText: '新的 Todos 托管仓库' }).click();
  await expect(page.locator('.prj-new-repo-menu')).not.toBeVisible();
  await expect(page.locator('#prj-new-repo')).toContainText('新的 Todos 托管仓库');
});

test('the GitHub row swaps the trigger for the owner/repo input', async ({ page }) => {
  const menu = await openMenu(page);
  await menu.locator('.prj-new-repo-menu-row', { hasText: 'GitHub 仓库' }).click();
  await expect(page.locator('.prj-new-repo-menu')).not.toBeVisible();
  const input = page.locator('#prj-new-repo');
  await expect(input).toHaveAttribute('placeholder', 'owner/repo');
  await input.fill('xiechimon/pacman');
  await expect(input).toHaveValue('xiechimon/pacman');
});

test('the swap button reopens the listbox; hosted return drops the input', async ({ page }) => {
  const menu = await openMenu(page);
  await menu.locator('.prj-new-repo-menu-row', { hasText: 'GitHub 仓库' }).click();
  await page.locator('.prj-new-repo-swap').click();
  const reopened = page.locator('.prj-new-repo-menu');
  await expect(reopened).toBeVisible();
  await expect(reopened.locator('.prj-new-repo-menu-row', { hasText: 'GitHub 仓库' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await reopened.locator('.prj-new-repo-menu-row', { hasText: '新的 Todos 托管仓库' }).click();
  await expect(page.locator('#prj-new-repo')).toContainText('新的 Todos 托管仓库');
  await expect(page.locator('.prj-new-repo-input')).toHaveCount(0);
});

test('Escape closes the repo popover', async ({ page }) => {
  await openMenu(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.prj-new-repo-menu')).not.toBeVisible();
});
