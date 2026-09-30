import { expect, type Page, test } from '@playwright/test';

// 创建 Agent 弹窗的模型选择（r2 §8.1 capture 20 + r3 §2 实测两态）：
// 原版在团队尚未配置服务商时出告警行 + `配置服务商` 外链（capture 20）；
// 配好服务商后同一弹窗出「模型」下拉，逐项 `r3-gw · 128k`（r3 §2）。
// 本仓此前把告警行写死——有服务商时也照报「尚未配置模型服务商」，且没有
// 任何模型位，用户只能在弹窗与模型服务页之间来回跳。
//
// 每条断言钉一个失败方式：
// 1. 有服务商时仍报「尚未配置模型服务商」（当前写死的告警行）
// 2. 有服务商时弹窗内没有模型选择器 —— 配置模型必须跳页
// 3. 无服务商时不报告警（空态反而沉默）
// 4. 选项标签编造原版内置目录的上下文窗口数字（`· 128k`；pacman 是本地
//    BYOK，没有这个数据源，标签只能出 provider · 模型名）
// 5. 选中模型后创建，POST body 不带 provider/modelId —— 选了个寂寞
//
// 有服务商态用 fixture 场景 'agent-detail'（resources.providers 带 r3-gw 一条
// 与 claude-sonnet-5 一模型）；无服务商态沿用 r7 捕获场景 '12'（无 resources）。
const TEAM_WITH_PROVIDERS = '/app/team?scenario=agent-detail';
const TEAM_NO_PROVIDERS = '/app/team?scenario=12';

/** live 启动面（fixture build 下不带 scenario 参数即 live）——只放行被测面
 *  需要的几条读面，其余 GET 一律 500（skills-readonly.spec 的 stubBoot 同律；
 *  Playwright 路由匹配序 = 注册逆序，这里用单条路由内分派避免顺序陷阱）。 */
const TEAM_ID = 'team-1';

async function stubLive(page: Page, opts: { hasProviders: boolean; bodies: unknown[] }) {
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
      return route.fulfill({
        json: {
          presets: [],
          providers: opts.hasProviders
            ? [
                {
                  kind: 'custom',
                  providerId: 'r3-gw',
                  label: 'r3-gw',
                  baseUrl: 'https://gw.example/v1',
                  api: 'anthropic-messages',
                  authHeader: true,
                  compat: { supportsDeveloperRole: false },
                  models: [{ id: 'claude-sonnet-5', name: 'claude-sonnet-5' }],
                  id: 'prov-1',
                  createdBy: 'user-1',
                  createdAt: 0,
                  updatedAt: 0,
                },
              ]
            : [],
        },
      });
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

test('无服务商：报告警行并给「配置服务商」外链（capture 20 原样）', async ({ page }) => {
  const dialog = await openDialog(page, TEAM_NO_PROVIDERS);
  await expect(dialog.locator('.dlg-agent-warn')).toBeVisible();
  await expect(dialog.locator('.dlg-agent-configure')).toBeVisible();
  await expect(dialog.locator('.dlg-agent-model-select')).toHaveCount(0);
});

test('有服务商：不出告警行，弹窗内直接出模型选择器', async ({ page }) => {
  const dialog = await openDialog(page, TEAM_WITH_PROVIDERS);
  await expect(dialog.locator('.dlg-agent-model-select')).toBeVisible();
  await expect(dialog.locator('.dlg-agent-warn')).toHaveCount(0);
});

test('模型选择器列出 provider 与模型名，不编造上下文窗口数字', async ({ page }) => {
  const dialog = await openDialog(page, TEAM_WITH_PROVIDERS);
  await dialog.locator('.dlg-agent-model-select').click();
  // 首行恒是「未设置模型」清空行；模型行按 provider 定位（同模型 id 可能在
  // providers 与 claude-code 段各一行，见 toModelOptions 并集语义）。
  const row = dialog.locator('.dlg-agent-model-row', { hasText: 'r3-gw' });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('claude-sonnet-5');
  await expect(dialog.locator('.dlg-agent-model-menu')).not.toContainText('128k');
});

// 几何钉：模型槽是表单最后一个字段，菜单向下展开会撞底栏、被压到只剩首行。
// 这一面向上展开，且菜单体不得与底栏相交（存在性断言看不出被压住）。
test('创建弹窗：模型菜单不被底栏压住（几何）', async ({ page }) => {
  const dialog = await openDialog(page, TEAM_WITH_PROVIDERS);
  await dialog.locator('.dlg-agent-model-select').click();
  const menu = dialog.locator('.dlg-agent-model-menu');
  await expect(menu).toBeVisible();
  const mb = await menu.boundingBox();
  const fb = await dialog.locator('.dlg-form-foot').boundingBox();
  expect(mb).not.toBeNull();
  expect(fb).not.toBeNull();
  if (mb === null || fb === null) return;
  expect(mb.y + mb.height <= fb.y || mb.y >= fb.y + fb.height).toBe(true);
  // 菜单整个落在视口内（别修好压住、换成溢出到屏幕外）。
  expect(mb.y).toBeGreaterThanOrEqual(0);
  expect(mb.x).toBeGreaterThanOrEqual(0);
  expect(mb.x + mb.width).toBeLessThanOrEqual(1440);
});

test('选中模型后提交，POST body 带 provider 与 modelId', async ({ page }) => {
  const bodies: unknown[] = [];
  await stubLive(page, { hasProviders: true, bodies });
  const dialog = await openDialog(page, '/app/team');
  await dialog.locator('#dlg-agent-name').fill('带模型的 agent');
  await dialog.locator('.dlg-agent-model-select').click();
  await dialog.locator('.dlg-agent-model-row', { hasText: 'r3-gw' }).click();
  await dialog.locator('.dlg-agent-create').click();
  await expect(page.locator('.dlg')).toBeHidden();
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toMatchObject({
    displayName: '带模型的 agent',
    provider: 'r3-gw',
    modelId: 'claude-sonnet-5',
  });
});