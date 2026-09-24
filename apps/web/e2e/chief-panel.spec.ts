import { expect, type Page, test } from '@playwright/test';

// Issue #146: 总管面板收尾. Failure modes pinned here (fixture face — the
// live send path rides the real-backend self-verification, the fixture
// build has no API):
//   1. Esc does not close the drawer (the #136 ledger bug) — board AND a
//      wake surface must obey the overlay-family law (useEscapeClose).
//   2. Esc layering wrong: with the thread switcher popover open (r5 116),
//      the innermost overlay must close first, the drawer survives one press.
//   3. composer bar still renders 语音输入/添加附件/提及 — the #146 ruling
//      hides them (local-first, no backend face); only 发送 remains.
//   4. 全屏 does not toggle the panel form (or does not toggle back): the
//      fullscreen drawer fills its containing block, the anchored form is
//      the r5 418-wide card; aria-label flips 全屏 ↔ 退出全屏.
//   5. hero examples drift or vanish: the four canon prompt cards (r5 111)
//      render verbatim; on the fixture face the click stays inert (send is
//      live-only, #129 contract) and the view does not change.

const drawer = (page: Page) => page.locator('.chief-drawer');

test.describe('chief panel wrap-up (#146)', () => {
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

  test('全屏 toggles the panel form and toggles back', async ({ page }) => {
    await page.goto('/app?scenario=111');
    // the drawer slides in (anim-drawer, drawer-in) — measure the anchored
    // form only after the entrance animation settles
    await drawer(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const box = await drawer(page).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeCloseTo(418, 0);

    await page.locator('.chief-drawer button[aria-label="全屏"]').click();
    await expect(drawer(page)).toHaveClass(/is-fullscreen/);
    const full = await drawer(page).boundingBox();
    expect(full).not.toBeNull();
    expect(full!.x).toBeCloseTo(0, 0);
    expect(full!.y).toBeCloseTo(0, 0);
    expect(full!.width).toBeCloseTo(1440, 0);
    expect(full!.height).toBeCloseTo(732, 0);
    await expect(
      page.locator('.chief-drawer button[aria-label="退出全屏"]'),
    ).toHaveAttribute('aria-pressed', 'true');

    await page.locator('.chief-drawer button[aria-label="退出全屏"]').click();
    await expect(drawer(page)).not.toHaveClass(/is-fullscreen/);
    const back = await drawer(page).boundingBox();
    expect(back).not.toBeNull();
    expect(back!.x).toBeCloseTo(box!.x, 0);
    expect(back!.y).toBeCloseTo(box!.y, 0);
    expect(back!.width).toBeCloseTo(box!.width, 0);
    expect(back!.height).toBeCloseTo(box!.height, 0);
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
});
