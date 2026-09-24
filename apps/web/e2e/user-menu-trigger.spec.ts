import { expect, type Page, test } from '@playwright/test';

// Issue #127 acceptance: the sidebar avatar chips (expanded .sidebar-user
// and rail .rail-user) open the user-menu popover on a real click — toggle
// on the chip, close on outside click and Esc, the anchored-overlay family
// affordances.
// #163 replaces the frozen-capture geometry assertion (224×244 @ (8,410),
// r7 17/16d) with the anchoring law — precedent: #135 re-cut the
// visual-polish assertions with 裁决 v2. The menu is bottom-anchored above
// the avatar chip: the horizontal capture geometry (x8, 224 wide) stands,
// the bottom edge rides a viewport-height-invariant distance, and the panel
// never covers the chip at any viewport height (the dogfood symptom: the
// frozen top:410px buried the avatar on short windows). Both chip shapes
// obey the same law.
// The 外观 segment (#122) is reachable from the
// click-opened menu, so the theme switch is no longer behind a
// fixture-only door. Rides menu-less scenarios ('01', '17b'): every open
// state here comes from the trigger, never the fixture flag.

const BOARD = '/app?scenario=01';
const THEME_KEY = 'pacman-theme'; // apps/web/src/theme.ts THEME_STORAGE_KEY

const menu = (page: Page) => page.locator('.user-menu');

/** The menu must own the hit-test at its own center — nothing (click
 *  catcher, board content, rail clipping) may sit above the panel. */
async function expectMenuOnTop(page: Page) {
  const box = await menu(page).boundingBox();
  expect(box).not.toBeNull();
  const top = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.closest('.user-menu') != null,
    [box!.x + box!.width / 2, box!.y + box!.height / 2] as const,
  );
  expect(top).toBe(true);
}

/** #163 anchoring law: capture width/x stand, and the menu bottom stays at
 *  least 8px clear of the chip top — never covering the avatar. Returns the
 *  menu-bottom distance from the viewport bottom (the anchoring invariant:
 *  it must not depend on the viewport height). */
async function expectAnchoredAboveChip(page: Page, chipSel: string) {
  const box = await menu(page).boundingBox();
  const chip = await page.locator(chipSel).boundingBox();
  expect(box).not.toBeNull();
  expect(chip).not.toBeNull();
  expect(box!.x).toBe(8);
  expect(box!.width).toBe(224);
  expect(box!.y + box!.height).toBeLessThanOrEqual(chip!.y - 8);
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  return viewportHeight - (box!.y + box!.height);
}

test('expanded chip: click opens anchored above the chip, re-click closes', async ({ page }) => {
  await page.goto(BOARD);
  await expect(menu(page)).toBeHidden();

  const chip = page.locator('.sidebar-user');
  await chip.click();

  await expect(menu(page)).toBeVisible();
  await expect(chip).toHaveAttribute('aria-expanded', 'true');
  await expectAnchoredAboveChip(page, '.sidebar-user');
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
  await expectAnchoredAboveChip(page, '.rail-user');
  await expectMenuOnTop(page);

  await page.keyboard.press('Escape');
  await expect(menu(page)).toBeHidden();
});

test('#163 anchoring: bottom distance is viewport-invariant, the chip is never covered — both shapes', async ({
  page,
}) => {
  for (const collapsed of [false, true]) {
    await page.goto(BOARD);
    if (collapsed) {
      // collapse is mount-time state (storage-backed, #55) — set + reload
      await page.evaluate(() => localStorage.setItem('pacman.sidebar-collapsed', '1'));
      await page.reload();
    }
    const chipSel = collapsed ? '.rail-user' : '.sidebar-user';

    await page.locator(chipSel).click();
    await expect(menu(page)).toBeVisible();
    const anchorDistance = await expectAnchoredAboveChip(page, chipSel);

    // the dogfood symptom window first: at 600px the frozen top:410px
    // buried the chip — the anchored panel must ride the bottom instead
    for (const height of [600, 900, 550, 732]) {
      await page.setViewportSize({ width: 1440, height });
      const distance = await expectAnchoredAboveChip(page, chipSel);
      // bottom-anchored: the distance does not depend on the viewport height
      expect(Math.abs(distance - anchorDistance)).toBeLessThanOrEqual(1);
    }

    await page.keyboard.press('Escape');
    await expect(menu(page)).toBeHidden();
    await page.evaluate(() => localStorage.removeItem('pacman.sidebar-collapsed'));
    await page.setViewportSize({ width: 1440, height: 732 });
  }
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
