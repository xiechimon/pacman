import { expect, test } from '@playwright/test';

// Issue #828: 卡片分支钮顶着下载 glyph（误导）+ 无分支的卡应隐藏。
// fixture 面的可见性谓词与弹层可开性是同一函数（overlayContent 有无），
// live 面走 latestBuildId 有无——可见即点得开。分支 glyph 用 circle
// 计数钉形（git-branch = 1 path + 2 circle，旧下载箭头零 circle）。

test('有分支卡：分支钮可见且为分支 glyph，点开分支与 PR 弹层', async ({ page }) => {
  await page.goto('/app?scenario=01');
  const buttons = page.locator('.todo-card-branch');
  await expect(buttons.first()).toBeVisible();
  await expect(buttons.first().locator('svg circle')).toHaveCount(2);
  await buttons.first().click();
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.dlg-branch-box')).toBeVisible();
});

test('无分支卡：分支钮不渲染', async ({ page }) => {
  // 22d = legacy pair + probe #9（有分支）+ #10 fresh（无分支）。
  await page.goto('/app?scenario=22d');
  await expect(page.locator('.todo-card-branch')).toHaveCount(3);
  const fresh = page.locator('[data-todo-id="r7-dark-fresh-probe-10"]');
  await expect(fresh.locator('.todo-card-branch')).toHaveCount(0);
});
