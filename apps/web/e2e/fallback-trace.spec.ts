import { expect, type Page, test } from '@playwright/test';

// Build 详情时间线的兜底轨迹（XMON-46）：一个 build 里模型调用失败再换下一档
// 时，时间线上每次「换档」落一行轨迹，全部耗尽的终态行可展开看每次尝试与
// 原因。纯读面——不改 server/daemon 行为，行内容全部来自契约的
// stepJournalRow.attempts（shared modelAttemptSchema）。
//
// 映射（attempts → 行）由 test/fallback-trace.test.ts 钉；本 spec 钉渲染与
// 交互。canon：终态行的标题/指引/链接三行是既有文案，轨迹行与明细是纯增项。
//
// 每条断言钉一个失败方式：
// 1. 有 attempts 的失败面不出轨迹行 —— 换档过程在时间线上无迹可寻
// 2. 轨迹行文案缺件 —— 不出「模型 X」/「失败：<原文>」/「已切换 Y」任一件，
//    或 error 为空时仍拼出「失败：，已切换」
// 3. 轨迹行落错位置 —— 排到终态失败行之后（读起来像失败之后才换档）
// 4. 终态行没有展开入口 —— 逐次尝试与原因无从看起
// 5. 展开是死面 —— 点了不出明细，或明细不是 attempts 原序
// 6. 末次尝试无 error 时留空 —— 该格空白（看不出「这次没给原因」）
// 7. 收起不生效 —— 明细收不掉
// 8. 无 attempts（旧数据/未触发兜底）时多渲染 —— 轨迹行凭空出现，或终态行
//    长出切换钮（现行为被改）
//
// fixture 场景 = 'detail-fallback'（#12 失败面 + 三次模型尝试：两行切换 +
// 终态行带 attempts）与 '54'（同一 #12 的失败面，fail 行不带 attempts）。
const FALLBACK_DETAIL = '/app/todo/r8-12?scenario=detail-fallback';
const LEGACY_DETAIL = '/app/todo/r8-12?scenario=54';

/** 时间线容器里的兜底轨迹行（全集，DOM 序）。 */
function traceRows(page: Page) {
  return page.locator('.chat-para--fallback');
}

/** 终态失败行（唯一一条带 attempts 的失败文案行）。 */
function failRow(page: Page) {
  return page.locator('.chat-row', { has: page.locator('.chat-para--fail') });
}

test('每次换档落一行轨迹：模型 X 失败：<error>，已切换 Y', async ({ page }) => {
  await page.goto(FALLBACK_DETAIL);
  await expect(traceRows(page)).toHaveText([
    '模型 r3-gw/claude-sonnet-5 失败：429 rate limit exceeded for this account，已切换 claude-code/claude-opus-4-5',
    '模型 claude-code/claude-opus-4-5 失败：model not enabled for this key: claude-opus-4-5，已切换 claude-code/claude-sonnet-5',
  ]);
});

test('轨迹行排在终态失败行之前（换档发生在失败之前）', async ({ page }) => {
  await page.goto(FALLBACK_DETAIL);
  const order = await page
    .locator('.chat-para--fallback, .chat-para--fail')
    .evaluateAll((nodes) => nodes.map((node) => (node.className.includes('--fail') ? 'fail' : 'fb')));
  expect(order).toEqual(['fb', 'fb', 'fail']);
});

test('终态行可展开看每次尝试与原因（attempts 原序）', async ({ page }) => {
  await page.goto(FALLBACK_DETAIL);
  const row = failRow(page);
  const toggle = row.locator('.chat-fail-toggle');
  await expect(toggle).toHaveText('查看尝试记录');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  // 未展开时明细不在（不是藏在 0 高度里）
  await expect(row.locator('.chat-fail-attempts')).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(toggle).toHaveText('收起');
  const attempts = row.locator('.chat-fail-attempt');
  await expect(attempts).toHaveCount(3);
  // 原序：主模型首试在前，逐次换档按发生序
  await expect(row.locator('.chat-fail-attempt-model')).toHaveText([
    'r3-gw/claude-sonnet-5',
    'claude-code/claude-opus-4-5',
    'claude-code/claude-sonnet-5',
  ]);
  await expect(row.locator('.chat-fail-attempt-error')).toHaveText([
    '429 rate limit exceeded for this account',
    'model not enabled for this key: claude-opus-4-5',
    '未提供错误信息',
  ]);
});

test('展开的明细可收起', async ({ page }) => {
  await page.goto(FALLBACK_DETAIL);
  const row = failRow(page);
  await row.locator('.chat-fail-toggle').click();
  await expect(row.locator('.chat-fail-attempts')).toBeVisible();
  await row.locator('.chat-fail-toggle').click();
  await expect(row.locator('.chat-fail-attempts')).toHaveCount(0);
  await expect(row.locator('.chat-fail-toggle')).toHaveText('查看尝试记录');
});

test('无 attempts 的旧数据面：不出轨迹行，终态行也没有展开入口', async ({ page }) => {
  await page.goto(LEGACY_DETAIL);
  // 终态失败行照旧（canon 文案），但没有任何兜底痕迹
  await expect(page.locator('.chat-para--fail')).toHaveText('运行该任务的机器已离线');
  await expect(traceRows(page)).toHaveCount(0);
  await expect(page.locator('.chat-fail-toggle')).toHaveCount(0);
  await expect(page.locator('.chat-fail-attempts')).toHaveCount(0);
});