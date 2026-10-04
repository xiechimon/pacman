import { expect, type Page, test } from '@playwright/test';
import { evidenceShot } from './evidence';

// #757 follow-up: attachment token lines must never surface as bare paths in
// title faces. derivePlaceholderTitle (shared — also server createTodo and
// set_task_meta title normalization) skips whole-line token rows and renders
// inline tokens as file names; the board card prints the derived title
// verbatim, so pinning the card pins the whole chain. Fixture mode
// (?scenario=01) drives the REAL localTodo derivation — no stub stands in
// for the title (newtask-single-field.spec discipline).

const BOARD = '/app?scenario=01';
const TOKEN = '![pasted-image-1.png](attachment:team-1/att-1.png)';

async function saveSpec(page: Page, spec: string) {
  await page.goto(BOARD);
  await page.locator('.sidebar-new-task').click();
  const dialog = page.locator('.new-task-dialog');
  await expect(dialog).toBeVisible();
  await page.locator('.new-task-spec').fill(spec);
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  const card = page.locator('[data-column="todo"] .todo-card').last();
  await expect(card).toBeVisible();
  return card;
}

test('token-first spec titles the card with the prose line, not the token', async ({
  page,
}) => {
  const card = await saveSpec(page, `${TOKEN}\n修复登录`);
  await evidenceShot(page, 'title-board-token-first.png');
  await expect(card.locator('.todo-card-title')).toHaveText('修复登录');
});

test('all-token spec titles the card with the file name', async ({ page }) => {
  const card = await saveSpec(page, TOKEN);
  await evidenceShot(page, 'title-board-all-token.png');
  await expect(card.locator('.todo-card-title')).toHaveText('pasted-image-1.png');
});

test('inline token in the first line renders as the file name', async ({ page }) => {
  const card = await saveSpec(page, '看这个 ![a.png](attachment:t/i.png) 很重要');
  await evidenceShot(page, 'title-board-inline.png');
  await expect(card.locator('.todo-card-title')).toHaveText('看这个 a.png 很重要');
});
