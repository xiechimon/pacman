// #932-adjacent evidence probe for #933: the collapsed tool-call group on a
// real-dialog transcript (seed-tools-group.mjs). Records, on the live stack:
// the group row's visible text and glyph count, whether a copy affordance
// sits in the collapsed row, the same facts after expanding, and two
// screenshots — the transcript column clipped, and the full viewport. Facts
// only; before/after differ by design (identity label in, collapsed copy
// out) and are compared by eye plus this JSON.
//
//   usage: BASE=http://127.0.0.1:<web-port> EVIDENCE_TAG=before|after \
//          OUT=<absolute docs/verify/933 dir> node probe-tools-group.mjs <todoId>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5277';
const tag = process.env.EVIDENCE_TAG ?? 'after';
const OUT = process.env.OUT;
const todoId = process.argv[2];
if (!OUT || !todoId) throw new Error('usage: OUT=<dir> node probe-tools-group.mjs <todoId>');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 732 },
  deviceScaleFactor: 2,
  colorScheme: 'dark',
});
const page = await context.newPage();
await page.goto(`${BASE}/app/todo/${todoId}`, { waitUntil: 'networkidle' });
await page.waitForSelector('button.chat-row-icons--toggle', { timeout: 20000 });
await page.waitForTimeout(500);

const facts = () =>
  page.evaluate(() => {
    const row = document.querySelector('.chat-row-icons:has(.chat-row-icons--toggle)');
    const toggle = row?.querySelector('button.chat-row-icons--toggle');
    const label = toggle?.querySelector('.chat-foot-tools-label');
    const col = document.querySelector('.chat-col');
    const colRect = col.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    return {
      rowText: (row?.textContent ?? '').trim(),
      labelText: (label?.textContent ?? '').trim(),
      glyphCount: toggle?.querySelectorAll('svg').length ?? 0,
      copyCount: row?.querySelectorAll('.chat-copy').length ?? 0,
      expanded: toggle?.getAttribute('aria-expanded') ?? null,
      // the group's position in the column: above the first agent message
      firstAgentRowTop:
        document.querySelector('.chat-row--agent')?.getBoundingClientRect().top ?? null,
      groupTop: Math.round(rowRect.top - colRect.top),
      colRect: { x: Math.round(colRect.x), y: Math.round(colRect.y), width: Math.round(colRect.width), height: Math.round(colRect.height) },
    };
  });

const collapsed = await facts();
const clip = collapsed.colRect;
await page.screenshot({ path: join(OUT, `group-collapsed-${tag}.png`), clip });
await page.screenshot({ path: join(OUT, `viewport-collapsed-${tag}.png`) });

await page.locator('button.chat-row-icons--toggle').click();
await page.waitForSelector('.chat-tool-pill');
await page.waitForTimeout(200);
const expanded = await facts();
await page.screenshot({ path: join(OUT, `group-expanded-${tag}.png`), clip });

const record = { collapsed, expanded };
writeFileSync(join(OUT, `group-${tag}.json`), `${JSON.stringify(record, null, 2)}\n`);
console.log(JSON.stringify(record, null, 2));
await browser.close();
