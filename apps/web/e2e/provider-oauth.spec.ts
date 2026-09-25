import { expect, type Page, test } from '@playwright/test';

// #231 OAuth 连接订阅面（#175 表单族延伸；DialogShell 律沿用）。钉的
// 失败方式：
// 1. 弹窗带连接订阅段——GitHub Copilot 行在（族表 = shared OAUTH_FAMILIES
//    单源，表内唯一武装族）
// 2. 死钮律（#222）：未开通族（openai-codex / xai）不渲染行
// 3. fixture 点击 = accept 律（点连接即关窗；live 面 = POST authorize →
//    同页签跳走，真链路由 server test/oauth.test.ts 覆盖）
// 4. callback 着陆参 ?oauth=error&reason=denied → 自动重开弹窗 + inline
//    文案 + 清参（刷新不重放）
// 5. ?oauth=connected 静默着陆（不弹窗、无错误行）
// 6. ?oauth=error&reason=state（#243：state 缺/过期改 302 着陆）→ 过期
//    文案 + 重开弹窗

const PROVIDERS = '/app/resources/providers?scenario=01';

async function openDialog(page: Page) {
  await page.goto(PROVIDERS);
  await page.locator('.res-new').click();
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  return dialog;
}

test('连接订阅段渲染武装族行（GitHub Copilot），未开通族不渲染', async ({ page }) => {
  const dialog = await openDialog(page);
  const rows = dialog.locator('.dlg-provider-oauth');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toHaveText('GitHub Copilot');
  // 死钮律：openai-codex / xai 未在族表 = 无行
  await expect(dialog.getByText('OpenAI Codex')).toHaveCount(0);
  await expect(dialog.getByText('SuperGrok')).toHaveCount(0);
  await expect(dialog.locator('.dlg-provider-divider')).toHaveText('或添加自定义网关');
});

test('fixture 面点连接 = accept 律（关窗），重开段仍在', async ({ page }) => {
  const dialog = await openDialog(page);
  await dialog.locator('.dlg-provider-oauth').first().click();
  await expect(page.locator('.dlg')).toBeHidden();
  const again = await openDialog(page);
  await expect(again.locator('.dlg-provider-oauth')).toHaveCount(1);
  await expect(again.locator('.dlg-provider-oauth-error')).toHaveCount(0);
});

test('着陆参 oauth=error&reason=denied 自动重开弹窗 + 文案 + 清参', async ({ page }) => {
  await page.goto(`${PROVIDERS}&oauth=error&reason=denied`);
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.dlg-provider-oauth-error')).toHaveText('授权已被取消。');
  // 清参后刷新不重放
  await expect(page).toHaveURL((url) => !url.searchParams.has('oauth'));
  await page.reload();
  await expect(page.locator('.dlg')).toHaveCount(0);
});

test('着陆参 oauth=error&reason=exchange 走交换失败文案', async ({ page }) => {
  await page.goto(`${PROVIDERS}&oauth=error&reason=exchange`);
  await expect(page.locator('.dlg-provider-oauth-error')).toHaveText('令牌交换失败，请稍后重试。');
});

// #243：state 缺/过期 callback 改 302 着陆（不再裸 400）——reason=state 走
// 过期文案 + 自动重开弹窗，用户可原地重试。
test('着陆参 oauth=error&reason=state 走过期文案 + 重开弹窗', async ({ page }) => {
  await page.goto(`${PROVIDERS}&oauth=error&reason=state`);
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.dlg-provider-oauth-error')).toHaveText('连接已过期，请重新发起。');
});

test('着陆参 oauth=connected 静默：不弹窗、无错误行', async ({ page }) => {
  await page.goto(`${PROVIDERS}&oauth=connected&provider=github-copilot`);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.dlg')).toHaveCount(0);
  await expect(page).toHaveURL((url) => !url.searchParams.has('oauth'));
});
