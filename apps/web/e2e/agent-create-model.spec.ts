import { expect, type Page, test } from '@playwright/test';

// 创建 Agent 弹窗的模型槽两级选择（t-0024 诉求 2）：先选运行时/服务商
// （一级 = provider 维，候选分组自 toModelOptions 的 provider 位），再选它名下
// 的具体模型（二级按一级过滤）。改前是单个平铺下拉（`provider · 模型名` 混在
// 一列），用户原话「全部混杂在一起，只有一个模型的方框」。
// 原版两态保留（r2 §8.1 capture 20 + r3 §2）：无服务商 = 告警行 + `配置服务商`
// 外链；有服务商 = 弹窗内两级选择，全程不跳页。
//
// 每条断言钉一个失败方式：
// 1. 有服务商时仍报「尚未配置模型服务商」（写死告警行的退形）
// 2. 有服务商时没有一级运行时选择器（退回单框平铺）
// 3. 未选运行时模型选择器就能点（两级退成一级，候选又混回一列）
// 4. 选过运行时后模型菜单仍混着别家的模型（过滤没生效）
// 5. 模型行又带上 provider 徽标或编造上下文窗口数字（`· 128k`）
// 6. 切换运行时后旧模型残留进 POST body（跨 provider 的 modelId 是脏值）
// 7. 只选运行时提交丢 provider（半态没带上）
// 8. 选齐提交 POST body 不带 provider/modelId（选了个寂寞）
// 9. 菜单被底栏压住 / 越出弹窗体裁剪盒（几何；XMON-39 前车）
//
// 有服务商态用 fixture 场景 'agent-detail'（resources.providers 带 r3-gw 一条
// 与 claude-sonnet-5 一模型）；无服务商态沿用 r7 捕获场景 '12'（无 resources）；
// 双服务商隔离态走 stubLive 的 twoProviders。
const TEAM_WITH_PROVIDERS = '/app/team?scenario=agent-detail';
const TEAM_NO_PROVIDERS = '/app/team?scenario=12';

/** live 启动面（fixture build 下不带 scenario 参数即 live）——只放行被测面
 *  需要的几条读面，其余 GET 一律 500（skills-readonly.spec 的 stubBoot 同律；
 *  Playwright 路由匹配序 = 注册逆序，这里用单条路由内分派避免顺序陷阱）。 */
const TEAM_ID = 'team-1';

async function stubLive(
  page: Page,
  opts: { hasProviders: boolean; bodies: unknown[]; models?: Array<{ id: string; name: string }>; twoProviders?: boolean },
) {
  await page.route('**/api/**', (route, request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() === 'POST' && path === `/api/teams/${TEAM_ID}/agents`) {
      opts.bodies.push(JSON.parse(request.postData() ?? '{}'));
      return route.fulfill({ status: 201, json: { id: 'agent-new' } });
    }
    if (request.method() !== 'GET') return route.fallback();
    if (path === '/api/teams') {
      return route.fulfill({
        json: [{ id: TEAM_ID, name: 'Team', createdAt: 0, plan: 'free', avatarStyle: null }],
      });
    }
    if (path === '/api/user/me') {
      return route.fulfill({ json: { id: 'user-1', displayName: '我', avatarUrl: null } });
    }
    if (path === `/api/teams/${TEAM_ID}/members`) {
      return route.fulfill({ json: [] });
    }
    if (path === `/api/teams/${TEAM_ID}/providers`) {
      const providers = opts.hasProviders
        ? [
            {
              kind: 'custom',
              providerId: 'r3-gw',
              label: 'r3-gw',
              baseUrl: 'https://gw.example/v1',
              api: 'anthropic-messages',
              authHeader: true,
              compat: { supportsDeveloperRole: false },
              models: opts.models ?? [{ id: 'claude-sonnet-5', name: 'claude-sonnet-5' }],
              id: 'prov-1',
              createdBy: 'user-1',
              createdAt: 0,
              updatedAt: 0,
            },
            ...(opts.twoProviders
              ? [
                  {
                    kind: 'custom',
                    providerId: 'b-gw',
                    label: 'b-gw',
                    baseUrl: 'https://b.example/v1',
                    api: 'anthropic-messages',
                    authHeader: true,
                    compat: { supportsDeveloperRole: false },
                    models: [{ id: 'deepseek-v4-pro', name: 'deepseek-v4-pro' }],
                    id: 'prov-2',
                    createdBy: 'user-1',
                    createdAt: 0,
                    updatedAt: 0,
                  },
                ]
              : []),
          ]
        : [];
      return route.fulfill({ json: { presets: [], providers } });
    }
    if (path === `/api/teams/${TEAM_ID}/model-sources`) {
      return route.fulfill({ json: { sources: [] } });
    }
    return route.fulfill({ status: 500, json: { error: 'e2e stub: not the surface under test' } });
  });
}

async function openDialog(page: Page, teamUrl: string) {
  await page.goto(teamUrl);
  await page.locator('.team-create-agent').click();
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  return dialog;
}

test('无服务商：报告警行并给「配置服务商」外链，两级选择器都不出', async ({ page }) => {
  const dialog = await openDialog(page, TEAM_NO_PROVIDERS);
  await expect(dialog.locator('.dlg-agent-warn')).toBeVisible();
  await expect(dialog.locator('.dlg-agent-configure')).toBeVisible();
  await expect(dialog.locator('.dlg-agent-model-select')).toHaveCount(0);
  await expect(dialog.locator('.dlg-agent-runtime-select')).toHaveCount(0);
});

test('有服务商：不出告警行，出两级选择器且模型级先禁用', async ({ page }) => {
  const dialog = await openDialog(page, TEAM_WITH_PROVIDERS);
  await expect(dialog.locator('.dlg-agent-warn')).toHaveCount(0);
  await expect(dialog.locator('.dlg-agent-runtime-select')).toBeVisible();
  // 未选运行时模型级不可点——两级退成一级就是「候选又混回一列」的退形。
  await expect(dialog.locator('.dlg-agent-model-select')).toBeDisabled();
});

test('一级列服务商与内置清空行，二级只列所选服务商的模型', async ({ page }) => {
  await stubLive(page, { hasProviders: true, bodies: [], twoProviders: true });
  const dialog = await openDialog(page, '/app/team');
  await dialog.locator('.dlg-agent-runtime-select').click();
  const runtimeMenu = dialog.locator('.dlg-agent-runtime-menu');
  await expect(runtimeMenu).toBeVisible();
  // 首行恒是「内置 (pi)」清空行（provider null 的显示形，与详情概览运行时档同词）。
  await expect(runtimeMenu.locator('.dlg-agent-runtime-row').first()).toContainText('内置 (pi)');
  await expect(runtimeMenu.locator('.dlg-agent-runtime-row', { hasText: 'r3-gw' })).toHaveCount(1);
  await expect(runtimeMenu.locator('.dlg-agent-runtime-row', { hasText: 'b-gw' })).toHaveCount(1);
  // 选 r3-gw 后模型菜单只有 r3-gw 的模型——b-gw 的模型不得混进来。
  await dialog.locator('.dlg-agent-runtime-row', { hasText: 'r3-gw' }).click();
  await dialog.locator('.dlg-agent-model-select').click();
  const modelMenu = dialog.locator('.dlg-agent-model-menu');
  await expect(modelMenu).toBeVisible();
  await expect(modelMenu.locator('.dlg-agent-model-row', { hasText: 'claude-sonnet-5' })).toHaveCount(1);
  await expect(modelMenu).not.toContainText('deepseek-v4-pro');
});

test('模型行只出模型名：不带 provider 徽标、不编造上下文窗口数字', async ({ page }) => {
  const dialog = await openDialog(page, TEAM_WITH_PROVIDERS);
  await dialog.locator('.dlg-agent-runtime-select').click();
  await dialog.locator('.dlg-agent-runtime-row', { hasText: 'r3-gw' }).click();
  await dialog.locator('.dlg-agent-model-select').click();
  const menu = dialog.locator('.dlg-agent-model-menu');
  const row = menu.locator('.dlg-agent-model-row', { hasText: 'claude-sonnet-5' });
  await expect(row).toHaveCount(1);
  // provider 已是一级，行内不再重复；原版 `· 128k` 是内置目录的窗口数，本仓无此数据源。
  await expect(row).not.toContainText('r3-gw');
  await expect(menu).not.toContainText('128k');
});

// 几何钉：两级菜单都向上展开（模型槽是表单最后一个字段，向下必被底栏压住；
// 运行时槽在它上一格，同律向上），且菜单体不得与底栏相交、不得越出弹窗体
// 裁剪盒（存在性断言看不出被压住；XMON-39 前车）。
test('创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何）', async ({ page }) => {
  const dialog = await openDialog(page, TEAM_WITH_PROVIDERS);
  const body = await dialog.locator('.dlg-body').boundingBox();
  const foot = await dialog.locator('.dlg-form-foot').boundingBox();
  expect(body).not.toBeNull();
  expect(foot).not.toBeNull();
  if (body === null || foot === null) return;

  await dialog.locator('.dlg-agent-runtime-select').click();
  const runtimeMenu = dialog.locator('.dlg-agent-runtime-menu');
  await expect(runtimeMenu).toBeVisible();
  const rb = await runtimeMenu.boundingBox();
  expect(rb).not.toBeNull();
  if (rb !== null) {
    expect(rb.y + rb.height <= foot.y || rb.y >= foot.y + foot.height).toBe(true);
    expect(rb.y).toBeGreaterThanOrEqual(body.y - 0.5);
    expect(rb.y + rb.height).toBeLessThanOrEqual(body.y + body.height + 0.5);
  }
  await dialog.locator('.dlg-agent-runtime-row', { hasText: 'r3-gw' }).click();

  await dialog.locator('.dlg-agent-model-select').click();
  const modelMenu = dialog.locator('.dlg-agent-model-menu');
  await expect(modelMenu).toBeVisible();
  const mb = await modelMenu.boundingBox();
  expect(mb).not.toBeNull();
  if (mb === null) return;
  expect(mb.y + mb.height <= foot.y || mb.y >= foot.y + foot.height).toBe(true);
  expect(mb.y).toBeGreaterThanOrEqual(body.y - 0.5);
  expect(mb.y + mb.height).toBeLessThanOrEqual(body.y + body.height + 0.5);
  // 菜单整个落在视口内（别修好压住、换成溢出到屏幕外）。
  expect(mb.y).toBeGreaterThanOrEqual(0);
  expect(mb.x).toBeGreaterThanOrEqual(0);
  expect(mb.x + mb.width).toBeLessThanOrEqual(1440);
});

// XMON-39 模型很多时的显示区域：菜单向上展开，而它的 containing block（触发钮
// 的 wrap）在 `.dlg-body` 这个 overflow-y:auto 的滚动盒里——菜单一旦比触发钮到
// body 上缘的距离还高，超出的那截就被裁掉。两级化后模型槽上方多了一格运行时
// 行，这段距离只增不减，封顶值仍须落在盒内。
//
// 每条断言钉一个失败方式：
// 1. 菜单越出 .dlg-body 的裁剪盒（越出部分不可见不可点）
// 2. 首行模型点不中 —— 前几个模型选不了
// 3. 用「截短列表」消灭 bug —— 行数与候选数不符（死规矩：所有模型仍须可见可选）
// 4. 菜单封顶后仍能滚到最后一行 —— 修好压住、换成「只露前几行、后面的够不着」
const MANY_MODELS = Array.from({ length: 40 }, (_, i) => {
  const id = `vendor/model-${String(i + 1).padStart(2, '0')}`;
  return { id, name: id };
});

test('模型很多：选过运行时后菜单不越出裁剪盒，首行可点，40 行一个不少', async ({ page }) => {
  await stubLive(page, { hasProviders: true, bodies: [], models: MANY_MODELS });
  const dialog = await openDialog(page, '/app/team');
  await dialog.locator('.dlg-agent-runtime-select').click();
  await dialog.locator('.dlg-agent-runtime-row', { hasText: 'r3-gw' }).click();
  await dialog.locator('.dlg-agent-model-select').click();
  const menu = dialog.locator('.dlg-agent-model-menu');
  await expect(menu).toBeVisible();

  const mb = await menu.boundingBox();
  const bb = await dialog.locator('.dlg-body').boundingBox();
  expect(mb).not.toBeNull();
  expect(bb).not.toBeNull();
  if (mb === null || bb === null) return;
  expect(mb.y).toBeGreaterThanOrEqual(bb.y - 0.5);
  expect(mb.y + mb.height).toBeLessThanOrEqual(bb.y + bb.height + 0.5);

  // 行数 = 候选数 + 1（首位恒是「未设置模型」清空行）——不许靠删行/截短藏 bug
  await expect(dialog.locator('.dlg-agent-model-row')).toHaveCount(MANY_MODELS.length + 1);

  // 被裁的那几行正是列表开头：点第一个模型，看它是否真选得上
  const firstModel = dialog.locator('.dlg-agent-model-row', { hasText: 'vendor/model-01' });
  await firstModel.click({ timeout: 5000 });
  await expect(dialog.locator('.dlg-agent-model-select')).toContainText('vendor/model-01');

  // 末行仍够得着（封顶后的滚动是可达性，不是摆设）
  await dialog.locator('.dlg-agent-model-select').click();
  const rows = dialog.locator('.dlg-agent-model-row');
  await rows.nth(MANY_MODELS.length).click({ timeout: 5000 });
  await expect(dialog.locator('.dlg-agent-model-select')).toContainText('vendor/model-40');
});

test('选齐运行时与模型后提交，POST body 带 provider 与 modelId', async ({ page }) => {
  const bodies: unknown[] = [];
  await stubLive(page, { hasProviders: true, bodies });
  const dialog = await openDialog(page, '/app/team');
  await dialog.locator('#dlg-agent-name').fill('带模型的 agent');
  await dialog.locator('.dlg-agent-runtime-select').click();
  await dialog.locator('.dlg-agent-runtime-row', { hasText: 'r3-gw' }).click();
  await dialog.locator('.dlg-agent-model-select').click();
  await dialog.locator('.dlg-agent-model-row', { hasText: 'claude-sonnet-5' }).click();
  await dialog.locator('.dlg-agent-create').click();
  await expect(page.locator('.dlg')).toBeHidden();
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toMatchObject({
    displayName: '带模型的 agent',
    provider: 'r3-gw',
    modelId: 'claude-sonnet-5',
  });
});

test('只选运行时提交：body 带 provider、modelId 为 null（半态不丢字段）', async ({ page }) => {
  const bodies: unknown[] = [];
  await stubLive(page, { hasProviders: true, bodies });
  const dialog = await openDialog(page, '/app/team');
  await dialog.locator('#dlg-agent-name').fill('半态 agent');
  await dialog.locator('.dlg-agent-runtime-select').click();
  await dialog.locator('.dlg-agent-runtime-row', { hasText: 'r3-gw' }).click();
  await dialog.locator('.dlg-agent-create').click();
  await expect(page.locator('.dlg')).toBeHidden();
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toMatchObject({ displayName: '半态 agent', provider: 'r3-gw', modelId: null });
});

test('切换运行时清掉旧模型：body 不带跨 provider 的脏 modelId', async ({ page }) => {
  const bodies: unknown[] = [];
  await stubLive(page, { hasProviders: true, bodies, twoProviders: true });
  const dialog = await openDialog(page, '/app/team');
  await dialog.locator('#dlg-agent-name').fill('换运行时 agent');
  await dialog.locator('.dlg-agent-runtime-select').click();
  await dialog.locator('.dlg-agent-runtime-row', { hasText: 'r3-gw' }).click();
  await dialog.locator('.dlg-agent-model-select').click();
  await dialog.locator('.dlg-agent-model-row', { hasText: 'claude-sonnet-5' }).click();
  // 换到 b-gw：r3-gw 名下的 claude-sonnet-5 必须被清掉（modelId 只在 provider 内
  // 有意义，带过去就是脏值）。
  await dialog.locator('.dlg-agent-runtime-select').click();
  await dialog.locator('.dlg-agent-runtime-row', { hasText: 'b-gw' }).click();
  await expect(dialog.locator('.dlg-agent-model-select')).not.toContainText('claude-sonnet-5');
  await dialog.locator('.dlg-agent-create').click();
  await expect(page.locator('.dlg')).toBeHidden();
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toMatchObject({ provider: 'b-gw', modelId: null });
});
