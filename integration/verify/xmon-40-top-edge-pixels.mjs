// XMON-40 复查：菜单上边缘那一线的**合成像素**剖面。
//
// 用户说「往下滑的时候上边缘被上面的标题方框遮挡住了」。遮挡是几何事实（命中
// 测试已判），「看着像被遮挡」则是像素事实：沿菜单上沿取一列像素往下读，看那
// 条边界到底有没有可分辨的落差——若菜单底色与上方空白同色、边框又极淡，视觉上
// 就会读成「滑进标题框里」。
//
//   node integration/verify/xmon-40-top-edge-pixels.mjs

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { readPng } from './lib/png.mjs';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const ports = JSON.parse(readFileSync(join(ROOT, '.claude/verify-run/ports.json'), 'utf8'));
const WEB = `http://127.0.0.1:${process.env.VERIFY_WEB_PORT ?? ports.webPort}`;
const EVIDENCE = process.env.VERIFY_EVIDENCE_DIR ?? join(ROOT, '.claude/verify-evidence/xmon40-top-edge');
mkdirSync(EVIDENCE, { recursive: true });

const MODEL_COUNT = Number(process.env.XMON40_MODEL_COUNT ?? 40);
const PREFIX_MAXHEIGHT = Number(process.env.XMON40_PREFIX_MAXHEIGHT ?? 300);
const TRIGGER = '.dlg-agent-model-select';
const MENU = '.dlg-agent-model-menu';
const BODY = '.dlg-body';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 732 }, colorScheme: 'dark' });

async function seed() {
  await page.goto(`${WEB}/app/team`);
  const tid = await page.evaluate(async () => (await (await fetch('/api/teams')).json())[0].id);
  const existing = await page.evaluate(async (t) => (await (await fetch(`/api/teams/${t}/providers`)).json()).providers, tid);
  if (existing.some((p) => p.providerId === 'xmon40-gw' && p.models.length === MODEL_COUNT)) return;
  await page.goto(`${WEB}/app/resources/providers`);
  await page.waitForSelector('.res-new', { timeout: 15_000 });
  await page.click('.res-new');
  await page.waitForSelector('.dlg-picker-custom', { timeout: 15_000 });
  await page.click('.dlg-picker-custom');
  await page.waitForSelector('#dlg-provider-id', { timeout: 15_000 });
  await page.fill('#dlg-provider-id', 'xmon40-gw');
  await page.fill('#dlg-provider-label', 'XMON40 网关');
  await page.fill('#dlg-provider-baseurl', 'https://example.invalid/v1');
  await page.fill('#dlg-provider-apikey', 'sk-xmon40-not-a-real-key');
  for (let i = 0; i < MODEL_COUNT; i += 1) await page.click('.dlg-provider-model-add');
  const rows = page.locator('input[aria-label="模型 ID"]');
  const n = await rows.count();
  for (let i = 0; i < n; i += 1) await rows.nth(i).fill(`xmon40-model-${String(i).padStart(3, '0')}`);
  await page.click('.dlg-provider-create');
  await page.waitForTimeout(1200);
}

/** 沿菜单左缘内侧一条竖线，从标题区往下读进菜单里。 */
async function profile(label, injectPrefix) {
  await page.goto(`${WEB}/app/team`);
  if (injectPrefix) await page.addStyleTag({ content: `${MENU}{max-height:${PREFIX_MAXHEIGHT}px !important}` });
  await page.getByRole('button', { name: '创建 Agent' }).click();
  await page.waitForSelector(`[role="dialog"] ${TRIGGER}`, { timeout: 15_000 });
  await page.click(TRIGGER);
  await page.waitForSelector(MENU, { timeout: 10_000 });
  await page.waitForTimeout(320);

  const box = await page.locator(MENU).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 45); // 让上边缘停在一行被切一半的位置
  await page.waitForTimeout(200);

  const m = await page.locator(MENU).boundingBox();
  const dlg = await page.getByRole('dialog', { name: '创建 agent' }).boundingBox();
  const body = await page.locator(BODY).boundingBox();
  const x = Math.round(m.x + 40);
  // 采样窗要同时跨过「菜单上沿」和「弹窗体上沿」两条线：改动前菜单顶在弹窗体
  // 上沿之上、整段被裁掉，只框菜单自己的名义上沿会读到一片背景色，跟改动后不
  // 可比。取两者的上方 26px 到下方 34px，两版读的是同一段布局。
  const y0 = Math.round(Math.max(0, Math.min(m.y, body.y) - 26));
  const h = Math.round(Math.max(m.y, body.y) + 34 - y0);
  await page.screenshot({ path: join(EVIDENCE, `${label}-strip.png`), clip: { x, y: y0, width: 1, height: h } });
  const png = readPng(readFileSync(join(EVIDENCE, `${label}-strip.png`)));

  const rows = [];
  for (let i = 0; i < png.height; i += 1) {
    const [r, g, b] = png.at(0, i);
    rows.push({ y: y0 + i, rgb: `${r},${g},${b}` });
  }
  // 相邻行的颜色落差——落差 ≥3 才谈得上肉眼可辨的分界。
  const edges = [];
  for (let i = 1; i < rows.length; i += 1) {
    const a = rows[i - 1].rgb.split(',').map(Number);
    const c = rows[i].rgb.split(',').map(Number);
    const d = Math.max(Math.abs(a[0] - c[0]), Math.abs(a[1] - c[1]), Math.abs(a[2] - c[2]));
    if (d >= 3) edges.push({ y: rows[i].y, delta: d, from: rows[i - 1].rgb, to: rows[i].rgb });
  }
  return { label, menuTop: Math.round(m.y), dialogTop: Math.round(dlg.y), bodyTop: Math.round(body.y), x, y0, height: png.height, rows, edges };
}

await seed();
const fixed = await profile('20-fixed', false);
const prefix = await profile('21-prefix', true);
await browser.close();

const show = (p) => {
  console.log(`\n${p.label}：菜单上沿 y=${p.menuTop}，弹窗体上沿 y=${p.bodyTop}，弹窗上沿 y=${p.dialogTop}，采样列 x=${p.x}`);
  console.log(`  分界（相邻像素落差 ≥3）：${p.edges.length ? p.edges.map((e) => `y=${e.y} Δ${e.delta} ${e.from}→${e.to}`).join(' / ') : '无'}`);
  console.log(`  菜单上沿上下各 6 行：`);
  for (const r of p.rows.filter((r) => Math.abs(r.y - p.menuTop) <= 6)) {
    console.log(`    y=${r.y}${r.y === p.menuTop ? ' (菜单上沿)' : ''} rgb(${r.rgb})`);
  }
  console.log(`  弹窗体上沿上下各 3 行：`);
  for (const r of p.rows.filter((r) => Math.abs(r.y - p.bodyTop) <= 3)) {
    console.log(`    y=${r.y}${r.y === p.bodyTop ? ' (弹窗体上沿/裁剪线)' : ''} rgb(${r.rgb})`);
  }
};
show(fixed);
show(prefix);

writeFileSync(join(EVIDENCE, 'pixels.json'), JSON.stringify({ at: new Date().toISOString(), fixed, prefix }, null, 2));
console.log(`\nevidence: ${EVIDENCE}`);