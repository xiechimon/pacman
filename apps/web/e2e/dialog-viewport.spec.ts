import { expect, type Locator, test } from '@playwright/test';

// #193: 矮视口(800×500)+ 各弹窗最高内容态下,submit/取消恒在视口内可点,
// 内容区(.dlg-body)滚动而不推挤按钮区(.dlg-foot)。#175 只修了 provider
// 本弹窗,本 spec 把该验收钉到整族(DialogShell 全部 11 个消费点;自建
// `.dlg` 容器经 grep 证实不存在)。每条钉一个面的一种失败方式:
// 1. provider(#175 源头面):3 模型行 → body 溢出,submit 钉底且滚动不位移
// 2. mcp:请求头行动态增长 → create 钉底
// 3. secret / 5. agent / 6. charter:静态表单面 → submit/取消 在视口
// 4. machine:disclosure 展开(最高内容态)→ 底部链接在视口
// 7. chief-agent 列表 / 8. token:无按钮读面 → 面板整体不越视口
// 9. branch sync tab:全高 410 在 500 视口内天然装得下,压 360 视口验证
//    封顶后同步钮钉底;body 溢出
// 10. history 重跑 footer(57f)→ 重跑钮在视口
// 11. accept(34)→ 取消/完成在视口

test.use({ viewport: { width: 800, height: 500 } });

const CAP = 500 - 48; // .dlg max-height = 100vh - 48px
const TODO = '/app/todo/7ve0iOkQ-JBpSL98zSiGc';

/** 壳层封顶律:面板不越视口、高度不超 100vh-48。 */
async function expectShellCapped(dialog: Locator) {
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  if (box == null) return;
  expect(box.height).toBeLessThanOrEqual(CAP + 0.5);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(500.5);
}

/** .dlg-body 真溢出(内容被收进滚动区而非推出面板)。 */
async function expectBodyOverflows(dialog: Locator) {
  const size = await dialog
    .locator('.dlg-body')
    .evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
  expect(size.scroll).toBeGreaterThan(size.client);
}

test('provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移', async ({ page }) => {
  await page.goto('/app/resources/providers?scenario=01');
  await page.locator('.res-new').click();
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  const addModel = dialog.locator('.dlg-provider-model-add');
  await addModel.click();
  await addModel.click();
  await addModel.click();
  await expect(dialog.locator('[aria-label="模型 ID"]')).toHaveCount(3);
  await expectBodyOverflows(dialog);
  await expectShellCapped(dialog);
  const submit = dialog.locator('.dlg-provider-create');
  await expect(submit).toBeInViewport();
  // 内容区滚到底,钉底钮位置不动(滚动不推挤按钮区)
  const before = await submit.boundingBox();
  await dialog.locator('.dlg-body').evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  const after = await submit.boundingBox();
  expect(after).toEqual(before);
  await expect(submit).toBeInViewport();
});

test('mcp: 请求头行动态增长,create 钉底', async ({ page }) => {
  await page.goto('/app/resources/mcp-servers?scenario=01');
  await page.locator('.res-new').click();
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  const addHeader = dialog.locator('.dlg-mcp-header-add');
  await addHeader.click();
  await addHeader.click();
  await expect(dialog.locator('.dlg-mcp-header-row')).toHaveCount(3);
  await expectBodyOverflows(dialog);
  await expectShellCapped(dialog);
  await expect(dialog.locator('.dlg-mcp-create')).toBeInViewport();
});

test('secret: 静态表单面 submit 在视口', async ({ page }) => {
  await page.goto('/app/resources/secrets?scenario=01');
  await page.locator('.res-new').click();
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  await expectShellCapped(dialog);
  await expect(dialog.locator('.dlg-secret-create')).toBeInViewport();
});

test('machine: disclosure 展开(最高内容态)底部链接在视口', async ({ page }) => {
  await page.goto('/app/resources/machines?scenario=06');
  await page.locator('.res-add').click();
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  await dialog.locator('.dlg-enroll-toggle').click();
  await expect(dialog.locator('.dlg-enroll-apikey')).toBeVisible();
  await expectShellCapped(dialog);
  await expect(dialog.locator('.dlg-enroll-keylink')).toBeInViewport();
});

test('create-agent: submit 在视口', async ({ page }) => {
  await page.goto('/app/team?scenario=12');
  await page.locator('.team-create-agent').click();
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  await expectShellCapped(dialog);
  await expect(dialog.locator('.dlg-agent-create')).toBeInViewport();
});

test('charter: 取消/保存章程在视口', async ({ page }) => {
  await page.goto('/app?scenario=102');
  await page.locator('.chief-edit-btn').click();
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  await expectShellCapped(dialog);
  await expect(dialog.locator('.chief-dlg-ghost')).toBeInViewport();
  await expect(dialog.locator('.chief-dlg-primary')).toBeInViewport();
});

test('chief-agent 列表态(无按钮读面)面板整体不越视口', async ({ page }) => {
  await page.goto('/app?scenario=101');
  await page.locator('.chief-agent-row').click();
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  await expectShellCapped(dialog);
  await expect(dialog.locator('.chief-pick-list')).toBeInViewport();
});

test('token(纯读面)面板整体不越视口', async ({ page }) => {
  await page.goto(`${TODO}?scenario=30`);
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  await expectShellCapped(dialog);
});

test('branch sync tab: 视口压过内容高,同步钮钉底,body 溢出;git tab 正常', async ({ page }) => {
  // sync tab 全高约 410——500 视口天然装得下,压到 360 才触发封顶钉底
  await page.setViewportSize({ width: 800, height: 360 });
  await page.goto(`${TODO}?scenario=31`);
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  await expectBodyOverflows(dialog);
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  if (box == null) return;
  expect(box.height).toBeLessThanOrEqual(360 - 48 + 0.5);
  await expect(dialog.locator('.dlg-sync')).toBeInViewport();
  // git tab 无 footer,面板仍在视口内
  await dialog.locator('.dlg-seg-tab', { hasText: 'Git' }).click();
  await expect(dialog.locator('.dlg-sync')).toHaveCount(0);
  await expect(dialog.locator('.dlg-branch-body')).toBeInViewport();
});

test('history 重跑 footer(57f): 重跑钮在视口', async ({ page }) => {
  await page.goto('/app/todo/r8-failed-12?scenario=57f');
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  await expectShellCapped(dialog);
  await expect(dialog.locator('.dlg-history-rerun')).toBeInViewport();
});

test('accept(34): 取消/完成在视口', async ({ page }) => {
  await page.goto('/app?scenario=34');
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  await expectShellCapped(dialog);
  await expect(dialog.locator('.dlg-accept-cancel')).toBeInViewport();
  await expect(dialog.locator('.dlg-accept-done')).toBeInViewport();
});
