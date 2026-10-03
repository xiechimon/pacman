import { expect, type Page, test } from '@playwright/test';

// #682: the new-task dialog carries a machine chip (project-chip family) —
// the task-level dispatch pin. Each test pins one failure mode:
// 1. chip missing / default label not 自动 (structure regression)
// 2. popover rows missing the 自动 row or the machine row
// 3. selecting a machine does not backfill the chip label
// 4. Esc closes the popover only — the dialog itself stays (layer family law)
// 5. chip selection across close/reopen follows the #758 memory law (the
//    remembered pin returns; picking 自动 clears it — the old "always reset
//    to 自动" reset law predates the memory mechanism)
// 6. a machine-selected save still lands the fixture card (save path intact)

// scenario=06 carries the resources set (machines row) — the board canon
// scenario 01 has no resources block, so its machine rows are empty by design
// (fixture 律：board 面不带资源行集；机器 chip 的行源与提及面同 = resources）。
const BOARD = '/app?scenario=06';
const MACHINE = 'xmonsMac-3574.local';

async function openDialog(page: Page) {
  await page.goto(BOARD);
  await page.locator('.sidebar-new-task').click();
  const dialog = page.locator('.new-task-dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

function machineChip(dialog: ReturnType<Page['locator']>) {
  return dialog.locator('[data-testid="new-task-machine-chip"]');
}

test('the machine chip renders with the 自动 default label', async ({ page }) => {
  const dialog = await openDialog(page);
  await expect(machineChip(dialog)).toBeVisible();
  await expect(machineChip(dialog)).toHaveText(/自动/);
});

test('the popover lists the 自动 row and the scenario machine row', async ({ page }) => {
  const dialog = await openDialog(page);
  await machineChip(dialog).click();
  const menu = dialog.locator('[role="listbox"][aria-label="机器"]');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('option', { name: '自动' })).toBeVisible();
  await expect(menu.getByRole('option', { name: MACHINE })).toBeVisible();
});

test('selecting the machine row backfills the chip label', async ({ page }) => {
  const dialog = await openDialog(page);
  await machineChip(dialog).click();
  await dialog
    .locator('[role="listbox"][aria-label="机器"]')
    .getByRole('option', { name: MACHINE })
    .click();
  await expect(machineChip(dialog)).toHaveText(MACHINE);
  // 重开 popover：选中态标记落在机器行（自动行不带选中）。
  await machineChip(dialog).click();
  const menu = dialog.locator('[role="listbox"][aria-label="机器"]');
  await expect(menu.getByRole('option', { name: MACHINE })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(menu.getByRole('option', { name: '自动' })).toHaveAttribute(
    'aria-selected',
    'false',
  );
  // 自动行选回 = chip 复位。
  await menu.getByRole('option', { name: '自动' }).click();
  await expect(machineChip(dialog)).toHaveText(/自动/);
});

test('Esc closes the machine popover only — the dialog stays open', async ({ page }) => {
  const dialog = await openDialog(page);
  await machineChip(dialog).click();
  await expect(dialog.locator('[role="listbox"][aria-label="机器"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog.locator('[role="listbox"][aria-label="机器"]')).not.toBeVisible();
  await expect(dialog).toBeVisible();
});

test('chip selection survives close and reopen via memory, 自动 clears it (#758)', async ({
  page,
}) => {
  const dialog = await openDialog(page);
  await machineChip(dialog).click();
  await dialog
    .locator('[role="listbox"][aria-label="机器"]')
    .getByRole('option', { name: MACHINE })
    .click();
  await expect(machineChip(dialog)).toHaveText(MACHINE);
  // 净表单关闭（spec 空 = 无未保存闸）再开：重开净面 = 记忆面，chip 回
  // 上次钉的机器（#758；旧「恒回自动」的 reset 律已被记忆机制改掉）。
  await dialog.locator('.new-task-close').click();
  await expect(dialog).not.toBeVisible();
  await page.locator('.sidebar-new-task').click();
  const reopened = page.locator('.new-task-dialog');
  await expect(machineChip(reopened)).toHaveText(MACHINE);
  // 选「自动」清记忆位：再一轮关闭重开回自动。
  await machineChip(reopened).click();
  await reopened
    .locator('[role="listbox"][aria-label="机器"]')
    .getByRole('option', { name: '自动' })
    .click();
  await expect(machineChip(reopened)).toHaveText(/自动/);
  await reopened.locator('.new-task-close').click();
  await expect(reopened).not.toBeVisible();
  await page.locator('.sidebar-new-task').click();
  await expect(machineChip(page.locator('.new-task-dialog'))).toHaveText(/自动/);
});

test('a machine-selected save still lands the fixture card', async ({ page }) => {
  const dialog = await openDialog(page);
  await machineChip(dialog).click();
  await dialog
    .locator('[role="listbox"][aria-label="机器"]')
    .getByRole('option', { name: MACHINE })
    .click();
  await dialog.locator('.new-task-spec').fill('钉机器的探针任务');
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const card = page.locator('[data-column="todo"] .todo-card', { hasText: '钉机器的探针任务' });
  await expect(card).toBeVisible();
});
