// Evidence capture for #626: the four model-selector faces must render
// pixel-identical before (origin/main) and after (core convergence branch).
// Run once per stack with BASE + OUT env vars. All non-loopback requests are
// aborted so dicebear avatars / remote fonts cannot enter the pixels.
import { chromium } from '@playwright/test';

const BASE = process.env.BASE;
const OUT = process.env.OUT;
if (BASE == null || OUT == null) throw new Error('BASE and OUT are required');

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 732 },
  colorScheme: 'dark',
});
await context.route('**/*', (route) => {
  const url = new URL(route.request().url());
  if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue();
  return route.abort();
});
const page = await context.newPage();

function union(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

async function clipShot(name, selectors) {
  let box = null;
  for (const sel of selectors) {
    const b = await page.locator(sel).boundingBox();
    if (b == null) throw new Error(`${name}: no bounding box for ${sel}`);
    box = box == null ? b : union(box, b);
  }
  const pad = 8;
  const x = Math.max(0, Math.round(box.x - pad));
  const y = Math.max(0, Math.round(box.y - pad));
  const clip = {
    x,
    y,
    width: Math.min(1440 - x, Math.round(box.width + 2 * pad)),
    height: Math.min(732 - y, Math.round(box.height + 2 * pad)),
  };
  await page.screenshot({ path: `${OUT}/${name}.png`, clip, animations: 'disabled' });
  console.log(`shot ${name} ${clip.width}x${clip.height} @${x},${y}`);
}

// A/B — agent create dialog: two-level cascade (runtime menu, then model menu)
await page.goto(`${BASE}/app/team?scenario=agent-detail`, { waitUntil: 'load' });
await page.locator('.team-create-agent').click();
await page.locator('.dlg-agent-runtime-select').waitFor({ state: 'visible' });
await page.locator('.dlg-agent-runtime-select').click();
await page.locator('.dlg-agent-runtime-menu').waitFor({ state: 'visible' });
await page.waitForTimeout(400);
await clipShot('a-create-runtime-menu', ['.dlg-agent-runtime-select', '.dlg-agent-runtime-menu']);
await page.locator('.dlg-agent-runtime-row', { hasText: 'r3-gw' }).click();
await page.locator('.dlg-agent-model-select').click();
await page.locator('.dlg-agent-model-menu').waitFor({ state: 'visible' });
await page.waitForTimeout(400);
await clipShot('b-create-model-menu', ['.dlg-agent-model-select', '.dlg-agent-model-menu']);

// C/D — agent detail overview: runtime + model slots
await page.goto(`${BASE}/app/resources/agents/r3-builder?scenario=agent-detail`, {
  waitUntil: 'load',
});
await page.locator('.agent-runtime-select').waitFor({ state: 'visible' });
await page.waitForTimeout(400);
await page.locator('.agent-runtime-select').click();
await page.locator('.agent-runtime-menu').waitFor({ state: 'visible' });
await page.waitForTimeout(400);
await clipShot('c-detail-runtime-menu', ['.agent-runtime-select', '.agent-runtime-menu']);
await page.keyboard.press('Escape');
await page.locator('.agent-runtime-menu').waitFor({ state: 'hidden' });
await page.locator('.agent-model-select').click();
await page.locator('.agent-model-menu').waitFor({ state: 'visible' });
await page.waitForTimeout(400);
await clipShot('d-detail-model-menu', ['.agent-model-select', '.agent-model-menu']);

// E — chief main-model dialog (r5 108 face)
await page.goto(`${BASE}/app?scenario=111`, { waitUntil: 'load' });
await page.locator('.chief-drawer').waitFor({ state: 'visible' });
await page.locator('.chief-model button[aria-haspopup="dialog"]').click();
await page.locator('.chief-model-pick').waitFor({ state: 'visible' });
await page.waitForTimeout(400);
await clipShot('e-chief-model-dialog', ['.dlg-title:visible', '.chief-model-pick']);

// F — chief settings compaction popover (#204 face)
await page.goto(`${BASE}/app?scenario=101`, { waitUntil: 'load' });
await page.locator('button.chief-select').waitFor({ state: 'visible' });
await page.waitForTimeout(400);
await page.locator('button.chief-select').click();
await page.locator('.chief-model-menu').waitFor({ state: 'visible' });
await page.waitForTimeout(400);
await clipShot('f-settings-compaction-menu', ['button.chief-select', '.chief-model-menu']);

// G/H — stale preset bare-string echo (101-stale-model)
await page.goto(`${BASE}/app?scenario=101-stale-model`, { waitUntil: 'load' });
await page.locator('button.chief-select').waitFor({ state: 'visible' });
await page.waitForTimeout(400);
await clipShot('g-stale-trigger', ['button.chief-select']);
await page.locator('button.chief-select').click();
await page.locator('.chief-model-menu').waitFor({ state: 'visible' });
await page.waitForTimeout(400);
await clipShot('h-stale-menu', ['button.chief-select', '.chief-model-menu']);

await browser.close();
console.log(`done ${OUT}`);
