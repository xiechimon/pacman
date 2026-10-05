import { expect, type Page, test } from '@playwright/test';

// Wayfinder ticket #173: the secrets-page 新建 action opens the 添加密钥
// dialog (r2 §242 field authority: 名称（环境变量名）/ 描述（可选）/ 值
// textarea + the encrypted-storage note + 添加密钥 submit). Rides
// DialogShell (#68 family law) per the #170 canonical mode. Each test
// pins one failure mode:
// 1. topbar 新建 opens the dialog with the captured field set
// (#944/#910: .res-new 类名钩退役 → role+文案一级载体)
// 2. family-law close: X / Esc / backdrop; panel clicks survive
// 3. empty name or value keeps 添加密钥 disabled; filling lifts it
// 4. fixture submit closes the dialog (accept 律)

const SECRETS = '/app/resources/secrets?scenario=01';

async function openDialog(page: Page) {
  await page.goto(SECRETS);
  await page.getByRole('button', { name: '新建', exact: true }).click();
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  return dialog;
}

test('topbar 新建 opens the 添加密钥 dialog with the captured fields', async ({ page }) => {
  const dialog = await openDialog(page);
  await expect(dialog.locator('.dlg-title')).toHaveText('添加密钥');
  // #942 正典表 §5.3/§5.4 载体：表单输入 getByLabel 一级、note 一级 text、
  // 提交钮 getByRole——行为断言语义与原 id/类名 locator 版一字不动。
  await expect(dialog.getByLabel('名称（环境变量名）')).toHaveAttribute(
    'placeholder',
    'STRIPE_API_KEY',
  );
  await expect(dialog.getByLabel('描述（可选）')).toHaveAttribute('placeholder', '该密钥的用途');
  await expect(dialog.getByLabel('值')).toHaveAttribute('placeholder', '粘贴密钥的值');
  await expect(dialog.getByText('值将加密存储')).toContainText('值将加密存储');
});

test('family law: X, Escape and backdrop dismiss; panel clicks do not', async ({ page }) => {
  let dialog = await openDialog(page);
  await dialog.locator('.dlg-close').click();
  await expect(page.locator('.dlg')).toBeHidden();

  dialog = await openDialog(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.dlg')).toBeHidden();

  dialog = await openDialog(page);
  await dialog.locator('.dlg-title').click();
  await expect(page.locator('.dlg')).toBeVisible();
  await page.mouse.click(20, 20);
  await expect(page.locator('.dlg')).toBeHidden();
});

test('empty name or value keeps the submit disabled; filling lifts it', async ({ page }) => {
  const dialog = await openDialog(page);
  const submit = dialog.getByRole('button', { name: '添加密钥' });
  await expect(submit).toBeDisabled();
  await dialog.getByLabel('名称（环境变量名）').fill('STRIPE_API_KEY');
  await expect(submit).toBeDisabled();
  await dialog.getByLabel('值').fill('sk-test-170');
  await expect(submit).toBeEnabled();
});

test('fixture submit closes the dialog (accept 律)', async ({ page }) => {
  const dialog = await openDialog(page);
  await dialog.getByLabel('名称（环境变量名）').fill('STRIPE_API_KEY');
  await dialog.getByLabel('值').fill('sk-test-170');
  await dialog.getByRole('button', { name: '添加密钥' }).click();
  await expect(page.locator('.dlg')).toBeHidden();
});
