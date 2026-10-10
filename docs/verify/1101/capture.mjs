// #1101 before/after evidence capture for the review-pane diff view.
// Usage:
//   node docs/verify/1101/capture.mjs --base http://127.0.0.1:8396 --tag before
//   node docs/verify/1101/capture.mjs --base http://127.0.0.1:8397 --tag after
// Serves against a fixture-mode build (vite build --mode fixture + vite
// preview) that carries the diff-word-stress scenario. Writes into this
// directory: pane-left / pane-right / word-pair / full-right shots per
// theme, plus metrics-<tag>.json with the hard numbers (scrollWidth vs
// clientWidth vs row/head/file-row widths and word-span counts).
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
};
const BASE = arg('base');
const TAG = arg('tag') ?? 'shot';
if (BASE == null) {
  console.error('missing --base');
  process.exit(1);
}
// Locate the repo root via git, never via relative levels (docs/verify
// scripts must not hard-code their depth).
const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const OUT = join(REPO, 'docs/verify/1101');
// @playwright/test lives in apps/web/node_modules (pnpm strictness), so
// resolve through a require anchored at that package.
const require = createRequire(join(REPO, 'apps/web/package.json'));
const { chromium } = require('@playwright/test');

const ROUTE = '/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=diff-word-stress';
const SCROLLER = '[data-testid="doc-pane"] > div.overflow-y-auto';

const metrics = {};
const browser = await chromium.launch();
for (const theme of ['dark', 'light']) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 732 } });
  await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);
  await page.goto(`${BASE}${ROUTE}`);
  const pane = page.locator('[data-testid="doc-pane"]');
  await pane.locator('.diff-hunk-head').first().waitFor();
  const scroller = page.locator(SCROLLER);

  const m = await scroller.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  m.rowWidths = await page
    .locator(`${SCROLLER} [data-kind]`)
    .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
  m.hunkHeadWidth = Math.round(
    await page.locator('.diff-hunk-head').first().evaluate((e) => e.getBoundingClientRect().width),
  );
  m.fileRowWidth = Math.round(
    await page.locator('.doc-file-row').first().evaluate((e) => e.getBoundingClientRect().width),
  );
  m.wordSpanCounts = await page.locator('[data-word]').evaluateAll((els) =>
    els.map((e) => ({
      word: e.getAttribute('data-word'),
      kind: e.getAttribute('data-kind') ?? e.parentElement?.getAttribute('data-kind') ?? null,
      text: e.textContent?.slice(0, 40) ?? '',
    })),
  );
  metrics[theme] = m;

  await pane.screenshot({ path: join(OUT, `pane-left-${theme}-${TAG}.png`) });
  await scroller.evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
  await page.waitForTimeout(100);
  await pane.screenshot({ path: join(OUT, `pane-right-${theme}-${TAG}.png`) });
  await scroller.evaluate((el) => {
    el.scrollLeft = 0;
  });

  // Word-pair zoom: the one-word del/add pair in hunk 1.
  const delRow = page.locator('[data-kind="del"]', { hasText: 'timeoutMs = 3000' });
  const addRow = page.locator('[data-kind="add"]', { hasText: 'timeoutMs = 5000' });
  const dbox = await delRow.boundingBox();
  const abox = await addRow.boundingBox();
  const pbox = await pane.boundingBox();
  if (dbox && abox && pbox) {
    await page.screenshot({
      clip: {
        x: pbox.x,
        y: dbox.y,
        width: pbox.width,
        height: abox.y + abox.height - dbox.y,
      },
      path: join(OUT, `word-pair-${theme}-${TAG}.png`),
    });
  }

  // Full-file face, scrolled right.
  await page.getByRole('button', { name: '显示完整文件' }).click();
  await page.getByTestId('diff-full').waitFor();
  const fm = await scroller.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  fm.fullRowWidths = await page
    .getByTestId('diff-full')
    .locator('[data-kind]')
    .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
  metrics[`${theme}-full`] = fm;
  await scroller.evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
  await page.waitForTimeout(100);
  await pane.screenshot({ path: join(OUT, `full-right-${theme}-${TAG}.png`) });

  await page.close();
}
await browser.close();
writeFileSync(join(OUT, `metrics-${TAG}.json`), `${JSON.stringify(metrics, null, 2)}\n`);
console.log(`captured ${TAG} ->`, OUT);
