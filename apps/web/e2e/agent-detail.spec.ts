import { expect, type Page, test } from '@playwright/test';

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
// 7. 思考强度不是只读值行（原版 r3 §4 观测值恒「默认」）
// 8. 记忆空态文案与 shared canon 不一致
// 9. 权限面工具开关不足 6 个（r3 §4 全 list）
// 10. MCP 服务器逐个勾选行不渲染
// 11. 未知 agent id 白屏（拿不到记录时没有回退呈现）
//
// fixture 场景 = 'agent-detail'：TEAM_R7 的 r3-builder 卡 + 该 agent 的完整
// 记录（字段 = r3 §4 实测样本原样）+ resources 行集。
const DETAIL = '/app/resources/agents/r3-builder?scenario=agent-detail';
const TEAM = '/app/team?scenario=agent-detail';

async function openDetail(page: Page) {
  await page.goto(DETAIL);
  return page.locator('.agent-detail');
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

test('概览：模型选择器打开后列出 provider 与模型名', async ({ page }) => {
  const detail = await openDetail(page);
  await detail.locator('.agent-model-select').click();
  const menu = detail.locator('.agent-model-menu');
  await expect(menu).toBeVisible();
  const first = menu.locator('.agent-model-row').first();
  await expect(first).toContainText('claude-sonnet-5');
  await expect(first).toContainText('r3-gw');
});

test('概览：思考强度是只读值行，无模型时显示「默认」', async ({ page }) => {
  const detail = await openDetail(page);
  const thinking = detail.locator('.agent-thinking');
  await expect(thinking).toHaveText('默认');
  await expect(thinking.locator('button')).toHaveCount(0);
});

test('概览：状态行显示 active', async ({ page }) => {
  const detail = await openDetail(page);
  await expect(detail.locator('.agent-status')).toContainText('active');
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

test('权限 tab：6 个工具开关全渲染（r3 §4 全 list）', async ({ page }) => {
  const detail = await openDetail(page);
  await detail.locator('.agent-tab').nth(2).click();
  await expect(detail.locator('.agent-tool-switch')).toHaveCount(6);
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

test('未知 agent id 不白屏，走回退呈现', async ({ page }) => {
  await page.goto('/app/resources/agents/no-such-agent?scenario=agent-detail');
  await expect(page.locator('.agent-missing')).toBeVisible();
});