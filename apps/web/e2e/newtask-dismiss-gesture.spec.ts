import { expect, type Page, test } from '@playwright/test';

// #1060 回归：一次 dismiss 手势只关最上层（新建任务 dialog × 项目 popover）。
// 历史竞态（CI 偶发双关的根因）：Base UI 把 dismiss 监听、层栈树节点、Root
// 的 prop 同步全挂在被动 effect 上，而弹层 DOM 在 commit 即可见——popover
// 刚可见就落下的快速外点（合成输入/高负载）会掉进这扇接线窗：内层来不及自
// 收，dialog 误判自己是最上层，一次点击把两层一起关。修复 = 关闭意图汇流点
// （requestClose）的双闸：同步 ref（内层已接线自收的手势消费位）+ 内层开态
// 镜像（ref 穿透 Base UI 持有的旧世代闭包）。本 spec 用「手势循环重放」把
// 不变量钉成确定性断言——单发一次撞不进窄窗（历史红即单发偶现），循环才是
// 有效压力面；负对照钉「无内层时 dialog 自身关闸不被双闸误伤」。

const ROUTE = '/app?scenario=newtask-projects';

async function openDialogWithPopover(page: Page) {
  await page.goto(ROUTE);
  // #445：opener = 侧栏「新任务」行（顶栏「+ 任务」已撤除）。
  await page.locator('.sidebar-new-task').click();
  const dialog = page.getByRole('dialog', { name: '新建任务' });
  await expect(dialog).toBeVisible();
  await dialog.getByTestId('new-task-project-chip').click();
  const menu = page.getByRole('listbox', { name: '项目' });
  await expect(menu).toBeVisible();
  return { dialog, menu };
}

test('outside-press cycles: every gesture closes exactly the popover layer', async ({ page }) => {
  // 12 轮重放：修复前该窗口单轮命中率 ~22%（插桩实测 13/60），12 轮全绿
  // 对回归的捕获率 >99%；修复后每轮都是确定性行为。
  for (let cycle = 0; cycle < 12; cycle++) {
    const { dialog, menu } = await openDialogWithPopover(page);
    // popover 一可见立即外点背板——不等待，专打接线窗。
    await page.mouse.click(20, 20);
    await expect(menu).toBeHidden();
    await expect(dialog).toBeVisible();
  }
});

test('escape cycles: every gesture closes exactly the popover layer', async ({ page }) => {
  for (let cycle = 0; cycle < 6; cycle++) {
    const { dialog, menu } = await openDialogWithPopover(page);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(dialog).toBeVisible();
  }
});

test('negative control: with no inner layer open, backdrop click still closes the dialog', async ({
  page,
}) => {
  await page.goto(ROUTE);
  await page.locator('.sidebar-new-task').click();
  const dialog = page.getByRole('dialog', { name: '新建任务' });
  await expect(dialog).toBeVisible();
  await page.mouse.click(20, 20);
  await expect(dialog).toBeHidden();
});

test('negative control: with no inner layer open, Escape still closes the dialog', async ({
  page,
}) => {
  await page.goto(ROUTE);
  await page.locator('.sidebar-new-task').click();
  const dialog = page.getByRole('dialog', { name: '新建任务' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('negative control: second escape after the popover closed takes the dialog down', async ({
  page,
}) => {
  const { dialog, menu } = await openDialogWithPopover(page);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
