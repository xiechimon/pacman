// #885 evidence probe (item 2, record-only): 320px narrow-column overflow on
// the detail conversation. Walks the layout at 320x732 and reports where the
// horizontal overflow comes from (page level, chat column, fixed sidebar),
// alongside the same numbers at 1440x732 for reference. No code is changed
// by this ticket item — the numbers decide fix-now vs record.
//
//   usage: BASE=http://127.0.0.1:<fixture-preview-port> EVIDENCE_TAG=before|after \
//          node docs/verify/885/scripts/probe-narrow.mjs
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const REPO =
  process.env.VERIFY_REPO_ROOT ?? execSync('git rev-parse --show-toplevel').toString().trim();
const BASE = process.env.BASE ?? 'http://127.0.0.1:8412';
const tag = process.env.EVIDENCE_TAG ?? 'after';
const OUT = join(REPO, 'docs/verify/885', tag);
mkdirSync(OUT, { recursive: true });
const DETAIL = '/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=26';

const browser = await chromium.launch();
const results = {};

for (const width of [1440, 320]) {
  const context = await browser.newContext({
    viewport: { width, height: 732 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  await page.goto(`${BASE}${DETAIL}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.chat-col');
  await page.waitForTimeout(300);

  results[`${width}px`] = await page.evaluate(() => {
    const doc = document.scrollingElement;
    const col = document.querySelector('.chat-col');
    const colRect = col.getBoundingClientRect();
    // every element wider than the viewport, top 6 by overflow amount
    const wide = [...document.querySelectorAll('body *')]
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { el, right: r.right, width: r.width };
      })
      .filter((x) => x.right > window.innerWidth + 1 && x.width > 40)
      .sort((a, b) => b.right - a.right)
      .slice(0, 6)
      .map((x) => ({
        sel: `${x.el.tagName.toLowerCase()}.${[...x.el.classList].slice(0, 2).join('.')}`,
        width: Math.round(x.width),
        right: Math.round(x.right),
      }));
    const sidebars = [...document.querySelectorAll('aside, nav, [class*="sidebar"]')]
      .map((el) => ({
        sel: `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join('.')}`,
        width: Math.round(el.getBoundingClientRect().width),
      }))
      .filter((x) => x.width > 0);
    return {
      pageScrollWidth: doc.scrollWidth,
      pageClientWidth: doc.clientWidth,
      pageOverflowsX: doc.scrollWidth > doc.clientWidth,
      chatCol: {
        scrollWidth: col.scrollWidth,
        clientWidth: col.clientWidth,
        overflowsX: col.scrollWidth > col.clientWidth,
        rect: { x: Math.round(colRect.x), w: Math.round(colRect.width) },
      },
      sidebars,
      widestOffenders: wide,
    };
  });

  await page.screenshot({ path: join(OUT, `detail-${width}-${tag}.png`) });
  await context.close();
}

await browser.close();
writeFileSync(join(OUT, `narrow-${tag}.json`), `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));
console.log('evidence ->', OUT);
