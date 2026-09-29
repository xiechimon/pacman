import { expect, type Page, test } from '@playwright/test';

// spec 13（#367）skills 只读面：技能 = server 本地目录现扫投影（不入库），
// 页面无新建/导入入口，旧导入路由走 SPA catch-all 回落 /app，空态文案指路
// 技能目录（SKILLS_DIR_DEFAULT）。旧写面 e2e（skills-add-import /
// skills-github-scan 两 spec）随端点退役删除。
// 钉住的失败方式：新建入口复活 / 旧路由仍可达导入表单 / 空态缺目录指引或
// 残留主钮·总管提示 / live 列表不消费 GET /api/skills。

const SKILLS = '/app/resources/skills';

test('技能页无新建入口（.res-new 不渲染），fixture 行集照常渲染', async ({ page }) => {
  await page.goto(`${SKILLS}?scenario=06`);
  await expect(page.locator('[data-route="/app/resources/skills"]')).toBeVisible();
  await expect(page.locator('.res-new')).toHaveCount(0);
  await expect(page.locator('.res-rowcard')).toHaveCount(1);
  await expect(page.locator('.res-rowcard').first()).toContainText('r3-probe-skill');
});

test('旧导入路由不可达——catch-all 重定向回 /app（#149 feedback 路由同律）', async ({
  page,
}) => {
  await page.goto(`${SKILLS}/import`);
  await expect(page).toHaveURL('/app');
  await expect(page.locator('[data-route="/app/resources/skills/import"]')).toHaveCount(0);
});

test('空态指路技能目录——无主钮、无总管提示行', async ({ page }) => {
  await page.goto(`${SKILLS}?scenario=01`);
  const empty = page.locator('.res-empty');
  await expect(empty).toBeVisible();
  await expect(empty.locator('.res-empty-title')).toHaveText('尚无技能。');
  // 目录指引 = SKILLS_DIR_DEFAULT 单源（{dir} 插值渲染进文案）
  await expect(empty.locator('.res-empty-desc')).toContainText('~/.agents/skills');
  await expect(empty.locator('.res-empty-desc')).toContainText('SKILL.md');
  await expect(empty.locator('.res-primary')).toHaveCount(0);
  await expect(empty.locator('.res-empty-hint')).toHaveCount(0);
});

/** live 启动面打桩（承 skills-github-scan 的 stubBoot 纪律）：teams/user me
 * 是 teamId 来源必须成功；其余 GET 一律 500——启动面查询失败 = 应用既有
 * isError 耐受（data ?? [] 族）。page.route 匹配序 = 注册逆序：catch-all
 * 先注册，具体路由后注册才生效。 */
async function stubBoot(page: Page) {
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

test('live 列表消费 GET /api/skills（server 换源后 wire 形状不变）', async ({ page }) => {
  await stubBoot(page);
  const hits: string[] = [];
  await page.route('**/api/skills*', (route) => {
    hits.push(route.request().url());
    return route.fulfill({
      json: [
        { id: 'deploy', teamId: 'team-1', name: 'deploy', description: '部署流程手册' },
        { id: 'review', teamId: 'team-1', name: 'review', description: null },
      ],
    });
  });
  await page.goto(SKILLS);

  await expect(page.locator('.res-rowcard')).toHaveCount(2);
  await expect(page.locator('.res-rowcard').nth(0)).toContainText('deploy');
  await expect(page.locator('.res-rowcard').nth(0)).toContainText('部署流程手册');
  await expect(page.locator('.res-rowcard').nth(1)).toContainText('review');
  // 请求带 teamId（hooks 族律）；id = frontmatter name（server 现扫语义）
  expect(hits.length).toBeGreaterThan(0);
  expect(hits[0]).toContain('teamId=team-1');
});
