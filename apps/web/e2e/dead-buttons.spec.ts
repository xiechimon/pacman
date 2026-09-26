import { expect, type Page, test } from '@playwright/test';

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
// 7. machines 行内动作图标 — #222 出账（r8 §3.5 漂移注记）：原站在线机器行
//    右侧三行内动作图标，端点核实测 local-first 无机器管理面（注记在
//    machines-page.tsx 头部），不渲染死钮——行内零 button。
// 8. chief 抽屉「更多」（⋮）— #306 wontfix 出账：原站菜单内容未点开无正典
//    （r8-chief-panel-adhoc §3），server chief 面无线程管理 mutation——注记
//    在 chief-drawer.tsx 头部；线程视图头部回到四钮（与新线程视图同律）。
// 9. schedules 卡片「更多」— #306 接真：per-card 菜单（Esc/外点关，菜单行
//    真删除走 DeleteConfirm 确认）→ fixture 覆面删卡；live 链证据归
//    verify-pacman（DELETE /api/schedules/:id 全链）。
// 10. skills 排序钮 — #306 接真：单选 listbox（默认/名称），行点击 = 选中
//    即关（lang-dropdown 家族律）；名称序重排证据归 verify-pacman（fixture
//    单技能行序不可变）。
// 11. account-swap — #306 wontfix 出账（收编 #148 占位裁定）：头像更换无
//    upload 面且不会有（静态资源 + 无 PATCH /user/me 头像写路径），按钮移
//    除、avatar 头保留。
// 12. transcript 工具组折叠 — #306 接真：收起钮真收起（pills 隐、chevron
//    翻 ›），收起态 footer 行钮再点复原（r7 27↔28 双态互达）。
// 13. doc-pane 型选行 — #306 校准：r5b §3.7 文档类型选择器——行点击 = 选中
//    当前类型并关（lang-dropdown 同律），不再是无行为的 ✓ 行。
// 第 5 项（skills 添加技能主钮）由 #153 覆盖，本 spec 不断言。

/** 面板中心点的命中必须由面板自身持有 — title-band-clicks 同款家族法。 */
async function expectOwnsCenter(page: Page, selector: string) {
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

// —— 6. doc-pane 变更▾ 型选（#306 校准：行点击 = 选中即关）——————————————————

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

test('doc pane 型选行 click re-selects the current type and closes (#306)', async ({ page }) => {
  await page.goto('/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=27');
  await page.locator('.doc-select-wrap .doc-pane-select').click();
  const dropdown = page.locator('.plan-dropdown');
  await expect(dropdown).toBeVisible();
  // r5b §3.7：选择器行，非确认入口——选（唯一）当前型即关
  await dropdown.locator('.plan-dropdown-row').click();
  await expect(dropdown).toBeHidden();
});

// —— 7. machines 行内动作图标（#222 出账）——————————————————————————————

test('machines rows render no inline action buttons (#222 wontfix 出账)', async ({ page }) => {
  await page.goto('/app/resources/machines?scenario=06');
  // 在线机器行在（scenario=06 fixture 含一台 online 机器，行首 res-dot）
  await expect(page.locator('.res-dot').first()).toBeVisible();
  // #222:r8 §3.5 原站在线机器行右侧三行内动作图标——端点核实测无
  // local-first 机器管理面,不渲染死钮:行内零 button(行尾 chevron 为
  // 非交互 span,行外 添加机器 钮 .res-add 不在钉内)。
  await expect(page.locator('.res-grow button')).toHaveCount(0);
});

// —— 8. chief 抽屉「更多」钮（#306 wontfix 出账）———————————————————————

test('chief drawer drops the ⋮ 更多 button — thread view keeps four head actions (#306)', async ({
  page,
}) => {
  await page.goto('/app?scenario=114');
  const actions = page.locator('.chief-head-actions button');
  // #306：r8 随拍线程视图五钮中的 ⋮——菜单内容无正典 + server 无线程管理
  // mutation，wontfix 移除（注记在 chief-drawer.tsx 头部）
  await expect(page.locator('.chief-head-actions button[aria-label="更多"]')).toHaveCount(0);
  // 四钮全在：新主题 / 总管设置 / 全屏 / 关闭（与新线程视图同律）
  await expect(actions).toHaveCount(4);
  await expect(actions.nth(0)).toHaveAttribute('aria-label', '新主题');
  await expect(actions.nth(1)).toHaveAttribute('aria-label', '总管设置');
  await expect(actions.nth(2)).toHaveAttribute('aria-label', '全屏');
  await expect(actions.nth(3)).toHaveAttribute('aria-label', '关闭');
});

// —— 9. schedules 卡片「更多」菜单（#306 接真）———————————————————————————

test('sched card 更多 opens a menu and deletes the row through the confirm (#306)', async ({
  page,
}) => {
  await page.goto('/app/schedules?scenario=r3-93');
  const card = page.locator('.sched-card');
  await expect(card).toHaveCount(1);
  const more = page.locator('.sched-card-more');
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await more.click();
  const menu = page.locator('.sched-card-menu');
  await expect(menu).toBeVisible();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  // 家族律：Esc 关
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  // 删除链：菜单行 → 确认弹层 → 确认 → 卡出列（fixture 覆面）
  await more.click();
  await expect(menu).toBeVisible();
  await menu.locator('.sched-card-menu-row').click();
  const confirm = page.locator('.delete-confirm');
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText('确定删除该定时？此操作不可撤销。');
  await expect(confirm).toContainText('#1');
  await confirm.locator('.delete-confirm-delete').click();
  await expect(confirm).toBeHidden();
  await expect(page.locator('.sched-card')).toHaveCount(0);
  // 空态浮现（r7 11 面）
  await expect(page.locator('.sched-empty')).toBeVisible();
});

// —— 10. skills 排序钮（#306 接真）———————————————————————————————————————

test('skills 排序 opens the single-select listbox, picking an option closes it (#306)', async ({
  page,
}) => {
  await page.goto('/app/resources/skills?scenario=08');
  const sort = page.locator('.res-sort');
  await expect(sort).toHaveAttribute('aria-expanded', 'false');
  await sort.click();
  const menu = page.locator('.res-sort-menu');
  await expect(menu).toBeVisible();
  await expect(sort).toHaveAttribute('aria-expanded', 'true');
  // 两行默认/名称，当前项默认 ✓
  await expect(menu.locator('.res-sort-row')).toHaveCount(2);
  await expect(menu.locator('.res-sort-row[aria-selected="true"]')).toHaveText(/默认/);
  // 行点击 = 选中即关（lang-dropdown 律）
  await menu.locator('.res-sort-row', { hasText: '名称' }).click();
  await expect(menu).toBeHidden();
  await expect(page.locator('.res-rowcard')).toHaveCount(1);
  // Esc 关（家族律）与重开
  await sort.click();
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
});

// —— 11. account-swap（#306 wontfix 出账）—————————————————————————————————

test('account drops the 更换 button, keeps the avatar head (#306 wontfix 出账)', async ({
  page,
}) => {
  await page.goto('/app/account?scenario=13');
  await expect(page.locator('.account-swap')).toHaveCount(0);
  await expect(page.locator('.account-avatar img')).toBeVisible();
});

// —— 12. transcript 工具组折叠（#306 接真）———————————————————————————————

test('transcript tool group: 收起 collapses, the footer row re-expands (#306)', async ({ page }) => {
  await page.goto('/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=28');
  // r7 28 展开态：pills + 收起 在
  await expect(page.locator('.chat-tool-pill')).toHaveCount(2);
  const collapse = page.locator('.chat-collapse');
  await expect(collapse).toBeVisible();
  const footer = page.locator('button.chat-row-icons--toggle');
  await expect(footer).toHaveAttribute('aria-expanded', 'true');
  // 收起 → pills 隐、行钮收起态
  await collapse.click();
  await expect(page.locator('.chat-tool-pill')).toHaveCount(0);
  await expect(collapse).toHaveCount(0);
  await expect(footer).toHaveAttribute('aria-expanded', 'false');
  // 收起态 footer 行再点 → 复原（r7 27 ↔ 28 双态互达）
  await footer.click();
  await expect(page.locator('.chat-tool-pill')).toHaveCount(2);
  await expect(collapse).toBeVisible();
});
