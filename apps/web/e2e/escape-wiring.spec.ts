import { expect, type Page, test } from '@playwright/test';

// #462 symptom 2 (Escape 关层竞态) 的回归钉：**开着的层，其 Escape 接线必须
// 在整个开启期保持稳定**——重渲染（URL 写回、数据提交、SSE 失效）不得把它
// 卸载重挂。
//
// 失败机理（CI 实测 + 车道探针 23/23 复现，见报告）：层开着时若有一次重渲染
// 的 passive effect 尚未 flush，而 keydown 派发已经开始，同一派发中更早的
// window 监听者会触发那次 flush —— 层的清理在本派发中途跑掉，**被移除的监听
// 者在本次派发中不再被调用**（DOM 规范），于是这次 Escape 根本没到达该层，层
// 保持开态直到第二次 Escape。观测指纹：失败轮 100% 出现「派发中途 rem+add」，
// 通过轮 0/177（探针 200 轮）。dismiss.tsx 的 useEscapeClose 现按 open 周期
// 注册一次（onClose 走 ref），开着的层不再有中途重挂。
//
// 每条用例钉一个失败方式：层开着的期间发生 URL 写回重渲染 → 接线被重挂
// （rem+add）。旧实现在此确定性红（本车道实测 3/3），dismiss.tsx 按 open 周期
// 注册后绿。同一用例同时钉用户可见律：URL 写回后单次 Escape 必须收层。

const EMPTY = '/app?scenario=board-tags-empty';

const typeBtn = (page: Page) => page.locator('.board-type-filter');
const typePopover = (page: Page) => page.locator('.type-filter-popover');
const typeOption = (page: Page, name: string) =>
  page.locator(`.type-filter-option[data-tag="${name}"]`);

/** window keydown 接线的增删探针：只数**调用**，不依赖应用内部结构。
 *  开层发生在探针安装之前（计数不含开层那一次），关层那一次 rem 是合法的。 */
async function installEscapeTap(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __escTap: { adds: number; rems: number } };
    w.__escTap = { adds: 0, rems: 0 };
    const add = window.addEventListener.bind(window);
    const rem = window.removeEventListener.bind(window);
    window.addEventListener = ((type: string, fn: unknown, opts?: unknown) => {
      if (type === 'keydown') w.__escTap.adds += 1;
      return add(type, fn as EventListener, opts as boolean);
    }) as typeof window.addEventListener;
    window.removeEventListener = ((type: string, fn: unknown, opts?: unknown) => {
      if (type === 'keydown') w.__escTap.rems += 1;
      return rem(type, fn as EventListener, opts as boolean);
    }) as typeof window.removeEventListener;
  });
}

const readEscapeTap = (page: Page) =>
  page.evaluate(() => (window as unknown as { __escTap: { adds: number; rems: number } }).__escTap);

async function openTypePopover(page: Page) {
  await typeBtn(page).click();
  await expect(typePopover(page)).toBeVisible();
}

test('开着的层不被重渲染重挂 Escape 接线：URL 写回后单次 Escape 仍收层', async ({ page }) => {
  await page.goto(EMPTY);
  await openTypePopover(page);
  await installEscapeTap(page);
  // URL 写回 → 看板重渲染（类型轴见底 = 空态分支成形）
  await typeOption(page, 'chore').click();
  await expect(page).toHaveURL(/[\?&]tags=chore(&|$)/);
  await expect(page.locator('.board-filter-empty')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(typePopover(page)).not.toBeVisible();
  // 开层期零重挂（旧实现：URL 写回那次重渲染产生 rem+add）；唯一一次 rem =
  // 关层本身。断言放在关层之后读取——无需任何计时等待即已落定。
  expect(await readEscapeTap(page)).toEqual({ adds: 0, rems: 1 });
});