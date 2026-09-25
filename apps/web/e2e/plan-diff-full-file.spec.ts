import { expect, test } from '@playwright/test';

// Issue #244 acceptance: docpane plan-diff 面「显示完整文件」钮接线(#238 裁决 A)。
// 与 #225 changes 面同钮同族呈现(内联展开);数据源 = plans 读面已载的版本集+内容
// (GET /api/builds/{id}/plans 行带 content,05 册 M5 §1.2),to 版本全文进
// DiffFile.fullContent 槽——server 零新面。live 面归真机验。
// 钉死的失败方式:
// 1. 点击无反应(死钮残留)— 全文必须内联替换 hunk 区,钮文案翻转「显示差异」;
// 2. 两态不互斥 — 全文态下 hunk 头/±行必须隐去,全文带连续行号(1..N);
// 3. 无回路 — 再点必须回到 hunk 面,文案翻回「显示完整文件」;
// 4. 初始态污染 parity — 66 初渲仍是 hunk 面 + 「显示完整文件」钮,无 .diff-full;
// 5. 版本错配(plan-diff 特有)— 全文 = to 版本(v2:10 行,含 v2 新增提交行),
//    接成 v1 则 9 行且无提交行。

const ROUTE = '/app/todo/r8-15?scenario=66';

test('初始态渲染 hunk 面与「显示完整文件」钮,无全文(parity 面不污染)', async ({ page }) => {
  await page.goto(ROUTE);
  await expect(page.locator('.diff-hunk-head')).toContainText('@@ -1,9 +1,10 @@');
  await expect(page.locator('.diff-expand')).toContainText('显示完整文件');
  await expect(page.locator('.diff-full')).toHaveCount(0);
});

test('点击内联展开 to 版本全文:hunks 隐去、行号连续、钮翻转「显示差异」', async ({ page }) => {
  await page.goto(ROUTE);
  await page.locator('.diff-expand').click();
  const full = page.locator('.diff-full');
  await expect(full).toBeVisible();
  // to 版本(v2)全文:首尾行 + v2 独有的提交行(接成 v1 会丢此行)
  await expect(full).toContainText('## Context');
  await expect(full).toContainText('提交：改动完成后需创建一次 commit');
  await expect(full).toContainText('## 验证');
  // 行号连续从 1 起,末行 = LINES_V2 行数(10)
  await expect(full.locator('.diff-line')).toHaveCount(10);
  await expect(full.locator('.diff-line').first().locator('.diff-no--new')).toHaveText('1');
  await expect(full.locator('.diff-line').last().locator('.diff-no--new')).toHaveText('10');
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
