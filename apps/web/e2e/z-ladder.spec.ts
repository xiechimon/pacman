import { expect, type Page, test } from '@playwright/test';

// Issue #688: the z ladder — active surfaces must paint above the docked
// chief drawer. The drawer is persistent chrome (a docked flex column, ADR
// 0004); the new-task dialog is an active modal. They used to collide in the
// root stacking order (drawer z 30 over the dialog family's 20/21), so the
// drawer's 418px band covered the dialog's right edge — including its close
// button and footer actions — and stayed lit above the modal scrim.
// The reference product (todos.dev, live capture 2026-10-03) puts every
// dialog on a fixed z 9999 portal host above low-z chrome and leaves the
// open drawer mounted, dimmed and non-interactive underneath.
//
// Failure modes pinned here (fixture face, board route, scenario 111 =
// drawer open). No test asserts a z-index VALUE — a value can move without
// the painting order moving; every assertion is a hit-test, a real click,
// or real typing:
//   1. the dialog is covered: points inside the panel (right edge, corners,
//      footer) must hit-test inside the dialog subtree, not the drawer;
//   2. the scrim does not own the viewport: a point over the drawer must
//      hit the dialog backdrop while the dialog is open;
//   3. the dialog is not interactive in the overlapped band: the close
//      button must receive an unforced click (Playwright's actionability
//      hit-test fails when the drawer intercepts);
//   4. the drawer must survive underneath (user ruling 2026-10-03: raise
//      the dialog only — the drawer stays open, is not collapsed, and does
//      not steal focus back): visible while the dialog is open, still open
//      after the dialog closes, focus in the dialog and typing works.

const drawer = (page: Page) => page.locator('.chief-drawer');
const dialog = (page: Page) => page.locator('.new-task-dialog');

async function openDialogOverDrawer(page: Page) {
  await page.goto('/app?scenario=111');
  await expect(drawer(page)).toBeVisible();
  // the docked panel slides in (anim-drawer) — wait for the entrance to
  // settle so hit-tests run against the resting geometry
  await drawer(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  // the drawer autofocus lands in the composer and C is swallowed by the
  // editable guard — click a neutral board spot first, like a user would
  await page.mouse.click(700, 400);
  await page.keyboard.press('c');
  await expect(dialog(page)).toBeVisible();
}

test.describe('z ladder: active surfaces above the docked drawer (#688)', () => {
  test('every probe point of the new-task panel hit-tests inside the panel', async ({ page }) => {
    await openDialogOverDrawer(page);
    const hits = await dialog(page).evaluate((el) => {
      const r = el.getBoundingClientRect();
      const pts: Array<[number, number]> = [
        [r.x + r.width / 2, r.y + r.height / 2], // center (the textarea)
        [r.x + r.width - 8, r.y + r.height / 2], // right edge — the drawer band
        [r.x + r.width - 8, r.y + 8], // top-right corner (the close button)
        [r.x + r.width - 8, r.y + r.height - 8], // bottom-right (footer actions)
        [r.x + 8, r.y + 8], // top-left corner
      ];
      return pts.map(([x, y]) => {
        const hit = document.elementFromPoint(x, y);
        return hit != null && el.contains(hit);
      });
    });
    expect(hits).toEqual([true, true, true, true, true]);
  });

  test('the modal scrim covers the drawer while the dialog is open', async ({ page }) => {
    await openDialogOverDrawer(page);
    const overDrawer = await page.evaluate(() => {
      const dr = document.querySelector('.chief-drawer')?.getBoundingClientRect();
      if (!dr) return null;
      const el = document.elementFromPoint(dr.x + dr.width / 2, dr.y + dr.height / 2);
      return el?.getAttribute('data-slot') ?? null;
    });
    expect(overDrawer).toBe('dialog-overlay');
    // the drawer itself stays mounted and open underneath — dimmed, not gone
    await expect(drawer(page)).toBeVisible();
  });

  test('the close button inside the drawer band receives the click', async ({ page }) => {
    await openDialogOverDrawer(page);
    // unforced: Playwright's actionability check retries and fails if the
    // drawer (or anything else) intercepts pointer events at the button
    await dialog(page).locator('.new-task-close').click();
    await expect(dialog(page)).toBeHidden();
    // the drawer survives the whole round trip and stays open (ruling #688)
    await expect(drawer(page)).toBeVisible();
  });

  test('focus lands in the dialog and typing reaches it', async ({ page }) => {
    await openDialogOverDrawer(page);
    const focused = await page.evaluate(
      () => document.activeElement?.closest('.new-task-dialog') != null,
    );
    expect(focused).toBe(true);
    await page.keyboard.type('layering probe');
    await expect(dialog(page).locator('.new-task-spec')).toHaveValue('layering probe');
  });
});
