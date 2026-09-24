import { expect, type Locator, type Page, test } from '@playwright/test';

// Issue #121 acceptance: the sidebar nav family (rail + expanded rows,
// team name, 新建项目) are react-router Links — clicks navigate
// client-side with no document reload, the URL/pill/aria-current follow,
// and the fixture ?scenario= survives the hop. The 安装 App entries are
// gone from both sidebar states and /zh/install takes the registered
// unmatched-path redirect to /app. Non-selected rows tint the
// --sidebar-hover pill on hover in both themes (#128 cds alpha ladder over
// the sidebar layer); the selected row keeps its deeper --sidebar-selected
// pill under hover.

declare global {
  interface Window {
    __spaCanary?: string;
  }
}

/** Computed background of a row's ::before pill layer. */
function pillBg(locator: Locator) {
  return locator.evaluate((el) => getComputedStyle(el, '::before').backgroundColor);
}

/** Plant the canary after load; any document navigation wipes it. */
async function plantCanary(page: Page) {
  await page.evaluate(() => {
    window.__spaCanary = 'alive';
  });
}

test('nav rows hop client-side: no reload, pill + aria-current follow', async ({ page }) => {
  await page.goto('/app?scenario=01');
  await plantCanary(page);

  const schedules = page.locator('.sidebar-row', { hasText: '定时' });
  await schedules.click();

  await expect(page).toHaveURL('/app/schedules?scenario=01');
  expect(await page.evaluate(() => window.__spaCanary)).toBe('alive');
  await expect(schedules).toHaveClass(/sidebar-row--selected/);
  await expect(schedules).toHaveAttribute('aria-current', 'page');

  const board = page.locator('.sidebar-row', { hasText: '看板' });
  await expect(board).not.toHaveClass(/sidebar-row--selected/);
  await expect(board).not.toHaveAttribute('aria-current', 'page');
});

test('subrow and team name hop client-side too', async ({ page }) => {
  await page.goto('/app?scenario=01');
  await plantCanary(page);

  await page.locator('.sidebar-subrow', { hasText: '技能' }).click();
  await expect(page).toHaveURL('/app/resources/skills?scenario=01');
  expect(await page.evaluate(() => window.__spaCanary)).toBe('alive');

  await page.locator('.sidebar-team-name').click();
  await expect(page).toHaveURL('/app/team?scenario=01');
  expect(await page.evaluate(() => window.__spaCanary)).toBe('alive');
  await expect(page.locator('.sidebar-team-row')).toHaveClass(/sidebar-team-row--active/);
});

test('rail rows hop client-side', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pacman.sidebar-collapsed', '1'));
  await page.goto('/app?scenario=03');
  await plantCanary(page);

  await page.locator('.rail-row[aria-label="定时"]').click();
  await expect(page).toHaveURL('/app/schedules?scenario=03');
  expect(await page.evaluate(() => window.__spaCanary)).toBe('alive');
});

test('安装 App entries are gone from both sidebar states', async ({ page }) => {
  await page.goto('/app?scenario=01');
  await expect(page.locator('.sidebar-install')).toHaveCount(0);
  await expect(page.locator('a[href^="/zh/install"]')).toHaveCount(0);
  await expect(page.locator('.sidebar-user')).toBeVisible();
});

test('collapsed rail carries no install icon', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pacman.sidebar-collapsed', '1'));
  await page.goto('/app?scenario=03');
  await expect(page.locator('.rail-install')).toHaveCount(0);
  await expect(page.locator('.rail-row[aria-label="定时"]')).toBeVisible();
});

test('/zh/install redirects to /app (unmatched-path divergence, 01 §8)', async ({ page }) => {
  await page.goto('/zh/install');
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.locator('.board-sidebar')).toBeVisible();
});

test('hover tints the row pill — dark default + light theme', async ({ page }) => {
  await page.goto('/app?scenario=01');
  const row = page.locator('.sidebar-row', { hasText: '定时' });

  expect(await pillBg(row)).toBe('rgba(0, 0, 0, 0)');
  await row.hover();
  // --sidebar-hover dark = 5% white over the sidebar layer (#128), reached
  // over the 150ms color step
  await expect.poll(() => pillBg(row)).toBe('rgba(255, 255, 255, 0.05)');

  await page.addInitScript(() => localStorage.setItem('pacman-theme', 'light'));
  await page.goto('/app?scenario=01');
  const lightRow = page.locator('.sidebar-row', { hasText: '定时' });
  await lightRow.hover();
  // --sidebar-hover light = 5% warm ink
  await expect.poll(() => pillBg(lightRow)).toBe('rgba(28, 25, 23, 0.05)');
});

test('rail hover tints the 24px pill', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pacman.sidebar-collapsed', '1'));
  await page.goto('/app?scenario=03');
  const row = page.locator('.rail-row[aria-label="定时"]');

  expect(await pillBg(row)).toBe('rgba(0, 0, 0, 0)');
  await row.hover();
  await expect.poll(() => pillBg(row)).toBe('rgba(255, 255, 255, 0.05)');
});

test('selected row keeps its own pill under hover', async ({ page }) => {
  await page.goto('/app?scenario=01');
  const board = page.locator('.sidebar-row', { hasText: '看板' });
  await expect(board).toHaveClass(/sidebar-row--selected/);

  await board.hover();
  // past the 150ms step: the ::before layer keeps the deeper selected tint
  // (--sidebar-selected, #128) — hover must not wash it back to the hover
  // step
  await page.waitForTimeout(250);
  expect(await pillBg(board)).toBe('rgba(255, 255, 255, 0.1)');
  await expect(board).toHaveClass(/sidebar-row--selected/);
});
