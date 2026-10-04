import { expect, type Page, test } from '@playwright/test';

// 简报卡随流（#827 Q3）：live 线程列首的 spec 卡住进滚动列（.chat-col 内），
// 不再钉在列首视口。fixture 面无 spec 数据源，本 spec 走 live 面打桩
// （spec-brief-card.stubWorld 同律：todo 带 latestBuildId + spec，messages
// 长 thread；其余端点 500）。钉住的失败方式：
//  1. spec 卡回到滚动列之外（.detail-center 直接子节点 = 旧钉住形）
//  2. 滚到底简报卡仍在视口（没随流滚走）/ 滚到顶简报卡不在列首（流序错位）
//  3. 超长无断点行撑过中栏（#827 第二轮：flex min-width 陷阱，chat-col 横滚 +
//     接缝裁切）——200 字符链接行 scrollWidth 必须等于 clientWidth
// 时序坑：.chat-col 是 column-reverse，scrollTop 复数语义（0 = 底/最新，
// -max = 顶/最旧）——正数 scrollTo 是 no-op，轮询断言只看符号与位移。

const TEAM_ID = 'team-1';
const FLOW_ID = 'todo-flow-1';
const BUILD_ID = 'build-flow-1';

const TEAM = { id: TEAM_ID, name: 'Team', createdAt: 0, plan: 'free', avatarStyle: null };
const USER = { id: 'user-1', displayName: 'Xmon Dai', avatarUrl: null };

const SPEC_FLOW = [
  '# 任务简报',
  '',
  '用户原话与补充说明。'.repeat(20),
  '',
  'https://example.com/' + 's'.repeat(120),
].join('\n');

const URL200 = 'https://example.com/' + 'x'.repeat(200);

function wireTodo() {
  return {
    id: FLOW_ID,
    teamId: TEAM_ID,
    projectId: 'proj-1',
    title: '随流简报卡探测任务',
    spec: SPEC_FLOW,
    phase: 'building',
    phaseAt: 0,
    seqNum: 18,
    orderIndex: 0,
    tagIds: [],
    assignment: null,
    agent: null,
    latestBuildId: BUILD_ID,
    lastRunAt: null,
    hasChanges: false,
    hasPlan: false,
    buildHistory: [],
    sourceTodo: null,
    v: 1,
  };
}

function wireMessages() {
  const rows = [];
  for (let i = 0; i < 30; i++) {
    rows.push({
      id: `m-${i}`,
      role: 'assistant',
      content: i === 15 ? `本轮输出见 ${URL200}` : `第 ${i + 1} 轮进展播报：正文内容在此展开。`,
      createdAt: 1000 + i,
    });
  }
  return {
    messages: rows,
    chips: [],
    historyEpoch: 0,
    steerPending: [],
    activeRun: null,
    nextCursor: null,
  };
}

/** live thread 面打桩（spec-brief-card.stubWorld 同律 + build/会话分支）。 */
async function stubFlow(page: Page) {
  const json = (body: unknown, status = 200) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
  const todo = wireTodo();
  await page.route('**/api/**', (route, request) => {
    const url = new URL(request.url());
    const path = url.pathname;
    if (request.method() === 'GET') {
      if (path === '/api/teams') return route.fulfill(json([TEAM]));
      if (path === '/api/user/me') return route.fulfill(json(USER));
      if (path === '/api/projects') {
        return route.fulfill(
          json([{ id: 'proj-1', name: 'alpha', teamId: TEAM_ID, repoKind: 'hosted' }]),
        );
      }
      if (path === '/api/todos') return route.fulfill(json([todo]));
      if (path === `/api/todos/${FLOW_ID}`) return route.fulfill(json(todo));
      if (path === `/api/conversations/${BUILD_ID}/messages`) {
        return route.fulfill(json(wireMessages()));
      }
      return route.fulfill(json({ error: 'e2e stub: not the surface under test' }, 500));
    }
    return route.fulfill(json({ error: 'e2e stub: not the surface under test' }, 500));
  });
}

test('1. 简报卡住进滚动列：.chat-col 内可见，不再是 .detail-center 直接子节点', async ({
  page,
}) => {
  await stubFlow(page);
  await page.goto(`/app/todo/${FLOW_ID}`);
  const inside = page.locator('.chat-col .spec-block');
  await expect(inside).toBeVisible();
  await expect(page.locator('.detail-center > .spec-block')).toHaveCount(0);
});

test('2. 简报卡随流滚走：滚到底出视口，滚到顶回列首', async ({ page }) => {
  await stubFlow(page);
  await page.goto(`/app/todo/${FLOW_ID}`);
  const list = page.locator('.chat-col');
  const spec = page.locator('.chat-col .spec-block');
  await expect(spec).toBeAttached();
  const chatTop = (await list.boundingBox())!.y;
  // 底（最新）：简报卡滚出视口上方
  await list.evaluate((el) => el.scrollTo({ top: 0 }));
  const bottomTop = await spec.evaluate((el) => el.getBoundingClientRect().top);
  expect(bottomTop).toBeLessThan(chatTop);
  // 顶（最旧）：简报卡回到列首视口内
  await list.evaluate((el) => el.scrollTo({ top: -(el.scrollHeight - el.clientHeight) }));
  const topTop = await spec.evaluate((el) => el.getBoundingClientRect().top);
  expect(topTop).toBeGreaterThanOrEqual(chatTop - 1);
  expect(Math.abs(topTop - bottomTop)).toBeGreaterThan(200);
});

test('3. 超长无断点行包进中栏：chat 横向 scrollWidth 等于 clientWidth', async ({ page }) => {
  await stubFlow(page);
  await page.goto(`/app/todo/${FLOW_ID}`);
  const metrics = await page.locator('.chat-col').evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(metrics.scrollWidth).toBe(metrics.clientWidth);
});
