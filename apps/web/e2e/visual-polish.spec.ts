import { expect, test } from '@playwright/test';

// Issue #123 acceptance (dogfood 观感三项, claude.ai 参照面): the board card
// family carries the soft cds-style elevation (1px low-alpha edge ring +
// wide soft shadow) instead of a flat solid outline; the sidebar reads as
// its own chrome layer against the canvas (background tone step; its seam
// is a drawn 1px divider-token line and the floating shadow is gone per
// the #135 裁决 v2 revision); the horizontal board scroller keeps its
// scroll capability with the track hidden (scrollbar-width: none +
// ::-webkit-scrollbar display: none). Each surface is asserted in both
// themes — the polish is a dual-theme contract.

for (const theme of ['light', 'dark'] as const) {
  test(`board card carries soft elevation (${theme})`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);
    await page.goto('/app?scenario=01');

    const card = await page.locator('.todo-card').first().evaluate((el) => {
      const cs = getComputedStyle(el);
      return { shadow: cs.boxShadow, edge: cs.borderTopColor };
    });
    // elevation layer present (cds --df-shadow-card family: contact layer +
    // wide soft layer), not the flat no-shadow card
    expect(card.shadow).not.toBe('none');
    expect(card.shadow).toContain('rgba(');
    // the edge is a low-alpha ring (cds alpha family), so the computed
    // border color carries transparency instead of a solid hex
    expect(card.edge).toMatch(/^rgba\(\d+, \d+, \d+, 0\.\d+\)$/);
  });

  test(`sidebar reads as its own layer, seam drawn in the divider token (${theme})`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);
    await page.goto('/app?scenario=01');

    const probe = await page.evaluate(() => {
      const sidebar = document.querySelector('.board-sidebar');
      const main = document.querySelector('.board-main');
      if (!sidebar || !main) throw new Error('board layout missing');
      const cs = getComputedStyle(sidebar);
      return {
        sidebarBg: cs.backgroundColor,
        mainBg: getComputedStyle(main).backgroundColor,
        borderRight: cs.borderRightWidth,
        seamColor: cs.borderRightColor,
        topbarBorderColor: getComputedStyle(
          document.querySelector('.board-topbar')!,
        ).borderBottomColor,
        shadow: cs.boxShadow,
      };
    });
    // background hierarchy: the sidebar keeps its own tone step off the
    // canvas (#123), and the #135 裁决 v2 draws the seam again — 1px in the
    // topbar-divider token, the floating soft shadow gone
    expect(probe.sidebarBg).not.toBe(probe.mainBg);
    expect(probe.borderRight).toBe('1px');
    expect(probe.seamColor).toBe(probe.topbarBorderColor);
    expect(probe.shadow).toBe('none');
  });

  test(`board scroller hides its track but keeps scrolling (${theme})`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);
    await page.goto('/app?scenario=01');

    const metrics = await page.locator('.board-scroller').evaluate((el) => {
      el.scrollLeft = 400;
      const cs = getComputedStyle(el);
      return {
        scrollbarWidth: cs.scrollbarWidth,
        // a rendered horizontal track would eat vertical box space
        trackGap: el.offsetHeight - el.clientHeight,
        scrollLeft: el.scrollLeft,
        scrollable: el.scrollWidth > el.clientWidth,
      };
    });
    expect(metrics.scrollbarWidth).toBe('none');
    expect(metrics.trackGap).toBe(0);
    // scroll capability preserved — the track is hidden, not the overflow
    expect(metrics.scrollable).toBe(true);
    expect(metrics.scrollLeft).toBeGreaterThan(0);
  });
}

test('collapsed rail keeps the same drawn-seam treatment (#135 裁决 v2)', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('pacman-theme', 'dark');
    localStorage.setItem('pacman.sidebar-collapsed', '1');
  });
  await page.goto('/app?scenario=01');

  const rail = await page.locator('.board-sidebar--collapsed').evaluate((el) => {
    const cs = getComputedStyle(el);
    return { borderRight: cs.borderRightWidth, shadow: cs.boxShadow };
  });
  expect(rail.borderRight).toBe('1px');
  expect(rail.shadow).toBe('none');
});
