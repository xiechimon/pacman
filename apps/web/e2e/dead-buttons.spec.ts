import { expect, test } from '@playwright/test';

// Issue #149: 零散死钮处置 + feedback 页整页移除。每条断言钉一个票面项的
// 失败方式：
// 1. feedback 整页移除 — 旧路由必须重定向 /app（catch-all 口径，01 §4.1）；
//    user-menu「反馈」行随页全除；「新功能/快捷键」行同律隐去（#163 修订：
//    无 local-first 对象面），余下 帐号/API 密钥/MCP 三行接真导航。
// 2. 看板指南钮 — 点击必须开真内容弹层（列语义 + 关口操作 + ⌘K），且入
//    anchored-overlay 家族律：Esc 关、外点关、面板持有自身命中（#133 法）。
// 3. project 页 — 「导出」钮不再渲染（wontfix：无导出后端面）；分支 chip
//    静态化（非 button，[设计] 注记在实现位）；文件|历史 分段真接线
//    （历史 = 提交历史行，fixture 数据源 = ProjectContent.commits）。
// 4. schedules 空态「查看文档」钮不再渲染（wontfix：local-first 无文档站）。
// 6. doc-pane 变更▾ — 接 #67 文档类型选族律：点击开 listbox（变更 ✓），
//    Esc 关；diff 模式同钮显示 方案▾ 同律。
// 第 5 项（skills 添加技能主钮）由 #153 覆盖，本 spec 不断言。

/** 面板中心点的命中必须由面板自身持有 — title-band-clicks 同款家族法。 */
async function expectOwnsCenter(page: import('@playwright/test').Page, selector: string) {
  const owned = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return top != null && top.closest(sel) != null;
  }, selector);
  expect(owned).toBe(true);
}

// —— 1. feedback 整页移除 ————————————————————————————————————————————————

test('feedback route is gone — old URL redirects to the board', async ({ page }) => {
  await page.goto('/app/feedback');
  await expect(page).toHaveURL('/app');
  await expect(page.locator('[data-route="feedback"]')).toHaveCount(0);
});

test('user menu drops its dead rows — 反馈 (#149), 新功能/快捷键 (#163)', async ({ page }) => {
  await page.goto('/app');
  await page.locator('.sidebar-user').click();
  const menu = page.locator('.user-menu');
  await expect(menu).toBeVisible();
  // 无 local-first 对象即隐去：反馈页已整页移除（#149）；新功能无 whats-new
  // 面、快捷键无快捷键面（#163 隐去裁定，理由随 PR）
  for (const dead of ['反馈', '新功能', '快捷键']) {
    await expect(menu).not.toContainText(dead);
  }
  // 活面齐全：外观分段 + 三条真导航行（#163 接真路由）
  for (const live of ['外观', '帐号', 'API 密钥', 'MCP']) {
    await expect(menu).toContainText(live);
  }
  await expect(menu.locator('a.user-menu-row')).toHaveCount(3);
});

// —— 2. 看板指南弹层 ——————————————————————————————————————————————————————

test('board guide button opens a real popover and closes per family law', async ({ page }) => {
  await page.goto('/app');
  const trigger = page.locator('.board-guide');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  const pop = page.locator('.board-guide-pop');
  await expect(pop).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  // 真内容三面：列语义（六列全名单源 COLUMNS）+ 关口操作 + ⌘K
  for (const column of ['待开始', '规划中', '待确认', '执行中', '待验收', '已完成']) {
    await expect(pop).toContainText(column);
  }
  await expect(pop).toContainText('关口操作');
  await expect(pop).toContainText('⌘K');
  await expectOwnsCenter(page, '.board-guide-pop');
  // Esc 关（#127 useEscapeClose 先例）
  await page.keyboard.press('Escape');
  await expect(pop).toBeHidden();
  // 外点关（ClickCatcher 家族律；raw mouse click = user-menu-trigger 同款，
  // catcher 全覆盖时 locator.click 的命中检查会误报拦截）
  await trigger.click();
  await expect(pop).toBeVisible();
  await page.mouse.click(700, 300);
  await expect(pop).toBeHidden();
});

// —— 3. project 页三件 ———————————————————————————————————————————————————

test('project files pane: no export button, static branch chip, wired 文件|历史 segment', async ({
  page,
}) => {
  await page.goto('/app/project/ZAQczKCu0MOAzC1ZqcFlX?scenario=r2-24');
  // 导出钮全除（wontfix 注记在实现位）
  await expect(page.locator('.prj-files-share')).toHaveCount(0);
  // 分支 chip 保留静态展示，但不再是可点击控件（[设计] 注记在实现位）
  const chip = page.locator('.prj-branch-chip');
  await expect(chip).toBeVisible();
  await expect(chip).toContainText('main');
  expect(await chip.evaluate((el) => el.tagName)).toBe('SPAN');
  // 文件|历史 分段接线：历史 → 提交行渲染、文件树让位；文件 → 还原
  const segTabs = page.locator('.prj-files-seg-tab');
  await expect(segTabs).toHaveCount(2);
  await segTabs.nth(1).click();
  await expect(segTabs.nth(1)).toHaveClass(/prj-files-seg-tab--active/);
  await expect(page.locator('.prj-history-row').first()).toBeVisible();
  await expect(page.locator('.prj-file-row')).toHaveCount(0);
  await segTabs.nth(0).click();
  await expect(segTabs.nth(0)).toHaveClass(/prj-files-seg-tab--active/);
  await expect(page.locator('.prj-file-row').first()).toBeVisible();
  await expect(page.locator('.prj-history-row')).toHaveCount(0);
});

// —— 4. schedules 空态 ————————————————————————————————————————————————————

test('schedules empty state drops the 查看文档 button, keeps 新建定时', async ({ page }) => {
  await page.goto('/app/schedules?scenario=11');
  await expect(page.locator('.sched-empty')).toBeVisible();
  await expect(page.locator('.sched-empty-docs')).toHaveCount(0);
  await expect(page.locator('.sched-empty-new')).toBeVisible();
});

// —— 6. doc-pane 变更▾ 型选 ———————————————————————————————————————————————

test('doc pane 变更▾ opens the document-type listbox and closes on Escape', async ({ page }) => {
  await page.goto('/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=27');
  const select = page.locator('.doc-select-wrap .doc-pane-select');
  await expect(select).toContainText('变更');
  await select.click();
  const dropdown = page.locator('.plan-dropdown');
  await expect(dropdown).toBeVisible();
  await expect(dropdown.locator('.plan-dropdown-row')).toContainText('变更');
  await page.keyboard.press('Escape');
  await expect(dropdown).toBeHidden();
});
