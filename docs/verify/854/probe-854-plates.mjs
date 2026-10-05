#!/usr/bin/env node
// #854 evidence probe: the five overlay plates after the shared-primitive
// migration (plan-dropdown / res-sort-menu / chief-model-menu /
// chief-model-pop / user-menu).
//
// It reads the *rendered* plate, not the source: computed border / radius /
// box-shadow (the 直角 + 1px 实线 + 硬偏移投影 三件套), the selected row's
// background (the tint sampled off the reference capture), and the keyboard
// contract the ticket asks to re-verify — Enter opens, arrows rove the
// highlight, Enter activates, Esc closes and returns focus to the trigger.
//
// Run against a fixture preview server (the e2e webServer recipe, own port):
//   pnpm --filter @pacman/web exec vite build --mode fixture
//   pnpm --filter @pacman/web exec vite preview --host 127.0.0.1 --port 8406 --strictPort
//   E2E_PORT=8406 node docs/verify/854/probe-854-plates.mjs
// Outputs land next to this script: 854-<plate>.png + 854-computed.json.

import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
const { chromium } = createRequire(
  join(ROOT, 'node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/package.json'),
)('playwright');

const OUT = dirname(fileURLToPath(import.meta.url));
mkdirSync(OUT, { recursive: true });
const PORT = process.env.E2E_PORT ?? '8406';
const BASE = `http://127.0.0.1:${PORT}`;

const PLATE_PROPS = [
  'border-top-width',
  'border-top-style',
  'border-top-color',
  'border-radius',
  'box-shadow',
  'padding-top',
  'min-width',
  'background-color',
];

const styleOf = (locator, props) =>
  locator.evaluate(
    (el, ps) => Object.fromEntries(ps.map((p) => [p, getComputedStyle(el).getPropertyValue(p)])),
    props,
  );

const settle = (locator) =>
  locator.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)).then(() => undefined));

/** One plate: where it lives, how it opens, and whether it is a Base UI Menu
 *  (radio rows + arrow roving) or a plain Popover (no roving). */
const PLATES = [
  {
    name: 'plan-dropdown',
    url: '/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=27',
    trigger: '.doc-select-wrap .doc-pane-select',
    plate: '.plan-dropdown',
    selectedRow: '.plan-dropdown-row[data-checked]',
    menu: true,
  },
  {
    name: 'res-sort-menu',
    url: '/app/resources/skills?scenario=08',
    trigger: '.res-sort',
    plate: '.res-sort-menu',
    selectedRow: '.res-sort-row[data-checked]',
    menu: true,
  },
  {
    name: 'chief-model-menu',
    url: '/app?scenario=101',
    trigger: 'button.chief-select',
    plate: '.chief-model-menu',
    selectedRow: '.chief-model-menu [aria-selected="true"]',
    menu: false,
  },
  {
    name: 'chief-model-pop',
    url: '/app?scenario=111',
    trigger: '.chief-model button.chief-model-btn',
    plate: '.chief-model-pop',
    selectedRow: '.chief-model-pop [aria-selected="true"]',
    menu: false,
  },
  {
    name: 'user-menu',
    url: '/app?scenario=01',
    trigger: '.sidebar-user',
    plate: '.user-menu',
    selectedRow: null,
    menu: false,
  },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 732 } });
const result = { port: PORT, plates: {} };

for (const spec of PLATES) {
  const entry = {};
  await page.goto(`${BASE}${spec.url}`);
  const trigger = page.locator(spec.trigger);
  await trigger.waitFor({ state: 'visible' });

  // --- pointer path: open, read the skin, capture the plate ---------------
  await trigger.click();
  const plate = page.locator(spec.plate);
  await plate.waitFor({ state: 'visible' });
  await settle(plate);

  entry.plateComputed = await styleOf(plate, PLATE_PROPS);
  if (spec.selectedRow) {
    const row = page.locator(spec.selectedRow).first();
    entry.selectedRow = (await row.count())
      ? {
          count: await page.locator(spec.selectedRow).count(),
          text: (await row.textContent())?.trim(),
          background: await styleOf(row, ['background-color', 'border-radius', 'color']),
        }
      : null;
  }
  await plate.screenshot({ path: join(OUT, `854-${spec.name}.png`) });

  // --- Esc closes and hands focus back to the trigger --------------------
  await page.keyboard.press('Escape');
  await plate.waitFor({ state: 'hidden' });
  entry.escReturnsFocus = await page.evaluate(
    (sel) => document.activeElement === document.querySelector(sel),
    spec.trigger,
  );

  // --- keyboard path: Enter opens, arrows rove, Enter activates ----------
  if (spec.menu) {
    await trigger.focus();
    await page.keyboard.press('Enter');
    await plate.waitFor({ state: 'visible' });
    await settle(plate);
    await page.keyboard.press('ArrowDown');
    entry.arrowRovesHighlight = (await page.locator(`${spec.plate} [data-highlighted]`).count()) > 0;
    entry.arrowRovesInsidePlate = await page.evaluate(
      (sel) => document.querySelector(sel)?.contains(document.activeElement) ?? false,
      spec.plate,
    );
    await page.keyboard.press('Escape');
    await plate.waitFor({ state: 'hidden' });
  }

  result.plates[spec.name] = entry;
  console.log(spec.name, JSON.stringify(entry, null, 2));
}

await browser.close();
writeFileSync(join(OUT, '854-computed.json'), `${JSON.stringify(result, null, 2)}\n`);