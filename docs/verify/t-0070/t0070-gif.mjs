// t-0070 motion evidence: deterministic frame scrub of the menu enter/exit.
// Pauses the running animations and sets currentTime explicitly, so both
// trees produce the same frames per frame index (t-0041 method).
// usage: node t0070-gif.mjs <baseURL> <outDir> <label>
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const [base, outDir, label] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const FACE = {
  url: '/app/project/ZAQczKCu0MOAzC1ZqcFlX?scenario=prj-tasks',
  trigger: '.prj-tasks-filter',
  plate: '.prj-tasks-menu',
};
const FRAC = [0, 0.25, 0.5, 0.75, 1];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  baseURL: base,
  viewport: { width: 1440, height: 732 },
  colorScheme: 'dark',
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto(FACE.url);
await page.waitForLoadState('networkidle');

const trigger = page.locator(FACE.trigger, { hasText: '筛选' }).first();

// clip = union(trigger, plate) + margin, measured while open; then close
await trigger.click();
await page.waitForSelector(FACE.plate, { state: 'visible' });
const clip = await page.evaluate(
  ({ triggerSel, plate }) => {
    const els = [document.querySelector(triggerSel), document.querySelector(plate)].filter(
      Boolean,
    );
    let x0 = 1e9;
    let y0 = 1e9;
    let x1 = -1e9;
    let y1 = -1e9;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      x0 = Math.min(x0, r.x);
      y0 = Math.min(y0, r.y);
      x1 = Math.max(x1, r.x + r.width);
      y1 = Math.max(y1, r.y + r.height);
    }
    return { x: x0 - 12, y: y0 - 12, width: x1 - x0 + 24, height: y1 - y0 + 24 };
  },
  { triggerSel: FACE.trigger, plate: FACE.plate },
);
await page.keyboard.press('Escape');
await page.waitForSelector(FACE.plate, { state: 'hidden' });
await page.waitForTimeout(400);

// ——— enter: open, pause, scrub ———
await trigger.click();
await page.waitForSelector(FACE.plate, { state: 'visible' });
const enterMeta = await page.evaluate((plate) => {
  const el = document.querySelector(plate);
  if (!el) return null;
  const anims = [...new Set(el.getAnimations({ subtree: true }))];
  anims.forEach((a) => a.pause());
  return anims.map((a) => ({
    name: a.animationName ?? a.transitionProperty ?? 'anim',
    dur: a.effect?.getTiming?.().duration ?? null,
  }));
}, FACE.plate);
for (let i = 0; i < FRAC.length; i += 1) {
  await page.evaluate(
    ({ plate, frac }) => {
      const el = document.querySelector(plate);
      for (const a of el.getAnimations({ subtree: true })) {
        const d = Number(a.effect?.getTiming?.().duration ?? 100);
        a.currentTime = Math.min(d * frac, d);
      }
    },
    { plate: FACE.plate, frac: FRAC[i] },
  );
  await page.screenshot({ path: `${outDir}/${label}-enter-${i}.png`, clip });
}

// ——— exit: arm a rAF hook that catches the exit animations at their first
// frame (the popup unmounts fast in the after tree), then Escape ———
await page.evaluate((plate) => {
  window.__exitAnims = null;
  const tick = () => {
    const el = document.querySelector(plate);
    if (el) {
      const closing =
        el.hasAttribute('data-closed') ||
        el.closest('.overlay-mount[data-overlay-state="closed"]') != null;
      if (closing) {
        const anims = [...new Set(el.getAnimations({ subtree: true }))];
        if (anims.length > 0) {
          anims.forEach((a) => a.pause());
          window.__exitAnims = anims;
          return;
        }
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}, FACE.plate);
await page.keyboard.press('Escape');
await page.waitForFunction(() => window.__exitAnims !== null, undefined, { timeout: 5000 });
const exitMeta = await page.evaluate(() =>
  window.__exitAnims.map((a) => ({
    name: a.animationName ?? a.transitionProperty ?? 'anim',
    dur: a.effect?.getTiming?.().duration ?? null,
  })),
);
for (let i = 0; i < FRAC.length; i += 1) {
  await page.evaluate(
    ({ frac }) => {
      for (const a of window.__exitAnims) {
        const d = Number(a.effect?.getTiming?.().duration ?? 100);
        // clamp below the very end: a keyframe animation without fill-mode
        // reverts to the base style when currentTime reaches duration
        a.currentTime = Math.min(d * frac, d - 0.5);
      }
    },
    { frac: FRAC[i] },
  );
  await page.screenshot({ path: `${outDir}/${label}-exit-${i}.png`, clip });
}
// terminal frame: let the exit complete for real (popup unmounts)
await page.evaluate(() => {
  for (const a of window.__exitAnims) {
    try {
      a.effect?.updateTiming?.({ fill: 'forwards' });
      a.finish();
    } catch {}
  }
});
await page.waitForSelector(FACE.plate, { state: 'hidden' });
await page.screenshot({ path: `${outDir}/${label}-exit-5.png`, clip });

console.log(JSON.stringify({ label, enterMeta, exitMeta }, null, 2));
await browser.close();
