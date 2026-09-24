import { expect, test } from '@playwright/test';

// Issue #129 acceptance: shell consistency + local-first 净化 —
//   1. every family's 总管 FAB (board / pages / resources / secondary /
//      detail) wakes the same chief drawer, and closes it again;
//   2. the sidebar keeps identical geometry across /app ↔ /app/team ↔
//      resources hops — including the collapsed rail, whose state now
//      rides every shell (storage-backed) instead of only the board;
//   3. the team route carries no SaaS subscription surface (plan badge /
//      upgrade link);
//   4. a boot without stored theme follows the system prefers-color-scheme,
//      while a stored value always wins.

const THEME_KEY = 'pacman-theme'; // apps/web/src/theme.ts THEME_STORAGE_KEY
const SIDEBAR_KEY = 'pacman.sidebar-collapsed'; // apps/web/src/board/app-sidebar.tsx

const rootTheme = (page: import('@playwright/test').Page) =>
  page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    light: document.documentElement.classList.contains('light'),
  }));

/** Route-commit anchors: toHaveURL flips before React commits the new
 *  shell, and boundingBox() is a one-shot sample — measuring in that gap
 *  can catch the old sidebar node detached (null box). Each anchor only
 *  exists once the target route's shell has rendered, so waiting on it
 *  makes the measurement below deterministic. */
const ROUTE_ANCHOR: Record<string, string> = {
  '/app': '[data-route="board"]',
  '/app/team': '[data-route="team"]',
  '/app/schedules': '.page-shell',
  '/app/resources/skills': '[data-route="/app/resources/skills"]',
};

/** Assert the sidebar box on `route` matches `box`: wait for the route's
 *  shell to commit, then retry the (one-shot) measurement until it equals
 *  — covering both the detach gap and any mid-transition sample. */
async function expectSidebarBox(
  page: import('@playwright/test').Page,
  locator: import('@playwright/test').Locator,
  route: string,
  box: NonNullable<Awaited<ReturnType<import('@playwright/test').Locator['boundingBox']>>>,
) {
  await expect(page.locator(ROUTE_ANCHOR[route])).toBeVisible();
  await expect.poll(() => locator.boundingBox()).toEqual(box);
}

/** Baseline capture after a fresh goto: anchor on the committed shell,
 *  retry until the box exists, then read the settled value. */
async function captureSidebarBox(
  page: import('@playwright/test').Page,
  locator: import('@playwright/test').Locator,
  route: string,
) {
  await expect(page.locator(ROUTE_ANCHOR[route])).toBeVisible();
  await expect.poll(() => locator.boundingBox()).not.toBeNull();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box as NonNullable<typeof box>;
}

test.describe('chief FAB wakes on every shell family', () => {
  const families = [
    { name: 'board', route: '/app?scenario=01', fab: '.chief-fab', gear: true },
    { name: 'pages', route: '/app/schedules?scenario=11', fab: '.page-fab', gear: false },
    {
      name: 'resources',
      route: '/app/resources/skills?scenario=06',
      fab: '.res-fab',
      gear: false,
    },
    { name: 'secondary', route: '/app/team?scenario=12', fab: '.secondary-fab', gear: false },
    {
      name: 'detail',
      route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=16',
      fab: '.detail-fab',
      gear: false,
    },
  ] as const;

  for (const { name, route, fab, gear } of families) {
    test(`${name}: ${fab} opens the drawer, close returns to the surface`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('.chief-drawer')).toHaveCount(0);

      await page.locator(fab).click();
      await expect(page.locator('.chief-drawer')).toBeVisible();
      // the settings gear is the board route's content-swap affordance;
      // the shared wake surfaces keep the drawer-only head
      await expect(page.locator('.chief-drawer button[aria-label="总管设置"]')).toHaveCount(
        gear ? 1 : 0,
      );

      await page.locator('.chief-drawer button[aria-label="关闭"]').click();
      await expect(page.locator('.chief-drawer')).toBeHidden();
    });
  }
});

test.describe('sidebar form is route-invariant', () => {
  test('expanded sidebar keeps identical geometry across /app ↔ /app/team ↔ resources hops', async ({
    page,
  }) => {
    await page.goto('/app?scenario=01');
    const sidebar = page.locator('.board-sidebar');
    const boardBox = await captureSidebarBox(page, sidebar, '/app');

    await page.locator('.sidebar-team-name').click();
    await expect(page).toHaveURL('/app/team?scenario=01');
    await expectSidebarBox(page, sidebar, '/app/team', boardBox);

    await page.locator('.sidebar-subrow', { hasText: '技能' }).click();
    await expect(page).toHaveURL('/app/resources/skills?scenario=01');
    await expectSidebarBox(page, sidebar, '/app/resources/skills', boardBox);

    await page.locator('.sidebar-row', { hasText: '看板' }).click();
    await expect(page).toHaveURL('/app?scenario=01');
    await expectSidebarBox(page, sidebar, '/app', boardBox);
  });

  test('collapsed rail survives route hops (storage-backed on every shell)', async ({ page }) => {
    await page.addInitScript((k) => localStorage.setItem(k, '1'), SIDEBAR_KEY);
    await page.goto('/app?scenario=03');
    const rail = page.locator('.board-sidebar--collapsed');
    const railBox = await captureSidebarBox(page, rail, '/app');

    await page.locator('.rail-row[aria-label="技能"]').click();
    await expect(page).toHaveURL('/app/resources/skills?scenario=03');
    // the rail box (40px) doubles as the collapsed-state probe: an
    // expanded sidebar on the new route would never equal it
    await expectSidebarBox(page, rail, '/app/resources/skills', railBox);

    await page.locator('.rail-row[aria-label="定时"]').click();
    await expect(page).toHaveURL('/app/schedules?scenario=03');
    await expectSidebarBox(page, rail, '/app/schedules', railBox);
  });

  test('the collapse toggle works off-board and the state rides back', async ({ page }) => {
    await page.goto('/app/team?scenario=12');
    await expect(page.locator('[data-route="team"]')).toBeVisible();
    await page.locator('.sidebar-team-collapse').click();
    await expect(page.locator('.board-sidebar--collapsed')).toBeVisible();
    // the toggle writes storage synchronously before its state flip; poll
    // keeps the read conditional regardless of commit ordering
    await expect
      .poll(() => page.evaluate((k) => localStorage.getItem(k), SIDEBAR_KEY))
      .toBe('1');

    await page.locator('.rail-row[aria-label="看板"]').click();
    await expect(page).toHaveURL('/app?scenario=12');
    await expect(page.locator('[data-route="board"]')).toBeVisible();
    await expect(page.locator('.board-sidebar--collapsed')).toBeVisible();
  });
});

test('team route carries no subscription surface', async ({ page }) => {
  await page.goto('/app/team?scenario=12');
  await expect(page.locator('.team-plan')).toHaveCount(0);
  await expect(page.locator('.team-upgrade')).toHaveCount(0);
  const body = await page.locator('body').innerText();
  expect(body).not.toContain('FREE');
  expect(body).not.toContain('升级');
});

test.describe('theme default follows the system', () => {
  test('no storage + system light boots light', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/app?scenario=01');
    expect(await rootTheme(page)).toEqual({ theme: 'light', light: true });
  });

  test('no storage + system dark boots dark', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/app?scenario=01');
    expect(await rootTheme(page)).toEqual({ theme: 'dark', light: false });
  });

  test('a stored theme beats the system scheme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.addInitScript((k) => localStorage.setItem(k, 'dark'), THEME_KEY);
    await page.goto('/app?scenario=01');
    expect(await rootTheme(page)).toEqual({ theme: 'dark', light: false });
  });
});
