import { expect, type Page, test } from '@playwright/test';
import { evidencePanelShot } from './evidence';

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
// 4. #895 主力机槽(spec 21 A6):Agent tab「机器」行 ChiefMachineSelect
//    (行形态沿 new-task 机器 chip 的 listbox 族);live PATCH machineId 槽
//    写读回归归 live 真机验(docs/verify/865/)。

const AGENT_TAB = '/app?scenario=101';

// #811: 返回钮可点——标题覆盖层曾拦截点选（.chief-set-title 全宽绝对
// 定位盖住按钮），点返回应回到总管抽屉。Playwright 的 actionability 即回归
// 钉：覆盖重现时 click 在此超时。
// #950 载体：设置面 = heading「总管设置」（.chief-settings/.chief-set-* 类
// 退役）；返回钮 = role + aria-label。
const settingsView = (page: Page) => page.getByRole('heading', { name: '总管设置' });

test('返回按钮可用：点击回到总管抽屉 (#811)', async ({ page }) => {
  await page.goto(AGENT_TAB);
  await expect(settingsView(page)).toBeVisible();
  await page.getByRole('button', { name: '返回' }).click();
  await expect(settingsView(page)).toBeHidden();
  await expect(page.getByRole('dialog', { name: '总管' })).toBeVisible();
});
const CHARTER_TAB = '/app?scenario=102';

async function openAgentDialog(page: Page) {
  await page.goto(AGENT_TAB);
  // #950 载体：agent 行 = role button（可及名 = 绑定态文案）；dialog =
  // role + 可及名（.dlg 壳级别名重钉先行，§5.5——DOM 别名存活至 #952）。
  await page.getByRole('button', { name: '未设置' }).click();
  const dialog = page.getByRole('dialog', { name: '选择总管 Agent' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test('agent row opens the 选择总管 Agent dialog with search + canon default row', async ({
  page,
}) => {
  const dialog = await openAgentDialog(page);
  await expect(dialog).toHaveAttribute('aria-label', '选择总管 Agent');
  await expect(dialog.getByPlaceholder('搜索 Agent…')).toHaveAttribute(
    'placeholder',
    '搜索 Agent…',
  );
  await expect(dialog.getByRole('option')).toHaveCount(1);
  await expect(dialog.getByRole('option')).toHaveText('r3-builder');
});

// #872 反向钉：搜索盒是共享配方（SEARCH_BOX_CLS），agent 对话框那一份骑在
// 自己的 16px 容器垫上。模型 picker 的壳垫移交（盒自带 mx-3）不许漏进这一
// 面（第一次实现就是全局加 margin-inline: 12px —— 这一面会变 28px）。
test('agent dialog search keeps its own 16px inset (#872 blast radius)', async ({ page }) => {
  const dialog = await openAgentDialog(page);
  // #950 载体：壳 = 搜索盒的父容器（.chief-pick/.chief-pick-search 类退役；
  // 盒 = placeholder input 的父）。
  const shell = dialog.getByPlaceholder('搜索 Agent…').locator('xpath=../..');
  // .dlg 的进场是 zoom-in-95 缩放（100ms）——缩放着量到的不是落定几何。
  await dialog.evaluate((el) =>
    Promise.all(el.getAnimations().map((a) => a.finished)).then(() => undefined),
  );
  const inset = await dialog.getByPlaceholder('搜索 Agent…').evaluate((el) => {
    const box = el.parentElement as HTMLElement;
    const shell = box.parentElement as HTMLElement;
    return box.getBoundingClientRect().left - shell.getBoundingClientRect().left;
  });
  await expect(shell).toBeVisible();
  expect(inset).toBeCloseTo(16, 1);
});

test('agent dialog family law: X, Escape and backdrop dismiss; panel clicks do not', async ({
  page,
}) => {
  let dialog = await openAgentDialog(page);
  await dialog.getByRole('button', { name: '关闭' }).click();
  await expect(dialog).toBeHidden();

  dialog = await openAgentDialog(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  dialog = await openAgentDialog(page);
  await dialog.getByText('选择总管 Agent').click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(20, 20);
  await expect(dialog).toBeHidden();
});

test('agent dialog search filters the list; no match shows the empty row', async ({ page }) => {
  const dialog = await openAgentDialog(page);
  await dialog.getByPlaceholder('搜索 Agent…').fill('不存在');
  await expect(dialog.getByRole('option')).toHaveCount(0);
  await expect(dialog.getByText('没有匹配的 Agent')).toHaveText('没有匹配的 Agent');
  await dialog.getByPlaceholder('搜索 Agent…').fill('r3');
  await expect(dialog.getByRole('option')).toHaveCount(1);
});

test('fixture agent pick closes the dialog (accept 律)', async ({ page }) => {
  const dialog = await openAgentDialog(page);
  await dialog.getByRole('option').click();
  await expect(dialog).toBeHidden();
});

async function openCharterDialog(page: Page) {
  await page.goto(CHARTER_TAB);
  await page.getByRole('button', { name: '编辑' }).click();
  const dialog = page.getByRole('dialog', { name: '编辑章程' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test('charter 编辑 opens the DialogShell editor with the r5 captured fields', async ({ page }) => {
  const dialog = await openCharterDialog(page);
  await expect(dialog).toHaveAttribute('aria-label', '编辑章程');
  // §5.3 正典：charter textarea 载体 = dialog scope getByRole('textbox')。
  await expect(dialog.getByRole('textbox')).toHaveAttribute(
    'placeholder',
    '长期指令：模型路由规则（何种任务使用何种模型）、优先级、偏好…',
  );
  await expect(dialog.getByRole('button', { name: '取消' })).toHaveText('取消');
  await expect(dialog.getByRole('button', { name: '保存章程' })).toHaveText('保存章程');
});

test('charter dialog family law: X, Escape, 取消 and backdrop dismiss', async ({ page }) => {
  let dialog = await openCharterDialog(page);
  await dialog.getByRole('button', { name: '关闭' }).click();
  await expect(dialog).toBeHidden();

  dialog = await openCharterDialog(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  dialog = await openCharterDialog(page);
  await dialog.getByRole('button', { name: '取消' }).click();
  await expect(dialog).toBeHidden();

  dialog = await openCharterDialog(page);
  await dialog.getByText('编辑章程').click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(20, 20);
  await expect(dialog).toBeHidden();
});

test('fixture charter save closes the dialog (accept 律)', async ({ page }) => {
  const dialog = await openCharterDialog(page);
  await dialog.getByRole('textbox').fill('优先派给 r3-builder。');
  await dialog.getByRole('button', { name: '保存章程' }).click();
  await expect(dialog).toBeHidden();
});

// #950 载体：触发钮 = role + aria-label「压缩模型」（旧 button.chief-select
// 类 locator 退役；aria-label 与弹层同词、role 区分）；菜单 = dialog role +
// 可及名。
const modelSelect = (page: Page) => page.getByRole('button', { name: '压缩模型' });
const modelMenu = (page: Page) => page.getByRole('dialog', { name: '压缩模型' });

async function openModelMenu(page: Page) {
  await page.goto(AGENT_TAB);
  const select = modelSelect(page);
  await expect(select).toBeVisible();
  await expect(select).toContainText('默认（与 Chief 相同）');
  await select.click();
  const menu = modelMenu(page);
  await expect(menu).toBeVisible();
  return { select, menu };
}

test('压缩模型 interactive (#204): button opens the anchored model menu', async ({ page }) => {
  const { menu } = await openModelMenu(page);
  // span 静态化已翻回(button 才是选择器——#204 律的载体即 role=button 本身);
  // 清单 = 默认行 + fixture canon 单行。
  await expect(page.locator('span[aria-label="压缩模型"]')).toHaveCount(0);
  // #756 续：listbox 语义随 ModelPickList 的清单容器（搜索框现形态在
  // listbox 外），菜单壳只承几何。
  await expect(menu.getByRole('listbox')).toBeVisible();
  await expect(menu.getByRole('option')).toHaveCount(2);
  await expect(menu.getByRole('option').nth(0)).toContainText('默认（与 Chief 相同）');
  await expect(menu.getByRole('option').nth(0)).toHaveAttribute('aria-selected', 'true');
  await expect(menu.getByRole('option').nth(1)).toContainText('claude-sonnet-5');
  await expect(menu.getByText('Claude Code')).toHaveText('Claude Code');
});

// #872: 设置面 picker 与抽屉面共用 ModelPickRow —— 整行铺满的失败方式同上；
// 这一面多钉两条：未选中行不许跟着上底色；搜索框的 12px 内缩是壳垫迁走后
// 由行/搜索框各自承担的，不许跟着塌掉。
test('压缩模型 selected row fill bleeds to the menu edges (#872)', async ({ page }) => {
  // 用户报的就是这一面（压缩模型 picker）的亮面截图——证据帧与它同面。
  await page.addInitScript(() => localStorage.setItem('pacman-theme', 'light'));
  const { menu } = await openModelMenu(page);
  await menu.evaluate((el) =>
    Promise.all(el.getAnimations().map((a) => a.finished)).then(() => undefined),
  );
  const selected = menu.getByRole('option', { selected: true });
  await expect(selected).toHaveCount(1);
  // 证据帧（PACMAN_E2E_EVIDENCE 未设时零写入）：这一面有选中 + 未选中两行，
  // 正是用户报的那张图（设置面压缩模型 picker）。
  await evidencePanelShot(page, '872-settings-picker.png', menu);

  const geo = await selected.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const panelEl = el.closest('[role="dialog"]') as HTMLElement;
    const p = panelEl.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const pcs = getComputedStyle(panelEl);
    const name = el.querySelector('[data-testid="model-pick-name"]') as HTMLElement;
    const check = el.querySelector('[data-testid="model-pick-check"]') as HTMLElement;
    return {
      fillLeft: r.left - p.left,
      fillRight: p.right - r.right,
      panelBorder: parseFloat(pcs.borderLeftWidth),
      bg: cs.backgroundColor,
      padLeft: parseFloat(cs.paddingLeft),
      padRight: parseFloat(cs.paddingRight),
      nameInset: name.getBoundingClientRect().left - r.left,
      checkInset: r.right - check.getBoundingClientRect().right,
    };
  });
  expect(geo.bg).not.toBe('rgba(0, 0, 0, 0)');
  expect(geo.fillLeft).toBeCloseTo(geo.panelBorder, 1);
  expect(geo.fillRight).toBeCloseTo(geo.panelBorder, 1);
  expect(geo.nameInset).toBeCloseTo(geo.padLeft, 1);
  expect(geo.checkInset).toBeCloseTo(geo.padRight, 1);

  // 未选中行不受影响：零底色 + 零横向溢出（清单是滚动容器）
  expect(
    await menu
      .getByRole('option')
      .nth(1)
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe('rgba(0, 0, 0, 0)');
  const scroll = await menu
    .getByRole('listbox')
    .evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
  expect(scroll.sw).toBe(scroll.cw);

  // 搜索框现形后仍与弹层内缘保持 12px
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return el != null && el.contains(document.activeElement);
    },
    '[role="dialog"][aria-label="压缩模型"]',
  );
  await page.keyboard.press('x');
  // #950 载体：搜索盒 = placeholder input 的父（.chief-pick-search 类退役）。
  const search = menu.getByPlaceholder('搜索模型…');
  await expect(search).toBeVisible();
  const searchInset = await search.evaluate((el) => {
    const box = el.parentElement as HTMLElement;
    const panelEl = box.closest('[role="dialog"]') as HTMLElement;
    return (
      box.getBoundingClientRect().left -
      panelEl.getBoundingClientRect().left -
      parseFloat(getComputedStyle(panelEl).borderLeftWidth)
    );
  });
  expect(searchInset).toBeCloseTo(12, 1);
});

test('压缩模型 search is typeahead-only, same contract as the drawer picker (#756 续)', async ({
  page,
}) => {
  const { menu } = await openModelMenu(page);
  // 开面零搜索占位（不渲染，非透明）——与抽屉头 picker 同形单源
  await expect(menu.getByPlaceholder('搜索模型…')).toHaveCount(0);
  // 同抽屉面：等焦点落进面再打字（FloatingShell 移焦点是异步的）
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return el != null && el.contains(document.activeElement);
    },
    '[role="dialog"][aria-label="压缩模型"]',
  );
  // 可打印字符被面吃掉：框现形、预填该字符、焦点进 input、即刻过滤
  await page.keyboard.press('x');
  const search = menu.getByPlaceholder('搜索模型…');
  await expect(search).toBeVisible();
  await expect(search).toHaveValue('x');
  await expect(search).toBeFocused();
  // x 命中不了 canon 行与 provider → 默认行 + 空态
  await expect(menu.getByRole('option')).toHaveCount(1);
  await expect(menu.getByText('没有匹配的模型')).toBeVisible();
  // 收回律：清空 = 框收回、清单回全量
  await search.fill('');
  await expect(menu.getByPlaceholder('搜索模型…')).toHaveCount(0);
  await expect(menu.getByRole('option')).toHaveCount(2);
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
  await menu.getByRole('option').nth(1).click();
  await expect(modelMenu(page)).toBeHidden();
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
    const select = modelSelect(page);
    await expect(select).toContainText('anthropic/claude-3-5-haiku-20241022');
    await expect(select).toHaveAttribute('title', 'anthropic/claude-3-5-haiku-20241022');
    const box = await select.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(202);
    // #950 载体：值 span = 触发钮内唯一 span（chevron 是 svg）。
    const clipped = await select
      .locator('span')
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
  // #950 载体：空态卡 = 卡内文案本身（en locale 面；.chief-memo/.chief-watches
  // 类退役，文本直挂卡 div）。
  for (const [scenario, copy] of [
    ['103', /No Agent selected yet/],
    ['104', /Nothing being watched yet/],
  ] as const) {
    await page.goto(`/app?scenario=${scenario}`);
    const card = page.getByText(copy);
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
  const select = modelSelect(page);
  await expect(select).toContainText('anthropic/claude-3-5-haiku-20241022');
  await select.click();
  const menu = modelMenu(page);
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('option')).toHaveCount(2);
  await expect(menu.getByRole('option', { selected: true })).toHaveCount(0);
  await menu.getByRole('option').nth(1).click();
  await expect(modelMenu(page)).toBeHidden();
  // fixture 面无 mutation:兜底裸串回显保持。
  await expect(select).toContainText('anthropic/claude-3-5-haiku-20241022');
});

// —— #895 主力机槽（spec 21 A6）:Agent tab「机器」行 ChiefMachineSelect ——
// 失败方式(先于实现固化):
// 1. 槽缺位:主力机没有设定入口 → Agent tab 必须有「机器」行(标题 + 描述
//    + chip);
// 2. 回显缺位/悬空崩:值 = null 显示「自动」,命中行集显示机器名(离线机器
//    如实显示灰点,不空白不崩);
// 3. 清单缺位:popover 必须有「自动」行 + 机器行(listbox 语义),选中行
//    aria-selected;
// 4. accept 律破坏:fixture 选定 = 关面(无 mutation,回显不变);
// 5. 双选择器互扰:机器 chip 独立 aria-label,不与压缩模型触发钮撞 strict
//    mode 选择器（#950 前是独立类名，律随载体迁移）。
// live PATCH 写读回归归 live 真机验(docs/verify/865/)。

// #950 载体：机器触发钮 = role + aria-label「机器」；菜单 = dialog + 可及名。
const machineSelect = (page: Page) => page.getByRole('button', { name: '机器' });
const machineMenu = (page: Page) => page.getByRole('dialog', { name: '机器' });

async function openMachineMenu(page: Page, scenario: string) {
  await page.goto(`/app?scenario=${scenario}`);
  const chip = machineSelect(page);
  await expect(chip).toBeVisible();
  await chip.click();
  const menu = machineMenu(page);
  await expect(menu).toBeVisible();
  return { chip, menu };
}

test('机器槽在位:Agent tab 有「机器」标题 + 描述 + chip(值 null = 自动)', async ({ page }) => {
  await page.goto(AGENT_TAB);
  // #950 载体：卡 = heading「机器」；描述/触发钮各自语义载体。
  const head = page.getByRole('heading', { name: '机器' });
  await expect(head).toBeVisible();
  await expect(page.getByText('总管回合默认在哪台机器上执行')).toContainText(
    '总管回合默认在哪台机器上执行',
  );
  await expect(machineSelect(page)).toContainText('自动');
  // 互扰负向:压缩模型选择器仍是唯一「压缩模型」钮(strict mode 钉)。
  await expect(modelSelect(page)).toHaveCount(1);
});

test('机器 chip 开 popover:「自动」行 + 机器行 + listbox 语义 + 选中态', async ({ page }) => {
  const { chip, menu } = await openMachineMenu(page, '101-machines');
  await expect(chip).toContainText('xmonsMac-3574.local');
  // listbox 语义随清单容器（菜单壳只承几何，压缩模型 picker 同律）。
  await expect(menu.getByRole('listbox')).toBeVisible();
  await expect(menu.getByRole('option')).toHaveCount(3);
  // 首行 = 自动(未选中,因为值钉了本机);机器行命中 = 选中。
  await expect(menu.locator('[data-testid="chief-host-auto"]')).toHaveAttribute('aria-selected', 'false');
  const selected = menu.getByRole('option', { selected: true });
  await expect(selected).toHaveCount(1);
  await expect(selected).toContainText('xmonsMac-3574.local');
  // 离线远端行照常可选 + 如实灰点(钉选 = 等它上线语义,UI 不替用户挡;
  // data-on 属性载体随迁存活)。
  const offline = menu.locator('[data-testid="chief-host-row"]').filter({ hasText: 'mea-wsl' });
  await expect(offline).toHaveAttribute('aria-selected', 'false');
  await expect(offline.locator('[data-on]')).toHaveAttribute('data-on', 'false');
});

test('机器 popover family law: Escape / outside click dismiss', async ({ page }) => {
  let menu = (await openMachineMenu(page, '101-machines')).menu;
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();

  menu = (await openMachineMenu(page, '101-machines')).menu;
  await page.mouse.click(20, 20);
  await expect(menu).toBeHidden();
});

test('机器 chip fixture pick = accept 律:选择即关 + 回显不变(无 mutation)', async ({ page }) => {
  const { chip, menu } = await openMachineMenu(page, '101-machines');
  await menu.locator('[data-testid="chief-host-auto"]').click();
  await expect(machineMenu(page)).toBeHidden();
  // fixture 面无 mutation:回显保持 canon 钉选值。
  await expect(chip).toContainText('xmonsMac-3574.local');
});

test('机器槽默认面(101):无 resources → 清单仅「自动」行且选中', async ({ page }) => {
  const { menu } = await openMachineMenu(page, '101');
  await expect(menu.getByRole('option')).toHaveCount(1);
  await expect(menu.locator('[data-testid="chief-host-auto"]')).toHaveAttribute('aria-selected', 'true');
});

// —— #903 派发方式槽(ADR 0013):Agent tab「派发方式」行 ChiefDispatchSelect ——
// 失败方式(先于实现固化):
// 1. 槽缺位:plan/直执行选择权没有设定入口 → Agent tab 必须有「派发方式」行
//    (标题 + 描述 + 触发钮);
// 2. 默认档回显错:fixture 缺省必须 = 「先规划」(ADR 0013 默认档——缺省面
//    不绕 confirm 闸);101-direct-dispatch 场景回显「直接执行」;
// 3. 清单缺位:popover 必须有两行 先规划/直接执行(listbox 语义),选中行
//    aria-selected;
// 4. accept 律破坏:fixture 选定 = 关面(无 mutation,回显不变);
// 5. 双选择器互扰:派发方式触发钮独立 aria-label,不与机器/压缩模型撞
//    strict mode 选择器。
// live PATCH 写读回归 + 服务端强制(run_builds clamp)归 live 真机验
// (docs/verify/903/)。

// 载体：触发钮 = role + aria-label「派发方式」；菜单 = dialog + 可及名（机器
// 选择器同律）。
const dispatchSelect = (page: Page) => page.getByRole('button', { name: '派发方式' });
const dispatchMenu = (page: Page) => page.getByRole('dialog', { name: '派发方式' });

async function openDispatchMenu(page: Page, scenario: string) {
  await page.goto(`/app?scenario=${scenario}`);
  const chip = dispatchSelect(page);
  await expect(chip).toBeVisible();
  await chip.click();
  const menu = dispatchMenu(page);
  await expect(menu).toBeVisible();
  return { chip, menu };
}

test('派发方式槽在位:Agent tab 有「派发方式」标题 + 描述 + 默认回显「先规划」(#903)', async ({
  page,
}) => {
  await page.goto(AGENT_TAB);
  await expect(page.getByRole('heading', { name: '派发方式' })).toBeVisible();
  await expect(page.getByText('总管派发任务时是否先出方案')).toContainText(
    '总管派发任务时是否先出方案',
  );
  await expect(dispatchSelect(page)).toContainText('先规划');
  // 互扰负向:机器/压缩模型触发钮仍各自唯一命名(strict mode 钉)。
  await expect(machineSelect(page)).toHaveCount(1);
  await expect(modelSelect(page)).toHaveCount(1);
});

test('派发方式 chip 开 popover:两行 + listbox 语义 + 选中态跟值(#903)', async ({ page }) => {
  const { menu } = await openDispatchMenu(page, '101');
  await expect(menu.getByRole('listbox')).toBeVisible();
  await expect(menu.getByRole('option')).toHaveCount(2);
  await expect(menu.getByRole('option').nth(0)).toContainText('先规划');
  await expect(menu.getByRole('option').nth(0)).toHaveAttribute('aria-selected', 'true');
  await expect(menu.getByRole('option').nth(1)).toContainText('直接执行');
  await expect(menu.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'false');
});

test('派发方式直执行面(101-direct-dispatch):回显「直接执行」+ 选中态翻行(#903)', async ({
  page,
}) => {
  const { chip, menu } = await openDispatchMenu(page, '101-direct-dispatch');
  await expect(chip).toContainText('直接执行');
  await expect(menu.getByRole('option').nth(0)).toHaveAttribute('aria-selected', 'false');
  await expect(menu.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
});

test('派发方式 popover family law: Escape / outside click dismiss(#903)', async ({ page }) => {
  let menu = (await openDispatchMenu(page, '101')).menu;
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();

  menu = (await openDispatchMenu(page, '101')).menu;
  await page.mouse.click(20, 20);
  await expect(menu).toBeHidden();
});

test('派发方式 fixture pick = accept 律:选择即关 + 回显不变(无 mutation)(#903)', async ({
  page,
}) => {
  const { chip, menu } = await openDispatchMenu(page, '101');
  await menu.locator('[data-testid="chief-dispatch-row"]').filter({ hasText: '直接执行' }).click();
  await expect(dispatchMenu(page)).toBeHidden();
  // fixture 面无 mutation:回显保持默认档。
  await expect(chip).toContainText('先规划');
});
