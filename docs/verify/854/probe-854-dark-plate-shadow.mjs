#!/usr/bin/env node
// #854 dark-theme plate-shadow evidence.
//
// User ruling 2026-10-05: the plate shadow follows spec §2.7 — the dark theme
// carries NO shadow and lets the 1px line hold the plate ("暗：无投影，线框
// 承重", i.e. the Base UI hero's own dark branch). The hard offset value stays
// on the light side only.
//
// This probe opens the five plates in the DARK theme and records the rendered
// box-shadow. PHASE=before|after names the output, so the same command pair
// produces the two halves of the comparison:
//   PHASE=before E2E_PORT=8406 node docs/verify/854/probe-854-dark-plate-shadow.mjs
//
// Run against a fixture preview server (same recipe as probe-854-plates.mjs).

import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
const { chromium } = createRequire(
  join(ROOT, 'node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/package.json'),
)('playwright');

const OUT = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.E2E_PORT ?? '8406';
const BASE = `http://127.0.0.1:${PORT}`;
const PHASE = process.env.PHASE ?? 'after';

/** Same five plates as probe-854-plates.mjs, in the order the PR body lists. */
const PLATES = [
  {
    name: 'plan-dropdown',
    url: '/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=27',
    trigger: '.doc-select-wrap .doc-pane-select',
    plate: '.plan-dropdown',
  },
  {
    name: 'res-sort-menu',
    url: '/app/resources/skills?scenario=08',
    trigger: '.res-sort',
    plate: '.res-sort-menu',
  },
  {
    name: 'chief-model-menu',
    url: '/app?scenario=101',
    trigger: 'button.chief-select',
    plate: '.chief-model-menu',
  },
  {
    name: 'chief-model-pop',
    url: '/app?scenario=111',
    trigger: '.chief-model button.chief-model-btn',
    plate: '.chief-model-pop',
  },
  {
    name: 'user-menu',
    url: '/app?scenario=01',
    trigger: '.sidebar-user',
    plate: '.user-menu',
  },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 732 } });
// The stored theme is the app's own switch (theme.ts `pacman-theme`); pin it
// before every navigation so each plate boots dark.
await page.addInitScript(() => localStorage.setItem('pacman-theme', 'dark'));

const result = { phase: PHASE, theme: 'dark', port: PORT, plates: {} };
for (const spec of PLATES) {
  await page.goto(`${BASE}${spec.url}`);
  const trigger = page.locator(spec.trigger);
  await trigger.waitFor({ state: 'visible' });
  await trigger.click();
  const plate = page.locator(spec.plate);
  await plate.waitFor({ state: 'visible' });
  await plate.evaluate((el) =>
    Promise.all(
      (el.closest('[data-slot="popover-content"], [data-slot="dropdown-menu-content"]') ?? el)
        .getAnimations({ subtree: true })
        .map((a) => a.finished),
    ),
  );
  result.plates[spec.name] = await plate.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      boxShadow: cs.boxShadow,
      border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
      borderRadius: cs.borderTopLeftRadius,
      background: cs.backgroundColor,
      colorScheme: document.documentElement.classList.contains('light') ? 'light' : 'dark',
    };
  });
  await plate.screenshot({ path: join(OUT, `854-dark-${spec.name}-${PHASE}.png`) });
  await page.keyboard.press('Escape');
  await plate.waitFor({ state: 'hidden' });
}

await browser.close();

const jsonPath = join(OUT, '854-dark-plate-shadow.json');
let merged = {};
try {
  merged = JSON.parse(readFileSync(jsonPath, 'utf8'));
} catch {
  merged = {};
}
merged[PHASE] = result;
writeFileSync(jsonPath, `${JSON.stringify(merged, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));