import { expect, test } from '@playwright/test';

// #1106 派发技能注入（渲染缝，fixture 面）：详情面 injected-skills 回查行。
// live 面的真值链由 mapTranscript 从 step.skillInjection 派生（unit：
// injected-skills-row.test.ts；live 探针：docs/verify/1106/，含 REST/SQLite/
// 浏览器 DOM 三面一致）——fixture 捕获面无 step 数据源，本 spec 用冻结 view
// item 场景钉渲染缝的行形（skills-routing.spec 先例）。失败方式：
//   1. 注入行不渲染技能名与命中原因（回查面失明——票面验收 4）
//   2. 零命中行丢「未注入技能」占位（零注入是可查事实，不是行缺席）
//   3. 行缺席的运行长出注入行（对照组零噪声律）

const ROUTE = '/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=skill-inject';
const ROUTE_ZERO = '/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=skill-inject-zero';
/** 无注入数据的对照面（r7 27 review 捕获，build 载荷在场）。 */
const ROUTE_NO_SKILLS = '/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=27';

test('the injected-skills row names each skill with its hit reason', async ({ page }) => {
  await page.goto(ROUTE);
  const row = page.getByTestId('injected-skills');
  await expect(row).toBeVisible();
  await expect(row).toContainText('注入技能：');
  await expect(row).toContainText('better-typography');
  await expect(row).toContainText('同域「前端界面」');
  await expect(row).toContainText('tdd');
  await expect(row).toContainText('显式点名');
});

test('a computed zero-hit run shows the no-skills placeholder, not absence', async ({ page }) => {
  await page.goto(ROUTE_ZERO);
  const row = page.getByTestId('injected-skills');
  await expect(row).toBeVisible();
  await expect(row).toContainText('未注入技能');
});

test('a run without an injection record grows no row (control zero-noise)', async ({ page }) => {
  await page.goto(ROUTE_NO_SKILLS);
  await expect(page.getByTestId('injected-skills')).toHaveCount(0);
});
