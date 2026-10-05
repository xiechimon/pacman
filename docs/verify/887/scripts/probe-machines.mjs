// #887 evidence probe: machines page local row, runtime area.
// Records what identifies each runtime mark (text label vs aria-label/title),
// the mark geometry, the inter-mark gap and the row-height contract, then
// crops the runtime area and the whole row.
//
//   usage: BASE=http://127.0.0.1:<fixture-preview-port> EVIDENCE_TAG=before|after \
//          node docs/verify/887/scripts/probe-machines.mjs
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const REPO =
  process.env.VERIFY_REPO_ROOT ?? execSync('git rev-parse --show-toplevel').toString().trim();
const BASE = process.env.BASE ?? 'http://127.0.0.1:8412';
const tag = process.env.EVIDENCE_TAG ?? 'after';
const OUT = join(REPO, 'docs/verify/887', tag);
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 732 },
  deviceScaleFactor: 2,
  colorScheme: 'dark',
});
const page = await context.newPage();
await page.goto(`${BASE}/app/resources/machines?scenario=06`, { waitUntil: 'networkidle' });
await page.waitForSelector('.mach-runtime');
await page.waitForTimeout(300);

const measured = await page.evaluate(() => {
  const row = document.querySelector('.res-grow[data-kind="local"]');
  const runtimes = [...row.querySelectorAll('.mach-runtime')].map((el) => {
    const mark = el.querySelector('.mach-mark');
    const label = el.querySelector('.mach-runtime-label');
    const r = el.getBoundingClientRect();
    const mr = mark?.getBoundingClientRect();
    return {
      runtime: el.dataset.runtime,
      on: el.classList.contains('mach-runtime--on'),
      wrapRect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      markRect: mr ? { w: Math.round(mr.width), h: Math.round(mr.height) } : null,
      markOpacity: mark ? getComputedStyle(mark).opacity : null,
      textLabel: label ? label.textContent : null,
      ariaLabel: el.getAttribute('aria-label'),
      role: el.getAttribute('role'),
      title: el.getAttribute('title'),
      // what a screen reader / hover user gets once the visible text is gone
      accessibleName: null,
    };
  });
  const gap =
    runtimes.length === 2 ? runtimes[1].wrapRect.x - (runtimes[0].wrapRect.x + runtimes[0].wrapRect.w) : null;
  const rowRect = row.getBoundingClientRect();
  return {
    runtimes,
    interMarkGapPx: gap,
    rowHeightPx: Math.round(rowRect.height),
    rowText: (row.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120),
  };
});

// accessible names through the engine (what AT actually announces)
for (const [i, rt] of measured.runtimes.entries()) {
  const handle = page.locator('.res-grow[data-kind="local"] .mach-runtime').nth(i);
  rt.accessibleName = await handle.evaluate((el) => el.getAttribute('aria-label'));
}

await page
  .locator('.res-grow[data-kind="local"] .mach-runtimes')
  .screenshot({ path: join(OUT, `runtimes-${tag}.png`) });
await page
  .locator('.res-grow[data-kind="local"]')
  .screenshot({ path: join(OUT, `row-${tag}.png`) });

writeFileSync(join(OUT, `result-${tag}.json`), `${JSON.stringify(measured, null, 2)}\n`);
console.log(JSON.stringify(measured, null, 2));
console.log('evidence ->', OUT);
await context.close();
await browser.close();
