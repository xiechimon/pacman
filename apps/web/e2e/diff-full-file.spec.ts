import { expect, test } from '@playwright/test';

// Issue #225 acceptance: docpane changes 面「显示完整文件」钮接线(#219 裁决 A)。
// fixture 面 = DiffFile.fullContent 槽供肉(fixtures.ts probeChanges);live 面 =
// GET /api/builds/{id}/changes/file?path=(#224,routes.ts:1118,本票 server 零改动),
// live 三态(加载中…/文件加载失败/二进制文件暂不支持预览,#202 同族词)归真机验。
// 钉死的失败方式:
// 1. 点击无反应(死钮残留)— 全文必须内联替换 hunk 区,钮文案翻转「显示差异」;
// 2. 两态不互斥 — 全文态下 hunk 头/±行必须隐去,全文带连续行号(1..N);
// 3. 无回路 — 再点必须回到 hunk 面,文案翻回「显示完整文件」;
// 4. 初渲不污染 — 27b 初渲仍是 hunk 面 + 「显示完整文件」钮。
//
// #945/#910 重钉：detail.css 退役——展开钮 = role=button+文案一级；全文
// 容器 = diff-full testid（零 CSS 结构钩转二级载体）；diff 行/格状态走
// data-kind / data-no 数据载体（裁定 3：状态类归行为，类名别名残留 DOM
// 至终账票）；hunk 头 = 其唯一文本一级载体。

const ROUTE = '/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=27b';

test('初始态渲染 hunk 面与「显示完整文件」钮,无全文(初渲不污染)', async ({ page }) => {
  await page.goto(ROUTE);
  await expect(page.getByText('@@ -3,3 +3,4 @@')).toBeVisible();
  await expect(page.getByRole('button', { name: '显示完整文件' })).toBeVisible();
  await expect(page.getByTestId('diff-full')).toHaveCount(0);
});

test('点击内联展开全文:hunks 隐去、全文带连续行号、钮翻转「显示差异」', async ({ page }) => {
  await page.goto(ROUTE);
  await page.getByRole('button', { name: '显示完整文件' }).click();
  const full = page.getByTestId('diff-full');
  await expect(full).toBeVisible();
  // 全文含 hunk 窗(@@ -3,3 +3,4 @@)之外的行——第 1 行不在窗内
  await expect(full).toContainText('# r3 probe');
  await expect(full).toContainText('r7 rebaseline probe');
  // 行号连续从 1 起(末行 = hunk 窗 +1 行 = 6)
  await expect(full.locator('[data-kind]')).toHaveCount(6);
  await expect(full.locator('[data-no="new"]').first()).toHaveText('1');
  await expect(full.locator('[data-no="new"]').last()).toHaveText('6');
  // 互斥:hunk 头与 ±行隐去
  await expect(page.getByText('@@ -3,3 +3,4 @@')).toHaveCount(0);
  await expect(page.locator('[data-kind="add"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '显示差异' })).toBeVisible();
});

test('再点回到 hunk 面,钮文案翻回「显示完整文件」', async ({ page }) => {
  await page.goto(ROUTE);
  await page.getByRole('button', { name: '显示完整文件' }).click();
  await expect(page.getByTestId('diff-full')).toBeVisible();
  await page.getByRole('button', { name: '显示差异' }).click();
  await expect(page.getByTestId('diff-full')).toHaveCount(0);
  await expect(page.getByText('@@ -3,3 +3,4 @@')).toBeVisible();
  await expect(page.locator('[data-kind="add"]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '显示完整文件' })).toBeVisible();
});
