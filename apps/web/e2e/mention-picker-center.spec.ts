import { expect, test } from '@playwright/test';

// #448:提及面板在构建产物里必须横向居中。缺陷机理 = 居中位移曾写在
// transform 上(left:50% + translateX(-50%)),而共用动画类 .anim-pop
// 静态声明 transform:none——两条规则同 specificity(0,1,0),dev 与
// build 的 CSS 打包顺序不同,产物里 motion.css 靠后覆盖掉居中位移,
// 面板左缘落到 720(left:50% 裸值)而非 520。
// 本 spec 只跑 fixture build 产物面(playwright webServer 自带
// build --mode fixture + preview),dev 态永远照不出这个缺陷。
// 钉死两条:终态 computed transform 不承载位移(=none,居中不借
// transform,动画层独占该属性);几何 x = (视口宽 - 面板宽)/2。
test('mention picker stays centered in the production bundle (#448)', async ({ page }) => {
  await page.goto('/app/todo/r8-15?scenario=chain');
  await page.locator('.composer-toolbar button[aria-label="提及"]').click();
  const panel = page.locator('.mention-picker');
  await expect(panel).toBeVisible();
  await page.waitForTimeout(300); // past the 150ms overlay-pop enter animation
  await expect(panel).toHaveCSS('transform', 'none');
  const rect = await panel.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, width: r.width };
  });
  expect(rect.width).toBe(400);
  // 1440 视口:居中 → 左缘 520;缺陷面实测 720(left:50% 裸值)
  expect(Math.abs(rect.x - (1440 - rect.width) / 2)).toBeLessThanOrEqual(1);
});
