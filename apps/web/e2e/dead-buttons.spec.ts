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
// 8. 语音输入钮 — #304（08 册 C5 裁决）：语音功能不做，composer 工具条与
//    新建任务对话框工具条两处语音钮移除不留死钮（#146 chief 面同律）；
//    与 #146 的差异 = 本票只除语音，添加附件/提及两工具原样保留。

// 9. #307 档 4 外链型四件 wontfix 出账（spec 08 二分律）：api-keys 空态
//    「查看文档」钮（#149 schedules 同律——local-first 无文档站）、
//    resources 共享空态「查看文档」链接（skills/secrets/mcp 随 EmptyState
//    一并出账）、create-agent-dialog 与 project-settings 的头像「更换」
//    ink（静态资产无上传面——档 4 二分律下本项 #148/#177 占位 chrome
//    裁决改判移除；account-swap 同款归档 3，不在本票）。
//    四处不再渲染，存活面（新建密钥/空态主钮/头像资产/分支 chip）钉住。
// 10. chief 抽屉「更多」（⋮）— #306 wontfix 出账：原站菜单内容未点开无正典
//    （r8-chief-panel-adhoc §3），server chief 面无线程管理 mutation——注记
//    在 chief-drawer.tsx 头部；线程视图头部回到四钮（与新线程视图同律）。
// 11. schedules 卡片「更多」— #306 接真：per-card 菜单（Esc/外点关，菜单行
//    真删除走 DeleteConfirm 确认）→ fixture 覆面删卡；live 链证据归
//    verify-pacman（DELETE /api/schedules/:id 全链）。
// 12. skills 排序钮 — #306 接真：单选 listbox（默认/名称），行点击 = 选中
//    即关（lang-dropdown 家族律）；名称序重排证据归 verify-pacman（fixture
//    单技能行序不可变）。
// 13. account-swap — #306 wontfix 出账（收编 #148 占位裁定）：头像更换无
//    upload 面且不会有（静态资源 + 无 PATCH /user/me 头像写路径），按钮移
//    除、avatar 头保留。
// 14. transcript 工具组折叠 — #306 接真：收起钮真收起（pills 隐、chevron
//    翻 ›），收起态 footer 行钮再点复原（r7 27↔28 双态互达）。
// 15. doc-pane 型选行 — #306 校准：r5b §3.7 文档类型选择器——行点击 = 选中
//    当前类型并关（lang-dropdown 同律），不再是无行为的 ✓ 行。

// 第 5 项（skills 添加技能主钮）由 #153 覆盖，本 spec 不断言。
//
// Issue #318（M7-W2 桩群校准新增，r9 补采）：每条钉一个桩位的回归失败方式：
// 8a. 更多菜单「完成」= 相位适配动作（review 面开既有验收弹层 accept→merge
//     链；fixture confirm 面无 confirm wire → disabled，live confirm 接
//     stepAction，verify-pacman 证据）。
// 8b. 更多菜单「关闭」= phase closed 落账：仅 server 漏斗现有边 todo/failed
//     放行（点毕回看板）；review/confirm/done→closed 边归 W3 server 票
//     （#318 前端+注记裁定）→ disabled。r1 延迟 Undo 窗口不落地（[设计]
//     票内裁量 wontfix）。
// 8c. 开始任务 dialog 统一面（r9 §3.6）：待开始「开始」先开 dialog 再跑；
//     Agent 行 = 真选择器（未指派 + canon 行，#182 家族弹层，Esc 归内层）；
//     分用开关 = 真 role=switch（ON → 规划/执行双行，正对 assignment 双槽）。
//     机器行 live-only（fixture 捕获无该行）；「指定机器」无 server 槽 →
//     静态展示面 [设计]，live 断言归 verify-pacman。
// 8d. 复用面板「查看方案」= 关弹层 + docpane 切 plan 面（r8 §5 [设计] 裁定；
//     fixture 75 无 plan doc → 「暂无方案」占位即模式切换证据，live plan
//     内容归 verify-pacman）。
// 8e. 项目页任务行/卡 = 真 <a> stretched-link 导航 /app/todo/:id（r2 §2，
//     todo-card #58 同律；search 随行携带）。
// 8f. 新建任务对话框未保存闸（r9 §3.4）：标题/描述任一非空时 X/backdrop/Esc
//     先过「放弃新建任务？」确认（继续编辑 / 放弃并关闭）；净表单直关；
//     关闭即重置表单。

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

// —— 8. 语音输入钮（#304 C5）——————————————————————————————————————————

test('composer toolbar drops the 语音输入 button, keeps attachment + mention', async ({ page }) => {
  // chain 面 confirm v1：composer 确定在场（reject-chain 同路由）
  await page.goto('/app/todo/r8-15?scenario=chain');
  const toolbar = page.locator('.composer-toolbar');
  await expect(toolbar).toBeVisible();
  // #304（08 册 C5）：语音输入功能不做——钮移除不渲染（wontfix 注记在
  // composer.tsx 实现位；#146 chief 面同律）。本票唯一移除对象是语音，
  // 添加附件/提及两工具必须原样在场。
  await expect(toolbar.locator('button[aria-label="语音输入"]')).toHaveCount(0);
  await expect(toolbar.locator('button[aria-label="添加附件"]')).toBeVisible();
  await expect(toolbar.locator('button[aria-label="提及"]')).toBeVisible();
});

test('new-task dialog tools drop the 语音输入 button, keep two live tools', async ({ page }) => {
  await page.goto('/app?scenario=01');
  await page.locator('.board-new-task').click();
  const tools = page.locator('.new-task-tools');
  await expect(tools).toBeVisible();
  // #304（08 册 C5）：同律——语音钮不渲染，工具条收窄为附件+提及两钮
  // （wontfix 注记在 new-task-dialog.tsx 实现位）。
  await expect(tools.locator('button[aria-label="语音输入"]')).toHaveCount(0);
  await expect(tools.locator('button')).toHaveCount(2);
  await expect(tools.locator('button[aria-label="添加附件"]')).toBeVisible();
  await expect(tools.locator('button[aria-label="提及"]')).toBeVisible();

// —— 9. #307 档 4 外链型 wontfix 出账 ————————————————————————————

test('api-keys empty state drops the 查看文档 button, keeps 新建密钥 (#307)', async ({ page }) => {
  await page.goto('/app/api-keys');
  await expect(page.locator('.keys-empty')).toBeVisible();
  await expect(page.locator('.keys-docs')).toHaveCount(0);
  await expect(page.locator('.keys-create')).toBeVisible();
});

test('resources empty state drops the 查看文档 link, keeps the primary action (#307)', async ({
  page,
}) => {
  await page.goto('/app/resources/skills?scenario=01');
  await expect(page.locator('.res-empty')).toBeVisible();
  // 共享 EmptyState 件:skills/secrets/mcp 三面空态的文档链接一并出账
  // (skills + secrets 双面钉,防单面局部复活漏网;mcp 同件随行)
  await expect(page.locator('.res-doclink')).toHaveCount(0);
  await expect(page.locator('.res-empty .res-primary')).toBeVisible();
  await page.goto('/app/resources/secrets?scenario=01');
  await expect(page.locator('.res-empty')).toBeVisible();
  await expect(page.locator('.res-doclink')).toHaveCount(0);
});

test('create-agent dialog drops the avatar 更换 ink (#307)', async ({ page }) => {
  await page.goto('/app/team?scenario=12');
  await page.locator('.team-create-agent').click();
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.dlg-agent-swap')).toHaveCount(0);
  // 头像行仍在（静态机器人资产），名称输入与创建主钮不受影响
  await expect(dialog.locator('.dlg-agent-avatar img')).toBeVisible();
  await expect(dialog.locator('#dlg-agent-name')).toBeVisible();
});

test('project settings drops the avatar 更换 ink (#307, supersedes the #177 chrome verdict)', async ({
  page,
}) => {
  await page.goto('/app/project/ZAQczKCu0MOAzC1ZqcFlX/settings?scenario=r2-24c');
  await expect(page.locator('.prj-set-change')).toHaveCount(0);
  // 头像圆标仍在；#177 存续裁决（分支 chip 静态化）不受影响
  await expect(page.locator('.prj-set-avatar')).toBeVisible();
  await expect(page.locator('span.prj-set-branch')).toBeVisible();
// —— 10. chief 抽屉「更多」钮（#306 wontfix 出账）———————————————————————

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

// —— 11. schedules 卡片「更多」菜单（#306 接真）———————————————————————————

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

// —— 12. skills 排序钮（#306 接真）———————————————————————————————————————

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

// —— 13. account-swap（#306 wontfix 出账）—————————————————————————————————

test('account drops the 更换 button, keeps the avatar head (#306 wontfix 出账)', async ({
  page,
}) => {
  await page.goto('/app/account?scenario=13');
  await expect(page.locator('.account-swap')).toHaveCount(0);
  await expect(page.locator('.account-avatar img')).toBeVisible();
});

// —— 14. transcript 工具组折叠（#306 接真）———————————————————————————————

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


// —— 15. #318 M7-W2 桩群校准新增（节 1-9+10-15 末位追加；原位 8 与 main 语音节撞号，顺到最后） —————————————————————————————————————————

const REVIEW_DETAIL = '/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=27';

test('more menu 完成 opens the accept dialog on the review surface (#318)', async ({ page }) => {
  await page.goto(REVIEW_DETAIL);
  await page.locator('.detail-head-icon--more').click();
  const menu = page.locator('.more-menu');
  await expect(menu).toBeVisible();
  const complete = menu.locator('.more-menu-item', { hasText: '完成' });
  await expect(complete).toBeEnabled();
  await complete.click();
  // 完成 = 相位适配动作:review 走既有 accept→merge 链(弹层开、菜单收)
  await expect(menu).toBeHidden();
  await expect(page.locator('.dlg-title')).toHaveText('完成任务');
});

test('more menu 关闭 is phase-gated by the server funnel edges (#318)', async ({ page }) => {
  // review 面:review→closed 漏斗无边(归 W3 server 票)→ disabled
  await page.goto(REVIEW_DETAIL);
  await page.locator('.detail-head-icon--more').click();
  await expect(page.locator('.more-menu-item', { hasText: '关闭' })).toBeDisabled();
  // failed 面:failed→closed 现有边 → 放行,点毕回看板(卡片立即隐藏语义)
  await page.goto('/app/todo/r8-12?scenario=54');
  await page.locator('.detail-head-icon--more').click();
  const closeRow = page.locator('.more-menu-item', { hasText: '关闭' });
  await expect(closeRow).toBeEnabled();
  // failed 无完成语义(confirm-and-merge 仅 confirm/review)→ disabled
  await expect(page.locator('.more-menu-item', { hasText: '完成' })).toBeDisabled();
  await closeRow.click();
  await expect(page).toHaveURL('/app');
});

test('todo-phase 开始 opens the unified start dialog (#318)', async ({ page }) => {
  // r9 §3.6:待开始点「开始」先开 dialog 再跑(不再直发 startBuild)
  await page.goto('/app/todo/fresh-probe?scenario=23');
  await page.locator('.detail-head-action').click();
  await expect(page.locator('.overlay-title')).toHaveText('开始任务');
});

test('rerun dialog: agent row is a real selector, the split switch a real role=switch (#318)', async ({
  page,
}) => {
  await page.goto('/app/todo/r8-12?scenario=56');
  // Agent 行 = 选择器入口(#75 原死钮位);弹层 = #182 家族件
  await page.locator('.rerun-agent-row').click();
  const picker = page.locator('.dlg');
  await expect(picker).toBeVisible();
  await expect(page.locator('.dlg-title')).toHaveText('选择 Agent');
  const pickerRows = page.locator('.chief-pick-row');
  // fixture 面 = 未指派 + canon r3-builder(r5 捕获名)
  await expect(pickerRows).toHaveCount(2);
  await expect(pickerRows.first()).toContainText('未指派');
  // Esc 归内层:只收选择器,开始 dialog 不陪关(Overlay escMuted)
  await page.keyboard.press('Escape');
  await expect(picker).toBeHidden();
  await expect(page.locator('.overlay')).toBeVisible();
  // 选「未指派」→ Agent 行换未指派面
  await page.locator('.rerun-agent-row').click();
  await page.locator('.chief-pick-row', { hasText: '未指派' }).click();
  await expect(picker).toBeHidden();
  await expect(page.locator('.rerun-agent-name')).toHaveText('未指派');
  // 分用开关 = 真 role=switch(原静态 span):ON → 规划/执行双 Agent 行
  const sw = page.locator('.rerun-switch');
  await expect(sw).toHaveAttribute('role', 'switch');
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.rerun-agent-row')).toHaveCount(2);
  await expect(page.locator('.rerun-agent-label', { hasText: '规划' })).toBeVisible();
  await expect(page.locator('.rerun-agent-label', { hasText: '执行' })).toBeVisible();
  // OFF 收拢回单行
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('.rerun-agent-row')).toHaveCount(1);
});

test('reuse panel 查看方案 flips the doc pane to the plan face (#318)', async ({ page }) => {
  await page.goto('/app/todo/r8-15?scenario=75');
  await expect(page.locator('.overlay-title')).toHaveText('复用方案');
  // 点击前:failed 面 = changes 表面(型选钮取 wrap 内限定,版本 chip 同类名)
  await expect(page.locator('.doc-select-wrap .doc-pane-select')).toContainText('变更');
  await page.locator('.overlay-btn', { hasText: '查看方案' }).click();
  // 查看方案 = 关弹层 + docpane 切 plan 面;fixture 75 无 plan doc →
  // 「暂无方案」占位即模式切换证据(live plan 内容归 verify-pacman)
  await expect(page.locator('.overlay')).toBeHidden();
  await expect(page.locator('.doc-empty')).toContainText('暂无方案');
});

test('project task rows and cards are real links to the todo detail (#318)', async ({ page }) => {
  await page.goto('/app/project/ZAQczKCu0MOAzC1ZqcFlX?scenario=prj-tasks&tab=tasks');
  const row = page.locator('.prj-task-row').first();
  await expect(row).toBeVisible();
  // 行标题 = 真 <a>(::after 拉伸盖满整行,todo-card #58 同律)
  await expect(row.locator('a.prj-task-link')).toHaveCount(1);
  await row.click();
  await expect(page).toHaveURL(/\/app\/todo\/[^?]+\?scenario=prj-tasks&tab=tasks/);
  // 网格卡同律
  await page.goto('/app/project/ZAQczKCu0MOAzC1ZqcFlX?scenario=prj-tasks&tab=tasks');
  await page.locator('.prj-tasks-view-btn').nth(1).click();
  const card = page.locator('.prj-task-card').first();
  await expect(card).toBeVisible();
  await expect(card.locator('a.prj-task-link')).toHaveCount(1);
  await card.click();
  await expect(page).toHaveURL(/\/app\/todo\//);
});

test('new-task dialog gates unsaved closes and resets on discard (#318)', async ({ page }) => {
  await page.goto('/app?scenario=01');
  const dialog = page.locator('.new-task-dialog');
  const discard = page.locator('.new-task-discard');
  // 净表单:X 直关不闸
  await page.locator('.board-new-task').click();
  await expect(dialog).toBeVisible();
  await dialog.locator('.new-task-close').click();
  await expect(dialog).toBeHidden();
  await expect(discard).toHaveCount(0);
  // 标题非空 → X 先过「放弃新建任务？」确认(r9 §3.4 copy 逐字)
  await page.locator('.board-new-task').click();
  await dialog.locator('.new-task-input').fill('未保存探针');
  await dialog.locator('.new-task-close').click();
  await expect(discard).toBeVisible();
  await expect(discard).toContainText('放弃新建任务？未保存的内容将丢失。');
  // 继续编辑 = 只收确认层,草稿保留
  await discard.locator('.new-task-discard-keep').click();
  await expect(discard).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.new-task-input')).toHaveValue('未保存探针');
  // Esc 关闸同律;确认层上 Esc = 内层优先(只收确认层)
  await page.keyboard.press('Escape');
  await expect(discard).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(discard).toBeHidden();
  await expect(dialog).toBeVisible();
  // 放弃并关闭 = 关 dialog + 表单重置(重开净面)
  await dialog.locator('.new-task-close').click();
  await discard.locator('.new-task-discard-drop').click();
  await expect(dialog).toBeHidden();
  await page.locator('.board-new-task').click();
  await expect(dialog.locator('.new-task-input')).toHaveValue('');
});

test('new-task gate also trips on a non-empty spec body (#318)', async ({ page }) => {
  await page.goto('/app?scenario=01');
  await page.locator('.board-new-task').click();
  await page.locator('.new-task-spec').fill('描述探针');
  await page.locator('.new-task-close').click();
  await expect(page.locator('.new-task-discard')).toBeVisible();

});
