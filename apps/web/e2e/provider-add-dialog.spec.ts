import { expect, type Page, test } from '@playwright/test';

// Wayfinder ticket #175: the providers page 添加 action opens the
// add-provider dialog (r8 75 built-in detail as the family reference;
// geometry [推断] per family form — capture PNGs unreadable on this API
// line; field authority = server createProviderBodySchema / r3 §2:
// 服务商 ID / 名称 / Base URL / API 协议 / API 密钥 + Bearer 复选 /
// 模型 rows). Rides DialogShell (#68 family law) per the #170 canonical
// mode. Each test pins one failure mode:
// 1. res-new opens the dialog with the schema fields and the observed
//    defaults (OpenAI Completions protocol, Bearer checkbox on)
// 2. family-law close: X / Esc / backdrop; panel clicks survive
// 3. required fields gate the submit (providerId/label/baseUrl)
// 4. fixture submit closes the dialog (accept 律) and reopens clean

const PROVIDERS = '/app/resources/providers?scenario=01';

async function openDialog(page: Page) {
  await page.goto(PROVIDERS);
  await page.locator('.res-new').click();
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  return dialog;
}

test('res-new opens the 添加模型服务 dialog with schema fields and defaults', async ({
  page,
}) => {
  const dialog = await openDialog(page);
  await expect(dialog.locator('.dlg-title')).toHaveText('添加模型服务');
  await expect(dialog.locator('#dlg-provider-id')).toBeVisible();
  await expect(dialog.locator('#dlg-provider-label')).toBeVisible();
  await expect(dialog.locator('#dlg-provider-baseurl')).toBeVisible();
  await expect(dialog.locator('#dlg-provider-apikey')).toBeVisible();
  // r3 §2 defaults: OpenAI Completions protocol active, Bearer checkbox on
  await expect(
    dialog.locator('.dlg-provider-seg-tab', { hasText: 'OpenAI Completions' }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(dialog.locator('#dlg-provider-authheader')).toBeChecked();
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

test('providerId/label/baseUrl gate the submit; protocol segment swaps', async ({ page }) => {
  const dialog = await openDialog(page);
  const submit = dialog.locator('.dlg-provider-create');
  await expect(submit).toBeDisabled();
  await dialog.locator('#dlg-provider-id').fill('relay-175');
  await expect(submit).toBeDisabled();
  await dialog.locator('#dlg-provider-label').fill('R 175 网关');
  await expect(submit).toBeDisabled();
  await dialog.locator('#dlg-provider-baseurl').fill('https://relay-175.example.com/v1');
  await expect(submit).toBeEnabled();
  // protocol segment swaps the selection
  await dialog.locator('.dlg-provider-seg-tab', { hasText: 'Anthropic Messages' }).click();
  await expect(
    dialog.locator('.dlg-provider-seg-tab', { hasText: 'Anthropic Messages' }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(
    dialog.locator('.dlg-provider-seg-tab', { hasText: 'OpenAI Completions' }),
  ).toHaveAttribute('aria-selected', 'false');
});

test('fixture submit closes the dialog (accept 律) and reopens clean', async ({ page }) => {
  const dialog = await openDialog(page);
  await dialog.locator('#dlg-provider-id').fill('relay-175');
  await dialog.locator('#dlg-provider-label').fill('R 175 网关');
  await dialog.locator('#dlg-provider-baseurl').fill('https://relay-175.example.com/v1');
  await dialog.locator('.dlg-provider-create').click();
  await expect(page.locator('.dlg')).toBeHidden();
  // reopen: every field back to its initial state
  const again = await openDialog(page);
  await expect(again.locator('#dlg-provider-id')).toHaveValue('');
  await expect(again.locator('#dlg-provider-label')).toHaveValue('');
  await expect(again.locator('#dlg-provider-baseurl')).toHaveValue('');
  await expect(again.locator('#dlg-provider-apikey')).toHaveValue('');
  await expect(again.locator('.dlg-provider-create')).toBeDisabled();
});

test('model rows keep the submit reachable (dialog body scrolls)', async ({ page }) => {
  const dialog = await openDialog(page);
  await dialog.locator('#dlg-provider-id').fill('relay-175');
  await dialog.locator('#dlg-provider-label').fill('R 175 网关');
  await dialog.locator('#dlg-provider-baseurl').fill('https://relay-175.example.com/v1');
  const addModel = dialog.locator('.dlg-provider-model-add');
  await addModel.click();
  await addModel.click();
  await addModel.click();
  await expect(dialog.locator('[aria-label="模型 ID"]')).toHaveCount(3);
  const submit = dialog.locator('.dlg-provider-create');
  // .dlg is overflow:hidden with no max-height — the body must scroll so a
  // tall form never pushes the submit out of the viewport (live finding)
  await expect(submit).toBeInViewport();
  await submit.click();
  await expect(page.locator('.dlg')).toBeHidden();
});
