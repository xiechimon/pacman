import { expect, type Page, test } from '@playwright/test';

// Wayfinder ticket #173: the secrets-page 新建 action opens the 添加密钥
// dialog (r2 §242 field authority: 名称（环境变量名）/ 描述（可选）/ 值
// textarea + the encrypted-storage note + 添加密钥 submit). Rides
// DialogShell (#68 family law) per the #170 canonical mode. Each test
// pins one failure mode:
// 1. res-new opens the dialog with the captured field set
// 2. family-law close: X / Esc / backdrop; panel clicks survive
// 3. empty name or value keeps 添加密钥 disabled; filling lifts it
// 4. fixture submit closes the dialog (accept 律)

const SECRETS = '/app/resources/secrets?scenario=01';

async function openDialog(page: Page) {
  await page.goto(SECRETS);
  await page.locator('.res-new').click();
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  return dialog;
}

test('res-new opens the 添加密钥 dialog with the captured fields', async ({ page }) => {
  const dialog = await openDialog(page);
  await expect(dialog.locator('.dlg-title')).toHaveText('添加密钥');
  await expect(dialog.locator('#dlg-secret-name')).toHaveAttribute(
    'placeholder',
    'STRIPE_API_KEY',
  );
  await expect(dialog.locator('#dlg-secret-desc')).toHaveAttribute('placeholder', '该密钥的用途');
  await expect(dialog.locator('#dlg-secret-value')).toHaveAttribute('placeholder', '粘贴密钥的值');
  await expect(dialog.locator('.dlg-secret-note')).toContainText('值将加密存储');
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
  const submit = dialog.locator('.dlg-secret-create');
  await expect(submit).toBeDisabled();
  await dialog.locator('#dlg-secret-name').fill('STRIPE_API_KEY');
  await expect(submit).toBeDisabled();
  await dialog.locator('#dlg-secret-value').fill('sk-test-170');
  await expect(submit).toBeEnabled();
});

test('fixture submit closes the dialog (accept 律)', async ({ page }) => {
  const dialog = await openDialog(page);
  await dialog.locator('#dlg-secret-name').fill('STRIPE_API_KEY');
  await dialog.locator('#dlg-secret-value').fill('sk-test-170');
  await dialog.locator('.dlg-secret-create').click();
  await expect(page.locator('.dlg')).toBeHidden();
});
