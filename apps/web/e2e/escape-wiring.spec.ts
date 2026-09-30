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

// —— #466：对话框族同根因钉（AlertDialogShell 的 Esc 接线）—————————————————
//
// 删除确认层的 window keydown 接线曾以 [onClose, open] 注册，而根组件
// （todo-detail-page）传的是内联箭头——根组件任何一次重渲染都 rem+add，
// 与 popover 面（#462 症状 2）同根同形。重渲染触发器换成 ⌘K 往返：
// useSearchState 的状态就住在根组件里，面板一开一关各 commit 一次，确认
// 层每次都吃到新的 onClose；面板在 Escape 前已自关，分层律不涉案（单次
// Esc 只收确认层）。旧实现在本触发器下确定性红于零重挂指纹（车道实测
// adds:2/rems:3，每次 commit 重挂一次）；可见律断言在旧实现下亦绿——重挂
// 赶在 Escape 派发抵 window 前 flush 完毕，判别力全在指纹侧。重挂即丢失
// 窗口：flush 若落进派发中途（useSearchState 的 Escape 分支正是 #462 钉下
// 的「更早 window 监听者触发 flush」位），该按即丢、弹层滞留到第二按。
// 本钉因此钉根因侧（开层期接线稳定），并同断用户可见律（单次 Escape 收层）。

const DETAIL = '/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=27';
const confirmDialog = (page: Page) => page.locator('.delete-confirm');
const searchPanel = (page: Page) => page.locator('.search-panel');

/** ⌘K toggle 走 search-focus 重试律：送达的一按翻转面板态即出环，丢失的
 *  一按留在原态、重按即是。开/关两向共用（until = 目标态）。 */
async function toggleSearchPanel(page: Page, until: 'visible' | 'hidden') {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await page.keyboard.press('Meta+k');
    const flipped = await searchPanel(page)
      .waitFor({ state: until, timeout: 1000 })
      .then(() => true)
      .catch(() => false);
    if (flipped) return;
  }
  throw new Error(`⌘K never flipped the search panel to ${until}`);
}

test('确认弹层不被根组件重渲染重挂 Escape 接线：⌘K 往返后单次 Escape 仍收层', async ({
  page,
}) => {
  await page.goto(DETAIL);
  await page.locator('.detail-head-icon--more').click();
  await page.locator('.more-menu-item[data-action="delete"]').click();
  await expect(confirmDialog(page)).toBeVisible();
  await installEscapeTap(page);
  // 根组件级重渲染往返：⌘K 开搜索面板（commit 1）、⌘K 关（commit 2）——
  // 每次 commit 都重建确认层吃到的内联 onClose 箭头
  await toggleSearchPanel(page, 'visible');
  await toggleSearchPanel(page, 'hidden');
  await page.keyboard.press('Escape');
  await expect(confirmDialog(page)).not.toBeVisible();
  // 开层期零重挂（旧实现：⌘K 往返每次 commit 重挂一次，实测 adds:2/rems:3）；
  // 唯一一次 rem = 关层本身。断言同 popover 钉：关层后读取，无计时等待。
  expect(await readEscapeTap(page)).toEqual({ adds: 0, rems: 1 });
});