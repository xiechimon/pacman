// #886 evidence probe: team page agent card vs create-agent slot, both themes.
// Measures the edge recipe of every card on the same screen (border /
// background / shadow / radius) plus WCAG contrast of the card edge against
// the canvas, and crops the grid so the two boundaries can be judged together.
//
//   usage: BASE=http://127.0.0.1:<fixture-preview-port> EVIDENCE_TAG=before|after \
//          node docs/verify/886/scripts/probe-team.mjs
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const REPO =
  process.env.VERIFY_REPO_ROOT ?? execSync('git rev-parse --show-toplevel').toString().trim();
const BASE = process.env.BASE ?? 'http://127.0.0.1:8412';
const tag = process.env.EVIDENCE_TAG ?? 'after';
const OUT = join(REPO, 'docs/verify/886', tag);
mkdirSync(OUT, { recursive: true });

// WCAG 2.x relative luminance + contrast ratio over sRGB 0..255 triplets.
function luminance([r, g, b]) {
  const f = (v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Number((((l1 + 0.05) / (l2 + 0.05)).toFixed(3)));
}
const parseRgb = (s) => (s ?? '').match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? null;

const browser = await chromium.launch();
const results = {};

for (const theme of ['dark', 'light']) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 732 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  });
  await context.addInitScript(
    (t) => localStorage.setItem('pacman-theme', t),
    theme,
  );
  const page = await context.newPage();
  await page.goto(`${BASE}/app/team?scenario=12`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.team-agent-card');
  await page.waitForTimeout(400);

  const measured = await page.evaluate(() => {
    const effBg = (el) => {
      let node = el;
      while (node != null && node !== document.documentElement) {
        const bg = getComputedStyle(node).backgroundColor;
        const m = bg?.match(/[\d.]+/g);
        if (m && Number(m[3] ?? 1) > 0) return bg;
        node = node.parentElement;
      }
      return getComputedStyle(document.body).backgroundColor;
    };
    const readCard = (el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        text: (el.textContent ?? '').trim().slice(0, 40),
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        borderTop: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
        background: cs.backgroundColor,
        boxShadow: cs.boxShadow,
        borderRadius: cs.borderRadius,
        canvasBehind: effBg(el.parentElement),
      };
    };
    return {
      agentCards: [...document.querySelectorAll('.team-agent-card')].map(readCard),
      createSlot: document.querySelector('.team-create-agent')
        ? readCard(document.querySelector('.team-create-agent'))
        : null,
    };
  });

  const canvas = parseRgb(measured.agentCards[0]?.canvasBehind);
  const enrich = (card) => {
    if (card == null) return null;
    // transparent fills carry no bg contrast of their own — only the edge counts
    const alpha = Number((card.background.match(/[\d.]+/g) ?? [])[3] ?? 1);
    const bg = alpha > 0 ? parseRgb(card.background) : null;
    const borderColor = parseRgb(card.borderTop.split(' ').slice(2).join(' ')) ??
      parseRgb(card.borderTop.match(/rgba?\([^)]+\)/)?.[0]);
    return {
      ...card,
      contrastBgVsCanvas: bg && canvas ? contrast(bg, canvas) : null,
      contrastBorderVsCanvas: borderColor && canvas ? contrast(borderColor, canvas) : null,
    };
  };

  results[theme] = {
    agentCards: measured.agentCards.map(enrich),
    createSlot: enrich(measured.createSlot),
  };

  await page.locator('.team-grid').screenshot({ path: join(OUT, `grid-${theme}.png`) });
  await page.locator('.team-agent-card').first().screenshot({ path: join(OUT, `card-agent-${theme}.png`) });
  if (measured.createSlot) {
    await page.locator('.team-create-agent').screenshot({ path: join(OUT, `card-create-${theme}.png`) });
  }
  await context.close();
}

await browser.close();
writeFileSync(join(OUT, `result-${tag}.json`), `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));
console.log('evidence ->', OUT);
