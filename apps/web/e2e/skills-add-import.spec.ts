import { expect, test } from '@playwright/test';

// Issue #153 acceptance: the skills empty-state 添加技能 primary action is
// wired to the import route — a real click SPA-navigates to
// /app/resources/skills/import with the scenario search riding along
// (#121 Link-family discipline: no bare anchor, no document reload).
// Rides the plain board scenario ('01'), whose fixture carries no
// resources → the skills page renders the empty state.

const SKILLS = '/app/resources/skills?scenario=01';

test('添加技能 SPA-navigates to the import route, scenario rides along', async ({ page }) => {
  await page.goto(SKILLS);

  // marker proves SPA navigation: a bare anchor would reload and drop it
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__spaMarker = 'alive';
  });

  await page.locator('.res-empty .res-primary', { hasText: '添加技能' }).click();

  await expect(page).toHaveURL('/app/resources/skills/import?scenario=01');
  // the import surface really rendered (shell data-route flips to the import href)
  await expect(page.locator('[data-route="/app/resources/skills/import"]')).toBeVisible();
  // and we got there client-side, not through a document reload
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__spaMarker)).toBe(
    'alive',
  );
});
