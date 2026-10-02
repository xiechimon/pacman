import { expect, type Page, test } from '@playwright/test';

// XMON-14 acceptance: avatar / kbd / tag-chip 三原语在 components/ui/ 有了
// shadcn 落点，21 个消费面切了过去。既有行为钉（avatar-dicebear 的 src 契约、
// chief-fab 的 48×48 几何、hotkeys 的 ⌘J/⌘K 悬浮律、board-filter 的 chip
// 20px）一行未动仍是正本；本 spec 补的是「落点自己」的契约——registry 数据
// 属性、消费面与落点的一一对应、以及落点必须保住 per-face 几何所以不能插盒。
// 每条用例钉一个失败方式：
// 1. 某个消费面漏切，仍渲染旧原语（没有 [data-slot=avatar]）
// 2. 落点在 img 与 per-face 容器之间插了一个定尺盒（display 不是 contents）
//    ——48×48 FAB / 24×24 侧栏 chip / `.fab-avatar img{height:100%}` 的百分比
//    链会一起裂
// 3. 成功路径上多渲染一个 fallback 元素（相对旧原语多一个可见节点）
// 4. kbd 落点没接上 registry（data-slot=kbd 缺失）或静息没隐藏
// 5. tag-chip 落点没接上 registry Badge（data-slot=badge 缺失）或几何漂移

const DICEBEAR = '**/api.dicebear.com/**';
const SVG_BODY =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="12"/></svg>';

/** Hermetic dicebear（avatar-dicebear.spec.ts idiom）：断 src 契约，不打真外网。 */
async function stubDicebear(page: Page) {
  await page.route(DICEBEAR, (route) =>
    route.fulfill({ contentType: 'image/svg+xml', body: SVG_BODY }),
  );
}

test('avatar 落点：侧栏人像 / 看板执行者面共用同一个 components/ui 落点', async ({ page }) => {
  await stubDicebear(page);
  await page.goto('/app?scenario=22d');
  const faces = [
    page.locator('.sidebar-user'),
    // fresh 卡执行者位渲染 UserCircle 占位（不是头像面）——按「含 img 者」取样
    page.locator('.todo-agent-avatar:has(img)').first(),
  ];
  for (const face of faces) {
    await expect(face.locator('[data-slot="avatar"]')).toHaveCount(1);
    await expect(face.locator('[data-slot="avatar-image"]')).toHaveCount(1);
    // 成功路径不渲染 fallback 元素（旧原语只有一个 img 节点）
    await expect(face.locator('[data-slot="avatar-fallback"]')).toHaveCount(0);
  }
  // 侧栏收起态的 rail chip 是同一落点的第二形态
  await page.evaluate(() => localStorage.setItem('pacman.sidebar-collapsed', '1'));
  await page.reload();
  await expect(page.locator('.rail-user [data-slot="avatar-image"]')).toHaveCount(1);
});

test('avatar 落点不生成盒：img 的 containing block 仍是 per-face 容器', async ({ page }) => {
  await stubDicebear(page);
  await page.goto('/app?scenario=22d');
  const probe = await page.evaluate(() => {
    const root = document.querySelector('.sidebar-user [data-slot="avatar"]')!;
    const img = document.querySelector('.sidebar-user [data-slot="avatar-image"]')!;
    const chip = document.querySelector('.sidebar-user')!;
    const box = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height };
    };
    return {
      display: getComputedStyle(root).display,
      imgBox: box(img),
      chipBox: box(chip),
      hasOwnBox: root.getBoundingClientRect().height > 0,
    };
  });
  expect(probe.display).toBe('contents');
  expect(probe.hasOwnBox).toBe(false);
  // 旧原语的 img 尺寸契约：24×24（`.sidebar-user [&_img]:size-6`）
  expect(probe.imgBox.w).toBe(24);
  expect(probe.imgBox.h).toBe(24);
  expect(probe.chipBox.h).toBe(44);
});

test('kbd 落点：悬浮提示是 registry Kbd，静息隐藏 / 悬浮浮出不变', async ({ page }) => {
  await page.goto('/app?scenario=01');
  const hint = page.locator('.chief-fab .kbd-hint');
  await expect(hint).toHaveCount(1);
  await expect(hint).toHaveAttribute('data-slot', 'kbd');
  await expect(hint).toBeHidden();
  await page.locator('.chief-fab').hover();
  await expect(hint).toBeVisible();
  await expect(hint).toHaveText('⌘J');
});

test('tag-chip 落点：落在 registry Badge 上，别名类与 per-face 几何双保（卡面 16 / 面板面 20）', async ({
  page,
}) => {
  await page.goto('/app?scenario=board-tags');
  const chip = page.locator('.todo-card-tag').first();
  await expect(chip).toHaveAttribute('data-slot', 'badge');
  await expect(chip).toHaveClass(/tag-chip/);
  // 卡面 = row-flush 档 16px（todo-card.tsx per-face 覆写，与 16px row1 齐平）
  const h = await chip.evaluate((el) => el.getBoundingClientRect().height);
  expect(h).toBe(16);

  // 类型筛选弹层的选中行是第二个消费面（board/tag-filter.tsx）——容器更高，
  // 走 20px 正本（components/ui/tag-chip.tsx 的 Badge h-5 档）
  await page.locator('.board-type-filter').click();
  const option = page.locator('.type-filter-option[data-tag="bug"]');
  await option.click();
  const picked = option.locator('.tag-chip');
  await expect(picked).toBeVisible();
  await expect(picked).toHaveAttribute('data-slot', 'badge');
  const ph = await picked.evaluate((el) => el.getBoundingClientRect().height);
  expect(ph).toBe(20);
});