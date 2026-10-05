// #885 evidence probe (item 1): the live row's hit target on the real live
// stack (the disclosure button form only renders in live mode — fixtures pass
// liveStep null). Seed via docs/verify/873/scripts/seed-long.mjs first.
//
// Measures, on one run:
//   - the hit box (border-box rect) of button.chat-streaming
//   - the computed content height (the spinner-live.spec L3 fence value)
//   - the label ink position (must not move between runs)
//   - the y of every .chat-row (layout below the row must not shift)
//   - a functional edge click 1px above the label ink's old hit boundary:
//     point = label top - 3px. With a 20px hit box the label sits 2px below
//     the box top, so the point misses (0 panels). With the 24px box the
//     label sits 4px below the top, so the point lands inside (1 panel).
//
//   usage: VERIFY_REPO_ROOT=<stack repo> EVIDENCE_TAG=before|after \
//          node docs/verify/885/scripts/probe-live-row.mjs <todoId>
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const REPO =
  process.env.VERIFY_REPO_ROOT ?? execSync('git rev-parse --show-toplevel').toString().trim();
const RUN_DIR = process.env.VERIFY_RUN_DIR ?? join(REPO, '.claude/verify-run');
const ports = existsSync(join(RUN_DIR, 'ports.json'))
  ? JSON.parse(readFileSync(join(RUN_DIR, 'ports.json'), 'utf8'))
  : {};
const WEB = `http://127.0.0.1:${ports.webPort ?? process.env.VERIFY_WEB_PORT ?? 5273}`;
const todoId = process.argv[2];
if (!todoId) throw new Error('usage: probe-live-row.mjs <todoId>');
const tag = process.env.EVIDENCE_TAG ?? 'after';
const OUT = join(REPO, 'docs/verify/885', tag);
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 732 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
await page.goto(`${WEB}/app/todo/${todoId}`, { waitUntil: 'networkidle' });
await page.waitForSelector('button.chat-streaming', { timeout: 20000 });
await page.waitForTimeout(500);

const row = page.locator('.chat-row--agent').filter({ has: page.locator('button.chat-streaming') }).first();
await row.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);

const geometry = await page.evaluate(() => {
  const btn = document.querySelector('button.chat-streaming');
  const label = btn.querySelector('.chat-streaming-label');
  const cs = getComputedStyle(btn);
  const br = btn.getBoundingClientRect();
  const lr = label.getBoundingClientRect();
  const rows = [...document.querySelectorAll('.chat-col .chat-row')].map((el) =>
    Math.round(el.getBoundingClientRect().y),
  );
  return {
    hitBox: {
      x: Math.round(br.x),
      y: Number(br.y.toFixed(1)),
      w: Math.round(br.width),
      h: Number(br.height.toFixed(1)),
    },
    computedHeight: cs.height, // content box — the L3 fence value
    padding: cs.padding,
    margin: cs.margin,
    labelInkTop: Number(lr.y.toFixed(1)),
    labelInsetFromBoxTop: Number((lr.y - br.y).toFixed(1)),
    chatRowTops: rows,
    ariaExpanded: btn.getAttribute('aria-expanded'),
  };
});

// functional edge click at ONE ink-anchored point across both runs (the ink
// never moves — that is the whole point of the fix): y = inkTop - 0.5.
// Before: the 20px box top sits at inkTop + 0.5, so the point is 1px ABOVE
// the target — row gap owns it, nothing toggles. After: the 24px box top
// sits at inkTop - 1.5, so the same absolute point is 1px INSIDE the target
// — the disclosure opens. elementFromPoint records who owns the pixel.
const panels0 = await page.locator('.chat-live-panel').count();
const edgeY = geometry.labelInkTop - 0.5;
const centerX = geometry.hitBox.x + geometry.hitBox.w / 2;
const ownerAtPoint = await page.evaluate(
  ([x, y]) => {
    const el = document.elementFromPoint(x, y);
    return el ? `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join('.')}` : null;
  },
  [centerX, edgeY],
);
await page.mouse.click(centerX, edgeY);
await page.waitForTimeout(400);
const panelsAfterEdgeClick = await page.locator('.chat-live-panel').count();
// leave as found for repeatability
if (panelsAfterEdgeClick > panels0) {
  await page.mouse.click(centerX, edgeY);
  await page.waitForTimeout(300);
}

await row.screenshot({ path: join(OUT, `live-row-${tag}.png`) });
await page
  .locator('button.chat-streaming')
  .screenshot({ path: join(OUT, `live-row-hitbox-${tag}.png`) });

const result = {
  tag,
  todoId,
  ...geometry,
  edgeClick: { x: Math.round(centerX), y: Number(edgeY.toFixed(1)), elementAtPoint: ownerAtPoint },
  panelsBeforeClick: panels0,
  panelsAfterEdgeClick,
};
writeFileSync(join(OUT, `live-row-${tag}.json`), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
console.log('evidence ->', OUT);
await context.close();
await browser.close();
