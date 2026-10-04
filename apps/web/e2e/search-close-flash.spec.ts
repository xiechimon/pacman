import { expect, type Page, test } from '@playwright/test';

// Issue #844: 第二下 Ctrl+K 关闭时闪一下。根因是退出 keyframe
// （animate-out）在 Base UI 的卸载窗（--dur-fast = 150ms 的 visibility
// 过渡撑住，dialog.css）里先播完、回弹到 opacity 1，卸载才来——中间几帧
// 整面全不透明。本 spec 把「关闭不闪」钉成像素时序：退出透明度一旦开始
// 下降就不再回升（#771 同族 shape）。

const BOARD = '/app?scenario=01';

/** ⌘K 直到面板应答（search-focus.spec 同款：首按可能早于 hydration）。 */
async function openPanel(page: Page) {
  const panel = page.locator('.search-panel');
  await expect(page.locator('.sidebar-row, .rail-row').first()).toBeVisible();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await page.keyboard.press('Control+k');
    const opened = await panel
      .waitFor({ state: 'visible', timeout: 1000 })
      .then(() => true)
      .catch(() => false);
    if (opened) return;
  }
  throw new Error('Ctrl+K never opened the search panel');
}

/** 进场动效落定后再采样——否则 trace 里混进场余量。 */
async function settleEnter(page: Page) {
  await expect(page.locator('.search-panel')).toHaveCSS('transform', 'none');
  await page.waitForTimeout(300);
}

/** 从当前帧起采样 panel 透明度 durationMs，返回每帧 {t, op|null}。 */
function sampleClose(page: Page, durationMs: number) {
  return page.evaluate((ms: number) => {
    const out: { t: number; op: number | null }[] = [];
    const t0 = performance.now();
    return new Promise<typeof out>((resolve) => {
      function snap() {
        const el = document.querySelector('.search-panel');
        out.push({
          t: Math.round(performance.now() - t0),
          op: el ? Number(getComputedStyle(el).opacity) : null,
        });
        if (performance.now() - t0 < ms) requestAnimationFrame(snap);
        else resolve(out);
      }
      requestAnimationFrame(snap);
    });
  }, durationMs);
}

test('第二下 Ctrl+K 关闭不闪：退出透明度单调递减', async ({ page }) => {
  await page.goto(BOARD);
  await openPanel(page);
  await settleEnter(page);

  const traceP = sampleClose(page, 700);
  await page.keyboard.press('Control+k');
  const trace = await traceP;

  // 面板必须真的卸掉，否则 trace 无意义。
  await expect(page.locator('.search-panel')).toBeHidden({ timeout: 3000 });

  // 一旦开始下降就不再回升：回升 >0.12 即 #844 的闪帧（实测坏态 0.01→1）。
  let floor: number | null = null;
  for (const f of trace) {
    if (f.op == null) break; // detached，退出结束
    if (floor == null && f.op < 0.9) floor = f.op;
    else if (floor != null) {
      if (f.op < floor) floor = f.op;
      expect(f.op, `opacity rose back mid-exit at t=${f.t}ms`).toBeLessThanOrEqual(floor + 0.12);
    }
  }
  expect(floor, 'exit animation never started (opacity never dropped)').not.toBeNull();
});

test('三连击：关→开落在开态且输入聚焦', async ({ page }) => {
  await page.goto(BOARD);
  await openPanel(page);
  await settleEnter(page);

  // 第二下关（退出窗内），第三下立刻重开——mid-exit reopen 路径（#137 同窗）。
  await page.keyboard.press('Control+k');
  await page.keyboard.press('Control+k');
  await expect(page.locator('.search-panel')).toBeVisible({ timeout: 3000 });
  await expect(page.locator('.search-input-row input')).toBeFocused({ timeout: 3000 });
});
