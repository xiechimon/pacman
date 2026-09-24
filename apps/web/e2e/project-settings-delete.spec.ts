import { expect, type Page, test } from '@playwright/test';

// Issue #207 删除区复活(#189 DELETE /api/projects/:id 已落地):设置页危险
// 操作区删除卡恢复(r2 24c 形状)+ DeleteConfirm 家族项目确认弹层(r2 24d,
// 键入项目名精确匹配才解禁)+ 确认后跳项目列表面(/app)。每例钉一个失败
// 方式:
// 1. 危险区缺位 — 卡不渲染或点开弹层形状不全(标题/项目名摘要/确认输入)。
// 2. 家族律关闭失守 — 取消/X/Esc/backdrop 关不掉,或关闭误删误跳。
// 3. 确认闸门失守 — 空输入/不匹配输入下删除钮可用(误删通道),或精确匹配
//    后仍禁用(流程死锁)。
// 4. 确认后不跳 /app,或跳走后侧栏项目行仍在(列表未消;fixture 删除覆面
//    = #66 deletions 同律,reload 还原)。

const SETTINGS = '/app/project/ZAQczKCu0MOAzC1ZqcFlX/settings?scenario=r2-24c';
const PROJECT_NAME = 'r3-lifecycle';
const PROJECT_ROW = 'a.sidebar-subrow[href*="/app/project/ZAQczKCu0MOAzC1ZqcFlX"]';

async function openConfirm(page: Page) {
  await page.goto(SETTINGS);
  await page.locator('.prj-set-delete').click();
  const dialog = page.locator('.delete-confirm--project');
  await expect(dialog).toBeVisible();
  return dialog;
}

test('danger card renders and opens the project delete confirm', async ({ page }) => {
  await page.goto(SETTINGS);
  await expect(page.locator('.prj-set-danger-label')).toHaveText('危险操作');
  await expect(page.locator('.prj-set-danger-title')).toHaveText('删除项目');
  const dialog = await openConfirm(page);
  await expect(dialog).toHaveAttribute('role', 'alertdialog');
  await expect(dialog.locator('.delete-confirm-title')).toHaveText(
    '确定删除该项目？此操作不可撤销。',
  );
  await expect(dialog.locator('.delete-confirm-summary')).toHaveText(PROJECT_NAME);
  await expect(dialog.locator('.delete-confirm-prompt')).toHaveText(
    `输入 ${PROJECT_NAME} 以确认删除`,
  );
});

test('family-law close: 取消 / X / Esc / backdrop — nothing deleted, no navigation', async ({
  page,
}) => {
  let dialog = await openConfirm(page);
  await dialog.locator('.delete-confirm-cancel').click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/settings/);

  dialog = await openConfirm(page);
  await dialog.locator('.delete-confirm-close').click();
  await expect(dialog).toBeHidden();

  dialog = await openConfirm(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  dialog = await openConfirm(page);
  // raw mouse click = secret-add-dialog 同款:force click 按元素中心落点,
  // 居中弹层正好压住 backdrop 中心,事件会落到弹层上。
  await page.mouse.click(20, 20);
  await expect(dialog).toBeHidden();
  // 全程无删除:侧栏项目行仍在
  await expect(page.locator(PROJECT_ROW)).toBeVisible();
});

test('confirm input gates the delete button — mismatch disables, exact match enables', async ({
  page,
}) => {
  const dialog = await openConfirm(page);
  const del = dialog.locator('.delete-confirm-delete');
  const input = dialog.locator('.delete-confirm-input');
  await expect(del).toBeDisabled();
  await input.fill('not-the-project');
  await expect(del).toBeDisabled();
  // 大小写/空白不放宽:精确匹配才解禁
  await input.fill(` ${PROJECT_NAME} `);
  await expect(del).toBeDisabled();
  await input.fill(PROJECT_NAME);
  await expect(del).toBeEnabled();
});

test('confirm deletes and lands on the board with the project row gone', async ({ page }) => {
  const dialog = await openConfirm(page);
  await dialog.locator('.delete-confirm-input').fill(PROJECT_NAME);
  await dialog.locator('.delete-confirm-delete').click();
  await expect(page).toHaveURL('/app');
  // 列表消失:侧栏项目组不再有该项目行(#66 fixture 删除覆面同律)
  await expect(page.locator(PROJECT_ROW)).toHaveCount(0);
});
