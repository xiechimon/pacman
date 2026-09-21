#!/usr/bin/env node
// Region diff for parity iteration: compares a capture against its r7
// baseline and prints a coarse luminance heat map + the hottest cells so
// mismatches localize to sidebar/topbar/column/card regions quickly.
// Usage: node parity/diff-regions.mjs <capture.png> <baseline.png>

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decodePng, px } from './png.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const CELL = 24;

const a = decodePng(readFileSync(resolve(ROOT, process.argv[2] ?? '')));
const b = decodePng(readFileSync(resolve(ROOT, process.argv[3] ?? '')));
if (a.width !== b.width || a.height !== b.height) {
  console.error(`size mismatch: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  process.exit(1);
}

const cols = Math.ceil(a.width / CELL);
const rows = Math.ceil(a.height / CELL);
const cells = new Float64Array(cols * rows);
for (let y = 0; y < a.height; y++) {
  for (let x = 0; x < a.width; x++) {
    const pa = px(a, x, y);
    const pb = px(b, x, y);
    const d = (Math.abs(pa[0] - pb[0]) + Math.abs(pa[1] - pb[1]) + Math.abs(pa[2] - pb[2])) / 3;
    cells[Math.floor(y / CELL) * cols + Math.floor(x / CELL)] += d;
  }
}
const perCell = CELL * CELL;
for (let i = 0; i < cells.length; i++) cells[i] /= perCell;

// heat map: one char per cell row-band, 2 cell columns per char row
const CH = ' .:-=+*#%@';
const heat = [];
for (let cy = 0; cy < rows; cy++) {
  let line = '';
  for (let cx = 0; cx < cols; cx++) {
    const v = cells[cy * cols + cx];
    const idx = Math.min(CH.length - 1, Math.floor((v / 40) * CH.length));
    line += CH[idx];
  }
  heat.push(`${String(cy * CELL).padStart(4)} ${line}`);
}
console.log(heat.join('\n'));

const hot = [];
for (let cy = 0; cy < rows; cy++) {
  for (let cx = 0; cx < cols; cx++) {
    hot.push({ x: cx * CELL, y: cy * CELL, v: cells[cy * cols + cx] });
  }
}
hot.sort((p, q) => q.v - p.v);
const overall = hot.reduce((s, c) => s + c.v, 0) / hot.length;
console.log(`\nmean cell diff ${overall.toFixed(2)} — hottest cells (x,y @24px):`);
for (const c of hot.slice(0, 25)) {
  console.log(`  (${String(c.x).padStart(4)},${String(c.y).padStart(4)})  ${c.v.toFixed(1)}`);
}
