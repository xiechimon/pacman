import { expect, test } from '@playwright/test';

// Issue #471: the transcript's live cues. The braille spinner turns — a
// 10-frame reel (⠙⠹⠸⠼⠴⠦⠧⠇⠏⠋, the classic dot wheel opening on the frame
// the r7 26/26d captures froze) walking one 16px slot per 90ms step on a
// 900ms steps(10) cycle — and freezes on ⠙ under prefers-reduced-motion.
// The elapsed seconds ride tabular figures so the 3s→10s width jump stops
// shifting the row tail. The quiescent building gap (agent not streaming,
// task not ended — scenario `spinner-quiescent`, no capture, #471 [设计])
// keeps one turning spinner + the static 执行中... label through the same
// component, no seconds counter. Render-side failure modes pinned here:
//   F1 reel animation not attached (dead-frame regression)
//   F2 cadence wrong: duration ≠ 0.9s / ≠ steps(10) / ≠ 10 frames / first
//      frame ≠ ⠙ (frozen-frame canon drift)
//   F3+F4 reduced motion doesn't freeze the reel
//   F5 reel viewport geometry broken (frame slot ≠ 16px, unclipped, or the
//      20px row height drifts)
//   F6 spinner not aria-hidden — the static label is the accessible cue
//   F7 seconds span missing tabular-nums (width jitter regression)
//   F13 seconds-less row rendering "undefineds" / a bare "s"
// Mapper-side modes (phantom/duplicate tails) live in
// test/transcript-quiescent.test.ts.

const DETAIL = '/app/todo/7ve0iOkQ-JBpSL98zSiGc';

test.describe('streaming row spinner reel (scenario 26)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${DETAIL}?scenario=26`);
  });

  test('reel turns: 10 braille frames, 900ms steps(10) cycle, ⠙ first', async ({ page }) => {
    const reel = page.locator('.chat-spinner-reel');
    await expect(reel.locator('span')).toHaveCount(10);
    await expect(reel.locator('span').first()).toHaveText('⠙');
    const anim = await reel.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        name: cs.animationName,
        duration: cs.animationDuration,
        iteration: cs.animationIterationCount,
        timing: cs.animationTimingFunction,
      };
    });
    expect(anim.name).toBe('spinner-reel'); // F1
    expect(anim.duration).toBe('0.9s'); // F2: 10 frames × 90ms
    expect(anim.iteration).toBe('infinite');
    expect(anim.timing).toMatch(/steps\(10/);
  });

  test('viewport clips to exactly one 16px frame slot, row keeps 20px', async ({ page }) => {
    const geo = await page.locator('.chat-spinner').evaluate((el) => {
      const cs = getComputedStyle(el);
      return { height: cs.height, overflow: cs.overflowY };
    });
    expect(geo.height).toBe('16px'); // F5
    expect(geo.overflow).toBe('hidden');
    const rowHeight = await page
      .locator('.chat-streaming')
      .evaluate((el) => getComputedStyle(el).height);
    expect(rowHeight).toBe('20px'); // capture geometry unchanged
  });

  test('spinner is aria-hidden; the static label stays the accessible cue', async ({ page }) => {
    await expect(page.locator('.chat-spinner')).toHaveAttribute('aria-hidden', 'true'); // F6
    await expect(page.locator('.chat-streaming-label')).toHaveText('处理中...');
  });

  test('elapsed seconds ride tabular figures', async ({ page }) => {
    const secs = page.locator('.chat-streaming-secs');
    await expect(secs).toHaveText('3s');
    const fvn = await secs.evaluate((el) => getComputedStyle(el).fontVariantNumeric);
    expect(fvn).toContain('tabular-nums'); // F7
  });

  test('prefers-reduced-motion freezes the reel on the ⠙ slot', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${DETAIL}?scenario=26`);
    const state = await page.locator('.chat-spinner-reel').evaluate((el) => {
      const cs = getComputedStyle(el);
      return { name: cs.animationName, transform: cs.transform };
    });
    expect(state.name).toBe('none'); // F3
    expect(state.transform).toBe('none'); // F4: frame 0 = ⠙ sits in the slot
  });
});

test.describe('quiescent building gap (scenario spinner-quiescent)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${DETAIL}?scenario=spinner-quiescent`);
  });

  test('one live row: turning spinner + static 执行中... label, no seconds', async ({ page }) => {
    const row = page.locator('.chat-streaming');
    await expect(row).toHaveCount(1);
    await expect(page.locator('.chat-spinner-reel')).toHaveCount(1);
    await expect(page.locator('.chat-streaming-label')).toHaveText('执行中...');
    await expect(page.locator('.chat-streaming-secs')).toHaveCount(0);
    await expect(row).not.toContainText('undefined'); // F13
    await expect(row).not.toContainText(/(^|[^.\w])s([^.\w]|$)/); // no bare "s" tail
    // the header chip and the transcript row agree — the row is the
    // conversation-side echo of the same phase
    await expect(page.locator('.detail-chip')).toHaveText(/执行中/);
  });
});
