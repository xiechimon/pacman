// #1036 inert-alias geometry probe: measure the picked-alias sites on a
// fixture build and dump boxes + computed styles + screenshots. Run once per
// stack (before = origin/main dist, after = branch dist); the two JSON dumps
// must agree on every geometry/style field — the aliases carried zero rules,
// so picking them must be a rendering no-op. The className fields are
// expected to DIFFER (that is the change under test) and are recorded as the
// DOM-level proof that the alias is gone.
//
// usage: node probe-geometry.mjs <baseURL> <outDir>
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const require = createRequire(
  join(process.env.PACMAN_REPO_ROOT ?? resolve(import.meta.dirname, '../../../..'), 'apps/web/package.json'),
);
const { chromium } = require('@playwright/test');

const [baseURL, outDirRaw] = process.argv.slice(2);
if (!baseURL || !outDirRaw) {
  console.error('usage: node probe-geometry.mjs <baseURL> <outDir>');
  process.exit(2);
}
const outDir = resolve(outDirRaw);
mkdirSync(outDir, { recursive: true });

const BOARD = '/app?scenario=board-tags';
const AUTHORIZE = '/app/machines/authorize';

const box = async (loc) => {
  const b = await loc.boundingBox();
  return b ? { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) } : null;
};
const styles = async (loc, props) =>
  loc.evaluate((el, ps) => {
    const cs = getComputedStyle(el);
    return Object.fromEntries(ps.map((p) => [p, cs.getPropertyValue(p)]));
  }, props);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 732 }, colorScheme: 'dark' });
const result = { baseURL, userAgentNote: 'chromium headless, dark scheme, 1440x732' };

// --- site A: machine authorize page (authorize-card/-title/-desc/-submit picked)
await page.goto(baseURL + AUTHORIZE);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
{
  const card = page.locator('[role=region][aria-label="授权机器"]');
  const title = card.locator('h1');
  const desc = card.locator('p').first();
  const submit = card.getByRole('button', { name: '生成授权链接' });
  result.authorize = {
    card: {
      box: await box(card),
      className: await card.getAttribute('class'),
      styles: await styles(card, ['width', 'padding', 'gap', 'border-radius', 'background-color']),
    },
    title: { box: await box(title), className: await title.getAttribute('class'), styles: await styles(title, ['font-size', 'font-weight', 'color']) },
    desc: { box: await box(desc), className: await desc.getAttribute('class'), styles: await styles(desc, ['font-size', 'line-height', 'color']) },
    submit: { box: await box(submit), className: await submit.getAttribute('class'), styles: await styles(submit, ['height', 'width', 'background-color', 'color']) },
  };
  await page.screenshot({ path: join(outDir, 'authorize.png') });
}

// --- site B: board page (board-column-header/-label/-list/-count/-dot picked)
await page.goto(baseURL + BOARD);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
{
  const scroller = page.locator('[data-testid=board-scroller]');
  const col1 = scroller.locator('section').first();
  const head = col1.locator('> div').first();
  const firstCard = col1.locator('section, [draggable=true], li, > div:nth-child(2) > *').first();
  result.board = {
    scroller: { box: await box(scroller), className: await scroller.getAttribute('class') },
    column1: { box: await box(col1), className: await col1.getAttribute('class') },
    column1Head: {
      box: await box(head),
      className: await head.getAttribute('class'),
      styles: await styles(head, ['height', 'padding', 'font-size', 'color']),
    },
    column1HeadChildren: await head.locator('> *').evaluateAll((els) =>
      els.map((el) => ({
        tag: el.tagName,
        className: el.getAttribute('class'),
        text: (el.textContent ?? '').trim().slice(0, 24),
        rect: (({ x, y, width, height }) => ({
          x: +x.toFixed(1),
          y: +y.toFixed(1),
          w: +width.toFixed(1),
          h: +height.toFixed(1),
        }))(el.getBoundingClientRect()),
      })),
    ),
    firstCard: { box: await box(firstCard), className: await firstCard.getAttribute('class') },
  };
  await page.screenshot({ path: join(outDir, 'board.png') });
}

await browser.close();
writeFileSync(join(outDir, 'measurements.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log('wrote', join(outDir, 'measurements.json'));
