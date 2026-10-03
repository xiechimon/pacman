import { expect, type Page, test } from '@playwright/test';
// #692 ⌘J 停靠态的 board reflow：单源规则 = 列宽下限 --board-col-min
// (280px, tokens.css) + 溢出走 .board-scroller 横滚 + 滚动条原生可见
// (board.css)。病灶（main 实测 2026-10-03）：旧 240px 开态护栏在 1440
// 停靠态恰好排满三列（748 = 3×240+2×14），第四列只剩 ~3px 残边且滚动条
// 被隐藏——溢出无任何可滚线索，用户读成「栏被裁」。参考站 todos.dev 同刻
// 实测：列 280px 固定节距从不压缩、横向滚动条原生（scrollbar-width:
// auto）、下一列在滚动缘露出部分宽度。
// 每条用例钉一个失败方式，全部断言几何（bounding box / scroll 行为），
// 不断言 CSS 数值（数值断言会被「改了但没用」骗过；scrollbar-width 是
// 披露机制本体，单独一条钉它）：
// 1. 停靠列被压扁：任一角列宽跌破 280 下限
// 2. 首列被裁：scroll 起点处第一列不完整落在 scroller 可视窗内
// 3. 残边无意义：滚动缘的部分列露出 <16px（better-layout 提示区间）
// 4. 溢出不可达：横滚不动，或滚到底后末列仍不完整
// 5. 溢出无披露：scrollbar-width 仍是 none（隐藏的滚动条 = 没有滚动条）
// 6. 卡片被挤瘪：停靠卡宽比静止卡宽窄超过 2px（1440 静止列 281 vs
//    停靠列 280，卡宽差应为 1px）
// 7. 最坏数据塌版：超长标题卡横向溢出列、120 计数撑破列头、空列消失
// 8. 最窄可用视口塌版：1024 停靠（board-main 仅 366px）列跌破下限或
//    页面自身横向溢出
// 9. RTL 镜像塌版：dir=rtl 下首列不在滚动起点缘完整可见
// 10. 静止面回归：1440 静止态列宽/无横滚与改前逐值一致（≥1440 流值
//     281 > 280 下限，token 不介入）
const STRESS = '/app?scenario=board-stress';
const FLOOR = 280; // --board-col-min 的镜像值：钉几何，不读 CSS 变量

const drawer = (page: Page) => page.locator('.chief-drawer');
const scroller = (page: Page) => page.locator('.board-scroller');

/** ⌘J 开抽屉并等入场动画落定（chief-panel.spec settled 同式：等
 *  anim-drawer 的 animation finished，transform 归位后才可量几何）。 */
async function dock(page: Page) {
  await page.keyboard.press('Meta+j');
  await expect(page.locator('.board-shell[data-chief-open]')).toHaveCount(1);
  await drawer(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
}

/** scroller 可视窗 + 四列盒（几何单源，所有用例共用同一量法）。 */
function measure(page: Page) {
  return scroller(page).evaluate((el) => {
    const s = el.getBoundingClientRect();
    return {
      scroller: { left: s.left, right: s.right, width: s.width },
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      scrollLeft: el.scrollLeft,
      columns: [...el.querySelectorAll('.board-column')].map((c) => {
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

test.describe('board reflow under the docked chief drawer (#692)', () => {
  test('docked columns hold the 280px floor and the first column is whole', async ({ page }) => {
    await page.goto(STRESS);
    await page.waitForSelector('.board-column');
    await dock(page);

    const m = await measure(page);
    expect(m.columns).toHaveLength(4);
    // 失败方式 1：列被压扁（旧 minmax(0,1fr) 停靠态 ~176px 的死法）
    for (const c of m.columns) expect(c.width).toBeGreaterThanOrEqual(FLOOR - 1);
    // 失败方式 2：首列在滚动起点被裁（用户截图的「只剩一条边」）
    const first = m.columns[0]!;
    expect(first.left).toBeGreaterThanOrEqual(m.scroller.left - 1);
    expect(first.right - first.left).toBeGreaterThanOrEqual(FLOOR - 1);
    // 停靠确实让位出溢出（否则上面两条是空转）
    expect(m.scrollWidth).toBeGreaterThan(m.clientWidth);
  });

  test('the clipped next column peeks >=16px at the scroll edge', async ({ page }) => {
    await page.goto(STRESS);
    await page.waitForSelector('.board-column');
    await dock(page);

    // 失败方式 3：残边无意义（3px 边渣读作破损，不读作可滚）。
    // 1440 停靠窗 782：17+280+14+280+14 = 605 → 第三列露出 ~177px。
    const m = await measure(page);
    const partial = m.columns.find(
      (c) => c.left < m.scroller.right && c.right > m.scroller.right + 1,
    );
    expect(partial, 'a column must straddle the scroll edge').toBeDefined();
    expect(m.scroller.right - partial!.left).toBeGreaterThanOrEqual(16);
  });

  test('overflow is reachable: wheel scrolls and the last column lands whole', async ({ page }) => {
    await page.goto(STRESS);
    await page.waitForSelector('.board-column');
    await dock(page);

    // 失败方式 4：横滚不可达（滚动条隐藏 + 滚不动 = 末列不存在）。
    // wheel 时序坑照 board-overflow.spec：合成器帧上 poll 到离开 0 再断言。
    const box = await scroller(page).boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 40);
    await page.mouse.wheel(300, 0);
    await expect
      .poll(async () => (await measure(page)).scrollLeft, { timeout: 2000 })
      .toBeGreaterThan(0);

    await scroller(page).evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
    const end = await measure(page);
    const last = end.columns[3]!;
    // 滚到底：末列完整落窗（右缘不外溢、左缘在窗内）
    expect(last.right).toBeLessThanOrEqual(end.scroller.right + 1);
    expect(last.left).toBeGreaterThanOrEqual(end.scroller.left - 1);
    expect(last.width).toBeGreaterThanOrEqual(FLOOR - 1);
  });

  test('overflow discloses itself: the scroller no longer hides its scrollbar', async ({
    page,
  }) => {
    await page.goto(STRESS);
    await page.waitForSelector('.board-column');
    await dock(page);
    // 失败方式 5：披露机制本体（参考站 scrollbar-width: auto 同值；
    // auto 只在真溢出时画轨道，静止 1440 无溢出即无滚动条）
    await expect(scroller(page)).toHaveCSS('scrollbar-width', 'auto');
  });

  test('cards keep their resting width while docked', async ({ page }) => {
    await page.goto(STRESS);
    await page.waitForSelector('.todo-card');
    const resting = await page
      .locator('[data-column="todo"] .todo-card')
      .first()
      .boundingBox();
    expect(resting).not.toBeNull();
    await dock(page);
    const docked = await page
      .locator('[data-column="todo"] .todo-card')
      .first()
      .boundingBox();
    expect(docked).not.toBeNull();
    // 失败方式 6：卡被挤瘪（用户报的「卡片挤成一团」）。1440 静止列 281、
    // 停靠列 280 → 卡宽差 1px；容差 2px 吃掉亚像素。
    expect(Math.abs(docked!.width - resting!.width)).toBeLessThanOrEqual(2);
  });

  test('worst-case data holds: long title wraps in-column, 120-count header fits, empty column survives', async ({
    page,
  }) => {
    await page.goto(STRESS);
    await page.waitForSelector('.todo-card');
    await dock(page);

    // 失败方式 7a：超长不可断行标题把卡撑出列（横向溢出）
    const card = page.locator('[data-column="todo"] .todo-card').first();
    const overflow = await card.evaluate((el) => ({
      spill: el.scrollWidth - el.clientWidth,
      titleSpill: (() => {
        const t = el.querySelector('.todo-card-title');
        return t == null ? 0 : t.scrollWidth - t.clientWidth;
      })(),
    }));
    expect(overflow.spill).toBeLessThanOrEqual(1);
    expect(overflow.titleSpill).toBeLessThanOrEqual(1);

    // 失败方式 7b：三位数列头计数撑破列头
    const header = page.locator('[data-column="building"] .board-column-header');
    await expect(header).toContainText('120');
    const headSpill = await header.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(headSpill).toBeLessThanOrEqual(1);

    // 失败方式 7c：空列在下限宽下消失或塌窄
    const m = await measure(page);
    const pending = m.columns.find((c) => c.id === 'pending');
    expect(pending).toBeDefined();
    expect(pending!.width).toBeGreaterThanOrEqual(FLOOR - 1);
    await expect(page.locator('[data-column="pending"] .board-column-empty')).toBeVisible();
  });

  test('narrowest usable viewport (1024) docked: floor holds and the page itself never scrolls', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 732 });
    await page.goto(STRESS);
    await page.waitForSelector('.board-column');
    await dock(page);

    // 失败方式 8：窄窗停靠（board-main = 1024−240−418 = 366）列跌破下限，
    // 或壳把溢出漏给页面（body 出现横滚 = 布局塌了）
    const m = await measure(page);
    for (const c of m.columns) expect(c.width).toBeGreaterThanOrEqual(FLOOR - 1);
    const first = m.columns[0]!;
    expect(first.left).toBeGreaterThanOrEqual(m.scroller.left - 1);
    const pageSpill = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(pageSpill).toBeLessThanOrEqual(0);
  });

  test('RTL mirror: the first column stays whole at the scroll-start edge', async ({ page }) => {
    await page.goto(STRESS);
    await page.waitForSelector('.board-column');
    // 应用尚未出 RTL 词表；本条钉的是布局原语的方向无关性（grid +
    // overflow 随 dir 镜像），dir 由文档根注入。
    await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
    await dock(page);

    const m = await measure(page);
    const byId = Object.fromEntries(m.columns.map((c) => [c.id, c]));
    // 失败方式 9：镜像后首列跑到裁切缘。RTL 滚动起点 = 右缘：todo 列
    // 必须完整贴右窗缘，列序整体反转。
    expect(byId.todo!.right).toBeLessThanOrEqual(m.scroller.right + 1);
    expect(byId.todo!.right - byId.todo!.left).toBeGreaterThanOrEqual(FLOOR - 1);
    expect(byId.todo!.left).toBeGreaterThan(byId.building!.left);
    expect(byId.building!.left).toBeGreaterThan(byId.pending!.left);
    expect(byId.pending!.left).toBeGreaterThan(byId.done!.left);
  });

  test('resting geometry at 1440 is untouched by the floor token', async ({ page }) => {
    await page.goto('/app?scenario=01');
    await page.waitForSelector('.board-column');
    // 失败方式 10：静止面回归——1440 流值 (1166−42)/4 = 281 > 280，
    // token 不介入：四列等宽 ~281、无横滚（与改前实测逐值一致）。
    const m = await measure(page);
    expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth);
    expect(m.columns).toHaveLength(4);
    const first = m.columns[0]!.width;
    expect(first).toBeGreaterThan(FLOOR);
    expect(first).toBeLessThan(282);
    for (const c of m.columns) expect(Math.abs(c.width - first)).toBeLessThanOrEqual(1);
  });
});
