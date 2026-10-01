import { expect, type Page, test } from '@playwright/test';

// Issue #447 (ADR 0004): 总管面板 = 贴右竖板. Failure modes pinned here
// (fixture face — the live send path rides the real-backend self-
// verification, the fixture build has no API):
//   1. Esc does not close the drawer (the #136 ledger bug) — board AND a
//      wake surface must obey the overlay-family law (useEscapeClose).
//   2. Esc layering wrong: with the thread switcher popover open (r5 116),
//      the innermost overlay must close first, the drawer survives one press.
//   3. composer bar still renders 语音输入/添加附件/提及 — the #146 ruling
//      hides them (local-first, no backend face); only 发送 remains.
//   4. the panel is not a docked column: it must be a 418-wide full-height
//      flex item flush to the container's right edge — radius 0, no shadow,
//      a 1px --border-default left seam (D1/D3/D5); the 全屏 toggle and its
//      is-fullscreen contract are retired (D1), so no form-toggle button
//      exists anywhere in the DOM.
//   5. content does not yield / does not restore: board-main narrows by
//      exactly 418 while open and returns to full width after close; the
//      board columns keep the D8 min-width guard and the scroller goes
//      horizontal instead of collapsing the columns; with the panel closed
//      the resting grid keeps scrollable === false.
//   6. the wake shells (pages / resources / secondary) do not narrow their
//      main column while docked, or keep a residual gap after close.
//   7. detail route: the panel must occupy the right-pane slot (mutually
//      exclusive with .detail-right, D7) with the center column staying
//      fluid and abutting the panel seam.
//   8. hero examples drift or vanish: the four canon prompt cards (r5 111)
//      render verbatim; on the fixture face the click stays inert (send is
//      live-only, #129 contract) and the view does not change.
//   9. the open state survives a reload (D9: 刷新即关).
//  10. the composer's size follows its content (XMON-102): `rows` used to be
//      keyed on the draft (empty 1 ↔ drafted 6), so the box jumped 20px →
//      120px as soon as the first character landed and shrank back on send.
//      One fixed height on every state now (3 lines), overflow kept inside
//      the box.

const drawer = (page: Page) => page.locator('.chief-drawer');

// the docked panel slides in (anim-drawer, drawer-in) — measure only after
// the entrance animation settles so transforms are off the boxes
async function settled(page: Page) {
  await drawer(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
}

test.describe('chief panel docked form (#447)', () => {
  test('Esc closes the drawer on the board route', async ({ page }) => {
    await page.goto('/app?scenario=111');
    await expect(drawer(page)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(drawer(page)).toBeHidden();
  });

  test('Esc closes the drawer on a wake surface', async ({ page }) => {
    await page.goto('/app/team?scenario=12');
    await expect(drawer(page)).toHaveCount(0);

    await page.locator('.secondary-fab').click();
    await expect(drawer(page)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(drawer(page)).toBeHidden();
  });

  test('Esc layers: the open thread switcher closes first, the drawer second', async ({ page }) => {
    await page.goto('/app?scenario=116');
    await expect(drawer(page)).toBeVisible();
    await expect(page.locator('.chief-switcher')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('.chief-switcher')).toHaveCount(0);
    await expect(drawer(page)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(drawer(page)).toBeHidden();
  });

  test('composer bar renders the send button only', async ({ page }) => {
    await page.goto('/app?scenario=111');
    const bar = page.locator('.chief-composer-bar');
    await expect(bar.locator('button[aria-label="语音输入"]')).toHaveCount(0);
    await expect(bar.locator('button[aria-label="添加附件"]')).toHaveCount(0);
    await expect(bar.locator('button[aria-label="提及"]')).toHaveCount(0);
    await expect(bar.locator('button')).toHaveCount(1);
    await expect(bar.locator('button[aria-label="发送"]')).toBeVisible();
  });

  test('the panel docks flush right as a full-height 418 column (board)', async ({ page }) => {
    await page.goto('/app?scenario=111');
    await settled(page);
    const box = await drawer(page).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeCloseTo(1440 - 418, 0);
    expect(box!.y).toBeCloseTo(0, 0);
    expect(box!.width).toBeCloseTo(418, 0);
    expect(box!.height).toBeCloseTo(732, 0);

    const skin = await drawer(page).evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        position: cs.position,
        radius: cs.borderRadius,
        shadow: cs.boxShadow,
        borderLeft: cs.borderLeftWidth,
        borderLeftColor: cs.borderLeftColor,
        seam: getComputedStyle(document.querySelector('.board-sidebar')!).borderRightColor,
      };
    });
    // an in-flow flex item, not an overlay (D2)
    expect(skin.position).toBe('static');
    expect(skin.radius).toBe('0px');
    expect(skin.shadow).toBe('none');
    // 1px --border-default left seam, the same hairline token the sidebar
    // seam rides (D3, Hairlines Not Shadows)
    expect(skin.borderLeft).toBe('1px');
    expect(skin.borderLeftColor).toBe(skin.seam);

    // D1: the form toggle is retired — neither label exists anywhere
    await expect(page.locator('button[aria-label="全屏"]')).toHaveCount(0);
    await expect(page.locator('button[aria-label="退出全屏"]')).toHaveCount(0);
  });

  test('board content yields to the panel and the columns keep the D8 guard', async ({
    page,
  }) => {
    await page.goto('/app?scenario=111');
    await settled(page);
    const main = await page.locator('.board-main').boundingBox();
    expect(main).not.toBeNull();
    expect(main!.width).toBeCloseTo(1440 - 240 - 418, 0);

    const open = await page.locator('.board-scroller').evaluate((el) => ({
      scrollable: el.scrollWidth > el.clientWidth,
      columns: [...el.querySelectorAll('.board-column')].map((c) => c.getBoundingClientRect().width),
    }));
    // D8: yielding turns into horizontal scroll, not collapsed columns —
    // the guard value is the .board-scroller minmax() floor (board.css)
    expect(open.scrollable).toBe(true);
    expect(open.columns).toHaveLength(4);
    for (const w of open.columns) expect(w).toBeGreaterThanOrEqual(240);
  });

  test('closing restores the board grid to its resting geometry', async ({ page }) => {
    await page.goto('/app?scenario=111');
    await settled(page);
    await page.keyboard.press('Escape');
    await expect(drawer(page)).toHaveCount(0);

    const main = await page.locator('.board-main').boundingBox();
    expect(main!.width).toBeCloseTo(1440 - 240, 0);
    const rest = await page.locator('.board-scroller').evaluate((el) => ({
      scrollable: el.scrollWidth > el.clientWidth,
      columns: [...el.querySelectorAll('.board-column')].map((c) => c.getBoundingClientRect().width),
    }));
    expect(rest.scrollable).toBe(false);
    const first = rest.columns[0] ?? 0;
    expect(first).toBeGreaterThan(0);
    for (const w of rest.columns) expect(Math.abs(w - first)).toBeLessThanOrEqual(1);
  });

  for (const { name, route, fab, col } of [
    { name: 'pages', route: '/app/schedules?scenario=11', fab: '.page-fab', col: '.page-main-col' },
    {
      name: 'resources',
      route: '/app/resources/skills?scenario=06',
      fab: '.res-fab',
      col: '.res-main-col',
    },
    {
      name: 'secondary',
      route: '/app/team?scenario=12',
      fab: '.secondary-fab',
      col: '.secondary-main-col',
    },
  ] as const) {
    test(`${name}: the main column narrows by 418 while docked and restores on close`, async ({
      page,
    }) => {
      await page.goto(route);
      // *-main is the docking row (full width at all times); the content
      // column inside it is the sibling that yields (flex:1 min-width:0)
      const content = page.locator(col);
      await expect(content).toBeVisible();
      const closed = await content.boundingBox();
      expect(closed!.width).toBeCloseTo(1200, 0);

      await page.locator(fab).click();
      await settled(page);
      const docked = await drawer(page).boundingBox();
      expect(docked!.x).toBeCloseTo(1440 - 418, 0);
      expect(docked!.y).toBeCloseTo(0, 0);
      expect(docked!.width).toBeCloseTo(418, 0);
      expect(docked!.height).toBeCloseTo(732, 0);
      const open = await content.boundingBox();
      expect(open!.width).toBeCloseTo(1200 - 418, 0);

      await page.locator('.chief-drawer button[aria-label="关闭"]').click();
      await expect(drawer(page)).toHaveCount(0);
      const restored = await content.boundingBox();
      expect(restored!.width).toBeCloseTo(1200, 0);
      expect(restored!.x).toBeCloseTo(closed!.x, 0);
    });
  }

  test('detail: the panel occupies the right-pane slot, mutually exclusive (D7)', async ({
    page,
  }) => {
    await page.goto('/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=detail-unread');
    await expect(page.locator('.detail-right')).toBeVisible();

    await page.locator('.detail-fab').click();
    await settled(page);
    await expect(page.locator('.detail-right')).toHaveCount(0);
    const box = await drawer(page).boundingBox();
    expect(box!.x).toBeCloseTo(1440 - 418, 0);
    expect(box!.y).toBeCloseTo(44, 0); // the pane slot starts under the 44px head
    expect(box!.width).toBeCloseTo(418, 0);
    expect(box!.height).toBeCloseTo(732 - 44, 0);

    // the center column stays fluid and abuts the panel seam
    const center = await page.locator('.detail-center').boundingBox();
    expect(center!.width).toBeCloseTo(1440 - 240 - 418, 0);
    expect(Math.round(center!.x + center!.width)).toBe(Math.round(box!.x));

    await page.locator('.chief-drawer button[aria-label="关闭"]').click();
    await expect(drawer(page)).toHaveCount(0);
    await expect(page.locator('.detail-right')).toBeVisible();
    const restored = await page.locator('.detail-center').boundingBox();
    expect(restored!.width).toBe(1440 - 240 - 488);
  });

  test('hero examples: the four canon prompt cards, inert on the fixture face', async ({
    page,
  }) => {
    await page.goto('/app?scenario=111');
    const cards = page.locator('.chief-example');
    await expect(cards).toHaveCount(4);
    await expect(cards.nth(0)).toContainText('帮我组建 Agent 团队');
    await expect(cards.nth(1)).toContainText('帮我创建一个新项目');
    await expect(cards.nth(2)).toContainText('总结一下我所有项目现在的进展');
    await expect(cards.nth(3)).toContainText('查一下这个月的 token 用量');

    // the fixture face has no send callback (#129): clicking a card must
    // not swap the hero for a thread view or crash the surface
    await cards.nth(0).click();
    await expect(drawer(page)).toBeVisible();
    await expect(page.locator('.chief-examples')).toBeVisible();
    await expect(page.locator('.chief-stream')).toHaveCount(0);
  });

  test('composer keeps one fixed size whether or not a draft is restored (XMON-102)', async ({
    page,
  }) => {
    // The two fixture rows that straddle the old toggle: r5 111 restores the
    // localStorage draft into the composer (used to render 6 rows), r5 114 is
    // a thread view with an empty composer (used to render 1 row). Equal
    // boxes below = the size no longer reads the content.
    const measureComposer = async (url: string) => {
      await page.goto(url);
      await settled(page);
      const composer = page.locator('.chief-composer-input');
      await expect(composer).toBeVisible();
      const box = await composer.boundingBox();
      if (box === null) throw new Error(`composer box missing at ${url}`);
      return {
        height: Math.round(box.height),
        cssHeight: await composer.evaluate((el) => getComputedStyle(el).height),
        overflowY: await composer.evaluate((el) => getComputedStyle(el).overflowY),
      };
    };

    const drafted = await measureComposer('/app?scenario=111');
    const empty = await measureComposer('/app?scenario=114');

    expect(empty.height).toBe(drafted.height);
    // A fixed track, not an auto one: the box is 3 lines of the composer's
    // 20px line-height, and the overflow stays inside it instead of pushing
    // the panel around.
    expect(drafted.cssHeight).toBe('60px');
    expect(empty.cssHeight).toBe('60px');
    expect(drafted.overflowY).toBe('auto');
  });

  test('the open state does not persist across a reload (D9)', async ({ page }) => {
    await page.goto('/app?scenario=01');
    await expect(drawer(page)).toHaveCount(0);
    await page.locator('.chief-fab').click();
    await expect(drawer(page)).toBeVisible();
    await page.reload();
    await expect(drawer(page)).toHaveCount(0);
  });
});
