// P3 (#790) face review: computed geometry + screenshots of migrated faces.
// Usage: BASE=http://127.0.0.1:8404 OUT=/tmp/p3-faces node docs/verify/790/probe-faces.mjs
import { chromium } from '@playwright/test';

const BASE = process.env.BASE;
const OUT = process.env.OUT;
if (BASE == null || OUT == null) throw new Error('BASE and OUT are required');

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.route('**/*', (route) => {
  const url = new URL(route.request().url());
  if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue();
  return route.abort();
});

const geometry = async (selector) =>
  page.locator(selector).first().evaluate((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      borderTopWidth: cs.borderTopWidth,
      radius: cs.borderTopLeftRadius,
      paddingTop: cs.paddingTop,
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
    };
  });

// Detail page: more-menu + chip-popover + plan views live here.
await page.goto(`${BASE}/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=27`);
await page.waitForTimeout(800);

// more-menu (anchored pop archetype)
await page.locator('.detail-head-icon--more').click();
await page.locator('.more-menu').waitFor({ state: 'visible' });
await page.waitForTimeout(300);
console.log('more-menu', JSON.stringify(await geometry('.more-menu')));
await page.locator('.more-menu').screenshot({ path: `${OUT}/more-menu.png` });
await page.keyboard.press('Escape');

// chip-popover (static face, fixed 298x193)
await page.locator('.detail-chip').click();
await page.locator('.chip-popover').waitFor({ state: 'visible' });
await page.waitForTimeout(300);
console.log('chip-popover', JSON.stringify(await geometry('.chip-popover')));
await page.locator('.chip-popover').screenshot({ path: `${OUT}/chip-popover.png` });
await page.keyboard.press('Escape');

await context.close();
await browser.close();
console.log('done');
