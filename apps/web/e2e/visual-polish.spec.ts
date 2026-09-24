import { expect, test } from '@playwright/test';

// Issue #123 acceptance (dogfood 观感三项, claude.ai 参照面): the sidebar reads
// as its own chrome layer against the canvas (background tone step + soft edge
// shadow, no drawn seam line); the horizontal board scroller keeps its scroll
// capability with the track hidden (scrollbar-width: none + ::-webkit-scrollbar
// display: none). Issue #139 acceptance (边框体系统一): the board card family and
// the account popover share ONE single-source edge recipe — a 1px inset
// box-shadow ring in the --border-default scale (no real CSS border: at
// fractional page zoom a 1px border lands on fractional device pixels and
// rasterizes unevenly, the popover lost its right edge entirely at 110%),
// 12px radius, popover-tier soft shadow. Each surface is asserted in both
// themes — the polish is a dual-theme contract.

/** resolved single-source ring + the --border-default color it must ride */
async function edgeContract(page: import('@playwright/test').Page, selector: string) {
  return page.locator(selector).first().evaluate((el) => {
    const ringProbe = document.createElement('div');
    ringProbe.style.boxShadow = 'var(--edge-ring)';
    const colorProbe = document.createElement('div');
    colorProbe.style.backgroundColor = 'var(--border-default)';
    document.body.append(ringProbe, colorProbe);
    const cs = getComputedStyle(el);
    const out = {
      shadow: cs.boxShadow,
      ring: getComputedStyle(ringProbe).boxShadow,
      borderColor: getComputedStyle(colorProbe).backgroundColor,
      radius: cs.borderTopLeftRadius,
      border: cs.borderTopWidth,
    };
    ringProbe.remove();
    colorProbe.remove();
    return out;
  });
}

for (const theme of ['light', 'dark'] as const) {
  test(`board card rides the single-source edge ring (${theme})`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);
    await page.goto('/app?scenario=01');

    const card = await edgeContract(page, '.todo-card');
    // no real border — the ring is a shadow spread so fractional zoom
    // (110%/125%/150%) keeps a uniform hairline on every edge
    expect(card.border).toBe('0px');
    expect(card.radius).toBe('12px');
    // the surface's shadow stack opens with the single-source ring, and the
    // ring color is the --border-default scale of this theme
    expect(card.shadow.startsWith(card.ring)).toBe(true);
    expect(card.ring.startsWith(`${card.borderColor} `)).toBe(true);
  });

  test(`account popover rides the same edge ring as the card (${theme})`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);
    await page.goto('/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=17');

    const menu = await edgeContract(page, '.user-menu');
    expect(menu.border).toBe('0px');
    expect(menu.radius).toBe('12px');
    expect(menu.shadow.startsWith(menu.ring)).toBe(true);
    expect(menu.ring.startsWith(`${menu.borderColor} `)).toBe(true);
  });

  test(`sidebar reads as its own layer, no drawn seam (${theme})`, async ({ page }) => {
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
        shadow: cs.boxShadow,
      };
    });
    // background hierarchy: the sidebar sits on its own tone step off the
    // canvas (cds sidebar surface mix), so the seam reads without a line
    expect(probe.sidebarBg).not.toBe(probe.mainBg);
    // no drawn seam line in either sidebar state' container
    expect(probe.borderRight).toBe('0px');
    // soft edge shadow onto the canvas (cds dframe sidebar card edge)
    expect(probe.shadow).not.toBe('none');
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

test('collapsed rail keeps the same soft edge treatment', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('pacman-theme', 'dark');
    localStorage.setItem('pacman.sidebar-collapsed', '1');
  });
  await page.goto('/app?scenario=01');

  const rail = await page.locator('.board-sidebar--collapsed').evaluate((el) => {
    const cs = getComputedStyle(el);
    return { borderRight: cs.borderRightWidth, shadow: cs.boxShadow };
  });
  expect(rail.borderRight).toBe('0px');
  expect(rail.shadow).not.toBe('none');
});
