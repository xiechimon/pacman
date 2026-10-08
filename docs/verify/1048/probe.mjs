// #1048 evidence probe: screenshots the token gate modal in zh + en, and
// (with --walkthrough <tokenEnvFile>) walks the guidance exactly as written:
// read PACMAN_TOKEN out of the env file the server was started from, enter it
// in the gate, and the gate must open into the board.
// Prereq: bash boot.sh token ; apps/web/dist built (vite build --mode fixture).
// Run from the repo root: node docs/verify/1048/probe.mjs <shot-prefix> [--walkthrough /tmp/t0250/token.env]
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../../apps/web/', import.meta.url));
const { chromium } = require('@playwright/test');

const [prefix, ...rest] = process.argv.slice(2);
const walkthroughIdx = rest.indexOf('--walkthrough');
const tokenEnvFile = walkthroughIdx >= 0 ? rest[walkthroughIdx + 1] : null;

const port = readFileSync('/tmp/t0250/port-token', 'utf8').trim();
const base = `http://127.0.0.1:${port}`;

const browser = await chromium.launch();
try {
  for (const locale of ['zh', 'en']) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 732 },
      colorScheme: 'dark',
    });
    await page.addInitScript((loc) => {
      localStorage.setItem('pacman.locale', loc);
      localStorage.setItem('pacman-locale', loc);
    }, locale);
    await page.goto(`${base}/app`);
    await page.waitForSelector('.token-gate', { timeout: 30_000 });
    await page.waitForTimeout(600);
    await page
      .locator('.token-gate')
      .screenshot({ path: `docs/verify/1048/${prefix}-gate-${locale}.png` });
    console.log(
      `[${locale}] gate text:`,
      JSON.stringify(await page.locator('.token-gate').innerText()),
    );

    if (tokenEnvFile !== null && locale === 'zh') {
      // Walk the guidance: the value lives in the env file the server was
      // started from; read it there (what the copy tells the deployer to do),
      // enter it, and the gate must open. The value itself is never printed.
      const KEY_PREFIX = 'PACMAN_TOKEN=';
      const envLine = readFileSync(tokenEnvFile, 'utf8')
        .split('\n')
        .find((l) => l.startsWith(KEY_PREFIX));
      if (envLine === undefined) {
        throw new Error(`no ${KEY_PREFIX} line in ${tokenEnvFile}`);
      }
      const token = envLine.slice(KEY_PREFIX.length).trim();
      console.log('[walkthrough] read PACMAN_TOKEN from', tokenEnvFile);
      await page.locator('.token-gate-input').fill(token);
      await page.locator('.token-gate-submit').click();
      await page.waitForSelector('.token-gate', { state: 'detached', timeout: 30_000 });
      await page.waitForSelector('.board-sidebar', { timeout: 30_000 });
      await page.waitForTimeout(800);
      await page.screenshot({ path: `docs/verify/1048/${prefix}-passed-zh.png` });
      console.log('[walkthrough] gate passed with the value read from the env file');
    }
    await page.close();
  }
} finally {
  await browser.close();
}
