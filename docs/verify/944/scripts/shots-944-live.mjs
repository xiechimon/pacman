import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
const BASE = 'http://127.0.0.1:5274';
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const theme of ['light', 'dark']) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 732 } });
  await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);
  for (const [name, path] of [
    ['skills', '/app/resources/skills'],
    ['machines', '/app/resources/machines'],
    ['providers', '/app/resources/providers'],
    ['mcp', '/app/resources/mcp-servers'],
    ['secrets', '/app/resources/secrets'],
  ]) {
    await page.goto(`${BASE}${path}`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${OUT}/${name}-${theme}.png` });
  }
  await page.close();
}
await browser.close();
console.log('live shots done →', OUT);
