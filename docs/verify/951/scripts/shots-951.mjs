#!/usr/bin/env node
// #951 evidence: detail-b 迁移面截图，双主题，同一脚本跑 before（origin/main
// per-face 规则栈）与 after（token utility 载体栈）两栈——同名文件逐对人审。
// 有意差只有一处：强制同步拨杆换代（手搓 28×16 → Switch 正典默认档 32×18.4，
// 票面注 + §2.5 冻结几何 / D2 授权）。
//
// Usage:
//   node docs/verify/951/scripts/shots-951.mjs --base http://127.0.0.1:8402 \
//     --out docs/verify/951/after

import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const BASE = arg('base', 'http://localhost:8402');
const OUT = resolve(REPO, arg('out', 'docs/verify/951/after'));
mkdirSync(OUT, { recursive: true });

const DETAIL = '/app/todo/7ve0iOkQ-JBpSL98zSiGc';

const browser = await chromium.launch();
for (const theme of ['dark', 'light']) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 732 } });
  await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);
  const shot = (name) => page.screenshot({ path: join(OUT, `${name}-${theme}.png`) });

  await page.goto(`${BASE}${DETAIL}?scenario=30`);
  await page.locator('[data-testid="detail-right"] .pane-section-body > div').first().waitFor({ state: 'visible' });
  await shot('01-token-section');

  await page.goto(`${BASE}${DETAIL}?scenario=31`);
  await page.locator('[data-testid="detail-right"] .pane-section-body > div').first().waitFor({ state: 'visible' });
  await shot('02-branch-section');

  await page.goto(`${BASE}${DETAIL}?scenario=32`);
  await page
    .locator('[data-testid="history-row"], .dlg-history-row')
    .first()
    .waitFor({ state: 'visible' });
  await shot('03-history-section');

  await page.goto(`${BASE}/app?scenario=34`);
  await page.locator('.dlg').waitFor({ state: 'visible' });
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)).catch(() => {}));
  await shot('04-accept-dialog');

  await page.goto(`${BASE}/app?scenario=01`);
  await page.locator('.todo-card-branch').first().waitFor({ state: 'visible' });
  await page.locator('.todo-card-branch').first().click();
  await page.locator('.dlg').waitFor({ state: 'visible' });
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)).catch(() => {}));
  await shot('05-branch-dialog-sync');
  await page.getByRole('tab', { name: 'Git' }).click();
  await page.waitForTimeout(250);
  await shot('06-branch-dialog-git');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  await page.goto(`${BASE}/app/team?scenario=12`);
  await page.getByRole('button', { name: '创建 Agent' }).first().click();
  await page.locator('.dlg').waitFor({ state: 'visible' });
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)).catch(() => {}));
  await shot('07-create-agent-warn');

  await page.close();
}
await browser.close();
console.log(`shots-951: wrote screenshots for both themes → ${OUT}`);
