import { expect, type Page, test } from '@playwright/test';

// #753 acceptance: committed-drop optimistic PATCH + invalidate for the newly
// enabled pairs — 已完成(有变更)→待处理（重开落位，写 review）on the LIVE data
// branch（无 ?scenario= 即真 API 面；数据面打桩承 merge-reject 的 stubBoot
// 纪律：teams / user me / projects / todos 供数，其余 GET 一律 500，应用既有
// isError 耐受）。钉两条路：
//  · 成功路：落位同帧发 PATCH {phase:'review'}，乐观缓存让卡停在落点（无
//    闪回源列），invalidate 重取收敛到 server 真值；
//  · 失败路：409 = 乐观值作废，重取回真值（卡片弹回 = 真值）+ toast 点名
//    失败（#638 弹回只讲结果不讲原因，toast 补原因）。

const TEAM_ID = 'team-1';
const CARD_ID = 'todo-753';
const PROJECT_ID = 'proj-753';

const TEAM = { id: TEAM_ID, name: 'Team', createdAt: 0, plan: 'free', avatarStyle: null };
const USER = { id: 'user-1', displayName: '我', avatarUrl: null };
const PROJECT = {
  id: PROJECT_ID,
  name: 'pacman',
  teamId: TEAM_ID,
  repoKind: 'hosted',
  repoName: 'pacman',
  githubRepo: null,
  localPath: null,
};

function wireCard(phase: string, v: number) {
  return {
    id: CARD_ID,
    teamId: TEAM_ID,
    projectId: PROJECT_ID,
    title: 'reopen 探针',
    spec: 'reopen 探针',
    phase,
    phaseAt: 0,
    seqNum: 9,
    orderIndex: 0,
    tagIds: [],
    assignment: null,
    agent: null,
    latestBuildId: 'build-753',
    lastRunAt: 0,
    hasChanges: true,
    hasPlan: false,
    buildHistory: [{ buildId: 'build-753', createdAt: 0 }],
    sourceTodo: null,
    v,
  };
}

interface Stub {
  patches: { body: Record<string, unknown> }[];
}

/** 启动面打桩（merge-reject stubBoot 同款）+ todos 读写面。mode='ok'：PATCH
 *  落库（本地 state 翻 review，后续 GET 返回新真值）；mode='409'：PATCH 拒，
 *  state 不动（invalidate 重取 = 原相位，弹回即真值）。 */
async function stubWorld(page: Page, mode: 'ok' | '409'): Promise<Stub> {
  const stub: Stub = { patches: [] };
  let current = wireCard('done', 1);
  await page.route('**/api/**', (route, request) => {
    if (request.method() !== 'GET') return route.fallback();
    return route.fulfill({ status: 500, json: { error: 'e2e stub: not the surface under test' } });
  });
  await page.route('**/api/teams', (route) => route.fulfill({ json: [TEAM] }));
  await page.route('**/api/user/me', (route) => route.fulfill({ json: USER }));
  await page.route('**/api/projects', (route) => route.fulfill({ json: [PROJECT] }));
  await page.route('**/api/todos?*', (route) => route.fulfill({ json: [current] }));
  await page.route(`**/api/todos/${CARD_ID}`, (route, request) => {
    if (request.method() !== 'PATCH') return route.fallback();
    const body = JSON.parse(request.postData() ?? '{}') as Record<string, unknown>;
    stub.patches.push({ body });
    if (mode === '409') {
      return route.fulfill({ status: 409, json: { error: 'illegal phase transition' } });
    }
    current = { ...current, phase: String(body.phase ?? current.phase), v: current.v + 1 };
    return route.fulfill({ json: current });
  });
  return stub;
}

/** Press the done card and carry it into the pending column's list area;
 *  leaves the button down (caller arms the trace, then ups). */
async function dragDoneToPending(page: Page): Promise<void> {
  const fromBox = await page.locator(`.todo-card[data-todo-id="${CARD_ID}"]`).boundingBox();
  if (fromBox == null) throw new Error('done card missing');
  const list = await page.locator('[data-column="pending"] .board-column-list').boundingBox();
  if (list == null) throw new Error('pending list missing');
  const sx = fromBox.x + fromBox.width / 2;
  const sy = fromBox.y + fromBox.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx - 8, sy + 6, { steps: 4 });
  await page.mouse.move(list.x + list.width / 2, list.y + 60, { steps: 12 });
  await page
    .locator('.board-drag-overlay .board-drag-card')
    .waitFor({ state: 'visible', timeout: 15_000 });
  await page.evaluate(
    () => new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(() => res()))),
  );
}

test('live: done(有变更)→待处理 fires PATCH phase=review, optimistic landing never flashes back', async ({
  page,
}) => {
  const stub = await stubWorld(page, 'ok');
  await page.goto('/app');
  await expect(page.locator(`[data-column="done"] .todo-card[data-todo-id="${CARD_ID}"]`)).toBeVisible();

  await dragDoneToPending(page);
  await expect(page.locator('[data-column="pending"]')).toHaveAttribute('data-drop', 'true');

  // arm the flash trace, then release
  await page.evaluate((id) => {
    const trace: { t: number; col: string | null }[] = [];
    (window as unknown as { __flashTrace: typeof trace }).__flashTrace = trace;
    const t0 = performance.now();
    const tick = () => {
      const grid = document.querySelector(`.board-scroller .todo-card[data-todo-id="${id}"]`);
      trace.push({
        t: Math.round(performance.now() - t0),
        col: grid?.closest('section[data-column]')?.getAttribute('data-column') ?? null,
      });
      if (performance.now() - t0 < 600) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, CARD_ID);

  await page.mouse.up();
  await page.waitForTimeout(700);

  // the optimistic PATCH fired with the reopen phase (载体 = 手动改相面)
  expect(stub.patches.length).toBeGreaterThanOrEqual(1);
  expect(stub.patches[0]?.body.phase).toBe('review');

  // no post-commit frame rendered the card back in the source column, and it
  // settled in 待处理 (invalidate 重取收敛后仍在——server 真值同相).
  // NOTE: the trace arms BEFORE mouse.up, and the source card stays pinned in
  // its home slot for the whole gesture (draggable-card never writes the
  // transform back) — pre-commit done frames are the drag state, not a
  // flash-back. The real regression shape is pending → done, so only frames
  // AFTER the first pending landing count.
  const trace = await page.evaluate(
    () => (window as unknown as { __flashTrace: { t: number; col: string | null }[] }).__flashTrace,
  );
  const firstPending = trace.findIndex((s) => s.col === 'pending');
  expect(firstPending, 'card never landed in 待处理 during the trace').toBeGreaterThanOrEqual(0);
  const backFrames = trace.slice(firstPending + 1).filter((s) => s.col === 'done');
  expect(backFrames, `frames back in 已完成: ${JSON.stringify(backFrames)}`).toEqual([]);
  await expect(
    page.locator(`[data-column="pending"] .todo-card[data-todo-id="${CARD_ID}"]`),
  ).toBeVisible();
  await expect(page.locator('[data-column="pending"] .board-column-count')).toHaveText('1');
  await expect(page.locator('[data-column="done"] .board-column-count')).toHaveText('0');
  // the reopened card reads as the review gate (action button 完成 =
  // PHASE_UI[review]；徽标纯图标无文字，整卡断 chip 词恒错)
  await expect(
    page.locator(`[data-column="pending"] .todo-card[data-todo-id="${CARD_ID}"] .todo-card-action`),
  ).toHaveText('完成');
});

test('live: PATCH 409 = 乐观值作废，卡片弹回源列 + toast 点名失败（#638）', async ({ page }) => {
  const stub = await stubWorld(page, '409');
  await page.goto('/app');
  await expect(page.locator(`[data-column="done"] .todo-card[data-todo-id="${CARD_ID}"]`)).toBeVisible();

  await dragDoneToPending(page);
  await page.mouse.up();

  // the bounce-back IS the truth: server refused, invalidate refetch returns
  // the original phase, the card renders back in 已完成
  await expect(
    page.locator(`[data-column="done"] .todo-card[data-todo-id="${CARD_ID}"]`),
    'card bounced back to 已完成',
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-column="done"] .board-column-count')).toHaveText('1');
  await expect(page.locator('[data-column="pending"] .board-column-count')).toHaveText('0');
  // and the toast names the failure (#638: 弹回只讲结果，toast 讲原因)
  await expect(page.locator('[data-sonner-toast]').first()).toBeVisible();
  await expect(page.locator('[data-sonner-toast]').first()).toContainText('移动任务失败');
  expect(stub.patches.length).toBeGreaterThanOrEqual(1);
});
