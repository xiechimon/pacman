// PROTOTYPE taste cross-check (#909): capture the reference product's
// (todos.dev) computed design tokens with a real browser, so the three
// candidate directions can be positioned against the live reference taste.
// Anonymous session — if a login wall appears, exit 2 and fall back to the
// in-repo live captures (tokens.css comments, 2026-10-02/03).

import { createRequire } from 'node:module';
const require = createRequire('/Users/xmon/.herdr/worktrees/pacman/ui-909-visual-direction/apps/web/package.json');
const { chromium } = require('@playwright/test');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('https://todos.dev', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(4000);

const url = page.url();
if (/login|signin|auth/i.test(url)) {
  console.log('LOGIN_WALL ' + url);
  await browser.close();
  process.exit(2);
}

const tokens = await page.evaluate(() => {
  const cs = (el) => (el ? getComputedStyle(el) : null);
  const body = cs(document.body);
  const pick = (el) => {
    const s = cs(el);
    return el
      ? {
          tag: el.tagName.toLowerCase(),
          cls: (el.className || '').toString().slice(0, 60),
          bg: s.backgroundColor,
          color: s.color,
          radius: s.borderRadius,
          shadow: s.boxShadow === 'none' ? 'none' : s.boxShadow.slice(0, 80),
          border: s.borderColor,
        }
      : null;
  };
  const cards = [...document.querySelectorAll('div,article,li')].filter((el) => {
    const s = cs(el);
    return s.boxShadow !== 'none' || (s.borderRadius !== '0px' && el.children.length > 1);
  });
  const radii = new Set();
  const shadows = new Set();
  for (const el of cards.slice(0, 40)) {
    const s = cs(el);
    radii.add(s.borderRadius);
    if (s.boxShadow !== 'none') shadows.add(s.boxShadow.slice(0, 60));
  }
  const buttons = [...document.querySelectorAll('button')].slice(0, 12).map(pick);
  return {
    url: location.href,
    title: document.title,
    body: { bg: body.backgroundColor, color: body.color, font: body.fontFamily.slice(0, 80) },
    radii: [...radii].slice(0, 10),
    shadows: [...shadows].slice(0, 8),
    buttons,
    cardSample: cards.slice(0, 4).map(pick),
  };
});

console.log(JSON.stringify(tokens, null, 1));
await page.screenshot({ path: '/tmp/t0909/reference-todos-dev.png' });
await browser.close();
