import { expect, type Locator, type Page, test } from '@playwright/test';

// 兜底模型列表的配置面（XMON-46）：agent 概览编辑面与创建 Agent 弹窗共用
// 同一个字段件（AgentFallbackField）。已裁决架构：列表 = agent 级配置、有序、
// 空列表 = 现行为；兜底成功只本次生效，界面不提供「静默永久切换」——故这一面
// 只有「配哪几档、什么顺序」，没有开关。
//
// 纯逻辑（候选去重、换位、提交形状）由 test/fallback-models.test.ts 钉；本
// spec 钉的是**交互与几何**。
//
// 每条断言钉一个失败方式：
// 1. 存量兜底行不回显 —— 记录里两条，面上零行（或行序不是记录序）
// 2. 同名模型分不开 —— 行只出模型名，两个 provider 的同名模型长得一样
// 3. 候选里带主模型或已选条目 —— 同一模型出现在两槽（server 写面会剥掉，
//    界面回显与服务端真值分叉）
// 4. 添加位是死面 —— 选完行数不变
// 5. 排序是死面 —— 上移/下移后行序不动
// 6. 越界钮不禁用 —— 首行还能上移、末行还能下移
// 7. 移除是死面 —— 点完行还在
// 8. 改动不落库 —— PATCH body 没有 fallbackModels
// 9. 创建面空列表也带 fallbackModels: [] —— 「空 = 现行为」被改成显式清空
// 10. 创建面带了列表但丢了序 —— POST body 的数组顺序与选入序不符
// 11. 换主模型后撞上主模型的存量条目没剥 —— 界面留着一条 server 会剥掉的档
//
// fixture 场景 = 'agent-fallback'（r3-builder + 两条存量兜底行，跨 provider）
// 与 'agent-detail'（同记录，兜底槽为空 = 现行为）；提交形状两条走 live stub
// （fixture 面没有后端，POST/PATCH 无从观测——agent-create-model.spec 先例）。
const DETAIL = '/app/resources/agents/r3-builder?scenario=agent-fallback';
const EMPTY_DETAIL = '/app/resources/agents/r3-builder?scenario=agent-detail';
const TEAM = '/app/team?scenario=agent-detail';

/** 面上三件（行名 / provider 标签 / 动作钮）按 DOM 序取值。 */
function field(detail: Locator) {
  return detail.locator('.agent-fb');
}

async function rowNames(detail: Locator): Promise<string[]> {
  return field(detail).locator('.agent-fb-name').allTextContents();
}

/** 添加位菜单（`.agent-fb-add-menu`）：一个面里只有一个添加位。 */
async function openAddMenu(detail: Locator) {
  await field(detail).locator('.agent-fb-add-select').click();
  const menu = field(detail).locator('.agent-fb-add-menu');
  await expect(menu).toBeVisible();
  return menu;
}

test('存量兜底行按记录序回显，行 = 模型名 + provider 标签', async ({ page }) => {
  await page.goto(DETAIL);
  const detail = page.locator('.agent-detail');
  await expect(field(detail).locator('.agent-fb-row')).toHaveCount(2);
  // 序 = 记录序（claude-code/opus-4-5 在前）——不是字母序、不是到达序
  expect(await rowNames(detail)).toEqual(['claude-opus-4-5', 'claude-sonnet-5']);
  // provider 标签在右：同名模型（claude-code/claude-sonnet-5 vs 主模型
  // r3-gw/claude-sonnet-5）靠它分档
  await expect(field(detail).locator('.agent-fb-provider')).toHaveText([
    'Claude Code',
    'Claude Code',
  ]);
  // 空的兜底槽不渲染列表，但字段本身在（空 = 现行为，不是把这面藏起来）
  await page.goto(EMPTY_DETAIL);
  const empty = page.locator('.agent-detail');
  await expect(field(empty)).toBeVisible();
  await expect(field(empty).locator('.agent-fb-row')).toHaveCount(0);
});

test('添加位候选挖去主模型与已选条目（同一模型不出两处）', async ({ page }) => {
  await page.goto(DETAIL);
  const detail = page.locator('.agent-detail');
  const menu = await openAddMenu(detail);
  // 候选源 5 条（r3-gw/sonnet + claude-code 四条）：主模型 r3-gw/claude-sonnet-5
  // 与已选两条（claude-code opus-4-5、sonnet-5）都该被挖掉，只剩两条
  await expect(menu.locator('.agent-fb-add-row')).toHaveCount(2);
  await expect(menu.locator('.agent-fb-add-row-name')).toHaveText([
    'claude-opus-4-1',
    'claude-haiku-4-5',
  ]);
  // 添加位是即用即弃的选择器：没有「未设置模型」清空行
  await expect(menu).not.toContainText('未设置模型');
});

test('添加一条：追加到列表末尾', async ({ page }) => {
  await page.goto(DETAIL);
  const detail = page.locator('.agent-detail');
  const menu = await openAddMenu(detail);
  await menu.locator('.agent-fb-add-row-name', { hasText: 'claude-opus-4-1' }).click();
  await expect(menu).toBeHidden();
  expect(await rowNames(detail)).toEqual([
    'claude-opus-4-5',
    'claude-sonnet-5',
    'claude-opus-4-1',
  ]);
  // 加完即出现在列表 → 候选里不再有它，剩下的那条还能加
  const after = await openAddMenu(detail);
  await expect(after.locator('.agent-fb-add-row-name')).toHaveText(['claude-haiku-4-5']);
});

test('排序：下移首行 / 上移末行都真的换位，越界钮禁用', async ({ page }) => {
  await page.goto(DETAIL);
  const detail = page.locator('.agent-detail');
  const rows = field(detail).locator('.agent-fb-row');
  // 越界：首行上移、末行下移都禁用（箭头还在，位置已到头）
  await expect(rows.nth(0).locator('button[aria-label="上移"]')).toBeDisabled();
  await expect(rows.nth(1).locator('button[aria-label="下移"]')).toBeDisabled();
  await rows.nth(0).locator('button[aria-label="下移"]').click();
  expect(await rowNames(detail)).toEqual(['claude-sonnet-5', 'claude-opus-4-5']);
  await rows.nth(1).locator('button[aria-label="上移"]').click();
  expect(await rowNames(detail)).toEqual(['claude-opus-4-5', 'claude-sonnet-5']);
});

test('移除中间一条：其余保序，删空后列表消失', async ({ page }) => {
  await page.goto(DETAIL);
  const detail = page.locator('.agent-detail');
  const rows = field(detail).locator('.agent-fb-row');
  await rows.nth(0).locator('button[aria-label="移除"]').click();
  await expect(field(detail).locator('.agent-fb-row')).toHaveCount(1);
  expect(await rowNames(detail)).toEqual(['claude-sonnet-5']);
  // 删到空：行没了，字段与添加位还在（还能再加回来）
  await rows.nth(0).locator('button[aria-label="移除"]').click();
  await expect(field(detail).locator('.agent-fb-row')).toHaveCount(0);
  await expect(field(detail).locator('.agent-fb-add-select')).toBeVisible();
});

test('删除后候选把该条放回来（挖的是已选，不是删过的）', async ({ page }) => {
  await page.goto(DETAIL);
  const detail = page.locator('.agent-detail');
  await field(detail).locator('.agent-fb-row').nth(0).locator('button[aria-label="移除"]').click();
  const menu = await openAddMenu(detail);
  await expect(menu.locator('.agent-fb-add-row-name')).toHaveText([
    'claude-opus-4-5',
    'claude-opus-4-1',
    'claude-haiku-4-5',
  ]);
});

/** live 启动面（fixture build 下不带 scenario 参数即 live）——只放行被测面
 *  需要的几条读面，其余 GET 一律 500（agent-create-model.spec 的 stubLive
 *  同律，单条路由内分派避免顺序陷阱）。providers 给两条模型候选，兜底列表
 *  才有得加。 */
const TEAM_ID = 'team-1';
const AGENT = {
  id: 'agent-1',
  displayName: 'live-builder',
  description: null,
  status: 'active',
  avatarUrl: null,
  provider: 'r3-gw',
  modelId: 'claude-sonnet-5',
  thinkingLevel: null,
  tools: [],
  secrets: [],
  skills: [],
  mcpServers: [],
  fallbackModels: [],
};

async function stubLive(page: Page, bodies: { method: string; body: unknown }[]) {
  // 写面有状态：PATCH 落进这份记录，之后的读面回放它——「改完再重取」的
  // 回显才与真后端同律（无状态 stub 会让本地覆面与服务端真值静默分叉）。
  const record: Record<string, unknown> = { ...AGENT };
  await page.route('**/api/**', (route, request) => {
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (method === 'PATCH' && path === `/api/teams/${TEAM_ID}/agents/${AGENT.id}`) {
      const body = JSON.parse(request.postData() ?? '{}') as Record<string, unknown>;
      bodies.push({ method, body });
      Object.assign(record, body);
      return route.fulfill({ json: record });
    }
    if (method === 'POST' && path === `/api/teams/${TEAM_ID}/agents`) {
      bodies.push({ method, body: JSON.parse(request.postData() ?? '{}') });
      return route.fulfill({ status: 201, json: { id: 'agent-new' } });
    }
    if (method !== 'GET') return route.fallback();
    if (path === '/api/teams') {
      return route.fulfill({
        json: [{ id: TEAM_ID, name: 'Team', createdAt: 0, plan: 'free', avatarStyle: null }],
      });
    }
    if (path === '/api/user/me') {
      return route.fulfill({ json: { id: 'user-1', displayName: '我', avatarUrl: null } });
    }
    if (path === `/api/teams/${TEAM_ID}/members`) return route.fulfill({ json: [] });
    if (path === `/api/teams/${TEAM_ID}/agents`) return route.fulfill({ json: [record] });
    if (path === `/api/teams/${TEAM_ID}/agents/${AGENT.id}`) return route.fulfill({ json: record });
    if (path.endsWith('/tasks') || path.endsWith('/memories')) return route.fulfill({ json: [] });
    if (path === `/api/teams/${TEAM_ID}/providers`) {
      return route.fulfill({
        json: {
          presets: [],
          providers: [
            {
              kind: 'custom',
              providerId: 'r3-gw',
              label: 'r3-gw',
              baseUrl: 'https://gw.example/v1',
              api: 'anthropic-messages',
              authHeader: true,
              compat: { supportsDeveloperRole: false },
              models: [
                { id: 'claude-sonnet-5', name: 'claude-sonnet-5' },
                { id: 'claude-opus-5', name: 'claude-opus-5' },
              ],
              id: 'prov-1',
              createdBy: 'user-1',
              createdAt: 0,
              updatedAt: 0,
            },
          ],
        },
      });
    }
    if (path === `/api/teams/${TEAM_ID}/model-sources`) {
      return route.fulfill({ json: { sources: [] } });
    }
    if (path === '/api/capabilities') {
      return route.fulfill({ json: { thinkingLevels: [] } });
    }
    return route.fulfill({ status: 500, json: { error: 'e2e stub: not the surface under test' } });
  });
}

test('编辑面：改动落库为 PATCH fallbackModels（有序，仅这一槽）', async ({ page }) => {
  const bodies: { method: string; body: unknown }[] = [];
  await stubLive(page, bodies);
  await page.goto(`/app/resources/agents/${AGENT.id}`);
  const detail = page.locator('.agent-detail');
  const menu = await openAddMenu(detail);
  await menu.locator('.agent-fb-add-row-name', { hasText: 'claude-opus-5' }).click();
  await expect
    .poll(() => bodies.length, { message: 'PATCH 未发出' })
    .toBeGreaterThan(0);
  // 只带这一槽：改兜底列表不顺手重写主模型
  expect(bodies[0]).toEqual({
    method: 'PATCH',
    body: { fallbackModels: [{ provider: 'r3-gw', modelId: 'claude-opus-5' }] },
  });
});

test('编辑面：换主模型撞上存量兜底条目时，一并提交剥离后的列表', async ({ page }) => {
  const bodies: { method: string; body: unknown }[] = [];
  await stubLive(page, bodies);
  // 该 stub 的 agent 兜底槽为空；先加一条再换主模型到同一条上
  await page.goto(`/app/resources/agents/${AGENT.id}`);
  const detail = page.locator('.agent-detail');
  const menu = await openAddMenu(detail);
  await menu.locator('.agent-fb-add-row-name', { hasText: 'claude-opus-5' }).click();
  await expect.poll(() => bodies.length).toBe(1);
  await detail.locator('.agent-model-select').click();
  await page.locator('.agent-model-menu .agent-model-row', { hasText: 'claude-opus-5' }).click();
  await expect.poll(() => bodies.length).toBe(2);
  expect(bodies[1]?.body).toEqual({
    provider: 'r3-gw',
    modelId: 'claude-opus-5',
    fallbackModels: [],
  });
});

test('创建面：空列表不带 fallbackModels（现行为 = 无兜底）', async ({ page }) => {
  const bodies: { method: string; body: unknown }[] = [];
  await stubLive(page, bodies);
  await page.goto('/app/team');
  const dialog = page.locator('.dlg');
  await page.locator('.team-create-agent').click();
  await expect(dialog).toBeVisible();
  await dialog.locator('#dlg-agent-name').fill('无兜底的 agent');
  await dialog.locator('.dlg-agent-create').click();
  await expect(dialog).toBeHidden();
  expect(bodies).toHaveLength(1);
  expect(bodies[0]?.body).toMatchObject({ displayName: '无兜底的 agent' });
  expect(bodies[0]?.body).not.toHaveProperty('fallbackModels');
});

test('创建面：选了两档后 POST 带有序 fallbackModels（与主模型去重）', async ({ page }) => {
  const bodies: { method: string; body: unknown }[] = [];
  await stubLive(page, bodies);
  await page.goto('/app/team');
  const dialog = page.locator('.dlg');
  await page.locator('.team-create-agent').click();
  await expect(dialog).toBeVisible();
  await dialog.locator('#dlg-agent-name').fill('带兜底的 agent');
  // 主模型 = claude-sonnet-5；兜底加 opus-5 与 sonnet-5……后者是主模型本身，
  // 候选里根本不该有（同一模型不出两槽）
  await dialog.locator('.dlg-agent-model-select').click();
  await dialog
    .locator('.dlg-agent-model-menu .dlg-agent-model-row', { hasText: 'claude-sonnet-5' })
    .click();
  const addMenu = await openAddMenu(dialog);
  await expect(addMenu.locator('.agent-fb-add-row-name')).toHaveText(['claude-opus-5']);
  await addMenu.locator('.agent-fb-add-row-name').click();
  await expect(field(dialog).locator('.agent-fb-provider')).toHaveText(['r3-gw']);
  await dialog.locator('.dlg-agent-create').click();
  await expect(dialog).toBeHidden();
  expect(bodies).toHaveLength(1);
  expect(bodies[0]?.body).toEqual({
    displayName: '带兜底的 agent',
    provider: 'r3-gw',
    modelId: 'claude-sonnet-5',
    fallbackModels: [{ provider: 'r3-gw', modelId: 'claude-opus-5' }],
  });
});