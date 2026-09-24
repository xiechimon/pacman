import { expect, test } from '@playwright/test';

// Issue #182 acceptance: chief 设置面三死钮接线(#180 裁决落账)。
// 1. agent 行 → 选择总管 Agent dialog(DialogShell 家族律):搜索框 + Agent
//    列(fixture 面 canon 单默认行 r3-builder);fixture 选定 = accept 律
//    关窗。换绑二次确认(live-only 路径,fixture 恒未绑定)归 live 真机验。
// 2. 章程编辑 → DialogShell 编辑弹窗:textarea 占位 r5 102/110 canon +
//    取消/保存章程;fixture 保存 = accept 律关窗。
// 3. 压缩模型静态化(#177 目标分支同律):PATCH chief schema 实测仅
//    agent/charter 两槽(无模型槽),span 非 button,点击不开任何弹层。

const AGENT_TAB = '/app?scenario=101';
const CHARTER_TAB = '/app?scenario=102';

async function openAgentDialog(page: import('@playwright/test').Page) {
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

async function openCharterDialog(page: import('@playwright/test').Page) {
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

test('压缩模型 static-ified: span not button, click opens nothing', async ({ page }) => {
  await page.goto(AGENT_TAB);
  const select = page.locator('span.chief-select');
  await expect(select).toBeVisible();
  await expect(select).toContainText('默认（与 Chief 相同）');
  await expect(page.locator('button.chief-select')).toHaveCount(0);
  await select.click();
  await expect(page.locator('[role="dialog"], .new-task-project-menu')).toHaveCount(0);
});
