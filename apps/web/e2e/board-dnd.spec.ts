import { expect, type Page, test } from '@playwright/test';

// Issue #616 acceptance: the board drag is the reference product's drag
// (todos.dev, 2026-10-02 live 实测) — a pure cross-column phase vehicle:
//   · 可拖面 = 待开始（+ 执行中，本仓保留语义）；待处理/已完成 cards carry no
//     sensor at all (press travels straight to the card's own click);
//   · the lift is a COMPACT clone (.board-drag-card: identity row + 2-line
//     title, 8px radius, 2° tilt, 0.92 opacity, --drag-shadow) — not the
//     board card copy; the source wrapper dims to 0.4 and keeps its slot;
//   · siblings NEVER shift mid-gesture and a same-column drop commits
//     nothing (the reference has no in-column reorder — #73/#403's sortable
//     preview retired with it);
//   · every valid target column tints while the gesture flies (base tier),
//     the hovered one a step hotter — indigo recipe, whole cell (#351
//     geometry law kept); 待处理 (#351) and the source column stay neutral;
//   · 执行中 is the start gate: the drop opens the 开始任务 dialog (#318
//     unified face) and the phase is NOT written until a confirm — cancel
//     commits nothing;
//   · 待开始/已完成 drops commit the phase silently, card lands at the END of
//     the target column, counts couple (r2 §4.2);
//   · the overlay unmounts on the pointerup frame — no drop glide (#391's
//     250ms flight was a pacman invention; the reference snaps).
// The pointer sequence uses trusted moves past the PointerSensor 5px
// threshold, drop point inside the target's list area.

const PROBE_ID = '7ve0iOkQ-JBpSL98zSiGc';

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
// Batch-load starvation spikes can land inside the assertion window AFTER
// the gesture state has already committed. Playwright matchers race every
// check against the deadline: these waits absorb the infrastructure jitter
// on action budgets so the strict expects that follow measure the PROPERTY,
// not machine latency. Each phase still fails on a genuinely broken gesture
// (overlay never appears / page never renders two frames).

/** The overlay is up (compact drag card mounted) and the page turned two
 *  responsive frame boundaries — any React tasks queued by the final move
 *  (collision → onDragOver → setDropColumnId → re-render) are FIFO-flushed. */
async function settleDrag(page: Page): Promise<void> {
  await page
    .locator('.board-drag-overlay .board-drag-card')
    .waitFor({ state: 'visible', timeout: 15_000 });
  await settleDrop(page);
}

/** Two responsive frame boundaries: flushes tasks queued before it (the drop
 *  commit chain after pointerup, or the overId effect chain mid-gesture). */
async function settleDrop(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(() => res()))),
  );
}

/** Resolve a CSS declaration through the same token path the board uses
 *  (probe-div trick — the computed value is the canon, not the source text). */
async function resolveStyle(page: Page, decls: Record<string, string>): Promise<Record<string, string>> {
  return page.evaluate((d) => {
    const probe = document.createElement('div');
    for (const [k, v] of Object.entries(d)) probe.style.setProperty(k, v);
    document.body.append(probe);
    const cs = getComputedStyle(probe);
    const out: Record<string, string> = {};
    for (const k of Object.keys(d)) {
      const camel = k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      out[k] = cs.getPropertyValue(k) || (cs as unknown as Record<string, string>)[camel] || '';
    }
    probe.remove();
    return out;
  }, decls);
}

test('待开始 → 已完成: silent commit, end-of-column landing, counts couple, teardown sweeps', async ({
  page,
}) => {
  await page.goto('/app?scenario=22');
  const list = await page.locator('[data-column="done"] .board-column-list').boundingBox();
  if (list == null) throw new Error('done list missing');
  const to = { x: list.x + list.width / 2, y: list.y + 60 };

  await dragTo(page, '[data-column="todo"] .todo-card', to);
  await settleDrag(page);
  // three feedback states ride the gesture: lifted compact card, hovered
  // column tint, grabbing body
  await expect(page.locator('.board-drag-overlay .board-drag-card')).toBeVisible();
  await expect(page.locator('[data-column="done"]')).toHaveAttribute('data-drop', 'true');
  await expect(page.locator('body')).toHaveClass(/board-dragging/);

  await page.mouse.up();
  await settleDrop(page);
  // committed: the probe lands in 已完成 AFTER the incumbent (end of column)
  await expect(
    page.locator(`[data-column="done"] .todo-card[data-todo-id="${PROBE_ID}"]`),
  ).toBeVisible();
  const doneOrder = await page
    .locator('[data-column="done"] .todo-card')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-todo-id')));
  expect(doneOrder[doneOrder.length - 1]).toBe(PROBE_ID);
  await expect(page.locator('[data-column="todo"] .todo-card')).toHaveCount(0);
  // header counts couple with the committed set (r2 §4.2)
  await expect(page.locator('[data-column="todo"] .board-column-count')).toHaveText('0');
  await expect(page.locator('[data-column="done"] .board-column-count')).toHaveText('2');
  // the gesture teardown sweeps overlay + body class
  await expect(page.locator('.board-drag-overlay')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass(/board-dragging/);
});

test('待开始 → 执行中: the 开始任务 dialog gates the phase — cancel commits nothing', async ({
  page,
}) => {
  await page.goto('/app?scenario=22');
  const list = await page.locator('[data-column="building"] .board-column-list').boundingBox();
  if (list == null) throw new Error('building list missing');
  const to = { x: list.x + list.width / 2, y: list.y + 60 };

  await dragTo(page, '[data-column="todo"] .todo-card', to);
  await settleDrag(page);
  await expect(page.locator('[data-column="building"]')).toHaveAttribute('data-drop', 'true');
  await page.mouse.up();
  await settleDrop(page);

  // the start gate is up (#318 unified face) and the overlay is gone
  await expect(page.locator('.overlay-title')).toHaveText('开始任务');
  await expect(page.locator('.board-drag-overlay')).toHaveCount(0);
  // the phase is NOT written: the probe still sits in 待开始, counts untouched
  await expect(
    page.locator(`[data-column="todo"] .todo-card[data-todo-id="${PROBE_ID}"]`),
  ).toBeVisible();
  await expect(page.locator('[data-column="todo"] .board-column-count')).toHaveText('1');
  await expect(page.locator('[data-column="building"] .board-column-count')).toHaveText('0');

  // cancel (family close law #168: Esc) → still zero commit
  await page.keyboard.press('Escape');
  await expect(page.locator('.overlay-title')).toHaveCount(0);
  await expect(
    page.locator(`[data-column="todo"] .todo-card[data-todo-id="${PROBE_ID}"]`),
  ).toBeVisible();
  await expect(page.locator('[data-column="building"] .board-column-count')).toHaveText('0');
});

test('待处理 never a target (#351): no tint tier, no commit', async ({ page }) => {
  await page.goto('/app?scenario=22');
  // the r5b §3.15 fold: the review+awaitingReply card sits in 待处理
  await expect(
    page.locator('[data-column="pending"] .todo-card .todo-card-action--ghost'),
  ).toBeVisible();
  const list = await page.locator('[data-column="pending"] .board-column-list').boundingBox();
  if (list == null) throw new Error('pending list missing');
  const to = { x: list.x + list.width / 2, y: list.y + 60 };

  await dragTo(page, '[data-column="todo"] .todo-card', to);
  await settleDrag(page);
  // no drop affordance on the gate column — neither tint tier lights
  await expect(page.locator('[data-column="pending"]')).not.toHaveAttribute('data-drop', 'true');
  await expect(page.locator('[data-column="pending"]')).not.toHaveAttribute('data-drop-valid');

  await page.mouse.up();
  await settleDrop(page);
  // nothing commits: the probe stays in 待开始, both counts untouched
  await expect(
    page.locator(`[data-column="todo"] .todo-card[data-todo-id="${PROBE_ID}"]`),
  ).toBeVisible();
  await expect(page.locator('[data-column="todo"] .board-column-count')).toHaveText('1');
  await expect(page.locator('[data-column="pending"] .board-column-count')).toHaveText('1');
});

test('same-column gesture: siblings never shift, drop is a no-op', async ({ page }) => {
  await page.goto('/app?scenario=22');
  const box = await page.locator('[data-column="todo"] .todo-card').first().boundingBox();
  if (box == null) throw new Error('probe card missing');
  const before = await page.locator('.todo-card').evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { id: e.getAttribute('data-todo-id'), x: Math.round(r.x), y: Math.round(r.y) };
    }),
  );

  const sx = box.x + box.width / 2;
  const sy = box.y + box.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 8, sy + 6, { steps: 4 });
  await page.mouse.move(sx + 2, sy + 90, { steps: 10 });
  await settleDrag(page);

  // no live preview: every board card keeps its slot, no wrapper transform
  const mid = await page.locator('.todo-card').evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { id: e.getAttribute('data-todo-id'), x: Math.round(r.x), y: Math.round(r.y) };
    }),
  );
  expect(mid).toEqual(before);
  const transformed = await page.evaluate(
    () =>
      document.querySelectorAll('.board-column-list > div[style*="transform"]').length,
  );
  expect(transformed).toBe(0);
  // the source column carries no tint tier either (reference: source stays neutral)
  await expect(page.locator('[data-column="todo"]')).not.toHaveAttribute('data-drop-valid');

  await page.mouse.up();
  await settleDrop(page);
  // no-op: no dialog, no commit, counts untouched
  await expect(page.locator('.overlay-title')).toHaveCount(0);
  await expect(page.locator('[data-column="todo"] .board-column-count')).toHaveText('1');
  await expect(page.locator('.board-drag-overlay')).toHaveCount(0);
});

test('待处理/已完成 cards carry no drag sensor', async ({ page }) => {
  await page.goto('/app?scenario=01');
  for (const column of ['pending', 'done'] as const) {
    const box = await page.locator(`[data-column="${column}"] .todo-card`).first().boundingBox();
    if (box == null) throw new Error(`${column} card missing`);
    const sx = box.x + box.width / 2;
    const sy = box.y + box.height / 2;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    // travel well past the 5px threshold — inside the column, then out over
    // the board gap so the release is not a click on the card's own link
    await page.mouse.move(sx + 6, sy + 40, { steps: 6 });
    await page.mouse.move(sx + 6, sy - 30, { steps: 6 });
    await expect(page.locator('.board-drag-overlay')).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveClass(/board-dragging/);
    await page.mouse.up();
    await settleDrop(page);
    await expect(page.locator('.board-drag-overlay')).toHaveCount(0);
  }
  // nothing moved anywhere
  await expect(page.locator('[data-column="pending"] .board-column-count')).toHaveText('1');
  await expect(page.locator('[data-column="done"] .board-column-count')).toHaveText('1');
});

// ---- lifted face: the compact drag-tier recipe (#616, replaces #391's
// four-edge ink probe — the reference shadow is a wide soft pool 8px BELOW
// the card, top-edge ink is faint by design; the contract is the computed
// recipe, not a pixel-ink floor) ----
for (const theme of ['light', 'dark'] as const) {
  test(`lifted card rides the compact drag-tier recipe (${theme})`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);
    await page.goto('/app?scenario=22');
    const source = page.locator('[data-column="todo"] .todo-card').first();
    const sourceBox = await source.boundingBox();
    if (sourceBox == null) throw new Error('probe card missing');

    const sx = sourceBox.x + sourceBox.width / 2;
    const sy = sourceBox.y + sourceBox.height / 2;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(sx + 8, sy + 6, { steps: 4 });
    await page.mouse.move(sx + 30, sy + 40, { steps: 8 });
    await settleDrag(page);

    const card = page.locator('.board-drag-overlay .board-drag-card');
    await expect(card).toBeVisible();
    const expected = await resolveStyle(page, {
      'box-shadow': 'var(--drag-shadow)',
      transform: 'rotate(2deg)',
      'border-radius': '8px',
    });
    const actual = await card.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        'box-shadow': cs.boxShadow,
        transform: cs.transform,
        opacity: cs.opacity,
        'border-radius': cs.borderRadius,
      };
    });
    expect(actual['box-shadow']).toBe(expected['box-shadow']);
    expect(actual.transform).toBe(expected.transform);
    expect(actual.opacity).toBe('0.92');
    expect(actual['border-radius']).toBe(expected['border-radius']);

    // compact face: identity row + title only — the board card's bottom row
    // (agent avatar / rel-time / metrics / action) stays out of the flight
    await expect(card.locator('.board-drag-card-row1')).toBeVisible();
    await expect(card.locator('.todo-card-bottom')).toHaveCount(0);
    await expect(card).toContainText('#9');
    // overlay wrapper keeps the source card's width (PositionedOverlay law)
    const wrapBox = await page.locator('.board-drag-overlay').boundingBox();
    if (wrapBox == null) throw new Error('overlay wrapper missing');
    expect(Math.abs(wrapBox.width - sourceBox.width)).toBeLessThanOrEqual(1);
    // the source wrapper dims to the reference's 0.4 and keeps its slot
    const dim = await page.evaluate(() => {
      const el = document.querySelector('[data-column="todo"] .board-column-list > div');
      return el == null ? null : getComputedStyle(el).opacity;
    });
    expect(dim).toBe('0.4');

    await page.mouse.up();
    await settleDrop(page);
  });
}

// ---- two-tier indigo tint on the whole column cell (#616; #351 geometry
// law kept: the paint surface is the column section, header included) ----
for (const theme of ['light', 'dark'] as const) {
  test(`valid targets tint base tier, hovered column tints hot (${theme})`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);
    await page.goto('/app?scenario=22');
    const list = await page.locator('[data-column="done"] .board-column-list').boundingBox();
    if (list == null) throw new Error('done list missing');
    const to = { x: list.x + list.width / 2, y: list.y + 60 };
    await dragTo(page, '[data-column="todo"] .todo-card', to);
    await settleDrag(page);
    await expect(page.locator('[data-column="done"]')).toHaveAttribute('data-drop', 'true');

    const expected = await resolveStyle(page, {
      'background-color': 'var(--drop-tint-hover)',
      'border-color': 'var(--drop-tint-border)',
    });
    const expectedBase = await resolveStyle(page, {
      'background-color': 'var(--drop-tint-base)',
    });
    const paints = await page.evaluate(() => {
      const read = (col: string) => {
        const section = document.querySelector(`[data-column="${col}"]`);
        const listEl = section?.querySelector('.board-column-list');
        return {
          valid: section?.getAttribute('data-drop-valid'),
          drop: section?.getAttribute('data-drop'),
          section: section == null ? null : getComputedStyle(section).backgroundColor,
          border: section == null ? null : getComputedStyle(section).borderTopColor,
          list: listEl == null ? null : getComputedStyle(listEl).backgroundColor,
        };
      };
      return { done: read('done'), building: read('building'), todo: read('todo'), pending: read('pending') };
    });

    // hovered valid target: hot tier on the whole cell, list carries no patch
    expect(paints.done.drop).toBe('true');
    expect(paints.done.section).toBe(expected['background-color']);
    expect(paints.done.border).toBe(expected['border-color']);
    expect(paints.done.list).toBe('rgba(0, 0, 0, 0)');
    // the other valid target rides the base tier
    expect(paints.building.valid).toBe('true');
    expect(paints.building.drop).toBeNull();
    expect(paints.building.section).toBe(expectedBase['background-color']);
    expect(paints.building.border).toBe(expected['border-color']);
    // source column and the gate column stay neutral (no tier at all)
    expect(paints.todo.valid).toBeNull();
    expect(paints.pending.valid).toBeNull();
    expect(paints.todo.section).not.toBe(expectedBase['background-color']);
    expect(paints.pending.section).not.toBe(expectedBase['background-color']);

    await page.mouse.up();
    await settleDrop(page);
    // teardown sweeps both tiers
    await expect(page.locator('[data-column="done"]')).not.toHaveAttribute('data-drop', 'true');
    await expect(page.locator('[data-column="building"]')).not.toHaveAttribute('data-drop-valid');
  });
}

// ---- committed drop must not flash home (bounce-effect regression, #398
// era law kept): the first post-drag paint already reads the landing ----
test('committed drop never flashes the card back to the source column', async ({ page }) => {
  await page.goto('/app?scenario=22');
  const list = await page.locator('[data-column="done"] .board-column-list').boundingBox();
  if (list == null) throw new Error('done list missing');
  const to = { x: list.x + list.width / 2, y: list.y + 60 };
  await dragTo(page, '[data-column="todo"] .todo-card', to);
  await settleDrag(page);

  await page.evaluate((id) => {
    const trace: { t: number; col: string | null }[] = [];
    (window as unknown as { __flashTrace: typeof trace }).__flashTrace = trace;
    const t0 = performance.now();
    const tick = () => {
      const grid = document.querySelector(`.board-scroller .todo-card[data-todo-id="${id}"]`);
      trace.push({
        t: Math.round(performance.now() - t0),
        col: grid?.closest('section[data-column]')?.getAttribute('data-column') ?? null,
      });
      if (performance.now() - t0 < 600) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, PROBE_ID);

  await page.mouse.up();
  await page.waitForTimeout(700);
  const trace = await page.evaluate(
    () => (window as unknown as { __flashTrace: { t: number; col: string | null }[] }).__flashTrace,
  );
  // no post-up frame may render the committed card back in the source column
  const homeFrames = trace.filter((s) => s.col === 'todo');
  expect(homeFrames, `frames with the card back in 待开始: ${JSON.stringify(homeFrames)}`).toEqual([]);
  // and it ends in the target column
  await expect(
    page.locator(`[data-column="done"] .todo-card[data-todo-id="${PROBE_ID}"]`),
  ).toBeVisible();
});

// ---- no drop glide (#616): the overlay unmounts on the pointerup frame —
// #391's 250ms flight was a pacman invention; the reference snaps ----
test('overlay unmounts with the pointerup frame — no glide', async ({ page }) => {
  await page.goto('/app?scenario=22');
  const list = await page.locator('[data-column="done"] .board-column-list').boundingBox();
  if (list == null) throw new Error('done list missing');
  const to = { x: list.x + list.width / 2, y: list.y + 60 };
  await dragTo(page, '[data-column="todo"] .todo-card', to);
  await settleDrag(page);
  await page.mouse.up();
  // two rAF boundaries ≈ 33ms — a 250ms glide would still be mounted here
  await settleDrop(page);
  await expect(page.locator('.board-drag-overlay')).toHaveCount(0);
  await expect(
    page.locator(`[data-column="done"] .todo-card[data-todo-id="${PROBE_ID}"]`),
  ).toBeVisible();
});
