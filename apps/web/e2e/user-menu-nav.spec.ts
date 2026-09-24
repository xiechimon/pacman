import { expect, type Page, test } from '@playwright/test';

// Issue #163 acceptance: the user-menu rows are real navigation — 帐号 /
// API 密钥 / MCP render as SPA Links to their real routes with the current
// location.search riding along (#121 Link-family discipline: no bare
// anchor, no document reload), and the menu closes on the hop (the target
// route remounts the sidebar). Rows without a local-first surface
// (新功能 / 快捷键) are hidden — dead-buttons.spec.ts pins their absence.

const BOARD = '/app?scenario=01';

async function openMenu(page: Page) {
  await page.goto(BOARD);
  // marker proves SPA navigation: a bare anchor would reload and drop it
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__spaMarker = 'alive';
  });
  await page.locator('.sidebar-user').click();
  await expect(page.locator('.user-menu')).toBeVisible();
}

const NAV_ROWS = [
  { label: '帐号', url: '/app/account?scenario=01', route: '[data-route="account"]' },
  { label: 'API 密钥', url: '/app/api-keys?scenario=01', route: '[data-route="api-keys"]' },
  {
    label: 'MCP',
    url: '/app/resources/mcp-servers?scenario=01',
    route: '[data-route="/app/resources/mcp-servers"]',
  },
] as const;

for (const row of NAV_ROWS) {
  test(`「${row.label}」row SPA-navigates to ${row.url}`, async ({ page }) => {
    await openMenu(page);

    const link = page.locator('.user-menu-row', { hasText: row.label });
    // rendered as a real link carrying the live search — not a dead div
    await expect(link).toHaveAttribute('href', row.url);

    await link.click();
    await expect(page).toHaveURL(row.url);
    // the target surface really rendered
    await expect(page.locator(row.route)).toBeVisible();
    // and the menu closed on the hop
    await expect(page.locator('.user-menu')).toBeHidden();
    // client-side, not through a document reload
    expect(
      await page.evaluate(() => (window as unknown as Record<string, unknown>).__spaMarker),
    ).toBe('alive');
  });
}
