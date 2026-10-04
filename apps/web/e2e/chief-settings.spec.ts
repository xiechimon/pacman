import { expect, type Page, test } from '@playwright/test';

// Issue #182 acceptance: chief 设置面三死钮接线(#180 裁决落账)。
// 1. agent 行 → 选择总管 Agent dialog(DialogShell 家族律):搜索框 + Agent
//    列(fixture 面 canon 单默认行 r3-builder);fixture 选定 = accept 律
//    关窗。换绑二次确认(live-only 路径,fixture 恒未绑定)归 live 真机验。
// 2. 章程编辑 → DialogShell 编辑弹窗:textarea 占位 r5 102/110 canon +
//    取消/保存章程;fixture 保存 = accept 律关窗。
// 3. 压缩模型 #204 翻回交互(server #203 compactionModel 槽就位):button
//    开 anchored popover(FloatingShell + ClickCatcher 家族律,#656 起
//    Esc 归 Base UI layer 栈),
//    fixture 面清单 = 默认行 + canon 单行(claude-code/claude-sonnet-5;#770 起
//    providers 段已除,canon 行取 runtime 源形),选定 =
//    accept 律关面。live PATCH 写读回归归 live 真机验。

const AGENT_TAB = '/app?scenario=101';

// #811: 返回钮可点——标题覆盖层曾拦截点选（.chief-set-title 全宽绝对
// 定位盖住按钮），点返回应回到总管抽屉。Playwright 的 actionability 即回归
// 钉：覆盖重现时 click 在此超时。
test('返回按钮可用：点击回到总管抽屉 (#811)', async ({ page }) => {
  await page.goto(AGENT_TAB);
  await expect(page.locator('.chief-settings')).toBeVisible();
  await page.locator('.chief-set-back').click();
  await expect(page.locator('.chief-settings')).toBeHidden();
  await expect(page.getByRole('dialog', { name: '总管' })).toBeVisible();
});
const CHARTER_TAB = '/app?scenario=102';

async function openAgentDialog(page: Page) {
  await page.goto(AGENT_TAB);
  await page.locator('.chief-agent-row').click();
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  return dialog;
}

test('agent row opens the 选择总管 Agent dialog with search + canon default row', async ({
  page,
}) => {
  const dialog = await openAgentDialog(page);
  await expect(dialog.locator('.dlg-title')).toHaveText('选择总管 Agent');
  await expect(dialog.locator('.chief-pick-input')).toHaveAttribute('placeholder', '搜索 Agent…');
  await expect(dialog.locator('.chief-pick-row')).toHaveCount(1);
  await expect(dialog.locator('.chief-pick-name')).toHaveText('r3-builder');
});

test('agent dialog family law: X, Escape and backdrop dismiss; panel clicks do not', async ({
  page,
}) => {
  let dialog = await openAgentDialog(page);
  await dialog.locator('.dlg-close').click();
  await expect(page.locator('.dlg')).toBeHidden();

  dialog = await openAgentDialog(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.dlg')).toBeHidden();

  dialog = await openAgentDialog(page);
  await dialog.locator('.dlg-title').click();
  await expect(page.locator('.dlg')).toBeVisible();
  await page.mouse.click(20, 20);
  await expect(page.locator('.dlg')).toBeHidden();
});

test('agent dialog search filters the list; no match shows the empty row', async ({ page }) => {
  const dialog = await openAgentDialog(page);
  await dialog.locator('.chief-pick-input').fill('不存在');
  await expect(dialog.locator('.chief-pick-row')).toHaveCount(0);
  await expect(dialog.locator('.chief-pick-empty')).toHaveText('没有匹配的 Agent');
  await dialog.locator('.chief-pick-input').fill('r3');
  await expect(dialog.locator('.chief-pick-row')).toHaveCount(1);
});

test('fixture agent pick closes the dialog (accept 律)', async ({ page }) => {
  const dialog = await openAgentDialog(page);
  await dialog.locator('.chief-pick-row').click();
  await expect(page.locator('.dlg')).toBeHidden();
});

async function openCharterDialog(page: Page) {
  await page.goto(CHARTER_TAB);
  await page.locator('.chief-edit-btn').click();
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  return dialog;
}

test('charter 编辑 opens the DialogShell editor with the r5 captured fields', async ({ page }) => {
  const dialog = await openCharterDialog(page);
  await expect(dialog.locator('.dlg-title')).toHaveText('编辑章程');
  await expect(dialog.locator('.chief-dlg-charter-input')).toHaveAttribute(
    'placeholder',
    '长期指令：模型路由规则（何种任务使用何种模型）、优先级、偏好…',
  );
  await expect(dialog.locator('.chief-dlg-ghost')).toHaveText('取消');
  await expect(dialog.locator('.chief-dlg-primary')).toHaveText('保存章程');
});

test('charter dialog family law: X, Escape, 取消 and backdrop dismiss', async ({ page }) => {
  let dialog = await openCharterDialog(page);
  await dialog.locator('.dlg-close').click();
  await expect(page.locator('.dlg')).toBeHidden();

  dialog = await openCharterDialog(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.dlg')).toBeHidden();

  dialog = await openCharterDialog(page);
  await dialog.locator('.chief-dlg-ghost').click();
  await expect(page.locator('.dlg')).toBeHidden();

  dialog = await openCharterDialog(page);
  await dialog.locator('.dlg-title').click();
  await expect(page.locator('.dlg')).toBeVisible();
  await page.mouse.click(20, 20);
  await expect(page.locator('.dlg')).toBeHidden();
});

test('fixture charter save closes the dialog (accept 律)', async ({ page }) => {
  const dialog = await openCharterDialog(page);
  await dialog.locator('.chief-dlg-charter-input').fill('优先派给 r3-builder。');
  await dialog.locator('.chief-dlg-primary').click();
  await expect(page.locator('.dlg')).toBeHidden();
});

async function openModelMenu(page: Page) {
  await page.goto(AGENT_TAB);
  const select = page.locator('button.chief-select');
  await expect(select).toBeVisible();
  await expect(select).toContainText('默认（与 Chief 相同）');
  await select.click();
  const menu = page.locator('.chief-model-menu');
  await expect(menu).toBeVisible();
  return { select, menu };
}

test('压缩模型 interactive (#204): button opens the anchored model menu', async ({ page }) => {
  const { menu } = await openModelMenu(page);
  // span 静态化已翻回(button 才是选择器);清单 = 默认行 + fixture canon 单行。
  await expect(page.locator('span.chief-select')).toHaveCount(0);
  // #756 续：listbox 语义随 ModelPickList 的清单容器（搜索框现形态在
  // listbox 外），菜单壳只承几何。
  await expect(menu.locator('.chief-model-pick-list')).toHaveAttribute('role', 'listbox');
  await expect(menu.locator('.chief-model-row')).toHaveCount(2);
  await expect(menu.locator('.chief-model-row').nth(0)).toContainText('默认（与 Chief 相同）');
  await expect(menu.locator('.chief-model-row').nth(0)).toHaveAttribute('aria-selected', 'true');
  await expect(menu.locator('.chief-model-row').nth(1)).toContainText('claude-sonnet-5');
  await expect(menu.locator('.chief-model-row-provider')).toHaveText('Claude Code');
});

test('压缩模型 search is typeahead-only, same contract as the drawer picker (#756 续)', async ({
  page,
}) => {
  const { menu } = await openModelMenu(page);
  // 开面零搜索占位（不渲染，非透明）——与抽屉头 picker 同形单源
  await expect(menu.locator('.chief-pick-search')).toHaveCount(0);
  // 同抽屉面：等焦点落进面再打字（FloatingShell 移焦点是异步的）
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return el != null && el.contains(document.activeElement);
    },
    '.chief-model-menu',
  );
  // 可打印字符被面吃掉：框现形、预填该字符、焦点进 input、即刻过滤
  await page.keyboard.press('x');
  const search = menu.locator('.chief-pick-search input');
  await expect(search).toBeVisible();
  await expect(search).toHaveValue('x');
  await expect(search).toBeFocused();
  // x 命中不了 canon 行与 provider → 默认行 + 空态
  await expect(menu.locator('.chief-model-row')).toHaveCount(1);
  await expect(menu.locator('.chief-pick-empty')).toBeVisible();
  // 收回律：清空 = 框收回、清单回全量
  await search.fill('');
  await expect(menu.locator('.chief-pick-search')).toHaveCount(0);
  await expect(menu.locator('.chief-model-row')).toHaveCount(2);
});

test('压缩模型 menu family law (#204): Escape and outside click dismiss', async ({ page }) => {
  let menu = (await openModelMenu(page)).menu;
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();

  menu = (await openModelMenu(page)).menu;
  await page.mouse.click(20, 20);
  await expect(menu).toBeHidden();
});

test('压缩模型 fixture pick = accept 律:选择即关 (#204)', async ({ page }) => {
  const { select, menu } = await openModelMenu(page);
  await menu.locator('.chief-model-row').nth(1).click();
  await expect(page.locator('.chief-model-menu')).toBeHidden();
  // fixture 面无 mutation:select 回显保持 canon 默认文案。
  await expect(select).toContainText('默认（与 Chief 相同）');
});

// #772: 长 provider/model 串不再把框撑满——值单行截断 ellipsis + title
// 悬停全称；框定宽上限（两主题）。短值面不受影响（min-width 160 保留）。
for (const theme of ['dark', 'light'] as const) {
  test(`压缩模型 long value truncates, full name on title (${theme}, #772)`, async ({
    page,
  }) => {
    await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);
    await page.goto('/app?scenario=101-stale-model');
    const select = page.locator('button.chief-select');
    await expect(select).toContainText('anthropic/claude-3-5-haiku-20241022');
    await expect(select).toHaveAttribute('title', 'anthropic/claude-3-5-haiku-20241022');
    const box = await select.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(202);
    const clipped = await select
      .locator('.chief-select-value')
      .evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(clipped).toBe(true);
  });
}

// #772 空态卡统一：memo 与 watches/charter-empty 同为居中 + 卡片随文案
// 长高（英文两行不再顶出卡片）。tab 文案与记忆页互引按票面冻结，只钉几何。
test('空态卡 centered and growth-proof: memo matches watches (#772)', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('pacman.locale', 'en');
    localStorage.setItem('pacman-locale', 'en');
    localStorage.setItem('pacman-theme', 'light');
  });
  for (const [scenario, sel] of [['103', '.chief-memo'], ['104', '.chief-watches']] as const) {
    await page.goto(`/app?scenario=${scenario}`);
    const card = page.locator(sel);
    await expect(card).toBeVisible();
    const geo = await card.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        centered: cs.justifyContent === 'center',
        contained: el.scrollHeight <= Math.ceil(r.height) + 1,
      };
    });
    expect(geo.centered).toBe(true);
    expect(geo.contained).toBe(true);
  }
});

// #358 AC2:preset 方案退役后,仍引用已废 preset 的旧 compactionModel 值
// 命中不了任何选项 → 裸串 `provider/modelId` 兜底回显(#180 裁决收敛到值
// 回显层;存量 provider 模型值同律),不空白不崩;菜单无选中行,canon 行选定
// 仍走 accept 律。
test('压缩模型 stale preset value (#358): 裸串兜底回显 + 菜单无选中行', async ({ page }) => {
  await page.goto('/app?scenario=101-stale-model');
  const select = page.locator('button.chief-select');
  await expect(select).toContainText('anthropic/claude-3-5-haiku-20241022');
  await select.click();
  const menu = page.locator('.chief-model-menu');
  await expect(menu).toBeVisible();
  await expect(menu.locator('.chief-model-row')).toHaveCount(2);
  await expect(menu.locator('.chief-model-row[aria-selected="true"]')).toHaveCount(0);
  await menu.locator('.chief-model-row').nth(1).click();
  await expect(page.locator('.chief-model-menu')).toBeHidden();
  // fixture 面无 mutation:兜底裸串回显保持。
  await expect(select).toContainText('anthropic/claude-3-5-haiku-20241022');
});
