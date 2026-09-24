import { expect, test } from '@playwright/test';

// Issue #168: rerun dialog / reuse panel 的关闭三路径。#75 自建的
// Overlay/PanelHead 游离在 #68 DialogShell 家族律（Esc + backdrop click +
// X）外——fixture 模式下「开始任务」开出后无任何关闭路径。每条断言钉
// 一种失败方式；fixture 初始态即开 overlay（scenario 56/75），每个 test
// 独立 goto 取初始开态。
// 1. X 钮点关（56 无 plan 形 / 75 reuse 形）
// 2. Esc 关（同两形）
// 3. backdrop 点击关——仅 backdrop 自身命中，面板内点击冒泡不关
// 4. reuse back 钮回 rerun 形（既有行为防回归）

const RERUN = '/app/todo/r8-12?scenario=56';
const REUSE = '/app/todo/r8-15?scenario=75';

for (const [name, route] of [
  ['rerun dialog (scenario 56)', RERUN],
  ['reuse panel (scenario 75)', REUSE],
] as const) {
  test(`X button closes the ${name}`, async ({ page }) => {
    await page.goto(route);
    const overlay = page.locator('.overlay');
    await expect(overlay).toBeVisible();
    await page.locator('.overlay-close').click();
    await expect(overlay).toBeHidden();
  });

  test(`Escape closes the ${name}`, async ({ page }) => {
    await page.goto(route);
    const overlay = page.locator('.overlay');
    await expect(overlay).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(overlay).toBeHidden();
  });

  test(`backdrop click closes the ${name}; panel clicks do not`, async ({ page }) => {
    await page.goto(route);
    const overlay = page.locator('.overlay');
    await expect(overlay).toBeVisible();
    // 面板内命中（head 标题区）冒泡到 panel，不关
    await page.locator('.overlay-title').click();
    await expect(overlay).toBeVisible();
    // backdrop 自身命中（面板外，左上角）才关
    await page.mouse.click(20, 20);
    await expect(overlay).toBeHidden();
  });
}

test('reuse panel back button returns to the rerun dialog', async ({ page }) => {
  await page.goto(REUSE);
  await expect(page.locator('.overlay-title')).toHaveText('复用方案');
  await page.locator('.overlay-back').click();
  // 回到 rerun 形：标题换面、弹层仍在
  await expect(page.locator('.overlay-title')).toHaveText('开始任务');
  await expect(page.locator('.overlay')).toBeVisible();
});
