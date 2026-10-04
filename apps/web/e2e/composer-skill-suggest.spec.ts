// Natural-language skill auto-suggest (issue #823): the ghost hint bar.
// The wire matches plain prose against the first-batch trigger table and,
// when a team skill fits, shows `.skill-suggest` — Tab / click accepts the
// skill token at the caret, Esc / close single-ignores it. The strip never
// co-opens with the `/` or `@` menus (they own their keys).
//
// Failure modes pinned here (live detail face, stubBoot discipline borrowed
// from composer-slash.spec):
//   1. trigger prose shows the strip; Tab accepts the token, prose intact;
//   2. Esc dismisses and further typing never resurrects the same nudge;
//   3. the close button dismisses the same way;
//   4. an open `/` or `@` menu suppresses the strip (no key clash);
//   5. chatter, slash lines and skill-less teams stay silent.

import { expect, type Page, test } from '@playwright/test';
import { evidenceShot } from './evidence';

const TEAM_ID = 'team-1';
const USER = { id: 'user-1', displayName: '我', avatarUrl: null };
const TEAM = { id: TEAM_ID, name: 'Team', createdAt: 0, plan: 'free', avatarStyle: null };

const CARD_ID = 'todo-1';
const BUILD_ID = 'build-1';
const PROJECT_ID = 'proj-1';

const WIRE_CARD = {
  id: CARD_ID,
  teamId: TEAM_ID,
  projectId: PROJECT_ID,
  title: '自然话 skill 提示探针',
  spec: '',
  phase: 'building',
  phaseAt: 0,
  seqNum: 9,
  orderIndex: 0,
  tagIds: [],
  assignment: null,
  agent: null,
  latestBuildId: BUILD_ID,
  lastRunAt: 0,
  hasChanges: false,
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

const EMPTY_CONVERSATION = {
  messages: [],
  chips: null,
  historyEpoch: 0,
  steerPending: [],
  activeRun: null,
  nextCursor: null,
};

const AGENTS = [{ id: 'agent-1', displayName: 'builder', description: 'Builds features' }];

const SKILLS = [
  {
    id: 'remind',
    teamId: TEAM_ID,
    name: 'remind',
    description: 'schedule reminders and notifications',
  },
  { id: 'translate', teamId: TEAM_ID, name: 'translate', description: '翻译文本' },
];

async function stubBoot(page: Page) {
  await page.route('**/api/**', (route, request) => {
    if (request.method() !== 'GET') return route.fallback();
    return route.fulfill({ status: 500, json: { error: 'e2e stub: not the surface under test' } });
  });
  await page.route('**/api/teams', (route) => route.fulfill({ json: [TEAM] }));
  await page.route('**/api/user/me', (route) => route.fulfill({ json: USER }));
  await page.route(`**/api/teams/${TEAM_ID}/notifications`, (route) =>
    route.fulfill({ json: { unreadThreadIds: [] } }),
  );
}

async function openDetail(page: Page, skills: unknown[] = SKILLS) {
  await stubBoot(page);
  const members = [
    { id: 'member-user', teamId: TEAM_ID, actorId: USER.id, memberType: 'user', actor: USER },
    ...AGENTS.map((a, i) => ({
      id: `member-agent-${i}`,
      teamId: TEAM_ID,
      actorId: a.id,
      memberType: 'agent',
      actor: a,
    })),
  ];
  await page.route(`**/api/teams/${TEAM_ID}/members`, (route) => route.fulfill({ json: members }));
  await page.route('**/api/skills*', (route) => route.fulfill({ json: skills }));
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
    route.fulfill({ json: EMPTY_CONVERSATION }),
  );
  const skillsLoaded = page.waitForResponse(
    (r) => r.url().includes('/api/skills') && r.status() === 200,
  );
  await page.goto(`/app/todo/${CARD_ID}`);
  await skillsLoaded;
  const input = page.locator('.composer-input');
  await expect(input).toBeVisible();
  await expect(input).toBeEditable();
  return { input, strip: page.locator('.skill-suggest') };
}

test('trigger prose shows the strip; Tab accepts the token, prose intact', async ({ page }) => {
  const { input, strip } = await openDetail(page);

  await input.fill('明早 9 点提醒我开会');
  await expect(strip).toBeVisible();
  await expect(strip).toContainText('remind');
  await evidenceShot(page, 'suggest-strip.png');

  await input.press('Tab');
  // The mention-token spacing discipline puts one space before the token.
  await expect(input).toHaveValue('明早 9 点提醒我开会 [remind](skill:remind) ');
  // The draft now references the skill — the nudge goes quiet on its own.
  await expect(strip).toBeHidden();
  await evidenceShot(page, 'suggest-accepted.png');
});

test('Esc dismisses; further typing never resurrects the same nudge', async ({ page }) => {
  const { input, strip } = await openDetail(page);

  await input.fill('明早 9 点提醒我开会');
  await expect(strip).toBeVisible();
  await input.press('Escape');
  await expect(strip).toBeHidden();

  await input.pressSequentially('，别忘了');
  await expect(strip).toBeHidden();
  // A different intent still nudges (the ignore is per-suggestion, not a gag).
  await input.pressSequentially('，再翻译成英文');
  await expect(strip).toBeVisible();
  await expect(strip).toContainText('translate');
});

test('the close button dismisses the same way', async ({ page }) => {
  const { input, strip } = await openDetail(page);

  await input.fill('翻译这段话');
  await expect(strip).toBeVisible();
  await strip.locator('.skill-suggest-close').click();
  await expect(strip).toBeHidden();
  await expect(input).toHaveValue('翻译这段话');
});

test('open slash or at menus suppress the strip', async ({ page }) => {
  const { input, strip } = await openDetail(page);
  const slashMenu = page.locator('.slash-menu');
  const atList = page.locator('.mention-inline');

  await input.fill('明早提醒我 /');
  await expect(slashMenu).toBeVisible();
  await expect(strip).toBeHidden();
  await input.press('Escape');
  await expect(slashMenu).toBeHidden();
  // The slash token is gone with Esc — retype prose, the strip returns.
  await input.fill('明早提醒我开会');
  await expect(strip).toBeVisible();

  await input.fill('hi @b');
  await expect(atList).toBeVisible();
  await expect(strip).toBeHidden();
});

test('chatter, slash lines and skill-less teams stay silent', async ({ page }) => {
  const { input, strip } = await openDetail(page);

  await input.fill('今天天气不错');
  await expect(strip).toBeHidden();

  await input.fill('/remind');
  await expect(strip).toBeHidden();
});

test('a team without a matching skill stays silent', async ({ page }) => {
  const { input, strip } = await openDetail(page, [
    { id: 'spell', teamId: TEAM_ID, name: 'spell-check', description: 'Checks spelling' },
  ]);

  await input.fill('明早 9 点提醒我开会');
  await expect(strip).toBeHidden();
});
