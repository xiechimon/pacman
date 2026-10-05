#!/usr/bin/env node
// #853 evidence probe: screenshots + computed styles of the two consolidated
// chip faces (search-row mini chip, detail-head chip) on the fixture build.
// Run with E2E_PORT set; writes into docs/verify/853/ next to this script.

import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
// playwright lives in the pnpm store layout; resolve from its own manifest.
const { chromium } = createRequire(
  join(ROOT, 'node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/package.json'),
)('playwright');
const OUT = join(dirname(fileURLToPath(import.meta.url)));
mkdirSync(OUT, { recursive: true });
const PORT = process.env.E2E_PORT ?? '8404';
const BASE = `http://127.0.0.1:${PORT}`;

const styleOf = (locator, props) => locator.evaluate((el, ps) => {
  const cs = getComputedStyle(el);
  return Object.fromEntries(ps.map((p) => [p, cs.getPropertyValue(p)]));
}, props);
const PROPS = [
  'display',
  'height',
  'padding-left',
  'padding-right',
  'border-radius',
  'font-size',
  'line-height',
  'background-color',
  'color',
  'margin-left',
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 732 } });
const result = {};

// Face 1: search-row chip (Chip mini) on the board scenario.
await page.goto(`${BASE}/app?scenario=01`);
await page.locator('.sidebar-row, .rail-row').first().waitFor({ state: 'visible' });
for (let i = 0; i < 6; i += 1) {
  await page.keyboard.press('Meta+k');
  const opened = await page
    .locator('.search-panel')
    .waitFor({ state: 'visible', timeout: 1000 })
    .then(() => true)
    .catch(() => false);
  if (opened) break;
}
await page.keyboard.type('r3 lifecycle probe');
const searchChip = page.locator('.search-row-chip').first();
await searchChip.waitFor({ state: 'visible' });
result.searchChip = {
  class: await searchChip.getAttribute('class'),
  text: await searchChip.textContent(),
  computed: await styleOf(searchChip, PROPS),
};
await searchChip.screenshot({ path: join(OUT, '853-search-chip.png') });

// Face 2: detail-head chip (Chip md) on the confirm scenario.
await page.goto(`${BASE}/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=19`);
const detailChip = page.locator('.detail-chipwrap .chip').first();
await detailChip.waitFor({ state: 'visible' });
result.detailChip = {
  class: await detailChip.getAttribute('class'),
  text: await detailChip.textContent(),
  computed: await styleOf(detailChip, PROPS),
};
await page.locator('.detail-chipwrap').screenshot({ path: join(OUT, '853-detail-chip.png') });

await browser.close();
writeFileSync(join(OUT, '853-computed.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
