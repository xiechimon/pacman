import { expect, type Page, test } from '@playwright/test';

// Issue #182 acceptance: chief 设置面三死钮接线(#180 裁决落账)。
// 1. agent 行 → 选择总管 Agent dialog(DialogShell 家族律):搜索框 + Agent
//    列(fixture 面 canon 单默认行 r3-builder);fixture 选定 = accept 律
//    关窗。换绑二次确认(live-only 路径,fixture 恒未绑定)归 live 真机验。
// 2. 章程编辑 → DialogShell 编辑弹窗:textarea 占位 r5 102/110 canon +
//    取消/保存章程;fixture 保存 = accept 律关窗。
// 3. 压缩模型 #204 翻回交互(server #203 compactionModel 槽就位):button
//    开 anchored popover(OverlayMount + ClickCatcher + Esc 家族律),
//    fixture 面清单 = 默认行 + canon 单行(r3-gw/claude-sonnet-5),选定 =
//    accept 律关面。live PATCH 写读回归归 live 真机验。

const AGENT_TAB = '/app?scenario=101';
const CHARTER_TAB = '/app?scenario=102';

async function openAgentDialog(page: Page) {
  await page.goto(AGENT_TAB);
  await page.locator('.chief-agent-row').click();
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  return dialog;
}

test('agent row opens the 选择总管 Agent dialog with search + canon default row', async ({
  page,
}) => {
  const dialog = await openAgentDialog(page);
  await expect(dialog.locator('.dlg-title')).toHaveText('选择总管 Agent');
  await expect(dialog.locator('.chief-pick-input')).toHaveAttribute('placeholder', '搜索 Agent…');
  await expect(dialog.locator('.chief-pick-row')).toHaveCount(1);
  await expect(dialog.locator('.chief-pick-name')).toHaveText('r3-builder');
});

test('agent dialog family law: X, Escape and backdrop dismiss; panel clicks do not', async ({
  page,
}) => {
  let dialog = await openAgentDialog(page);
  await dialog.locator('.dlg-close').click();
  await expect(page.locator('.dlg')).toBeHidden();

  dialog = await openAgentDialog(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.dlg')).toBeHidden();

  dialog = await openAgentDialog(page);
  await dialog.locator('.dlg-title').click();
  await expect(page.locator('.dlg')).toBeVisible();
  await page.mouse.click(20, 20);
  await expect(page.locator('.dlg')).toBeHidden();
});

test('agent dialog search filters the list; no match shows the empty row', async ({ page }) => {
  const dialog = await openAgentDialog(page);
  await dialog.locator('.chief-pick-input').fill('不存在');
  await expect(dialog.locator('.chief-pick-row')).toHaveCount(0);
  await expect(dialog.locator('.chief-pick-empty')).toHaveText('没有匹配的 Agent');
  await dialog.locator('.chief-pick-input').fill('r3');
  await expect(dialog.locator('.chief-pick-row')).toHaveCount(1);
});

test('fixture agent pick closes the dialog (accept 律)', async ({ page }) => {
  const dialog = await openAgentDialog(page);
  await dialog.locator('.chief-pick-row').click();
  await expect(page.locator('.dlg')).toBeHidden();
});

async function openCharterDialog(page: Page) {
  await page.goto(CHARTER_TAB);
  await page.locator('.chief-edit-btn').click();
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  return dialog;
}

test('charter 编辑 opens the DialogShell editor with the r5 captured fields', async ({ page }) => {
  const dialog = await openCharterDialog(page);
  await expect(dialog.locator('.dlg-title')).toHaveText('编辑章程');
  await expect(dialog.locator('.chief-dlg-charter-input')).toHaveAttribute(
    'placeholder',
    '长期指令：模型路由规则（何种任务使用何种模型）、优先级、偏好…',
  );
  await expect(dialog.locator('.chief-dlg-ghost')).toHaveText('取消');
  await expect(dialog.locator('.chief-dlg-primary')).toHaveText('保存章程');
});

test('charter dialog family law: X, Escape, 取消 and backdrop dismiss', async ({ page }) => {
  let dialog = await openCharterDialog(page);
  await dialog.locator('.dlg-close').click();
  await expect(page.locator('.dlg')).toBeHidden();

  dialog = await openCharterDialog(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.dlg')).toBeHidden();

  dialog = await openCharterDialog(page);
  await dialog.locator('.chief-dlg-ghost').click();
  await expect(page.locator('.dlg')).toBeHidden();

  dialog = await openCharterDialog(page);
  await dialog.locator('.dlg-title').click();
  await expect(page.locator('.dlg')).toBeVisible();
  await page.mouse.click(20, 20);
  await expect(page.locator('.dlg')).toBeHidden();
});

test('fixture charter save closes the dialog (accept 律)', async ({ page }) => {
  const dialog = await openCharterDialog(page);
  await dialog.locator('.chief-dlg-charter-input').fill('优先派给 r3-builder。');
  await dialog.locator('.chief-dlg-primary').click();
  await expect(page.locator('.dlg')).toBeHidden();
});

async function openModelMenu(page: Page) {
  await page.goto(AGENT_TAB);
  const select = page.locator('button.chief-select');
  await expect(select).toBeVisible();
  await expect(select).toContainText('默认（与 Chief 相同）');
  await select.click();
  const menu = page.locator('.chief-model-menu');
  await expect(menu).toBeVisible();
  return { select, menu };
}

test('压缩模型 interactive (#204): button opens the anchored model menu', async ({ page }) => {
  const { menu } = await openModelMenu(page);
  // span 静态化已翻回(button 才是选择器);清单 = 默认行 + fixture canon 单行。
  await expect(page.locator('span.chief-select')).toHaveCount(0);
  await expect(menu).toHaveAttribute('role', 'listbox');
  await expect(menu.locator('.chief-model-row')).toHaveCount(2);
  await expect(menu.locator('.chief-model-row').nth(0)).toContainText('默认（与 Chief 相同）');
  await expect(menu.locator('.chief-model-row').nth(0)).toHaveAttribute('aria-selected', 'true');
  await expect(menu.locator('.chief-model-row').nth(1)).toContainText('claude-sonnet-5');
  await expect(menu.locator('.chief-model-row-provider')).toHaveText('r3-gw');
});

test('压缩模型 menu family law (#204): Escape and outside click dismiss', async ({ page }) => {
  let menu = (await openModelMenu(page)).menu;
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();

  menu = (await openModelMenu(page)).menu;
  await page.mouse.click(20, 20);
  await expect(menu).toBeHidden();
});

test('压缩模型 fixture pick = accept 律:选择即关 (#204)', async ({ page }) => {
  const { select, menu } = await openModelMenu(page);
  await menu.locator('.chief-model-row').nth(1).click();
  await expect(page.locator('.chief-model-menu')).toBeHidden();
  // fixture 面无 mutation:select 回显保持 canon 默认文案。
  await expect(select).toContainText('默认（与 Chief 相同）');
});
