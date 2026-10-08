#!/usr/bin/env node
// verify probe — #1009 A0 原型（ADR 0013 壳形态反转：贴右竖板 → Multica 式
// 悬浮窗）的位形 smoke + 交互契约钉（fixture 面；premortem 护栏 1 =「五路由
// 位形 smoke：每路由一张窗开截图 + boundingBox 断言」）。
//
// 跑法（fixture 栈先在跑）：
//   cd apps/web && pnpm exec vite build --mode fixture
//   pnpm exec vite preview --host 127.0.0.1 --port ${E2E_PORT:-8403} --strictPort &
//   E2E_PORT=8403 node docs/verify/1009/drive-1009-a0-smoke.mjs
//
// 失败方式先行清单（ADR 0013 premortem + A0 面枚举，每条一个断言组）：
//  F1 挂载上提拆坏五壳：窗压侧栏 / 被壳裁切 / 落错包含块 → S2/S3 逐路由
//     boundingBox（380×600 @ right/bottom 8，视口 1440×732）+ 侧栏不压断言
//  F2 inert 常驻破契约：关闭后窗必须「在 DOM 但不可见不可交互」→ S4；
//     Esc 永不关面板（D3，只收内层弹层）→ S5；⌘J 可开可关（#468）→ S5
//  F3 状态保持：最小化保草稿（D6）→ S6；跨路由常驻不重挂（D6）→ S7
//  F4 让位退役残留：窗开合前后内容列宽零变化（D1：覆盖层无让位）→ S8；
//     detail RightPane 与窗共存（D7 反转互斥）→ S8e
//  F5 fixture 确定性：scenario 捕获形窗开（111）几何同款 → S9；fixture 面
//     永不写 pacman.chief-open（持久化是 live 面专属）→ S11
//  F6 抑制路由长出新面：agent-detail / machine-authorize 零 FAB 零窗 → S10
//  F7 关闭模型：Minimize 钮（Minus，无 X）是唯一钮面收起 → S4；设置视图
//     内容交换承载不变（D9：board gear → swap，窗收起）→ S12
//  F8 FAB 互斥与几何：窗开 FAB 不渲染（D4）→ S2；40px 正圆 @ 8px inset、
//     与窗同角 → S1；detail 族 unreadOnly 门（#443 保留）→ S8e
//  F9 z 律：窗/FAB 走 --z-floating 新 rung（15），活动层恒压过它（#688）→ S13
//
// 证据落本目录：截图 + result.json（全部量测原值，人审面）。

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.E2E_PORT ?? '8403';
const BASE = `http://127.0.0.1:${PORT}`;
const VIEWPORT = { width: 1440, height: 732 };
// ADR 0013 D2（Multica 原值）：窗 380×600 @ right/bottom 8；D4：FAB 40 @ 8。
const WIN = { w: 380, h: 600, inset: 8 };
const FAB = { size: 40, inset: 8 };

const results = [];
let failures = 0;
function check(group, name, actual, expected) {
  const ok =
    typeof expected === 'function' ? expected(actual) : JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  results.push({ group, name, actual, expected: typeof expected === 'function' ? '(predicate)' : expected, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${group}] ${name} — actual=${JSON.stringify(actual)}`);
}

async function shot(page, file) {
  await page.screenshot({ path: join(SCRIPT_DIR, file) });
}

/** 模式闸门事实（api/mode.ts）：fixture 面 = URL 带 ?scenario=；裸 URL 在
 *  fixture build 的 preview 上同样是 live 面（API 打空）——D5 的开态持久化
 *  在 live 面生效（写 localStorage），所以裸 URL 段之间必须清存储，否则上一
 *  段开过的窗会在下一段加载时自动复开（这正是 S11 要正面钉的行为）。 */
async function gotoClean(page, url) {
  await page
    .evaluate(() => {
      try {
        localStorage.removeItem('pacman.chief-open');
      } catch {}
    })
    .catch(() => {});
  await page.goto(url, { waitUntil: 'networkidle' });
}
const storedOpen = (page) => page.evaluate(() => localStorage.getItem('pacman.chief-open'));

const windowBox = (page) => page.locator('.chief-drawer').boundingBox();
const fabBox = (page) => page.locator('.chief-fab').boundingBox();
const fab = (page) => page.getByRole('button', { name: '总管', exact: true });
const win = (page) => page.locator('.chief-drawer');

async function openWindow(page) {
  await fab(page).click();
  await settleWindow(page);
}

/** 等窗真开且进场动画（fade+zoom 0.95→1，--dur-overlay 200ms）落定——
 *  boundingBox 含 transform，动画中途量会读到缩放值。 */
async function settleWindow(page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('.chief-drawer');
    return el != null && !el.hasAttribute('hidden') && el.getBoundingClientRect().width > 0;
  });
  await page.waitForTimeout(400);
}

async function main() {
  mkdirSync(SCRIPT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORT, colorScheme: 'dark' });
  const page = await ctx.newPage();

  // ---- S1 board FAB 几何（D4：40px 正圆，距内容区右/下各 8px）----
  await gotoClean(page, `${BASE}/app`);
  await fab(page).waitFor({ state: 'visible' });
  let box = await fabBox(page);
  check('S1', 'fab size 40x40', { w: box.width, h: box.height }, { w: FAB.size, h: FAB.size });
  check('S1', 'fab right inset 8', VIEWPORT.width - (box.x + box.width), FAB.inset);
  check('S1', 'fab bottom inset 8', VIEWPORT.height - (box.y + box.height), FAB.inset);
  const fabRadius = await fab(page).evaluate((el) => getComputedStyle(el).borderRadius);
  // rounded-full 的计算值 = 50% 折算成超大 px（浏览器序列化形态），判「≥ 半宽即正圆」
  check('S1', 'fab round (radius >= half size)', fabRadius, (r) => Number.parseFloat(r) >= FAB.size / 2);
  await shot(page, '01-board-fab-closed.png');

  // ---- S2 窗开几何/皮肤（D2 Multica 原值）+ S2b FAB 互斥（D4）----
  await openWindow(page);
  box = await windowBox(page);
  check('S2', 'window 380x600', { w: box.width, h: box.height }, { w: WIN.w, h: WIN.h });
  check('S2', 'window right inset 8', VIEWPORT.width - (box.x + box.width), WIN.inset);
  check('S2', 'window bottom inset 8', VIEWPORT.height - (box.y + box.height), WIN.inset);
  const skin = await win(page).evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      position: cs.position,
      radius: cs.borderRadius,
      z: cs.zIndex,
      shadow: cs.boxShadow,
      bg: cs.backgroundColor,
      backdrop: cs.backdropFilter,
    };
  });
  check('S2', 'window position fixed（角落锚定，D10）', skin.position, 'fixed');
  check('S2', 'window radius 12px（D2）', skin.radius, '12px');
  check('S2', 'window z = --z-floating 15（D10 新 rung）', skin.z, '15');
  check(
    'S2',
    'window shadow = edge-ring + floating-shadow 双层（D2）',
    skin.shadow,
    (s) => s.includes('inset') && s.split(/,(?![^(]*\))/).length >= 3,
  );
  check('S2', 'window bg 不透明非玻璃（D2）', { bg: skin.bg, backdrop: skin.backdrop }, (v) => {
    // rgb( 三段 = 不透明；rgba( 四段才看 alpha
    const m = /^rgba?\(([^)]+)\)$/.exec(v.bg);
    if (m == null) return false;
    const parts = m[1].split(',').map((s) => Number.parseFloat(s.trim()));
    const opaque = parts.length === 3 || parts[3] === 1;
    return opaque && (v.backdrop === 'none' || v.backdrop === '');
  });
  check('S2b', 'FAB hidden while window open（D4 互斥）', await fab(page).isVisible(), false);

  // ---- S3 不压侧栏（D2 包含块 = 侧栏右侧内容区）----
  const sidebar = await page.locator('.board-sidebar').boundingBox();
  check('S3', 'window never overlaps sidebar', box.x >= sidebar.x + sidebar.width, true);
  await shot(page, '02-board-window-open.png');

  // ---- S13 z 律（#688：活动面恒压过常驻窗）----
  // 载体注意：悬浮窗自己就是 Base UI Dialog（role=dialog 的 aside）——
  // 新建任务 dialog 要用「非 .chief-drawer 的 role=dialog」定位。
  const taskDialog = page.locator('[role="dialog"]:not(.chief-drawer)').first();
  await page.evaluate(() => document.activeElement?.blur()); // C 是裸键：先离开 composer（输入态守卫律）
  await page.keyboard.press('c'); // 新建任务 dialog（C 裸键，board 全局面）
  await taskDialog.waitFor({ state: 'visible' });
  const dialogZ = await taskDialog.evaluate((el) => {
    let node = el;
    let z = 0;
    while (node != null && node !== document.body) {
      const cs = getComputedStyle(node);
      if (cs.zIndex !== 'auto') z = Math.max(z, Number.parseInt(cs.zIndex, 10));
      node = node.parentElement;
    }
    return z;
  });
  check('S13', 'new-task dialog z (panel-low 21 ladder) > window z (15)', dialogZ > 15, true);
  await shot(page, '03-board-dialog-over-window.png');
  await page.keyboard.press('Escape');
  await taskDialog.waitFor({ state: 'hidden' });
  check('S13b', 'window survives the dialog Esc（D3：Esc 只收它自己的层）', await win(page).isVisible(), true);

  // ---- S4 最小化（D3/D6：Minus 钮、无 X；关 = 在 DOM 但 hidden/inert）----
  const minimize = win(page).getByRole('button', { name: '最小化' });
  check('S4', 'Minimize 钮在位（无 X：关闭 aria 钮不存在）', {
    minimize: await minimize.isVisible(),
    closeX: await win(page).getByRole('button', { name: '关闭' }).count(),
  }, { minimize: true, closeX: 0 });
  await minimize.click();
  await win(page).waitFor({ state: 'hidden' });
  check('S4', 'minimized window stays in DOM（D6 常驻，count=1）', await win(page).count(), 1);
  check('S4', 'minimized window hidden from a11y tree', await win(page).evaluate((el) => {
    const cs = getComputedStyle(el);
    return el.hasAttribute('hidden') || cs.display === 'none' || el.getAttribute('aria-hidden') === 'true' || el.hasAttribute('inert');
  }), true);
  check('S4', 'FAB back after minimize（互斥反转）', await fab(page).isVisible(), true);
  await shot(page, '04-board-minimized.png');

  // ---- S5 Esc 永不关（D3）+ ⌘J toggle（#468 保留）----
  await page.keyboard.press('Meta+j');
  await settleWindow(page);
  check('S5', '⌘J opens', await win(page).isVisible(), true);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400); // 退场动画窗（--dur-overlay 200ms）余量
  check('S5', 'Escape never closes the window（D3）', await win(page).isVisible(), true);
  await page.keyboard.press('Meta+j');
  await win(page).waitFor({ state: 'hidden' });
  check('S5', '⌘J toggles shut（最小化语义）', await fab(page).isVisible(), true);

  // ---- S6 草稿保持（D6：最小化不销毁）----
  await openWindow(page);
  const composer = page.getByTestId('chief-composer-input');
  await composer.fill('draft-probe-a0');
  await win(page).getByRole('button', { name: '最小化' }).click();
  await win(page).waitFor({ state: 'hidden' });
  await openWindow(page);
  check('S6', 'draft survives minimize', await composer.inputValue(), 'draft-probe-a0');

  // ---- S7 跨路由常驻（D6：路由切换不重挂，窗与草稿都还在）----
  await page.getByRole('link', { name: '定时', exact: true }).first().click();
  await page.waitForURL('**/app/schedules**');
  check('S7', 'window still open after route switch', await win(page).isVisible(), true);
  check('S7', 'draft survives route switch', await composer.inputValue(), 'draft-probe-a0');
  await shot(page, '05-schedules-window-open.png');

  // ---- S8 让位退役（D1：窗开合不改内容列宽）+ 四壳位形 ----
  const shells = [
    { name: 'schedules', url: '/app/schedules?scenario=r3-93', col: '.page-main-col', shot: '06-schedules-shell.png' },
    { name: 'skills', url: '/app/resources/skills', col: '.res-main-col', shot: '07-skills-shell.png' },
    { name: 'team', url: '/app/team', col: '.secondary-main-col', shot: '08-team-shell.png' },
  ];
  for (const s of shells) {
    await gotoClean(page, `${BASE}${s.url}`);
    const col = page.locator(s.col).first();
    await col.waitFor({ state: 'visible' });
    const before = await col.boundingBox();
    await openWindow(page);
    const after = await col.boundingBox();
    check('S8', `${s.name}: content column width unchanged (no yield)`, { before: before.width, after: after.width }, (v) => v.before === v.after);
    const wbox = await windowBox(page);
    check('S8', `${s.name}: window geometry 380x600@8`, { w: wbox.width, h: wbox.height, right: VIEWPORT.width - (wbox.x + wbox.width), bottom: VIEWPORT.height - (wbox.y + wbox.height) }, { w: 380, h: 600, right: 8, bottom: 8 });
    await shot(page, s.shot);
  }

  // ---- S8b board 列宽（#1035 两态随让位退役 → 单态零变轨）----
  await gotoClean(page, `${BASE}/app`);
  const scroller = page.getByTestId('board-scroller');
  const trackWidths = () =>
    scroller.evaluate((el) =>
      getComputedStyle(el).gridTemplateColumns.split(' ').map((v) => Math.round(Number.parseFloat(v))),
    );
  const colsBefore = await trackWidths();
  await openWindow(page);
  const colsAfter = await trackWidths();
  check('S8b', 'board column tracks identical with window open (yield retired)', { colsBefore, colsAfter }, (v) => JSON.stringify(v.colsBefore) === JSON.stringify(v.colsAfter));

  // ---- S8e detail：RightPane 与窗共存（D7 互斥反转）+ unreadOnly FAB（#443）----
  await page.goto(`${BASE}/app/todo/16?scenario=detail-unread`, { waitUntil: 'networkidle' });
  await fab(page).waitFor({ state: 'visible' });
  const fabBadge = await page.locator('.fab-badge').textContent().catch(() => null);
  check('S8e', 'detail FAB gated on unread, badge = 3（#443 保留）', fabBadge?.trim(), '3');
  await openWindow(page);
  check('S8e', 'detail RightPane coexists with open window（互斥退役）', await page.locator('.detail-right').isVisible(), true);
  const dbox = await windowBox(page);
  check('S8e', 'detail window geometry 380x600@8', { w: dbox.width, h: dbox.height }, { w: 380, h: 600 });
  await shot(page, '09-detail-window-rightpane.png');

  // ---- S9 fixture 捕获形（scenario view=drawer 零点击自开）----
  // 111 = chiefReady（hero 示例面）；114 = chiefThread（线程消息流面）。
  await page.goto(`${BASE}/app?scenario=111`, { waitUntil: 'networkidle' });
  await settleWindow(page);
  const fbox = await windowBox(page);
  check('S9', 'fixture capture shape: window open from scenario, 380x600', { w: fbox.width, h: fbox.height }, { w: 380, h: 600 });
  check('S9', 'fixture 111 hero examples carrier present', await page.getByTestId('chief-examples').isVisible(), true);
  await shot(page, '10-fixture-111-hero.png');
  await page.goto(`${BASE}/app?scenario=114`, { waitUntil: 'networkidle' });
  await settleWindow(page);
  check('S9', 'fixture 114 stream carrier present', await page.getByTestId('chief-stream').isVisible(), true);
  const tbox = await windowBox(page);
  check('S9', 'fixture 114 window geometry 380x600', { w: tbox.width, h: tbox.height }, { w: 380, h: 600 });
  await shot(page, '10b-fixture-114-thread.png');

  // ---- S10 抑制路由（覆盖面 = 现状：agent-detail / machine-authorize 无 chief 面）----
  for (const url of ['/app/resources/agents/r3-builder?scenario=agent-detail', '/app/machines/authorize']) {
    await gotoClean(page, `${BASE}${url}`);
    await page.waitForTimeout(200);
    check('S10', `${url}: no FAB, no window`, { fab: await page.locator('.chief-fab').count(), win: await win(page).count() }, { fab: 0, win: 0 });
  }
  await shot(page, '11-agent-detail-suppressed.png');

  // ---- S11 开态持久化双面语义（D5 live 面持久化 + 默认关；F5 fixture 面零读写）----
  // live 面（preview 上的裸 URL 即 live 模式，API 打空——mode.ts 闸门事实）：
  await gotoClean(page, `${BASE}/app`);
  check('S11', 'live face default = closed（never pops uninvited）', {
    fab: await fab(page).isVisible(),
    winVisible: await win(page).isVisible(),
  }, { fab: true, winVisible: false });
  await openWindow(page);
  check('S11', 'live face writes pacman.chief-open=1 on open', await storedOpen(page), '1');
  await shot(page, '13-live-window-open.png');
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' });
  await settleWindow(page);
  check('S11', 'reload restores the persisted open state（D5，0004 D9 反转）', await win(page).isVisible(), true);
  await win(page).getByRole('button', { name: '最小化' }).click();
  await win(page).waitFor({ state: 'hidden' });
  check('S11', 'minimize writes pacman.chief-open=0', await storedOpen(page), '0');
  // fixture 面（?scenario=）零读写——采集确定性：
  await page.evaluate(() => localStorage.removeItem('pacman.chief-open'));
  await page.goto(`${BASE}/app?scenario=111`, { waitUntil: 'networkidle' });
  await settleWindow(page);
  check('S11', 'fixture face reads nothing: scenario view decides, storage untouched', await storedOpen(page), null);
  await page.goto(`${BASE}/app/schedules?scenario=r3-93`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  check('S11', 'fixture face writes nothing', await storedOpen(page), null);

  // ---- S12 board gear → 设置视图内容交换（D9 承载不变）----
  await page.goto(`${BASE}/app?scenario=111`, { waitUntil: 'networkidle' });
  await settleWindow(page);
  await win(page).getByRole('button', { name: '总管设置' }).click();
  await page.getByRole('heading', { name: '总管设置' }).waitFor({ state: 'visible' });
  check('S12', 'gear swaps board content to settings view', await page.getByRole('heading', { name: '总管设置' }).isVisible(), true);
  await win(page).waitFor({ state: 'hidden' }); // 退场动画（--dur-overlay）播完才落 hidden
  check('S12', 'settings swap closes the window（三态单值）', await win(page).isVisible(), false);
  await shot(page, '12-board-settings-swap.png');

  await browser.close();
  writeFileSync(
    join(SCRIPT_DIR, 'result-a0-fixture-smoke.json'),
    `${JSON.stringify({ viewport: VIEWPORT, base: BASE, failures, results }, null, 2)}\n`,
  );
  console.log(`\n${failures === 0 ? 'ALL PASS' : `FAILURES: ${failures}`} (${results.length} checks) — result-a0-fixture-smoke.json`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  writeFileSync(join(SCRIPT_DIR, 'result-a0-fixture-smoke.json'), `${JSON.stringify({ error: String(err), failures: failures + 1, results }, null, 2)}\n`);
  process.exit(2);
});
