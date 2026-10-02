import { expect, test } from '@playwright/test';

// Issue #672: the transcript's live cues — the loading-dev pilot. The #471
// braille reel (todos.dev replica, 10 frames × 90ms) is retired by user
// decision (2026-10-03, recorded in ADR 0009 D4's revision): the indicator
// now rides loading-dev's LinearDots — 3 currentColor dots (3px at size 16)
// in a 15×16 root, an opacity wave staggered left→right on the library's
// default 900ms cycle (the old reel's period). The library injects its own
// React-19 precedence stylesheet, sets aria-hidden on its root, and freezes
// the dots (animation: none, static 0.75 opacity) under
// prefers-reduced-motion — the replica's freeze law (motion.css r1 §4.3)
// survives through the library contract. The static label stays the
// accessible live cue; the elapsed seconds still ride tabular figures so the
// 3s→10s width jump never shifts the row tail. The quiescent building gap
// (scenario `spinner-quiescent`, #471) keeps one live row through the same
// component, no seconds counter. Render-side failure modes pinned here:
//   L1 root / library stylesheet not mounted (dots missing or not waving)
//   L2 geometry drift: root height ≠ 16px, dot count ≠ 3, dot box ≠ 3px
//   L3 row geometry regression: the 20px row height drifts
//   L4 animation contract broken: not infinite / period ≠ 0.9s / not
//      running / left→right stagger lost
//   L5 reduced motion doesn't freeze the dots
//   L6 spinner root not aria-hidden — the static label is the accessible cue
//   L7 seconds span missing tabular-nums (width jitter regression)
//   L8 seconds-less row rendering "undefineds" / a bare "s"
//   L9 currentColor chain broken: dot fill ≠ root color (--text-dim)
// Mapper-side modes (phantom/duplicate tails) live in
// test/transcript-quiescent.test.ts.

const DETAIL = '/app/todo/7ve0iOkQ-JBpSL98zSiGc';

test.describe('streaming row loading indicator (scenario 26)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${DETAIL}?scenario=26`);
  });

  test('LinearDots mounts: stylesheet injected, 3 dots, staggered 900ms wave', async ({
    page,
  }) => {
    const root = page.locator('.chat-spinner');
    await expect(root).toHaveClass(/ld-linear-dots/); // L1
    // React 19 hoists the library's <style href precedence> into the head
    // and renders the props as data-href / data-precedence
    const injected = await page.evaluate(
      () => document.querySelector('style[data-href="ld-linear-dots"]') !== null,
    );
    expect(injected).toBe(true); // L1: precedence sheet is in the document
    const dots = root.locator('.ld-linear-dots-dot');
    await expect(dots).toHaveCount(3); // L2
    const wave = await root.evaluate((el) =>
      el.getAnimations({ subtree: true }).map((a) => ({
        name: a instanceof CSSAnimation ? a.animationName : null,
        playState: a.playState,
        timing: a.effect?.getComputedTiming(),
      })),
    );
    expect(wave).toHaveLength(3); // L1: every dot carries the fade
    for (const w of wave) {
      expect(w.name).toBe('ld-linear-dots-fade'); // L4
      expect(w.playState).toBe('running'); // L4
      expect(w.timing?.duration).toBe(900); // L4: library default = old reel period
      expect(w.timing?.iterations).toBe(Infinity); // L4
    }
    const delays = await dots.evaluateAll((els) =>
      els.map((d) => getComputedStyle(d).animationDelay),
    );
    expect(delays).toEqual(['-0.9s', '-0.6s', '-0.3s']); // L4: left→right stagger
  });

  test('root keeps the 16px slot, dots are 3px circles, row keeps 20px', async ({ page }) => {
    const root = await page.locator('.chat-spinner').evaluate((el) => {
      const cs = getComputedStyle(el);
      return { height: cs.height, display: cs.display, alignItems: cs.alignItems };
    });
    expect(root.height).toBe('16px'); // L2: the old reel's slot height
    expect(root.display).toBe('flex'); // L2: library root layout
    const dotBoxes = await page.locator('.ld-linear-dots-dot').evaluateAll((els) =>
      els.map((d) => {
        const r = d.getBoundingClientRect();
        return { w: r.width, h: r.height, radius: Number.parseFloat(getComputedStyle(d).borderRadius) };
      }),
    );
    for (const b of dotBoxes) {
      expect(b.w).toBe(3); // L2: 0.1875 × 16
      expect(b.h).toBe(3);
      expect(b.radius).toBeGreaterThanOrEqual(1.5); // circles (radius clamps at half the box)
    }
    const rowHeight = await page
      .locator('.chat-streaming')
      .evaluate((el) => getComputedStyle(el).height);
    expect(rowHeight).toBe('20px'); // L3: row geometry unchanged
  });

  test('root is aria-hidden and the dots ride currentColor; label stays the cue', async ({
    page,
  }) => {
    await expect(page.locator('.chat-spinner')).toHaveAttribute('aria-hidden', 'true'); // L6
    await expect(page.locator('.chat-streaming-label')).toHaveText('处理中...');
    const colors = await page.locator('.chat-spinner').evaluate((el) => {
      const root = getComputedStyle(el).color;
      const dots = [...el.querySelectorAll('.ld-linear-dots-dot')].map(
        (d) => getComputedStyle(d).backgroundColor,
      );
      return { root, dots };
    });
    expect(colors.dots).toHaveLength(3);
    for (const bg of colors.dots) expect(bg).toBe(colors.root); // L9: --text-dim chain
  });

  test('elapsed seconds ride tabular figures', async ({ page }) => {
    const secs = page.locator('.chat-streaming-secs');
    await expect(secs).toHaveText('3s');
    const fvn = await secs.evaluate((el) => getComputedStyle(el).fontVariantNumeric);
    expect(fvn).toContain('tabular-nums'); // L7
  });

  test('prefers-reduced-motion freezes the dots at the static library opacity', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${DETAIL}?scenario=26`);
    const state = await page.locator('.chat-spinner').evaluate((el) => {
      const dots = [...el.querySelectorAll('.ld-linear-dots-dot')];
      return {
        running: el.getAnimations({ subtree: true }).length,
        names: dots.map((d) => getComputedStyle(d).animationName),
        opacities: dots.map((d) => getComputedStyle(d).opacity),
      };
    });
    expect(state.running).toBe(0); // L5: nothing animates under the freeze law
    expect(state.names).toHaveLength(3); // L5: the dots exist — no vacuous pass
    for (const name of state.names) expect(name).toBe('none'); // L5
    for (const o of state.opacities) expect(o).toBe('0.75'); // L5: library static dim
  });
});

test.describe('quiescent building gap (scenario spinner-quiescent)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${DETAIL}?scenario=spinner-quiescent`);
  });

  test('one live row: waving indicator + static 执行中... label, no seconds', async ({
    page,
  }) => {
    const row = page.locator('.chat-streaming');
    await expect(row).toHaveCount(1);
    await expect(page.locator('.chat-spinner')).toHaveCount(1);
    await expect(page.locator('.ld-linear-dots-dot')).toHaveCount(3); // L2
    await expect(page.locator('.chat-streaming-label')).toHaveText('执行中...');
    await expect(page.locator('.chat-streaming-secs')).toHaveCount(0);
    await expect(row).not.toContainText('undefined'); // L8
    await expect(row).not.toContainText(/(^|[^.\w])s([^.\w]|$)/); // no bare "s" tail
    // the header chip and the transcript row agree — the row is the
    // conversation-side echo of the same phase
    await expect(page.locator('.detail-chip')).toHaveText(/执行中/);
  });
});
