// #873 evidence run: one script, one viewport, run against two stacks (the
// origin/main worktree and this branch) so the before/after GIFs are the same
// actions at the same coordinates. Records video; the webm is converted to GIF
// afterwards.
//
//   usage: VERIFY_REPO_ROOT=<stack repo> EVIDENCE_TAG=before|after \
//          node evidence-873.mjs <todoId> <threadId?>
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const REPO =
  process.env.VERIFY_REPO_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const ports = JSON.parse(readFileSync(join(REPO, '.claude/verify-run', 'ports.json'), 'utf8'));
const WEB = `http://127.0.0.1:${ports.webPort}`;
const todoId = process.argv[2];
const tag = process.env.EVIDENCE_TAG ?? 'after';
const OUT = join(REPO, '.claude/verify-shots/873/video');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 732 },
  recordVideo: { dir: OUT, size: { width: 1440, height: 732 } },
});
const page = await context.newPage();
const video = page.video();

const settle = (ms) => page.waitForTimeout(ms);

await page.goto(`${WEB}/app/todo/${todoId}`, { waitUntil: 'networkidle' });
await page.waitForSelector('.chat-streaming', { timeout: 20000 });
await settle(600);

// --- 1. the live row's seconds, watched with nothing else happening ---
const seconds = [];
seconds.push(await page.locator('.chat-streaming-secs').first().textContent());
await settle(2500);
seconds.push(await page.locator('.chat-streaming-secs').first().textContent());
await settle(2500);
seconds.push(await page.locator('.chat-streaming-secs').first().textContent());
await settle(1500);
console.log('seconds @0s/2s/5s:', seconds.join(' → '));

// --- 2. the row-tail control, clicked for real ---
const liveRow = page.locator('.chat-streaming').first();
await liveRow.scrollIntoViewIfNeeded();
await settle(400);
const box = await liveRow.boundingBox();
const tail = { x: Math.round(box.x + box.width - 60), y: Math.round(box.y + box.height / 2) };
await page.mouse.move(tail.x, tail.y, { steps: 12 });
await settle(500);
await page.mouse.click(tail.x, tail.y);
await settle(1600);
const panelsOpen = await page.locator('.chat-live-panel, .chief-turn-tools').count();
console.log('panels after click:', panelsOpen);
await page.mouse.click(tail.x, tail.y);
await settle(900);

// --- 3. the reader's own send while scrolled back ---
const view = () =>
  page.evaluate(() => {
    const col = document.querySelector('.chat-col');
    const r = col.getBoundingClientRect();
    const rows = Array.from(col.querySelectorAll('.chat-row, .chat-streaming'));
    const last = rows[rows.length - 1];
    const lb = last?.getBoundingClientRect();
    return {
      scrollTop: Math.round(col.scrollTop),
      newestVisible: lb != null && lb.bottom <= r.bottom + 2,
    };
  });
await page.evaluate(() => {
  const col = document.querySelector('.chat-col');
  if (col != null) col.scrollTop = -1e6;
});
await settle(900);
const beforeSend = await view();
await page.click('.composer-input');
await page.keyboard.type('发一条，看看会不会自己落到最新。');
await settle(700);
await page.click('.composer-send');
await settle(2600);
const afterSend = await view();
console.log('own send:', JSON.stringify({ beforeSend, afterSend }));

writeFileSync(
  join(OUT, `result-${tag}.json`),
  `${JSON.stringify(
    { tag, secondsSampled: seconds, disclosurePanelsAfterClick: panelsOpen, beforeSend, afterSend },
    null,
    2,
  )}\n`,
);

await context.close();
await browser.close();

const produced = await video.path();
const target = join(OUT, `${tag}.webm`);
renameSync(produced, target);
console.log('video:', target);