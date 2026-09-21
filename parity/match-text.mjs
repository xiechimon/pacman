#!/usr/bin/env node
// Text template matcher: renders candidate strings in a real browser with
// the app's font stack, then scores each candidate against a capture crop
// by best-shift mean-abs-diff on grayscale bitmaps. Recovers verbatim
// strings (titles, relative times, labels) from r7 captures without OCR.
// Usage: node parity/match-text.mjs <baseUrl> <capture> <x0> <y0> <x1> <y1>
//        <fontSize> <candidate>...

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { decodePng, px } from './png.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);

/** Crop tight text bbox from a region of ink (lum below/above bg). */
function textBBox(img, x0, y0, x1, y1, dark) {
  let minX = x1;
  let minY = y1;
  let maxX = x0;
  let maxY = y0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const [r, g, b] = px(img, x, y);
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const isInk = dark ? lum > 60 : lum < 210;
      if (isInk) {
        if (x < minX) minX = x;
        if (x >= maxX) maxX = x + 1;
        if (y < minY) minY = y;
        if (y >= maxY) maxY = y + 1;
      }
    }
  }
  return maxX > minX ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : null;
}

/** mean abs diff between two grayscale patches at best small shift. */
function bestShiftDiff(a, b) {
  // a, b: {g: Float32Array, w, h} — sizes may differ; compare overlapping
  const w = Math.min(a.w, b.w);
  const h = Math.min(a.h, b.h);
  let best = Infinity;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      let sum = 0;
      let n = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const ax = Math.min(a.w - 1, Math.max(0, x + dx));
          const ay = Math.min(a.h - 1, Math.max(0, y + dy));
          const bx = Math.min(b.w - 1, Math.max(0, x - dx));
          const by = Math.min(b.h - 1, Math.max(0, y - dy));
          sum += Math.abs(a.g[ay * a.w + ax] - b.g[by * b.w + bx]);
          n++;
        }
      }
      const d = sum / n;
      if (d < best) best = d;
    }
  }
  return best;
}

function patch(img, bbox, dark) {
  // invert dark text so both are dark-on-light
  const g = new Float32Array(bbox.w * bbox.h);
  for (let y = 0; y < bbox.h; y++) {
    for (let x = 0; x < bbox.w; x++) {
      const [r, gg, b] = px(img, bbox.x + x, bbox.y + y);
      let lum = 0.299 * r + 0.587 * gg + 0.114 * b;
      if (dark) lum = 255 - lum;
      g[y * bbox.w + x] = lum;
    }
  }
  return { g, w: bbox.w, h: bbox.h };
}

async function main() {
  const [baseUrl, capturePath, x0, y0, x1, y1, fontSize, ...candidates] = process.argv.slice(2);
  if (candidates.length === 0) {
    console.error(
      'usage: match-text.mjs <baseUrl> <capture> <x0> <y0> <x1> <y1> <fontSize> <candidate>...',
    );
    process.exit(1);
  }
  const img = decodePng(readFileSync(resolve(ROOT, capturePath)));
  const region = { x0: +x0, y0: +y0, x1: +x1, y1: +y1 };
  const dark = px(img, region.x0, region.y0)[0] < 100;
  const tbox = textBBox(img, region.x0, region.y0, region.x1, region.y1, dark);
  if (tbox == null) {
    console.error('no target ink in region');
    process.exit(1);
  }
  const tpatch = patch(img, tbox, dark);
  console.log(`target bbox ${tbox.w}x${tbox.h} @ (${tbox.x},${tbox.y}) dark=${dark}`);

  const browser = await chromium.launch({ args: ['--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 300 } });
  await page.goto(`${baseUrl}/app`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    ([isDark, size]) => {
      document.body.innerHTML = `<style>
        body { margin: 0; background: ${isDark ? '#1f1f23' : '#ffffff'}; }
        #t { position: absolute; left: 20px; top: 20px; white-space: pre;
          font-family: var(--font-sans); color: ${isDark ? '#fafaf9' : '#1c1917'};
          font-size: ${size}px; line-height: 1; letter-spacing: 0; }
      </style><div id="t"></div>`;
    },
    [dark, fontSize],
  );

  const results = [];
  for (const cand of candidates) {
    await page.evaluate((s) => {
      document.querySelector('#t').textContent = s;
    }, cand);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(40);
    const buf = await page.screenshot();
    const rendered = decodePng(buf);
    const rbox = textBBox(rendered, 0, 0, rendered.width, rendered.height, dark);
    if (rbox == null) {
      results.push({ cand, diff: Infinity, w: 0, h: 0 });
      continue;
    }
    const rpatch = patch(rendered, rbox, dark);
    const diff = bestShiftDiff(tpatch, rpatch);
    results.push({ cand, diff, w: rbox.w, h: rbox.h });
  }
  await browser.close();

  results.sort((a, b) => a.diff - b.diff);
  for (const r of results) {
    console.log(`${r.diff.toFixed(1).padStart(7)}  ${String(r.w).padStart(3)}x${r.h}  ${r.cand}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
