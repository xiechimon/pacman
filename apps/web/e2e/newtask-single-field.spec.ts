import { expect, type Page, test } from '@playwright/test';

// spec 15 #394: the new-task dialog is single-field (spec body only) — no
// title input (server derives the placeholder title from the first non-empty
// line; the executing agent backfills the real title via set_task_meta),
// no manual tag UI (fixed vocabulary, agent-assigned, ADR 0002).
// Each test pins one failure mode:
// 1. the title input / tag row come back (structure regression)
// 2. the save gate regresses to title-based (empty body stays disabled)
// 3. the fixture card lands without the derived first-line title
// 4. a >50-char first line isn't truncated with the ellipsis
// 5. autofocus leaves the spec textarea

const BOARD = '/app?scenario=01';

async function openDialog(page: Page) {
  await page.goto(BOARD);
  await page.locator('.board-new-task').click();
  const dialog = page.locator('.new-task-dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

test('the dialog has no title input and no tag UI', async ({ page }) => {
  const dialog = await openDialog(page);
  await expect(dialog.locator('.new-task-input')).toHaveCount(0);
  await expect(dialog.locator('.new-task-tags')).toHaveCount(0);
  await expect(dialog.locator('.new-task-tag-add')).toHaveCount(0);
  await expect(dialog.locator('.new-task-spec')).toBeVisible();
});

test('save buttons gate on the spec body, not a title', async ({ page }) => {
  const dialog = await openDialog(page);
  const save = dialog.getByRole('button', { name: '保存', exact: true });
  const start = dialog.getByRole('button', { name: '保存并开始' });
  await expect(save).toBeDisabled();
  await expect(start).toBeDisabled();
  await dialog.locator('.new-task-spec').fill('修支付回调');
  await expect(save).toBeEnabled();
  await expect(start).toBeEnabled();
});

test('fixture 保存 lands a card titled by the first line', async ({ page }) => {
  const dialog = await openDialog(page);
  await dialog.locator('.new-task-spec').fill('给登录页加验证码\n\n现在的情况：无');
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const card = page.locator('[data-column="todo"] .todo-card', { hasText: '给登录页加验证码' });
  await expect(card).toBeVisible();
  // 标题只取首行——第二行不进卡片标题
  await expect(card.locator('.todo-card-title')).toHaveText('给登录页加验证码');
});

test('a >50-char first line is truncated with an ellipsis', async ({ page }) => {
  const dialog = await openDialog(page);
  await dialog.locator('.new-task-spec').fill('长'.repeat(60));
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  const title = page.locator('[data-column="todo"] .todo-card .todo-card-title').last();
  await expect(title).toHaveText(`${'长'.repeat(50)}…`);
});

test('autofocus lands on the spec textarea', async ({ page }) => {
  const dialog = await openDialog(page);
  await expect(dialog.locator('.new-task-spec')).toBeFocused();
});
