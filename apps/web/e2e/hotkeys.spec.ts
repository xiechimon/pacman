import { expect, type Page, test } from '@playwright/test';

// Issue #389 + #442 + #468 acceptance: the 快捷键组 — N opens the new-task dialog
// from any page (the sidebar gains a 新任务 row carrying the N kbd badge,
// upstream todos.dev form), and ⌘J (Ctrl+J off macOS — the ⌘K search
// registration's cmd/ctrl dual-receipt form) wakes the chief drawer with
// focus landing in the composer (dialog-family autofocus law —
// SearchPanel/NewTaskDialog ref-focus precedent; no focus trap anywhere in
// the family, none here). ⌘J is a toggle (#468): the second press closes
// the drawer, including from the composer focus the open itself landed —
// the editable guard exempts the drawer's own interior, otherwise the
// chord could never close what it opened. N stays open-only, matching the
// row-click semantics. Guards keep native semantics: editable targets
// (input/textarea/select/contenteditable) swallow both keys OUTSIDE the
// drawer — typing must never wake a surface; ⌘J's guard is editable-only —
// buttons and links carry no native ⌘J semantics, so a focused control
// must not block the chord. Space's binding is removed (#442 replaces
// #389's): scrolling and focused-control activation are fully returned,
// nothing preventDefaults them. Modifier-less N still passes through
// modifier chords (⌘N). Each test pins one failure mode:
// 1. N on the board opens the dialog (hotkey listener live); ⌘N does not
// 2. the sidebar 新任务 row renders the N badge and click-opens the dialog
// 3. N on a non-board route opens the dialog in place (no navigation)
// 4. N on the project page opens that page's own dialog (route-project
//    chip), not a second global instance
// 5. Space no longer opens the drawer; ⌘J does with the composer focused,
//    and ⌘J's default is consumed (a probe listener registered after the
//    app's sees the delivered keydown already preventDefaulted)
// 6. ⌘J wakes the drawer on a non-board route (schedules)
// 7. editable focus OUTSIDE the drawer swallows both keys — the n lands IN
//    the input, ⌘J keeps the drawer shut
// 8. textarea focus (chief composer) swallows N — the guard family is
//    input + textarea + select + contenteditable; the app ships no
//    contenteditable surface today, so that branch stays code-only
//    (a synthetic node would test the guard, not the app)
// 9. Space on a focused button fires the button natively (activation
//    returned, no hijack); ⌘J fires the drawer even with a button focused
//    (guard narrowed to editable-only); modifier-less N stays live
// 10. ⌘J toggles shut from the composer focus (drawer-interior exemption
//     missing → the guard swallows the closing chord), and the full
//     open→close→open loop rides one listener
// 11. the toggle rides the non-board singleton hook too (schedules)
// 12. the FAB click stays open-only; ⌘J closes what the click opened
// 13. hovering the robot FAB surfaces the ⌘J kbd hint (at rest it stays
//     hidden — no phantom chip in captures); the wake families carry the
//     same hint through the shared consumption point
// 14. the collapsed rail's search icon hovers the ⌘K hint (the expanded
//     rows already carry their always-on badges)

const BOARD = '/app?scenario=01';
const SCHEDULES = '/app/schedules?scenario=01';
const PROJECT = '/app/project/ZAQczKCu0MOAzC1ZqcFlX?scenario=r2-24b&tab=tasks';

const dialog = (page: Page) => page.locator('.new-task-dialog');
const drawer = (page: Page) => page.locator('.chief-drawer');

/** Hotkey press with the search-focus.spec retry law: the listener registers
 *  in a passive effect after first paint, so a too-early press can be lost —
 *  re-press only while the surface stays closed. ⌘K is open-only and
 *  re-presses only on a *lost* key (a delivered one flips the panel
 *  visible, ending the loop), so retries never double-fire; once a surface
 *  opens, its own input holds focus (editable guard) and a late retry is
 *  inert. ⌘J is a toggle, but the loop only runs from a closed surface and
 *  ends the instant one flips visible — a delivered open exits before any
 *  re-press could toggle it back. */
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

/** Escape-until-closed, same retry law as pressUntil: the close listener
 *  registers in a passive effect too, so an Escape fired right after open
 *  can be lost (renderer input processing lags the assertion read under
 *  load — CI evidence: the dialog stayed mounted 5s+). Escape on an
 *  already-closed surface is a no-op, so retries never double-fire. */
async function escapeUntilHidden(page: Page, surface: ReturnType<Page['locator']>) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await page.keyboard.press('Escape');
    const closed = await surface
      .waitFor({ state: 'hidden', timeout: 1000 })
      .then(() => true)
      .catch(() => false);
    if (closed) return;
  }
  throw new Error(`Escape never closed ${surface}`);
}

/** ⌘J-toggle close, same retry law as escapeUntilHidden: a delivered
 *  toggle hides the drawer and the wait ends the loop; a lost key leaves it
 *  open and the re-press IS the toggle. A pathologically slow close makes
 *  the next press reopen — and the one after closes again — so the loop's
 *  end state is deterministically hidden, never a coin flip. */
async function toggleUntilHidden(page: Page, surface: ReturnType<Page['locator']>) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await page.keyboard.press('Meta+j');
    const closed = await surface
      .waitFor({ state: 'hidden', timeout: 1000 })
      .then(() => true)
      .catch(() => false);
    if (closed) return;
  }
  throw new Error('⌘J never closed the drawer');
}

test('N on the board opens the new-task dialog; ⌘N does not', async ({ page }) => {
  await page.goto(BOARD);
  await expect(page.locator('.sidebar-row').first()).toBeVisible();
  // modifier chords pass through — ⌘N is the browser's own new-window chord
  await page.keyboard.press('Meta+n');
  await expect(dialog(page)).toHaveCount(0);

  await pressUntil(page, 'n', dialog(page));
  // family law: the dialog's spec textarea owns focus on open (#394 单字段面)
  await expect(page.locator('.new-task-spec')).toBeFocused();
  await escapeUntilHidden(page, dialog(page));
  await expect(dialog(page)).toHaveCount(0);
});

test('sidebar 新任务 row carries the N badge and click-opens the dialog', async ({ page }) => {
  await page.goto(BOARD);
  const row = page.locator('.sidebar-row', { hasText: '新任务' });
  await expect(row).toBeVisible();
  await expect(row.locator('.sidebar-kbd')).toHaveText('N');
  await row.click();
  await expect(dialog(page)).toBeVisible();
  await escapeUntilHidden(page, dialog(page));
  await expect(dialog(page)).toHaveCount(0);
});

test('N on a non-board route opens the dialog in place', async ({ page }) => {
  await page.goto(SCHEDULES);
  await expect(page.locator('.sidebar-row').first()).toBeVisible();
  await pressUntil(page, 'n', dialog(page));
  // in place — the route never hops to the board
  await expect(page).toHaveURL(/\/app\/schedules/);
  await escapeUntilHidden(page, dialog(page));
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
  await escapeUntilHidden(page, dialog(page));
  await expect(dialog(page)).toHaveCount(0);
});

test('Space no longer opens the drawer; ⌘J does, composer focused, default consumed', async ({
  page,
}) => {
  await page.goto(BOARD);
  await expect(page.locator('.sidebar-row').first()).toBeVisible();
  // #442: the Space binding is gone — it is the native scroll key again and
  // must not wake the drawer (the ⌘N test's immediate-count negative form)
  await page.keyboard.press('Space');
  await expect(drawer(page)).toHaveCount(0);

  await pressUntil(page, 'Meta+j', drawer(page));
  await expect(page.locator('.chief-composer-input')).toBeFocused();
  await escapeUntilHidden(page, drawer(page));
  await expect(drawer(page)).toHaveCount(0);

  // Default-consumed, the page-testable half: a probe listener installed
  // after the app's (hook proven live above; same target + phase fires in
  // registration order) sees the delivered ⌘J already preventDefaulted.
  // Blur first — with the composer focused the editable guard swallows the
  // chord before preventDefault ever runs. Browser-level interception of
  // ⌘J (Firefox's downloads library) is not observable from in-page.
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    const probe = window as unknown as { cmdJConsumed?: boolean };
    window.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
        probe.cmdJConsumed = event.defaultPrevented;
      }
    });
  });
  await pressUntil(page, 'Meta+j', drawer(page));
  const consumed = await page.evaluate(
    () => (window as unknown as { cmdJConsumed?: boolean }).cmdJConsumed,
  );
  expect(consumed).toBe(true);
  await escapeUntilHidden(page, drawer(page));
  await expect(drawer(page)).toHaveCount(0);
});

test('⌘J wakes the chief drawer on a non-board route', async ({ page }) => {
  await page.goto(SCHEDULES);
  await expect(page.locator('.sidebar-row').first()).toBeVisible();
  await pressUntil(page, 'Meta+j', drawer(page));
  await expect(page.locator('.chief-composer-input')).toBeFocused();
  await expect(page).toHaveURL(/\/app\/schedules/);
  await escapeUntilHidden(page, drawer(page));
  await expect(drawer(page)).toHaveCount(0);
});

test('editable focus swallows N and ⌘J — the n lands IN the input', async ({ page }) => {
  await page.goto(BOARD);
  // open the ⌘K panel: its input is the editable focus target
  await pressUntil(page, 'Meta+k', page.locator('.search-panel'));
  const field = page.locator('.search-input-row input');
  await expect(field).toBeFocused();

  await page.keyboard.press('n');
  await expect(dialog(page)).toHaveCount(0);
  // #442: the same editable guard swallows ⌘J — typing must never wake a
  // surface, and the chord inserts no text of its own
  await page.keyboard.press('Meta+j');
  await expect(drawer(page)).toHaveCount(0);
  // no preventDefault hijack — the n typed through into the query
  await expect(field).toHaveValue('n');
});

test('textarea focus (chief composer) swallows N', async ({ page }) => {
  await page.goto(BOARD);
  await pressUntil(page, 'Meta+j', drawer(page));
  const composer = page.locator('.chief-composer-input');
  await expect(composer).toBeFocused();
  // fixture composer is readOnly — focus holds but typing lands nowhere;
  // the guard must keep N from opening the dialog behind the drawer
  await page.keyboard.press('n');
  await expect(dialog(page)).toHaveCount(0);
  await expect(drawer(page)).toBeVisible();
  await escapeUntilHidden(page, drawer(page));
  await expect(drawer(page)).toHaveCount(0);
});

test('Space on a focused button activates it natively; ⌘J fires past button focus', async ({
  page,
}) => {
  await page.goto(BOARD);
  const searchRow = page.locator('.sidebar-row', { hasText: '搜索' });
  await expect(searchRow).toBeVisible();

  // N is guarded by editability only — a focused button does not block it
  await searchRow.focus();
  await page.keyboard.press('n');
  await expect(dialog(page)).toBeVisible();
  await escapeUntilHidden(page, dialog(page));
  await expect(dialog(page)).toHaveCount(0);

  // Space keeps its native button-activation semantics (#442 returned them
  // in full): the 搜索 row's own click fires (the panel opens) and the
  // drawer stays shut — no hijack
  await searchRow.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.search-panel')).toBeVisible();
  await expect(drawer(page)).toHaveCount(0);

  // Close the panel (its input holds focus — editable would swallow the
  // chord) and refocus the button row: ⌘J's guard is editable-only, so it
  // must fire even with a control focused — the chord carries no native
  // activation semantics of its own
  await page.keyboard.press('Escape');
  await expect(page.locator('.search-panel')).toBeHidden();
  await searchRow.focus();
  await pressUntil(page, 'Meta+j', drawer(page));
  await expect(page.locator('.chief-composer-input')).toBeFocused();
  await escapeUntilHidden(page, drawer(page));
  await expect(drawer(page)).toHaveCount(0);
});

test('⌘J toggles: the second press closes the drawer from its own composer focus', async ({
  page,
}) => {
  await page.goto(BOARD);
  await expect(page.locator('.sidebar-row').first()).toBeVisible();
  await pressUntil(page, 'Meta+j', drawer(page));
  await expect(page.locator('.chief-composer-input')).toBeFocused();
  // The drawer-interior exemption law (#468): the composer is an editable
  // target, but the chord that owns this surface must close it — without
  // the exemption the editable guard swallows the closing press and this
  // wait times out.
  await toggleUntilHidden(page, drawer(page));
  await expect(drawer(page)).toHaveCount(0);
  // The full loop rides the one singleton listener: open → close → open →
  // close, no re-registration between presses.
  await pressUntil(page, 'Meta+j', drawer(page));
  await toggleUntilHidden(page, drawer(page));
  await expect(drawer(page)).toHaveCount(0);
});

test('⌘J toggle rides the non-board singleton hook too (schedules)', async ({ page }) => {
  await page.goto(SCHEDULES);
  await expect(page.locator('.sidebar-row').first()).toBeVisible();
  await pressUntil(page, 'Meta+j', drawer(page));
  await toggleUntilHidden(page, drawer(page));
  await expect(drawer(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/app\/schedules/);
});

test('FAB click stays open-only; ⌘J closes what the click opened', async ({ page }) => {
  await page.goto(BOARD);
  const fab = page.locator('.chief-fab');
  await expect(fab).toBeVisible();
  await fab.click();
  await expect(drawer(page)).toBeVisible();
  // The docked form (#447) covers the FAB with the panel while open — a
  // re-click cannot even land (Playwright's pointer-interception is the
  // proof), so the click face has no toggle to leak. The chord stays the
  // only keyboard close: the open autofocused the composer, and the
  // drawer-interior guard exemption lets ⌘J fire from there.
  await toggleUntilHidden(page, drawer(page));
  await expect(drawer(page)).toHaveCount(0);
});

test('the robot FAB surfaces the ⌘J hint on hover; at rest it stays hidden', async ({
  page,
}) => {
  await page.goto(BOARD);
  const fab = page.locator('.chief-fab');
  const hint = fab.locator('.kbd-hint');
  await expect(hint).toHaveCount(1);
  // visibility:hidden at rest — capture faces never grow a phantom chip
  await expect(hint).toBeHidden();
  await fab.hover();
  await expect(hint).toBeVisible();
  await expect(hint).toHaveText('⌘J');
});

test('a wake-family FAB carries the same ⌘J hint (shared consumption point)', async ({
  page,
}) => {
  await page.goto('/app/team?scenario=12');
  const fab = page.locator('.secondary-fab');
  const hint = fab.locator('.kbd-hint');
  await expect(hint).toBeHidden();
  await fab.hover();
  await expect(hint).toBeVisible();
  await expect(hint).toHaveText('⌘J');
});

test('the collapsed rail search icon hovers the ⌘K hint', async ({ page }) => {
  await page.goto(BOARD);
  await page.locator('button[aria-label="收起侧边栏"]').click();
  const railSearch = page.locator('.rail-row[aria-label="搜索"]');
  await expect(railSearch).toBeVisible();
  const hint = railSearch.locator('.kbd-hint');
  await expect(hint).toBeHidden();
  await railSearch.hover();
  await expect(hint).toBeVisible();
  await expect(hint).toHaveText('⌘K');
});
