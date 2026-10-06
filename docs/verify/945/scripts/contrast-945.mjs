#!/usr/bin/env node

// #945 acceptance 3 (better-colors 本域实测，不许估): renders the migrated
// detail faces on the fixture stack and measures real computed color pairs
// (fg on its effective composited bg), both themes, WCAG 2.x relative
// luminance. Floors follow the #943 precedent: canon slot pairs (§1.7/1.8
// of spec/22) are checked against the canon's own measured threshold;
// consumer-invented pairs get text 4.5 / non-text UI 3.0 (better-accessibility).
//
// #908 裁决 2（#946/#947「--text-dim 消费面同律」判例）：--text-dim 在
// 非 background 抬升面 light 模实测 2.4–2.89 < 槽地板 3（canon 门控对是
// dim × background），detail-a 全部 dim 消费面已换引 --text-tertiary
// （token 值冻结不动）。本表按换槽后的终态实测。
//
// Usage:
//   node docs/verify/945/scripts/contrast-945.mjs --base http://localhost:8402 \
//     --out docs/verify/945
//
// Output: <out>/contrast-945.json + <out>/contrast-945.md

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
const OUT = resolve(REPO, arg('out', 'docs/verify/945'));

const DETAIL = '/app/todo/7ve0iOkQ-JBpSL98zSiGc';

// pair faces: [scene url, selector, label, kind]
//   kind: canon-<ratio>/<threshold> — spec/22 §1.7/1.8 gated slot pair
//         text | ui                — consumer-invented, floor 4.5 / 3.0
const PAIRS = [
  // chat ink ladder on the center column surface
  { url: `${DETAIL}?scenario=36`, sel: '[data-testid="agent-text"]', label: 'agent text on surface', kind: 'canon 14.17/4.5' },
  { url: `${DETAIL}?scenario=36`, sel: '[data-testid="transcript-note"]', label: 'note tertiary on surface', kind: 'canon tertiary 7.86/4.5' },
  { url: `${DETAIL}?scenario=36`, sel: '.chat-stamp', label: 'stamp tertiary on surface', kind: 'canon tertiary 7.86/4.5' },
  { url: `${DETAIL}?scenario=36`, sel: '[data-testid="user-bubble"]', label: 'bubble primary on surface-secondary', kind: 'canon 11.81/4.5' },
  { url: `${DETAIL}?scenario=36`, sel: '.chat-taskline-title', label: 'taskline title on surface', kind: 'canon 14.17/4.5' },
  { url: `${DETAIL}?scenario=36`, sel: '.chat-taskline-seq', label: 'taskline seq secondary on code-bg', kind: 'text' },
  // tool group family
  { url: `${DETAIL}?scenario=28`, sel: '[data-testid="tool-pill"]', label: 'tool pill tertiary on surface-secondary', kind: 'text' },
  // scenario 28 的组无 output 块（工具输出默认折叠，md-toolout 才是带
  // stdout 的采集面）：先点组 toggle（role+可及名载体）再量。
  { url: `${DETAIL}?scenario=md-toolout`, clickName: '工具过程', sel: '[data-testid="tool-output"]', label: 'tool output primary on code-bg', kind: 'canon 11.81/4.5' },
  { url: `${DETAIL}?scenario=md-toolout`, sel: '[data-testid="md-code"]', label: 'md fence primary on code-bg', kind: 'canon 11.81/4.5' },
  { url: `${DETAIL}?scenario=md-toolout`, sel: '[data-testid="md-ordinal"]', label: 'md ordinal tertiary on surface', kind: 'canon tertiary 7.86/4.5' },
  // doc pane / diff faces
  { url: `${DETAIL}?scenario=17b`, sel: '.doc-pane-head', label: 'pane head secondary on surface', kind: 'canon secondary 11.05/4.5' },
  { url: `${DETAIL}?scenario=27b`, sel: '.doc-file-row', label: 'file row secondary on surface-secondary', kind: 'canon 11.81/4.5' },
  { url: `${DETAIL}?scenario=27b`, sel: '.diff-hunk-head', label: 'hunk head tertiary on surface-secondary', kind: 'text' },
  { url: `${DETAIL}?scenario=27b`, sel: '.diff-line--add', label: 'diff add fg on add bg', kind: 'canon 6/4.5' },
  { url: `${DETAIL}?scenario=27b`, sel: '.diff-no', label: 'gutter tertiary on surface', kind: 'canon tertiary 7.86/4.5' },
  { url: `${DETAIL}?scenario=66x`, sel: '.doc-changes-add', label: 'changes +N add fg on surface', kind: 'canon add-fg 3', skip: true },
  { url: `${DETAIL}?scenario=27b`, sel: '.doc-file-add', label: 'file +N add fg on surface-secondary', kind: 'text' },
  // head + chip
  { url: `${DETAIL}?scenario=17b`, sel: '[data-testid="detail-head"] .detail-chip [data-tone]', label: 'status chip confirm tone pair', kind: 'canon 7.6/4.5' },
  { url: `${DETAIL}?scenario=36`, sel: '[data-testid="detail-head"] .detail-chip [data-tone]', label: 'status chip done tone pair', kind: 'canon 7.84/4.5' },
  { url: `${DETAIL}?scenario=23`, sel: '[data-testid="detail-head"] .detail-chip [data-tone]', label: 'status chip idle tone pair', kind: 'canon 6.55/4.5' },
  { url: `${DETAIL}?scenario=26`, sel: '[data-testid="detail-head"] .detail-chip [data-tone]', label: 'status chip plan tone pair', kind: 'canon 6.74/4.5' },
  { url: `${DETAIL}?scenario=17b`, sel: '[data-testid="detail-title"]', label: 'head title primary on surface', kind: 'canon 14.17/4.5' },
  { url: `${DETAIL}?scenario=17b`, sel: '.detail-head-action', label: 'head primary on-accent on card-button', kind: 'canon 8.24/4.5' },
  { url: `${DETAIL}?scenario=17b`, sel: '.detail-seq', label: 'seq tertiary on surface', kind: 'canon tertiary 7.86/4.5' },
  // fresh face
  { url: '/app/todo/fresh-probe?scenario=23', sel: '.fresh-title', label: 'fresh title primary on surface', kind: 'canon 14.17/4.5' },
  { url: '/app/todo/fresh-probe?scenario=23', sel: '.fresh-nodesc', label: 'fresh nodesc tertiary on surface', kind: 'canon tertiary 7.86/4.5' },
  { url: '/app/todo/fresh-probe?scenario=23', sel: '.fresh-start', label: 'fresh start on-accent on card-button', kind: 'canon 8.24/4.5' },
  // composer (fixture static face)
  { url: `${DETAIL}?scenario=17b`, sel: '[data-testid="composer-placeholder"]', label: 'placeholder tertiary on surface-secondary', kind: 'text' },
  { url: `${DETAIL}?scenario=26`, sel: '.composer-send', label: 'send idle tertiary on seg-active', kind: 'ui' },
  { url: `${DETAIL}?scenario=26`, sel: '.composer-stop', label: 'stop glyph on seg-active', kind: 'ui' },
  { url: `${DETAIL}?scenario=26`, sel: '.composer-tool', label: 'tool tertiary on surface-secondary', kind: 'canon tertiary-on-surface-secondary 3', skip: true },
  // fab + badge
  { url: `${DETAIL}?scenario=detail-unread`, sel: '.fab-badge', label: 'fab badge on-accent on card-button', kind: 'canon 8.24/4.5' },
  { url: `${DETAIL}?scenario=detail-unread`, sel: '.detail-fab', label: 'fab tertiary on surface', kind: 'canon tertiary 7.86/4.5' },
  // version menu + doc range chip
  { url: '/app/todo/r8-15?scenario=66', sel: '.doc-range-chip', label: 'range chip secondary on range-chip-bg', kind: 'canon 11.81/4.5' },
  { url: '/app/todo/r8-15?scenario=66', sel: '.doc-changes-stat', label: 'changes stat tertiary on surface', kind: 'canon tertiary 7.86/4.5' },
  { url: '/app/todo/r8-15?scenario=66', sel: '.doc-changes-add', label: 'changes +N add fg on surface', kind: 'text' },
  // scenario 66 = add-only diff（fixture 66 无删除数，−N span 不渲染）；
  // 删除面走 72 = diffV2V3（dynamic→manual 换稿，含 del）。
  { url: '/app/todo/r8-15?scenario=72', sel: '.doc-changes-del', label: 'changes -N danger on surface', kind: 'canon danger 9.56/3' },
  // user menu (opened)
  { url: `${DETAIL}?scenario=17b`, click: '.sidebar-user', sel: '.user-menu-name', label: 'menu name primary on popover-bg', kind: 'canon 13.09/4.5' },
  { url: `${DETAIL}?scenario=17b`, click: '.sidebar-user', sel: '.user-menu-row', label: 'menu row secondary on popover-bg', kind: 'canon 11.05/4.5' },
  {
    url: `${DETAIL}?scenario=17b`,
    click: '.sidebar-user',
    sel: '.user-menu-seg button[data-active="false"]',
    label: 'seg off tertiary on popover-bg',
    kind: 'canon tertiary 7.86/4.5',
  },
  {
    url: `${DETAIL}?scenario=17b`,
    click: '.sidebar-user',
    sel: '.user-menu-seg button[data-active="true"]',
    label: 'seg on secondary on seg-active',
    kind: 'canon 9.08/4.5',
  },
  // rerun overlay family
  { url: '/app/todo/r8-12?scenario=56', sel: '.overlay-title', label: 'overlay title primary on popover-bg', kind: 'canon 13.09/4.5' },
  { url: '/app/todo/r8-12?scenario=56', sel: '.rerun-info', label: 'rerun info secondary on popover-bg', kind: 'canon 11.05/4.5' },
];

// review-face pairs need the live stack (review dialog only opens on live
// confirm/review surfaces) — pinned by the live drive's contrast section.

function measurePairs(page, pairs) {
  return page.evaluate((pairs) => {
    const parse = (v) => {
      const m = v.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const parts = m[1].split(/[\s,]+/).filter(Boolean).map(Number);
      return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
    };
    const over = (fg, bg) => ({
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
      a: 1,
    });
    const effectiveBg = (el) => {
      const layers = [];
      let node = el;
      while (node != null && node !== document.documentElement) {
        const c = parse(getComputedStyle(node).backgroundColor);
        if (c != null && c.a > 0) {
          layers.push(c);
          if (c.a === 1) break;
        }
        node = node.parentElement;
      }
      const root = parse(getComputedStyle(document.documentElement).backgroundColor) ?? {
        r: 30,
        g: 27,
        b: 22,
        a: 1,
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
    return pairs.map(({ sel, label, kind }) => {
      const el = document.querySelector(sel);
      if (el == null) return { sel, label, kind, missing: true };
      const cs = getComputedStyle(el);
      const fgRaw = parse(cs.color);
      const bg = effectiveBg(el);
      const fg = fgRaw.a < 1 ? over(fgRaw, bg) : fgRaw;
      const l1 = lum(fg);
      const l2 = lum(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const toHex = (c) =>
        `#${[c.r, c.g, c.b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')}`;
      return {
        sel,
        label,
        kind,
        fg: toHex(fg),
        bg: toHex(bg),
        ratio: Math.round(ratio * 100) / 100,
      };
    });
  }, pairs);
}

async function run(browser, theme) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 732 } });
  await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);
  const results = [];
  let currentUrl = null;
  for (const pair of PAIRS) {
    if (pair.skip) continue;
    const interactive = pair.click !== undefined || pair.clickName !== undefined;
    if (pair.url !== currentUrl || interactive) {
      await page.goto(`${BASE}${pair.url}`);
      await page.waitForLoadState('networkidle');
      currentUrl = pair.url;
    }
    if (interactive) {
      const loc =
        pair.click != null
          ? page.locator(pair.click).first()
          : page.getByRole('button', { name: pair.clickName }).first();
      if ((await loc.count()) > 0) {
        await loc.click();
        await page.waitForTimeout(250);
      }
    }
    const [row] = await measurePairs(page, [pair]);
    results.push({ ...row, theme });
    if (interactive) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      currentUrl = null;
    }
  }
  await page.close();
  return results;
}

const floorFor = (kind) => {
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
  '# #945 better-colors 本域实测（渲染对，双主题）',
  '',
  'floor 口径（#943 判例）：canon 槽对按 spec/22 §1.7/1.8 自带实测阈值；消费面自造对 文本 4.5 / 非文本 UI 3.0。',
  '',
  '| theme | face | fg | bg | ratio | floor | 判定 |',
  '| --- | --- | --- | --- | --- | --- | --- |',
];
for (const row of all) {
  if (row.missing === true) {
    lines.push(`| ${row.theme} | ${row.label} | — | — | — | — | MISSING (${row.sel}) |`);
    fail += 1;
    continue;
  }
  const floor = floorFor(row.kind);
  const pass = row.ratio >= floor;
  if (!pass) fail += 1;
  lines.push(
    `| ${row.theme} | ${row.label} | ${row.fg} | ${row.bg} | ${row.ratio} | ${floor} | ${pass ? 'PASS' : 'FAIL'} |`,
  );
}
writeFileSync(join(OUT, 'contrast-945.json'), JSON.stringify(all, null, 1));
writeFileSync(join(OUT, 'contrast-945.md'), `${lines.join('\n')}\n`);
console.log(`contrast-945: ${all.length} rows, FAIL ${fail} → ${join(OUT, 'contrast-945.md')}`);
process.exit(fail > 0 ? 1 : 0);
