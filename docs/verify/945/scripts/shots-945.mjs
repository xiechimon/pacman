#!/usr/bin/env node

// #945 evidence: detail-domain surface screenshots, both themes, run
// identically against the before stack (origin/main fixture preview, per-face
// detail.css rules) and the after stack (branch fixture preview, utility
// carriers). Class handles stay valid on both builds — the migration keeps
// every class name in the DOM as an inert alias (#942 §5.0 残留律), so one
// locator set serves both runs.
//
// Usage:
//   node docs/verify/945/scripts/shots-945.mjs --base http://127.0.0.1:8402 \
//     --out docs/verify/945/before
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
const BASE = arg('base', 'http://127.0.0.1:8402');
const OUT = resolve(REPO, arg('out', 'docs/verify/945/before'));

const DETAIL = '/app/todo/7ve0iOkQ-JBpSL98zSiGc';

let THEME = 'light';

const shot = async (page, name) => {
  await page.screenshot({ path: join(OUT, `${name}-${THEME}.png`) });
};

const goto = async (page, url) => {
  await page.goto(`${BASE}${url}`);
  await page.waitForLoadState('networkidle');
};

async function run(browser, theme) {
  THEME = theme;
  const page = await browser.newPage({ viewport: { width: 1440, height: 732 } });
  await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);

  // 01 review-phase 3-pane shell (head chip + doc pane + composer card)
  await goto(page, `${DETAIL}?scenario=17b`);
  await shot(page, '01-detail-3pane');

  // 02 chat column with the frozen transcript (done phase, notes + bubbles)
  await goto(page, `${DETAIL}?scenario=36`);
  await shot(page, '02-transcript-done');

  // 03 tool group expanded (pills + outputs + 收起)
  await goto(page, `${DETAIL}?scenario=28`);
  await shot(page, '03-tools-expanded');

  // 04 block-markdown reply face (heads / lists / fences / tool output)
  await goto(page, `${DETAIL}?scenario=md-toolout`);
  await shot(page, '04-chat-md');

  // 05 streaming row + stop button (building phase)
  await goto(page, `${DETAIL}?scenario=26`);
  await shot(page, '05-composer-streaming');

  // 06 fresh phase brief (title + tags + meta + primary action)
  await goto(page, '/app/todo/fresh-probe?scenario=23');
  await shot(page, '06-fresh-block');

  // 07 changes diff surface (file rows + hunks + expand toggle)
  await goto(page, `${DETAIL}?scenario=27b`);
  await shot(page, '07-diff-changes');

  // 08 plan-version diff surface (range chip + stats)
  await goto(page, '/app/todo/r8-15?scenario=66');
  await shot(page, '08-plan-diff');
  // 09 version menu open over the range chip
  await page.locator('.doc-range-chip').first().click();
  await page.waitForTimeout(200);
  await shot(page, '09-version-menu');

  // 10 right-pane static sections (token / branch / history)
  await goto(page, `${DETAIL}?scenario=30`);
  await shot(page, '10-pane-token');
  await goto(page, `${DETAIL}?scenario=31`);
  await shot(page, '11-pane-branch');
  await goto(page, `${DETAIL}?scenario=32`);
  await shot(page, '12-pane-history');

  // 13 head chip popover open (scenario-frozen)
  await goto(page, `${DETAIL}?scenario=27`);
  await page.locator('.detail-chip').click();
  await page.waitForTimeout(250);
  await shot(page, '13-chip-popover');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // 14 user menu open above the sidebar avatar chip
  await page.locator('.sidebar-user').click();
  await page.waitForTimeout(250);
  await shot(page, '14-user-menu');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // 15 chief FAB with the unread badge + docked panel narrowing
  await goto(page, `${DETAIL}?scenario=detail-unread`);
  await shot(page, '15-detail-fab');

  // 16 branch dialog off the board card (seg control + sync fields)
  await goto(page, '/app?scenario=01');
  await page.locator('.todo-card-branch').first().click();
  await page.waitForTimeout(350);
  await shot(page, '16-branch-dialog');

  await page.close();
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const theme of ['light', 'dark']) await run(browser, theme);
await browser.close();
console.log(`shots-945: wrote screenshots for both themes → ${OUT}`);
