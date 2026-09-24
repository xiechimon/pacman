import { expect, test } from '@playwright/test';

// Issue #127 acceptance: the sidebar avatar chips (expanded .sidebar-user
// and rail .rail-user) open the user-menu popover on a real click — toggle
// on the chip, close on outside click and Esc, the anchored-overlay family
// affordances — at the capture-frozen 224×272 @ (8,410) geometry (r7
// 17/16d, §3.5). The 外观 segment (#122) is reachable from the
// click-opened menu, so the theme switch is no longer behind a
// fixture-only door. Rides menu-less scenarios ('01', '17b'): every open
// state here comes from the trigger, never the fixture flag.

const BOARD = '/app?scenario=01';
const THEME_KEY = 'pacman-theme'; // apps/web/src/theme.ts THEME_STORAGE_KEY

const menu = (page: import('@playwright/test').Page) => page.locator('.user-menu');

/** The menu must own the hit-test at its own center — nothing (click
 *  catcher, board content, rail clipping) may sit above the panel. */
async function expectMenuOnTop(page: import('@playwright/test').Page) {
  const box = await menu(page).boundingBox();
  expect(box).not.toBeNull();
  const top = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.closest('.user-menu') != null,
    [box!.x + box!.width / 2, box!.y + box!.height / 2] as const,
  );
  expect(top).toBe(true);
}

test('expanded chip: click opens at the capture geometry, re-click closes', async ({ page }) => {
  await page.goto(BOARD);
  await expect(menu(page)).toBeHidden();

  const chip = page.locator('.sidebar-user');
  await chip.click();

  await expect(menu(page)).toBeVisible();
  await expect(chip).toHaveAttribute('aria-expanded', 'true');
  expect(await menu(page).boundingBox()).toMatchObject({
    x: 8,
    y: 410,
    width: 224,
    height: 272,
  });
  await expectMenuOnTop(page);

  // re-clicking the chip lands on the family click-catcher at the same
  // point — the user-visible effect is the toggle closing
  await chip.click({ force: true });
  await expect(menu(page)).toBeHidden();
  await expect(chip).toHaveAttribute('aria-expanded', 'false');
});

test('outside click and Esc close the open menu', async ({ page }) => {
  await page.goto(BOARD);
  const chip = page.locator('.sidebar-user');

  await chip.click();
  await expect(menu(page)).toBeVisible();
  await page.mouse.click(700, 300); // board canvas, far from the panel
  await expect(menu(page)).toBeHidden();

  await chip.click();
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu(page)).toBeHidden();
});

test('rail chip opens the same popover, unclipped by the 40px rail', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pacman.sidebar-collapsed', '1'));
  await page.goto(BOARD);

  const chip = page.locator('.rail-user');
  await chip.click();

  await expect(menu(page)).toBeVisible();
  expect(await menu(page).boundingBox()).toMatchObject({
    x: 8,
    y: 410,
    width: 224,
    height: 272,
  });
  await expectMenuOnTop(page);

  await page.keyboard.press('Escape');
  await expect(menu(page)).toBeHidden();
});

test('外观 row works from the click-opened menu and the choice survives reopen', async ({
  page,
}) => {
  await page.goto(BOARD);
  await page.locator('.sidebar-user').click();

  const light = page.locator('.user-menu-seg button', { hasText: '浅色' });
  await expect(light).toHaveAttribute('data-active', 'false'); // scenario 01 rides dark
  await light.click();

  expect(
    await page.evaluate(() => document.documentElement.classList.contains('light')),
  ).toBe(true);
  expect(await page.evaluate((k) => localStorage.getItem(k), THEME_KEY)).toBe('light');

  // close + reopen: the remounted menu reads the stored theme
  await page.keyboard.press('Escape');
  await expect(menu(page)).toBeHidden();
  await page.locator('.sidebar-user').click();
  await expect(light).toHaveAttribute('data-active', 'true');
});

test('detail route: the trigger opens the menu over the confirm surface', async ({ page }) => {
  await page.goto('/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=17b');
  await page.locator('.sidebar-user').click();

  await expect(menu(page)).toBeVisible();
  await expectMenuOnTop(page);
});
