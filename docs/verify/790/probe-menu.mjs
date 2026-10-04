// Evidence capture for #790 P3: the more-menu enter on a fixture stack.
// Run once per stack with BASE + TAG env vars:
//   BASE=http://127.0.0.1:8403 TAG=before node docs/verify/790/probe-menu.mjs
// Output: /tmp/p3-gif/<tag>.webm (full-page video from navigation).
// All non-loopback requests are aborted so dicebear avatars / remote fonts
// cannot enter the pixels (626 precedent). The click lands after a 1.2s
// settle; cut the enter window with ffmpeg (see README).
import { chromium } from '@playwright/test';
import { renameSync } from 'node:fs';

const BASE = process.env.BASE;
const TAG = process.env.TAG;
if (BASE == null || TAG == null) throw new Error('BASE and TAG are required');

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: '/tmp/p3-gif', size: { width: 720, height: 450 } },
});
const page = await context.newPage();
await page.route('**/*', (route) => {
  const url = new URL(route.request().url());
  if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue();
  return route.abort();
});
await page.goto(`${BASE}/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=27`);
await page.locator('.detail-head-icon--more').waitFor({ state: 'visible' });
// Settle first so the clip's motion is the menu enter, not page load.
await page.waitForTimeout(1200);
await page.locator('.detail-head-icon--more').click();
await page.locator('.more-menu').waitFor({ state: 'visible' });
await page.waitForTimeout(1500);
const videoPath = await page.video().path();
await context.close();
await browser.close();

renameSync(videoPath, `/tmp/p3-gif/${TAG}.webm`);
console.log(`saved /tmp/p3-gif/${TAG}.webm`);
