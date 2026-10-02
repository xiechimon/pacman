import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const OUT = process.env.PROBE_OUT ?? '/tmp/t-0031-evidence/shots';
const FIXED = new Date('2026-10-02T09:00:00.000Z');

// t-0031 删除的选择器：任何面上都应零命中（元素都不存在，规则自然无渲染贡献）。
const REMOVED = [
  '.chat-done--solo',
  '.chat-done-label',
  '.chat-done',
  '.chat-done svg',
  '.overlay-actions--history',
  '.res-row-more',
  '.dlg-form-ghost',
  '.dlg-form-add',
];
// 活体对照：这些选择器必须继续有命中（证明审计不是「全零假象」，
// 且活腿/基类规则仍在生效）。
const CONTROLS = [
  '.overlay-actions',
  '.res-pill',
  '.res-row-chev',
  '.chief-dlg-ghost',
  '.dlg-provider-model-add',
];

async function prep(page: Page) {
  await page.clock.setFixedTime(FIXED);
  await page.route('**/*', (route) => {
    const host = new URL(route.request().url()).hostname;
    if (host === '127.0.0.1' || host === 'localhost') return route.continue();
    return route.abort();
  });
}

async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    for (const a of document.getAnimations()) {
      try {
        a.finish();
      } catch {
        /* 无限动画不可 finish；reducedMotion 已压制 */
      }
    }
  });
}

const audit: Record<string, Record<string, number>> = {};

async function shot(page: Page, name: string) {
  const counts: Record<string, number> = {};
  for (const sel of [...REMOVED, ...CONTROLS]) {
    counts[sel] = await page.evaluate((s) => document.querySelectorAll(s).length, sel);
  }
  audit[name] = counts;
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: `${OUT}/${name}.png` });
  await expect(page).toHaveScreenshot(`${name}.png`);
}

test.afterAll(() => {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/selector-audit.json`, JSON.stringify(audit, null, 2));
});

test('board', async ({ page }) => {
  await prep(page);
  await page.goto('/app?scenario=01');
  await settle(page);
  await shot(page, 'board');
});

test('detail transcript (chat-done 族所在面)', async ({ page }) => {
  await prep(page);
  await page.goto('/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=27');
  await settle(page);
  await shot(page, 'detail-transcript');
});

test('detail reuse overlay (overlay-actions 基类所在面)', async ({ page }) => {
  await prep(page);
  await page.goto('/app/todo/r8-15?scenario=75');
  await expect(page.locator('.overlay-title')).toBeVisible();
  await settle(page);
  await shot(page, 'detail-overlay-reuse');
});

test('resources providers list (res-row-more / res-pill~chev 所在面)', async ({ page }) => {
  await prep(page);
  await page.goto('/app/resources/providers?scenario=01');
  await expect(page.locator('.res-new')).toBeVisible();
  await settle(page);
  await shot(page, 'resources-providers');
});

test('resources providers model rows', async ({ page }) => {
  await prep(page);
  await page.goto('/app/resources/providers?scenario=10');
  await expect(page.locator('[data-route="/app/resources/providers"]')).toBeVisible();
  await settle(page);
  await shot(page, 'resources-providers-models');
});

test('resources mcp rows', async ({ page }) => {
  await prep(page);
  await page.goto('/app/resources/mcp-servers?scenario=07');
  await settle(page);
  await shot(page, 'resources-mcp');
});

test('resources machines rows', async ({ page }) => {
  await prep(page);
  await page.goto('/app/resources/machines?scenario=06');
  await settle(page);
  await shot(page, 'resources-machines');
});

test('resources skills rows (res-row-chev 保留规则所在面)', async ({ page }) => {
  await prep(page);
  await page.goto('/app/resources/skills?scenario=06');
  await expect(page.locator('.res-row-chev').first()).toBeVisible();
  await settle(page);
  await shot(page, 'resources-skills');
});

test('chief charter dialog (chief-dlg-ghost 活腿所在面)', async ({ page }) => {
  await prep(page);
  await page.goto('/app?scenario=102');
  await page.locator('.chief-edit-btn').click();
  await expect(page.locator('.dlg')).toBeVisible();
  await settle(page);
  await shot(page, 'chief-charter-dialog');
});

test('provider create dialog (dlg-provider-model-add 活腿所在面)', async ({ page }) => {
  await prep(page);
  await page.goto('/app/resources/providers?scenario=01');
  await page.locator('.res-new').click();
  await expect(page.locator('.dlg')).toBeVisible();
  await page.locator('.dlg-provider-custom').click();
  const addModel = page.locator('.dlg-provider-model-add');
  await addModel.click();
  await addModel.click();
  await expect(page.locator('[aria-label="模型 ID"]')).toHaveCount(2);
  await settle(page);
  await shot(page, 'provider-create-dialog');
});
