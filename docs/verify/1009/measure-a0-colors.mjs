#!/usr/bin/env node
// better-colors 增量实测（验收模板 v3 第 3 项）——#1009 A0 新合成面的对比度
// 真值测量（不许估）：悬浮窗 chrome 与 FAB 族是本轮唯一的新颜色合成面
// （token 零新增颜色值——--card/--foreground/--text-tertiary/--card-button/
// --text-on-accent 全是既有槽；全局色板 #988 已双模 109 对 0 fail 封账不重测）。
//
// 量法：fixture 栈真页面读 computed color / background-color，WCAG 2.1 相对
// 亮度算对比度；双模各跑一遍（dark = :root 默认，light = 根元素挂 .light，
// #106 反相规约）。下限照仓内正典（spec/22 §1.8 / #950 实测先例）：
// 正文/小字 ≥ 4.5:1，UI 字形（图标钮/徽标图形）≥ 3:1。
//
// 用法（fixture 栈先在跑）：
//   E2E_PORT=8403 node docs/verify/1009/measure-a0-colors.mjs
// 证据落本目录 colors-a0.json。

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const PORT = process.env.E2E_PORT ?? '8403';
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'colors-a0.json');

const PAIRS = [
  // [面, 场景 URL, 选择器, 类别]
  ['window body ink on card', '/app?scenario=111', '.chief-drawer', 'text'],
  ['minimize/header icon ink on card', '/app?scenario=111', '.chief-drawer button[aria-label="最小化"]', 'ui'],
  ['model row ink on card', '/app?scenario=111', '.chief-drawer button[aria-label="总管主模型"]', 'text'],
  ['thread chip title ink on card', '/app?scenario=111', '.chief-drawer button[aria-label="主题"] span', 'text'],
  ['unread badge ink on card-button', '/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=detail-unread', '.fab-badge', 'text'],
  ['FAB glyph ink on card', '/app?scenario=100', '.chief-fab', 'ui'],
  ['FAB kbd-hint chip ink', '/app?scenario=100', '.chief-fab .kbd-hint', 'ui'],
];

function luminance([r, g, b]) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(fg, bg) {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}
const parseRgb = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number);

const results = [];
const browser = await chromium.launch();
for (const theme of ['dark', 'light']) {
  const page = await (
    await browser.newContext({ viewport: { width: 1440, height: 732 }, colorScheme: theme })
  ).newPage();
  for (const [name, url, selector, kind] of PAIRS) {
    await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle' });
    if (theme === 'light') await page.evaluate(() => document.documentElement.classList.add('light'));
    // FAB 与窗互斥（D4）：捕获形窗开的面先最小化，FAB 才在位
    if (selector.startsWith('.chief-fab') && (await page.locator('.chief-drawer').isVisible())) {
      await page.locator('.chief-drawer button[aria-label="最小化"]').click();
      await page.locator('.chief-drawer').waitFor({ state: 'hidden' });
    }
    await page.waitForTimeout(150);
    const el = page.locator(selector).first();
    if ((await el.count()) === 0) {
      results.push({ theme, name, selector, error: 'not found' });
      continue;
    }
    const { color, bg } = await el.evaluate((node) => {
      // 背景取自身或最近不透明祖先（窗/FAB _own 底即 --card/--card-button）
      let n = node;
      let background = 'rgba(0, 0, 0, 0)';
      while (n != null) {
        const cs = getComputedStyle(n);
        background = cs.backgroundColor;
        const alpha = background.match(/[\d.]+/g)?.[3];
        if (alpha === undefined || Number(alpha) > 0) break;
        n = n.parentElement;
      }
      return { color: getComputedStyle(node).color, bg: background };
    });
    const value = ratio(parseRgb(color), parseRgb(bg));
    const floor = kind === 'text' ? 4.5 : 3;
    results.push({
      theme,
      name,
      selector,
      color,
      bg,
      ratio: Number(value.toFixed(2)),
      floor,
      pass: value >= floor,
    });
  }
  await page.context().close();
}
await browser.close();

const failed = results.filter((r) => r.pass === false || r.error);
writeFileSync(OUT, `${JSON.stringify({ results, failed: failed.length }, null, 2)}\n`);
for (const r of results) {
  console.log(
    `${r.pass === false ? 'FAIL' : r.error ? 'ERR ' : 'PASS'} [${r.theme}] ${r.name} — ${r.ratio ?? r.error} (floor ${r.floor ?? '-'})`,
  );
}
console.log(failed.length === 0 ? `ALL PASS (${results.length} pairs)` : `FAILURES: ${failed.length}`);
process.exit(failed.length === 0 ? 0 : 1);
