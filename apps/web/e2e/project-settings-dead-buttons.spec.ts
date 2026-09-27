import { expect, test } from '@playwright/test';

// Issue #177 acceptance(local-first 裁决,endpoint 实测)的存续一部——
// #207 删除区复活(#189 DELETE /api/projects/:id 落地)后,原第 1 例
// 「危险操作卡整除」作废,复活面验收归 project-settings-delete.spec.ts;
// 原第 2 例「更换留 wontfix 占位 chrome」被 #307 改判移除(spec 08 档 4
// 二分律:静态资产无上传面;account-swap 同款归档 3 不在票内),
// 断言移驻 dead-buttons.spec.ts。
// 余下一例钉 #177 存续裁决:
// 1. 目标分支静态化(#149 分支 chip 同律): span 非 button,chevron 保
//    r2 24c 捕获形状——非交互元素,不再是死钮。

const SETTINGS = '/app/project/ZAQczKCu0MOAzC1ZqcFlX/settings?scenario=r2-24c';

test('settings: target branch is a static chip, not a button', async ({ page }) => {
  await page.goto(SETTINGS);
  const chip = page.locator('span.prj-set-branch');
  await expect(chip).toBeVisible();
  await expect(chip).toHaveText(/main/);
  // chevron 保 r2 24c 捕获形状
  await expect(chip.locator('svg')).toHaveCount(1);
  await expect(page.locator('button.prj-set-branch')).toHaveCount(0);
});
