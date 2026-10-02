import { expect, type Page, test } from '@playwright/test';

// Issue #629 acceptance: the board card's press face matches the reference
// product (todos.dev, 2026-10-02 live 实测):
//   · 卡面文本不可选中（参考站卡根 user-select: none）；
//   · stretched link 不可原生拖——draggable="false" + -webkit-user-drag:
//     none；按住微移零 dragstart（Chrome 拖影 chip = 用户报的「偶尔出现
//     一个小链接」，绝迹）；
//   · 按压 = 整卡 bg tint 一档（--surface-press：dark surface-tertiary /
//     light surface-secondary，参考站 active:bg-* 同源），标题链接不吃全局
//     a:active 压暗（参考站单一反馈）；
//   · 点击（未移动）导航详情路由——参考站同款效果，钉住不被封锁误伤。

/** Resolve a declaration through the token path the card consumes. */
async function resolveVar(page: Page, prop: string, value: string) {
  return page.evaluate(
    ([p, v]) => {
      const probe = document.createElement('div');
      probe.style.setProperty(p, v);
      document.body.append(probe);
      const resolved = getComputedStyle(probe).getPropertyValue(p).trim();
      probe.remove();
      return resolved;
    },
    [prop, value] as const,
  );
}

for (const theme of ['light', 'dark'] as const) {
  test(`press tints the whole card one surface step (${theme})`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);
    await page.goto('/app?scenario=01');
    const card = page.locator('[data-column="done"] .todo-card').first();
    const box = await card.boundingBox();
    if (box == null) throw new Error('done card missing');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    const restBg = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
    const expectedPress = await resolveVar(page, 'background-color', 'var(--surface-press)');
    // the resting face must not already sit on the press tier
    expect(restBg).not.toBe(expectedPress);

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await expect(card).toHaveCSS('background-color', expectedPress);
    // single feedback: the stretched link does NOT dim under the global a:active
    const linkOpacity = await card
      .locator('.todo-card-link')
      .evaluate((el) => getComputedStyle(el).opacity);
    expect(linkOpacity).toBe('1');

    // release away from the card: no click, tint clears with :active
    await page.mouse.move(cx - 200, cy + 250, { steps: 6 });
    await page.mouse.up();
    await expect(card).toHaveCSS('background-color', restBg);
  });
}

test('card face is selection- and native-drag-locked (「小链接」绝迹)', async ({ page }) => {
  await page.goto('/app?scenario=01');
  const card = page.locator('[data-column="done"] .todo-card').first();
  await expect(card).toHaveCSS('user-select', 'none');
  const link = card.locator('.todo-card-link');
  await expect(link).toHaveAttribute('draggable', 'false');
  const userDrag = await link.evaluate((el) => getComputedStyle(el).webkitUserDrag);
  expect(userDrag).toBe('none');

  // press-and-move over the card: zero dragstart, zero selection, zero overlay
  await page.evaluate(() => {
    (window as unknown as { __dragstarts: number }).__dragstarts = 0;
    document.addEventListener(
      'dragstart',
      () => {
        (window as unknown as { __dragstarts: number }).__dragstarts += 1;
      },
      true,
    );
  });
  const box = await card.boundingBox();
  if (box == null) throw new Error('done card missing');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(cx + i * 6, cy + i * 3, { steps: 2 });
  }
  const mid = await page.evaluate(() => ({
    dragstarts: (window as unknown as { __dragstarts: number }).__dragstarts,
    selection: window.getSelection()?.toString() ?? '',
  }));
  expect(mid.dragstarts).toBe(0);
  expect(mid.selection).toBe('');
  await expect(page.locator('.board-drag-overlay')).toHaveCount(0);
  // release OUTSIDE the card bounds: a press that travels and lifts off the
  // card is an aborted gesture, not a click (up inside the card bounds is
  // the browser's click law — that face is pinned by the navigate test below)
  await page.mouse.move(cx, cy + box.height, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  expect(new URL(page.url()).pathname).toBe('/app');
});

test('plain click on a done card still navigates to the detail route', async ({ page }) => {
  await page.goto('/app?scenario=01');
  const card = page.locator('[data-column="done"] .todo-card').first();
  const id = await card.getAttribute('data-todo-id');
  await card.click();
  // SPA pushState keeps the scenario query — match the path, not the full URL
  await page.waitForURL((u) => u.pathname === `/app/todo/${id}`);
  expect(new URL(page.url()).pathname).toBe(`/app/todo/${id}`);
});
