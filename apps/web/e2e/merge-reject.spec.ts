import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';

// 合并被拒的可见化（XMON-89）：XMON-26 给 requestMerge 接上闸之后，缺「合并
// 分支 / 推送分支」时 server 以 403 拒；改之前两处 merge 按钮是裸 mutate() +
// 立即关弹层，403 被静默吞掉——用户看到弹层关了、然后无事发生。
//
// 本 spec 钉住的失败方式（逐条对应一个测试）：
//  1. 详情页：授权缺项时「完成」仍可点 —— 点了必被 server 拒，用户白点一次；
//  2. 看板：同上（两个入口各写一份接线，一处漏接就是一处静默）；
//  3. 缺项不点名 —— 用户知道被拒了，但不知道该开哪个开关（等于没给答案）；
//  3b. 空授权集被当成全关 —— 存量豁免：库里 notNull().default('[]') 让「从未
//      保存过权限 tab」与「显式全关」同值，判缺 = 把所有存量 Agent 一刀切成
//      禁按（PR #579 CI 红即此因）；
//  4. 全开时误伤：明明有权限却点了没反应（前端拦下一个 server 会放行的请求）；
//  5. server 真拒时弹层静默关 —— 本轮修的主症状，防它从 onError 一路退回去；
//  6. 成功路径被写坏：正常合并后弹层不关、或残留一条错误行。
//
// 数据面 = live 面打桩（承 skills-readonly / agent-detail 的 stubBoot 纪律）：
// 无 `?scenario=` 即真 API 分支，teams / user me / members 由本 spec 供数——
// members 的 actor 是 server 侧 agentRecordOf 的投影（tools 列原样带出，
// apps/server/src/routes.ts），所以「构造一个缺推送分支的 Agent」就是改这一份
// 桩数据，走的仍是线上那条读面。merge 写面两种结局（403 / 202）各桩一次。

const TEAM_ID = 'team-1';
const AGENT_ID = 'agent-1';
const CARD_ID = 'todo-1';
const BUILD_ID = 'build-1';
const PROJECT_ID = 'proj-1';

/** 证据落点 = docs/verify/XMON-89/（跟任务分支一起进 PR body），spec 可重跑
 *  再生，不留一次性截图。 */
const SHOTS = resolve(import.meta.dirname, '../../../docs/verify/XMON-89');

const TEAM = { id: TEAM_ID, name: 'Team', createdAt: 0, plan: 'free', avatarStyle: null };
const USER = { id: 'user-1', displayName: '我', avatarUrl: null };

function agentMember(tools: string[]) {
  return {
    id: `member-${AGENT_ID}`,
    teamId: TEAM_ID,
    actorId: AGENT_ID,
    memberType: 'agent',
    actor: {
      id: AGENT_ID,
      displayName: 'live-builder',
      description: null,
      status: 'active',
      avatarUrl: null,
      provider: null,
      modelId: 'claude-sonnet-5',
      thinkingLevel: null,
      tools,
      secrets: [],
      skills: [],
      mcpServers: [],
    },
  };
}

const WIRE_CARD = {
  id: CARD_ID,
  teamId: TEAM_ID,
  projectId: PROJECT_ID,
  title: '合并可见化探针',
  spec: '',
  phase: 'review',
  phaseAt: 0,
  seqNum: 9,
  orderIndex: 0,
  tagIds: [],
  assignment: { plan: { agentId: AGENT_ID }, build: { agentId: AGENT_ID } },
  agent: { id: AGENT_ID, displayName: 'live-builder', avatarUrl: null },
  latestBuildId: BUILD_ID,
  lastRunAt: 0,
  hasChanges: true,
  hasPlan: true,
  buildHistory: [],
  sourceTodo: null,
  v: 1,
};

const PROJECT = {
  id: PROJECT_ID,
  name: 'pacman',
  teamId: TEAM_ID,
  repoKind: 'hosted',
  repoName: 'pacman',
  githubRepo: null,
  localPath: null,
};

const WIRE_BUILD = {
  id: BUILD_ID,
  todoId: CARD_ID,
  withPlan: true,
  prevPhase: null,
  triggerSource: 'user',
  pinnedMachineId: null,
  planDocId: null,
  errorMessage: null,
  prUrl: null,
  prNumber: null,
  diffHash: null,
  createdAt: 0,
};

/** 启动面打桩：teams / user me 是 teamId 来源必须成功，其余 GET 一律 500
 *  （应用既有 isError 耐受 = data ?? [] 族）。page.route 匹配序 = 注册逆序：
 *  catch-all 先注册，具体路由后注册才生效。 */
async function stubBoot(page: Page) {
  await page.route('**/api/**', (route, request) => {
    if (request.method() !== 'GET') return route.fallback();
    return route.fulfill({ status: 500, json: { error: 'e2e stub: not the surface under test' } });
  });
  await page.route('**/api/teams', (route) => route.fulfill({ json: [TEAM] }));
  await page.route('**/api/user/me', (route) => route.fulfill({ json: USER }));
}

/** 合并面所需的读面供数：members 的 tools 是唯一变量（= 执行 Agent 的授权
 *  集），其余固定成一条 review 态任务 + 它的 build。 */
async function stubMergeSurface(page: Page, tools: string[]) {
  await page.route(`**/api/teams/${TEAM_ID}/members`, (route) =>
    route.fulfill({
      json: [
        { id: 'member-user', teamId: TEAM_ID, actorId: USER.id, memberType: 'user', actor: USER },
        agentMember(tools),
      ],
    }),
  );
  await page.route(`**/api/teams/${TEAM_ID}/notifications`, (route) =>
    route.fulfill({ json: { unreadThreadIds: [] } }),
  );
  await page.route('**/api/todos?*', (route) => route.fulfill({ json: [WIRE_CARD] }));
  await page.route(`**/api/todos/${CARD_ID}`, (route) => route.fulfill({ json: WIRE_CARD }));
  await page.route('**/api/projects', (route) => route.fulfill({ json: [PROJECT] }));
  await page.route(`**/api/builds/${BUILD_ID}`, (route) => route.fulfill({ json: WIRE_BUILD }));
  await page.route(`**/api/builds/${BUILD_ID}/steps`, (route) => route.fulfill({ json: [] }));
  await page.route(`**/api/builds/${BUILD_ID}/plans`, (route) => route.fulfill({ json: [] }));
  await page.route(`**/api/builds/${BUILD_ID}/usage`, (route) => route.fulfill({ json: [] }));
  await page.route(`**/api/builds/${BUILD_ID}/changes`, (route) =>
    route.fulfill({ json: { files: [] } }),
  );
  await page.route(`**/api/conversations/${BUILD_ID}/messages`, (route) =>
    route.fulfill({
      json: {
        messages: [],
        chips: null,
        historyEpoch: 0,
        steerPending: [],
        activeRun: null,
        nextCursor: null,
      },
    }),
  );
}

/** 看板入口：review 卡的卡片钮（.todo-card-action）就是「完成」，点它开弹层。 */
async function openBoardAccept(page: Page, tools: string[]) {
  await stubBoot(page);
  await stubMergeSurface(page, tools);
  await page.goto('/app');
  const card = page.locator(`.todo-card[data-todo-id="${CARD_ID}"]`);
  await expect(card).toBeVisible();
  await card.locator('.todo-card-action').click();
  return page.locator('.dlg-accept');
}

/** 详情入口：头部的 phase 主钮（review 态 = 完成）开同一弹层。 */
async function openDetailAccept(page: Page, tools: string[]) {
  await stubBoot(page);
  await stubMergeSurface(page, tools);
  await page.goto(`/app/todo/${CARD_ID}`);
  const action = page.locator('.detail-head-action');
  await expect(action).toBeVisible();
  await action.click();
  return page.locator('.dlg-accept');
}

const BLOCK_COPY = '缺少「推送分支」授权，无法合并。请在该 Agent 的权限里开启。';

test('看板入口：执行 Agent 缺「推送分支」时完成钮禁用并点名缺项', async ({ page }) => {
  const dialog = await openBoardAccept(page, ['合并分支']);
  await expect(dialog).toBeVisible();
  await expect(page.locator('.dlg-accept-done')).toBeDisabled();
  await expect(page.locator('.dlg-accept-block')).toHaveText(BLOCK_COPY);
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: resolve(SHOTS, 'XMON-89-board-blocked.png') });
});

test('详情入口：同一 Agent 在同一弹层上禁用并点名缺项', async ({ page }) => {
  const dialog = await openDetailAccept(page, ['合并分支']);
  await expect(dialog).toBeVisible();
  await expect(page.locator('.dlg-accept-done')).toBeDisabled();
  await expect(page.locator('.dlg-accept-block')).toHaveText(BLOCK_COPY);
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: resolve(SHOTS, 'XMON-89-detail-blocked.png') });
});

test('非空授权集里两项都缺时，两处开关都被点名', async ({ page }) => {
  await openBoardAccept(page, ['远程 shell']);
  await expect(page.locator('.dlg-accept-block')).toHaveText(
    '缺少「合并分支、推送分支」授权，无法合并。请在该 Agent 的权限里开启。',
  );
});

test('空授权集放行（存量豁免）：从未保存过权限 tab 的 Agent 不被拦', async ({ page }) => {
  // 库里 agent.tools 是 notNull().default('[]')，「从未保存」与「显式全关」同值。
  // 判空集为缺 = 把所有存量 Agent 一刀切成禁按（PR #579 CI 红即此因）。
  // 两个入口各钉一次：豁免是本轮新开的支，只测一个入口等于放纵另一处漏接。
  await openBoardAccept(page, []);
  await expect(page.locator('.dlg-accept-done')).toBeEnabled();
  await expect(page.locator('.dlg-accept-block')).toHaveCount(0);
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: resolve(SHOTS, 'XMON-89-board-exempt.png') });

  await openDetailAccept(page, []);
  await expect(page.locator('.dlg-accept-done')).toBeEnabled();
  await expect(page.locator('.dlg-accept-block')).toHaveCount(0);
  await page.screenshot({ path: resolve(SHOTS, 'XMON-89-detail-exempt.png') });
});

test('两项都开时不拦：完成钮可点，无缺项提示', async ({ page }) => {
  await openBoardAccept(page, ['合并分支', '推送分支']);
  await expect(page.locator('.dlg-accept-done')).toBeEnabled();
  await expect(page.locator('.dlg-accept-block')).toHaveCount(0);
});

test('看板入口：server 真拒（403）时弹层不关，server 文案原样显出', async ({ page }) => {
  await openBoardAccept(page, ['合并分支', '推送分支']);
  const reject = '缺少「推送分支」授权，合并被拒绝。';
  let merges = 0;
  await page.route(`**/api/builds/${BUILD_ID}/merge`, (route) => {
    merges += 1;
    return route.fulfill({ status: 403, json: { error: reject } });
  });

  await page.locator('.dlg-accept-done').click();
  // 前提守卫：请求真发出去了（否则「弹层没关」测的是别的东西）。
  await expect.poll(() => merges).toBe(1);
  await expect(page.locator('.dlg-accept')).toBeVisible();
  await expect(page.locator('.dlg-accept-reject')).toHaveText(reject);
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: resolve(SHOTS, 'XMON-89-board-403.png') });
});

test('合并成功（202）时弹层照常关，不留错误行', async ({ page }) => {
  await openBoardAccept(page, ['合并分支', '推送分支']);
  let merges = 0;
  await page.route(`**/api/builds/${BUILD_ID}/merge`, (route) => {
    merges += 1;
    return route.fulfill({ status: 202, json: { delegated: true } });
  });

  await page.locator('.dlg-accept-done').click();
  await expect.poll(() => merges).toBe(1);
  await expect(page.locator('.dlg-accept')).toHaveCount(0);
  await expect(page.locator('.dlg-accept-reject')).toHaveCount(0);
});