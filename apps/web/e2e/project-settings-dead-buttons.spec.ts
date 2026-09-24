import { expect, test } from '@playwright/test';

// Issue #177 acceptance(local-first 裁决,endpoint 实测): 设置页三死钮
// wontfix 出账——全栈无 project mutation 端点(无 PATCH/DELETE
// /api/projects/:id;schema 无 defaultBranch 列,live 读面硬编 main)。
// 1. 危险操作卡整除(#148 退出登录 box / #149 导出 同律): 票面前提
//    「DELETE 端点在」实测不在;label/卡/删除钮不再渲染,en.ts 三键随除。
// 2. 目标分支静态化(#149 分支 chip 同律): span 非 button,chevron 保
//    r2 24c 捕获形状——非交互元素,不再是死钮。
// 3. 更换(头像)留 wontfix 占位 chrome(#148 account-swap 同律):
//    静态资产无上传面,ink 保捕获形状;点击不改任何东西(无路由跳、
//    无弹层)。

const SETTINGS = '/app/project/ZAQczKCu0MOAzC1ZqcFlX/settings?scenario=r2-24c';

test('settings: danger zone removed — no label, no card, no delete button', async ({ page }) => {
  await page.goto(SETTINGS);
  await expect(page.locator('.prj-set-card').first()).toBeVisible();
  await expect(page.locator('.prj-set-danger-label')).toHaveCount(0);
  await expect(page.locator('.prj-set-card--danger')).toHaveCount(0);
  await expect(page.locator('.prj-set-delete')).toHaveCount(0);
});

test('settings: target branch is a static chip, not a button', async ({ page }) => {
  await page.goto(SETTINGS);
  const chip = page.locator('span.prj-set-branch');
  await expect(chip).toBeVisible();
  await expect(chip).toHaveText(/main/);
  // chevron 保 r2 24c 捕获形状
  await expect(chip.locator('svg')).toHaveCount(1);
  await expect(page.locator('button.prj-set-branch')).toHaveCount(0);
});

test('settings: 更换 stays as wontfix chrome — a click changes nothing', async ({ page }) => {
  await page.goto(SETTINGS);
  const change = page.locator('.prj-set-change');
  await expect(change).toHaveText('更换');
  await change.click();
  // 无路由跳、无弹层——占位 chrome 不接行为(#148 同律)
  await expect(page).toHaveURL(/\/settings/);
  await expect(
    page.locator('[role="dialog"], [role="alertdialog"], .overlay-backdrop'),
  ).toHaveCount(0);
});
