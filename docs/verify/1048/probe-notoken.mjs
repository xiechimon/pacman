// #1048 AC3 probe: with PACMAN_TOKEN unset the behavior must be exactly as
// before the change — API answers 200 without credentials and the gate never
// renders. Prereq: bash boot.sh notoken ; apps/web/dist built.
// Run from the repo root: node docs/verify/1048/probe-notoken.mjs
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../../apps/web/', import.meta.url));
const { chromium } = require('@playwright/test');

const port = readFileSync('/tmp/t0250/port-notoken', 'utf8').trim();
const base = `http://127.0.0.1:${port}`;
const api = await fetch(`${base}/api/teams`);
console.log('api /api/teams status (expect 200, auth off):', api.status);
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 732 },
  colorScheme: 'dark',
});
await page.goto(`${base}/app`);
await page.waitForSelector('.board-sidebar', { timeout: 30_000 });
const gateCount = await page.locator('.token-gate').count();
console.log('token-gate count (expect 0):', gateCount);
await page.screenshot({ path: 'docs/verify/1048/after-notoken-no-gate.png' });
await browser.close();
