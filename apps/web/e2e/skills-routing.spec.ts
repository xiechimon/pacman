import { expect, test } from '@playwright/test';

// Issue #919 seam 4（前端腿，fixture 面）：技能路由事件在详情页必须可见——
// 线程列出现技能条目（读取命中 + 被 deny 拦截两态），右栏型选多出「技能」
// 汇总节（同名计数 + 拦截 chip）。每条测试钉一个失败方式：
//   1. 技能条目行不出现 / 名字错（路由命中的 UI 面失明 = 主判据「在产物里
//      指出命中了哪个技能」的产品面缺位）
//   2. 被拦截事件不可见或与命中态不可区分（deny 面失明）
//   3. 汇总节缺失 / 计数失真（同名多次读取、拦截并存）
//   4. 零技能事件的运行也长出「技能」行（dead row，违背型选族律）
// live 面的同词表检测逻辑由 apps/web/test/transcript-skill-rows.test.ts
// 钉（mapper 单测），本 spec 钉渲染与交互。

const ROUTE = '/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=skills-routing';
/** 零技能事件的对照面（r7 27 review 捕获，build 载荷在场）。 */
const ROUTE_NO_SKILLS = '/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=27';

test('skill rows surface in the thread column — read hits and the blocked deny event', async ({
  page,
}) => {
  await page.goto(ROUTE);
  const rows = page.getByTestId('skill-row');
  await expect(rows).toHaveCount(3);

  // 命中态：读取技能 <name>（两次 haiku-helper 各自成行——事件流不是汇总）。
  // data-blocked 挂在行本体上，:not() 属性选择器直取（has/hasNot 找的是后代）。
  const hits = page.locator('[data-testid="skill-row"]:not([data-blocked])');
  await expect(hits).toHaveCount(2);
  await expect(hits.first()).toContainText('读取技能 haiku-helper');
  await expect(hits.first()).toHaveAttribute('data-skill-name', 'haiku-helper');

  // 拦截态（deny 可见）：独立文案 + data-blocked 载体（色相断言归视觉面，
  // 这里钉语义载体与名字）
  const blocked = page.locator('[data-testid="skill-row"][data-blocked="true"]');
  await expect(blocked).toHaveCount(1);
  await expect(blocked).toContainText('技能 local-blocked 被拦截（未授权）');
  await expect(blocked).toHaveAttribute('data-skill-name', 'local-blocked');
});

test('the pane type select lists 技能 and the section summarizes per skill', async ({ page }) => {
  await page.goto(ROUTE);
  const right = page.getByTestId('detail-right');
  await expect(right.getByTestId('doc-pane')).toBeVisible();

  await page.locator('.doc-select-wrap .doc-pane-select').click();
  const dropdown = page.getByRole('menu');
  await expect(dropdown).toBeVisible();
  // doc 行 + 三静止节 + 技能行（有事件才入列）
  await expect(dropdown.getByRole('menuitemradio')).toHaveCount(5);

  await dropdown.getByRole('menuitemradio', { name: '技能' }).click();
  await expect(dropdown).toBeHidden();
  const summary = right.getByTestId('skills-summary');
  await expect(summary).toBeVisible();
  const summaryRows = right.getByTestId('skill-summary-row');
  await expect(summaryRows).toHaveCount(2);

  const haiku = right.locator('[data-testid="skill-summary-row"][data-skill-name="haiku-helper"]');
  await expect(haiku).toContainText('读取 ×2');
  await expect(haiku.getByTestId('skill-blocked-count')).toHaveCount(0);

  const blockedRow = right.locator(
    '[data-testid="skill-summary-row"][data-skill-name="local-blocked"]',
  );
  await expect(blockedRow.getByTestId('skill-blocked-count')).toContainText('拦截 ×1');
  await expect(blockedRow).toContainText('读取 ×0');
});

test('a run without skill events grows no 技能 row (no dead rows)', async ({ page }) => {
  await page.goto(ROUTE_NO_SKILLS);
  await page.locator('.doc-select-wrap .doc-pane-select').click();
  const dropdown = page.getByRole('menu');
  await expect(dropdown).toBeVisible();
  await expect(dropdown.getByRole('menuitemradio')).toHaveCount(4);
  await expect(dropdown.getByRole('menuitemradio', { name: '技能' })).toHaveCount(0);
});
