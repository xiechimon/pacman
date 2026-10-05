import { expect, type Page, test } from '@playwright/test';

// Issue #133 acceptance: the absolutely-positioned title bands of the
// secondary and resources shells are pure labels — the same law the
// board/pages topbar titles already carry (#66 precedent: the band spans
// the whole topbar, so it must not own the hit-test over the back chevron
// or the right-side actions). Real-click navigation per family:
// .secondary-back is a client-side Link (carries the scenario search
// home); .res-back/.res-new are plain anchors (full-document navigation,
// no search carry-over).

/** The element must own the hit-test at its own center — the title band
 *  (or anything else) may not sit above it. Same law as the
 *  expectMenuOnTop precedent in user-menu-trigger.spec.ts. */
async function expectOwnsCenter(
  page: Page,
  selector: string,
) {
  const owned = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return top != null && top.closest(sel) != null;
  }, selector);
  expect(owned).toBe(true);
}

// secondary family (r7 12/13 + the named smoke scenarios): the back Link
// rides the shell on every page and carries the scenario search home.
for (const [route, scenario] of [
  ['/app/team', '12'],
  ['/app/account', '13'],
  ['/app/api-keys', 'api-keys'],
] as const) {
  test(`secondary back owns its hit area and navigates home — ${route}`, async ({ page }) => {
    await page.goto(`${route}?scenario=${scenario}`);
    await expectOwnsCenter(page, '.secondary-back');
    await page.locator('.secondary-back').click();
    await expect(page).toHaveURL(`/app?scenario=${scenario}`);
  });
}

test('team right-slot action owns its hit area (设置 slot under the same band)', async ({ page }) => {
  await page.goto('/app/team?scenario=12');
  const right = page.locator('.secondary-head-right');
  expect(await right.count()).toBeGreaterThan(0);
  await expectOwnsCenter(page, '.secondary-head-right');
});

// resources family (r7 06–10, one shared fixture set): the band law covers
// the back chevron and, where present, the 新建 action (machines/mcp hide
// it). #944/#910 载体：.res-back → aria-label 一级；.res-new →
// resource-new testid（hit-test 探针按 CSS 选择器认领元素，role 定位表达
// 不了——二级载体的正当位）；every route's back really navigates.
for (const [route, scenario, backTo] of [
  ['/app/resources/skills', '06', '/app'],
  ['/app/resources/mcp-servers', '07', '/app'],
  ['/app/resources/secrets', '08', '/app'],
  ['/app/resources/machines', '09', '/app'],
  ['/app/resources/providers', '10', '/app'],
] as const) {
  test(`resources topbar actions own their hit areas, back navigates — ${route}`, async ({ page }) => {
    await page.goto(`${route}?scenario=${scenario}`);
    await expectOwnsCenter(page, '[aria-label="返回"]');
    if (await page.locator('[data-testid="resource-new"]').count()) {
      await expectOwnsCenter(page, '[data-testid="resource-new"]');
    }
    await page.locator('[aria-label="返回"]').click();
    await expect(page).toHaveURL(backTo);
  });
}
