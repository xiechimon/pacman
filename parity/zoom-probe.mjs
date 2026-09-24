#!/usr/bin/env node
// #139 zoom probe: renders the account popover + board cards at fractional
// page-zoom equivalents. Browser zoom leaves CSS layout untouched and scales
// the raster, so the faithful headless emulation is a fractional context
// deviceScaleFactor (dpr 1 display at 110% = 1.1, Retina at 110% = 2.2) with
// device-scale screenshots.
//
// Metric: full-viewport shot, then per side integrate |pixel - surface fill|
// across a ±2px zone around the expected edge on the vertical midline.
// Anti-aliasing redistributes a hairline over adjacent device pixels but
// conserves its integrated contrast, so a present ring scores ~full on both
// sides and a rasterization-dropped edge scores ~0.
//
// usage: node parity/zoom-probe.mjs <tag> [base-url]
//   shots + raw decodes land in parity/output/zoom-<tag>/ (gitignored)

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const TAG = process.argv[2] ?? 'probe';
const BASE = process.argv[3] ?? 'http://127.0.0.1:5139';
const OUT = resolve(new URL('.', import.meta.url).pathname, 'output', `zoom-${TAG}`);
mkdirSync(OUT, { recursive: true });

const SCALES = [1, 1.1, 1.25, 1.5];

function decodePng(file) {
  const raw = resolve(
    OUT,
    `${file
      .split('/')
      .pop()
      .replace(/\.png$/, '')}.raw`,
  );
  const probe = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height',
      '-of',
      'csv=p=0',
      file,
    ],
    { encoding: 'utf8' },
  );
  const [w, h] = probe.stdout.trim().split(',').map(Number);
  spawnSync('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    file,
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgb24',
    raw,
  ]);
  return { w, h, data: readFileSync(raw) };
}

/** integrated |px-fill| contrast across the ±zone around an edge column */
function edgeContrast(img, x, y, fill, zone = 2) {
  let sum = 0;
  for (let dx = -zone; dx <= zone; dx += 1) {
    const cx = Math.round(x) + dx;
    if (cx < 0 || cx >= img.w) continue;
    const i = (y * img.w + cx) * 3;
    sum +=
      Math.abs(img.data[i] - fill[0]) +
      Math.abs(img.data[i + 1] - fill[1]) +
      Math.abs(img.data[i + 2] - fill[2]);
  }
  return sum;
}

// one page per theme carries both surfaces: the live popover opens from a
// real avatar-chip click (the floating variant is what a dogfooder sees; the
// fixture-frozen absolute variant only exists for parity captures at 100%)
const surfaces = [
  {
    name: 'dark',
    theme: 'dark',
    click: '.sidebar-user',
    popSelector: '.user-menu--floating',
    cardSelector: '.todo-card',
    popFill: [31, 31, 35], // --popover-bg dark #1f1f23
    cardFill: [31, 31, 35], // --card-bg dark #1f1f23
  },
  {
    name: 'light',
    theme: 'light',
    click: '.sidebar-user',
    popSelector: '.user-menu--floating',
    cardSelector: '.todo-card',
    popFill: [253, 250, 247], // --popover-bg light #fdfaf7
    cardFill: [255, 255, 255], // --card-bg light #ffffff
  },
];

const report = [];
for (const scale of SCALES) {
  const browser = await chromium.launch({ args: ['--disable-lcd-text'] });
  for (const s of surfaces) {
    // true zoom: the physical window is fixed, so the css viewport shrinks
    // with the zoom factor while the raster scales up (dpr = z)
    const ctx = await browser.newContext({
      viewport: { width: Math.round(1440 / scale), height: Math.round(732 / scale) },
      deviceScaleFactor: scale,
    });
    await ctx.addInitScript(([k, t]) => localStorage.setItem(k, t), ['pacman-theme', s.theme]);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/app?scenario=01`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.click(s.click);
    await page.waitForSelector(s.popSelector);
    // boxes before the shot so measured coords match shot pixels: scenario 01
    // parks its cards in a right-hand column that starts off-screen at
    // zoom-shrunk viewports, so bring it into the board scroller first
    const boxes = await page.evaluate((popSelector) => {
      const cards = [...document.querySelectorAll('.todo-card')];
      const onScreen = () =>
        cards.find((node) => {
          const r = node.getBoundingClientRect();
          return r.x >= 0 && r.right <= innerWidth && r.y >= 0 && r.bottom <= innerHeight;
        });
      let card = onScreen();
      if (!card) {
        cards[0].scrollIntoView({ inline: 'center', block: 'nearest' });
        card = cards[0];
      }
      const rc = card.getBoundingClientRect();
      const rp = document.querySelector(popSelector).getBoundingClientRect();
      const rect = (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height });
      return { card: rect(rc), pop: rect(rp), ih: innerHeight };
    }, s.popSelector);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
    const shot = resolve(OUT, `${s.name}-z${Math.round(scale * 100)}.png`);
    // device scale: the css-scale default downsamples the physical buffer and
    // averages away exactly the fractional-pixel rasterization we measure
    await page.screenshot({ path: shot, scale: 'device' });
    const img = decodePng(shot);
    for (const [kind, box, fill] of [
      ['usermenu', boxes.pop, s.popFill],
      ['card', boxes.card, s.cardFill],
    ]) {
      // device-scale shot: image px = css px * deviceScaleFactor
      const y = Math.round((box.y + box.height / 2) * scale);
      const left = edgeContrast(img, box.x * scale, y, fill);
      const right = edgeContrast(img, (box.x + box.width) * scale - 1, y, fill);
      const ratio =
        left === 0 && right === 0 ? 1 : Math.min(left, right) / Math.max(left, right, 1);
      // border integrity also means the whole outline is on-screen: browser
      // zoom shrinks the css viewport, so a fixed-position panel can lose its
      // bottom border below the fold (the #139 dogfood symptom at 110%+)
      const clipped = box.y + box.height > boxes.ih + 0.5;
      report.push({ scale, surface: `${kind}-${s.name}`, left, right, ratio, clipped });
    }
    await ctx.close();
  }
  await browser.close();
}

let bad = 0;
for (const r of report) {
  // popover: outside is page bg on both sides, so left/right must balance and
  // the panel must stay on-screen. card: the ±2 zones catch a different count
  // of column-bg pixels per side depending where the fractional edge falls,
  // so symmetry is meaningless there — presence on both sides is the check
  const ok = r.surface.startsWith('card')
    ? Math.min(r.left, r.right) >= 30
    : r.ratio >= 0.5 && Math.min(r.left, r.right) > 0 && !r.clipped;
  if (!ok) bad += 1;
  console.log(
    `z${String(Math.round(r.scale * 100)).padStart(3)}% ${r.surface.padEnd(15)} ` +
      `left=${String(r.left).padStart(4)} right=${String(r.right).padStart(4)} ` +
      `balance=${r.ratio.toFixed(2)}${r.clipped ? ' CLIPPED-BY-VIEWPORT' : ''} ${ok ? 'ok' : '** EDGE LOST **'}`,
  );
}
process.exit(bad === 0 ? 0 : 1);
