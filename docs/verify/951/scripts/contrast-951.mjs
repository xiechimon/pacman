#!/usr/bin/env node

// #951 acceptance 3 (better-colors 本域实测，不许估): renders the migrated
// detail-b faces on the fixture stack and measures real computed color pairs
// (fg on its effective composited bg), both themes, WCAG 2.x relative
// luminance. Floors follow the #943/#945 precedent: canon slot pairs
// (§1.7/1.8 of spec/22) are checked against the canon's own measured
// threshold; consumer-invented pairs get text 4.5 / non-text UI 3.0
// (better-accessibility); §1.3 report-only 族（失能态 spot-disabled 对）
// 不设地板，只报数并与 §1.7/1.8 表值对账。
//
// review/reject 弹层与 stop-confirm 只在 live 面可开（#945 同判例）——
// 其对比度对在 live drive 的 contrast 段实测（docs/verify/951/live/）。
// reset 弹层（拖拽落位才开）的墨槽对 = accept 弹层同槽对（primary/tertiary
// on popover-bg），由本表 accept 段覆盖；槽值冻结（token 不动）故同对同值。
//
// Usage:
//   node docs/verify/951/scripts/contrast-951.mjs --base http://127.0.0.1:8402 \
//     --out docs/verify/951
//
// Output: <out>/contrast-951.json + <out>/contrast-951.md

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const BASE = arg('base', 'http://localhost:8402');
const OUT = resolve(REPO, arg('out', 'docs/verify/951'));

const DETAIL = '/app/todo/7ve0iOkQ-JBpSL98zSiGc';
const RIGHT = '[data-testid="detail-right"]';
const BODY = `${RIGHT} .pane-section-body`;
const BR = `${BODY} > div`;

// pair faces: { url, sel|text|testid, click?, clickName?, label, kind, skip? }
//   kind: canon-<ratio>/<threshold> — spec/22 §1.7/1.8 gated slot pair
//         text | ui                — consumer-invented, floor 4.5 / 3.0
//         report                   — §1.3 report-only（失能态），不设地板
const PAIRS = [
  // —— Token 用量 section（r7 30）——
  { url: `${DETAIL}?scenario=30`, sel: `${BODY} > div:nth-child(1) > span:nth-child(1)`, label: 'token total num primary on surface', kind: 'canon 14.17/4.5' },
  { url: `${DETAIL}?scenario=30`, sel: `${BODY} > div:nth-child(1) > span:nth-child(2)`, label: 'token unit tertiary on surface', kind: 'canon tertiary 7.86/4.5' },
  { url: `${DETAIL}?scenario=30`, sel: `${BODY} > div:nth-child(2) > span:nth-child(1)`, label: 'token model name secondary on surface', kind: 'canon secondary 11.05/4.5' },
  { url: `${DETAIL}?scenario=30`, sel: `${BODY} > div:nth-child(2) > span:nth-child(2)`, label: 'token model total tertiary on surface', kind: 'canon tertiary 7.86/4.5' },
  { url: `${DETAIL}?scenario=30`, sel: `${BODY} > div:nth-child(3) > div:nth-child(1) > span:nth-child(1)`, label: 'token stat label tertiary on surface', kind: 'canon tertiary 7.86/4.5' },
  { url: `${DETAIL}?scenario=30`, sel: `${BODY} > div:nth-child(3) > div:nth-child(1) > span:nth-child(2)`, label: 'token stat value primary on surface', kind: 'canon 14.17/4.5' },
  // —— 分支与 PR section（r7 31）——
  { url: `${DETAIL}?scenario=31`, sel: `${BR} > div:nth-of-type(1) > div:nth-child(1) > span:nth-child(1)`, label: 'branch label tertiary on dialog-box-bg', kind: 'text' },
  { url: `${DETAIL}?scenario=31`, sel: `${BR} > div:nth-of-type(1) > div:nth-child(1) > span:nth-child(2)`, label: 'branch value primary on dialog-box-bg', kind: 'canon 13.09/4.5' },
  { url: `${DETAIL}?scenario=31`, sel: `${BR} > div:nth-of-type(1) > div:nth-child(1) > button`, label: 'copy glyph tertiary on dialog-box-bg', kind: 'ui' },
  { url: `${DETAIL}?scenario=31`, sel: `${BR} > button`, label: 'machine pill primary on surface', kind: 'canon 14.17/4.5' },
  { url: `${DETAIL}?scenario=31`, sel: `${BR} > button > span:nth-child(1)`, label: 'machine dot badge-done on surface', kind: 'ui', fgFrom: 'background' },
  { url: `${DETAIL}?scenario=31`, sel: `${BR} > button svg`, label: 'machine chevron tertiary on surface', kind: 'ui' },
  { url: `${DETAIL}?scenario=31`, sel: `${BR} > div:nth-of-type(4)`, label: 'dir box tertiary on surface', kind: 'canon tertiary 7.86/4.5' },
  { url: `${DETAIL}?scenario=31`, sel: `${BR} > div:nth-of-type(5) > div:nth-child(1) > div:nth-child(2)`, label: 'force desc tertiary on surface', kind: 'canon tertiary 7.86/4.5' },
  { url: `${DETAIL}?scenario=31`, sel: `${BR} > div:nth-of-type(7)`, label: 'pr slot (未创建) tertiary on surface', kind: 'canon tertiary 7.86/4.5' },
  { url: `${DETAIL}?scenario=31`, sel: `${BR} > div:nth-of-type(8) button`, label: 'sync label spot-disabled-fg on spot-disabled', kind: 'report' },
  // Switch 件 = carrier 层冻结面（§1.5 已实测 gated：状态可辨由 track 翻转
  // 11.03:1 + thumb 位置承载）；亮模 unchecked track 对衬底 1.44 是 §4-1 已裁
  // 决的 report-only 软对比项（处置权在视觉方向票，本票不加描边/投影）。
  { url: `${DETAIL}?scenario=31`, sel: `${BR} [role="switch"]`, label: 'switch track unchecked vs pane bg (§4-1 report-only)', kind: 'report', fgFrom: 'background' },
  // —— 运行历史 section（r7 32）——
  { url: `${DETAIL}?scenario=32`, sel: '[data-testid="history-row"] > div > div:nth-child(1) > span:nth-child(1)', label: 'history label primary on surface', kind: 'canon 14.17/4.5' },
  { url: `${DETAIL}?scenario=32`, sel: '[data-testid="history-row"] > div > div:nth-child(2)', label: 'history meta tertiary on surface', kind: 'canon tertiary 7.86/4.5' },
  { url: `${DETAIL}?scenario=32`, sel: '[data-testid="history-row"] > span, [data-testid="history-row"] > svg', label: 'history glyph (done/stop/ring) on surface', kind: 'ui' },
  { url: `${DETAIL}?scenario=32`, sel: '[data-testid="history-row"] > div > div:nth-child(1) > span:nth-child(2)', label: 'history 当前 chip tertiary on code-bg', kind: 'text', skip: true },
  // —— accept 弹层（board scenario 34）——
  { url: '/app?scenario=34', sel: '.dlg .ui-checkbox > span:last-of-type', label: 'accept checkbox label primary on popover-bg', kind: 'canon 13.09/4.5' },
  { url: '/app?scenario=34', sel: '.dlg-foot button:first-of-type', label: 'accept cancel tertiary on popover-bg', kind: 'canon tertiary 7.86/4.5' },
  { url: '/app?scenario=34', sel: '.dlg-foot button:last-of-type', label: 'accept done on-accent on card-button', kind: 'canon 8.24/4.5' },
  // —— 看板分支弹层（scenario 01 + 卡片分支钮）——
  { url: '/app?scenario=01', click: '.todo-card-branch', sel: '.dlg-body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-child(1) > span:nth-child(2)', label: 'dialog branch value primary on dialog-box-bg', kind: 'canon 13.09/4.5' },
  { url: '/app?scenario=01', click: '.todo-card-branch', sel: '.dlg-body > div:nth-of-type(1) > button', label: 'dialog machine pill primary on surface', kind: 'canon 14.17/4.5' },
  { url: '/app?scenario=01', click: '.todo-card-branch', sel: '.dlg-body > div:nth-of-type(1) > div:nth-of-type(4)', label: 'dialog dir box tertiary on surface', kind: 'canon tertiary 7.86/4.5' },
  { url: '/app?scenario=01', click: '.todo-card-branch', sel: '.dlg-foot button', label: 'dialog sync label spot-disabled-fg on spot-disabled', kind: 'report' },
  { url: '/app?scenario=01', click: '.todo-card-branch', clickName2: 'Git', sel: '.dlg-body > div:nth-of-type(1) > div:nth-of-type(3)', label: 'dialog git PR slot tertiary on surface', kind: 'canon tertiary 7.86/4.5' },
  // —— 创建 Agent 告警面（team scenario 12）——
  { url: '/app/team?scenario=12', clickName: '创建 Agent', sel: '.dlg .dlg-form > div:nth-of-type(2) > span', label: 'agent warn secondary on surface', kind: 'canon secondary 11.05/4.5' },
  { url: '/app/team?scenario=12', clickName: '创建 Agent', sel: '.dlg .dlg-form > div:nth-of-type(2) > a', label: 'agent configure link (inherit) on surface', kind: 'text' },
];

const measure = (handle, fgFrom = 'color') =>
  handle.evaluate((el, fgFrom) => {
    const parse = (v) => {
      const m = v.match(/rgba?\(([^)]+)\)/);
      if (m) {
        const parts = m[1].split(/[\s,]+/).filter(Boolean).map(Number);
        return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
      }
      // color-mix 槽的 computed 形：color(srgb r g b [/ a])，通道是 0–1 浮点。
      const s = v.match(/color\(srgb\s+([^)]+)\)/);
      if (s) {
        const raw = s[1].split(/\s+/).filter((x) => x !== '/');
        const nums = raw.map(Number);
        const a = s[1].includes('/') && raw.length > 3 ? nums[3] : 1;
        return {
          r: Math.round(nums[0] * 255),
          g: Math.round(nums[1] * 255),
          b: Math.round(nums[2] * 255),
          a,
        };
      }
      // dark 档 unchecked track 走 TW 透明度修饰（bg-input/80）——浏览器序列
      // 化成 oklab()，按 oklab→linear sRGB→sRGB 还原（测量面自用，与 §3.2 的
      // token 记法契约无关——那是值探针的正则口径）。
      const ok = v.match(/oklab\(([^)]+)\)/);
      if (ok) {
        const raw = ok[1].split(/\s+/).filter((x) => x !== '/');
        const n = raw.map(Number);
        const alpha = ok[1].includes('/') && raw.length > 3 ? n[3] : 1;
        const l_ = n[0] + 0.3963377774 * n[1] + 0.2158037573 * n[2];
        const m_ = n[0] - 0.1055613458 * n[1] - 0.0638541728 * n[2];
        const s_ = n[0] - 0.0894841775 * n[1] - 1.291485548 * n[2];
        const l = l_ ** 3;
        const m = m_ ** 3;
        const ss = s_ ** 3;
        const lin = [
          4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * ss,
          -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * ss,
          -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * ss,
        ];
        const g = (x) => {
          const c = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
          return Math.round(Math.min(1, Math.max(0, c)) * 255);
        };
        return { r: g(lin[0]), g: g(lin[1]), b: g(lin[2]), a: alpha };
      }
      return null;
    };
    const over = (fg, bg) => ({
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
      a: 1,
    });
    const effectiveBg = (node0) => {
      const layers = [];
      let node = node0;
      while (node != null && node !== document.documentElement) {
        const c = parse(getComputedStyle(node).backgroundColor);
        if (c != null && c.a > 0) {
          layers.push(c);
          if (c.a === 1) break;
        }
        node = node.parentElement;
      }
      const root = parse(getComputedStyle(document.documentElement).backgroundColor) ?? {
        r: 30, g: 27, b: 22, a: 1,
      };
      let acc = root;
      for (let i = layers.length - 1; i >= 0; i -= 1) acc = over(layers[i], acc);
      return acc;
    };
    const lum = (c) => {
      const f = (x) => {
        const s = x / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const cs = getComputedStyle(el);
    // 图形元素（状态点/开关 track）没有文字——前景 = 元素自身背景，衬底 =
    // 父级合成底（WCAG 1.4.11 非文本对比的正确配对方向）。
    if (fgFrom === 'background') {
      const ownRaw = parse(cs.backgroundColor);
      if (ownRaw == null) return { unparsed: cs.backgroundColor };
      const parentBg = el.parentElement != null ? effectiveBg(el.parentElement) : effectiveBg(el);
      const own = ownRaw.a < 1 ? over(ownRaw, parentBg) : ownRaw;
      const l1 = lum(own);
      const l2 = lum(parentBg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const toHex2 = (c) =>
        `#${[c.r, c.g, c.b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')}`;
      return { fg: toHex2(own), bg: toHex2(parentBg), ratio: Math.round(ratio * 100) / 100 };
    }
    const fgRaw = parse(cs.color);
    if (fgRaw == null) return { unparsed: cs.color };
    const bg = effectiveBg(el);
    const fg = fgRaw.a < 1 ? over(fgRaw, bg) : fgRaw;
    const l1 = lum(fg);
    const l2 = lum(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const toHex = (c) =>
      `#${[c.r, c.g, c.b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')}`;
    return { fg: toHex(fg), bg: toHex(bg), ratio: Math.round(ratio * 100) / 100 };
  }, fgFrom);

async function run(browser, theme) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 732 } });
  await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);
  const results = [];
  let currentUrl = null;
  for (const pair of PAIRS) {
    if (pair.skip) continue;
    const interactive = pair.click !== undefined || pair.clickName !== undefined || pair.clickName2 !== undefined;
    if (pair.url !== currentUrl || interactive) {
      await page.goto(`${BASE}${pair.url}`);
      await page.waitForLoadState('networkidle');
      currentUrl = pair.url;
    }
    if (interactive) {
      if (pair.click != null) {
        await page.locator(pair.click).first().click();
        await page.waitForTimeout(350);
      }
      if (pair.clickName != null) {
        await page.getByRole('button', { name: pair.clickName }).first().click();
        await page.waitForTimeout(350);
      }
      if (pair.clickName2 != null) {
        await page.getByRole('tab', { name: pair.clickName2 }).click();
        await page.waitForTimeout(250);
      }
    }
    const loc = page.locator(pair.sel).first();
    if ((await loc.count()) === 0) {
      results.push({ sel: pair.sel, label: pair.label, kind: pair.kind, missing: true, theme });
    } else {
      const row = await measure(await loc.elementHandle(), pair.fgFrom ?? 'color');
      results.push({ ...row, sel: pair.sel, label: pair.label, kind: pair.kind, theme });
    }
    if (interactive) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
      currentUrl = null;
    }
  }
  await page.close();
  return results;
}

const floorFor = (kind) => {
  if (kind === 'report') return null;
  if (kind.startsWith('canon')) {
    const m = kind.match(/\/(\d+(?:\.\d+)?)$/);
    return m != null ? Number(m[1]) : 4.5;
  }
  return kind === 'ui' ? 3 : 4.5;
};

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const all = [];
for (const theme of ['dark', 'light']) all.push(...(await run(browser, theme)));
await browser.close();

let fail = 0;
const lines = [
  '# #951 better-colors 本域实测（渲染对，双主题）',
  '',
  'floor 口径（#943/#945 判例）：canon 槽对按 spec/22 §1.7/1.8 自带实测阈值；消费面自造对 文本 4.5 / 非文本 UI 3.0；report = §1.3 report-only 族（失能态不设地板，只报数对账）。',
  '',
  'review/reject/stop-confirm 弹层与 reset 拖拽面不在 fixture 面——live drive 段实测/同槽对覆盖（脚本头注）。',
  '',
  '| theme | face | fg | bg | ratio | floor | 判定 |',
  '| --- | --- | --- | --- | --- | --- | --- |',
];
for (const row of all) {
  if (row.missing === true || row.unparsed != null) {
    lines.push(
      `| ${row.theme} | ${row.label} | — | — | — | — | MISSING (${row.sel}${row.unparsed != null ? `, unparsed ${row.unparsed}` : ''}) |`,
    );
    fail += 1;
    continue;
  }
  const floor = floorFor(row.kind);
  if (floor == null) {
    lines.push(`| ${row.theme} | ${row.label} | ${row.fg} | ${row.bg} | ${row.ratio} | — | REPORT |`);
    continue;
  }
  const pass = row.ratio >= floor;
  if (!pass) fail += 1;
  lines.push(
    `| ${row.theme} | ${row.label} | ${row.fg} | ${row.bg} | ${row.ratio} | ${floor} | ${pass ? 'PASS' : 'FAIL'} |`,
  );
}
writeFileSync(join(OUT, 'contrast-951.json'), JSON.stringify(all, null, 1));
writeFileSync(join(OUT, 'contrast-951.md'), `${lines.join('\n')}\n`);
console.log(`contrast-951: ${all.length} rows, FAIL ${fail} → ${join(OUT, 'contrast-951.md')}`);
process.exit(fail > 0 ? 1 : 0);
