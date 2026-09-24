import { expect, type Page, test } from '@playwright/test';

// Wayfinder ticket #181: the machines page res-add 钮 opens the 添加机器
// dialog (#179 裁决 = r2 11b CLI 两步表单): 引导语 + 安装 CLI / 在机器上执行
// 命令块(带 复制,包名/命令名 = BRAND 品牌槽)+ 底部 API key disclosure
// (展开 → `pacman start --api-key <key> --team <teamId>` + 获取 API key →
// 链接,#121 Link family: scenario 随跳)。Rides DialogShell (#68 family
// law) per the #170 canonical mode. Each test pins one failure mode:
// 1. res-add opens the dialog with the two-step command blocks
// 2. family-law close: X / Esc / backdrop; panel clicks survive
// 3. the API key disclosure expands the key command + the api-keys link
// 4. copy buttons write their command to the clipboard

const MACHINES = '/app/resources/machines?scenario=06';

async function openDialog(page: Page) {
  await page.goto(MACHINES);
  await page.locator('.res-add').click();
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  return dialog;
}

test('res-add opens the 添加机器 dialog with the two-step command blocks', async ({ page }) => {
  const dialog = await openDialog(page);
  await expect(dialog.locator('.dlg-title')).toHaveText('添加机器');
  await expect(dialog.locator('.dlg-enroll-lead')).toContainText('有条件时优先使用云主机');
  // fixture 团队名插值 = TEAM_NAME 常量(team-page 同律)
  await expect(dialog.locator('.dlg-enroll-desc')).toContainText(
    "授权团队 Xmon Dai's team 后机器即可上线",
  );
  const commands = dialog.locator('.dlg-enroll-cmd code');
  await expect(commands).toHaveCount(2);
  await expect(commands.nth(0)).toHaveText('npm install -g @pacman/cli@latest');
  await expect(commands.nth(1)).toHaveText('pacman start');
  // API key disclosure collapsed by default
  await expect(dialog.locator('.dlg-enroll-toggle')).toBeVisible();
  await expect(dialog.locator('.dlg-enroll-apikey')).toHaveCount(0);
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

test('API key disclosure expands the key command and the api-keys link', async ({ page }) => {
  const dialog = await openDialog(page);
  await dialog.locator('.dlg-enroll-toggle').click();
  // fixture 模式无真 teamId → <teamId> 占位;命令形状 = 02 §5.2 路径二
  await expect(dialog.locator('.dlg-enroll-apikey code')).toHaveText(
    'pacman start --api-key <key> --team <teamId>',
  );
  const link = dialog.locator('.dlg-enroll-keylink');
  await expect(link).toHaveText('获取 API key →');
  await expect(link).toHaveAttribute('href', '/app/api-keys?scenario=06');
  // toggle collapses again
  await dialog.locator('.dlg-enroll-toggle').click();
  await expect(dialog.locator('.dlg-enroll-apikey')).toHaveCount(0);
});

test('copy buttons write their command to the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const dialog = await openDialog(page);
  await dialog.locator('.dlg-enroll-copy').first().click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe('npm install -g @pacman/cli@latest');
  await dialog.locator('.dlg-enroll-copy').nth(1).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe('pacman start');
});
