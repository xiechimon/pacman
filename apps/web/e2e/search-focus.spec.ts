import { expect, type Page, test } from '@playwright/test';

// Issue #137 acceptance: ⌘K opens the panel with the input *already*
// focused — typing lands without a second click and filters the fixture
// todos — and the 常亮互斥 rule holds: while the panel is open it is the
// only lit focus surface (the page-layer selected pill dims under the
// scrim), and the page layer restores on close. Rides the plain board
// scenario ('01'); every open state here comes from the hotkey, never the
// fixture flag.

const BOARD = '/app?scenario=01';

const input = (page: Page) => page.locator('.search-input-row input');

/** Background of the selected row's ::before pill layer. */
function pillBg(locator: import('@playwright/test').Locator) {
  return locator.evaluate((el) => getComputedStyle(el, '::before').backgroundColor);
}

const TRANSPARENT = 'rgba(0, 0, 0, 0)';

/** ⌘K until the panel answers. goto resolves at `load`, but the hotkey
 *  listener registers in a passive effect after first paint — on a loaded
 *  machine the first press can predate hydration. The retry only re-presses
 *  a *lost* hotkey (a delivered one flips the panel visible, ending the
 *  loop); it never double-toggles. */
async function openPanel(page: Page) {
  const panel = page.locator('.search-panel');
  // expanded rows OR rail rows — the collapsed form has no .sidebar-row
  await expect(page.locator('.sidebar-row, .rail-row').first()).toBeVisible();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await page.keyboard.press('Meta+k');
    const opened = await panel
      .waitFor({ state: 'visible', timeout: 1000 })
      .then(() => true)
      .catch(() => false);
    if (opened) return;
  }
  throw new Error('⌘K never opened the search panel');
}

test('⌘K focuses the input — direct typing produces results', async ({ page }) => {
  await page.goto(BOARD);
  await openPanel(page);

  const field = input(page);
  await expect(field).toBeFocused(); // caret in the box, no click needed

  // keys go straight to the panel: the fixture probe todo filters in
  await page.keyboard.type('r3 lifecycle probe');
  const rows = page.locator('.search-row--todo');
  await expect(rows.first()).toContainText('r3 lifecycle probe');

  // and the empty-state 前往 group is gone — real filtering, not a repaint
  await expect(page.locator('.search-group-label', { hasText: '前往' })).toHaveCount(0);
});

test('mid-exit reopen refocuses the retained input', async ({ page }) => {
  await page.goto(BOARD);
  await openPanel(page);
  await expect(input(page)).toBeFocused();

  // reopen inside the 150ms retained-mount window: the input never
  // detaches, so the mount-time focus path can't fire — the open
  // transition must refocus (#137 regression guard; if the window is
  // missed the remount path refocuses instead and the assertion still
  // holds, so the guard is timing-robust)
  await page.keyboard.press('Escape');
  await page.keyboard.press('Meta+k');
  await expect(input(page)).toBeFocused();
});

test('常亮互斥: page-layer pill dims while the panel is open, restores on close', async ({
  page,
}) => {
  await page.goto(BOARD);
  const pill = page.locator('.sidebar-row--selected');
  await expect(pill).toHaveCount(1);
  expect(await pillBg(pill)).not.toBe(TRANSPARENT); // lit at rest

  await openPanel(page);
  // poll, don't snapshot: the pill's background-color rides the 150ms
  // sidebar transition, so an immediate read lands mid-fade
  await expect.poll(() => pillBg(pill)).toBe(TRANSPARENT); // extinguished
  // the panel's own selected row stays lit — exactly one lit surface
  await expect(page.locator('.search-row--selected')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('.search-panel')).toBeHidden();
  await expect.poll(() => pillBg(pill)).not.toBe(TRANSPARENT); // restored
});

test('常亮互斥 holds on the collapsed rail form', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('pacman.sidebar-collapsed', '1');
  });
  await page.goto(BOARD);
  const rail = page.locator('.rail-row--selected');
  await expect(rail).toHaveCount(1);
  expect(await pillBg(rail)).not.toBe(TRANSPARENT);

  await openPanel(page);
  await expect.poll(() => pillBg(rail)).toBe(TRANSPARENT);

  await page.keyboard.press('Escape');
  await expect(page.locator('.search-panel')).toBeHidden();
  await expect.poll(() => pillBg(rail)).not.toBe(TRANSPARENT);
});
