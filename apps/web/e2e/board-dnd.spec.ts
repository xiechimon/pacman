import { expect, type Page, test } from '@playwright/test';
import { decodePng, stripLuma } from './png.js';

// Issue #160 acceptance: the board drag is live end to end on the fixture
// surface — a cross-column drop commits the phase migration (card lands in
// the target column, counts couple), a same-column drop reorders the column
// view, a drop on the empty 待验收 column clears awaitingReply (r5b §3.15
// fold), and the three feedback states ride the gesture (lifted DragOverlay
// card, hovered column tint, grabbing body). The pointer sequence uses
// trusted moves past the PointerSensor 5px threshold, drop point inside
// the target's list area.

/** Press the first match of `fromSel` and carry it to a viewport point.
 *  Leaves the button down — the caller asserts mid-gesture state, then ups. */
async function dragTo(page: Page, fromSel: string, to: { x: number; y: number }): Promise<void> {
  const fromBox = await page.locator(fromSel).first().boundingBox();
  if (fromBox == null) throw new Error(`drag source missing: ${fromSel}`);
  const sx = fromBox.x + fromBox.width / 2;
  const sy = fromBox.y + fromBox.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 8, sy + 6, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 12 });
}

/** Columns 5–6 sit past the 1440 fold; pointer events outside the viewport
 *  never reach the sensor, so park the scroller right before measuring. */
async function scrollBoardEnd(page: Page): Promise<void> {
  await page.locator('.board-scroller').evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
}

test('cross-column drop migrates the card, couples counts, shows the three feedback states', async ({
  page,
}) => {
  await page.goto('/app?scenario=01');
  const card = page.locator('[data-column="building"] .todo-card').first();
  const cardId = await card.getAttribute('data-todo-id');
  const list = await page.locator('[data-column="confirm"] .board-column-list').boundingBox();
  if (list == null) throw new Error('confirm list missing');

  await dragTo(page, '[data-column="building"] .todo-card', {
    x: list.x + list.width / 2,
    y: list.y + 60,
  });
  // mid-gesture: the lifted overlay card, the hovered column tint and the
  // grabbing body class are all observable before the drop settles
  await expect(page.locator('.board-drag-overlay .todo-card')).toBeVisible();
  await expect(page.locator('[data-column="confirm"]')).toHaveAttribute('data-drop', 'true');
  await expect(page.locator('body')).toHaveClass(/board-dragging/);

  await page.mouse.up();
  await expect(
    page.locator(`[data-column="confirm"] .todo-card[data-todo-id="${cardId}"]`),
  ).toBeVisible();
  await expect(page.locator('[data-column="building"] .todo-card')).toHaveCount(0);
  // header counts couple with the committed set (r2 §4.2)
  await expect(page.locator('[data-column="confirm"] .board-column-count')).toHaveText('1');
  await expect(page.locator('[data-column="building"] .board-column-count')).toHaveText('0');
  // the gesture teardown sweeps overlay + body class
  await expect(page.locator('.board-drag-overlay')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass(/board-dragging/);
});

test('same-column drop reorders the column view', async ({ page }) => {
  await page.goto('/app?scenario=35');
  await scrollBoardEnd(page);
  const firstSel = '[data-column="done"] .board-column-list > div:first-child .todo-card';
  const second = page.locator(
    '[data-column="done"] .board-column-list > div:nth-child(2) .todo-card',
  );
  const firstId = await page.locator(firstSel).getAttribute('data-todo-id');
  const secondId = await second.getAttribute('data-todo-id');
  const secondBox = await second.boundingBox();
  if (secondBox == null) throw new Error('second done card missing');

  // drop under the second card = insertion index 1
  await dragTo(page, firstSel, {
    x: secondBox.x + secondBox.width / 2,
    y: secondBox.y + secondBox.height * 0.85,
  });
  await page.mouse.up();

  const order = await page
    .locator('[data-column="done"] .todo-card')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-todo-id')));
  expect(order[0]).toBe(secondId);
  expect(order.indexOf(firstId)).toBe(1);
});

test('cross-column drop on the empty review column clears awaitingReply', async ({ page }) => {
  await page.goto('/app?scenario=01');
  await scrollBoardEnd(page);
  const card = page.locator('[data-column="building"] .todo-card').first();
  const cardId = await card.getAttribute('data-todo-id');
  // r5b §3.15 fold: the review+awaitingReply card pins to 执行中 carrying
  // the ghost 回复 button
  await expect(card.locator('.todo-card-action--ghost')).toBeVisible();
  const list = await page.locator('[data-column="review"] .board-column-list').boundingBox();
  if (list == null) throw new Error('review list missing');

  await dragTo(page, '[data-column="building"] .todo-card', {
    x: list.x + list.width / 2,
    y: list.y + 60,
  });
  await page.mouse.up();

  const landed = page.locator(`[data-column="review"] .todo-card[data-todo-id="${cardId}"]`);
  await expect(landed).toBeVisible();
  // the drop clears awaitingReply (dnd.test cross-column case) — otherwise
  // the fold would put the card right back into 执行中
  await expect(landed.locator('.todo-card-action--ghost')).toHaveCount(0);
  await expect(page.locator('[data-column="building"] .todo-card')).toHaveCount(0);
});

// ---- lifted-card shadow + drop settle (#391) ----
// The DragOverlay copy rides the lift-tier shadow (--lift-shadow) in BOTH
// themes: the pre-#391 light-only `filter: drop-shadow(0 8px 16px)` parked the
// shadow mass 8px below the card (the top edge went faint and the dark side
// had no lift at all), while the box-shadow lift tier keeps all four edges
// inked. The drop glides the overlay to the landing slot (dnd-kit default
// 250ms ease) instead of snapping out.
//
// Pixel-probe geometry: the card parks straddling the sidebar / first-column
// boundary so each edge's near strip and clean reference strip sit on ONE
// uniform surface — left edge over the sidebar (bright enough in dark mode
// for a black shadow to register), top/right/bottom over the todo column's
// tinted list. The faded source preview stacks at the list top, so every
// reference strip must stay below it.

/** probe strip pairs (near vs clean reference) for one overlay box */
function edgeStrips(box: { x: number; y: number; width: number; height: number }) {
  const midX = box.x + box.width / 2;
  const midY = box.y + box.height / 2;
  const T = box.y;
  const B = box.y + box.height;
  const L = box.x;
  const R = box.x + box.width;
  return {
    bottom: { near: [midX - 40, B + 1, midX + 40, B + 3], ref: [midX - 40, B + 70, midX + 40, B + 90] },
    top: { near: [midX - 40, T - 3, midX + 40, T - 1], ref: [midX - 40, T - 90, midX + 40, T - 70] },
    left: { near: [L - 3, midY - 30, L - 1, midY + 30], ref: [L - 3, T - 110, L - 1, T - 70] },
    right: { near: [R + 1, midY - 30, R + 3, midY + 30], ref: [R + 1, T - 110, R + 3, T - 70] },
  } as const;
}

for (const theme of ['light', 'dark'] as const) {
  test(`lifted card rides the lift-tier shadow on all four edges (${theme})`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);
    await page.goto('/app?scenario=01');

    const source = page.locator('[data-column="building"] .todo-card').first();
    const restStyle = await source.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { boxShadow: cs.boxShadow, filter: cs.filter };
    });
    // resolve the expected lift stack through the same token path the card uses
    const expectedLift = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.boxShadow = 'var(--edge-ring), var(--lift-shadow)';
      document.body.append(probe);
      const resolved = getComputedStyle(probe).boxShadow;
      probe.remove();
      return resolved;
    });

    const todoList = page.locator('[data-column="todo"] .board-column-list');
    const listBox = await todoList.boundingBox();
    const sidebar = await page.locator('.board-sidebar').boundingBox();
    if (listBox == null || sidebar == null) throw new Error('board geometry missing');
    const sourceBox = await source.boundingBox();
    if (sourceBox == null) throw new Error('source card missing');

    // resting control (AC: 与静置态对比) — bottom-edge ink of the card at
    // rest, pre-drag; the lift must read stronger than this on the same edge
    const restImg = decodePng(await page.screenshot());
    const restBottom = edgeStrips(sourceBox).bottom;
    const restBottomInk =
      stripLuma(restImg, restBottom.ref[0], restBottom.ref[1], restBottom.ref[2], restBottom.ref[3]) -
      stripLuma(
        restImg,
        restBottom.near[0],
        restBottom.near[1],
        restBottom.near[2],
        restBottom.near[3],
      );

    // park the lifted card with its left edge 2px onto the sidebar
    const parkX = sidebar.x + sidebar.width - 2 + sourceBox.width / 2;
    await dragTo(page, '[data-column="building"] .todo-card', {
      x: parkX,
      y: listBox.y + 320,
    });
    const overlay = page.locator('.board-drag-overlay .todo-card');
    await expect(overlay).toBeVisible();

    // style contract: the lift tier replaces the resting card tier in both
    // themes — no light-only filter hack
    const liftStyle = await overlay.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { boxShadow: cs.boxShadow, filter: cs.filter };
    });
    expect(liftStyle.filter).toBe('none');
    expect(liftStyle.boxShadow).toBe(expectedLift);
    expect(liftStyle.boxShadow).not.toBe(restStyle.boxShadow);

    // geometry guards: fail loud if the fixture layout drifts and the probe
    // strips no longer sit on their intended surfaces
    const box = await overlay.boundingBox();
    if (box == null) throw new Error('overlay box missing');
    const faded = await page
      .locator('[data-column="todo"] .todo-card')
      .first()
      .boundingBox();
    if (faded == null) throw new Error('dragged preview card missing');
    const sidebarRight = sidebar.x + sidebar.width;
    expect(box.x).toBeGreaterThanOrEqual(sidebarRight - 4);
    expect(box.x).toBeLessThanOrEqual(sidebarRight);
    expect(box.y - 110).toBeGreaterThan(faded.y + faded.height + 8);
    expect(box.y + box.height + 90).toBeLessThan(listBox.y + listBox.height);

    // pixel contract: every edge darkens its immediate surround vs the clean
    // reference strip on the same surface
    const img = decodePng(await page.screenshot());
    const strips = edgeStrips(box);
    const ink = (s: { near: readonly number[]; ref: readonly number[] }) =>
      stripLuma(img, s.ref[0], s.ref[1], s.ref[2], s.ref[3]) -
      stripLuma(img, s.near[0], s.near[1], s.near[2], s.near[3]);
    for (const edge of ['bottom', 'top', 'left', 'right'] as const) {
      expect(ink(strips[edge]), `${edge} edge shadow ink`).toBeGreaterThan(2);
    }
    // the reported symptom edge: the lifted card's bottom ink must beat the
    // resting card's — never weaker (AC: 与静置态对比)
    expect(ink(strips.bottom), 'bottom ink vs resting').toBeGreaterThan(restBottomInk);

    await page.mouse.up();
  });
}

test('drop glides the overlay to the landing slot instead of snapping', async ({ page }) => {
  await page.goto('/app?scenario=01');
  const card = page.locator('[data-column="building"] .todo-card').first();
  const cardId = await card.getAttribute('data-todo-id');
  const list = await page.locator('[data-column="confirm"] .board-column-list').boundingBox();
  if (list == null) throw new Error('confirm list missing');

  await dragTo(page, '[data-column="building"] .todo-card', {
    x: list.x + list.width / 2,
    y: list.y + 60,
  });
  await expect(page.locator('.board-drag-overlay .todo-card')).toBeVisible();
  await page.mouse.up();

  // dropAnimation={null} removes the overlay in the same frame as mouse.up;
  // the settle glide keeps it in flight for the 250ms default animation
  const upAt = Date.now();
  await expect(page.locator('.board-drag-overlay')).toHaveCount(0);
  expect(Date.now() - upAt).toBeGreaterThan(100);
  // and the card still lands where it was dropped
  await expect(
    page.locator(`[data-column="confirm"] .todo-card[data-todo-id="${cardId}"]`),
  ).toBeVisible();
});
