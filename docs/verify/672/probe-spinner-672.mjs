// Probe for issue #672: loading indicator swap (braille reel -> loading-dev
// Atom). Dumps per-scenario geometry (static, md5-hashed) plus the animated
// state (time-dependent, deliberately NOT hashed), row screenshots, and a
// reduced-motion pass. Run identically before and after the swap; the shift
// table is generated from the two dumps.
//
// Usage:
//   PROBE_OUT=docs/verify/672/before node .claude/verify-shots/probe-spinner-672.mjs
//   PROBE_OUT=docs/verify/672/after  node .claude/verify-shots/probe-spinner-672.mjs

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:8400';
const OUT = process.env.PROBE_OUT;
if (!OUT) {
  console.error('PROBE_OUT is required');
  process.exit(1);
}
const ROOT = resolve(import.meta.dirname, '../..');
const OUTDIR = resolve(ROOT, OUT);
mkdirSync(OUTDIR, { recursive: true });

const DETAIL = '/app/todo/7ve0iOkQ-JBpSL98zSiGc';
const SCENARIOS = ['26', 'spinner-quiescent'];

// Static geometry + styles: deterministic across runs (animated properties
// like transform/opacity are read in the separate dynamic pass).
const DUMP_STATIC = () => {
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  };
  const stat = (el, props) => {
    const cs = getComputedStyle(el);
    const out = {};
    for (const p of props) out[p] = cs[p];
    return out;
  };
  const rows = document.querySelectorAll('.chat-streaming');
  const row = rows[rows.length - 1];
  if (!row) return null;
  const ind = row.querySelector('.chat-spinner');
  const q = (sel) => row.querySelector(sel);
  const secs = q('.chat-streaming-secs');
  const svg = q('svg');
  const label = q('.chat-streaming-label');
  const reel = q('.chat-spinner-reel');
  const reelFrames = reel ? [...reel.children].map((c) => c.textContent) : null;
  // Atom parts (all absent on the pre-swap reel build)
  const shell = q('.ld-atom-shell');
  const orbits = [...row.querySelectorAll('.ld-atom-orbit')];
  const spins = [...row.querySelectorAll('.ld-atom-spin')];
  const rings = [...row.querySelectorAll('.ld-atom-ring')];
  return {
    rowCount: rows.length,
    row: { rect: rect(row), style: stat(row, ['height', 'fontSize', 'lineHeight', 'gap', 'display', 'alignItems']) },
    indicator: ind
      ? {
          rect: rect(ind),
          style: stat(ind, ['width', 'height', 'display', 'position', 'color', 'fontSize', 'flex', 'backgroundColor']),
          className: ind.className,
          ariaHidden: ind.getAttribute('aria-hidden'),
        }
      : null,
    reelFrames,
    parts: { shell: shell ? 1 : 0, orbit: orbits.length, spin: spins.length, ring: rings.length },
    shell: shell
      ? { rect: rect(shell), style: stat(shell, ['borderTopWidth', 'borderTopColor', 'borderRadius', 'boxSizing']) }
      : null,
    ring: rings[0]
      ? { style: stat(rings[0], ['borderTopWidth', 'borderTopColor', 'borderRadius']) }
      : null,
    secs: secs ? { rect: rect(secs), text: secs.textContent, style: stat(secs, ['fontVariantNumeric']) } : null,
    chevron: svg ? { rect: rect(svg) } : null,
    label: label ? { rect: rect(label), text: label.textContent } : null,
    // tail x offsets relative to the row box — the shift table's core rows
    rel: {
      indicatorX: ind ? rect(ind).x - rect(row).x : null,
      secsX: secs ? rect(secs).x - rect(row).x : null,
      chevronX: svg ? rect(svg).x - rect(row).x : null,
      labelX: label ? rect(label).x - rect(row).x : null,
    },
  };
};

// Animated / time-dependent state: never hashed, reported as-is.
const DUMP_DYNAMIC = () => {
  const rows = document.querySelectorAll('.chat-streaming');
  const row = rows[rows.length - 1];
  if (!row) return null;
  const ind = row.querySelector('.chat-spinner');
  const anims = ind ? ind.getAnimations({ subtree: true }) : [];
  const reel = row.querySelector('.chat-spinner-reel');
  const spin = row.querySelector('.ld-atom-spin');
  const cs = (el) => (el ? getComputedStyle(el) : null);
  return {
    animationCount: anims.length,
    animations: anims.map((a) => {
      const t = a.effect?.getComputedTiming?.();
      return {
        name: a.animationName ?? null,
        playState: a.playState,
        duration: t?.duration ?? null,
        // JSON.stringify turns Infinity into null — keep the evidence literal
        iterations: t?.iterations == null ? null : String(t.iterations),
      };
    }),
    reel: reel ? { animationName: cs(reel).animationName, animationDuration: cs(reel).animationDuration, animationTimingFunction: cs(reel).animationTimingFunction, transform: cs(reel).transform } : null,
    spin: spin ? { animationName: cs(spin).animationName, animationDuration: cs(spin).animationDuration, animationTimingFunction: cs(spin).animationTimingFunction, animationDelay: cs(spin).animationDelay, transform: cs(spin).transform } : null,
    spinDelays: [...row.querySelectorAll('.ld-atom-spin')].map((s) => cs(s).animationDelay),
  };
};

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 732 },
  colorScheme: 'dark',
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const manifest = { phase: OUT.split('/').pop(), base: BASE, generatedAt: new Date().toISOString(), files: {} };

for (const sc of SCENARIOS) {
  const tag = sc === '26' ? 'streaming' : 'quiescent';
  await page.goto(`${BASE}${DETAIL}?scenario=${sc}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.chat-streaming');

  const stat = await page.evaluate(DUMP_STATIC);
  const dyn = await page.evaluate(DUMP_DYNAMIC);
  const statJson = JSON.stringify(stat, null, 2);
  const md5 = createHash('md5').update(statJson).digest('hex');
  writeFileSync(resolve(OUTDIR, `geometry-${tag}.json`), `${statJson}\n`);
  writeFileSync(resolve(OUTDIR, `animated-${tag}.json`), `${JSON.stringify(dyn, null, 2)}\n`);
  manifest.files[`geometry-${tag}.json`] = { md5, note: 'static geometry+styles, deterministic' };
  manifest.files[`animated-${tag}.json`] = { md5: null, note: 'time-dependent, not hashed' };

  // row clip + a wider context clip (2x device scale)
  const rowBox = await page.locator('.chat-streaming').last().boundingBox();
  await page.screenshot({
    path: resolve(OUTDIR, `row-${tag}.png`),
    clip: { x: rowBox.x - 8, y: rowBox.y - 8, width: Math.min(rowBox.width + 16, 1440 - rowBox.x + 8), height: rowBox.height + 16 },
  });
  await page.screenshot({
    path: resolve(OUTDIR, `context-${tag}.png`),
    clip: { x: Math.max(rowBox.x - 60, 0), y: Math.max(rowBox.y - 60, 0), width: 560, height: 140 },
  });
  manifest.files[`row-${tag}.png`] = 'row clip, deviceScaleFactor 2';
  manifest.files[`context-${tag}.png`] = 'surrounding transcript clip';

  // reduced-motion pass: the freeze contract
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${BASE}${DETAIL}?scenario=${sc}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.chat-streaming');
  const rmDyn = await page.evaluate(DUMP_DYNAMIC);
  const rmStat = await page.evaluate(DUMP_STATIC);
  writeFileSync(
    resolve(OUTDIR, `reduced-motion-${tag}.json`),
    `${JSON.stringify({ animated: rmDyn, shellBorder: rmStat?.shell?.style?.borderTopColor ?? null }, null, 2)}\n`,
  );
  manifest.files[`reduced-motion-${tag}.json`] = { md5: null, note: 'freeze contract under prefers-reduced-motion: reduce' };
  await page.emulateMedia({ reducedMotion: null });
}

writeFileSync(resolve(OUTDIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`probe done -> ${OUT}`);
console.log(JSON.stringify(manifest.files, null, 2));
await browser.close();
