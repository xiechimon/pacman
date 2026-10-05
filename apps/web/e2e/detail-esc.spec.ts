import { expect, test } from '@playwright/test';

// Issue #634 item 3: ESC on the detail page is layered — an open floating
// surface consumes the key first; only a clean ESC leaves the detail
// (carrying the search string home, same law as the back link).
//
// Failure modes pinned (one per test):
//   E1 clean ESC on the detail did nothing (no exit affordance but the back arrow)
//   E2 ESC with the chip popover open left the detail instead of closing the popover
//   E3 ESC with a modal overlay open left the detail instead of closing the overlay
//
// The fourth layer (ESC with the composer's mention inline open closes the
// inline, not the detail) needs a live stack — the fixture composer is a
// static div — so it is pinned by the live probe in docs/verify/634/
// (after-mention-inline check), not here.

const DETAIL = '/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=27';
const BOARD = /\/app\?scenario=27$/;

const chip = (page: import('@playwright/test').Page) => page.locator('.detail-chip');
// #949 载体：popover = role dialog + 可及名（.chip-popover 类钉退役）
const popover = (page: import('@playwright/test').Page) =>
  page.getByRole('dialog', { name: '任务分配' });
const confirmDialog = (page: import('@playwright/test').Page) => page.locator('.delete-confirm');

test('E1: clean ESC leaves the detail, carrying the search home', async ({ page }) => {
  await page.goto(DETAIL);
  // ESC-delivery retry law (escape-wiring's ⌘K precedent): a press that
  // lands before the page's keydown effect mounts is lost and leaves the
  // old state, so re-pressing is safe — the until is the flipped URL. CI's
  // slow mount lost the single blind press (run 36997481667); the law this
  // test pins is "a clean ESC exits", not "exactly one keydown ever lands".
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.keyboard.press('Escape');
    const flipped = await page
      .waitForURL(BOARD, { timeout: 1000 })
      .then(() => true)
      .catch(() => false);
    if (flipped) return;
  }
  throw new Error('ESC never left the detail page');
});

test('E2: ESC with the chip popover open closes the popover first', async ({ page }) => {
  await page.goto(DETAIL);
  await chip(page).click();
  await expect(popover(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(popover(page)).toBeHidden();
  await expect(page).toHaveURL(/\/todo\//);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(BOARD);
});

test('E3: ESC with a modal overlay open closes the overlay first', async ({ page }) => {
  await page.goto(DETAIL);
  await page.locator('.detail-head-icon--more').click();
  await page.locator('.more-menu-item[data-action="delete"]').click();
  await expect(confirmDialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(confirmDialog(page)).toBeHidden();
  await expect(page).toHaveURL(/\/todo\//);
});
