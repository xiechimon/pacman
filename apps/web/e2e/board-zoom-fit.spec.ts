import { expect, type Page, test } from '@playwright/test';
// #1035 常态（chief 未停靠）看板在缩放宽视口下的四列自适应：地板按
// data-chief-open 劈开——常态 --board-col-min (200px, tokens.css)，停靠态
// --board-col-min-docked (280px, #692 语义不动，board-docked-reflow.spec
// 钉它)。病灶（main 实测 2026-10-08）：单态 280px 地板在 110% 缩放
// （1440 物理宽 → CSS 视口 1309）接管，scrollWidth 1196 > clientWidth
// 1069，第 4 列出屏——阈值 1440/1436 ≈ 100.3%，任何 >100.3% 的缩放都中招。
// 缩放模拟 = CSS 视口等价宽（浏览器缩放 z% 于 1440 物理宽 → 视口 1440/z；
// 布局几何只由 CSS 像素决定，devicePixelRatio 不参与本链路）。
// 每条用例钉一个失败方式，全部断言几何，不断言 CSS 数值：
// 1. 常态窄视口地板仍接管：110%/120%/125% 三档（125% = 200px 地板的
//    实测极限档，列流值 (1152−240−34−42)/4 ≈ 209 ≥ 200）scroller 横溢
//    或第 4 列不完整落窗（用户报障本体）
// 2. 页面级漏溢：任一档位 documentElement.scrollWidth > clientWidth
//    （三层 overflow 必须把一切兜在 .board-scroller 里）
// 3. 地板被整个摘掉（minmax(0,1fr) 作弊修法 / min() 反例的常态侧）：
//    1024 常态列跌破 200 下限——常态地板仍要生效，放不下走诚实横滚
// 4. 停靠态地板被连带劈坏（票面 min() 反例：track 里写 min(...) 让地板
//    永不生效、停靠横滚消失）：窄视口 ⌘J 停靠后列必须回到 ≥280 且
//    横滚回归（#692 有意行为）
// 5. 状态劈开不随 data-chief-open 活翻：同一视口内 Escape 关抽屉后
//    必须回到常态几何（横滚消失、四列全见）
// 6. 最坏数据在边界宽破栏：125% 档超长标题卡横向溢出列
const STRESS = '/app?scenario=board-stress';
const NATURAL_FLOOR = 200; // --board-col-min（常态）的镜像值：钉几何，不读 CSS 变量
const DOCKED_FLOOR = 280; // --board-col-min-docked（⌘J 停靠态）的镜像值

// 1440 物理宽下的缩放 → CSS 视口宽（1440/z 取整）
const ZOOM_LEVELS = [
  { zoom: '110%', width: 1309 },
  { zoom: '120%', width: 1200 },
  { zoom: '125%', width: 1152 },
];

const drawer = (page: Page) => page.locator('.chief-drawer');
const scroller = (page: Page) => page.getByTestId('board-scroller');

/** ⌘J 开抽屉并等入场动画落定（board-docked-reflow.spec dock 同式）。 */
async function dock(page: Page) {
  await page.keyboard.press('Meta+j');
  await expect(page.locator('[data-route="board"][data-chief-open]')).toHaveCount(1);
  await drawer(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
}

/** scroller 可视窗 + 四列盒（board-docked-reflow.spec measure 同式）。 */
function measure(page: Page) {
  return scroller(page).evaluate((el) => {
    const s = el.getBoundingClientRect();
    return {
      scroller: { left: s.left, right: s.right, width: s.width },
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      scrollLeft: el.scrollLeft,
      columns: [...el.querySelectorAll('[data-column]')].map((c) => {
        const r = c.getBoundingClientRect();
        return {
          id: c.getAttribute('data-column'),
          left: r.left,
          right: r.right,
          width: r.width,
        };
      }),
    };
  });
}

const pageSpill = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe('natural-state board fits the zoomed-out-equivalent viewports (#1035)', () => {
  for (const { zoom, width } of ZOOM_LEVELS) {
    test(`no horizontal scroll at ${zoom} zoom (${width}px CSS viewport), all 4 columns whole`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 732 });
      await page.goto(STRESS);
      await page.waitForSelector('[data-column]');

      // 失败方式 1：常态窄视口地板接管（改前 1309 档 scrollWidth 1196 >
      // clientWidth 1069，第 4 列出屏）
      const m = await measure(page);
      expect(m.columns).toHaveLength(4);
      expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth);
      const last = m.columns[3]!;
      expect(last.right).toBeLessThanOrEqual(m.scroller.right + 1);
      // 常态地板仍在（列不许跌破 200——125% 档流值 ~209 贴着下限过）
      for (const c of m.columns) expect(c.width).toBeGreaterThanOrEqual(NATURAL_FLOOR - 1);
      // 失败方式 2：溢出漏给页面
      expect(await pageSpill(page)).toBeLessThanOrEqual(0);
    });
  }

  test('natural floor still holds at 1024: honest scroll instead of collapsed columns', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 732 });
    await page.goto(STRESS);
    await page.waitForSelector('[data-column]');

    // 失败方式 3：把地板整个摘掉的作弊修法。1024 常态可用
    // 1024−240 = 784，流值 (784−76)/4 = 177 < 200 → 下限必须接管：
    // 列守 200、溢出走 scroller 诚实横滚（#692 语义的常态延伸）。
    const m = await measure(page);
    for (const c of m.columns) expect(c.width).toBeGreaterThanOrEqual(NATURAL_FLOOR - 1);
    expect(m.scrollWidth).toBeGreaterThan(m.clientWidth);
    expect(await pageSpill(page)).toBeLessThanOrEqual(0);
  });

  test('floor follows data-chief-open live: ⌘J re-arms 280 with scroll, Escape restores the fit', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1309, height: 732 });
    await page.goto(STRESS);
    await page.waitForSelector('[data-column]');
    const natural = await measure(page);
    expect(natural.scrollWidth).toBeLessThanOrEqual(natural.clientWidth);

    // 失败方式 4：停靠态地板被连带劈坏。1309 停靠 board-main =
    // 1309−240−418 = 651 < 1196 → 280 下限接管、横滚回归（有意的 #692）。
    await dock(page);
    const docked = await measure(page);
    for (const c of docked.columns) expect(c.width).toBeGreaterThanOrEqual(DOCKED_FLOOR - 1);
    expect(docked.scrollWidth).toBeGreaterThan(docked.clientWidth);

    // 失败方式 5：劈开不随标记活翻（关抽屉后卡在停靠几何）
    await page.keyboard.press('Escape');
    await expect(drawer(page)).toHaveCount(0);
    const restored = await measure(page);
    expect(restored.scrollWidth).toBeLessThanOrEqual(restored.clientWidth);
    for (const c of restored.columns) expect(c.width).toBeGreaterThanOrEqual(NATURAL_FLOOR - 1);
    expect(await pageSpill(page)).toBeLessThanOrEqual(0);
  });

  test('worst-case card data stays in-column at the 125% boundary width', async ({ page }) => {
    await page.setViewportSize({ width: 1152, height: 732 });
    await page.goto(STRESS);
    await page.waitForSelector('[data-todo-id]');

    // 失败方式 6：边界宽（列 ~209px）下超长标题把卡撑出列
    const card = page.locator('[data-column="todo"] [data-todo-id]').first();
    const overflow = await card.evaluate((el) => ({
      spill: el.scrollWidth - el.clientWidth,
      titleSpill: (() => {
        const t = el.querySelector('h3');
        return t == null ? 0 : t.scrollWidth - t.clientWidth;
      })(),
    }));
    expect(overflow.spill).toBeLessThanOrEqual(1);
    expect(overflow.titleSpill).toBeLessThanOrEqual(1);
  });
});
