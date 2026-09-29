import { expect, type Page, test } from '@playwright/test';
import { decodePng, stripLuma } from './png.js';

// Issue #160 acceptance: the board drag is live end to end on the fixture
// surface — a cross-column drop commits the phase migration (card lands in
// the target column, counts couple), a same-column drop reorders the column
// view, and the three feedback states ride the gesture (lifted DragOverlay
// card, hovered column tint, grabbing body). #351: 待处理 is not a drop
// target — a drop there shows no tint and commits nothing. The pointer
// sequence uses trusted moves past the PointerSensor 5px threshold, drop
// point inside the target's list area.

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

// ---- gesture settle (#398) ----
// Batch-load starvation spikes (seconds-long unresponsiveness of the page's
// main thread while the machine runs the full suite) can land inside the
// assertion window AFTER the gesture state has already committed. Playwright
// matchers race every check against the deadline (pollAgainstDeadline): a
// poll whose CDP round-trip stalls past the 5s budget loses the race and
// reports "Timeout exceeded" even though data-drop was set all along — the
// observed flake (overlay-visible passing, then the data-drop assert timing
// out at ~5-7s; isolated reruns always green). These waits absorb the
// infrastructure jitter on action budgets (which tolerate a stalled
// round-trip) so the strict 5s expects that follow measure the PROPERTY, not
// machine latency. They are not assertion laundering: each phase fails on a
// genuinely broken gesture (overlay never appears, overlay never reaches the
// target, page never renders two frames), so real drag regressions still go
// red — and the strict asserts below keep their exact semantics and budget.

/** Stability waits between the gesture and mid-gesture assertions: the
 *  overlay is up, it rides the target point (the grab was the card center,
 *  so overlay center == pointer once the final DragMove render committed),
 *  and the page turned two responsive frame boundaries — any React tasks
 *  queued by the final move (collision → onDragOver → setDropColumnId →
 *  re-render) are FIFO-flushed by then. */
async function settleDrag(page: Page, to: { x: number; y: number }): Promise<void> {
  const overlay = page.locator('.board-drag-overlay .todo-card');
  await overlay.waitFor({ state: 'visible', timeout: 15_000 });
  const deadline = Date.now() + 15_000;
  for (;;) {
    const box = await overlay.boundingBox();
    if (box != null) {
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      // 60px tolerance: sub-pixel/scroll drift only — far below the ~300px
      // column pitch, so a card that never left its source column still fails
      if (Math.abs(cx - to.x) <= 60 && Math.abs(cy - to.y) <= 60) break;
    }
    if (Date.now() > deadline) {
      throw new Error('drag gesture did not settle at the target point (#398)');
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  await settleDrop(page);
}

/** Two responsive frame boundaries: flushes tasks queued before it (the drop
 *  commit chain after pointerup, or the overId effect chain mid-gesture). */
async function settleDrop(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(() => res()))),
  );
}

test('cross-column drop migrates the card, couples counts, shows the three feedback states', async ({
  page,
}) => {
  await page.goto('/app?scenario=01');
  const card = page.locator('[data-column="pending"] .todo-card').first();
  const cardId = await card.getAttribute('data-todo-id');
  const list = await page.locator('[data-column="todo"] .board-column-list').boundingBox();
  if (list == null) throw new Error('todo list missing');

  const to = { x: list.x + list.width / 2, y: list.y + 60 };
  await dragTo(page, '[data-column="pending"] .todo-card', to);
  await settleDrag(page, to);
  // mid-gesture: the lifted overlay card, the hovered column tint and the
  // grabbing body class are all observable before the drop settles
  await expect(page.locator('.board-drag-overlay .todo-card')).toBeVisible();
  await expect(page.locator('[data-column="todo"]')).toHaveAttribute('data-drop', 'true');
  await expect(page.locator('body')).toHaveClass(/board-dragging/);

  await page.mouse.up();
  await settleDrop(page);
  await expect(
    page.locator(`[data-column="todo"] .todo-card[data-todo-id="${cardId}"]`),
  ).toBeVisible();
  await expect(page.locator('[data-column="pending"] .todo-card')).toHaveCount(0);
  // header counts couple with the committed set (r2 §4.2)
  await expect(page.locator('[data-column="todo"] .board-column-count')).toHaveText('1');
  await expect(page.locator('[data-column="pending"] .board-column-count')).toHaveText('0');
  // the gesture teardown sweeps overlay + body class
  await expect(page.locator('.board-drag-overlay')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass(/board-dragging/);
});

test('same-column drop reorders the column view', async ({ page }) => {
  await page.goto('/app?scenario=35');
  const firstSel = '[data-column="done"] .board-column-list > div:first-child .todo-card';
  const second = page.locator(
    '[data-column="done"] .board-column-list > div:nth-child(2) .todo-card',
  );
  const firstId = await page.locator(firstSel).getAttribute('data-todo-id');
  const secondId = await second.getAttribute('data-todo-id');
  const secondBox = await second.boundingBox();
  if (secondBox == null) throw new Error('second done card missing');

  // drop under the second card = insertion index 1
  const to = { x: secondBox.x + secondBox.width / 2, y: secondBox.y + secondBox.height * 0.85 };
  await dragTo(page, firstSel, to);
  await settleDrag(page, to);
  await page.mouse.up();
  // the order read below is a one-shot evaluateAll (no auto-retry) — the
  // settle proves the drop commit render flushed before it (#398)
  await settleDrop(page);

  const order = await page
    .locator('[data-column="done"] .todo-card')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-todo-id')));
  expect(order[0]).toBe(secondId);
  expect(order.indexOf(firstId)).toBe(1);
});

test('drop onto 待处理 never lands — no tint mid-gesture, no commit on drop (#351)', async ({
  page,
}) => {
  await page.goto('/app?scenario=01');
  // the r5b §3.15 fold: the review+awaitingReply card sits in 待处理
  // carrying the ghost 回复 button
  const waiting = page.locator('[data-column="pending"] .todo-card').first();
  await expect(waiting.locator('.todo-card-action--ghost')).toBeVisible();
  const card = page.locator('[data-column="done"] .todo-card').first();
  const cardId = await card.getAttribute('data-todo-id');
  const list = await page.locator('[data-column="pending"] .board-column-list').boundingBox();
  if (list == null) throw new Error('pending list missing');

  const to = { x: list.x + list.width / 2, y: list.y + 60 };
  await dragTo(page, '[data-column="done"] .todo-card', to);
  // the settle also guards the NEGATIVE assert below: absence is only
  // meaningful once the gesture provably arrived and the page flushed (#398)
  await settleDrag(page, to);
  // no drop affordance on the gate column — the tint never lights
  await expect(page.locator('.board-drag-overlay .todo-card')).toBeVisible();
  await expect(page.locator('[data-column="pending"]')).not.toHaveAttribute('data-drop', 'true');

  await page.mouse.up();
  await settleDrop(page);
  // nothing commits: the card stays in 已完成, both counts untouched
  await expect(
    page.locator(`[data-column="done"] .todo-card[data-todo-id="${cardId}"]`),
  ).toBeVisible();
  await expect(page.locator('[data-column="done"] .board-column-count')).toHaveText('1');
  await expect(page.locator('[data-column="pending"] .board-column-count')).toHaveText('1');
});

test('pinned group tops 待处理: failed and review+awaitingReply lead the column (#351)', async ({
  page,
}) => {
  // scenario 55: failed #12 + review #13 (not awaiting) — failed pins first
  await page.goto('/app?scenario=55');
  const ids55 = await page
    .locator('[data-column="pending"] .todo-card')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-todo-id')));
  expect(ids55).toEqual(['r8-12', 'r8-13']);

  // scenario 02: review+awaitingReply legacy #1 + confirm probe #9 — the
  // awaiting card pins above the plain gate card
  await page.goto('/app?scenario=02');
  const ids02 = await page
    .locator('[data-column="pending"] .todo-card')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-todo-id')));
  expect(ids02).toEqual(['r3-legacy-1', '7ve0iOkQ-JBpSL98zSiGc']);
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

    const source = page.locator('[data-column="pending"] .todo-card').first();
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
    const parkTo = { x: parkX, y: listBox.y + 320 };
    await dragTo(page, '[data-column="pending"] .todo-card', parkTo);
    await settleDrag(page, parkTo);
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
      // 阈值 1.5（原 2）：B 面卡片改为 1px 描边（无 inset 环），抬升态的边
      // 缘墨只来自 --lift-shadow，实测 ~2.0 贴旧阈值下沿
      expect(ink(strips[edge]), `${edge} edge shadow ink`).toBeGreaterThan(1.5);
    }
    // the reported symptom edge: the lifted card's bottom ink must beat the
    // resting card's — never weaker (AC: 与静置态对比)
    expect(ink(strips.bottom), 'bottom ink vs resting').toBeGreaterThan(restBottomInk);

    await page.mouse.up();
  });
}

test('drop glides the overlay to the landing slot instead of snapping', async ({ page }) => {
  await page.goto('/app?scenario=01');
  const card = page.locator('[data-column="pending"] .todo-card').first();
  const cardId = await card.getAttribute('data-todo-id');
  const list = await page.locator('[data-column="todo"] .board-column-list').boundingBox();
  if (list == null) throw new Error('todo list missing');

  const to = { x: list.x + list.width / 2, y: list.y + 60 };
  await dragTo(page, '[data-column="pending"] .todo-card', to);
  await settleDrag(page, to);
  await expect(page.locator('.board-drag-overlay .todo-card')).toBeVisible();
  await page.mouse.up();
  // no settleDrop here on purpose: the >100ms timing floor below measures
  // from mouse.up, and an injected frame wait would make it vacuously true

  // dropAnimation={null} removes the overlay in the same frame as mouse.up;
  // the settle glide keeps it in flight for the 250ms default animation
  const upAt = Date.now();
  await expect(page.locator('.board-drag-overlay')).toHaveCount(0);
  expect(Date.now() - upAt).toBeGreaterThan(100);
  // and the card still lands where it was dropped
  await expect(
    page.locator(`[data-column="todo"] .todo-card[data-todo-id="${cardId}"]`),
  ).toBeVisible();
});

// ---- drop settle must not flash home (bounce-effect regression) ----
// onDragEnd cleared the gesture state before the commit wrote the optimistic
// landing, so the first post-drag paint rendered the card back in its source
// column and dnd-kit measured the drop-glide target off that stale rect: the
// lifted card visibly flew home over 250ms while the data landed correctly —
// the user-perceived 「弹回去」 with no data bounce. Frame-level trace: the
// committed node's column per rAF, plus the overlay rect until it unmounts.
test('drop settle never flashes the card home and the glide ends at the landing slot', async ({
  page,
}) => {
  await page.goto('/app?scenario=01');
  const card = page.locator('[data-column="pending"] .todo-card').first();
  const cardId = await card.getAttribute('data-todo-id');
  const list = await page.locator('[data-column="todo"] .board-column-list').boundingBox();
  if (list == null) throw new Error('todo list missing');

  const to = { x: list.x + list.width / 2, y: list.y + 60 };
  await dragTo(page, '[data-column="pending"] .todo-card', to);
  await settleDrag(page, to);
  await expect(page.locator('.board-drag-overlay .todo-card')).toBeVisible();

  await page.evaluate((id) => {
    const trace: { t: number; col: string | null; ov: { x: number; y: number } | null }[] = [];
    (window as unknown as { __glideTrace: typeof trace }).__glideTrace = trace;
    const t0 = performance.now();
    const tick = () => {
      const grid = document.querySelector(`.board-scroller .todo-card[data-todo-id="${id}"]`);
      const ov = document.querySelector(`.board-drag-overlay .todo-card[data-todo-id="${id}"]`);
      const r = ov?.getBoundingClientRect();
      trace.push({
        t: Math.round(performance.now() - t0),
        col: grid?.closest('section[data-column]')?.getAttribute('data-column') ?? null,
        ov: r == null ? null : { x: r.x + r.width / 2, y: r.y + r.height / 2 },
      });
      if (performance.now() - t0 < 1000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, cardId);

  await page.mouse.up();
  await page.waitForTimeout(1100);
  const trace = await page.evaluate(
    () => (window as unknown as { __glideTrace: { t: number; col: string | null; ov: { x: number; y: number } | null }[] }).__glideTrace,
  );
  // no post-up frame may render the committed card in the source column —
  // a single stale paint is exactly the flash-home the user sees
  const homeFrames = trace.filter((s) => s.col === 'pending');
  expect(homeFrames, `frames with the card back in 待处理: ${JSON.stringify(homeFrames)}`).toEqual(
    [],
  );
  // the glide's last position must be the landing slot, not the source
  const landed = await page
    .locator(`[data-column="todo"] .todo-card[data-todo-id="${cardId}"]`)
    .boundingBox();
  if (landed == null) throw new Error('committed card missing');
  const lastOv = [...trace].reverse().find((s) => s.ov != null)?.ov;
  expect(lastOv, 'overlay glide never observed').not.toBeUndefined();
  if (lastOv == null) throw new Error('unreachable');
  const dist = Math.hypot(lastOv.x - (landed.x + landed.width / 2), lastOv.y - (landed.y + landed.height / 2));
  expect(dist, `glide ended ${Math.round(dist)}px from the landing slot`).toBeLessThan(24);
});

// ---- drop tint paints the whole column cell (#351 highlight geometry) ----
// The list-only tint left the 37px header strip and the border ring on the
// column's own background — the highlight read as a shadow that never fills
// the grid cell. The paint surface is the column section itself.
for (const theme of ['light', 'dark'] as const) {
  test(`drop tint fills the whole column cell (${theme})`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);
    await page.goto('/app?scenario=01');
    const list = await page.locator('[data-column="todo"] .board-column-list').boundingBox();
    if (list == null) throw new Error('todo list missing');
    const to = { x: list.x + list.width / 2, y: list.y + 60 };
    await dragTo(page, '[data-column="pending"] .todo-card', to);
    await settleDrag(page, to);
    await expect(page.locator('[data-column="todo"]')).toHaveAttribute('data-drop', 'true');

    const expected = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.backgroundColor = 'var(--sidebar-hover)';
      document.body.append(probe);
      const resolved = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return resolved;
    });
    const paints = await page.evaluate(() => {
      const section = document.querySelector('[data-column="todo"]');
      const listEl = section?.querySelector('.board-column-list');
      return {
        section: section == null ? null : getComputedStyle(section).backgroundColor,
        list: listEl == null ? null : getComputedStyle(listEl).backgroundColor,
      };
    });
    // the cell carries the hover tint…
    expect(paints.section).toBe(expected);
    // …and the list no longer carries its own inset patch of it
    expect(paints.list).toBe('rgba(0, 0, 0, 0)');

    await page.mouse.up();
  });
}
