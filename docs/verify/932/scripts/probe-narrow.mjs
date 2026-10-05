// #932 evidence probe: the detail route's fixed 3-pane shell at narrow
// viewports. Walks 320/360/390 in both color schemes on the fixture preview
// (scenario 26, the same surface #885 recorded) and captures, per width and
// scheme: a viewport screenshot plus the geometry that decides
// clipped-with-zero-disclosure vs degraded — document horizontal overflow,
// the thread column's swallowed sideways scroll (#885 measured 133px of
// content in a 35px box), the center column width and which fixed panes are
// on screen. Records facts only; before/after are compared by eye and by the
// JSON diff, not by assertions here.
//
//   usage: BASE=http://127.0.0.1:<fixture-preview-port> EVIDENCE_TAG=before|after \
//          OUT=<absolute docs/verify/932 dir> node probe-narrow.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8412';
const tag = process.env.EVIDENCE_TAG ?? 'after';
const OUT = process.env.OUT;
if (!OUT) throw new Error('usage: OUT=<dir> node probe-narrow.mjs');
mkdirSync(OUT, { recursive: true });
const DETAIL = '/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=26';

const browser = await chromium.launch();
const results = {};

for (const width of [320, 360, 390]) {
  for (const scheme of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport: { width, height: 732 },
      deviceScaleFactor: 2,
      colorScheme: scheme,
    });
    const page = await context.newPage();
    await page.goto(`${BASE}${DETAIL}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.chat-col');
    await page.waitForTimeout(300);

    results[`${width}-${scheme}`] = await page.evaluate(() => {
      const doc = document.scrollingElement;
      const col = document.querySelector('.chat-col');
      const visible = (sel) => {
        const el = document.querySelector(sel);
        return el !== null && el.getBoundingClientRect().width > 0 && getComputedStyle(el).display !== 'none';
      };
      return {
        docScrollWidth: doc.scrollWidth,
        docClientWidth: doc.clientWidth,
        colScrollWidth: col.scrollWidth,
        colClientWidth: col.clientWidth,
        centerWidth: Math.round(document.querySelector('.detail-center').getBoundingClientRect().width),
        sidebarVisible: visible('.board-sidebar'),
        rightPaneVisible: visible('.detail-right'),
      };
    });
    await page.screenshot({ path: join(OUT, `detail-${width}-${scheme}-${tag}.png`) });
    await context.close();
  }
}

writeFileSync(join(OUT, `narrow-${tag}.json`), `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));
await browser.close();
