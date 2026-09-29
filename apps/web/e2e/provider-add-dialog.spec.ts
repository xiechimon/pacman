import { expect, type Page, test } from '@playwright/test';

// #355 (spec 11 §A6): 添加服务商 dialog = picker 形态——搜索框 + 38 行
// preset(目录 wire 真值 = shared PROVIDER_PRESET_IDS,显示名 = spec 11
// 实测名表)+ 底部「自定义端点」入口展开现有自定义表单(r3 §2 字段权威 =
// shared createProviderBodySchema:服务商 ID / 名称 / Base URL / API 协议 /
// API 密钥 + Bearer 复选 / 模型 rows)。api_key 行点击进该 preset 的密钥
// 表单 = 同一表单 + providerId/label 预填(目录未采 baseUrl/api,不发明)。
// Rides DialogShell (#68 family law) per the #170 canonical mode.
// Each test pins one failure mode:
// 1. 打开 = picker 面:38 行、搜索框、底部自定义端点入口、无 footer 死 submit
// 2. 搜索按显示名与 id 过滤(大小写不敏感);空查询回全量;零命中空列表
// 3. OAuth 徽标只骑族表已接线行(现仅 github-copilot);codex 未接线行
//    禁用 + 「暂未开通」注记(#385)
// 4. 自定义端点 → 表单字段与默认值同现状;返回列表可达
// 5. api_key 行 → 表单预填 providerId/label;xai 行 → 密钥表单内显 oauthLabel
// 6. family-law close: X / Esc / backdrop; panel clicks survive
// 7. 必填 gate + 协议段切换
// 8. fixture 提交关窗(accept 律),重开回干净 picker
// 9. 模型行撑溢时 submit 恒可达(body scrolls)

const PROVIDERS = '/app/resources/providers?scenario=01';

async function openPicker(page: Page) {
  await page.goto(PROVIDERS);
  await page.locator('.res-new').click();
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  return dialog;
}

async function openCustomForm(page: Page) {
  const dialog = await openPicker(page);
  await dialog.locator('.dlg-provider-custom').click();
  await expect(dialog.locator('#dlg-provider-id')).toBeVisible();
  return dialog;
}

test('res-new opens the picker: 38 preset rows, search, 自定义端点 entry, no dead submit', async ({
  page,
}) => {
  const dialog = await openPicker(page);
  await expect(dialog.locator('.dlg-title')).toHaveText('添加模型服务');
  await expect(dialog.locator('.dlg-provider-search')).toBeVisible();
  await expect(dialog.locator('.dlg-provider-preset')).toHaveCount(38);
  await expect(dialog.locator('.dlg-provider-custom')).toHaveText('自定义端点');
  // 目录序 = server providerPresets() wire 序(oauth 2 + xai 打头)
  await expect(dialog.locator('.dlg-provider-preset').first()).toContainText('GitHub Copilot');
  // #222:picker 面无必填字段,不得渲染禁用态 submit
  await expect(dialog.locator('.dlg-provider-create')).toHaveCount(0);
});

test('search filters by display name and id, case-insensitive; empty query restores 38', async ({
  page,
}) => {
  const dialog = await openPicker(page);
  const search = dialog.locator('.dlg-provider-search');
  await search.fill('deepseek');
  await expect(dialog.locator('.dlg-provider-preset')).toHaveCount(1);
  await expect(dialog.locator('.dlg-provider-preset').first()).toContainText('DeepSeek');
  await search.fill('MOONSHOT');
  await expect(dialog.locator('.dlg-provider-preset')).toHaveCount(2);
  await search.fill('z-ai');
  await expect(dialog.locator('.dlg-provider-preset')).toHaveCount(2);
  await search.fill('no-such-provider');
  await expect(dialog.locator('.dlg-provider-preset')).toHaveCount(0);
  await search.fill('');
  await expect(dialog.locator('.dlg-provider-preset')).toHaveCount(38);
});

test('OAuth badge rides wired family rows only (github-copilot); codex unwired carries a note, xai none', async ({
  page,
}) => {
  const dialog = await openPicker(page);
  await expect(dialog.locator('.dlg-provider-badge')).toHaveCount(1);
  await expect(
    dialog.locator('.dlg-provider-preset', { hasText: 'GitHub Copilot' }).locator('.dlg-provider-badge'),
  ).toHaveCount(1);
  // #385:openai-codex 族表未接线——徽标摘除,行禁用 + 「暂未开通」注记
  const codex = dialog.locator('.dlg-provider-preset', { hasText: 'OpenAI Codex' });
  await expect(codex.locator('.dlg-provider-badge')).toHaveCount(0);
  await expect(codex).toBeDisabled();
  await expect(codex.locator('.dlg-provider-note')).toHaveText('暂未开通');
  const xai = dialog.locator('.dlg-provider-preset', { hasText: 'xAI' });
  await expect(xai).toHaveCount(1);
  await expect(xai.locator('.dlg-provider-badge')).toHaveCount(0);
  // xai oauthLabel 的展示位 = 其密钥表单,picker 面不出现
  await expect(dialog.getByText('SuperGrok')).toHaveCount(0);
});

test('自定义端点 opens the existing form (fields and defaults unchanged); 返回 walks back', async ({
  page,
}) => {
  const dialog = await openPicker(page);
  await dialog.locator('.dlg-provider-custom').click();
  await expect(dialog.locator('#dlg-provider-id')).toHaveValue('');
  await expect(dialog.locator('#dlg-provider-label')).toBeVisible();
  await expect(dialog.locator('#dlg-provider-baseurl')).toBeVisible();
  await expect(dialog.locator('#dlg-provider-apikey')).toBeVisible();
  // r3 §2 defaults: OpenAI Completions protocol active, Bearer checkbox on
  await expect(
    dialog.locator('.dlg-provider-seg-tab', { hasText: 'OpenAI Completions' }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(dialog.locator('#dlg-provider-authheader')).toBeChecked();
  await expect(dialog.locator('.dlg-provider-create')).toBeDisabled();
  // 返回列表
  await dialog.locator('.dlg-provider-back').click();
  await expect(dialog.locator('.dlg-provider-preset')).toHaveCount(38);
  await expect(dialog.locator('#dlg-provider-id')).toHaveCount(0);
});

test('api_key row enters its preset key form prefilled; xai form shows the oauthLabel', async ({
  page,
}) => {
  const dialog = await openPicker(page);
  await dialog.locator('.dlg-provider-preset', { hasText: 'DeepSeek' }).click();
  await expect(dialog.locator('#dlg-provider-id')).toHaveValue('deepseek');
  await expect(dialog.locator('#dlg-provider-label')).toHaveValue('DeepSeek');
  // 目录未采 baseUrl——留空由用户填,不发明
  await expect(dialog.locator('#dlg-provider-baseurl')).toHaveValue('');
  // 换 preset 进入 = 干净表单(不带上一 preset 的残值)
  await dialog.locator('.dlg-provider-back').click();
  await dialog.locator('.dlg-provider-preset', { hasText: 'xAI' }).click();
  await expect(dialog.locator('#dlg-provider-id')).toHaveValue('xai');
  await expect(dialog.locator('#dlg-provider-label')).toHaveValue('xAI');
  await expect(dialog.getByText('Sign in with SuperGrok or X Premium')).toBeVisible();
});

test('family law: X, Escape and backdrop dismiss; panel clicks do not', async ({ page }) => {
  let dialog = await openPicker(page);
  await dialog.locator('.dlg-close').click();
  await expect(page.locator('.dlg')).toBeHidden();

  dialog = await openPicker(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.dlg')).toBeHidden();

  dialog = await openPicker(page);
  await dialog.locator('.dlg-title').click();
  await expect(page.locator('.dlg')).toBeVisible();
  await page.mouse.click(20, 20);
  await expect(page.locator('.dlg')).toBeHidden();
});

test('providerId/label/baseUrl gate the submit; protocol segment swaps', async ({ page }) => {
  const dialog = await openCustomForm(page);
  const submit = dialog.locator('.dlg-provider-create');
  await expect(submit).toBeDisabled();
  await dialog.locator('#dlg-provider-id').fill('relay-355');
  await expect(submit).toBeDisabled();
  await dialog.locator('#dlg-provider-label').fill('R 355 网关');
  await expect(submit).toBeDisabled();
  await dialog.locator('#dlg-provider-baseurl').fill('https://relay-355.example.com/v1');
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

test('fixture submit closes the dialog (accept 律) and reopens a clean picker', async ({
  page,
}) => {
  const dialog = await openCustomForm(page);
  await dialog.locator('#dlg-provider-id').fill('relay-355');
  await dialog.locator('#dlg-provider-label').fill('R 355 网关');
  await dialog.locator('#dlg-provider-baseurl').fill('https://relay-355.example.com/v1');
  await dialog.locator('.dlg-provider-create').click();
  await expect(page.locator('.dlg')).toBeHidden();
  // reopen: picker 面全量列表 + 空搜索;表单字段随 open→false 边全重置
  const again = await openPicker(page);
  await expect(again.locator('.dlg-provider-preset')).toHaveCount(38);
  await expect(again.locator('.dlg-provider-search')).toHaveValue('');
  await again.locator('.dlg-provider-custom').click();
  await expect(again.locator('#dlg-provider-id')).toHaveValue('');
  await expect(again.locator('#dlg-provider-label')).toHaveValue('');
  await expect(again.locator('#dlg-provider-baseurl')).toHaveValue('');
  await expect(again.locator('#dlg-provider-apikey')).toHaveValue('');
  await expect(again.locator('.dlg-provider-create')).toBeDisabled();
});

test('model rows keep the submit reachable (dialog body scrolls)', async ({ page }) => {
  const dialog = await openCustomForm(page);
  await dialog.locator('#dlg-provider-id').fill('relay-355');
  await dialog.locator('#dlg-provider-label').fill('R 355 网关');
  await dialog.locator('#dlg-provider-baseurl').fill('https://relay-355.example.com/v1');
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
