// t-0070 evidence probe (gh picker rows): keyboard contract for the
// hand-rolled prj-new-gh-row list, same script on both trees.
// usage: node t0070-ghprobe.mjs <baseURL> <outFile>
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const [base, outFile] = process.argv.slice(2);
const PICKER = '/app/project/new?scenario=github-picker';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  baseURL: base,
  viewport: { width: 1440, height: 732 },
  colorScheme: 'dark',
});
const page = await ctx.newPage();
const k = {};

const activeInfo = () =>
  page.evaluate(() => {
    const el = document.activeElement;
    return {
      tag: el?.tagName,
      role: el?.getAttribute('role'),
      cls: typeof el?.className === 'string' ? el.className.slice(0, 60) : '',
      text: (el?.textContent ?? '').trim().slice(0, 28),
    };
  });

await page.goto(PICKER);
await page.waitForLoadState('networkidle');

// the github-picker fixture is pre-connected: open repo-kind menu, pick
// GitHub 仓库, and the trigger face is ready
await page.locator('#prj-new-repo').click();
await page.locator('.prj-new-repo-menu-row', { hasText: 'GitHub 仓库' }).click();
await page.waitForSelector('.prj-new-repo-menu', { state: 'hidden' });

// open the picker from its trigger
await page.locator('#prj-new-repo').focus();
k.triggerBefore = await page.evaluate(() => {
  const el = document.getElementById('prj-new-repo');
  return {
    haspopup: el?.getAttribute('aria-haspopup'),
    expanded: el?.getAttribute('aria-expanded'),
  };
});
await page.keyboard.press('Enter');
await page.waitForSelector('.prj-new-gh-picker', { state: 'visible' });
k.rows = await page.locator('.prj-new-gh-row').count();
await page.waitForTimeout(400); // let any focus delivery land
k.focusAfterOpen = await activeInfo();

// arrow navigation
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(100);
k.afterArrowDown = await activeInfo();
await page.keyboard.press('ArrowUp');
await page.keyboard.press('ArrowUp');
await page.waitForTimeout(100);
k.afterArrowUpWrap = await activeInfo();

// typeahead (>500ms apart: single-char buffer each)
await page.keyboard.press('x');
await page.waitForTimeout(100);
k.typeaheadX = await activeInfo();
await page.waitForTimeout(550);
await page.keyboard.press('o');
await page.waitForTimeout(100);
k.typeaheadO = await activeInfo();

// Esc close + focus return
await page.keyboard.press('Escape');
await page.waitForSelector('.prj-new-gh-picker', { state: 'hidden' });
await page.waitForTimeout(400);
k.escClosed = true;
k.focusAfterEsc = await activeInfo();

// reopen, Enter on a row: activate + close + focus return + backfill
await page.keyboard.press('Enter');
await page.waitForSelector('.prj-new-gh-picker', { state: 'visible' });
await page.waitForTimeout(400);
k.focusAfterReopen = await activeInfo();
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(100);
const target = await activeInfo();
k.rowBeforeEnter = target;
await page.keyboard.press('Enter');
await page.waitForSelector('.prj-new-gh-picker', { state: 'hidden' });
await page.waitForTimeout(400);
k.enterClosed = true;
k.focusAfterActivate = await activeInfo();
k.triggerBackfill = await page.evaluate(
  () => (document.getElementById('prj-new-repo')?.textContent ?? '').trim().slice(0, 40),
);

writeFileSync(outFile, JSON.stringify(k, null, 2));
console.log(JSON.stringify(k, null, 2));
await browser.close();
