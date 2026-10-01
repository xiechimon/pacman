// XMON-40 复查驱动（压力面）：把「上端滑动」逼到真实用户场景里。
//
// 上一支 top-scroll 探针在 1440×732 上 9/9 全绿——但那个视口下弹窗体
// （`.dlg-body`，overflow-y:auto）根本不可滚，滚动链无从发生。真实用户的
// 屏幕更矮、弹窗体内容要滚，菜单正好挂在弹窗体可视上沿——这才是「上端」。
//
// 本支做矩阵：视口 × 弹窗体滚动位置，全程真实滚轮事件。
//   node integration/verify/xmon-40-top-scroll-stress.mjs

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const ports = JSON.parse(readFileSync(join(ROOT, '.claude/verify-run/ports.json'), 'utf8'));
const WEB = `http://127.0.0.1:${process.env.VERIFY_WEB_PORT ?? ports.webPort}`;
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const EVIDENCE = process.env.VERIFY_EVIDENCE_DIR ?? join(ROOT, '.claude/verify-evidence', `${STAMP}-xmon40-stress`);
mkdirSync(EVIDENCE, { recursive: true });

const checks = [];
const record = (ok, label, detail) => {
  checks.push({ ok, label, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};

const MODEL_COUNT = Number(process.env.XMON40_MODEL_COUNT ?? 40);
const TRIGGER = '.dlg-agent-model-select';
const MENU = '.dlg-agent-model-menu';
const OPTION = `${MENU} [role="option"]`;
const BODY = '.dlg-body';

// 从常见笔记本尺寸一路压到弹窗体被 max-h 夹住的高度。弹窗自然高 348px、封顶
// 值 100vh-48，故视口高 <≈396px 时弹窗开始被夹、`.dlg-body` 才真正成为滚动盒
// ——菜单挂在上沿的风险出现在那以下（实测：≥396 干净；380~392 菜单被弹窗体
// 带动 4px；≤360 行被切 1~3 行。与模型条数无关，任何条数都如此）。
const VIEWPORTS = process.env.XMON40_VIEWPORTS
  ? JSON.parse(process.env.XMON40_VIEWPORTS)
  : [[1440, 732], [1440, 560], [1366, 600], [1280, 620], [1280, 400], [1280, 392], [1280, 360]];

async function seed(page) {
  await page.goto(`${WEB}/app/team`);
  const tid0 = await page.evaluate(async () => (await (await fetch('/api/teams')).json())[0].id);
  const existing = await page.evaluate(async (team) => (await (await fetch(`/api/teams/${team}/providers`)).json()).providers, tid0);
  if (existing.some((p) => p.providerId === 'xmon40-gw' && p.models.length === MODEL_COUNT)) {
    record(true, 'seed: 已有 40 模型服务商，复用', `providers=${existing.length}`);
    return;
  }
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
  const tid = await page.evaluate(async () => (await (await fetch('/api/teams')).json())[0].id);
  const env = await page.evaluate(async (team) => {
    for (let i = 0; i < 60; i += 1) {
      const body = await (await fetch(`/api/teams/${team}/providers`)).json();
      if (body.providers.length > 0) return body;
      await new Promise((r) => setTimeout(r, 250));
    }
    return { providers: [] };
  }, tid);
  record(env.providers.length === 1, 'seed: 40 模型的自定义服务商已建成', `providers=${env.providers.length}`);
}

async function snap(page, tag) {
  return page.evaluate(({ menuSel, optSel, bodySel, tag }) => {
    const menuEl = document.querySelector(menuSel);
    const bodyEl = document.querySelector(bodySel);
    const menu = menuEl.getBoundingClientRect();
    const body = bodyEl.getBoundingClientRect();
    const clip = { top: Math.max(0, body.top), bottom: Math.min(window.innerHeight, body.bottom) };
    const rows = [...menuEl.querySelectorAll(optSel)].map((o, i) => {
      const rr = o.getBoundingClientRect();
      const vis = (r, c) => Math.round(Math.max(0, Math.min(r.bottom, c.bottom) - Math.max(r.top, c.top)));
      return { i, text: o.textContent.trim().slice(0, 30), h: Math.round(rr.height), inMenu: vis(rr, menu), inClip: vis(rr, clip) };
    });
    return {
      tag,
      menu: { top: Math.round(menu.top), bottom: Math.round(menu.bottom), h: Math.round(menu.height) },
      menuScrollTop: menuEl.scrollTop,
      menuScrollHeight: menuEl.scrollHeight,
      menuClientHeight: menuEl.clientHeight,
      body: { top: Math.round(body.top), bottom: Math.round(body.bottom), scrollTop: bodyEl.scrollTop, scrollHeight: bodyEl.scrollHeight, clientHeight: bodyEl.clientHeight },
      bodyScrollable: bodyEl.scrollHeight > bodyEl.clientHeight + 1,
      scrollableAncestors: (() => {
        const out = [];
        for (let p = menuEl.parentElement; p; p = p.parentElement) {
          const cs = getComputedStyle(p);
          if (/(auto|scroll)/.test(`${cs.overflowX}${cs.overflowY}`)) out.push({ cls: p.className.split(' ').slice(0, 2).join('.'), canScroll: p.scrollHeight > p.clientHeight + 1, scrollTop: p.scrollTop });
        }
        return out;
      })(),
      firstRow: rows[0], lastRow: rows[rows.length - 1],
      rowsCutByAncestor: rows.filter((r) => r.inMenu > 0 && r.inClip < r.inMenu - 0.5).length,
      optionCount: rows.length,
    };
  }, { menuSel: MENU, optSel: OPTION, bodySel: BODY, tag });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 732 }, colorScheme: 'dark' });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const shots = (n) => page.screenshot({ path: join(EVIDENCE, `${n}.png`) });
const all = [];

await seed(page);

for (const [w, h] of VIEWPORTS) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(`${WEB}/app/team`);
  await page.getByRole('button', { name: '创建 Agent' }).click();
  await page.waitForSelector(`[role="dialog"] ${TRIGGER}`, { timeout: 15_000 });

  for (const pos of ['body-top', 'body-bottom']) {
    await page.evaluate(({ sel, pos }) => {
      const b = document.querySelector(sel);
      b.scrollTop = pos === 'body-top' ? 0 : b.scrollHeight;
    }, { sel: BODY, pos });
    await page.waitForTimeout(200);
    await page.click(TRIGGER);
    await page.waitForSelector(MENU, { timeout: 10_000 });
    await page.waitForTimeout(300);

    const box = await page.locator(MENU).boundingBox();
    const s0 = await snap(page, `${w}x${h}/${pos}/open`);
    all.push(s0);
    await shots(`${w}x${h}-${pos}-open`);

    // 真滚轮打在菜单正中：先往上一把（上端），再往下一把
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(200);
    const s1 = await snap(page, `${w}x${h}/${pos}/wheel-up`);
    all.push(s1);

    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(200);
    const s2 = await snap(page, `${w}x${h}/${pos}/wheel-down`);
    all.push(s2);

    const label = `${w}x${h} ${pos}`;
    record(s0.body.scrollTop === s1.body.scrollTop && s0.menu.top === s1.menu.top,
      `${label}: 列表顶端再往上划，菜单与弹窗体都不动`,
      `菜单top ${s0.menu.top}→${s1.menu.top}；body scrollTop ${s0.body.scrollTop}→${s1.body.scrollTop}`);
    record(s0.rowsCutByAncestor === 0 && s1.rowsCutByAncestor === 0 && s2.rowsCutByAncestor === 0,
      `${label}: 全程无行被弹窗体上沿切掉`,
      `open=${s0.rowsCutByAncestor} up=${s1.rowsCutByAncestor} down=${s2.rowsCutByAncestor}；菜单盒 ${s0.menu.top}..${s0.menu.bottom} body 可视 ${s0.body.top}..${s0.body.bottom}`);
    record(s0.firstRow.inClip >= s0.firstRow.h - 0.5,
      `${label}: 打开瞬间首行完整可见`,
      `首行 inClip=${s0.firstRow.inClip}/${s0.firstRow.h}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
  }
}

const failed = checks.filter((c) => !c.ok);
writeFileSync(join(EVIDENCE, 'result.json'), JSON.stringify({
  probe: 'xmon-40-top-scroll-stress', at: new Date().toISOString(), web: WEB, modelCount: MODEL_COUNT,
  checks, snapshots: all, pageErrors: errors,
}, null, 2));
await browser.close();
console.log(`\n${checks.length - failed.length}/${checks.length} checks ok`);
console.log(`evidence: ${EVIDENCE}`);
process.exitCode = failed.length === 0 ? 0 : 1;