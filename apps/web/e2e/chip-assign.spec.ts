import { expect, type Page, test } from '@playwright/test';

// Issue #209 acceptance: chip-popover「编辑分配」接线(#208 assignment 槽前置,
// #182 选择 dialog 家族形态复用)。
// 1. 开 — popover「编辑分配」→ agent 选择弹层:DialogShell 家族 + 搜索框 +
//    canon 默认行(r3-builder);当前绑定行带 aria-selected + ✓;popover 关、
//    弹层开(两 overlay 不叠)。
// 2. 选/确认 — fixture 面 accept 律(#148:选择即关,弹层关)。live 换绑二次
//    确认(取消/更换)+ PATCH assignment.build 槽 + 真回显归 live 真机验
//    (#182 同款切分:fixture 不改数据)。
// 3. 回显 — 弹层关后重开 popover,执行对话行仍显示绑定 agent(状态一致性;
//    fixture accept 律不写数据,行不变即回显基线)。
// 4. 取消 — X / Esc / backdrop 家族律关窗(DialogShell);panel 点击不关。

// scenario=19:detail confirm 面 + chip popover 冻结开态(r7 19 捕获位),
// probe todo 绑定 r3-builder。
const ROUTE = '/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=19';

async function openAssignDialog(page: Page) {
  await page.goto(ROUTE);
  const popover = page.locator('.chip-popover');
  await expect(popover).toBeVisible();
  await popover.locator('.chip-popover-edit').click();
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  await expect(popover).toBeHidden();
  return dialog;
}

test('编辑分配 opens the agent pick dialog with search + bound row checked', async ({ page }) => {
  const dialog = await openAssignDialog(page);
  await expect(dialog.locator('.dlg-title')).toHaveText('选择执行 Agent');
  await expect(dialog.locator('.chief-pick-input')).toHaveAttribute('placeholder', '搜索 Agent…');
  await expect(dialog.locator('.chief-pick-row')).toHaveCount(1);
  await expect(dialog.locator('.chief-pick-name')).toHaveText('r3-builder');
  // 当前绑定行 = probe todo 的 r3-builder:aria-selected + ✓
  await expect(dialog.locator('.chief-pick-row')).toHaveAttribute('aria-selected', 'true');
  await expect(dialog.locator('.chief-pick-check')).toBeVisible();
});

test('fixture pick closes the dialog (accept 律); popover row echo unchanged', async ({ page }) => {
  const dialog = await openAssignDialog(page);
  await dialog.locator('.chief-pick-row').click();
  await expect(page.locator('.dlg')).toBeHidden();
  // 回显基线:重开 popover,执行对话行仍是绑定 agent(fixture 不写数据)
  await page.locator('.detail-chip').click();
  const popover = page.locator('.chip-popover');
  await expect(popover).toBeVisible();
  await expect(popover.locator('.chip-popover-section--selected')).toContainText('r3-builder');
});

test('assign dialog family law: X, Escape and backdrop dismiss; panel clicks do not', async ({
  page,
}) => {
  let dialog = await openAssignDialog(page);
  await dialog.locator('.dlg-close').click();
  await expect(page.locator('.dlg')).toBeHidden();

  dialog = await openAssignDialog(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.dlg')).toBeHidden();

  dialog = await openAssignDialog(page);
  await dialog.locator('.dlg-title').click();
  await expect(page.locator('.dlg')).toBeVisible();
  await page.mouse.click(20, 20);
  await expect(page.locator('.dlg')).toBeHidden();
});

test('assign dialog search filters the list; no match shows the empty row', async ({ page }) => {
  const dialog = await openAssignDialog(page);
  await dialog.locator('.chief-pick-input').fill('不存在');
  await expect(dialog.locator('.chief-pick-row')).toHaveCount(0);
  await expect(dialog.locator('.chief-pick-empty')).toHaveText('没有匹配的 Agent');
  await dialog.locator('.chief-pick-input').fill('r3');
  await expect(dialog.locator('.chief-pick-row')).toHaveCount(1);
});
