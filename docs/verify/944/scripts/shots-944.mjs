#!/usr/bin/env node

// #944 evidence: resources-domain surface screenshots, both themes, run
// identically against the before stack (origin/main fixture preview, old DOM
// carriers) and the after stack (branch fixture preview, new carriers).
// --dom old|new selects the click/locator carrier set; geometry and content
// are untouched by the flag — it only opens the same dialogs on both builds.
//
// Usage:
//   node docs/verify/944/scripts/shots-944.mjs --base http://127.0.0.1:8400 \
//     --dom new --out docs/verify/944/after
//
// Output: <out>/NN-<surface>-<theme>.png (1440×732, e2e 同口径).

import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const BASE = arg('base', 'http://127.0.0.1:8400');
const DOM = arg('dom', 'new');
const OUT = resolve(REPO, arg('out', 'docs/verify/944/after'));

const C = DOM === 'old'
  ? {
      newRow: (p) => p.locator('.res-new'),
      addMachine: (p) => p.locator('.res-add'),
      customEndpoint: (d) => d.locator('.dlg-provider-custom'),
      skillRowFirst: (p) => p.locator('.res-rowcard').first(),
      disclosure: (d) => d.locator('.dlg-enroll-toggle'),
    }
  : {
      newRow: (p) => p.getByRole('button', { name: '新建', exact: true }),
      addMachine: (p) => p.getByRole('button', { name: '添加机器' }),
      customEndpoint: (d) => d.getByRole('button', { name: '自定义端点' }),
      skillRowFirst: (p) => p.getByTestId('resource-row').first(),
      disclosure: (d) =>
        d.getByRole('button', { name: '在云服务器上运行？改用 API key 注册' }),
    };

const shot = async (page, name) => {
  await page.screenshot({ path: join(OUT, `${name}-${THEME}.png`) });
};

let THEME = 'light';

async function run(browser, theme) {
  THEME = theme;
  const page = await browser.newPage({ viewport: { width: 1440, height: 732 } });
  await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);

  // 01 skills rows (search + sort + row cards)
  await page.goto(`${BASE}/app/resources/skills?scenario=06`);
  await page.waitForLoadState('networkidle');
  await shot(page, '01-skills-rows');

  // 02 skills sort menu open
  await page.locator(DOM === 'old' ? '.res-sort' : 'button[aria-haspopup="menu"]').click();
  await page.waitForTimeout(300);
  await shot(page, '02-skills-sort-menu');
  await page.keyboard.press('Escape');

  // 03 skills empty state
  await page.goto(`${BASE}/app/resources/skills?scenario=01`);
  await page.waitForLoadState('networkidle');
  await shot(page, '03-skills-empty');

  // 04 skill dialog (create)
  await C.newRow(page).click();
  await page.waitForTimeout(350);
  await shot(page, '04-skill-dialog');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);

  // 05 machines rows (local marks + remote)
  await page.goto(`${BASE}/app/resources/machines?scenario=06`);
  await page.waitForLoadState('networkidle');
  await shot(page, '05-machines-rows');

  // 06 machines orchestration badges
  await page.goto(`${BASE}/app/resources/machines?scenario=machines-chief-state`);
  await page.waitForLoadState('networkidle');
  await shot(page, '06-machines-orchestration');

  // 07 machine dialog (disclosure open)
  await page.goto(`${BASE}/app/resources/machines?scenario=06`);
  await page.waitForLoadState('networkidle');
  await C.addMachine(page).click();
  await page.waitForTimeout(350);
  await C.disclosure(page.locator('.dlg')).click();
  await page.waitForTimeout(250);
  await shot(page, '07-machine-dialog');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);

  // 08 providers tabs + model rows (pi)
  await page.goto(`${BASE}/app/resources/providers?scenario=10`);
  await page.waitForLoadState('networkidle');
  await shot(page, '08-providers-pi');

  // 09 providers cc tab (slot tags)
  await page.goto(`${BASE}/app/resources/providers?scenario=10&runtime=claude-code`);
  await page.waitForLoadState('networkidle');
  await shot(page, '09-providers-cc');

  // 10 provider picker
  await page.goto(`${BASE}/app/resources/providers?scenario=01`);
  await page.waitForLoadState('networkidle');
  await C.newRow(page).click();
  await page.waitForTimeout(350);
  await shot(page, '10-provider-picker');

  // 11 provider key form (seg + fields)
  const dlg = page.locator('.dlg');
  await C.customEndpoint(dlg).click();
  await page.waitForTimeout(250);
  await shot(page, '11-provider-form');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);

  // 12 mcp rows
  await page.goto(`${BASE}/app/resources/mcp-servers?scenario=07`);
  await page.waitForLoadState('networkidle');
  await shot(page, '12-mcp-rows');

  // 13 secrets empty (hint row)
  await page.goto(`${BASE}/app/resources/secrets?scenario=01`);
  await page.waitForLoadState('networkidle');
  await shot(page, '13-secrets-empty');

  // 14 secret dialog
  await C.newRow(page).click();
  await page.waitForTimeout(350);
  await shot(page, '14-secret-dialog');

  await page.close();
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const theme of ['light', 'dark']) await run(browser, theme);
await browser.close();
console.log(`shots-944: wrote ${DOM}-dom screenshots for both themes → ${OUT}`);
