import { expect, type Page, test } from '@playwright/test';

// #758: the new-task dialog's machine chip was pure component state — every
// open (and every reload) dropped the pin back to 自动, while the sibling
// project chip has remembered its pick since XMON-87. The chip now stores the
// pin in localStorage (key = NEW_TASK_MACHINE_STORAGE_KEY in
// overlay/new-task-dialog.tsx, mirrored below). Scope: every face of the
// dialog — unlike rememberProject there is no anchored-face exception (the
// execution pick has no per-route default to protect).
// Each test pins one failure mode:
// 1. pick a machine, reload → chip and check still on it
// 2. remembered id no longer in the machine set → 自动 (display and submit
//    resolve through machinePin — no dangling pin), storage left intact
// 3. remembered machine offline → kept, chip shows its name with the offline
//    dot (no silent reassignment, #687 pin = wait-for-online semantics)
// 4. picking 自动 clears the memory → reload stays on 自动
// 5. nothing stored → 自动 (the pre-fix default, unchanged)

const STORAGE_KEY = 'pacman.newTaskMachineId'; // mirrored: new-task-dialog.tsx
// scenario=newtask-machines: boardDefault + two machines (fixtures.ts
// boardMachinePicker) — the canon local one online, 'mea-wsl' offline.
const BOARD = '/app?scenario=newtask-machines';
const MACHINE = 'xmonsMac-3574.local';
const MACHINE_ID = 'TlZ2sSD4EJCxjNJqVhdo_'; // mirrored: fixtures.ts
const OFFLINE = 'mea-wsl';
const OFFLINE_ID = 'mea-wsl-offline'; // mirrored: fixtures.ts

/** Seed the memory before any navigation (and keep it across reloads). */
function seedStoredMachine(page: Page, machineId: string) {
  return page.addInitScript(
    ([key, id]) => window.localStorage.setItem(key, id),
    [STORAGE_KEY, machineId],
  );
}

async function openDialog(page: Page) {
  await page.locator('.sidebar-new-task').click();
  const dialog = page.locator('.new-task-dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

function machineChip(dialog: ReturnType<Page['locator']>) {
  return dialog.locator('[data-testid="new-task-machine-chip"]');
}

async function pick(page: Page, dialog: ReturnType<Page['locator']>, name: string) {
  await machineChip(dialog).click();
  await dialog
    .locator('[role="listbox"][aria-label="机器"]')
    .getByRole('option', { name })
    .click();
  await expect(machineChip(dialog)).toHaveText(name);
}

test('the picked machine survives a reload', async ({ page }) => {
  await page.goto(BOARD);
  const dialog = await openDialog(page);
  await pick(page, dialog, MACHINE);
  // 选即写（项目 chip 同时机）。
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(MACHINE_ID);

  await page.reload();
  const reopened = await openDialog(page);
  await expect(machineChip(reopened)).toHaveText(MACHINE);
  await machineChip(reopened).click();
  await expect(
    reopened.locator('[role="listbox"][aria-label="机器"]').getByRole('option', { name: MACHINE }),
  ).toHaveAttribute('aria-selected', 'true');
});

test('a remembered machine that is gone falls back to 自动 without a dangling pin', async ({
  page,
}) => {
  await seedStoredMachine(page, 'ghost-machine');
  await page.goto(BOARD);
  const dialog = await openDialog(page);
  await expect(machineChip(dialog)).toHaveText(/自动/);
  await machineChip(dialog).click();
  const menu = dialog.locator('[role="listbox"][aria-label="机器"]');
  // 显示面与提交面同吃 machinePin 解析值：悬空 id 落回自动行选中态。
  await expect(menu.getByRole('option', { name: '自动' })).toHaveAttribute('aria-selected', 'true');
  // 记忆位留着不动（行集可能只是还没加载，按缺省清记忆会误伤真值——项目
  // 记忆位同律）。
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(
    'ghost-machine',
  );
  // 不是白屏：看板本体照常渲染
  await expect(page.locator('.board-column').first()).toBeVisible();
});

test('a remembered offline machine is kept and honestly shown offline', async ({ page }) => {
  await seedStoredMachine(page, OFFLINE_ID);
  await page.goto(BOARD);
  const dialog = await openDialog(page);
  // 不静默改派：chip 显机器名（非自动），离线态如实落在 dot 上。
  await expect(machineChip(dialog)).toHaveText(OFFLINE);
  await expect(machineChip(dialog).locator('.new-task-machine-dot')).toHaveAttribute(
    'data-on',
    'false',
  );
  await machineChip(dialog).click();
  await expect(
    dialog.locator('[role="listbox"][aria-label="机器"]').getByRole('option', { name: OFFLINE }),
  ).toHaveAttribute('aria-selected', 'true');
});

test('picking 自动 clears the memory and a reload stays on 自动', async ({ page }) => {
  // 一次性种子（evaluate 而非 addInitScript——后者每次导航重放，会把测试
  // 中途清掉的记忆位又种回来，reload 断言永真）。
  await page.goto(BOARD);
  await page.evaluate(
    ([key, id]) => window.localStorage.setItem(key, id),
    [STORAGE_KEY, MACHINE_ID],
  );
  await page.reload();
  const dialog = await openDialog(page);
  await expect(machineChip(dialog)).toHaveText(MACHINE);
  await pick(page, dialog, '自动');
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBeNull();

  await page.reload();
  const reopened = await openDialog(page);
  await expect(machineChip(reopened)).toHaveText(/自动/);
});

test('with nothing stored the chip starts on 自动', async ({ page }) => {
  await page.goto(BOARD);
  const dialog = await openDialog(page);
  await expect(machineChip(dialog)).toHaveText(/自动/);
});
