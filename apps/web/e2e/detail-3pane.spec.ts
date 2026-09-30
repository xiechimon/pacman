import { expect, test } from '@playwright/test';

// Issue #366: the detail route drops the 文档|聊天 tab group and re-lays
// out as three abutting panes — 240 sidebar | fluid thread | 488 right
// pane (docs/design/todos.dev.md grid). The right pane owns the doc
// surface (plan/changes/diff) plus the three former head-icon overlays
// (分支与 PR / Token 用量 / 运行历史) as static pane sections picked from
// the document-type select; fresh phases park a restrained empty state
// there at the same 488px. The composer is the only card in the center
// column. Each test pins one failure way of the rework:
//   1. pane widths/abutment wrong  2. tab group survives somewhere
//   3. head icon trio survives     4. composer escapes the center column,
//      loses its card form, or overlays the transcript again (#472)
//   5. section switching dead      6. frozen pane-view scenarios
//      (30/31/32) still pop dialogs  7. fresh phase collapses the right
//      pane or loses the fresh block

const DETAIL_ROUTE = '/app/todo/7ve0iOkQ-JBpSL98zSiGc';
const FRESH = '/app/todo/fresh-probe?scenario=23';

test('three abutting panes: 240 sidebar | fluid center | 488 right', async ({ page }) => {
  await page.goto(`${DETAIL_ROUTE}?scenario=17b`);
  const geo = await page.evaluate(() => {
    const rect = (sel: string) => {
      const r = document.querySelector(sel)!.getBoundingClientRect();
      return { left: r.left, right: r.right, width: Math.round(r.width) };
    };
    return {
      sidebar: rect('.board-sidebar'),
      center: rect('.detail-center'),
      right: rect('.detail-right'),
    };
  });
  expect(geo.sidebar.width).toBe(240);
  expect(geo.right.width).toBe(488);
  // panes abut — no gap, no overlap (hairline borders ride inside the boxes)
  expect(Math.round(geo.center.left)).toBe(Math.round(geo.sidebar.right));
  expect(Math.round(geo.right.left)).toBe(Math.round(geo.center.right));
  // center takes the fluid remainder (712 at the 1440 e2e viewport)
  expect(geo.center.width).toBe(1440 - 240 - 488);
  // the seam between center and right is a 1px hairline, not a shadow
  const seam = await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('.detail-right')!);
    return { borderLeft: cs.borderLeftWidth, shadow: cs.boxShadow };
  });
  expect(seam.borderLeft).toBe('1px');
  expect(seam.shadow).toBe('none');
});

test('no 文档|聊天 tab group survives on any phase surface', async ({ page }) => {
  for (const scenario of ['16', '17b', '23', '26', '27', '36']) {
    await page.goto(`${DETAIL_ROUTE}?scenario=${scenario}`);
    await expect(page.locator('.detail-tabs-group')).toHaveCount(0);
    await expect(page.locator('.detail-tab')).toHaveCount(0);
    await expect(page.locator('.detail-tabs')).toHaveCount(0);
  }
});

test('detail head keeps the 更多 icon only — branch/token/history icons are gone', async ({
  page,
}) => {
  await page.goto(`${DETAIL_ROUTE}?scenario=27`);
  await expect(page.locator('.detail-head-icon--more')).toBeVisible();
  for (const label of ['分支与 PR', 'Token 用量', '运行历史']) {
    await expect(page.locator(`.detail-head button[aria-label="${label}"]`)).toHaveCount(0);
  }
});

test('composer stays in-flow inside the center column: card form, 16px insets, scroll port ends above it', async ({
  page,
}) => {
  await page.goto(`${DETAIL_ROUTE}?scenario=17b`);
  const geo = await page.evaluate(() => {
    const rect = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
    const center = rect('.detail-center');
    const main = rect('.detail-main');
    const col = rect('.chat-col');
    const comp = document.querySelector('.composer')!;
    const r = comp.getBoundingClientRect();
    const cs = getComputedStyle(comp);
    const colCs = getComputedStyle(document.querySelector('.chat-col')!);
    return {
      centerLeft: center.left,
      centerRight: center.right,
      mainBottom: main.bottom,
      colBottom: col.bottom,
      compLeft: r.left,
      compRight: r.right,
      compTop: r.top,
      compBottom: r.bottom,
      radius: cs.borderRadius,
      border: cs.borderTopWidth,
      position: cs.position,
      colPadBottom: Number.parseFloat(colCs.paddingBottom),
    };
  });
  // the r7 §3.4 card recipe survives the flow move
  expect(geo.radius).toBe('12px');
  expect(geo.border).toBe('1px');
  // #472 in-flow law: a layout participant, never an overlay again —
  // relative (not static) because the in-card toolbar/send/stop absolutes
  // anchor to it
  expect(geo.position).toBe('relative');
  // 16px insets inside the center column — never crossing into the pane
  expect(geo.compLeft).toBeCloseTo(geo.centerLeft + 16, 0);
  expect(geo.compRight).toBeCloseTo(geo.centerRight - 16, 0);
  // the card keeps its 16px bottom inset (the old absolute-anchor visual)
  expect(geo.mainBottom - geo.compBottom).toBeCloseTo(16, 0);
  // the transcript scroll port ends exactly at the card top: text can no
  // longer pass under the opaque card…
  expect(geo.colBottom).toBeCloseTo(geo.compTop, 0);
  // …and a bottom-pinned last row keeps a real gap from the card edge
  expect(geo.colPadBottom).toBeGreaterThanOrEqual(16);
});

test('composer width tracks the center column across both pane states (488 pane / 418 chief dock)', async ({
  page,
}) => {
  await page.goto(`${DETAIL_ROUTE}?scenario=detail-unread`);
  const measure = () =>
    page.evaluate(() => {
      const c = document.querySelector('.detail-center')!.getBoundingClientRect();
      const r = document.querySelector('.composer')!.getBoundingClientRect();
      return { center: c.width, comp: r.width };
    });
  const pane = await measure();
  expect(pane.center).toBe(1440 - 240 - 488);
  expect(pane.comp).toBeCloseTo(pane.center - 32, 0);
  // chief dock (#447 D7): the panel takes the right slot at 418px and the
  // composer width follows the column — in-flow needs no pane-var resync
  await page.locator('.detail-fab').click();
  await expect(page.locator('.detail-right')).toHaveCount(0);
  const drawer = page.locator('.chief-drawer');
  await drawer.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  const docked = await measure();
  expect(docked.center).toBeCloseTo(1440 - 240 - 418, 0);
  expect(docked.comp).toBeCloseTo(docked.center - 32, 0);
});

test('right pane type select switches between the doc surface and the three sections', async ({
  page,
}) => {
  await page.goto(`${DETAIL_ROUTE}?scenario=27`);
  // review phase opens on the doc view (变更 surface)
  await expect(page.locator('.detail-right .doc-pane')).toBeVisible();
  await expect(page.locator('.dlg')).toHaveCount(0);

  const select = page.locator('.doc-select-wrap .doc-pane-select');
  await select.click();
  const dropdown = page.locator('.plan-dropdown');
  await expect(dropdown).toBeVisible();
  await expect(dropdown.locator('.plan-dropdown-row')).toHaveCount(4);
  await expect(dropdown.locator('.plan-dropdown-row').first()).toContainText('变更');

  // pick Token 用量 → static section in the pane, no dialog anywhere
  await dropdown.locator('.plan-dropdown-row', { hasText: 'Token 用量' }).click();
  await expect(dropdown).toBeHidden();
  await expect(page.locator('.dlg')).toHaveCount(0);
  await expect(page.locator('.detail-right .doc-pane')).toHaveCount(0);
  await expect(page.locator('.detail-right .dlg-token-total')).toBeVisible();

  // the section head carries the same select — switch back to the doc view
  await page.locator('.doc-select-wrap .doc-pane-select').click();
  await page.locator('.plan-dropdown-row', { hasText: '变更' }).click();
  await expect(page.locator('.detail-right .doc-pane')).toBeVisible();
  await expect(page.locator('.dlg-token-total')).toHaveCount(0);
});

test('scenarios 30/31/32 freeze the pane view instead of popping dialogs', async ({ page }) => {
  await page.goto(`${DETAIL_ROUTE}?scenario=30`);
  await expect(page.locator('.dlg')).toHaveCount(0);
  await expect(page.locator('.detail-right .dlg-token-total')).toBeVisible();

  await page.goto(`${DETAIL_ROUTE}?scenario=31`);
  await expect(page.locator('.dlg')).toHaveCount(0);
  await expect(page.locator('.detail-right .dlg-branch-box')).toBeVisible();

  await page.goto(`${DETAIL_ROUTE}?scenario=32`);
  await expect(page.locator('.dlg')).toHaveCount(0);
  await expect(page.locator('.detail-right .dlg-history-row')).toHaveCount(1);
});

test('plan card activation in the thread opens the plan doc in the right pane', async ({
  page,
}) => {
  await page.goto(`${DETAIL_ROUTE}?scenario=plan-open`);
  // review phase opens on the changes surface
  await expect(page.locator('.doc-select-wrap .doc-pane-select')).toContainText('变更');
  // the build-open round carries its own plan card; the frozen row is first
  await page.locator('.chat-plan-open').first().click();
  // activation flips the pane to the doc view's plan surface
  await expect(page.locator('.doc-select-wrap .doc-pane-select')).toContainText('方案');
  await expect(page.locator('.doc-pane-body .doc-block').first()).toBeVisible();
});

test('fresh phase: fresh block centers, right pane holds the 488px empty state', async ({
  page,
}) => {
  await page.goto(FRESH);
  await expect(page.locator('.detail-center .fresh-block')).toBeVisible();
  const right = page.locator('.detail-right');
  await expect(right).toBeVisible();
  const width = await right.evaluate((el) => Math.round(el.getBoundingClientRect().width));
  expect(width).toBe(488);
  await expect(page.locator('.right-empty')).toBeVisible();
  await expect(page.locator('.right-empty')).toContainText('尚无运行内容');
  await expect(page.locator('.doc-pane')).toHaveCount(0);
});
