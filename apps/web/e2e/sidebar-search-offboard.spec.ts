import { expect, test } from '@playwright/test';

// Issue #134 residual AC: the ⌘K search row must open the shared panel on
// EVERY route, not just the board. The implementation landed with #129's
// AppSidebar (board/detail keep their own fixture-driven panels via
// searchPanel={false}; every other shell rides AppSidebar's internal
// SearchPanel); these cases pin the off-board wiring so a future shell
// that bypasses AppSidebar — or drops the internal panel — goes red.
// Real click on the sidebar search row, panel opens (role=dialog),
// Esc closes it (useSearchState contract). The collapse-toggle AC of #134
// is already asserted in shell-consistency.spec.ts ("the collapse toggle
// works off-board and the state rides back").

const panel = (page: import('@playwright/test').Page) => page.locator('.search-panel');

for (const [name, url] of [
  ['secondary', '/app/team?scenario=12'],
  ['resources', '/app/resources/skills?scenario=06'],
] as const) {
  test(`${name} page: search row opens the shared panel, Esc closes it`, async ({ page }) => {
    await page.goto(url);
    await expect(panel(page)).toBeHidden();

    await page.locator('.sidebar-row', { hasText: '搜索' }).click();
    await expect(panel(page)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(panel(page)).toBeHidden();
  });
}
