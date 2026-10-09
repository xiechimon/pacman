#!/usr/bin/env node
// verify probe — #1009 A1 原型（chat 原语装件：chief 消息流换装 shadcn
// MessageScroller / Message / Bubble / Marker 五件）的位形 smoke + 交互契约钉
// （fixture 面）。
//
// 跑法（fixture 栈先在跑）：
//   cd apps/web && pnpm exec vite build --mode fixture
//   pnpm exec vite preview --host 127.0.0.1 --port ${E2E_PORT:-8403} --strictPort &
//   E2E_PORT=8403 node docs/verify/1009/drive-1009-a1-smoke.mjs
//
// 失败方式先行清单（A1 面枚举，每条一个断言组）：
//  F1 结构翻面破载体：chief-body/chief-stream testid 必须随迁到原语
//     Viewport/Content（overflowY auto 面 = F-R6/R8 pin 的载体）→ S1
//  F2 中和失效：Item 的 [content-visibility:auto] 未钉回 visible（离屏行
//     跳布局，探针/e2e 随滚动相位漂）、Content 未翻 block+gap-0（行距
//     双倍）→ S2
//  F3 Bubble 皮失控：user 行必须落 --secondary 槽（原 BUBBLE_CLS 等值）、
//     零边框（F-R16 44px 药丸 canon）、14px/24px 节奏；robot 行 ghost 档
//     裸文本（bg transparent、零 padding）→ S3
//  F4 Marker 面漂移：note 行居中 12px、机器名下划线保留 → S4
//  F5 hero/gate 迁出滚动区破面：111 面 examples 在位、流零行、composer
//     草稿面 #860 grow 律（120px 顶格，XMON-102 固定轨已被 #860 取代）→ S5
//  F6 滚动律回归：打开落底（defaultScrollPosition=end）→ S6；jump-to-
//     latest 上翻浮出/点击落底/落底退场（#991 Q6 随原语带入）→ S7；
//     最小化重开落底（display:none 丢滚动位——判据翻面留 HITL 裁决）→ S8
//  F7 行载体守恒：chief-msg 联合选择器计数、chief-msg-col/foot/tools、
//     复制/恢复钮 aria 面原样（重钉账的「行为语义不动」判据）→ S9
//  F8 id 贯通面：fixture 捕获形无源 message id → Item 不带 messageId
//     （live 面 id pin 归 e2e live-mock，F-R21/#742 面）→ S10
//
// 证据落本目录：a1-*.png + result-a1-fixture-smoke.json（量测原值，人审面）。

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.E2E_PORT ?? '8403';
const BASE = `http://127.0.0.1:${PORT}`;
const VIEWPORT = { width: 1440, height: 900 };

const results = [];
let failures = 0;
function check(group, name, actual, expected) {
  const ok =
    typeof expected === 'function'
      ? expected(actual)
      : JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  results.push({
    group,
    name,
    actual,
    expected: typeof expected === 'function' ? '(predicate)' : expected,
    ok,
  });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${group}] ${name} — actual=${JSON.stringify(actual)}`);
}

async function shot(page, file) {
  await page.screenshot({ path: join(SCRIPT_DIR, file) });
}

const drawer = (page) => page.locator('.chief-drawer');
const body = (page) => page.getByTestId('chief-body');

/** 进场 fade+scale 落定谓词（ADR 0013 D7；A0 同款）——几何采样前置。 */
async function settled(page) {
  await drawer(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
}

mkdirSync(SCRIPT_DIR, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: VIEWPORT });

// ——— S1/S2/S3/S4/S9/S10：线程捕获面（scenario 114，2 msg + 2 note）———
await page.goto(`${BASE}/app?scenario=114`);
await settled(page);
check('S1 结构', 'scroller 四件套 data-slot 在位', await page.evaluate(() => ({
  root: document.querySelectorAll('.chief-drawer [data-slot=message-scroller]').length,
  viewport: document.querySelectorAll('[data-slot=message-scroller-viewport]').length,
  content: document.querySelectorAll('[data-slot=message-scroller-content]').length,
  items: document.querySelectorAll('[data-slot=message-scroller-item]').length,
})), { root: 1, viewport: 1, content: 1, items: 4 });
check(
  'S1 结构',
  'chief-body = Viewport（overflowY auto 载体随迁，F-R6/R8）',
  await body(page).evaluate((el) => ({
    slot: el.getAttribute('data-slot'),
    overflowY: getComputedStyle(el).overflowY,
  })),
  { slot: 'message-scroller-viewport', overflowY: 'auto' },
);
check(
  'S1 结构',
  'chief-stream = Content（block 中和，行距留行 margin）',
  await page.getByTestId('chief-stream').evaluate((el) => ({
    slot: el.getAttribute('data-slot'),
    display: getComputedStyle(el).display,
    rowGap: getComputedStyle(el).rowGap,
  })),
  { slot: 'message-scroller-content', display: 'block', rowGap: '0px' },
);
check(
  'S2 中和',
  'Item content-visibility 钉回 visible（探针/e2e 确定性）',
  await page
    .locator('[data-slot=message-scroller-item]')
    .evaluateAll((els) => els.map((el) => getComputedStyle(el).contentVisibility)),
  ['visible', 'visible', 'visible', 'visible'],
);
const bubbleFaces = await page.evaluate(() => {
  const user = document.querySelector('[data-testid=chief-bubble]');
  const robot = document.querySelectorAll('[data-slot=bubble-content]')[1];
  const cs = (el) => getComputedStyle(el);
  const token = getComputedStyle(document.documentElement).getPropertyValue('--secondary').trim();
  return {
    userBg: cs(user).backgroundColor,
    userBorder: cs(user).borderTopWidth,
    userFont: cs(user).fontSize,
    userLeading: cs(user).lineHeight,
    userRadius: cs(user).borderTopLeftRadius,
    userPad: `${cs(user).paddingTop}/${cs(user).paddingLeft}`,
    token,
    robotBg: cs(robot).backgroundColor,
    robotPad: cs(robot).paddingTop,
  };
});
check('S3 Bubble 皮', 'user 行底 = --secondary 槽（原 BUBBLE_CLS 等值）', bubbleFaces.userBg, (v) => {
  // rgb 归一后与 token 对（token 是 hex）
  const hex = bubbleFaces.token;
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return false;
  const want = `rgb(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)})`;
  return v === want;
});
check('S3 Bubble 皮', 'user 行零边框（F-R16 44px 药丸 canon 前提）', bubbleFaces.userBorder, '0px');
check('S3 Bubble 皮', 'user 行节奏 14px/24px + 10/12 内垫', [
  bubbleFaces.userFont,
  bubbleFaces.userLeading,
  bubbleFaces.userPad,
], ['14px', '24px', '10px/12px']);
check('S3 Bubble 皮', 'robot 行 ghost 档裸文本（bg 透明 + 零 padding）', [
  bubbleFaces.robotBg,
  bubbleFaces.robotPad,
], ['rgba(0, 0, 0, 0)', '0px']);
check(
  'S4 Marker',
  'note 行 = Marker 原语，居中 12px，机器名下划线在位',
  await page.evaluate(() => {
    const ms = [...document.querySelectorAll('[data-slot=marker]')];
    const cs = getComputedStyle(ms[0]);
    return {
      count: ms.length,
      justify: cs.justifyContent,
      font: cs.fontSize,
      underline: document.querySelectorAll('[data-slot=marker] span.underline').length,
    };
  }),
  { count: 2, justify: 'center', font: '12px', underline: 1 },
);
check(
  'S9 载体守恒',
  'chief-msg 联合计数 + col/foot/tools + 复制/恢复钮',
  await page.evaluate(() => ({
    msgs: document.querySelectorAll('.chief-msg, [data-testid=chief-msg]').length,
    cols: document.querySelectorAll('[data-testid=chief-msg-col]').length,
    foot: document.querySelectorAll('[data-testid=chief-msg-foot]').length,
    tools: document.querySelectorAll('[data-testid=chief-msg-tools]').length,
    copy: document.querySelectorAll('[aria-label=复制]').length,
    rewind: document.querySelectorAll('[aria-label=恢复到此处]').length,
  })),
  { msgs: 2, cols: 2, foot: 1, tools: 1, copy: 2, rewind: 1 },
);
check(
  'S10 id 贯通',
  'fixture 捕获形 Item 无 messageId（live 面 id 归 e2e live-mock pin）',
  await page
    .locator('[data-slot=message-scroller-item]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-message-id'))),
  [null, null, null, null],
);
await shot(page, 'a1-01-thread-114.png');

// ——— S6 打开落底 + S7 jump-to-latest + S8 D6 滚动保留 ———
// 载体面 = chief-md（溢出 117px）：114 面只溢 19px < scrollEdgeThreshold 80，
// 「近底」判定恒成立、jump 钮永不 active（阈值律使然，不是断链）——jump 面
// 必须用溢出超阈值的面取证。dicebear 桩同 e2e 配方（外网防悬置）。
await page.route('**/api.dicebear.com/**', (route) =>
  route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="#888"/></svg>',
  }),
);
await page.goto(`${BASE}/app?scenario=chief-md`);
await settled(page);
const atBottom = () =>
  body(page).evaluate(
    (el) => Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 4,
  );
check(
  'S6 滚动律',
  '面溢出前提（scrollHeight > clientHeight）',
  await body(page).evaluate((el) => el.scrollHeight - el.clientHeight > 80),
  true,
);
check('S6 滚动律', '打开即落底（defaultScrollPosition=end）', await atBottom(), true);
await body(page).evaluate((el) => el.scrollTo({ top: 0 }));
await page.waitForTimeout(400);
const jump = page.locator('[data-slot=message-scroller-button][data-direction=end]');
check('S7 jump', '上翻后 jump-to-latest 浮出（data-active=true）', await jump.getAttribute('data-active'), 'true');
await shot(page, 'a1-02-jump-button.png');
await jump.click();
await page.waitForTimeout(700);
check('S7 jump', '点击后落底', await atBottom(), true);
check(
  'S7 jump',
  '落底后按钮退场（data-active=false）',
  await jump.getAttribute('data-active'),
  'false',
);
await body(page).evaluate((el) => el.scrollTo({ top: 0 }));
await page.waitForTimeout(300);
await page.getByRole('button', { name: '最小化' }).click();
await page.waitForTimeout(600);
await page.keyboard.press('Meta+j');
await settled(page);
// S8 判据翻面（A1 实测裁决点）：Base UI keepMounted 关态 = hidden 属性 =
// display:none——浏览器丢弃滚动位置，D6「滚动存活」在最小化面物理不可达
// （A0 期同样如此，只是当时未取证到这一面；Multica 原形态是 opacity+
// inert 常驻不 display:none，滚动才真保）。A1 的 provider 在重开时按
// defaultScrollPosition=end 落底 = chat 面通行律（与旧 dock 时代「打开
// 落底」行为一致）——本检查钉这个事实判据；「重开落底 vs 真滚动保留
// （需换 inert 常驻载体）」留 HITL 实审裁决。
check('S8 重开落底', '最小化重开 = 落底看最新（chat 通行律；滚动位随 display:none 丢弃）', await atBottom(), true);
await shot(page, 'a1-03-reopen-bottom.png');

// ——— S5：hero 面（111）———
await page.goto(`${BASE}/app?scenario=111`);
await settled(page);
check('S5 hero', 'examples 在位、流零行', await page.evaluate(() => ({
  examples: document.querySelectorAll('[data-testid=chief-examples] button').length,
  items: document.querySelectorAll('[data-slot=message-scroller-item]').length,
})), { examples: 4, items: 0 });
check(
  'S5 hero',
  'composer 草稿面 = #860 grow 律顶格（XMON-102 固定轨已被取代；盒内滚动保留）',
  await page.getByTestId('chief-composer-input').evaluate((el) => ({
    h: getComputedStyle(el).height,
    ov: getComputedStyle(el).overflowY,
  })),
  { h: '120px', ov: 'auto' },
);
await shot(page, 'a1-04-hero-111.png');
// S5b：空 composer 面（114）= 基座轨实测值——两条 check 的读数即 XMON-102
// 重钉（grow 语义）的钉扎值来源（实审裁决 3：「截图上是多少就钉多少」，
// spec 注释引用本 json 的 S5/S5b 行 + a1-04/a1-01 截图）。
await page.goto(`${BASE}/app?scenario=114`);
await settled(page);
check(
  'S5b 空面',
  'composer 空草稿面 = 3 行基座轨（读数以本行为准，非理论常数）',
  await page.getByTestId('chief-composer-input').evaluate((el) => ({
    h: getComputedStyle(el).height,
    ov: getComputedStyle(el).overflowY,
  })),
  { h: '60px', ov: 'auto' },
);

await browser.close();
writeFileSync(
  join(SCRIPT_DIR, 'result-a1-fixture-smoke.json'),
  `${JSON.stringify({ viewport: VIEWPORT, results, failures }, null, 2)}\n`,
);
console.log(`\n${failures === 0 ? 'ALL PASS' : 'FAILURES'} — ${results.length - failures}/${results.length}`);
process.exit(failures === 0 ? 0 : 1);
