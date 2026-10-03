import { expect, type Page, test } from '@playwright/test';

// Issue #616 → #753 acceptance: the board drag is the reference product's
// drag (todos.dev, 2026-10-03/04 live 重测——推翻 2026-10-02 旧测的两条:
// 「待处理/已完成卡不可拖」与「待处理永不作落点」）— a pure cross-column
// phase vehicle:
//   · 可拖面 = 每一列（#753 实测：四列的卡按压超过阈值都进 grabbing 拖拽）；
//   · the lift is a COMPACT clone (.board-drag-card: identity row + 2-line
//     title, 8px radius, 2° tilt, 0.92 opacity, --drag-shadow) — not the
//     board card copy; the source wrapper dims to 0.4 and keeps its slot;
//   · siblings NEVER shift mid-gesture and a same-column drop commits
//     nothing (the reference has no in-column reorder — #73/#403's sortable
//     preview retired with it);
//   · 合法目标 = per-source 矩阵（columns.ts canDropOnColumn 单源，#753）：
//     执行中 只吃 待开始；待处理 只吃 已完成(有变更)——重开落位写 review；
//     已完成 吃 待开始/执行中/待处理(failed 卡除外，#702)；待开始 吃全部
//     源列。非法对恒素面 + 落位零提交（实测：无拒绝动画，静默无操作）；
//     源列全程素面；两级染色（base 5% / hovered 10%）不变；
//   · 执行中 is the start gate: the drop fires the chief orchestration round
//     directly (#640 — the #318 choice dialog is gone; the phase is NOT
//     written locally, the card moves only once the chief dispatches;
//     2026-10-04 实测参考站该落位开 开始任务 dialog——差异归后续票，本仓
//     载体不动);
//   · 待开始/待处理/已完成 drops commit the phase silently, card lands at
//     the END of the target column's view, counts couple (r2 §4.2);
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

/** Press `fromSel` and park the pointer inside its own column's list tail —
 *  a same-column flight for tint reads and zero-commit releases (#753). */
async function dragInSourceColumn(page: Page, fromSel: string): Promise<void> {
  const fromBox = await page.locator(fromSel).first().boundingBox();
  if (fromBox == null) throw new Error(`drag source missing: ${fromSel}`);
  const column = await page
    .locator(fromSel)
    .first()
    .evaluate((el) => el.closest('section[data-column]')?.getAttribute('data-column'));
  const list = await page.locator(`[data-column="${column}"] .board-column-list`).boundingBox();
  if (list == null) throw new Error(`source list missing: ${column}`);
  const sx = fromBox.x + fromBox.width / 2;
  const sy = fromBox.y + fromBox.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 8, sy + 6, { steps: 4 });
  await page.mouse.move(list.x + list.width / 2, list.y + list.height - 24, { steps: 10 });
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

/** The four columns' tint-tier attributes in one read. */
async function readTiers(page: Page): Promise<Record<string, { valid: string | null; drop: string | null }>> {
  return page.evaluate(() => {
    const out: Record<string, { valid: string | null; drop: string | null }> = {};
    for (const section of document.querySelectorAll('section[data-column]')) {
      const id = section.getAttribute('data-column') as string;
      out[id] = {
        valid: section.getAttribute('data-drop-valid'),
        drop: section.getAttribute('data-drop'),
      };
    }
    return out;
  });
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

test('待开始 → 执行中: the drop fires orchestration directly — no dialog, no local phase write (#640)', async ({
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

  // #640: the start gate no longer opens the #318 choice dialog — the drop
  // fires the chief orchestration round (live-only; fixture mode is inert, so
  // nothing renders). The gesture teardown still sweeps the drag overlay.
  await expect(page.locator('.overlay-title')).toHaveCount(0);
  await expect(page.locator('.board-drag-overlay')).toHaveCount(0);
  // the phase is NOT written locally: the probe still sits in 待开始, counts
  // untouched (in live it moves only once the chief dispatches via run_builds).
  await expect(
    page.locator(`[data-column="todo"] .todo-card[data-todo-id="${PROBE_ID}"]`),
  ).toBeVisible();
  await expect(page.locator('[data-column="todo"] .board-column-count')).toHaveText('1');
  await expect(page.locator('[data-column="building"] .board-column-count')).toHaveText('0');
});

// ---- the per-source target matrix (#753, todos.dev 2026-10-03/04 live 重测;
// rewrites 「待处理 never a target (#351)」— 待开始→待处理 stays invalid, but
// validity is now per source card, not a column-level constant) ----

const MATRIX_CASES = [
  { source: 'dm-todo', column: 'todo', valid: ['building', 'done'] },
  { source: 'dm-building', column: 'building', valid: ['todo', 'done'] },
  { source: 'dm-failed', column: 'pending', valid: ['todo'] },
  { source: 'dm-review', column: 'pending', valid: ['todo', 'done'] },
  { source: 'dm-confirm', column: 'pending', valid: ['todo', 'done'] },
  { source: 'dm-done-changes', column: 'done', valid: ['todo', 'pending'] },
  { source: 'dm-done-plain', column: 'done', valid: ['todo'] },
] as const;

test('per-source target matrix: the tint set follows the dragged card (#753)', async ({ page }) => {
  await page.goto('/app?scenario=board-drag-matrix');
  for (const c of MATRIX_CASES) {
    await dragInSourceColumn(page, `.todo-card[data-todo-id="${c.source}"]`);
    await settleDrag(page);
    const tiers = await readTiers(page);
    for (const col of ['todo', 'building', 'pending', 'done']) {
      const expectValid = (c.valid as readonly string[]).includes(col);
      expect(
        tiers[col]?.valid,
        `source ${c.source}: data-drop-valid on ${col}`,
      ).toBe(expectValid ? 'true' : null);
    }
    // same-column release: zero commit, teardown sweeps
    await page.mouse.up();
    await settleDrop(page);
    await expect(page.locator('.board-drag-overlay')).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveClass(/board-dragging/);
  }
  // nothing moved anywhere: counts are the untouched scenario shape
  await expect(page.locator('[data-column="todo"] .board-column-count')).toHaveText('1');
  await expect(page.locator('[data-column="building"] .board-column-count')).toHaveText('1');
  await expect(page.locator('[data-column="pending"] .board-column-count')).toHaveText('3');
  await expect(page.locator('[data-column="done"] .board-column-count')).toHaveText('2');
});

test('hover tier rides the hovered valid target for the new pairs (#753)', async ({ page }) => {
  await page.goto('/app?scenario=board-drag-matrix');
  // done(有变更) → 待处理: the reopen pair lights the hover tier on pending
  const list = await page.locator('[data-column="pending"] .board-column-list').boundingBox();
  if (list == null) throw new Error('pending list missing');
  await dragTo(page, '.todo-card[data-todo-id="dm-done-changes"]', {
    x: list.x + list.width / 2,
    y: list.y + list.height - 24,
  });
  await settleDrag(page);
  await expect(page.locator('[data-column="pending"]')).toHaveAttribute('data-drop', 'true');
  await expect(page.locator('[data-column="pending"]')).toHaveAttribute('data-drop-valid', 'true');
  // 待开始 rides the base tier (valid, not hovered); 执行中 stays neutral
  await expect(page.locator('[data-column="todo"]')).toHaveAttribute('data-drop-valid', 'true');
  await expect(page.locator('[data-column="todo"]')).not.toHaveAttribute('data-drop', 'true');
  await expect(page.locator('[data-column="building"]')).not.toHaveAttribute('data-drop-valid');
  await page.mouse.up();
  await settleDrop(page);
});

test('invalid pairs: no tint on the hovered target, release commits nothing (#753)', async ({
  page,
}) => {
  await page.goto('/app?scenario=board-drag-matrix');
  const invalid = [
    { source: 'dm-confirm', target: 'building' },
    { source: 'dm-failed', target: 'done' },
    { source: 'dm-done-plain', target: 'pending' },
    { source: 'dm-todo', target: 'pending' },
  ] as const;
  for (const pair of invalid) {
    const list = await page.locator(`[data-column="${pair.target}"] .board-column-list`).boundingBox();
    if (list == null) throw new Error(`target list missing: ${pair.target}`);
    await dragTo(page, `.todo-card[data-todo-id="${pair.source}"]`, {
      x: list.x + list.width / 2,
      y: list.y + list.height - 24,
    });
    await settleDrag(page);
    // the hovered invalid target lights NEITHER tier (实测: 非法对恒素面,
    // 落位 = 静默无操作, 无拒绝动画)
    await expect(
      page.locator(`[data-column="${pair.target}"]`),
      `${pair.source} → ${pair.target}: no hover tier`,
    ).not.toHaveAttribute('data-drop', 'true');
    await expect(
      page.locator(`[data-column="${pair.target}"]`),
      `${pair.source} → ${pair.target}: no base tier`,
    ).not.toHaveAttribute('data-drop-valid');
    await page.mouse.up();
    await settleDrop(page);
    // the card never left its source column
    await expect(
      page.locator(`.todo-card[data-todo-id="${pair.source}"]`),
      `${pair.source} stayed put`,
    ).toBeVisible();
  }
  // counts are the untouched scenario shape
  await expect(page.locator('[data-column="todo"] .board-column-count')).toHaveText('1');
  await expect(page.locator('[data-column="building"] .board-column-count')).toHaveText('1');
  await expect(page.locator('[data-column="pending"] .board-column-count')).toHaveText('3');
  await expect(page.locator('[data-column="done"] .board-column-count')).toHaveText('2');
});

test('待开始 → 待处理 stays invalid (#351 pair kept inside the #753 matrix)', async ({ page }) => {
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
  // no drop affordance on this pair — neither tint tier lights
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

// ---- commits for the newly enabled pairs (#753) ----

test('已完成(有变更) → 待处理: reopen commits review, lands after the pinned group', async ({
  page,
}) => {
  await page.goto('/app?scenario=22');
  const list = await page.locator('[data-column="pending"] .board-column-list').boundingBox();
  if (list == null) throw new Error('pending list missing');
  const to = { x: list.x + list.width / 2, y: list.y + list.height - 24 };

  await dragTo(page, '.todo-card[data-todo-id="r3-legacy-2"]', to);
  await settleDrag(page);
  await expect(page.locator('[data-column="pending"]')).toHaveAttribute('data-drop', 'true');
  await page.mouse.up();
  await settleDrop(page);

  // committed: the done card reopens INTO 待处理 as review（落点正名，#753
  // [设计]）—— the review-gate action reads 完成 (PHASE_UI[review]；徽标是纯
  // 图标无文字、done 卡本来就没有动作钮，整卡断 chip 词恒错), counts couple
  const moved = page.locator('[data-column="pending"] .todo-card[data-todo-id="r3-legacy-2"]');
  await expect(moved).toBeVisible();
  await expect(moved.locator('.todo-card-action')).toHaveText('完成');
  await expect(page.locator('[data-column="done"] .board-column-count')).toHaveText('0');
  await expect(page.locator('[data-column="pending"] .board-column-count')).toHaveText('2');
  // landing: the pinned review+awaitingReply card keeps the top; the reopened
  // card (review, no awaitingReply) lands AFTER it — end of the non-pinned run
  const order = await page
    .locator('[data-column="pending"] .todo-card')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-todo-id')));
  expect(order).toEqual(['r3-legacy-1', 'r3-legacy-2']);
});

test('待处理(confirm) → 已完成 / → 待开始: silent phase commits (#753)', async ({ page }) => {
  await page.goto('/app?scenario=board-drag-matrix');
  // confirm → done: the manual acceptance shortcut (载体 = 改相提交；合并步
  // 不是本面语义)
  let list = await page.locator('[data-column="done"] .board-column-list').boundingBox();
  if (list == null) throw new Error('done list missing');
  await dragTo(page, '.todo-card[data-todo-id="dm-confirm"]', {
    x: list.x + list.width / 2,
    y: list.y + list.height - 24,
  });
  await settleDrag(page);
  await page.mouse.up();
  await settleDrop(page);
  const inDone = page.locator('[data-column="done"] .todo-card[data-todo-id="dm-confirm"]');
  await expect(inDone).toBeVisible();
  // done 卡无动作钮、无文字徽标（columns.ts cardAction: done → null）——列归属
  // + counts + 末位顺序即提交证据，不另断卡面词
  // end-of-column landing: after both incumbent done cards
  const doneOrder = await page
    .locator('[data-column="done"] .todo-card')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-todo-id')));
  expect(doneOrder[doneOrder.length - 1]).toBe('dm-confirm');
  await expect(page.locator('[data-column="done"] .board-column-count')).toHaveText('3');
  await expect(page.locator('[data-column="pending"] .board-column-count')).toHaveText('2');

  // failed 卡不动（#702 客户端同判）：待处理 只剩 pinned 组 + 无变化
  await expect(
    page.locator('[data-column="pending"] .todo-card[data-todo-id="dm-failed"]'),
  ).toBeVisible();
});

test('待处理(confirm) → 待开始: silent phase commit (#753)', async ({ page }) => {
  await page.goto('/app?scenario=board-drag-matrix');
  const list = await page.locator('[data-column="todo"] .board-column-list').boundingBox();
  if (list == null) throw new Error('todo list missing');
  await dragTo(page, '.todo-card[data-todo-id="dm-confirm"]', {
    x: list.x + list.width / 2,
    y: list.y + list.height - 24,
  });
  await settleDrag(page);
  await page.mouse.up();
  await settleDrop(page);
  const moved = page.locator('[data-column="todo"] .todo-card[data-todo-id="dm-confirm"]');
  await expect(moved).toBeVisible();
  await expect(page.locator('[data-column="todo"] .board-column-count')).toHaveText('2');
  await expect(page.locator('[data-column="pending"] .board-column-count')).toHaveText('2');
});

test('执行中 → 待开始: silent phase commit — gesture only, reset semantics stay out (#753/#640)', async ({
  page,
}) => {
  await page.goto('/app?scenario=board-drag-matrix');
  const list = await page.locator('[data-column="todo"] .board-column-list').boundingBox();
  if (list == null) throw new Error('todo list missing');
  await dragTo(page, '.todo-card[data-todo-id="dm-building"]', {
    x: list.x + list.width / 2,
    y: list.y + list.height - 24,
  });
  await settleDrag(page);
  await page.mouse.up();
  await settleDrop(page);
  // 本票只放行手势：提交仍是既有改相载体（写 todo），参考站的「拖回待开始
  // 重置任务（中断构建 + 清空对话/方案/改动）」语义归后续票，不得从这里漏进来
  await expect(
    page.locator('[data-column="todo"] .todo-card[data-todo-id="dm-building"]'),
  ).toBeVisible();
  await expect(page.locator('[data-column="building"] .board-column-count')).toHaveText('0');
  await expect(page.locator('[data-column="todo"] .board-column-count')).toHaveText('2');
});

// ---- draggable from every column (#753; rewrites 「待处理/已完成 cards
// carry no drag sensor」— the 2026-10-02 claim is falsified: every card
// arms the gesture) ----

test('cards from every column arm the drag gesture (#753)', async ({ page }) => {
  await page.goto('/app?scenario=board-drag-matrix');
  for (const id of ['dm-todo', 'dm-building', 'dm-failed', 'dm-done-plain']) {
    await dragInSourceColumn(page, `.todo-card[data-todo-id="${id}"]`);
    await settleDrag(page);
    // the gesture armed: overlay up, body class on, source wrapper dims
    await expect(
      page.locator('.board-drag-overlay .board-drag-card'),
      `${id}: overlay`,
    ).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/board-dragging/);
    const dim = await page
      .locator(`.todo-card[data-todo-id="${id}"]`)
      .evaluate((el) => getComputedStyle(el.parentElement as HTMLElement).opacity);
    expect(dim, `${id}: source dim`).toBe('0.4');
    await page.mouse.up();
    await settleDrop(page);
    await expect(page.locator('.board-drag-overlay')).toHaveCount(0);
  }
  // same-column flights committed nothing
  await expect(page.locator('[data-column="todo"] .board-column-count')).toHaveText('1');
  await expect(page.locator('[data-column="building"] .board-column-count')).toHaveText('1');
  await expect(page.locator('[data-column="pending"] .board-column-count')).toHaveText('3');
  await expect(page.locator('[data-column="done"] .board-column-count')).toHaveText('2');
});

test('click navigation survives sensor arming on the newly draggable columns (#753/#629)', async ({
  page,
}) => {
  await page.goto('/app?scenario=board-drag-matrix');
  for (const id of ['dm-confirm', 'dm-done-changes']) {
    const card = page.locator(`.todo-card[data-todo-id="${id}"]`);
    await card.click();
    await page.waitForURL((u) => u.pathname === `/app/todo/${id}`);
    expect(new URL(page.url()).pathname).toBe(`/app/todo/${id}`);
    await page.goto('/app?scenario=board-drag-matrix');
    await expect(page.locator(`.todo-card[data-todo-id="${id}"]`)).toBeVisible();
  }
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
    // source column stays neutral, and 待处理 is neutral for a 待开始 source
    // (#753 per-source matrix: 待开始→待处理 invalid — the column itself is
    // a valid target for done(有变更) sources, pinned by the matrix spec)
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
