import { expect, type Page, test } from '@playwright/test';

// Issue #305 (M7-W2 档 1): the project 任务 tab's 暂无内容 empty state
// carries a 「+ 任务」 entry that was rendered dead (M7 ledger). It now
// joins the board's new-task entry — same NewTaskDialog, same wiring law
// (#66/#176): open state + save honors the dialog's selected project
// (live = createTodo mutation on the route's project; fixture = the
// board's client-side localTodo append, 刚刚 label against the frozen
// clock). The dialog preselects THIS project (the entry lives on the
// project's own surface). Each test pins one failure mode:
// 1. the empty-state button opens the dialog (current state: dead button)
// 2. the dialog's project chip preselects the route's project, not
//    rows[0] of the team set
// 3. 保存 in the fixture face lands the first task row (board's #66 law)
// 4. Escape closes the dialog

const EMPTY_TASKS = '/app/project/ZAQczKCu0MOAzC1ZqcFlX?scenario=r2-24b&tab=tasks';
const TITLE = '空项目第一个任务';

// #946/#910 载体：空态 = 一级 text（暂无内容）；空态入口钮带 aria-label
// 新建任务（与 topbar 任务 tab 的文案区分）；dialog/正文/项目 chip 走
// overlay 域的语义位（role=dialog、dialog 内唯一 textbox、chip 文案）。
async function openDialog(page: Page) {
  await page.goto(EMPTY_TASKS);
  await expect(page.getByText('暂无内容')).toBeVisible();
  await page.getByRole('button', { name: '新建任务' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

test('the empty-state 新建任务 button opens the new-task dialog', async ({ page }) => {
  await openDialog(page);
});

test('the dialog preselects the route project on its chip', async ({ page }) => {
  const dialog = await openDialog(page);
  await expect(dialog.getByText('r3-lifecycle', { exact: true })).toBeVisible();
});

test('fixture 保存 lands the first task row with the 刚刚 label', async ({ page }) => {
  const dialog = await openDialog(page);
  // spec 15 #394：单字段正文；占位标题 = 首行（此处单行原文 = 标题）
  await dialog.getByRole('textbox').fill(TITLE);
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  // the empty state is gone; the row carries the title + 刚刚 (r2 §4.2
  // count coupling, board's #66 fixture law)
  await expect(page.getByText('暂无内容')).toHaveCount(0);
  const row = page.getByTestId('task-row').filter({ hasText: TITLE });
  await expect(row).toBeVisible();
  await expect(row).toContainText('刚刚');
});

test('Escape closes the dialog', async ({ page }) => {
  const dialog = await openDialog(page);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});
