// XMON-40 复查取证：菜单「上端」的局部截图（待验分支 vs 改动前对照）。
//   node integration/verify/xmon-40-top-end-shots.mjs

import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const ports = JSON.parse(readFileSync(join(ROOT, '.claude/verify-run/ports.json'), 'utf8'));
const WEB = `http://127.0.0.1:${process.env.VERIFY_WEB_PORT ?? ports.webPort}`;
const OUT = process.env.VERIFY_EVIDENCE_DIR ?? join(ROOT, '.claude/verify-evidence/xmon40-top-scroll');
mkdirSync(OUT, { recursive: true });

const TRIGGER = '.dlg-agent-model-select';
const MENU = '.dlg-agent-model-menu';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 732 }, colorScheme: 'dark' });

async function shoot(name, injectPrefix) {
  await page.goto(`${WEB}/app/team`);
  if (injectPrefix) await page.addStyleTag({ content: `${MENU}{max-height:300px !important}` });
  await page.getByRole('button', { name: '创建 Agent' }).click();
  await page.waitForSelector(`[role="dialog"] ${TRIGGER}`, { timeout: 15_000 });
  await page.click(TRIGGER);
  await page.waitForSelector(MENU, { timeout: 10_000 });
  await page.waitForTimeout(350);
  // 页面上有两个 role=dialog：创建弹窗本体 + 模型选择器的浮层壳，取前者。
  const dlg = await page.getByRole('dialog', { name: '创建 agent' }).boundingBox();
  const m = await page.locator(MENU).boundingBox();
  const top = Math.min(dlg.y, m.y) - 16;
  const clip = { x: dlg.x - 12, y: top, width: dlg.width + 24, height: Math.min(400, 732 - top) };
  await page.screenshot({ path: join(OUT, `${name}.png`), clip });
  console.log(`${name}: 弹窗 ${Math.round(dlg.y)}..${Math.round(dlg.y + dlg.height)} 菜单顶 ${Math.round(m.y)} 裁剪 ${JSON.stringify(Object.fromEntries(Object.entries(clip).map(([k, v]) => [k, Math.round(v)])))}`);
  await page.keyboard.press('Escape');
}

await shoot('10-fixed-top-end', false);
await shoot('11-prefix-top-end', true);
await browser.close();