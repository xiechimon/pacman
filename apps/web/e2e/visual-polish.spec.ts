import { expect, type Page, test } from '@playwright/test';

// Issue #123 acceptance (dogfood 观感三项, claude.ai 参照面): the sidebar reads
// as its own chrome layer against the canvas (background tone step; its seam
// is a drawn 1px divider-token line and the floating shadow is gone per
// the #135 裁决 v2 revision); the horizontal board scroller keeps its
// scroll capability with the track hidden (scrollbar-width: none +
// ::-webkit-scrollbar display: none). Issue #139 acceptance (边框体系统一):
// the board card family and the account popover share ONE single-source edge
// recipe — a 1px inset box-shadow ring in the --border-default scale (no real
// CSS border: at fractional page zoom a 1px border lands on fractional device
// pixels and rasterizes unevenly), 12px radius, popover-tier soft shadow.
// Issue #161 acceptance (卡片阴影/边框统一): the small-card family (todo /
// notify banner / column container) shares a tighter card-tier shadow
// (--card-shadow) so the cards read as grounded instead of floating;
// the account popover stays on the popover-tier (--edge-shadow) because it
// opens over content and needs visible separation. Both recipes share the
// edge ring + 12px radius — the seam between the banner and the column
// container is visually continuous.
// Each surface is asserted in both themes — the polish is a dual-theme contract.

/** resolved single-source ring + the --border-default color it must ride */
async function edgeContract(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((el) => {
    const ringProbe = document.createElement('div');
    ringProbe.style.boxShadow = 'var(--edge-ring)';
    const colorProbe = document.createElement('div');
    colorProbe.style.backgroundColor = 'var(--border-default)';
    const cardShadowProbe = document.createElement('div');
    cardShadowProbe.style.boxShadow = 'var(--card-shadow)';
    const edgeShadowProbe = document.createElement('div');
    edgeShadowProbe.style.boxShadow = 'var(--edge-shadow)';
    document.body.append(ringProbe, colorProbe, cardShadowProbe, edgeShadowProbe);
    const cs = getComputedStyle(el);
    const out = {
      shadow: cs.boxShadow,
      ring: getComputedStyle(ringProbe).boxShadow,
      borderColor: getComputedStyle(colorProbe).backgroundColor,
      cardShadow: getComputedStyle(cardShadowProbe).boxShadow,
      edgeShadow: getComputedStyle(edgeShadowProbe).boxShadow,
      radius: cs.borderTopLeftRadius,
      border: cs.borderTopWidth,
    };
    ringProbe.remove();
    colorProbe.remove();
    cardShadowProbe.remove();
    edgeShadowProbe.remove();
    return out;
  });
}

for (const theme of ['light', 'dark'] as const) {
  test(`board card rides the single-source edge ring + card-tier shadow (${theme})`, async ({
    page,
  }) => {
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
    // #161: the small-card tier rides --card-shadow (lighter than the
    // popover-tier --edge-shadow) so the card reads as grounded, not floating
    expect(card.shadow).toContain(card.cardShadow);
  });

  test(`board column container rides the same edge ring + card-tier shadow (${theme})`, async ({
    page,
  }) => {
    await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);
    await page.goto('/app?scenario=01');

    const column = await edgeContract(page, '.board-column');
    // #161 通知条↔看板列边框对齐: the column container adopts the unified
    // edge recipe — same inset ring, same 12px radius, same card-tier shadow
    // as the banner and the todo card. The seam between them is continuous
    expect(column.border).toBe('0px');
    expect(column.radius).toBe('12px');
    expect(column.shadow.startsWith(column.ring)).toBe(true);
    expect(column.ring.startsWith(`${column.borderColor} `)).toBe(true);
    expect(column.shadow).toContain(column.cardShadow);
  });

  test(`notify banner rides the same edge ring + card-tier shadow (${theme})`, async ({
    page,
  }) => {
    await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);
    await page.goto('/app?scenario=notify-banner');

    const banner = await edgeContract(page, '.board-notify-banner');
    // #161 通知条↔看板列边框对齐: the banner sits at the same elevation
    // tier as the column container — same ring, same radius, same shadow —
    // so the two surfaces read as one language
    expect(banner.border).toBe('0px');
    expect(banner.radius).toBe('12px');
    expect(banner.shadow.startsWith(banner.ring)).toBe(true);
    expect(banner.ring.startsWith(`${banner.borderColor} `)).toBe(true);
    expect(banner.shadow).toContain(banner.cardShadow);
  });

  test(`account popover rides the same edge ring as the card but keeps popover-tier shadow (${theme})`, async ({
    page,
  }) => {
    await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);
    await page.goto('/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=17');

    const menu = await edgeContract(page, '.user-menu');
    expect(menu.border).toBe('0px');
    expect(menu.radius).toBe('12px');
    expect(menu.shadow.startsWith(menu.ring)).toBe(true);
    expect(menu.ring.startsWith(`${menu.borderColor} `)).toBe(true);
    // #161: the popover opens over content and needs visible separation,
    // so it stays on the heavier --edge-shadow tier — NOT --card-shadow
    expect(menu.shadow).toContain(menu.edgeShadow);
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
