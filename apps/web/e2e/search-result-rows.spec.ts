import { expect, type Locator, type Page, test } from '@playwright/test';

// Issue #159: 搜索结果行——点击即跳 + 常亮改 hover 跟随。Every panel row is
// a live SPA hop carrying the current ?search= along (#121 convention) and
// closing the panel: todo result → 详情, 前往 row → its route. The lit row
// follows the mouse at rest (no fixed 常亮 default row); ↑↓ moves a
// keyboard cursor (Enter hops to it), and a real pointer move hands the
// highlight back to hover (让位). Rides the plain board scenario ('01') —
// every open state comes from the hotkey, never the fixture flag.

const BOARD = '/app?scenario=01';
/** Matches the fixture probe pair r3-legacy-1 / r3-legacy-2 (title
 *  includes()), fixture order — nothing else on scenario 01. */
const PROBE = 'r3 lifecycle probe';

const panel = (page: Page) => page.locator('.search-panel');
const todoRows = (page: Page) => page.locator('.search-row--todo');
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

/** Background of the row element itself — an unlit row is transparent. */
const rowBg = (locator: Locator) =>
  locator.evaluate((el) => getComputedStyle(el).backgroundColor);

/** A lit row paints the canon pill: background === resolved
 *  --row-selected (the look the r7 05 fixed selected row used to carry),
 *  not the generic #73 surface-hover tint. */
const isLit = (locator: Locator) =>
  locator.evaluate((el) => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--row-selected)';
    document.documentElement.append(probe);
    const lit = getComputedStyle(probe).color;
    probe.remove();
    return getComputedStyle(el).backgroundColor === lit;
  });

/** ⌘K until the panel answers — the hotkey listener registers in a
 *  passive effect after first paint, so a loaded-machine first press can
 *  predate hydration. The retry only re-presses a *lost* hotkey (same
 *  guard as search-focus.spec.ts). */
async function openPanel(page: Page) {
  await expect(page.locator('.sidebar-row, .rail-row').first()).toBeVisible();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await page.keyboard.press('Meta+k');
    const opened = await panel(page)
      .waitFor({ state: 'visible', timeout: 1000 })
      .then(() => true)
      .catch(() => false);
    if (opened) return;
  }
  throw new Error('⌘K never opened the search panel');
}

/** Panel open + the probe query typed into the auto-focused input. */
async function searchProbe(page: Page) {
  await openPanel(page);
  await page.keyboard.type(PROBE);
  await expect(todoRows(page).first()).toContainText(PROBE);
}

test('结果行点击 → 面板关闭 + 跳 todo 详情', async ({ page }) => {
  await page.goto(BOARD);
  await searchProbe(page);

  await todoRows(page).first().click();
  await expect(page).toHaveURL('/app/todo/r3-legacy-1?scenario=01');
  await expect(panel(page)).toBeHidden();
  // the detail route really rendered the clicked todo
  await expect(page.locator('.detail-shell')).toHaveAttribute('data-todo-id', 'r3-legacy-1');
});

test('前往行点击 → 面板关闭 + 跳对应路由', async ({ page }) => {
  await page.goto(BOARD);
  await openPanel(page);

  await page.locator('.search-row', { hasText: '定时' }).click();
  await expect(page).toHaveURL('/app/schedules?scenario=01');
  await expect(panel(page)).toBeHidden();
});

test('静息无常亮;hover 哪行亮哪行,且只亮一行', async ({ page }) => {
  await page.goto(BOARD);
  await searchProbe(page);

  // typed-in results at rest: no fixed lit row (#159 replaces the r7 05
  // default-selected keyboard-cursor row)
  await expect(page.locator('.search-row--selected')).toHaveCount(0);

  const first = todoRows(page).first();
  const second = todoRows(page).nth(1);
  await first.hover();
  await expect.poll(() => isLit(first)).toBe(true);

  await second.hover();
  await expect.poll(() => isLit(second)).toBe(true);
  await expect.poll(() => rowBg(first)).toBe(TRANSPARENT);
});

test('↑↓ 键盘光标接管高亮;Enter 跳光标行', async ({ page }) => {
  await page.goto(BOARD);
  await searchProbe(page);

  await page.keyboard.press('ArrowDown');
  const first = todoRows(page).first();
  await expect(first).toHaveClass(/search-row--selected/);
  await expect.poll(() => isLit(first)).toBe(true);

  await page.keyboard.press('ArrowDown');
  const second = todoRows(page).nth(1);
  await expect(second).toHaveClass(/search-row--selected/);
  await expect(first).not.toHaveClass(/search-row--selected/);

  await page.keyboard.press('Enter');
  // second result = the probe2 sibling, fixture order
  await expect(page).toHaveURL('/app/todo/r3-legacy-2?scenario=01');
  await expect(panel(page)).toBeHidden();
});

test('鼠标一动让位:键盘光标交还 hover', async ({ page }) => {
  await page.goto(BOARD);
  await searchProbe(page);

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  const first = todoRows(page).first();
  const second = todoRows(page).nth(1);
  await expect(second).toHaveClass(/search-row--selected/);

  // a real pointer move over another row drops the keyboard cursor — hover
  // owns the highlight again, and it is the only lit row
  await first.hover();
  await expect(page.locator('.search-row--selected')).toHaveCount(0);
  await expect.poll(() => isLit(first)).toBe(true);
  await expect.poll(() => rowBg(second)).toBe(TRANSPARENT);
});
