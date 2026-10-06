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
  // #949 载体：popover = role dialog + 可及名；编辑分配 = role button + 文案
  const popover = page.getByRole('dialog', { name: '任务分配' });
  await expect(popover).toBeVisible();
  await popover.getByRole('button', { name: '编辑分配' }).click();
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  await expect(popover).toBeHidden();
  return dialog;
}

test('编辑分配 opens the agent pick dialog with search + bound row checked', async ({ page }) => {
  const dialog = await openAssignDialog(page);
  await expect(dialog.locator('.dlg-title')).toHaveText('选择执行 Agent');
  // #950: .chief-pick-input → getByPlaceholder（placeholder 语义由 locator 承载）；
  // .chief-pick-row/-name → role=option + option 内文本。
  await expect(dialog.getByPlaceholder('搜索 Agent…')).toBeVisible();
  await expect(dialog.getByRole('option')).toHaveCount(1);
  await expect(dialog.getByRole('option').getByText('r3-builder')).toHaveText('r3-builder');
  // 当前绑定行 = probe todo 的 r3-builder:选中态钉 aria-selected
  // （#950:.chief-pick-check ✓ 图形不再单独钉，态载体归行的 aria-selected）。
  await expect(dialog.getByRole('option')).toHaveAttribute('aria-selected', 'true');
});

test('fixture pick closes the dialog (accept 律); popover row echo unchanged', async ({ page }) => {
  const dialog = await openAssignDialog(page);
  await dialog.getByRole('option').click();
  await expect(page.locator('.dlg')).toBeHidden();
  // 回显基线:重开 popover,执行对话行仍是绑定 agent(fixture 不写数据)
  await page.locator('.detail-chip').click();
  const popover = page.getByRole('dialog', { name: '任务分配' });
  await expect(popover).toBeVisible();
  // 选中 section 的状态载体 = data-selected（#910 裁定 3，.chip-popover-section--selected 类钉退役）
  await expect(popover.locator('[data-selected]')).toContainText('r3-builder');
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
  // #950: .chief-pick-input → getByPlaceholder;.chief-pick-row → role=option;
  // .chief-pick-empty → getByText(空态文案)。
  await dialog.getByPlaceholder('搜索 Agent…').fill('不存在');
  await expect(dialog.getByRole('option')).toHaveCount(0);
  await expect(dialog.getByText('没有匹配的 Agent')).toHaveText('没有匹配的 Agent');
  await dialog.getByPlaceholder('搜索 Agent…').fill('r3');
  await expect(dialog.getByRole('option')).toHaveCount(1);
});
