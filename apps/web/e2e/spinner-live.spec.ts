import { expect, test } from '@playwright/test';

// Issue #672: the transcript's live cues — the loading-dev pilot. The #471
// braille reel (todos.dev replica, 10 frames × 90ms) is retired by user
// decision (2026-10-03, recorded in ADR 0009 D4's revision); after viewing
// the live preview the user picked the Atom indicator. It renders a 16×16
// square at size 16: one shell circle (0.88px stroke) plus three orbits
// tilted 0/60/120°, each spinning an inner ring (0.72px stroke) through
// `ld-atom-rotate`. The duration prop pins the cycle to 900ms — the old
// reel's period (the library default for atom is 1000ms) — staggered
// −0.9s/−0.6s/−0.3s across the three spins. The library injects its own
// React-19 precedence stylesheet (rendered as data-href/data-precedence),
// sets aria-hidden on its root, and freezes under prefers-reduced-motion
// (animation: none on every part + a static rotate(60deg) settle on the
// spins) — the replica's freeze law (motion.css r1 §4.3) survives through
// the library contract. The static label stays the accessible live cue;
// the elapsed seconds still ride tabular figures so the 3s→10s width jump
// never shifts the row tail. The quiescent building gap (scenario
// `spinner-quiescent`, #471) keeps one live row through the same component,
// no seconds counter. Render-side failure modes pinned here:
//   L1 root / library stylesheet not mounted (parts missing or not spinning)
//   L2 geometry drift: root not a 16px square, shell not a 16px circle,
//      part counts wrong (1 shell / 3 orbits / 3 spins / 3 rings)
//   L3 row geometry regression: the 20px row height drifts
//   L4 animation contract broken: not infinite / period ≠ 0.9s (duration
//      prop) / not running / stagger or tilt spread lost / breathe pulse
//      missing or off-period (root must carry exactly one spinner-breathe,
//      1800ms = twice the spin period so the pulse never beats the orbits)
//   L5 reduced motion doesn't freeze the spins (or drops the static settle)
//   L6 spinner root not aria-hidden — the static label is the accessible cue
//   L7 seconds span missing tabular-nums (width jitter regression)
//   L8 seconds-less row rendering "undefineds" / a bare "s"
//   L9 currentColor chain broken: shell/ring stroke ≠ root color (root rides
//      the spot solid, #821 — the chain, not the value, is pinned here)
// Mapper-side modes (phantom/duplicate tails) live in
// test/transcript-quiescent.test.ts.

const DETAIL = '/app/todo/7ve0iOkQ-JBpSL98zSiGc';

test.describe('streaming row loading indicator (scenario 26)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${DETAIL}?scenario=26`);
  });

  test('Atom mounts: stylesheet injected, shell + 3 tilted orbits, staggered 900ms spin', async ({
    page,
  }) => {
    const root = page.locator('.chat-spinner');
    await expect(root).toHaveClass(/ld-atom/); // L1
    // React 19 hoists the library's <style href precedence> into the head
    // and renders the props as data-href / data-precedence
    const injected = await page.evaluate(
      () => document.querySelector('style[data-href="ld-atom"]') !== null,
    );
    expect(injected).toBe(true); // L1: precedence sheet is in the document
    await expect(root.locator('.ld-atom-shell')).toHaveCount(1); // L2
    await expect(root.locator('.ld-atom-orbit')).toHaveCount(3); // L2
    const spins = root.locator('.ld-atom-spin');
    await expect(spins).toHaveCount(3); // L2
    await expect(root.locator('.ld-atom-ring')).toHaveCount(3); // L2
    const tiltSpread = await root
      .locator('.ld-atom-orbit')
      .evaluateAll((els) =>
        els.map((el) => getComputedStyle(el).getPropertyValue('--ld-atom-tilt').trim()),
      );
    expect(tiltSpread).toEqual(['0deg', '60deg', '120deg']); // L4: orbit spread
    const rotation = await root.evaluate((el) =>
      el.getAnimations({ subtree: true }).map((a) => ({
        name: a instanceof CSSAnimation ? a.animationName : null,
        playState: a.playState,
        timing: a.effect?.getComputedTiming(),
      })),
    );
    const spinsAnims = rotation.filter((r) => r.name === 'ld-atom-rotate');
    expect(spinsAnims).toHaveLength(3); // L1: every spin carries the rotation
    for (const r of spinsAnims) {
      expect(r.playState).toBe('running'); // L4
      expect(r.timing?.duration).toBe(900); // L4: duration prop = old reel period
      expect(r.timing?.iterations).toBe(Infinity); // L4
    }
    // L4: the breathe pulse rides the library root (one level above the
    // spins, so the two never override each other) at twice the spin period
    const breathe = rotation.filter((r) => r.name === 'spinner-breathe');
    expect(breathe).toHaveLength(1);
    expect(breathe[0].playState).toBe('running');
    expect(breathe[0].timing?.duration).toBe(1800);
    expect(breathe[0].timing?.iterations).toBe(Infinity);
    const delays = await spins.evaluateAll((els) =>
      els.map((s) => getComputedStyle(s).animationDelay),
    );
    expect(delays).toEqual(['-0.9s', '-0.6s', '-0.3s']); // L4: stagger
  });

  test('root is a 16px square, shell a 16px circle, row keeps 20px', async ({ page }) => {
    const root = await page.locator('.chat-spinner').evaluate((el) => {
      const cs = getComputedStyle(el);
      return { width: cs.width, height: cs.height, position: cs.position };
    });
    expect(root.width).toBe('16px'); // L2: size prop on both axes
    expect(root.height).toBe('16px'); // L2: the old reel's slot height
    expect(root.position).toBe('relative'); // L2: library root anchors the orbits
    // L2 geometry is the layout box: offsetWidth/Height ignore the
    // breathe pulse (a paint-time scale on the root, #821), while
    // getBoundingClientRect would sample wherever the pulse happens to be.
    const shell = await page.locator('.ld-atom-shell').evaluate((el) => {
      const cs = getComputedStyle(el);
      return { w: el.offsetWidth, h: el.offsetHeight, radius: cs.borderRadius, stroke: cs.borderTopWidth };
    });
    expect(shell.w).toBe(16); // L2
    expect(shell.h).toBe(16);
    expect(shell.radius).toBe('9999px'); // circle
    // L2: the sheet specifies 0.055 × 16 = 0.88px; at the e2e config's
    // deviceScaleFactor 1 Chrome snaps border widths to the 1px used value
    expect(shell.stroke).toBe('1px');
    const rowHeight = await page
      .locator('.chat-streaming')
      .evaluate((el) => getComputedStyle(el).height);
    expect(rowHeight).toBe('20px'); // L3: row geometry unchanged
  });

  test('root is aria-hidden and shell/ring strokes ride currentColor; label stays the cue', async ({
    page,
  }) => {
    await expect(page.locator('.chat-spinner')).toHaveAttribute('aria-hidden', 'true'); // L6
    await expect(page.locator('.chat-streaming-label')).toHaveText('处理中...');
    const colors = await page.locator('.chat-spinner').evaluate((el) => {
      const root = getComputedStyle(el).color;
      const shell = getComputedStyle(el.querySelector('.ld-atom-shell')!).borderTopColor;
      const rings = [...el.querySelectorAll('.ld-atom-ring')].map(
        (r) => getComputedStyle(r).borderTopColor,
      );
      return { root, shell, rings };
    });
    expect(colors.shell).toBe(colors.root); // L9: spot currentColor chain
    expect(colors.rings).toHaveLength(3);
    for (const stroke of colors.rings) expect(stroke).toBe(colors.root); // L9
  });

  test('elapsed seconds ride tabular figures', async ({ page }) => {
    const secs = page.locator('.chat-streaming-secs');
    await expect(secs).toHaveText('3s');
    const fvn = await secs.evaluate((el) => getComputedStyle(el).fontVariantNumeric);
    expect(fvn).toContain('tabular-nums'); // L7
  });

  test('prefers-reduced-motion freezes the spins with the static settle transform', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${DETAIL}?scenario=26`);
    const state = await page.locator('.chat-spinner').evaluate((el) => {
      const spins = [...el.querySelectorAll('.ld-atom-spin')];
      return {
        running: el.getAnimations({ subtree: true }).length,
        names: spins.map((s) => getComputedStyle(s).animationName),
        transforms: spins.map((s) => getComputedStyle(s).transform),
      };
    });
    expect(state.running).toBe(0); // L5: nothing animates under the freeze law
    expect(state.names).toHaveLength(3); // L5: the spins exist — no vacuous pass
    for (const name of state.names) expect(name).toBe('none'); // L5
    for (const t of state.transforms) expect(t).not.toBe('none'); // L5: static rotate(60deg) settle
  });
});

test.describe('quiescent building gap (scenario spinner-quiescent)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${DETAIL}?scenario=spinner-quiescent`);
  });

  test('one live row: spinning indicator + static 执行中... label, no seconds', async ({
    page,
  }) => {
    const row = page.locator('.chat-streaming');
    await expect(row).toHaveCount(1);
    await expect(page.locator('.chat-spinner')).toHaveCount(1);
    await expect(page.locator('.ld-atom-spin')).toHaveCount(3); // L2
    await expect(page.locator('.chat-streaming-label')).toHaveText('执行中...');
    await expect(page.locator('.chat-streaming-secs')).toHaveCount(0);
    await expect(row).not.toContainText('undefined'); // L8
    await expect(row).not.toContainText(/(^|[^.\w])s([^.\w]|$)/); // no bare "s" tail
    // the header chip and the transcript row agree — the row is the
    // conversation-side echo of the same phase
    await expect(page.locator('.detail-chip')).toHaveText(/执行中/);
  });
});
