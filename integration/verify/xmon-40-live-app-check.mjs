// XMON-40：用户**自己那台正在跑的应用**上，模型菜单的实测封顶值。
// 只读：只开弹窗、读计算样式与几何，不写任何数据、不改任何文件。
//   node integration/verify/xmon-40-live-app-check.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const WEB = process.env.XMON40_LIVE_WEB ?? 'http://127.0.0.1:5173';
const OUT = process.env.VERIFY_EVIDENCE_DIR ?? join(ROOT, '.claude/verify-evidence/xmon40-live-app');
mkdirSync(OUT, { recursive: true });

const TRIGGER = '.dlg-agent-model-select';
const MENU = '.dlg-agent-model-menu';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 732 }, colorScheme: 'dark' });
await page.goto(`${WEB}/app/team`);
await page.getByRole('button', { name: '创建 Agent' }).click();
await page.waitForSelector(`[role="dialog"] ${TRIGGER}`, { timeout: 20_000 });
await page.click(TRIGGER);
await page.waitForSelector(MENU, { timeout: 10_000 });
await page.waitForTimeout(350);

const facts = await page.evaluate(({ menuSel, optSel, bodySel }) => {
  const menuEl = document.querySelector(menuSel);
  const bodyEl = document.querySelector(bodySel);
  const m = menuEl.getBoundingClientRect();
  const b = bodyEl.getBoundingClientRect();
  return {
    menuMaxHeight: getComputedStyle(menuEl).maxHeight,
    menuBox: { top: Math.round(m.top), bottom: Math.round(m.bottom), h: Math.round(m.height) },
    bodyBox: { top: Math.round(b.top), bottom: Math.round(b.bottom) },
    optionCount: menuEl.querySelectorAll(optSel).length,
    firstRowText: menuEl.querySelector(optSel)?.textContent.trim().slice(0, 30),
  };
}, { menuSel: MENU, optSel: `${MENU} [role="option"]`, bodySel: '.dlg-body' });

await page.screenshot({ path: join(OUT, 'live-app-menu.png') });
writeFileSync(join(OUT, 'live-app.json'), JSON.stringify({ web: WEB, at: new Date().toISOString(), ...facts }, null, 2));
console.log(JSON.stringify(facts, null, 2));
await browser.close();