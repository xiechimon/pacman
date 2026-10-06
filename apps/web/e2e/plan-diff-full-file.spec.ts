import { expect, test } from '@playwright/test';

// Issue #244 acceptance: docpane plan-diff 面「显示完整文件」钮接线(#238 裁决 A)。
// 与 #225 changes 面同钮同族呈现(内联展开);数据源 = plans 读面已载的版本集+内容
// (GET /api/builds/{id}/plans 行带 content,05 册 M5 §1.2),to 版本全文进
// DiffFile.fullContent 槽——server 零新面。live 面归真机验。
// 钉死的失败方式:
// 1. 点击无反应(死钮残留)— 全文必须内联替换 hunk 区,钮文案翻转「显示差异」;
// 2. 两态不互斥 — 全文态下 hunk 头/±行必须隐去,全文带连续行号(1..N);
// 3. 无回路 — 再点必须回到 hunk 面,文案翻回「显示完整文件」;
// 4. 初渲不污染 — 66 初渲仍是 hunk 面 + 「显示完整文件」钮,无全文容器;
// 5. 版本错配(plan-diff 特有)— 全文 = to 版本(v2:10 行,含 v2 新增提交行),
//    接成 v1 则 9 行且无提交行。
//
// #945/#910 重钉：与 diff-full-file 同套载体（role=button+文案 / diff-full
// testid / data-kind / data-no / hunk 头文本一级）。

const ROUTE = '/app/todo/r8-15?scenario=66';

test('初始态渲染 hunk 面与「显示完整文件」钮,无全文(初渲不污染)', async ({ page }) => {
  await page.goto(ROUTE);
  await expect(page.getByText('@@ -1,9 +1,10 @@')).toBeVisible();
  await expect(page.getByRole('button', { name: '显示完整文件' })).toBeVisible();
  await expect(page.getByTestId('diff-full')).toHaveCount(0);
});

test('点击内联展开 to 版本全文:hunks 隐去、行号连续、钮翻转「显示差异」', async ({ page }) => {
  await page.goto(ROUTE);
  await page.getByRole('button', { name: '显示完整文件' }).click();
  const full = page.getByTestId('diff-full');
  await expect(full).toBeVisible();
  // to 版本(v2)全文:首尾行 + v2 独有的提交行(接成 v1 会丢此行)
  await expect(full).toContainText('## Context');
  await expect(full).toContainText('提交：改动完成后需创建一次 commit');
  await expect(full).toContainText('## 验证');
  // 行号连续从 1 起,末行 = LINES_V2 行数(10)
  await expect(full.locator('[data-kind]')).toHaveCount(10);
  await expect(full.locator('[data-no="new"]').first()).toHaveText('1');
  await expect(full.locator('[data-no="new"]').last()).toHaveText('10');
  // 互斥:hunk 头与 ±行隐去
  await expect(page.getByText('@@ -1,9 +1,10 @@')).toHaveCount(0);
  await expect(page.locator('[data-kind="add"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '显示差异' })).toBeVisible();
});

test('再点回到 hunk 面,钮文案翻回「显示完整文件」', async ({ page }) => {
  await page.goto(ROUTE);
  await page.getByRole('button', { name: '显示完整文件' }).click();
  await expect(page.getByTestId('diff-full')).toBeVisible();
  await page.getByRole('button', { name: '显示差异' }).click();
  await expect(page.getByTestId('diff-full')).toHaveCount(0);
  await expect(page.getByText('@@ -1,9 +1,10 @@')).toBeVisible();
  await expect(page.locator('[data-kind="add"]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '显示完整文件' })).toBeVisible();
});
