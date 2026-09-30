import { expect, type Page, test } from '@playwright/test';
// #504 看板列滚动：.board-scroller 是 grid，行高未钉时隐式行 auto 被列
// 内容撑破容器（h-full 列随之超出视口、overflow-y-hidden 裁掉底端），
// ColumnList 又没有 overflow 出口——溢出卡不可达。修形 = scroller 钉
// minmax(0,1fr) 单行（列恒贴视口）+ 列表自持 overflow-y auto（与
// secondary-body / res-body 原生滚动约定同形）。
// 数据面：fixture 命名场景 board-overflow（待开始 12 卡，fixtures.ts）。
// 每条用例钉一个失败方式：
// 1. 行高未钉：12 卡场景列底边冲出视口（grid-rows 缺失 = 列高跟内容走）
// 2. 列表无滚动出口：scrollHeight == clientHeight（overflow-y 缺失 =
//    内容溢出无处可去或被裁）
// 3. 滚动不可达：scrollTo / wheel 滚不动或 scrollTop 不涨（用户第二反馈
//    「支持滚动」的正面钉）
// 4. 列头不钉：随列表滚走（37px header 必须静止）
// 5. 存量场景几何漂移：01（两卡 + 三卡 probe）列底超出或 h-full 语义丢失
const OVERFLOW = '/app?scenario=board-overflow';
const list = (page: Page, column = 'todo') =>
  page.locator(`[data-column="${column}"] .board-column-list`);

test('溢出列底边不冲出视口：列贴 scroller 可视高度（行高钉死）', async ({ page }) => {
  await page.goto(OVERFLOW);
  const probe = await page.evaluate(() => {
    const scroller = document.querySelector('.board-scroller');
    const column = document.querySelector('[data-column="todo"]');
    if (scroller == null || column == null) return null;
    const s = scroller.getBoundingClientRect();
    const c = column.getBoundingClientRect();
    return { scrollerBottom: s.bottom, columnBottom: c.bottom, columnTop: c.top, scrollerTop: s.top };
  });
  expect(probe).not.toBeNull();
  // 列在视口内完整收边：底边不超 scroller 底缘（1px 容差 = 亚像素取整）
  expect(probe!.columnBottom).toBeLessThanOrEqual(probe!.scrollerBottom + 1);
  // 列顶对齐 scroller 内容顶（h-full 语义还在，列没有被压扁）
  expect(probe!.columnTop).toBeGreaterThanOrEqual(probe!.scrollerTop - 1);
});

test('卡片列表有滚动出口：scrollHeight > clientHeight 且容器可滚', async ({ page }) => {
  await page.goto(OVERFLOW);
  const metrics = await list(page).evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
    overflowY: getComputedStyle(el).overflowY,
  }));
  // 12 卡在 732 高视口必然溢出——若等号成立说明列表没接住内容（被外层
  // 裁掉）或视口没有撑出溢出，两种都算失败
  expect(metrics.overflowY).toBe('auto');
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
});

test('列表可滚：scrollTo 移动 scrollTop，滚轮同样生效', async ({ page }) => {
  await page.goto(OVERFLOW);
  const before = await list(page).evaluate((el) => el.scrollTop);
  await list(page).evaluate((el) => el.scrollTo({ top: 400 }));
  const after = await list(page).evaluate((el) => el.scrollTop);
  expect(after).toBeGreaterThan(before);
  // wheel 正面钉：光标悬在列表中央滚一屏，scrollTop 必须再涨
  const box = await list(page).boundingBox();
  if (box == null) throw new Error('overflow list missing');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const preWheel = await list(page).evaluate((el) => el.scrollTop);
  await page.mouse.wheel(0, 240);
  const postWheel = await list(page).evaluate((el) => el.scrollTop);
  expect(postWheel).toBeGreaterThan(preWheel);
});

test('列头固定：列表滚动时 header 的视口位置不动', async ({ page }) => {
  await page.goto(OVERFLOW);
  const header = page.locator('[data-column="todo"] .board-column-header');
  const before = (await header.boundingBox())!.y;
  await list(page).evaluate((el) => el.scrollTo({ top: 400 }));
  const after = (await header.boundingBox())!.y;
  expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
});

test('存量场景零漂移：01 列完整贴视口、列底不超 scroller 底缘', async ({ page }) => {
  await page.goto('/app?scenario=01');
  const probe = await page.evaluate(() => {
    const scroller = document.querySelector('.board-scroller');
    const columns = [...document.querySelectorAll('.board-column')];
    if (scroller == null || columns.length !== 4) return null;
    const s = scroller.getBoundingClientRect();
    return {
      scrollerBottom: s.bottom,
      bottoms: columns.map((c) => c.getBoundingClientRect().bottom),
      heights: columns.map((c) => c.getBoundingClientRect().height),
    };
  });
  expect(probe).not.toBeNull();
  for (const bottom of probe!.bottoms) {
    expect(bottom).toBeLessThanOrEqual(probe!.scrollerBottom + 1);
  }
  // 四列同高（h-full 语义保留）
  const first = probe!.heights[0]!;
  for (const h of probe!.heights) expect(Math.abs(h - first)).toBeLessThanOrEqual(1);
});
