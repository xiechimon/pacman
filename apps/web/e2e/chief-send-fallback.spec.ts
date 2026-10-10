import { expect, type Page, test } from '@playwright/test';
import { evidenceShot } from './evidence';

// 收单回落显式告知 (#774, 用户裁决显式 toast, 静默不要): 本地换过模型后,
// chief 主模型槽的存量值不在当前候选里. server 在收单时同步愈合 (置 null =
// 继承绑定 Agent) 再入队, 响应带回原值; 客户端凭该字段弹成功 toast 点名.
// 落点 = 服务端收单 (理由见 server chief.ts sendChiefMessage 注释): 原子 + 全
// 入口 + 加法契约, 客户端只管告知.
//
// Failure modes pinned here (one test per mode):
//  1. stale slot: the send still goes out (posts == 1, draft clears — 回落不是
//     拒收), the toast names the stale `provider/modelId`, and the healed
//     slot (null = 继承) is re-read — the model row flips to `· 默认`.
//  2. fresh slot (null): the send goes out and NO fallback toast appears —
//     the toast must not fire on the common path.
//
// Data face = live face stubbed (composer-wire-reject stubBoot discipline):
// no ?scenario= means the real API branch; the chief envelope carries the
// stale slot, model-sources lacks it, and the POST answers with modelFallback.
// healed flips the GET chief stub to the healed envelope, so the row flip
// asserts the server-healed truth being re-read, not a local optimistic state.

const TEAM_ID = 'team-1';
const USER = { id: 'user-1', displayName: '我', avatarUrl: null };
const TEAM = { id: TEAM_ID, name: 'Team', createdAt: 0, plan: 'free', avatarStyle: null };

const STALE = { provider: 'claude-code', modelId: 'old-model' };
const AGENT_MODEL = 'agent-model';

function chiefEnvelope(model: { provider: string; modelId: string } | null) {
  return {
    chief: {
      id: `chief-${USER.id}-${TEAM_ID}`,
      userId: USER.id,
      teamId: TEAM_ID,
      agent: { agentId: 'agent-1' },
      charter: '',
      compactionModel: null,
      model,
      lastTurnAt: null,
      createdAt: 0,
      tz: null,
    },
    agentActor: {
      id: 'agent-1',
      displayName: '总管绑定',
      description: '',
      status: 'active',
      avatarUrl: null,
      provider: 'claude-code',
      modelId: AGENT_MODEL,
      thinkingLevel: null,
      tools: [],
      secrets: [],
      defaultSkill: null,
      skillsAllowlist: null,
      mcpServers: [],
    },
    context: null,
    watches: [],
    wakes: [],
  };
}

const SOURCES = {
  sources: [
    { runtime: 'pi', installed: true, hostname: 'h', models: [] },
    {
      runtime: 'claude-code',
      installed: true,
      hostname: 'h',
      models: [{ id: 'new-model', name: 'new-model', slot: 'default' }],
    },
  ],
};

/** Drawer on the live face with a controllable chief slot. Returns the send
 *  POST counter so tests can guard the wire before asserting UI. */
async function stubFallbackSurface(
  page: Page,
  opts: { slot: { provider: string; modelId: string } | null; echoFallback: boolean },
) {
  await page.route('**/api/**', (route, request) => {
    if (request.method() !== 'GET') return route.fallback();
    return route.fulfill({ status: 500, json: { error: 'e2e stub: not the surface under test' } });
  });
  await page.route('**/api/teams', (route) => route.fulfill({ json: [TEAM] }));
  await page.route('**/api/user/me', (route) => route.fulfill({ json: USER }));
  await page.route(`**/api/teams/${TEAM_ID}/notifications`, (route) =>
    route.fulfill({ json: { unreadThreadIds: [] } }),
  );
  await page.route(`**/api/teams/${TEAM_ID}/chief/threads`, (route, request) => {
    if (request.method() !== 'GET') return route.fallback();
    return route.fulfill({ json: [] });
  });
  // The slot heals only once the POST lands (server 真值语义): any pre-send
  // refetch — StrictMode remount included — still sees the stale slot.
  let healed = false;
  await page.route(`**/api/teams/${TEAM_ID}/chief`, (route, request) => {
    if (request.method() !== 'GET') return route.fallback();
    return route.fulfill({ json: chiefEnvelope(healed ? null : opts.slot) });
  });
  await page.route(`**/api/teams/${TEAM_ID}/model-sources`, (route) =>
    route.fulfill({ json: SOURCES }),
  );
  let posts = 0;
  await page.route(`**/api/teams/${TEAM_ID}/chief/threads`, (route, request) => {
    if (request.method() !== 'POST') return route.fallback();
    posts += 1;
    healed = true;
    return route.fulfill({
      status: 201,
      json: {
        thread: { id: 'chief-aaa', teamId: TEAM_ID, title: '回落探针', createdAt: 0 },
        message: { id: 'msg-1', role: 'user', content: '回落探针', createdAt: 0 },
        ...(opts.echoFallback ? { modelFallback: STALE } : {}),
      },
    });
  });
  return { posts: () => posts };
}

async function openDrawer(page: Page) {
  await page.goto('/app');
  // #950 载体：.chief-fab → aria-label 总管钮；.chief-composer-input → testid。
  await page.getByRole('button', { name: '总管', exact: true }).click();
  const input = page.getByTestId('chief-composer-input');
  await expect(input).toBeVisible();
  await expect(input).toBeEditable();
  return input;
}

/** 模型行文本载体（#950：.chief-model 行容器类退役，行文本 = 触发钮内容）。 */
const modelRow = (page: Page) =>
  page.getByRole('button', { name: '总管主模型', exact: true });

test('stale slot: send goes out, fallback toast names it, row heals to 默认', async ({
  page,
}) => {
  const wire = await stubFallbackSurface(page, { slot: STALE, echoFallback: true });
  const input = await openDrawer(page);

  // Guard: the setup really is stale — the row shows the bare id, no 默认 badge.
  const row = modelRow(page);
  await expect(row).toContainText('old-model');
  await expect(row).not.toContainText('默认');

  await input.fill('回落探针');
  await input.press('Enter');

  // Guard: the send really hit the wire, otherwise the toast asserts a no-op.
  await expect.poll(wire.posts).toBe(1);
  // 回落不是拒收: draft clears like any accepted send.
  await expect(input).toHaveValue('');

  // 显式告知: success toast names the stale provider/modelId (visible, not
  // just in the DOM — a never-shown toast is silent fallback by another name).
  const toast = page.locator('[data-sonner-toast]');
  await expect(toast).toContainText('模型已回落到默认');
  await expect(toast).toContainText('claude-code/old-model');
  await expect(toast.first()).toBeVisible();
  await evidenceShot(page, 'chief-send-fallback-toast.png');

  // The healed slot is re-read (invalidateAll → GET chief): row flips to 默认.
  await expect(row).toContainText('· 默认');
  await evidenceShot(page, 'chief-send-fallback.png');
});

test('fresh slot: send goes out with no fallback toast', async ({ page }) => {
  const wire = await stubFallbackSurface(page, { slot: null, echoFallback: false });
  const input = await openDrawer(page);

  await expect(modelRow(page)).toContainText('· 默认');

  // Listener before send (waitForResponse-after-the-fact races the
  // invalidateAll refetch and times out): every GET chief body from here on.
  const chiefGets: string[] = [];
  page.on('response', (res) => {
    const url = new URL(res.url());
    if (url.pathname === `/api/teams/${TEAM_ID}/chief` && res.request().method() === 'GET') {
      void res.text().then((t) => chiefGets.push(t));
    }
  });

  await input.fill('正常发送');
  await input.press('Enter');

  await expect.poll(wire.posts).toBe(1);
  await expect(input).toHaveValue('');
  // Let one post-send refetch land (the toast would fire before it), then
  // assert the fallback copy never appeared.
  await expect.poll(() => chiefGets.length).toBeGreaterThan(0);
  await expect(page.locator('[data-sonner-toast]', { hasText: '模型已回落到默认' })).toHaveCount(
    0,
  );
});
