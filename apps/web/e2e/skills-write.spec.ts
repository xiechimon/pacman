import { expect, type Page, test } from '@playwright/test';

// XMON-114（S3，spec 13 回摆）：技能页新建/编辑写面——SkillDialog 接
// XMON-109 REST 端点（POST /api/skills、PUT teams/{id}/skills/{sid}），
// frontmatter 由表单生成（shared buildSkillEntry 组装 / splitSkillEntry 预填）。
// 每条钉一个失败方式：
// 1. fixture 面：新建弹窗字段集 + 提交闸（空名/非法名/空描述禁用）+ accept 律提交即关；
// 2. live 新建：POST 201 → 弹窗关 → 列表失效重取即现（无需刷新），组装产物对拍；
// 3. live 新建 409：弹窗不关、错误行可见（headline 中文 + server 原文 detail）；
// 4. live 编辑：行点击 → GET 入口文件预填（frontmatter 拆回表单）→ PUT 200 → 列表回读一致；
// 5. live 编辑预填读 404：表单让位错误块 + 列表失效重取；
// 6. 客户端预检：非法名/引号描述不落请求（server 0 调用）。

const SKILLS = '/app/resources/skills';

/** live 启动面打桩（承 skills-page.spec 的 stubBoot 纪律）：teams/user me
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

interface SkillRow {
  id: string;
  teamId: string;
  name: string;
  description: string | null;
}

/** live 技能面打桩：store 闭包即「盘上技能根」——GET 现扫它，POST/PUT 写它
 * （文件内容另存 files map 供编辑预填读）。返回捕获面供对拍。 */
async function stubSkillStore(page: Page, seed: SkillRow[] = []) {
  const store = [...seed];
  const files = new Map<string, string>();
  const calls: { method: string; url: string; body?: unknown }[] = [];
  await page.route('**/api/skills*', (route, request) => {
    if (request.method() !== 'GET') return route.fallback();
    return route.fulfill({ json: store });
  });
  await page.route('**/api/skills?*', async (route, request) => {
    if (request.method() !== 'POST') return route.fallback();
    const body = request.postDataJSON() as {
      name: string;
      description: string;
      files: { path: string; content: string }[];
    };
    calls.push({ method: 'POST', url: request.url(), body });
    if (store.some((s) => s.id === body.name)) {
      return route.fulfill({
        status: 409,
        json: { error: `skill directory ${body.name} already exists` },
      });
    }
    const rec: SkillRow = {
      id: body.name,
      teamId: 'team-1',
      name: body.name,
      description: body.description,
    };
    store.push(rec);
    files.set(body.name, body.files[0]?.content ?? '');
    return route.fulfill({ status: 201, json: rec });
  });
  await page.route('**/api/teams/*/skills/*/file*', (route, request) => {
    const sid = decodeURIComponent(request.url().split('/skills/')[1]?.split('/')[0] ?? '');
    const content = files.get(sid);
    if (content === undefined) {
      return route.fulfill({ status: 404, json: { error: `skill ${sid} not found` } });
    }
    return route.fulfill({ json: { fileName: 'SKILL.md', content } });
  });
  await page.route('**/api/teams/*/skills/*', async (route, request) => {
    if (request.method() !== 'PUT') return route.fallback();
    const sid = decodeURIComponent(
      request.url().split('/skills/')[1]?.split('?')[0]?.replace(/\/$/, '') ?? '',
    );
    const body = request.postDataJSON() as {
      name: string;
      description: string;
      files: { path: string; content: string }[];
    };
    calls.push({ method: 'PUT', url: request.url(), body });
    const idx = store.findIndex((s) => s.id === sid);
    if (idx === -1) {
      return route.fulfill({ status: 404, json: { error: `skill ${sid} not found` } });
    }
    const rec: SkillRow = { ...store[idx], id: body.name, name: body.name, description: body.description };
    store[idx] = rec;
    files.set(body.name, body.files[0]?.content ?? '');
    return route.fulfill({ json: rec });
  });
  return { store, files, calls };
}

test('fixture 新建弹窗：字段集 + 提交闸 + accept 律提交即关', async ({ page }) => {
  await page.goto(`${SKILLS}?scenario=01`);
  await page.locator('.res-empty .res-primary').click();
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.dlg-title')).toHaveText('新建技能');
  await expect(dialog.locator('#dlg-skill-name')).toHaveAttribute('placeholder', 'deploy-to-prod');
  await expect(dialog.locator('#dlg-skill-body')).toBeVisible();

  const submit = dialog.locator('.dlg-skill-submit');
  await expect(submit).toBeDisabled(); // 空名 + 空描述
  await dialog.locator('#dlg-skill-name').fill('my skill!');
  await expect(submit).toBeDisabled(); // 非法名（空格/叹号）
  await expect(dialog.locator('.dlg-skill-error')).toContainText('名称须以字母或数字开头');
  await dialog.locator('#dlg-skill-name').fill('my-skill');
  await expect(submit).toBeDisabled(); // 仍缺描述
  await dialog.locator('#dlg-skill-desc').fill('演示技能');
  await expect(submit).toBeEnabled();

  await submit.click();
  await expect(page.locator('.dlg')).toBeHidden(); // fixture accept 律
});

test('live 新建：201 后弹窗关、列表即现，frontmatter 由表单组装', async ({ page }) => {
  await stubBoot(page);
  const { store, calls } = await stubSkillStore(page);
  await page.goto(SKILLS);
  // 空态主钮 = 双入口之一
  await page.locator('.res-empty .res-primary').click();
  const dialog = page.locator('.dlg');
  await dialog.locator('#dlg-skill-name').fill('deploy');
  await dialog.locator('#dlg-skill-desc').fill('部署流程手册');
  await dialog.locator('#dlg-skill-body').fill('# 步骤\n\n1. 构建');
  await dialog.locator('.dlg-skill-submit').click();

  await expect(dialog).toBeHidden();
  await expect(page.locator('.res-rowcard')).toHaveCount(1); // 失效重取即现
  await expect(page.locator('.res-rowcard').first()).toContainText('deploy');
  await expect(page.locator('.res-rowcard').first()).toContainText('部署流程手册');
  expect(store).toHaveLength(1);

  // 组装对拍：单个 SKILL.md，frontmatter 与表单逐字一致
  expect(calls).toHaveLength(1);
  const body = calls[0].body as { files: { path: string; content: string }[] };
  expect(body.files).toHaveLength(1);
  expect(body.files[0].path).toBe('SKILL.md');
  expect(body.files[0].content).toBe(
    '---\nname: deploy\ndescription: 部署流程手册\n---\n\n# 步骤\n\n1. 构建\n',
  );
});

test('live 新建撞同名 409：弹窗不关，错误行 headline + server 原文 detail', async ({ page }) => {
  await stubBoot(page);
  await stubSkillStore(page, [
    { id: 'deploy', teamId: 'team-1', name: 'deploy', description: '既有技能' },
  ]);
  await page.goto(SKILLS);
  await expect(page.locator('.res-rowcard')).toHaveCount(1);
  await page.locator('.res-new').click(); // topbar 入口
  const dialog = page.locator('.dlg');
  await dialog.locator('#dlg-skill-name').fill('deploy');
  await dialog.locator('#dlg-skill-desc').fill('再来一份');
  await dialog.locator('.dlg-skill-submit').click();

  await expect(dialog).toBeVisible(); // 弹窗不关
  const error = dialog.locator('.dlg-skill-error');
  await expect(error).toContainText('同名技能已存在');
  await expect(error.locator('.dlg-skill-error-detail')).toContainText(
    'skill directory deploy already exists',
  );
});

test('live 编辑：行点击预填 frontmatter 拆分，PUT 后列表回读一致', async ({ page }) => {
  await stubBoot(page);
  const { files, calls } = await stubSkillStore(page, [
    { id: 'deploy', teamId: 'team-1', name: 'deploy', description: '旧描述' },
  ]);
  files.set('deploy', '---\nname: deploy\ndescription: 旧描述\n---\n\n旧正文\n');
  await page.goto(SKILLS);

  await page.locator('.res-rowcard').first().click();
  const dialog = page.locator('.dlg');
  await expect(dialog.locator('.dlg-title')).toHaveText('编辑技能');
  // 预填：frontmatter 拆回表单字段，正文进 textarea
  await expect(dialog.locator('#dlg-skill-name')).toHaveValue('deploy');
  await expect(dialog.locator('#dlg-skill-desc')).toHaveValue('旧描述');
  await expect(dialog.locator('#dlg-skill-body')).toHaveValue('旧正文\n');

  await dialog.locator('#dlg-skill-desc').fill('新描述');
  await dialog.locator('.dlg-skill-submit').click();

  await expect(dialog).toBeHidden();
  await expect(page.locator('.res-rowcard').first()).toContainText('新描述'); // 回读一致
  const put = calls.find((c) => c.method === 'PUT');
  expect(put?.url).toContain('/api/teams/team-1/skills/deploy');
  const body = put?.body as { files: { content: string }[] };
  expect(body.files[0].content).toContain('description: 新描述');
  expect(body.files[0].content).toContain('旧正文'); // 正文保留
});

test('live 编辑预填读 404：表单让位错误块，列表失效重取', async ({ page }) => {
  await stubBoot(page);
  const lists: number[] = [];
  // files map 留空 → 行在列表里但入口文件 404（刚被移除的竞态）
  await stubSkillStore(page, [
    { id: 'ghost', teamId: 'team-1', name: 'ghost', description: '刚被删' },
  ]);
  await page.route('**/api/skills*', (route, request) => {
    if (request.method() !== 'GET') return route.fallback();
    lists.push(1);
    return route.fulfill({
      json: [{ id: 'ghost', teamId: 'team-1', name: 'ghost', description: '刚被删' }],
    });
  });
  await page.goto(SKILLS);
  await page.locator('.res-rowcard').first().click();

  const dialog = page.locator('.dlg');
  await expect(dialog.locator('.dlg-skill-error')).toContainText('该技能已不存在');
  await expect(dialog.locator('#dlg-skill-name')).toHaveCount(0); // 表单让位
  await expect(dialog.locator('.dlg-skill-submit')).toBeDisabled();
  expect(lists.length).toBeGreaterThanOrEqual(2); // 404 触发列表失效重取
});

test('客户端预检：非法名与引号描述不发请求', async ({ page }) => {
  await stubBoot(page);
  const { calls } = await stubSkillStore(page);
  await page.goto(SKILLS);
  await page.locator('.res-new').click();
  const dialog = page.locator('.dlg');

  await dialog.locator('#dlg-skill-name').fill('bad/name');
  await dialog.locator('#dlg-skill-desc').fill('正常描述');
  await expect(dialog.locator('.dlg-skill-submit')).toBeDisabled();
  await expect(dialog.locator('.dlg-skill-error')).toContainText('名称须以字母或数字开头');

  // 引号包裹描述：round-trip 对拍失守 → 专条提示 + 提交禁用
  await dialog.locator('#dlg-skill-name').fill('ok-name');
  await dialog.locator('#dlg-skill-desc').fill('"被引号包裹"');
  await expect(dialog.locator('.dlg-skill-error')).toContainText('不要用引号整体包裹');
  await expect(dialog.locator('.dlg-skill-submit')).toBeDisabled();

  expect(calls).toHaveLength(0); // 两道预检都没落到 server
});
