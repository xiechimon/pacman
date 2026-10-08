import { expect, test } from '@playwright/test';

// Issue #75 AC3: the reject interaction chain (请求修改 → v2 → diff →
// 确认) walks end to end on the fixture script (`?scenario=chain`): the
// composer send opens the replan round (r8 67), the new plan version
// lands (r8 68), the version dropdown / compare submenu open the
// plan-version diff (r8 63–65), and the header 确认 starts the next round.
//
// #951/#910 重钉：.detail-chip → phase-chip testid（断言目标即触发钮文案，
// 按 name 定位即循环——#910 裁定 1 二级载体）。其余跨批次类载体
// （.doc-pane-select/.composer-send/.chat-*/.version-*/.doc-*/.diff-*/
// .detail-head-action）是 #945/#949 退役后的零规则别名钩，其终账归
// #952/#953，本 spec 原样保留。
test('reject loop: 请求修改 → v2 → diff → 确认', async ({ page }) => {
  await page.goto('/app/todo/r8-15?scenario=chain');

  // confirm v1 surface
  await expect(page.getByTestId('phase-chip')).toHaveText(/确认/);
  await expect(page.locator('.doc-pane-select').nth(1)).toHaveText(/v1/);

  // 请求修改 → replan streaming (r8 67). Real click: #347 让总管 FAB 在
  // composer 在场时上移，发送钮不再被遮挡——这条 click 即该修复的回归钉
  // （遮挡回归时这里会超时）。
  await page.locator('.composer-send').click();
  await expect(page.getByTestId('phase-chip')).toHaveText(/规划中/);
  await expect(page.locator('.chat-streaming-label')).toHaveText('处理中...');

  // v2 lands (r8 68)
  await expect(page.getByTestId('phase-chip')).toHaveText(/确认/, { timeout: 5000 });
  await expect(page.locator('.chat-plan-title').last()).toHaveText('方案 · v2');

  // version dropdown (r8 63)
  await page.locator('.doc-range-wrap .doc-pane-select').click();
  await expect(page.locator('.version-menu-row')).toHaveCount(3);
  await expect(page.locator('.version-menu-row').first()).toHaveText(/v2 · 刚刚/);

  // compare submenu (r8 64) → diff view (r8 65)
  // #1006 载体迁移（#986 C 层：断言语义不动）：版本菜单从手搓 Button 行迁
  // registry DropdownMenu 原语，行载体 button → menuitem（#910 裁定 1 一级）。
  await page.getByRole('menuitem', { name: '与其他版本对比…' }).click();
  await expect(page.locator('.version-menu--sub')).toHaveText('上一版本');
  await page.getByRole('menuitem', { name: '上一版本' }).click();
  await expect(page.locator('.doc-range-chip')).toHaveText(/v1 → v2/);
  await expect(page.locator('.doc-file-row')).toHaveText(/plan\.md/);

  // expand the unified hunks (r8 66)
  await page.getByRole('button', { name: '全部展开' }).click();
  await expect(page.locator('.diff-hunk-head').first()).toHaveText('@@ -1,9 +1,10 @@');
  await expect(page.locator('.diff-line--add').first()).toBeVisible();

  // 确认 closes the chain into the execution round
  await page.locator('.detail-head-action').click();
  await expect(page.getByTestId('phase-chip')).toHaveText(/执行中/);
  await expect(page.locator('.chat-streaming-label').last()).toHaveText('处理中...');
});
