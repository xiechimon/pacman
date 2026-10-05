import { expect, type Locator, type Page, test } from '@playwright/test';

// Agent 详情编辑面（原版实测形态：r3-protocol-executor.md §4 —— 团队页点 Agent
// 卡进 `/app/resources/agents/<id>?name=<名>`，三 tab 概览/记忆/权限；C17 捕获 ✓）。
// 本仓此前没有任何 Agent 详情页实现，团队页的 .team-agent-card 是纯 div。
//
// 每条断言钉一个失败方式：
// 1. 团队页的 Agent 卡是死面 —— 点它不导航（当前就是 div，无 onClick）
// 2. 详情路由不存在 —— 直链落 catch-all 重定向回 /app
// 3. 三 tab 不切换 —— 点「记忆」内容区不变
// 4. 名称不可编辑 —— 行内编辑提交后回显旧值
// 5. 职责位不渲染 canon 空态「未设置职责」
// 6. 模型选择器不列选项 —— 打开后菜单为空
// 7. 思考强度不是只读值行（原版 r3 §4 观测值恒「默认」）——XMON-18 之后这条同时
//    看住它的存在：档位交给 agent 编排不等于把这行藏起来
// 7b. 概览长回了「状态」行（XMON-18 已撤；撤行留空壳同判失败）
// 8. 记忆空态文案与 shared canon 不一致
// 9. 权限面工具开关不足 6 个（r3 §4 全 list）
// 10. MCP 服务器逐个勾选行不渲染
// 11. 未知 agent id 白屏（拿不到记录时没有回退呈现）
//
// #499 续（记忆 tab 搜索/排序 + 两行的编辑图标），每条断言钉一个失败方式：
// 12. 记忆 tab 没有配额头 —— `记忆 · n / 100` 不出（或 n 取了过滤后的条数）
// 13. 搜索框缺失，或过滤是死面（打字后行数不变）
// 14. 搜索只扫 title，content 命中不出行
// 15. 搜索对 ASCII 大小写敏感（`probe` 找不到 `PROBE`）
// 16. 零命中回落「尚无记忆」canon 空态 —— 把「搜不到」说成「一条都没有」
// 17. `添加时间` 档不排序（行序停在到达序）
// 18. 排序把搜索条件吃掉（选中排序项后过滤集变回全量）
// 19. 名称沿用裸文本钮、没有编辑图标（点不出可点感）
// 20. 职责的编辑钮丢了图标（退回文字钮），或图标钮没有可访问名
//
// XMON-15 续（概览「进行中」段），每条断言钉一个失败方式：
// 21. 零在跑任务时也出计数（`进行中 · 0`），或空态不出 canon 文案
// 22. 有在跑任务时行数不对 / 行内四个位（序号、标题、chip、箭头）缺位
// 23. 等机器的一行 chip 不吃 `queued` 档（回落 todo.phase 时同值，
//     但 conditional 被删掉后行为会随 phase 漂移）
// 24. 行不是入口 —— 点了不导航到任务详情
//
// fixture 场景 = 'agent-detail'：TEAM_R7 的 r3-builder 卡 + 该 agent 的完整
// 记录（字段 = r3 §4 实测样本原样）+ resources 行集。
// 'agent-detail-memory' = 同一 agent 的 3 条记忆（记忆 tab 搜索/排序用）。
// 'agent-detail-active' = 同一 agent 的两行在跑 build（概览「进行中」段）。
const DETAIL = '/app/resources/agents/r3-builder?scenario=agent-detail';
const MEMORY_DETAIL = '/app/resources/agents/r3-builder?scenario=agent-detail-memory';
const TEAM = '/app/team?scenario=agent-detail';

async function openDetail(page: Page) {
  await page.goto(DETAIL);
  return page.locator('.agent-detail');
}

async function openMemory(page: Page) {
  await page.goto(MEMORY_DETAIL);
  const detail = page.locator('.agent-detail');
  await detail.locator('.agent-tab').nth(1).click();
  return detail;
}

/** 记忆行标题（按 DOM 序），用于钉排序。 */
async function memoryTitles(page: Page): Promise<string[]> {
  return page.locator('.agent-memory-title').allTextContents();
}

test('团队页的 Agent 卡是链接，点击落到详情路由', async ({ page }) => {
  await page.goto(TEAM);
  await page.locator('.team-agent-card', { hasText: 'r3-builder' }).click();
  await expect(page).toHaveURL(DETAIL);
  await expect(page.locator('.agent-detail')).toBeVisible();
});

test('详情路由直链可打开，不落 catch-all', async ({ page }) => {
  const detail = await openDetail(page);
  await expect(detail).toBeVisible();
  await expect(page.locator('.res-title')).toHaveText('r3-builder');
});

test('三 tab 齐在，概览默认选中，点记忆切内容', async ({ page }) => {
  const detail = await openDetail(page);
  const tabs = detail.locator('.agent-tab');
  await expect(tabs).toHaveCount(3);
  await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
  await expect(detail.locator('.agent-overview')).toBeVisible();

  await tabs.nth(1).click();
  await expect(detail.locator('.agent-memories')).toBeVisible();
  await expect(detail.locator('.agent-overview')).toHaveCount(0);

  await tabs.nth(2).click();
  await expect(detail.locator('.agent-perms')).toBeVisible();
});

test('概览：名称行内编辑提交后回显新值', async ({ page }) => {
  const detail = await openDetail(page);
  await detail.locator('.agent-name').click();
  const input = detail.locator('#agent-name-input');
  await expect(input).toBeVisible();
  await input.fill('r3-renamed');
  await input.press('Enter');
  await expect(detail.locator('.agent-name')).toHaveText('r3-renamed');
});

test('概览：职责位渲染 canon 空态并可编辑', async ({ page }) => {
  const detail = await openDetail(page);
  await expect(detail.locator('.agent-role-text')).toHaveText('未设置职责');
  await detail.locator('.agent-role-edit').click();
  const input = detail.locator('#agent-role-input');
  await input.fill('负责构建与合并');
  await detail.locator('.agent-role-save').click();
  await expect(detail.locator('.agent-role-text')).toHaveText('负责构建与合并');
});

// t-0024 两级化：运行时档（一级 = provider 维）与模型档（二级按一级过滤）。
// fixture agent = 存量 provider 绑定（r3-gw / claude-sonnet-5）；#770 起 picker
// 候选只剩 claude-code 段——本组三件事：存量值裸串回显不断（R1）、一级不再列
// providers 分组、切到 runtime 源是单向门（选不回 provider）。
test('概览：存量 provider 绑定裸串回显，一级只列内置行与运行时源', async ({ page }) => {
  const detail = await openDetail(page);
  const runtimeTrigger = detail.locator('.agent-runtime-select');
  // 存量 provider 值命中不了候选 → 裸串 provider id 即名，不空白不崩。
  await expect(runtimeTrigger).toContainText('r3-gw');
  await runtimeTrigger.click();
  const runtimeMenu = detail.locator('.agent-runtime-menu');
  await expect(runtimeMenu).toBeVisible();
  // 首行恒是「内置 (pi)」清空行（provider null 的显示形）；providers 分组已除。
  await expect(runtimeMenu.locator('.agent-runtime-row').first()).toContainText('内置 (pi)');
  await expect(runtimeMenu.locator('.agent-runtime-row', { hasText: 'r3-gw' })).toHaveCount(0);
  await expect(runtimeMenu.locator('.agent-runtime-row', { hasText: 'Claude Code' })).toHaveCount(1);
  await page.keyboard.press('Escape');
  // 切到 Claude Code：二级换成它的模型（claude-haiku-4-5 只活在 claude-code
  // 段——它出现才证明二级真换了源）；切走后旧 provider 选不回来（单向门）。
  await detail.locator('.agent-runtime-select').click();
  await detail.locator('.agent-runtime-row', { hasText: 'Claude Code' }).click();
  await expect(detail.locator('.agent-runtime-select')).toContainText('Claude Code');
  await detail.locator('.agent-model-select').click();
  const menu = detail.locator('.agent-model-menu');
  await expect(menu).toBeVisible();
  await expect(menu.locator('.agent-model-row').first()).toHaveText(/未设置模型/);
  await expect(menu.locator('.agent-model-row', { hasText: 'claude-haiku-4-5' })).toHaveCount(1);
  await page.keyboard.press('Escape');
  await detail.locator('.agent-runtime-select').click();
  await expect(
    detail.locator('.agent-runtime-menu .agent-runtime-row', { hasText: 'r3-gw' }),
  ).toHaveCount(0);
});

// 几何钉：菜单贴触发钮右缘、向下展开，且整块留在内容列内。
// 只有几何断言能抓的前车之鉴（存在性/文案断言全绿）：
// · 漏 `.agent-model-wrap` 的 align-self → wrap 被 flex 列拉满宽 → 菜单飘到
//   离触发钮 400+px（散块布局期的故障）；
// · 锚错边 → 菜单从触发钮往**外**长，越过 `.res-col` 的缘（`.res-body`
//   overflow-x: hidden）被裁掉一截，模型名看不见。
// XMON-117 把触发钮从字段列左缘挪到模板行的**右缘**（个人页模板的值槽在
// 行右），锚边随之从左翻到右：左锚会让菜单往右长、出列右缘被裁——这正是
// 下面两条边界断言钉的。
test('概览：两级菜单贴触发钮右缘且在内容列内（几何）', async ({ page }) => {
  const detail = await openDetail(page);
  // 两缘都留在内容列内（列 = 768 宽居中；越出去就被裁）。
  const col = await detail
    .locator('xpath=ancestor::div[contains(@class,"res-col")]')
    .boundingBox();
  expect(col).not.toBeNull();
  if (col === null) return;
  // 一级运行时菜单与二级模型菜单同律：右锚贴触发钮右缘、向下展开。
  for (const prefix of ['agent-runtime', 'agent-model']) {
    const trigger = detail.locator(`.${prefix}-select`);
    await trigger.click();
    const menu = detail.locator(`.${prefix}-menu`);
    await expect(menu).toBeVisible();
    // V2 进场（#790 P3：scale .98 + fade 100ms）窗内量几何会吃到动画帧位移——
    // 静息锚距恰 8px（顶部锚距正本值），预算 ≤8 零余量。等进场播完再量，钉的是
    // 静息几何（旧 slide 面同理：位移只存在于窗内）。
    await page.waitForTimeout(150);
    const tb = await trigger.boundingBox();
    const mb = await menu.boundingBox();
    expect(tb).not.toBeNull();
    expect(mb).not.toBeNull();
    if (tb === null || mb === null) return;
    expect(Math.abs(mb.x + mb.width - (tb.x + tb.width))).toBeLessThanOrEqual(8);
    expect(Math.abs(mb.y - (tb.y + tb.height))).toBeLessThanOrEqual(8);
    expect(mb.x).toBeGreaterThanOrEqual(col.x - 1);
    expect(mb.x + mb.width).toBeLessThanOrEqual(col.x + col.width + 1);
    await page.keyboard.press('Escape');
  }
});

test('概览：思考强度是只读值行，无模型时显示「默认」', async ({ page }) => {
  const detail = await openDetail(page);
  const thinking = detail.locator('.agent-thinking');
  await expect(thinking).toHaveText('默认');
  await expect(thinking.locator('button')).toHaveCount(0);
});

// XMON-18（2026-10-01 裁决）：概览不再摆「状态」行——`agentStatusSchema` 只有
// 一个取值 active，摆出来零信息量。这条钉的是「别再长回来」，同时钉住撤行没留下
// 空壳（类名与标签都不得残留）。注意**思考强度那行要留着**（交给 agent 编排 ≠
// 藏起来），上面那条只读行断言就是它的看门人。
test('概览：不摆「状态」行', async ({ page }) => {
  const detail = await openDetail(page);
  expect(await detail.locator('.agent-field-label').allTextContents()).not.toContain('状态');
  await expect(detail.locator('.agent-status')).toHaveCount(0);
});

// 文案逐字 = shared `MEMORY_EMPTY_COPY`（records/memory.ts:18；e2e 不跨包取
// 常量，与仓内其它 spec 硬写 canon 文案同律）。
test('记忆 tab：空态文案与 shared canon 同文', async ({ page }) => {
  const detail = await openDetail(page);
  await detail.locator('.agent-tab').nth(1).click();
  await expect(detail.locator('.agent-memory-empty')).toHaveText(
    '尚无记忆。Agent 会在工作中将值得沉淀的经验存入此处。',
  );
});

// XMON-84 用户拍板 B：六开关全保留（四无本体档照常摆出，本体另立规划票）；
// 其中合并分支/推送分支两档有真实执法面（XMON-77 daemon/server 闸）。
test('权限 tab：6 个工具开关全渲染（r3 §4 全 list，XMON-84 恢复）', async ({ page }) => {
  const detail = await openDetail(page);
  await detail.locator('.agent-tab').nth(2).click();
  await expect(detail.locator('.agent-tool-switch')).toHaveCount(6);
});

// 六档说明副文案曾经只出「远程 shell」一条（r3 §4 的清单只记了那一档）；
// 直读原版权限 tab 后补全，六档各带一条，钉住不回落成一条。
test('权限 tab：6 档各带说明副文案', async ({ page }) => {
  const detail = await openDetail(page);
  await detail.locator('.agent-tab').nth(2).click();
  const hints = detail.locator('.agent-perm-group').first().locator('.agent-perm-hint');
  await expect(hints).toHaveCount(6);
  await expect(hints.nth(1)).toHaveText(
    '允许该 Agent 通过合并分支进行发布（例如将 develop 合并进 main）。',
  );
  await expect(hints.nth(5)).toHaveText('允许该 Agent 修改团队技能库中已有的技能。');
});

// 运行时档（原版概览在模型之上有这一档）：wire 无独立字段，值由 provider 位
// 派生——存量 provider 值命中不了候选，走裸串回显（直接出 id）。t-0024 起这一
// 档从只读行变成一级选择器（触发钮回读同词），行序仍在模型之上。
test('概览：运行时档在模型之上，值由 provider 派生', async ({ page }) => {
  const detail = await openDetail(page);
  const runtime = detail.locator('.agent-runtime-select');
  await expect(runtime).toContainText('r3-gw');
  const labels = detail.locator('.agent-field-label');
  const texts = await labels.allTextContents();
  expect(texts.indexOf('运行时')).toBeGreaterThan(-1);
  expect(texts.indexOf('运行时')).toBeLessThan(texts.indexOf('模型'));
});

test('权限 tab：工具开关可切换', async ({ page }) => {
  const detail = await openDetail(page);
  await detail.locator('.agent-tab').nth(2).click();
  const first = detail.locator('.agent-tool-switch').first();
  await expect(first).toHaveAttribute('aria-checked', 'false');
  await first.click();
  await expect(first).toHaveAttribute('aria-checked', 'true');
});

test('权限 tab：MCP 服务器逐个勾选行渲染', async ({ page }) => {
  const detail = await openDetail(page);
  await detail.locator('.agent-tab').nth(2).click();
  await expect(detail.locator('.agent-mcp-row').first()).toBeVisible();
});

// #510：密钥区粒度改回原版的「全有全无」——原版 Agent 权限 tab 是**一行**
// 「团队密钥 + 总说明 + 单个 switch」，不展开逐个密钥行（2026-09-30 直读
// 参考产品确认；密钥页的行菜单也只有编辑/删除，没有 per-Agent 矩阵）。
// 场景 agent-detail-secrets 播两个密钥：回退成 per-secret 粒度会渲染两行，
// 「恰好一行」才有牙（只播一个密钥时两种实现都过）。
const DETAIL_SECRETS = '/app/resources/agents/r3-builder?scenario=agent-detail-secrets';

test('权限 tab：有密钥时密钥区恰好一行总开关', async ({ page }) => {
  await page.goto(DETAIL_SECRETS);
  await page.locator('.agent-tab').nth(2).click();
  await expect(page.locator('.agent-secret-row')).toHaveCount(1);
  await expect(page.locator('.agent-secret-switch')).toHaveCount(1);
  await expect(page.locator('.agent-secret-name')).toHaveText('团队密钥');
  // 副文案 = shared AGENT_PERMISSION_COPY.secrets（原版权限 tab 同一句，品牌
  // 与最低 CLI 版本插值随常量走）；e2e 不跨包取常量，硬写 canon 文案。
  // XMON-15 顺手对齐：XMON-7（#508，142c6cb）把这条 canon 从「以环境变量
  // 注入 shell」改成「按需取用、不预置进 shell」，本断言没跟上，一直红着；
  // 现值抄自 packages/shared/src/records/agent.ts 的常量。
  await expect(page.locator('.agent-secret-hint')).toHaveText(
    '任务执行时，该 Agent 可在需要密钥的执行步中按需取用团队密钥，每次取用都会留下记录；密钥不预置进 shell 环境。所在机器需要 pacman CLI 0.1.28 及以上。',
  );
});

// 勾选态 = `agent.secrets` 非空（wire 的 string[] 表达得了全有全无，无新字段）。
test('权限 tab：密钥总开关勾选态开→关→回', async ({ page }) => {
  await page.goto(DETAIL_SECRETS);
  await page.locator('.agent-tab').nth(2).click();
  const sw = page.locator('.agent-secret-switch');
  await expect(sw).toHaveAttribute('aria-checked', 'false'); // 空集 = 关
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'true'); // 开 = 全 id 集
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'false'); // 关 = []
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'true'); // 回
});

// 零密钥时没有对象可授，出开关就是死控件（原版那行开关在零密钥时也渲染，
// 但它当时开关的是什么无法观测——不复刻看不出语义的控件，差异留 #510 票面）。
test('权限 tab：零密钥时是空态，无开关', async ({ page }) => {
  const detail = await openDetail(page);
  await detail.locator('.agent-tab').nth(2).click();
  await expect(detail.locator('.agent-perm-empty')).toHaveText('暂无团队密钥。');
  await expect(detail.locator('.agent-secret-switch')).toHaveCount(0);
  await expect(detail.locator('.agent-secret-row')).toHaveCount(0);
});

// —— XMON-80/P3：零密钥空态旁必须有出路 ——
// 钉住的失败方式：用户停在一句陈述句上，看不到「密钥在哪加」。创建入口本来
// 就在侧栏密钥页（SECRETS_HREF），本 tab 只是不链过去。
test('权限 tab：零密钥空态旁有去添加密钥的入口，点击落到密钥页', async ({ page }) => {
  const detail = await openDetail(page);
  await detail.locator('.agent-tab').nth(2).click();
  const entry = detail.locator('.agent-secret-add');
  await expect(entry).toBeVisible();
  await expect(entry).toHaveText('去添加密钥');
  await entry.click();
  await expect(page).toHaveURL(/\/app\/resources\/secrets/);
  await expect(page.locator('.res-title')).toHaveText('密钥');
});

// 有密钥时不摆这个入口：那行已经是真开关，再挂一条「去添加」就是同页两处
// 说同一件事（#510 的聚合行本身就是出口）。
test('权限 tab：有密钥时不出「去添加密钥」入口', async ({ page }) => {
  await page.goto(DETAIL_SECRETS);
  await page.locator('.agent-tab').nth(2).click();
  await expect(page.locator('.agent-secret-row')).toHaveCount(1);
  await expect(page.locator('.agent-secret-add')).toHaveCount(0);
});

// —— XMON-80/P2：保存失败必须有可见反馈 ——
// 钉住的失败方式：PATCH 返 500 时页面一声不吭（无 toast、无行内错误），用户
// 视角 = 点了没反应（XMON-78 实测）。本面无乐观更新，开关不动是对的；错的是
// 连「没保存成功」这件事都不说。
//
// live 面启动打桩（承 skills-readonly.spec 的 stubBoot 纪律）：teams / user me
// 是 teamId 来源、必须成功；其余 GET 一律 500——启动面查询失败 = 应用既有
// isError 耐受（data ?? [] 族）。page.route 匹配序 = 注册逆序：catch-all 先
// 注册，具体路由后注册才生效。URL 不带 ?scenario= 即 live 数据源（api/mode.ts
// 闸门：fixture build 里 scenario 参数缺席 = 真 API），故本 spec 能覆盖 live 面。
const LIVE_AGENT = {
  id: 'agent-1',
  displayName: 'live-builder',
  description: null,
  status: 'active',
  avatarUrl: null,
  provider: null,
  modelId: null,
  thinkingLevel: null,
  tools: [],
  secrets: [],
  skills: [],
  mcpServers: [],
};

async function stubLiveBoot(page: Page) {
  await page.route('**/api/**', (route, request) => {
    if (request.method() !== 'GET') return route.fallback();
    return route.fulfill({ status: 500, json: { error: 'e2e stub: not the surface under test' } });
  });
  await page.route('**/api/teams', (route) =>
    route.fulfill({
      json: [{ id: 'team-1', name: 'Team', createdAt: 0, plan: 'free', avatarStyle: null }],
    }),
  );
  await page.route('**/api/user/me', (route) =>
    route.fulfill({ json: { id: 'user-1', displayName: '我', avatarUrl: null } }),
  );
}

test('权限 tab：保存失败出可见错误反馈，开关不回弹', async ({ page }) => {
  await stubLiveBoot(page);
  let patches = 0;
  await page.route('**/api/teams/team-1/agents/agent-1', (route) => {
    if (route.request().method() === 'PATCH') {
      patches += 1;
      return route.fulfill({ status: 500, json: { error: 'boom' } });
    }
    return route.fulfill({ json: LIVE_AGENT });
  });

  await page.goto('/app/resources/agents/agent-1');
  await page.locator('.agent-tab').nth(2).click();
  const sw = page.locator('.agent-tool-switch').first();
  await expect(sw).toHaveAttribute('aria-checked', 'false');

  await sw.click();
  // 前提守卫：请求真发出去了（否则「有反馈」测的是别的东西）。
  await expect.poll(() => patches).toBe(1);
  const error = page.locator('.agent-perm-error');
  await expect(error).toBeVisible();
  await expect(error).toHaveText('保存失败，请重试。');
  // 无乐观更新：失败后控件不停在开态（否则用户以为存上了）。
  await expect(sw).toHaveAttribute('aria-checked', 'false');
});

// 反向：保存成功不应留错误行——否则「有反馈」退化成一条永远挂着的红字。
test('权限 tab：保存成功不出错误行', async ({ page }) => {
  await stubLiveBoot(page);
  await page.route('**/api/teams/team-1/agents/agent-1', (route) => {
    if (route.request().method() === 'PATCH') return route.fulfill({ json: LIVE_AGENT });
    return route.fulfill({ json: LIVE_AGENT });
  });

  await page.goto('/app/resources/agents/agent-1');
  await page.locator('.agent-tab').nth(2).click();
  await page.locator('.agent-tool-switch').first().click();
  await expect(page.locator('.agent-perm-error')).toHaveCount(0);
});

test('未知 agent id 不白屏，走回退呈现', async ({ page }) => {
  await page.goto('/app/resources/agents/no-such-agent?scenario=agent-detail');
  await expect(page.locator('.agent-missing')).toBeVisible();
});

// —— #499：记忆 tab 的配额头、搜索与排序 ——

// 配额 = shared MEMORY_QUOTA_PER_AGENT（records/memory.ts:11），n = 该 Agent
// 的全部记忆条数（不是过滤后的条数——配额记的是存量，不是眼前的列表长度）。
test('记忆 tab：配额头 `记忆 · n / 100` 与搜索/排序控件齐在', async ({ page }) => {
  const detail = await openMemory(page);
  await expect(detail.locator('.agent-memory-head')).toHaveText('记忆 · 3 / 100');
  await expect(detail.locator('.agent-memory-search input')).toHaveAttribute(
    'placeholder',
    '搜索记忆…',
  );
  await expect(detail.locator('.agent-memory-sort')).toContainText('排序');
  await expect(detail.locator('.agent-memory-row')).toHaveCount(3);
});

test('记忆 tab：搜索按标题过滤，只留命中行', async ({ page }) => {
  const detail = await openMemory(page);
  await detail.locator('.agent-memory-search input').fill('历史轮次');
  await expect(detail.locator('.agent-memory-row')).toHaveCount(1);
  await expect(detail.locator('.agent-memory-title')).toHaveText('PROBE 探针的历史轮次');
});

// 一行一条失败方式：`probe` 只写在第 2 条的 content 里（标题没有），而第 3 条
// 的标题是 `PROBE`（全大写）——两条都命中才说明扫了 content 且大小写不敏感。
test('记忆 tab：搜索扫 content 且 ASCII 大小写不敏感', async ({ page }) => {
  const detail = await openMemory(page);
  await detail.locator('.agent-memory-search input').fill('probe');
  await expect(detail.locator('.agent-memory-row')).toHaveCount(2);
  expect(await memoryTitles(page)).toEqual(['验收只看真机跑通', 'PROBE 探针的历史轮次']);
});

// 零命中不是「这个 Agent 没有记忆」——回落 canon 空态等于篡改事实。
test('记忆 tab：零命中出「没有匹配的记忆。」，不回落 canon 空态', async ({ page }) => {
  const detail = await openMemory(page);
  await detail.locator('.agent-memory-search input').fill('不存在的词');
  await expect(detail.locator('.agent-memory-row')).toHaveCount(0);
  await expect(detail.locator('.agent-memory-no-match')).toHaveText('没有匹配的记忆。');
  await expect(detail.locator('.agent-memory-empty')).toHaveCount(0);
  // 配额头仍报存量 3（不是 0）。
  await expect(detail.locator('.agent-memory-head')).toHaveText('记忆 · 3 / 100');
});

// fixture 的列序是旧 → 新，`添加时间` 必须把它翻成新 → 旧；否则这一档是死面
// （选中后行序与 `默认` 一模一样）。
test('记忆 tab：`添加时间` 档按新 → 旧重排', async ({ page }) => {
  const detail = await openMemory(page);
  expect(await memoryTitles(page)).toEqual([
    '构建分支的命名规律',
    '验收只看真机跑通',
    'PROBE 探针的历史轮次',
  ]);
  await detail.locator('.agent-memory-sort').click();
  // #854 收编 dropdown-menu：面板 portal 到 body（不再挂 wrap 包含块），
  // 作用域收在 .agent-detail 里就找不到它了。
  await page.locator('.agent-memory-sort-menu .res-sort-row', { hasText: '添加时间' }).click();
  expect(await memoryTitles(page)).toEqual([
    'PROBE 探针的历史轮次',
    '验收只看真机跑通',
    '构建分支的命名规律',
  ]);
});

// 排序不得把搜索条件吃掉：过滤集留在原地，只在集合内重排。
test('记忆 tab：搜索与排序叠加——排序只在命中集内生效', async ({ page }) => {
  const detail = await openMemory(page);
  await detail.locator('.agent-memory-search input').fill('probe');
  await detail.locator('.agent-memory-sort').click();
  // #854 收编 dropdown-menu：面板 portal 到 body（不再挂 wrap 包含块），
  // 作用域收在 .agent-detail 里就找不到它了。
  await page.locator('.agent-memory-sort-menu .res-sort-row', { hasText: '添加时间' }).click();
  await expect(detail.locator('.agent-memory-row')).toHaveCount(2);
  expect(await memoryTitles(page)).toEqual(['PROBE 探针的历史轮次', '验收只看真机跑通']);
});

// 空列表（一条记忆都没有）时不摆搜索/排序控件——照 skills-page 的先例，空态
// 顶掉工具行（对着空集搜索没有意义）。
test('记忆 tab：零记忆时不出搜索行，保留 canon 空态', async ({ page }) => {
  const detail = await openDetail(page);
  await detail.locator('.agent-tab').nth(1).click();
  await expect(detail.locator('.agent-memory-empty')).toBeVisible();
  await expect(detail.locator('.agent-memory-search')).toHaveCount(0);
  await expect(detail.locator('.agent-memory-head')).toHaveText('记忆 · 0 / 100');
});

// —— #499：名称 / 职责两行的编辑图标 ——

test('概览：名称行带编辑图标，点图标同样进编辑态', async ({ page }) => {
  const detail = await openDetail(page);
  const icon = detail.locator('.agent-name-edit');
  await expect(icon).toBeVisible();
  await expect(icon).toHaveAttribute('aria-label', '编辑');
  await expect(icon.locator('svg')).toHaveCount(1);
  await icon.click();
  await expect(detail.locator('#agent-name-input')).toBeVisible();
});

test('概览：职责的编辑钮是图标钮，带可访问名', async ({ page }) => {
  const detail = await openDetail(page);
  const edit = detail.locator('.agent-role-edit');
  await expect(edit).toHaveAttribute('aria-label', '编辑');
  await expect(edit.locator('svg')).toHaveCount(1);
  await edit.click();
  await expect(detail.locator('#agent-role-input')).toBeVisible();
});

// —— XMON-15：概览「进行中」段 ——
// 形状正典 = shared agentTaskSchema 的注释（逐个字段的原件出处）；服务端过滤
// 判据的失败方式钉在 apps/server/test/m5-face.test.ts 的同名 describe。
// 段头与空态文案逐字 = 参考产品 web 包的 agent_modal.in_progress /
// no_active_tasks（后者经 i18n en.ts 映射为 'No active tasks'）。
// 两档：agent-detail 不带 agentTasks（canon 空态），agent-detail-active 带
// 两行 build（等机器 + 跑起来）。

test('概览：零在跑任务时段头不带计数，出 canon 空态', async ({ page }) => {
  const detail = await openDetail(page);
  await expect(detail.locator('.agent-tasks-head')).toHaveText('进行中');
  await expect(detail.locator('.agent-tasks-empty')).toHaveText('暂无进行中的任务');
  await expect(detail.locator('.agent-task-row')).toHaveCount(0);
});

test('概览：有在跑任务时列出行，段头带计数', async ({ page }) => {
  await page.goto(`${DETAIL.replace('agent-detail', 'agent-detail-active')}`);
  const detail = page.locator('.agent-detail');
  await expect(detail.locator('.agent-tasks-head')).toHaveText('进行中 · 2');
  await expect(detail.locator('.agent-tasks-empty')).toHaveCount(0);

  const rows = detail.locator('.agent-task-row');
  await expect(rows).toHaveCount(2);
  // 行 = #序号 + 标题 + 状态 chip + 右箭头（原件 TaskRow 的四个位）
  await expect(rows.nth(0).locator('.agent-task-seq')).toHaveText('#12');
  await expect(rows.nth(0).locator('.agent-task-title')).toHaveText(
    'README 文档目录 + 新建 CHANGELOG.md + scripts/',
  );
  // 等机器的一行 chip = `queued` 档的文案（待处理）
  await expect(rows.nth(0).locator('.chip')).toHaveText('待处理');
  // 跑起来的一行 chip 吃 todo.phase（building → 执行中）
  await expect(rows.nth(1).locator('.agent-task-seq')).toHaveText('#13');
  await expect(rows.nth(1).locator('.chip')).toHaveText('执行中');
  await expect(rows.nth(1).locator('.agent-task-go svg')).toHaveCount(1);
});

test('概览：点行进任务详情', async ({ page }) => {
  await page.goto(`${DETAIL.replace('agent-detail', 'agent-detail-active')}`);
  await page.locator('.agent-task-row').first().click();
  await expect(page).toHaveURL(/\/app\/todo\/r3-legacy-12$/);
});

// —— XMON-117：本页按 `/app/account` 的个人页模板复刻 ——
// 模板 = 一张 profile 卡（头像头 + 行式字段），三 tab 的内容都住在卡里。
// 钉住的失败方式：概览退回散块字段列（每个字段各自带 label，没有行盒与
// 分隔线）、头像头掉出卡外、记忆/权限两 tab 回到一张卡一行的散卡布局。
const OVERVIEW_LABELS = ['名称', '职责', '默认 skill', '运行时', '模型', '思考强度'];

test('概览：六个字段行长在同一张模板卡里，头像头在卡内', async ({ page }) => {
  const detail = await openDetail(page);
  const card = detail.locator('.agent-overview .profile-card');
  await expect(card).toHaveCount(1);
  await expect(card.locator('.profile-head .profile-avatar img')).toHaveCount(1);
  await expect(card.locator('.profile-row')).toHaveCount(OVERVIEW_LABELS.length);
  // 行序即字段序。取 `.profile-label-text`（模板自己的 label 类）而非面内
  // 别名：别名在、模板类不在，就是「只挂了句柄没吃模板」——正是要钉的退形。
  expect(await card.locator('.profile-label-text').allTextContents()).toEqual(OVERVIEW_LABELS);
});

test('记忆 tab：记忆行住在模板卡里', async ({ page }) => {
  const detail = await openMemory(page);
  const card = detail.locator('.agent-memories .profile-card');
  await expect(card).toHaveCount(1);
  await expect(card.locator('.profile-row.agent-memory-row')).toHaveCount(3);
});

test('权限 tab：三组开关各自住在模板卡里', async ({ page }) => {
  const detail = await openDetail(page);
  await detail.locator('.agent-tab').nth(2).click();
  const cards = detail.locator('.agent-perms .profile-card');
  await expect(cards).toHaveCount(3); // 工具 / 密钥 / MCP 服务器
  // 六档工具开关全在工具组的卡里（不靠散行的 .agent-perm-row 撑）
  await expect(cards.first().locator('.profile-row')).toHaveCount(6);
  await expect(cards.first().locator('.agent-tool-switch')).toHaveCount(6);
});

// 无头像头的卡（记忆 / 权限三组）首件直接是行，行是自带底色与 border-top 的
// 方盒。失败方式：行的方角把底色顶出卡的圆角外（卡片 overflow: visible 裁不
// 掉，肉眼是圆角处多一块方角），且那条 border-top 与卡的描边叠成 2px 的顶边。
test('记忆/权限卡：首行不吃卡的上圆角与描边（无方角外溢、无 2px 顶边）', async ({
  page,
}) => {
  const detail = await openMemory(page);
  // tab 是条件渲染，两面的首行要各读一次（切走就没了）
  const memoryFirst = detail.locator('.agent-memories .profile-card > .profile-row:first-child');
  await expect(memoryFirst).toHaveCount(1);
  await assertTopCorner(memoryFirst);

  await detail.locator('.agent-tab').nth(2).click();
  // 3 张权限卡：工具 / 密钥（零密钥时空态也是模板行）/ MCP 服务器
  const permFirst = detail.locator('.agent-perms .profile-card > .profile-row:first-child');
  await expect(permFirst).toHaveCount(3);
  await assertTopCorner(permFirst);
});

async function assertTopCorner(rows: Locator) {
  for (const row of await rows.all()) {
    const { topLeft, topBorder } = await row.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        topLeft: [cs.borderTopLeftRadius, cs.borderTopRightRadius],
        topBorder: cs.borderTopWidth,
      };
    });
    expect(topLeft).toEqual(['11px', '11px']);
    expect(topBorder).toBe('0px');
  }
}
