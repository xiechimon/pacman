// #706 evidence screenshots: board + failed todo detail (failure line + phase).
import { chromium } from '@playwright/test';

const WEB = 'http://127.0.0.1:5273';
const OUT = process.argv[2];
const todoA = process.argv[3];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 732 } });
await page.goto(`${WEB}/app`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/01-board-failed.png` });
await page.goto(`${WEB}/app/todo/${todoA}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/02-detail-failure-line.png` });
await browser.close();
console.log('screenshots ok');
