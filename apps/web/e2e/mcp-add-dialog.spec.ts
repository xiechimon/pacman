import { expect, test } from '@playwright/test';

// Wayfinder ticket #174: the mcp-servers page 添加 action opens the
// add-server dialog (r8 71 remote-HTTP / 72 stdio captures for geometry,
// [推断] per family form; field authority = 02 §6.2/r3 §5.1: 名称/标识符
// (slug, 前缀语义)/URL/请求头 for http; 命令/参数 for stdio). Rides
// DialogShell (#68 family law) per the #170 canonical mode. Each test
// pins one failure mode:
// 1. res-new opens the dialog with the shared fields
// 2. family-law close: X / Esc / backdrop; panel clicks survive
// 3. transport segment swaps the conditional fields (url vs command)
// 4. per-transport required fields gate the submit; fixture submit closes

const MCP = '/app/resources/mcp-servers?scenario=01';

async function openDialog(page: import('@playwright/test').Page) {
  await page.goto(MCP);
  await page.locator('.res-new').click();
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  return dialog;
}

test('res-new opens the 添加 MCP 服务器 dialog with shared fields', async ({ page }) => {
  const dialog = await openDialog(page);
  await expect(dialog.locator('.dlg-title')).toHaveText('添加 MCP 服务器');
  await expect(dialog.locator('#dlg-mcp-label')).toBeVisible();
  await expect(dialog.locator('#dlg-mcp-slug')).toBeVisible();
  // 远程 HTTP is the default transport: URL field visible, command absent
  await expect(dialog.locator('#dlg-mcp-url')).toBeVisible();
  await expect(dialog.locator('#dlg-mcp-command')).toHaveCount(0);
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

test('transport segment swaps conditional fields and gates the submit', async ({ page }) => {
  const dialog = await openDialog(page);
  const submit = dialog.locator('.dlg-mcp-create');
  // http form: label + slug + url all required
  await expect(submit).toBeDisabled();
  await dialog.locator('#dlg-mcp-label').fill('internal api');
  await dialog.locator('#dlg-mcp-slug').fill('internal-api');
  await expect(submit).toBeDisabled();
  await dialog.locator('#dlg-mcp-url').fill('https://mcp.internal.dev/sse');
  await expect(submit).toBeEnabled();
  // switch to stdio: command replaces url as the required field
  await dialog.locator('.dlg-mcp-seg-tab', { hasText: '本地命令' }).click();
  await expect(dialog.locator('#dlg-mcp-command')).toBeVisible();
  await expect(dialog.locator('#dlg-mcp-url')).toHaveCount(0);
  await expect(submit).toBeDisabled();
  await dialog.locator('#dlg-mcp-command').fill('npx -y mcp-server-fs');
  await expect(submit).toBeEnabled();
});

test('fixture submit closes the dialog (accept 律)', async ({ page }) => {
  const dialog = await openDialog(page);
  await dialog.locator('#dlg-mcp-label').fill('internal api');
  await dialog.locator('#dlg-mcp-slug').fill('internal-api');
  await dialog.locator('#dlg-mcp-url').fill('https://mcp.internal.dev/sse');
  await dialog.locator('.dlg-mcp-create').click();
  await expect(page.locator('.dlg')).toBeHidden();
});
