import { expect, test } from '@playwright/test';

// Issue #128 acceptance (dogfood 侧栏视觉三件, claude.ai 参照面): the ⌘K chip
// is the official bordered pill (r7 01/02 probe: 26×20 box, 1px
// --border-default ring, right-anchored) sitting clear of the 搜索 label —
// the row-content lift rule must not demote it into the label's flow; the
// hover and selected pills share ONE geometry (the official 32px inset
// pill, radius 6) with the selected state one cds alpha step deeper than
// the hover instead of a different shape; the machine-online dot keeps its
// absolute anchor (same lift-rule hazard as the kbd chip).

/** Parse a computed rgb()/rgba() color. */
const parse = (c: string) => {
  const m = c.match(/[\d.]+/g)?.map(Number);
  if (m == null || m.length < 3) throw new Error(`unparsable color ${c}`);
  return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 };
};

/** Composite an rgba foreground over an opaque background. */
const over = (fg: string, bg: string) => {
  const f = parse(fg);
  const b = parse(bg);
  return {
    r: f.a * f.r + (1 - f.a) * b.r,
    g: f.a * f.g + (1 - f.a) * b.g,
    b: f.a * f.b + (1 - f.a) * b.b,
  };
};

const dist = (x: { r: number; g: number; b: number }, y: { r: number; g: number; b: number }) =>
  Math.abs(x.r - y.r) + Math.abs(x.g - y.g) + Math.abs(x.b - y.b);

for (const theme of ['light', 'dark'] as const) {
  test(`⌘K chip is a bordered pill clear of the label (${theme})`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);
    await page.goto('/app?scenario=01');

    const m = await page.evaluate(() => {
      const kbd = document.querySelector('.sidebar-kbd');
      const row = kbd?.closest('.sidebar-row');
      const label = row?.querySelector('.sidebar-row-label');
      const sidebar = document.querySelector('.board-sidebar');
      if (!kbd || !row || !label || !sidebar) throw new Error('sidebar search row missing');
      const kr = kbd.getBoundingClientRect();
      const lr = label.getBoundingClientRect();
      const sr = sidebar.getBoundingClientRect();
      const cs = getComputedStyle(kbd);
      return {
        pos: cs.position,
        borderWidth: cs.borderTopWidth,
        kbdLeft: kr.x,
        kbdRight: kr.right,
        kbdHeight: kr.height,
        labelRight: lr.right,
        sidebarRight: sr.right,
      };
    });
    // absolute anchor — the lift rule for row content must not demote it
    // into the label's flow (the #128 overlap bug)
    expect(m.pos).toBe('absolute');
    // the official ring (r7 01/02 probe), not bare text
    expect(m.borderWidth).toBe('1px');
    // clear of the 搜索 label, right-anchored at the official offset
    expect(m.kbdLeft).toBeGreaterThanOrEqual(m.labelRight);
    expect(m.sidebarRight - m.kbdRight).toBeGreaterThanOrEqual(12);
    expect(m.sidebarRight - m.kbdRight).toBeLessThanOrEqual(22);
    // the official 20px-tall chip box
    expect(m.kbdHeight).toBeGreaterThanOrEqual(18);
    expect(m.kbdHeight).toBeLessThanOrEqual(22);
  });

  test(`hover and selected pills share one geometry (${theme})`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);
    await page.goto('/app?scenario=01');

    const geo = await page.evaluate(() => {
      const pill = (el: Element) => {
        const cs = getComputedStyle(el, '::before');
        return {
          top: cs.top,
          bottom: cs.bottom,
          left: cs.left,
          right: cs.right,
          radius: cs.borderTopLeftRadius,
        };
      };
      const selected = document.querySelector('.sidebar-row--selected');
      const plain = [...document.querySelectorAll('.sidebar-row')].find(
        (el) => !el.classList.contains('sidebar-row--selected'),
      );
      if (!selected || !plain) throw new Error('sidebar rows missing');
      return {
        selected: pill(selected),
        plain: pill(plain),
        rowMargin: getComputedStyle(selected).marginLeft,
        rowWidth: selected.getBoundingClientRect().width,
        sidebarWidth: document.querySelector('.board-sidebar')?.getBoundingClientRect().width,
      };
    });
    // one pill geometry for both states — selected is a deepen, not a shape
    expect(geo.plain).toEqual(geo.selected);
    // the official 32px inset pill (r7 01/02 probe: 2px vertical inset)
    expect(geo.selected.top).toBe('2px');
    expect(geo.selected.bottom).toBe('2px');
    expect(geo.selected.radius).toBe('6px');
    // no margin hack on the selected row → no right-edge clip
    expect(geo.rowMargin).toBe('0px');
    expect(geo.rowWidth).toBe(geo.sidebarWidth);
  });

  test(`selected pill deepens the hover step (${theme})`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);
    await page.goto('/app?scenario=01');

    const sidebarBg = await page.evaluate(
      () => getComputedStyle(document.querySelector('.board-sidebar')!).backgroundColor,
    );
    await page.hover('.sidebar-row:has-text("定时")');
    await page.waitForTimeout(300); // the 150ms color step settles
    const hoverBg = await page.evaluate(
      () =>
        getComputedStyle(
          [...document.querySelectorAll('.sidebar-row')].find((el) => el.matches(':hover'))!,
          '::before',
        ).backgroundColor,
    );
    const selectedBg = await page.evaluate(
      () => getComputedStyle(document.querySelector('.sidebar-row--selected')!, '::before').backgroundColor,
    );

    const bg = parse(sidebarBg);
    const hover = over(hoverBg, sidebarBg);
    const selected = over(selectedBg, sidebarBg);
    // hover reads off the sidebar layer (the #128 "invisible/muddy" fix)
    expect(dist(hover, bg)).toBeGreaterThan(6);
    // selected = the deeper step of the same ladder, not a twin
    expect(dist(selected, bg)).toBeGreaterThan(dist(hover, bg) + 6);

    // hovering the selected row must not wash it back to the hover step
    await page.hover('.sidebar-row--selected');
    await page.waitForTimeout(300);
    const selectedHovered = await page.evaluate(
      () => getComputedStyle(document.querySelector('.sidebar-row--selected')!, '::before').backgroundColor,
    );
    expect(selectedHovered).toBe(selectedBg);
  });
}

test('machine-online dot keeps its absolute anchor', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pacman-theme', 'dark'));
  // chief fixture scenarios set machineOnline on the 机器 row
  await page.goto('/app?scenario=100');

  const dot = await page.evaluate(() => {
    const el = document.querySelector('.sidebar-online-dot');
    const row = el?.closest('.sidebar-subrow');
    if (!el || !row) throw new Error('machine-online dot missing');
    const cs = getComputedStyle(el);
    const dr = el.getBoundingClientRect();
    const rr = row.getBoundingClientRect();
    return {
      pos: cs.position,
      centerYDelta: Math.abs(dr.y + dr.height / 2 - (rr.y + rr.height / 2)),
    };
  });
  // same lift-rule hazard as the kbd chip: relative would drop it into the
  // label flow and off its vertical center
  expect(dot.pos).toBe('absolute');
  expect(dot.centerYDelta).toBeLessThan(2);
});
