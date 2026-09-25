import { expect, test } from '@playwright/test';

// Issue #225 acceptance: docpane changes 面「显示完整文件」钮接线(#219 裁决 A)。
// fixture 面 = DiffFile.fullContent 槽供肉(fixtures.ts probeChanges);live 面 =
// GET /api/builds/{id}/changes/file?path=(#224,routes.ts:1118,本票 server 零改动),
// live 三态(加载中…/文件加载失败/二进制文件暂不支持预览,#202 同族词)归真机验。
// 钉死的失败方式:
// 1. 点击无反应(死钮残留)— 全文必须内联替换 hunk 区,钮文案翻转「显示差异」;
// 2. 两态不互斥 — 全文态下 hunk 头/±行必须隐去,全文带连续行号(1..N);
// 3. 无回路 — 再点必须回到 hunk 面,文案翻回「显示完整文件」;
// 4. 初始态污染 parity — 27b 初渲仍是 hunk 面 + 「显示完整文件」钮。

const ROUTE = '/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=27b';

test('初始态渲染 hunk 面与「显示完整文件」钮,无全文(parity 面不污染)', async ({ page }) => {
  await page.goto(ROUTE);
  await expect(page.locator('.diff-hunk-head')).toContainText('@@ -3,3 +3,4 @@');
  await expect(page.locator('.diff-expand')).toContainText('显示完整文件');
  await expect(page.locator('.diff-full')).toHaveCount(0);
});

test('点击内联展开全文:hunks 隐去、全文带连续行号、钮翻转「显示差异」', async ({ page }) => {
  await page.goto(ROUTE);
  await page.locator('.diff-expand').click();
  const full = page.locator('.diff-full');
  await expect(full).toBeVisible();
  // 全文含 hunk 窗(@@ -3,3 +3,4 @@)之外的行——第 1 行不在窗内
  await expect(full).toContainText('# r3 probe');
  await expect(full).toContainText('r7 rebaseline probe');
  // 行号连续从 1 起(末行 = hunk 窗 +1 行 = 6)
  await expect(full.locator('.diff-line')).toHaveCount(6);
  await expect(full.locator('.diff-line').first().locator('.diff-no--new')).toHaveText('1');
  await expect(full.locator('.diff-line').last().locator('.diff-no--new')).toHaveText('6');
  // 互斥:hunk 头与 ±行隐去
  await expect(page.locator('.diff-hunk-head')).toHaveCount(0);
  await expect(page.locator('.diff-line--add')).toHaveCount(0);
  await expect(page.locator('.diff-expand')).toContainText('显示差异');
});

test('再点回到 hunk 面,钮文案翻回「显示完整文件」', async ({ page }) => {
  await page.goto(ROUTE);
  await page.locator('.diff-expand').click();
  await expect(page.locator('.diff-full')).toBeVisible();
  await page.locator('.diff-expand').click();
  await expect(page.locator('.diff-full')).toHaveCount(0);
  await expect(page.locator('.diff-hunk-head')).toBeVisible();
  await expect(page.locator('.diff-line--add')).toHaveCount(1);
  await expect(page.locator('.diff-expand')).toContainText('显示完整文件');
});
