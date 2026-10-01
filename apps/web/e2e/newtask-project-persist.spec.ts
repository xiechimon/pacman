import { expect, type Page, test } from '@playwright/test';

// XMON-87: the new-task dialog's project chip was pure component state, so a
// reload dropped the pick back to rows[0] of the team set. The chip now
// remembers the pick in localStorage (key = NEW_TASK_PROJECT_STORAGE_KEY in
// overlay/new-task-dialog.tsx, mirrored below). Scope: the unanchored face
// (board / sidebar global dialog) only — the project page's own dialog keeps
// #305/#404, where the untouched default is the route project.
// Each test pins one failure mode:
// 1. pick a non-first row, reload → chip and check still on it
// 2. remembered id no longer in the project set → rows[0], board alive
// 3. nothing stored → rows[0] (the pre-fix default, unchanged)
// 4. the anchored project page ignores the memory while the board honors it

const STORAGE_KEY = 'pacman.newTaskProjectId'; // mirrored: new-task-dialog.tsx
const BOARD = '/app?scenario=newtask-projects';
const PROJECT = '/app/project/ZAQczKCu0MOAzC1ZqcFlX?scenario=newtask-projects';

/** Seed the memory before any navigation (and keep it across reloads). */
function seedStoredProject(page: Page, projectId: string) {
  return page.addInitScript(
    ([key, id]) => window.localStorage.setItem(key, id),
    [STORAGE_KEY, projectId],
  );
}

// #389 opener on every route: the sidebar 新任务 row. On the project page it
// routes through the page's own dialog (anchored), elsewhere through the
// global one.
async function openDialog(page: Page) {
  await page.locator('.sidebar-new-task').click();
  const dialog = page.locator('.new-task-dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

async function pick(page: Page, name: string) {
  await page.locator('.new-task-project').click();
  await page.locator('.new-task-project-row', { hasText: name }).click();
  await expect(page.locator('.new-task-project-name')).toHaveText(name);
}

test('the picked project survives a reload', async ({ page }) => {
  await page.goto(BOARD);
  await openDialog(page);
  await pick(page, 'r2-inventory');

  await page.reload();
  const dialog = await openDialog(page);
  await expect(dialog.locator('.new-task-project-name')).toHaveText('r2-inventory');
  await dialog.locator('.new-task-project').click();
  await expect(page.locator('.new-task-project-row', { hasText: 'r2-inventory' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('a remembered project that is gone falls back to the first row', async ({ page }) => {
  await seedStoredProject(page, 'ghost-project');
  await page.goto(BOARD);
  const dialog = await openDialog(page);
  await expect(dialog.locator('.new-task-project-name')).toHaveText('r3-lifecycle');
  await dialog.locator('.new-task-project').click();
  await expect(page.locator('.new-task-project-row').first()).toHaveAttribute(
    'aria-selected',
    'true',
  );
  // 不是白屏：看板本体照常渲染
  await expect(page.locator('.board-column').first()).toBeVisible();
});

test('with nothing stored the chip starts on the first row', async ({ page }) => {
  await page.goto(BOARD);
  const dialog = await openDialog(page);
  await expect(dialog.locator('.new-task-project-name')).toHaveText('r3-lifecycle');
});

test('the anchored project page keeps its route project while the board honors the memory', async ({
  page,
}) => {
  await seedStoredProject(page, 'r2-inventory');

  await page.goto(PROJECT);
  const anchored = await openDialog(page);
  await expect(anchored.locator('.new-task-project-name')).toHaveText('r3-lifecycle');

  await page.goto(BOARD);
  const board = await openDialog(page);
  await expect(board.locator('.new-task-project-name')).toHaveText('r2-inventory');
});