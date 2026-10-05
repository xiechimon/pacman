import { expect, type Locator, type Page, test } from '@playwright/test';

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

const rootTheme = (page: Page) =>
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
  page: Page,
  locator: Locator,
  route: string,
  box: NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>,
) {
  await expect(page.locator(ROUTE_ANCHOR[route])).toBeVisible();
  await expect.poll(() => locator.boundingBox()).toEqual(box);
}

/** Baseline capture after a fresh goto: anchor on the committed shell,
 *  retry until the box exists, then read the settled value. */
async function captureSidebarBox(
  page: Page,
  locator: Locator,
  route: string,
) {
  await expect(page.locator(ROUTE_ANCHOR[route])).toBeVisible();
  await expect.poll(() => locator.boundingBox()).not.toBeNull();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box as NonNullable<typeof box>;
}

/** Brand-head content anchors. The sidebar's own box is route-invariant (the
 *  hop test below), but the head row's *content* rides a second geometry: the
 *  active pill's inner padding. These three x values are what the eye reads as
 *  图标和字收紧 when /app/team lights the pill, so the hop is pinned on them
 *  too — the row repaints its background, the content holds its x. The toggle
 *  rides the same law from the other side: it is `ml-auto`, so its x is the
 *  row's right edge minus its own margin, and the pill's 8px inset walks it
 *  left unless that margin gives the 8px back (XMON-69). */
const headContentX = (page: Page) =>
  page.evaluate(() => {
    const row = document.querySelector('.sidebar-team-row');
    const mark = row?.querySelector('.sidebar-brand-mark');
    const name = row?.querySelector('.sidebar-team-name');
    const toggle = row?.querySelector('.sidebar-team-collapse');
    if (!row || !mark || !name || !toggle) throw new Error('sidebar brand head missing');
    return {
      iconX: mark.getBoundingClientRect().x,
      nameX: name.getBoundingClientRect().x,
      toggleX: toggle.getBoundingClientRect().x,
    };
  });

test.describe('chief FAB wakes on every shell family', () => {
  const families = [
    { name: 'board', route: '/app?scenario=01', fab: '.chief-fab', gear: true },
    { name: 'pages', route: '/app/schedules?scenario=11', fab: '.page-fab', gear: true },
    {
      name: 'resources',
      route: '/app/resources/skills?scenario=06',
      fab: '[aria-label="总管"]', // #944: .res-fab 类名钩退役 → aria-label 一级
      gear: true,
    },
    { name: 'secondary', route: '/app/team?scenario=12', fab: '.secondary-fab', gear: true },
    {
      name: 'detail',
      // #443: the detail FAB renders only with unread — the row rides the
      // named detail-unread scenario (16's surface + chiefUnread 3), i.e.
      // 先造未读，再断言 FAB 与抽屉; the no-unread face is pinned in
      // chief-fab.spec.ts.
      route: '/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=detail-unread',
      fab: '.detail-fab',
      gear: true,
    },
  ] as const;

  for (const { name, route, fab, gear } of families) {
    test(`${name}: ${fab} opens the drawer, close returns to the surface`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('.chief-drawer')).toHaveCount(0);

      await page.locator(fab).click();
      await expect(page.locator('.chief-drawer')).toBeVisible();
      // #615: the gear rides every surface (chief 设置 reachability was half
      // of the 四连报 — off-board it lands on the board settings view via the
      // ?chief=settings deep link; the board keeps its content swap). The
      // off-board navigation itself is pinned in chief-drawer-model.spec.ts.
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

    await page.locator('.sidebar-row', { hasText: '工作台' }).click();
    await expect(page).toHaveURL('/app?scenario=01');
    await expectSidebarBox(page, sidebar, '/app', boardBox);
  });

  test('the brand head holds its inner geometry across the /app → /app/team hop', async ({
    page,
  }) => {
    await page.goto('/app?scenario=01');
    await expect(page.locator(ROUTE_ANCHOR['/app'])).toBeVisible();
    const board = await headContentX(page);

    await page.locator('.sidebar-team-name').click();
    await expect(page).toHaveURL('/app/team?scenario=01');
    // the active pill repaints the row's background only. The r7 12 pill box
    // (x8 y6 w223 h32) is pinned in sidebar-seam.spec.ts; this is the content
    // *inside* it — the icon and the name must not drift as the pill lights.
    await expect(page.locator(ROUTE_ANCHOR['/app/team'])).toBeVisible();
    await expect.poll(() => headContentX(page)).toEqual(board);
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

    await page.locator('.rail-row[aria-label="工作台"]').click();
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
