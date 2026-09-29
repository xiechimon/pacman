import { expect, type Page, test } from '@playwright/test';

// #403 看板标签筛选面：顶栏 chip 组（固定 6 词表 + 全部复位态），多选 =
// OR 并集，筛选态进 ?tags=（replace 写回不刷历史，scenario 等其余参保留），
// 无标签任务恒可见（裁决：筛选是附加收窄，不产生「任务凭空消失」），空结果
// = 板级明示文案 + 清除筛选钮（不是空白看板）。
// 数据面：fixture 命名场景 board-tags（跨列三卡：bug 待开始 / docs 执行中 /
// 无标签 待处理）与 board-tags-empty（两卡全 tagged）。bar 在 fixture 面受
// scenario.tags 门控——无标签数据的旧场景不渲染（视觉基线零漂移，首钉）。
// 每条用例钉一个失败方式：
// 1. 无 tags fixture 的旧场景渲染筛选条（视觉漂移 + 死控件面）
// 2. 词表/复位态渲染不全或默认态错（默认 = 全部活、无 URL 参）
// 3. 选中不收窄 / 无标签卡被滤隐 / URL 不带或吞掉 scenario 参
// 4. 多选实现成 AND（交集）而非 OR（并集）；URL 序不规整
// 5. 再点已选 chip 不解除（切换语义丢失）
// 6. 全部钮不清参不复位
// 7. 刷新/分享直达带参 URL 不预选（筛选态丢失）
// 8. 词表外名在 URL 里成活选（非法态渲染）
// 9. 空结果渲成空白看板或误导性列空文案；清除钮不回全量

const TAGS = '/app?scenario=board-tags';
const EMPTY = '/app?scenario=board-tags-empty';

const chip = (page: Page, name: string) => page.locator(`.tag-filter-chip[data-tag="${name}"]`);
const card = (page: Page, id: string) => page.locator(`.todo-card[data-todo-id="${id}"]`);

test('旧场景（无 tags fixture）不渲染筛选条，顶栏动作区不受影响', async ({ page }) => {
  await page.goto('/app?scenario=01');
  await expect(page.locator('.board-tag-filter')).toHaveCount(0);
  await expect(page.locator('.board-topbar-actions button')).toHaveCount(1);
});

test('筛选条 = 固定词表 6 chip + 全部复位态；默认全部活、URL 无参', async ({ page }) => {
  await page.goto(TAGS);
  await expect(page.locator('.tag-filter-chip')).toHaveCount(6);
  await expect(page.locator('.tag-filter-all')).toBeVisible();
  await expect(page.locator('.tag-filter-all')).toHaveAttribute('aria-pressed', 'true');
  for (const name of ['bug', 'feature', 'improvement', 'refactor', 'docs', 'chore']) {
    await expect(chip(page, name)).toHaveAttribute('aria-pressed', 'false');
  }
  expect(page.url()).not.toContain('tags=');
  // 三卡各就各位：bug 待开始 / docs 执行中 / 无标签 待处理
  await expect(card(page, 'tagfilter-bug')).toBeVisible();
  await expect(card(page, 'tagfilter-docs')).toBeVisible();
  await expect(card(page, 'tagfilter-plain')).toBeVisible();
});

test('选中收窄列面：命中卡可见、其余 tagged 卡隐、无标签卡恒可见；URL 带参且保 scenario', async ({
  page,
}) => {
  await page.goto(TAGS);
  await chip(page, 'bug').click();
  await expect(page).toHaveURL(/[?&]tags=bug(&|$)/);
  expect(page.url()).toContain('scenario=board-tags');
  await expect(chip(page, 'bug')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.tag-filter-all')).toHaveAttribute('aria-pressed', 'false');
  await expect(card(page, 'tagfilter-bug')).toBeVisible();
  await expect(card(page, 'tagfilter-docs')).toHaveCount(0);
  // 无标签恒可见（裁决面）
  await expect(card(page, 'tagfilter-plain')).toBeVisible();
  // 列计数随筛选联动
  await expect(page.locator('.board-column[data-column="todo"] .board-column-count')).toHaveText(
    '1',
  );
  await expect(
    page.locator('.board-column[data-column="building"] .board-column-count'),
  ).toHaveText('0');
  await expect(page.locator('.board-column[data-column="pending"] .board-column-count')).toHaveText(
    '1',
  );
});

test('多选 = OR 并集；URL 序 = 词表规范序（与点击序无关）', async ({ page }) => {
  await page.goto(TAGS);
  // 先点 docs 再点 bug——URL 仍按词表序 bug 在前
  await chip(page, 'docs').click();
  await chip(page, 'bug').click();
  await expect(page).toHaveURL(/[?&]tags=bug,docs(&|$)/);
  // 并集：两张 tagged 卡 + 无标签卡全在
  await expect(card(page, 'tagfilter-bug')).toBeVisible();
  await expect(card(page, 'tagfilter-docs')).toBeVisible();
  await expect(card(page, 'tagfilter-plain')).toBeVisible();
});

test('再点已选 chip = 解除该词（切换语义）', async ({ page }) => {
  await page.goto(TAGS);
  await chip(page, 'bug').click();
  await chip(page, 'docs').click();
  await expect(page).toHaveURL(/[?&]tags=bug,docs(&|$)/);
  await chip(page, 'docs').click();
  await expect(page).toHaveURL(/[?&]tags=bug(&|$)/);
  await expect(chip(page, 'docs')).toHaveAttribute('aria-pressed', 'false');
  await expect(card(page, 'tagfilter-docs')).toHaveCount(0);
  await expect(card(page, 'tagfilter-bug')).toBeVisible();
});

test('全部钮 = 复位：清参回全量', async ({ page }) => {
  await page.goto(TAGS);
  await chip(page, 'bug').click();
  await expect(page).toHaveURL(/[?&]tags=bug(&|$)/);
  await page.locator('.tag-filter-all').click();
  await expect(page).not.toHaveURL(/[?&]tags=/);
  await expect(page.locator('.tag-filter-all')).toHaveAttribute('aria-pressed', 'true');
  await expect(card(page, 'tagfilter-bug')).toBeVisible();
  await expect(card(page, 'tagfilter-docs')).toBeVisible();
  await expect(card(page, 'tagfilter-plain')).toBeVisible();
});

test('带参直达 = 预选（刷新/分享不丢筛选态）', async ({ page }) => {
  await page.goto(`${TAGS}&tags=docs`);
  await expect(chip(page, 'docs')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.tag-filter-all')).toHaveAttribute('aria-pressed', 'false');
  await expect(card(page, 'tagfilter-docs')).toBeVisible();
  await expect(card(page, 'tagfilter-bug')).toHaveCount(0);
  await expect(card(page, 'tagfilter-plain')).toBeVisible();
});

test('URL 里的词表外名被丢弃：无 chip 活选、全部态、全量可见', async ({ page }) => {
  await page.goto(`${TAGS}&tags=nope`);
  await expect(page.locator('.tag-filter-all')).toHaveAttribute('aria-pressed', 'true');
  await expect(chip(page, 'bug')).toHaveAttribute('aria-pressed', 'false');
  await expect(card(page, 'tagfilter-bug')).toBeVisible();
  await expect(card(page, 'tagfilter-docs')).toBeVisible();
  await expect(card(page, 'tagfilter-plain')).toBeVisible();
});

test('空结果 = 板级明示文案 + 清除筛选回全量（不是空白看板）', async ({ page }) => {
  await page.goto(EMPTY);
  await expect(card(page, 'tagfilter-e-bug')).toBeVisible();
  await chip(page, 'chore').click();
  await expect(page).toHaveURL(/[?&]tags=chore(&|$)/);
  const empty = page.locator('.board-tag-filter-empty');
  await expect(empty).toBeVisible();
  await expect(empty).toContainText('没有匹配所选标签的任务');
  // 列网格让位（不是四列各背一条误导性空文案）
  await expect(page.locator('.board-column')).toHaveCount(0);
  await page.locator('.board-tag-filter-clear').click();
  await expect(page).not.toHaveURL(/[?&]tags=/);
  await expect(page.locator('.board-column')).toHaveCount(4);
  await expect(card(page, 'tagfilter-e-bug')).toBeVisible();
  await expect(card(page, 'tagfilter-e-docs')).toBeVisible();
});
