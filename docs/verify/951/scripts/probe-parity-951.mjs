#!/usr/bin/env node
// #951 detail-b 域施工的等值迁移 parity 探针（#949 probe-parity 同法）：
// 在同一 fixture 栈形态上采集 detail/overlays.css 清零面（右 pane 三 section
// / accept 弹层 / 看板分支弹层 / 创建 Agent 告警面）的 computed-style 与几何
// 真值，before（origin/main，规则住 per-face CSS）与 after（迁移分支，
// token utility 载体）各跑一次，diff 出人审表。
//
// 选择器口径：本脚本是机制探针（不是 e2e 钉扎）。本域迁移不改 DOM 形状
// （只换 className 串 + 一处控件换代），故 before/after 共用同一套结构
// 选择子（存活的 pane-section-body / .dlg 壳别名 / .ui-checkbox 件类 /
// data-testid / role 载体）。唯一结构换代 = 强制同步拨杆：before 是
// label.dlg-toggle + 隐藏 input + knob span，after 是 Switch 件
// （role=switch）——D2/§2.5 授权漂移，diff 侧按 EXPECTED 记账。
//
// 用法（仓根跑，@playwright/test 走仓内解析）：
//   node docs/verify/951/scripts/probe-parity-951.mjs --url http://127.0.0.1:8405 \
//     --scheme dark --out /tmp/951-parity-before-dark.json
// 退出码：0 = 采集完成（值本身不做断言，人审 diff 走 diff-parity-951.mjs）。

import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const argOf = (name) => args[args.indexOf(name) + 1];
const BASE = argOf('--url') ?? 'http://localhost:8402';
const OUT = argOf('--out') ?? '/tmp/probe-parity-951.json';
const SCHEME = args.includes('--scheme') ? argOf('--scheme') : 'dark';
const TOGGLE_CARRIER = args.includes('--carrier') && argOf('--carrier') === 'after' ? 'switch' : 'legacy';

const DETAIL = `${BASE}/app/todo/7ve0iOkQ-JBpSL98zSiGc`;
const BOARD = `${BASE}/app?scenario=01`;
const TEAM = `${BASE}/app/team?scenario=12`;

const RIGHT = '[data-testid="detail-right"]';
const BODY = `${RIGHT} .pane-section-body`;
// BranchSection 容器（p-4）子级序（fixture，ResultCard 缺席）：
// div1 box / div2 field-label / button pill / div3 field-label / div4 dir /
// div5 force / div6 pr-label / div7 pr-box / div8 foot(sync)
const BR = `${BODY} > div`;

const PROPS = [
  'backgroundColor', 'color', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
  'fontFamily', 'padding', 'margin', 'borderTopWidth', 'borderRightWidth',
  'borderBottomWidth', 'borderLeftWidth', 'borderTopColor', 'borderBottomColor',
  'borderLeftColor', 'borderRightColor', 'borderTopStyle', 'borderStyle',
  'borderRadius', 'display', 'flexDirection', 'alignItems', 'justifyContent',
  'gap', 'overflow', 'overflowY', 'textOverflow', 'whiteSpace', 'cursor',
  'textDecorationLine', 'transitionProperty', 'transitionDuration', 'minHeight',
  'resize', 'listStyleType', 'textAlign', 'opacity', 'width', 'height',
];

const cs = (page, selector, props = PROPS) =>
  page.evaluate(
    ({ selector, props }) => {
      const el = document.querySelector(selector);
      if (el == null) return { MISSING: selector };
      const style = getComputedStyle(el);
      const values = {};
      for (const p of props) values[p] = style[p];
      return values;
    },
    { selector, props },
  );

const box = (page, selector) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el == null) return { MISSING: sel };
    const r = el.getBoundingClientRect();
    return {
      x: +r.x.toFixed(1), y: +r.y.toFixed(1),
      w: +r.width.toFixed(1), h: +r.height.toFixed(1),
    };
  }, selector);

const hoverBg = async (page, selector, settleMs = 200) => {
  const loc = page.locator(selector).first();
  if ((await loc.count()) === 0) return { MISSING: selector };
  // disabled 钮（底座 disabled:pointer-events-none）不可 hover——两栈同形，
  // 记 SKIPPED 保持采集面对齐。
  const inert = await loc.evaluate(
    (el) => el.disabled === true || getComputedStyle(el).pointerEvents === 'none',
  );
  if (inert) return { SKIPPED: 'disabled/pointer-events-none' };
  await loc.hover({ timeout: 5000 });
  await page.waitForTimeout(settleMs);
  const bg = await loc.evaluate((el) => getComputedStyle(el).backgroundColor);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(settleMs);
  return { backgroundColor: bg };
};

const out = { scheme: SCHEME, toggleCarrier: TOGGLE_CARRIER };

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 732 },
  colorScheme: SCHEME,
});
const page = await context.newPage();
await page.addInitScript(
  (t) => localStorage.setItem('pacman-theme', t),
  SCHEME === 'dark' ? 'dark' : 'light',
);

// —— Face T: Token 用量 section（scenario 30）———————————————————————————————
await page.goto(`${DETAIL}?scenario=30`);
await page.locator(`${BODY} > div:nth-child(1)`).waitFor({ state: 'visible', timeout: 15000 });
out.tokenTotalRow = {
  box: await box(page, `${BODY} > div:nth-child(1)`),
  style: await cs(page, `${BODY} > div:nth-child(1)`),
};
out.tokenNum = {
  box: await box(page, `${BODY} > div:nth-child(1) > span:nth-child(1)`),
  style: await cs(page, `${BODY} > div:nth-child(1) > span:nth-child(1)`),
};
out.tokenUnit = await cs(page, `${BODY} > div:nth-child(1) > span:nth-child(2)`);
out.tokenModelRow = {
  box: await box(page, `${BODY} > div:nth-child(2)`),
  style: await cs(page, `${BODY} > div:nth-child(2)`),
};
out.tokenModelName = await cs(page, `${BODY} > div:nth-child(2) > span:nth-child(1)`);
out.tokenModelTotal = await cs(page, `${BODY} > div:nth-child(2) > span:nth-child(2)`);
out.tokenStatRow = {
  box: await box(page, `${BODY} > div:nth-child(3) > div:nth-child(1)`),
  style: await cs(page, `${BODY} > div:nth-child(3) > div:nth-child(1)`),
};
out.tokenStatLabel = await cs(page, `${BODY} > div:nth-child(3) > div:nth-child(1) > span:nth-child(1)`);
out.tokenStatValue = await cs(page, `${BODY} > div:nth-child(3) > div:nth-child(1) > span:nth-child(2)`);

// —— Face B: 分支与 PR section（scenario 31）———————————————————————————————
await page.goto(`${DETAIL}?scenario=31`);
await page.locator(`${BR}`).waitFor({ state: 'visible', timeout: 15000 });
out.branchBody = { box: await box(page, BR), style: await cs(page, BR) };
out.branchBox = {
  box: await box(page, `${BR} > div:nth-of-type(1)`),
  style: await cs(page, `${BR} > div:nth-of-type(1)`),
};
out.branchRow1 = {
  box: await box(page, `${BR} > div:nth-of-type(1) > div:nth-child(1)`),
  style: await cs(page, `${BR} > div:nth-of-type(1) > div:nth-child(1)`),
};
out.branchRow2Border = await cs(
  page,
  `${BR} > div:nth-of-type(1) > div:nth-child(2)`,
  ['borderTopWidth', 'borderTopColor', 'borderTopStyle', 'height'],
);
out.branchLabel = await cs(page, `${BR} > div:nth-of-type(1) > div:nth-child(1) > span:nth-child(1)`);
out.branchValue = await cs(page, `${BR} > div:nth-of-type(1) > div:nth-child(1) > span:nth-child(2)`);
out.branchCopyBtn = {
  box: await box(page, `${BR} > div:nth-of-type(1) > div:nth-child(1) > button`),
  style: await cs(page, `${BR} > div:nth-of-type(1) > div:nth-child(1) > button`),
};
out.machinePill = {
  box: await box(page, `${BR} > button`),
  style: await cs(page, `${BR} > button`),
  hover: await hoverBg(page, `${BR} > button`),
};
out.machineDot = {
  box: await box(page, `${BR} > button > span:nth-child(1)`),
  style: await cs(page, `${BR} > button > span:nth-child(1)`),
};
out.dirBox = {
  box: await box(page, `${BR} > div:nth-of-type(4)`),
  style: await cs(page, `${BR} > div:nth-of-type(4)`),
};
out.forceRow = {
  box: await box(page, `${BR} > div:nth-of-type(5)`),
  style: await cs(page, `${BR} > div:nth-of-type(5)`),
};
out.forceDesc = await cs(page, `${BR} > div:nth-of-type(5) > div:nth-child(1) > div:nth-child(2)`);
// 拨杆换代面（唯一结构换代——EXPECTED 漂移，§2.5 Switch 正典默认档）：
out.toggle =
  TOGGLE_CARRIER === 'switch'
    ? {
        kind: 'switch',
        box: await box(page, `${BR} > div:nth-of-type(5) [role="switch"]`),
        style: await cs(page, `${BR} > div:nth-of-type(5) [role="switch"]`),
        thumb: await cs(page, `${BR} > div:nth-of-type(5) [role="switch"] [data-slot="switch-thumb"]`),
      }
    : {
        kind: 'legacy',
        box: await box(page, `${BR} .dlg-toggle`),
        style: await cs(page, `${BR} .dlg-toggle`),
        thumb: await cs(page, `${BR} .dlg-toggle-knob`),
      };
out.prLabel = await cs(page, `${BR} > div:nth-of-type(6)`);
out.prBox = {
  box: await box(page, `${BR} > div:nth-of-type(7)`),
  style: await cs(page, `${BR} > div:nth-of-type(7)`),
};
out.syncButton = {
  box: await box(page, `${BR} > div:nth-of-type(8) button`),
  style: await cs(page, `${BR} > div:nth-of-type(8) button`),
  hover: await hoverBg(page, `${BR} > div:nth-of-type(8) button`),
};

// —— Face H: 运行历史 section（scenario 32）———————————————————————————————
await page.goto(`${DETAIL}?scenario=32`);
await page.locator('[data-testid="history-row"], .dlg-history-row').first().waitFor({ state: 'visible', timeout: 15000 });
// 行载体换代：before 栈没有 history-row testid（本票新增二级载体），走旧类名。
const HROW = TOGGLE_CARRIER === 'switch' ? '[data-testid="history-row"]' : '.dlg-history-row';
out.historyContainer = {
  box: await box(page, `${BODY} > div`),
  style: await cs(page, `${BODY} > div`),
};
out.historyRow = { box: await box(page, HROW), style: await cs(page, HROW) };
out.historyGlyph = await cs(page, `${HROW} > span, ${HROW} > svg`, ['color', 'width', 'height', 'marginLeft', 'borderTopWidth', 'borderTopColor', 'borderRadius', 'flex']);
out.historyLine = await cs(page, `${HROW} > div > div:nth-child(1)`);
out.historyLabel = await cs(page, `${HROW} > div > div:nth-child(1) > span:nth-child(1)`);
out.historyMeta = {
  box: await box(page, `${HROW} > div > div:nth-child(2)`),
  style: await cs(page, `${HROW} > div > div:nth-child(2)`),
};

// —— Face A: accept 弹层（board scenario 34）———————————————————————————————
await page.goto(`${BASE}/app?scenario=34`);
await page.locator('.dlg').waitFor({ state: 'visible', timeout: 15000 });
// 进场动画竞态闸：先等帧落定再收 subtree 全部动画的 finished（document 级
// 采集会在动画挂上前空转，探针会量到 zoom-in-95 中途的缩放盒）。
await page.waitForTimeout(400);
await page
  .locator('.dlg')
  .first()
  .evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)).catch(() => {}),
  );
out.acceptRow = {
  box: await box(page, '.dlg-body > div:nth-of-type(1)'),
  style: await cs(page, '.dlg-body > div:nth-of-type(1)'),
};
out.acceptLabel = {
  box: await box(page, '.dlg .ui-checkbox > span:last-of-type'),
  style: await cs(page, '.dlg .ui-checkbox > span:last-of-type'),
};
out.acceptFooter = {
  box: await box(page, '.dlg-foot > div'),
  style: await cs(page, '.dlg-foot > div'),
};
out.acceptCancel = {
  box: await box(page, '.dlg-foot button:first-of-type'),
  style: await cs(page, '.dlg-foot button:first-of-type'),
};
out.acceptDone = {
  box: await box(page, '.dlg-foot button:last-of-type'),
  style: await cs(page, '.dlg-foot button:last-of-type'),
};

// —— Face D: 看板分支弹层（scenario 01 + 卡片分支钮）———————————————————————
await page.goto(BOARD);
await page.locator('.todo-card-branch').first().waitFor({ state: 'visible', timeout: 15000 });
await page.locator('.todo-card-branch').first().click();
await page.locator('.dlg').waitFor({ state: 'visible', timeout: 15000 });
// 进场动画竞态闸：先等帧落定再收 subtree 全部动画的 finished（document 级
// 采集会在动画挂上前空转，探针会量到 zoom-in-95 中途的缩放盒）。
await page.waitForTimeout(400);
await page
  .locator('.dlg')
  .first()
  .evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)).catch(() => {}),
  );
const DB = '.dlg-body > div:nth-of-type(1)';
out.dialogBody = { box: await box(page, DB), style: await cs(page, DB) };
out.dialogBox = {
  box: await box(page, `${DB} > div:nth-of-type(1)`),
  style: await cs(page, `${DB} > div:nth-of-type(1)`),
};
out.dialogRow = {
  box: await box(page, `${DB} > div:nth-of-type(1) > div:nth-child(1)`),
  style: await cs(page, `${DB} > div:nth-of-type(1) > div:nth-child(1)`),
};
out.dialogPill = {
  box: await box(page, `${DB} > button`),
  style: await cs(page, `${DB} > button`),
};
out.dialogDir = {
  box: await box(page, `${DB} > div:nth-of-type(4)`),
  style: await cs(page, `${DB} > div:nth-of-type(4)`),
};
out.dialogForce = {
  box: await box(page, `${DB} > div:nth-of-type(5)`),
  style: await cs(page, `${DB} > div:nth-of-type(5)`),
};
out.dialogToggle =
  TOGGLE_CARRIER === 'switch'
    ? { kind: 'switch', box: await box(page, `${DB} > div:nth-of-type(5) [role="switch"]`) }
    : { kind: 'legacy', box: await box(page, `${DB} .dlg-toggle`) };
out.dialogSync = {
  box: await box(page, '.dlg-foot button'),
  style: await cs(page, '.dlg-foot button'),
};
// git tab：PR 槽（未创建 box 形）
await page.getByRole('tab', { name: 'Git' }).click();
await page.waitForTimeout(200);
out.dialogGitBody = { box: await box(page, DB), style: await cs(page, DB) };
out.dialogPrLabel = await cs(page, `${DB} > div:nth-of-type(2)`);
out.dialogPrBox = {
  box: await box(page, `${DB} > div:nth-of-type(3)`),
  style: await cs(page, `${DB} > div:nth-of-type(3)`),
};
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// —— Face G: 创建 Agent 告警面（team scenario 12 + 创建钮）——————————————————
await page.goto(TEAM);
await page.getByRole('button', { name: '创建 Agent' }).first().waitFor({ state: 'visible', timeout: 15000 });
await page.getByRole('button', { name: '创建 Agent' }).first().click();
await page.locator('.dlg').waitFor({ state: 'visible', timeout: 15000 });
// 进场动画竞态闸：先等帧落定再收 subtree 全部动画的 finished（document 级
// 采集会在动画挂上前空转，探针会量到 zoom-in-95 中途的缩放盒）。
await page.waitForTimeout(400);
await page
  .locator('.dlg')
  .first()
  .evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)).catch(() => {}),
  );
out.agentAvatarRow = {
  box: await box(page, '.dlg .dlg-form > div:nth-of-type(1)'),
  style: await cs(page, '.dlg .dlg-form > div:nth-of-type(1)'),
};
out.agentAvatarImg = {
  box: await box(page, '.dlg .dlg-form > div:nth-of-type(1) img'),
  style: await cs(page, '.dlg .dlg-form > div:nth-of-type(1) img'),
};
out.agentWarn = {
  box: await box(page, '.dlg .dlg-form > div:nth-of-type(2)'),
  style: await cs(page, '.dlg .dlg-form > div:nth-of-type(2)'),
};
out.agentWarnText = await cs(page, '.dlg .dlg-form > div:nth-of-type(2) > span');
out.agentConfigure = {
  box: await box(page, '.dlg .dlg-form > div:nth-of-type(2) > a'),
  style: await cs(page, '.dlg .dlg-form > div:nth-of-type(2) > a'),
};

await browser.close();
writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`probe-parity-951: wrote ${OUT} (${SCHEME}, toggle=${TOGGLE_CARRIER})`);
