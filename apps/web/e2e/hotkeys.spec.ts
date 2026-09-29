import { expect, type Page, test } from '@playwright/test';

// Issue #389 acceptance: the 快捷键组 — N opens the new-task dialog from any
// page (the sidebar gains a 新任务 row carrying the N kbd badge, upstream
// todos.dev form), and Space wakes the chief drawer with focus landing in
// the composer (dialog-family autofocus law — SearchPanel/NewTaskDialog
// ref-focus precedent; no focus trap anywhere in the family, none here).
// Guards keep native semantics: editable targets (input/textarea/
// contenteditable) swallow both keys, interactive targets keep Space for
// native button activation, and modifier chords (⌘N, Ctrl+Space IME) pass
// through. Each test pins one failure mode:
// 1. N on the board opens the dialog (hotkey listener live)
// 2. the sidebar 新任务 row renders the N badge and click-opens the dialog
// 3. N on a non-board route opens the dialog in place (no navigation)
// 4. N on the project page opens that page's own dialog (route-project
//    chip), not a second global instance
// 5. Space opens the chief drawer, composer focused (board)
// 6. Space wakes the drawer on a ChiefWake route (schedules)
// 7. editable focus swallows both keys — the space lands IN the input
// 8. Space on a focused button fires the button natively (no hijack); N is
//    NOT over-guarded (buttons are not editable)
// 9. textarea focus (chief composer) swallows N — the guard family is
//    input + textarea + select + contenteditable; the app ships no
//    contenteditable surface today, so that branch stays code-only
//    (a synthetic node would test the guard, not the app)

const BOARD = '/app?scenario=01';
const SCHEDULES = '/app/schedules?scenario=01';
const PROJECT = '/app/project/ZAQczKCu0MOAzC1ZqcFlX?scenario=r2-24b&tab=tasks';

const dialog = (page: Page) => page.locator('.new-task-dialog');
const drawer = (page: Page) => page.locator('.chief-drawer');

/** Hotkey press with the search-focus.spec retry law: the listener registers
 *  in a passive effect after first paint, so a too-early press can be lost —
 *  re-press only while the surface stays closed. N/Space are open-only and
 *  ⌘K re-presses only on a *lost* key (a delivered one flips the panel
 *  visible, ending the loop), so retries never double-fire; once a surface
 *  opens, its own input holds focus (editable guard) and a late retry is
 *  inert. */
async function pressUntil(page: Page, key: string, visible: ReturnType<Page['locator']>) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await page.keyboard.press(key);
    const opened = await visible
      .waitFor({ state: 'visible', timeout: 1000 })
      .then(() => true)
      .catch(() => false);
    if (opened) return;
  }
  throw new Error(`${key} never opened ${visible}`);
}

test('N on the board opens the new-task dialog; ⌘N does not', async ({ page }) => {
  await page.goto(BOARD);
  await expect(page.locator('.sidebar-row').first()).toBeVisible();
  // modifier chords pass through — ⌘N is the browser's own new-window chord
  await page.keyboard.press('Meta+n');
  await expect(dialog(page)).toHaveCount(0);

  await pressUntil(page, 'n', dialog(page));
  // family law: the dialog's title input owns focus on open
  await expect(page.locator('.new-task-input')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
});

test('sidebar 新任务 row carries the N badge and click-opens the dialog', async ({ page }) => {
  await page.goto(BOARD);
  const row = page.locator('.sidebar-row', { hasText: '新任务' });
  await expect(row).toBeVisible();
  await expect(row.locator('.sidebar-kbd')).toHaveText('N');
  await row.click();
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
});

test('N on a non-board route opens the dialog in place', async ({ page }) => {
  await page.goto(SCHEDULES);
  await expect(page.locator('.sidebar-row').first()).toBeVisible();
  await pressUntil(page, 'n', dialog(page));
  // in place — the route never hops to the board
  await expect(page).toHaveURL(/\/app\/schedules/);
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
});

test('N on the project page opens the page’s own dialog (route project chip)', async ({
  page,
}) => {
  await page.goto(PROJECT);
  await expect(page.locator('.sidebar-row').first()).toBeVisible();
  await pressUntil(page, 'n', dialog(page));
  // exactly one instance — the page's own (project-empty-new-task.spec pins
  // the chip = the route's project, which the global sidebar dialog cannot
  // know); a second global instance would read 2 here
  await expect(dialog(page)).toHaveCount(1);
  await expect(dialog(page).locator('.new-task-project-name')).toHaveText('r3-lifecycle');
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
});

test('Space opens the chief drawer with the composer focused', async ({ page }) => {
  await page.goto(BOARD);
  await expect(page.locator('.sidebar-row').first()).toBeVisible();
  await pressUntil(page, 'Space', drawer(page));
  await expect(page.locator('.chief-composer-input')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(drawer(page)).toHaveCount(0);
});

test('Space wakes the chief drawer on a non-board route', async ({ page }) => {
  await page.goto(SCHEDULES);
  await expect(page.locator('.sidebar-row').first()).toBeVisible();
  await pressUntil(page, 'Space', drawer(page));
  await expect(page.locator('.chief-composer-input')).toBeFocused();
  await expect(page).toHaveURL(/\/app\/schedules/);
  await page.keyboard.press('Escape');
  await expect(drawer(page)).toHaveCount(0);
});

test('editable focus swallows both keys — the space lands IN the input', async ({ page }) => {
  await page.goto(BOARD);
  // open the ⌘K panel: its input is the editable focus target
  await pressUntil(page, 'Meta+k', page.locator('.search-panel'));
  const field = page.locator('.search-input-row input');
  await expect(field).toBeFocused();

  await page.keyboard.press('n');
  await expect(dialog(page)).toHaveCount(0);
  await page.keyboard.press('Space');
  await expect(drawer(page)).toHaveCount(0);
  // no preventDefault hijack — both keys typed through into the query
  await expect(field).toHaveValue('n ');
});

test('textarea focus (chief composer) swallows N', async ({ page }) => {
  await page.goto(BOARD);
  await pressUntil(page, 'Space', drawer(page));
  const composer = page.locator('.chief-composer-input');
  await expect(composer).toBeFocused();
  // fixture composer is readOnly — focus holds but typing lands nowhere;
  // the guard must keep N from opening the dialog behind the drawer
  await page.keyboard.press('n');
  await expect(dialog(page)).toHaveCount(0);
  await expect(drawer(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(drawer(page)).toHaveCount(0);
});

test('Space on a focused button activates the button natively; N stays live', async ({ page }) => {
  await page.goto(BOARD);
  const searchRow = page.locator('.sidebar-row', { hasText: '搜索' });
  await expect(searchRow).toBeVisible();

  // N is guarded by editability only — a focused button does not block it
  await searchRow.focus();
  await page.keyboard.press('n');
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);

  // Space keeps its native button-activation semantics: the 搜索 row's own
  // click fires (the panel opens) and the drawer stays shut
  await searchRow.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.search-panel')).toBeVisible();
  await expect(drawer(page)).toHaveCount(0);
});
