import { expect, type Page, test } from '@playwright/test';

// Issue #160 acceptance: the board drag is live end to end on the fixture
// surface — a cross-column drop commits the phase migration (card lands in
// the target column, counts couple), a same-column drop reorders the column
// view, a drop on the empty 待验收 column clears awaitingReply (r5b §3.15
// fold), and the three feedback states ride the gesture (lifted DragOverlay
// card, hovered column tint, grabbing body). The pointer sequence mirrors
// the parity drag driver (parity/run.mjs): trusted moves past the
// PointerSensor 5px threshold, drop point inside the target's list area.

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
