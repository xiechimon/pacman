import { expect, type Page, test } from '@playwright/test';

// 会话列用户话语面（#612）：live transcript 的 role-user wire 行里混着系统
// 合成 prompt（daemon 任务文本 title+spec、CONTINUE 续轮指令、审核材料），
// 此前一律渲染成用户气泡——任务原文与描述区双渲染（用户报的「套娃」），
// 合成指令冒名用户话语。真实用户话语（steer/驳回）则纯文本裸渲染。
// 数据面 = live 面打桩（merge-reject.spec 的 stubBoot 纪律）。钉住的失败方式：
//  1. 任务原文再次双渲染（描述区之外还有一条含 spec 文本的气泡）
//  2. CONTINUE 续轮指令渲染成用户气泡
//  3. 审核宣告行渲染成用户气泡（应与「发起了合并」同族 note 行）
//  4. 真实 steer 话语丢 markdown（围栏成字面 ``` 文本）
//  5. 单段短消息的气泡几何漂移（24px 药丸高度，chat-type-measure 同律）
//  6. taskline（#seq+标题行）在任务文本行退场后错挂到 steer 气泡上

const TEAM_ID = 'team-1';
const USER_ID = 'user-1';
const AGENT_ID = 'agent-1';
const CARD_ID = 'todo-uw-1';
const BUILD_ID = 'build-uw-1';
const PROJECT_ID = 'proj-uw-1';

const TITLE = '登录按钮圆角与悬停过渡';
const SPEC = [
  '# 任务目标',
  '',
  '把圆角改成 **8px**，并且：',
  '',
  '- 悬停态加过渡',
].join('\n');
const TASK_PROMPT = `${TITLE}\n\n${SPEC}`;

const TEAM = { id: TEAM_ID, name: 'Team', createdAt: 0, plan: 'free', avatarStyle: null };
const USER = { id: USER_ID, displayName: 'Xmon Dai', avatarUrl: null };

const WIRE_CARD = {
  id: CARD_ID,
  teamId: TEAM_ID,
  projectId: PROJECT_ID,
  title: TITLE,
  spec: SPEC,
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

const STEER_MD = '按这个改：\n\n```css\n.login-btn { border-radius: 10px; }\n```';

let msgSeq = 0;
function msg(role: 'system' | 'user' | 'assistant', content: unknown, at: number) {
  msgSeq += 1;
  return { id: `msg-${msgSeq}`, role, content, createdAt: at };
}

/** 一次真实运行落库后的 wire 行序（2026-10-02 live 栈实测同形）：任务文本 →
 *  machine_selected → agent 答复 → CONTINUE 指令 → 审核宣告 → 用户 steer 两条
 *  → agent 收尾。 */
const MESSAGES = [
  msg('user', TASK_PROMPT, 1000),
  msg('system', JSON.stringify({ kind: 'machine_selected', machineId: 'm1', name: 'mbp' }), 1100),
  msg('assistant', [{ type: 'text', text: '好的，方案已就绪。' }], 1200),
  msg('user', '方案已确认。请按方案执行，完成改动。', 1300),
  msg('user', '发起了 AI 审核', 1400),
  msg('user', STEER_MD, 1500),
  msg('user', '收到，谢谢', 1600),
  msg('assistant', [{ type: 'text', text: '已完成修改。' }], 1700),
];

async function stubWorld(page: Page) {
  const json = (body: unknown, status = 200) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
  await page.route('**/api/**', (route, request) => {
    const url = new URL(request.url());
    const path = url.pathname;
    if (request.method() === 'GET') {
      if (path === '/api/teams') return route.fulfill(json([TEAM]));
      if (path === '/api/user/me') return route.fulfill(json(USER));
      if (path === '/api/projects') return route.fulfill(json([PROJECT]));
      if (path === '/api/todos') return route.fulfill(json([WIRE_CARD]));
      if (path === `/api/todos/${CARD_ID}`) return route.fulfill(json(WIRE_CARD));
      if (path === `/api/teams/${TEAM_ID}/members`) {
        return route.fulfill(json([
          { id: 'member-user', teamId: TEAM_ID, actorId: USER_ID, memberType: 'user', actor: USER },
          {
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
              modelId: 'stub-model',
              thinkingLevel: null,
              tools: [],
              secrets: [],
              skills: [],
              mcpServers: [],
            },
          },
        ]));
      }
      if (path === `/api/teams/${TEAM_ID}/notifications`) {
        return route.fulfill(json({ unreadThreadIds: [] }));
      }
      if (path === `/api/builds/${BUILD_ID}`) return route.fulfill(json(WIRE_BUILD));
      if (path === `/api/builds/${BUILD_ID}/steps`) return route.fulfill(json([]));
      if (path === `/api/builds/${BUILD_ID}/plans`) return route.fulfill(json([]));
      if (path === `/api/builds/${BUILD_ID}/usage`) return route.fulfill(json([]));
      if (path === `/api/builds/${BUILD_ID}/changes`) {
        return route.fulfill(json({ files: [] }));
      }
      if (path === `/api/conversations/${BUILD_ID}/messages`) {
        return route.fulfill(
          json({
            messages: MESSAGES,
            chips: [],
            historyEpoch: 0,
            steerPending: [],
            activeRun: null,
            nextCursor: null,
          }),
        );
      }
      return route.fulfill(json({ error: 'e2e stub: not the surface under test' }, 500));
    }
    return route.fulfill(json({ error: 'e2e stub: not the surface under test' }, 500));
  });
  await page.goto(`/app/todo/${CARD_ID}`);
  await expect(page.locator('.chat-col')).toBeVisible();
}

test('1. 任务原文只出现一次：描述区承担，气泡不再复述（套娃修复）', async ({ page }) => {
  await stubWorld(page);
  await expect(page.locator('.spec-block')).toContainText('任务目标');
  await expect(page.locator('.chat-bubble', { hasText: '任务目标' })).toHaveCount(0);
  await expect(page.locator('.chat-bubble', { hasText: '把圆角改成' })).toHaveCount(0);
});

test('2. CONTINUE 续轮指令不冒名用户气泡', async ({ page }) => {
  await stubWorld(page);
  await expect(page.locator('.chat-bubble', { hasText: '方案已确认' })).toHaveCount(0);
});

test('3. 审核宣告行 = note 家族（与「发起了合并」同形），不是气泡', async ({ page }) => {
  await stubWorld(page);
  await expect(page.locator('.chat-bubble', { hasText: '发起了 AI 审核' })).toHaveCount(0);
  await expect(page.locator('.chat-note', { hasText: 'Xmon Dai 发起了 AI 审核' })).toBeVisible();
});

test('4. 真实 steer 话语走 markdown：围栏成代码块，字面 ``` 不泄漏', async ({ page }) => {
  await stubWorld(page);
  const bubbles = page.locator('.chat-bubble');
  await expect(bubbles).toHaveCount(2);
  const md = bubbles.first();
  await expect(md).toHaveClass(/chat-bubble--md/);
  await expect(md.locator('.chat-md-code')).toContainText('border-radius: 10px');
  await expect(md).not.toContainText('```');
});

test('5. 单段短消息气泡保持 24px 药丸高度（几何不漂移）', async ({ page }) => {
  await stubWorld(page);
  const short = page.locator('.chat-bubble', { hasText: '收到，谢谢' });
  await expect(short).toBeVisible();
  const box = await short.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { h: Math.round(r.height), font: getComputedStyle(el).fontSize };
  });
  expect(box.h).toBe(24);
  expect(box.font).toBe('15px');
});

test('6. taskline 不错挂：任务文本行退场后没有 #seq 行残留', async ({ page }) => {
  await stubWorld(page);
  await expect(page.locator('.chat-taskline')).toHaveCount(0);
});
